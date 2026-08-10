/**
 * §8g open finding #3, measured: when does MCE stop being a sparse-bin artefact?
 *
 * MCE is the WORST single calibration bin, so at 40 binary points spread over 10
 * bins it is reporting whichever bin caught one or two forecasts. The fix is not
 * to pick a bigger batch and hope — it is to watch MCE and the emptiest occupied
 * bin together as the batch grows, and stop where MCE stops moving for reasons
 * of sample size.
 *
 * Slow on purpose (tens of thousands of simulations), so it sits behind its own
 * flag rather than inside the standard benchmark run:
 *
 *   PROTEUS_SCALE=1 npx vitest run tests/benchmark/scaling
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import { AsOfCorpus } from "../../src/corpus/as-of.js";
import { generateSyntheticCorpus } from "../../src/corpus/synthetic.js";
import { calibrationReport } from "../../src/metrics/calibration.js";
import { toBinary } from "../../src/metrics/types.js";
import { runBenchmark } from "../../src/pipeline/benchmark.js";
import {
  influenceOpsBinding,
  influenceOpsQuantity,
} from "../../src/pipeline/influence-ops-binding.js";
import type { BinaryForecast } from "../../src/metrics/types.js";
import type { BenchmarkReport } from "../../src/pipeline/benchmark.js";

const ENABLED = process.env.PROTEUS_SCALE === "1";

const ADOPTION_RANGE = [0.35, 0.65] as const;
const RESOLVE_AT_TICK = 119;
const BAND_COUNT = 4;

/** Batch sizes to walk. The first row is the §8g configuration, unchanged. */
const SETTINGS = [
  { questionsPerArm: 10, ensembleSize: 16 },
  { questionsPerArm: 40, ensembleSize: 16 },
  { questionsPerArm: 40, ensembleSize: 32 },
  { questionsPerArm: 80, ensembleSize: 32 },
] as const;

function binaryForecastsOf(
  report: BenchmarkReport,
  arm: string,
): BinaryForecast[] {
  const forecasts: BinaryForecast[] = [];
  report.results.forEach((result, index) => {
    if (report.questions[index]!.arm !== arm) return;
    if (!result.forecast) return;
    for (let band = 0; band < result.forecast.probabilities.length; band++) {
      forecasts.push(toBinary(result.forecast, band));
    }
  });
  return forecasts;
}

describe.skipIf(!ENABLED)("benchmark batch-size scaling", () => {
  it("shows where MCE stops moving with sample size", async () => {
    const root = await mkdtemp(join(tmpdir(), "proteus-scale-"));
    try {
      const { snapshot } = generateSyntheticCorpus({
        seed: "benchmark-corpus",
        documentCount: 60,
        sourceCount: 6,
        startDate: "2026-01-01",
        endDate: "2026-02-20",
        conflictsPerKind: 2,
      });

      const lines = [
        "PROTEUS batch-size scaling — regime: synthetic_oracle",
        "",
        "q/arm  runs  arm                    n   sims  abstain  unres  Brier   skill    ECE     MCE     bins  minBin",
      ];

      for (const setting of SETTINGS) {
        const report = await runBenchmark({
          binding: influenceOpsBinding,
          store: new ArtifactStore(root),
          corpus: new AsOfCorpus(snapshot, "2026-03-01"),
          quantity: influenceOpsQuantity(
            "adoptionRate",
            RESOLVE_AT_TICK,
            ADOPTION_RANGE,
          ),
          asOf: "2026-03-01",
          questionsPerArm: setting.questionsPerArm,
          ensembleSize: setting.ensembleSize,
          bandCount: BAND_COUNT,
          seed: "proteus-v1",
        });

        for (const arm of report.arms) {
          const forecasts = binaryForecastsOf(report, arm.arm);
          const occupied =
            forecasts.length === 0
              ? []
              : calibrationReport(forecasts).bins.filter(
                  (bin) => bin.count > 0,
                );
          const minBin =
            occupied.length === 0
              ? 0
              : Math.min(...occupied.map((bin) => bin.count));
          const score = arm.score?.report;

          lines.push(
            [
              String(setting.questionsPerArm).padStart(5),
              String(setting.ensembleSize).padStart(5),
              "  " + arm.arm.padEnd(20),
              String(forecasts.length).padStart(4),
              String(report.simulationRuns).padStart(6),
              `${arm.abstained}/${arm.questions}`.padStart(8),
              String(arm.unresolved).padStart(6),
              score ? score.brier.toFixed(4).padStart(7) : "      —",
              score
                ? score.brierSkillVsBaseRate.toFixed(4).padStart(8)
                : "       —",
              score
                ? score.expectedCalibrationError.toFixed(4).padStart(7)
                : "      —",
              score
                ? score.maximumCalibrationError.toFixed(4).padStart(7)
                : "      —",
              String(occupied.length).padStart(5),
              String(minBin).padStart(7),
            ].join(" "),
          );
        }
        lines.push("");
      }

      lines.push(
        "MCE is the worst SINGLE bin, so read it against minBin: an MCE set by a bin holding",
        "one forecast is a sample-size artefact, not a calibration finding. ECE weights bins by",
        "occupancy and is the stabler figure at every size.",
        "",
        "CAVEAT: synthetic oracle throughout. Ensemble and ground truth come from the same",
        "simulator; historical-backtest and live post-cutoff accuracy remain NOT YET MEASURED.",
      );

      process.stdout.write("\n" + lines.join("\n") + "\n");
      expect(lines.length).toBeGreaterThan(SETTINGS.length);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 3_600_000);
});
