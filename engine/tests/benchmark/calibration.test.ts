/**
 * The synthetic-oracle calibration run, and the abstention gate's operating point.
 *
 * Gated like the live tests: it drives the real 400-agent ABM thousands of
 * times, which is too slow for the inner loop and too valuable to bury.
 *
 *   PROTEUS_BENCH=1 npx vitest run tests/benchmark
 *
 * One benchmark run feeds both reports on purpose. The threshold sweep re-decides
 * the gate offline on signals THIS run recorded, so publishing it beside a table
 * from a different run would invite comparing two batches as if they were one.
 *
 * Batch size comes from the scaling study (`PROTEUS_SCALE=1`, §8h): at 80
 * questions per arm and 32-run ensembles the three answerable arms first agree
 * on ECE with each other, having disagreed by 2-3x at every smaller size. MCE
 * does not settle at ANY size — it reads the emptiest occupied bin, and the
 * ensemble's probabilities cluster too tightly to fill the tail bins.
 */

import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { benchmarkSnapshot } from "../../src/pipeline/snapshot.js";
import type {
  BenchmarkSnapshot,
  SnapshotFile,
} from "../../src/pipeline/snapshot.js";
import { ArtifactStore } from "../../src/artifact/store.js";
import { AsOfCorpus } from "../../src/corpus/as-of.js";
import { generateSyntheticCorpus } from "../../src/corpus/synthetic.js";
import { DEFAULT_ABSTENTION_THRESHOLDS } from "../../src/evidence/abstention.js";
import {
  BENCHMARK_ARMS,
  formatBenchmark,
  runBenchmark,
} from "../../src/pipeline/benchmark.js";
import {
  formatSweep,
  sweepAbstentionThresholds,
  varyThreshold,
} from "../../src/pipeline/threshold-sweep.js";
import {
  influenceOpsBinding,
  influenceOpsQuantity,
} from "../../src/pipeline/influence-ops-binding.js";

const ENABLED = process.env.PROTEUS_BENCH === "1";

/**
 * Where the dashboard's data lands. Unset means don't publish.
 *
 * Snapshots accumulate by label, so running several batch sizes builds the
 * series a "skill over time" panel needs instead of leaving it to invent one.
 */
const SNAPSHOT_OUT = process.env.PROTEUS_SNAPSHOT_OUT;

async function publishSnapshot(snapshot: BenchmarkSnapshot): Promise<void> {
  if (!SNAPSHOT_OUT) return;
  const path = resolve(SNAPSHOT_OUT);
  await mkdir(dirname(path), { recursive: true });

  let existing: BenchmarkSnapshot[] = [];
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as SnapshotFile;
    existing = parsed.snapshots.filter((s) => s.label !== snapshot.label);
  } catch {
    // No prior file, or one this version cannot read. Either way, start fresh
    // rather than merging into a shape we did not write.
  }

  const file: SnapshotFile = { snapshots: [...existing, snapshot] };
  await writeFile(path, JSON.stringify(file, null, 2) + "\n");
  process.stdout.write(`\nsnapshot published: ${path}\n`);
}

/**
 * Pre-registered outcome range for adoptionRate at tick 119 on the reference
 * world, measured on a 5x5 parameter sweep BEFORE any of these questions were
 * scored: observed 0.3900 to 0.6125, widened by 0.04 either side so a realized
 * value rarely escapes the partition.
 */
const ADOPTION_RANGE = [0.35, 0.65] as const;
const RESOLVE_AT_TICK = 119;
const BAND_COUNT = 4;
const ENSEMBLE_SIZE = 32;
const QUESTIONS_PER_ARM = 80;

/** 0 to 1 in twentieths, plus one point above any attainable separation. */
const SEPARATION_GRID = [
  ...Array.from({ length: 21 }, (_, i) => Number((i * 0.05).toFixed(2))),
  1.01,
];

