/**
 * The dashboard's data contract.
 *
 * The properties worth testing are the honesty ones: an arm that answered
 * nothing must not serialize as a perfect score, MCE must not travel without
 * the bin occupancy that explains it, and a run with no model must not report
 * a cost per insight of zero.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import { runBenchmark } from "../../src/pipeline/benchmark.js";
import { benchmarkSnapshot } from "../../src/pipeline/snapshot.js";
import {
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

const STAMP = { label: "toy", generatedAt: "2026-08-09T00:00:00Z" };

async function benchmark(): Promise<BenchmarkReport> {
  return runBenchmark({
    binding: toyBinding,
    store,
    corpus: testCorpus(),
    quantity: TOY_QUANTITY,
    asOf: CORPUS_AS_OF,
    questionsPerArm: 3,
    ensembleSize: 8,
    bandCount: 3,
    seed: "toy-snapshot",
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-snapshot-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("benchmarkSnapshot", () => {
  it("carries every arm with its answerability", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    expect(snapshot.arms.map((a) => a.arm)).toContain("tied");
    expect(
      snapshot.arms.find((a) => a.arm === "indistinguishable")!.answerability,
    ).toBe("unanswerable");
    expect(
      snapshot.arms.find((a) => a.arm === "misspecified")!.answerability,
    ).toBe("excluded");
  });

  it("carries each scored arm's question-level intervals, and none for ECE", async () => {
    const report = await benchmark();
    const snapshot = benchmarkSnapshot(report, STAMP);
    for (const arm of snapshot.arms) {
      const source = report.arms.find((a) => a.arm === arm.arm)!;
      expect(arm.intervals).toEqual(source.intervals);
      if (arm.intervals) {
        expect(Object.keys(arm.intervals)).not.toContain(
          "expectedCalibrationError",
        );
      }
    }
    expect(snapshot.arms.some((a) => a.intervals !== null)).toBe(true);
  });

  it("reports an arm that answered nothing as null, not as a perfect score", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    for (const arm of snapshot.arms) {
      if (arm.abstained === arm.questions) {
        expect(arm.score).toBeNull();
        expect(arm.calibration).toHaveLength(0);
      }
    }
  });

  it("never lets MCE travel without the bin that produced it", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    for (const arm of snapshot.arms) {
      if (!arm.score) continue;
      expect(arm.score.occupiedBins).toBeGreaterThan(0);
      expect(arm.score.emptiestOccupiedBin).toBeGreaterThan(0);
      expect(arm.calibration).toHaveLength(arm.score.occupiedBins);
    }
  });

  it("keeps calibration points inside the unit square", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    for (const arm of snapshot.arms) {
      for (const point of arm.calibration) {
        expect(point.forecast).toBeGreaterThanOrEqual(0);
        expect(point.forecast).toBeLessThanOrEqual(1);
        expect(point.observed).toBeGreaterThanOrEqual(0);
        expect(point.observed).toBeLessThanOrEqual(1);
        expect(point.count).toBeGreaterThan(0);
      }
    }
  });

  it("declines to price insights when no model ran", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    expect(snapshot.cost.modelInLoop).toBe(false);
    expect(snapshot.cost.llmCalls).toBe(0);
    // Zero would read as "insights are free" rather than "nothing was priced".
    expect(snapshot.cost.costPerAnswerUsd).toBeNull();
    expect(snapshot.cost.questionsAnswered).toBeGreaterThan(0);
  });

  it("carries the regime caveat verbatim", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);

    expect(snapshot.regime).toBe("synthetic_oracle");
    expect(snapshot.caveat).toMatch(/NOT YET MEASURED/);
    expect(snapshot.caveat).toMatch(/same simulator/);
  });

  it("carries the operating curve when a separation sweep is supplied", async () => {
    const report = await benchmark();
    const sweep = sweepAbstentionThresholds(
      report,
      varyThreshold("minSeparation", [0, 0.25, 0.5]),
    );
    const snapshot = benchmarkSnapshot(report, {
      ...STAMP,
      separationSweep: sweep,
    });

    expect(snapshot.operatingCurve.map((p) => p.minSeparation)).toEqual([
      0, 0.25, 0.5,
    ]);
    for (const point of snapshot.operatingCurve) {
      expect(point.falseAbstentionRate).toBeGreaterThanOrEqual(0);
      expect(point.trueAbstentionRate).toBeLessThanOrEqual(1);
    }
  });

  it("is empty rather than invented when no sweep is supplied", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);
    expect(snapshot.operatingCurve).toEqual([]);
  });

  it("survives a JSON round trip unchanged", async () => {
    const snapshot = benchmarkSnapshot(await benchmark(), STAMP);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
