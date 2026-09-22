import { describe, it, expect } from "vitest";
import { pairedChange, winTieLoss } from "../../src/metrics/paired.js";
import { stratifiedBootstrap } from "../../src/metrics/bootstrap.js";

/**
 * These pin the behaviour `compare-arms` had before the two helpers moved out
 * of it, so the move cannot quietly change a published comparison.
 */

const A = [10, 12, 9, 30, 11, 8, 14, 9];
const B = [11, 11, 12, 9, 11, 10, 20, 9];

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe("pairedChange", () => {
  it("is the seed bootstrap of the per-seed differences", () => {
    const reference = stratifiedBootstrap(
      A.map((value, i) => value - B[i]!),
      {
        stratumOf: () => "seeds",
        statistic: mean,
        seed: "pack/defense/baseline",
      },
    );
    expect(pairedChange(A, B, "pack/defense/baseline")).toEqual(reference);
  });

  it("is deterministic in its seed, and differs between seeds", () => {
    expect(pairedChange(A, B, "one")).toEqual(pairedChange(A, B, "one"));
    expect(pairedChange(A, B, "one")).not.toEqual(pairedChange(A, B, "two"));
  });

  it("brackets the mean difference it summarises", () => {
    const interval = pairedChange(A, B, "seed")!;
    const difference = mean(A.map((value, i) => value - B[i]!));
    expect(interval.estimate).toBeCloseTo(difference, 12);
    expect(interval.lower).toBeLessThanOrEqual(difference);
    expect(interval.upper).toBeGreaterThanOrEqual(difference);
  });
});

describe("winTieLoss", () => {
  it("splits the worlds three ways, and the three add up", () => {
    // A beats B in worlds 1, 3, 6 and 7; loses in 2 and 4; ties in 5 and 8.
    const split = winTieLoss(A, B);
    expect(split).toEqual({ better: 4, tied: 2, worse: 2 });
    expect(split.better + split.tied + split.worse).toBe(A.length);
  });

  it("counts a world where nothing changed as neither a win nor a loss", () => {
    expect(winTieLoss([5, 5], [5, 5])).toEqual({
      better: 0,
      tied: 2,
      worse: 0,
    });
  });

  it("treats lower harm as better", () => {
    expect(winTieLoss([1], [2])).toEqual({ better: 1, tied: 0, worse: 0 });
    expect(winTieLoss([3], [2])).toEqual({ better: 0, tied: 0, worse: 1 });
  });
});