describe.skipIf(!ENABLED)("PROTEUS synthetic-oracle benchmark", () => {
  it("produces calibration numbers and the gate's operating curve", async () => {
    const root = await mkdtemp(join(tmpdir(), "proteus-bench-"));
    try {
      const { snapshot } = generateSyntheticCorpus({
        seed: "benchmark-corpus",
        documentCount: 60,
        sourceCount: 6,
        startDate: "2026-01-01",
        endDate: "2026-02-20",
        conflictsPerKind: 2,
      });

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
        questionsPerArm: QUESTIONS_PER_ARM,
        ensembleSize: ENSEMBLE_SIZE,
        bandCount: BAND_COUNT,
        seed: "proteus-v1",
      });

      process.stdout.write("\n" + formatBenchmark(report) + "\n");

      expect(report.results).toHaveLength(
        BENCHMARK_ARMS.length * QUESTIONS_PER_ARM,
      );

      const skill = (arm: string) =>
        report.arms.find((a) => a.arm === arm)!.score!.report
          .brierSkillVsBaseRate;

      // The substantive property: skill has to track how good the evidence
      // actually was. A pipeline that scores the same whether it was pointed at
      // the right region or the wrong one is not measuring anything.
      expect(skill("narrow")).toBeGreaterThan(skill("wide-control"));
      expect(skill("medium")).toBeGreaterThan(skill("wide-control"));
      expect(skill("wide-control")).toBeGreaterThan(skill("misspecified"));

      // Pointed at the wrong region, the system must do WORSE than simply
      // stating the base rate. Anything else means the ensemble is not
      // carrying the information it claims to.
      expect(skill("misspecified")).toBeLessThan(0);

      // What justifies calling `tied` answerable, and therefore what makes an
      // abstention there a FALSE abstention: a field whose leaders tie is still
      // forecastable, because this system reports a distribution rather than a
      // winner. If this ever goes negative the arm is mislabelled.
      expect(skill("tied")).toBeGreaterThan(0);

      // Ensemble members are only ever lost by a realized value escaping the
      // partition — never by the machinery breaking.
      for (const arm of report.arms) {
        expect(
          Object.keys(arm.failuresByPhase).every(
            (phase) => phase === "resolve",
          ),
        ).toBe(true);
      }

      // ─── §8g open finding #1: where should the gate sit? ───

      const separation = sweepAbstentionThresholds(
        report,
        varyThreshold("minSeparation", SEPARATION_GRID),
      );
      process.stdout.write(
        "\n=== minSeparation sweep ===\n" + formatSweep(separation) + "\n",
      );

      // The other knob on the same signals. If the unanswerable arm abstains
      // identically at every setting of this one, its abstention is not coming
      // from here; if it collapses, the separation threshold was never what was
      // doing the work.
      const diagnostic = sweepAbstentionThresholds(
        report,
        varyThreshold("minDiagnosticEvidence", [0, 1, 3, 8, 16, 32, 33]),
      );
      process.stdout.write(
        "\n=== minDiagnosticEvidence sweep ===\n" +
          formatSweep(diagnostic) +
          "\n",
      );

      // Publish for the dashboard. Opt-in, because a test that writes into the
      // repo on every run is a test that eventually writes something nobody
      // asked for.
      await publishSnapshot(
        benchmarkSnapshot(report, {
          label: `${QUESTIONS_PER_ARM}x${ENSEMBLE_SIZE}`,
          generatedAt: new Date().toISOString(),
          separationSweep: separation,
        }),
      );

      expect(separation.points).toHaveLength(SEPARATION_GRID.length);
      expect(separation.faithfulnessChecks).toBe(report.results.length);

      // Requiring more separation can only ever refuse more questions.
      const rates = separation.points.map((p) => p.falseAbstentionRate);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]!).toBeGreaterThanOrEqual(rates[i - 1]!);
      }

      // The sweep must reproduce the run it was computed from.
      const atDefault = separation.points.find(
        (p) =>
          p.thresholds.minSeparation ===
          DEFAULT_ABSTENTION_THRESHOLDS.minSeparation,
      )!;
      for (const arm of report.arms) {
        expect(atDefault.arms.find((a) => a.arm === arm.arm)!.abstained).toBe(
          arm.abstained,
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 3_600_000);
});
