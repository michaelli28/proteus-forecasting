/**
 * The abstention-threshold sweep.
 *
 * The property that matters here is FAITHFULNESS: the sweep re-decides the gate
 * offline, from signals a completed run already recorded, and it is only worth
 * anything if that offline decision is the same one an end-to-end run at that
 * threshold would have made. Two tests check exactly that — one against the
 * benchmark's own default-threshold numbers, one against a second benchmark run
 * with the threshold actually injected.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import { DEFAULT_ABSTENTION_THRESHOLDS } from "../../src/evidence/abstention.js";
import { runBenchmark } from "../../src/pipeline/benchmark.js";
import {
  ARM_ANSWERABILITY,
  counterfactualProbabilities,
  formatSweep,
  sweepAbstentionThresholds,
  varyThreshold,
} from "../../src/pipeline/threshold-sweep.js";
import {
  CORPUS_AS_OF,
  TOY_QUANTITY,
  testCorpus,
  toyBinding,
} from "./harness.js";
import type { BenchmarkReport } from "../../src/pipeline/benchmark.js";

let root: string;
let store: ArtifactStore;

const OPTIONS = {
  binding: toyBinding,
  quantity: TOY_QUANTITY,
  asOf: CORPUS_AS_OF,
  questionsPerArm: 3,
  ensembleSize: 8,
  bandCount: 3,
  seed: "toy-sweep",
};

async function benchmark(
  overrides: Partial<Parameters<typeof runBenchmark>[0]> = {},
): Promise<BenchmarkReport> {
  return runBenchmark({
    ...OPTIONS,
    store,
    corpus: testCorpus(),
    ...overrides,
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-sweep-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("varyThreshold", () => {
  it("changes one field and leaves the rest at the base", () => {
    const candidates = varyThreshold("minSeparation", [0, 0.5, 1]);

    expect(candidates).toHaveLength(3);
    for (const candidate of candidates) {
      expect({
        ...candidate.thresholds,
        minSeparation: DEFAULT_ABSTENTION_THRESHOLDS.minSeparation,
      }).toEqual(DEFAULT_ABSTENTION_THRESHOLDS);
    }
    expect(candidates.map((c) => c.thresholds.minSeparation)).toEqual([
      0, 0.5, 1,
    ]);
  });

  it("labels each candidate with the field it varied", () => {
    const [first] = varyThreshold("minDiagnosticEvidence", [7]);
    expect(first!.label).toContain("minDiagnosticEvidence");
    expect(first!.label).toContain("7");
  });
});

describe("counterfactualProbabilities", () => {
  it("reproduces the probabilities a proceeding question actually reported", async () => {
    const report = await benchmark();
    const proceeded = report.results.filter((r) => !r.abstained);

    expect(proceeded.length).toBeGreaterThan(0);
    for (const result of proceeded) {
      expect(counterfactualProbabilities(result)).toEqual(result.probabilities);
    }
  });

  it("still produces a forecast for a question the gate stopped", async () => {
    const report = await benchmark();
    const abstained = report.results.filter((r) => r.abstained);

    expect(abstained.length).toBeGreaterThan(0);
    for (const result of abstained) {
      expect(result.probabilities).toBeNull();
      const counterfactual = counterfactualProbabilities(result)!;
      expect(counterfactual).toHaveLength(result.bandCount);
      expect(counterfactual.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 10);
    }
  });
});

describe("sweepAbstentionThresholds", () => {
  it("reproduces the benchmark's own abstention counts at the default threshold", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [
        DEFAULT_ABSTENTION_THRESHOLDS.minSeparation,
      ]),
    );

    const point = sweep.points[0]!;
    for (const arm of report.arms) {
      const swept = point.arms.find((a) => a.arm === arm.arm)!;
      expect(swept.abstained).toBe(arm.abstained);
      expect(swept.questions).toBe(arm.questions);
    }
  });

  it("abstains on everything once separation is required to be perfect", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [1.01]),
    );

    for (const arm of sweep.points[0]!.arms) {
      expect(arm.abstained).toBe(arm.questions);
      expect(arm.retained).toBeNull();
    }
    expect(sweep.points[0]!.falseAbstentionRate).toBe(1);
    expect(sweep.points[0]!.trueAbstentionRate).toBe(1);
  });

  it("never abstains less as the separation requirement rises", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0, 0.2, 0.4, 0.6, 0.8, 1.01]),
    );

    const totals = sweep.points.map((point) =>
      point.arms.reduce((sum, arm) => sum + arm.abstained, 0),
    );
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]!).toBeGreaterThanOrEqual(totals[i - 1]!);
    }
  });

  it("attributes every abstention to at least one named gate condition", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0, 0.5, 1.01]),
    );

    for (const point of sweep.points) {
      for (const arm of point.arms) {
        const reasons = Object.values(arm.reasonCounts).reduce(
          (sum, n) => sum + n,
          0,
        );
        expect(reasons).toBeGreaterThanOrEqual(arm.abstained);
        if (arm.abstained === 0) expect(reasons).toBe(0);
      }
    }
  });

  it("accounts for every question as retained, forfeited or unresolved", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0, 0.5, 1.01]),
    );

    for (const point of sweep.points) {
      for (const arm of point.arms) {
        const retained = arm.retained?.questions ?? 0;
        const forfeited = arm.forfeited?.questions ?? 0;
        expect(retained + forfeited + arm.unresolved).toBe(arm.questions);
      }
    }
  });

  it("scores what a threshold gave up, not only what it kept", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [1.01]),
    );

    // Everything abstains at this threshold, so every scorable question is a
    // forfeit — the number an operator needs to see before adopting it.
    const forfeited = sweep.points[0]!.arms.filter((a) => a.forfeited !== null);
    expect(forfeited.length).toBeGreaterThan(0);
    for (const arm of forfeited) {
      expect(arm.forfeited!.binaryPoints).toBeGreaterThan(0);
      expect(Number.isFinite(arm.forfeited!.brier)).toBe(true);
    }
  });

  it("separates the arms the gate is supposed to answer from the one it is not", () => {
    expect(ARM_ANSWERABILITY.narrow).toBe("answerable");
    expect(ARM_ANSWERABILITY.medium).toBe("answerable");
    expect(ARM_ANSWERABILITY["wide-control"]).toBe("answerable");
    // The separation condition's own control: an abstention here is the only
    // one in the benchmark that condition can take credit for.
    expect(ARM_ANSWERABILITY.tied).toBe("answerable");
    expect(ARM_ANSWERABILITY.indistinguishable).toBe("unanswerable");
    // Abstaining on `misspecified` is neither a false nor a true abstention:
    // the gate cannot see that the truth was drawn from somewhere else.
    expect(ARM_ANSWERABILITY.misspecified).toBe("excluded");
  });

  it("keeps the excluded arm out of both abstention rates", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0]),
    );
    const point = sweep.points[0]!;
    const excluded = point.arms.find((a) => a.arm === "misspecified")!;

    expect(excluded.answerability).toBe("excluded");
    expect(point.falseAbstentionRate).toBe(
      point.arms
        .filter((a) => a.answerability === "answerable")
        .reduce((sum, a) => sum + a.abstained, 0) /
        point.arms
          .filter((a) => a.answerability === "answerable")
          .reduce((sum, a) => sum + a.questions, 0),
    );
  });

  it("records the signal values the gate actually saw", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0.15]),
    );

    expect(sweep.signals.map((s) => s.arm)).toEqual(
      report.arms.map((a) => a.arm),
    );
    for (const profile of sweep.signals) {
      expect(profile.separation.values).toHaveLength(profile.questions);
      expect(profile.separation.min).toBeLessThanOrEqual(
        profile.separation.max,
      );
    }
  });
});

describe("an operating point the pipeline could not actually run", () => {
  /**
   * Bands tile the QUESTION's range while the simulation is free to leave it,
   * so a narrow range costs ensemble members — and sometimes all of them. Such
   * a question records separation 0 and diagnostic evidence 0, which a
   * candidate permissive on both conditions waves through; the real pipeline
   * then throws instead of forecasting. That must not read as "let through".
   */
  const NARROW_QUANTITY = { ...TOY_QUANTITY, max: 0.4 };
  const PERMISSIVE = {
    minDiagnosticEvidence: 0,
    minSeparation: 0,
    maxUnresolvedRate: 1,
    minProvenanceCompleteness: 0,
  };

  it("holds questions with no ensemble out of both abstention rates", async () => {
    const report = await benchmark({ quantity: NARROW_QUANTITY });
    expect(report.results.some((r) => r.ensemble.summaries.length === 0)).toBe(
      true,
    );

    const point = sweepAbstentionThresholds(report, [
      { label: "permissive", thresholds: PERMISSIVE },
    ]).points[0]!;

    const undecidable = point.arms.reduce((sum, a) => sum + a.undecidable, 0);
    expect(undecidable).toBeGreaterThan(0);

    for (const arm of point.arms) {
      const decidable = arm.questions - arm.undecidable;
      expect(arm.abstained).toBeLessThanOrEqual(decidable);
    }
  });

  it("says so in the report rather than printing a clean rate", async () => {
    const report = await benchmark({ quantity: NARROW_QUANTITY });
    const text = formatSweep(
      sweepAbstentionThresholds(report, [
        { label: "permissive", thresholds: PERMISSIVE },
      ]),
    );
    expect(text).toContain("INVALID OPERATING POINT");
  });
});

describe("the sweep matches an end-to-end run at the same threshold", () => {
  it("predicts what injecting the threshold actually does", async () => {
    const baseline = await benchmark();
    const candidate = {
      ...DEFAULT_ABSTENTION_THRESHOLDS,
      minSeparation: 0.5,
    };

    const predicted = sweepAbstentionThresholds(baseline, [
      { label: "candidate", thresholds: candidate },
    ]).points[0]!;

    const actual = await benchmark({ abstentionThresholds: candidate });

    for (const arm of actual.arms) {
      expect(predicted.arms.find((a) => a.arm === arm.arm)!.abstained).toBe(
        arm.abstained,
      );
    }
  });
});

describe("formatSweep", () => {
  it("carries the regime caveat and names every arm", async () => {
    const report = await benchmark();
    const text = formatSweep(
      sweepAbstentionThresholds(
        report,
        varyThreshold("minSeparation", [0, 0.15, 0.5]),
      ),
    );

    expect(text).toMatch(/synthetic oracle/i);
    expect(text).toMatch(/NOT YET MEASURED/);
    for (const arm of report.arms) expect(text).toContain(arm.arm);
  });
});
