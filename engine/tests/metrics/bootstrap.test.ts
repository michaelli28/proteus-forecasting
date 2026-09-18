import { describe, it, expect } from "vitest";
import { Rng } from "../../src/sim/rng.js";
import { stratifiedBootstrap } from "../../src/metrics/bootstrap.js";

const mean = (xs: readonly number[]) =>
  xs.reduce((s, x) => s + x, 0) / xs.length;

type Item = { stratum: string; value: number };
const stratumOf = (item: Item) => item.stratum;
const meanOf = (sample: readonly Item[]) => mean(sample.map((i) => i.value));

describe("stratifiedBootstrap", () => {
  it("has zero width when every item is the same", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      stratum: `s${i % 3}`,
      value: 0.4,
    }));
    const ci = stratifiedBootstrap(items, {
      stratumOf,
      statistic: meanOf,
      seed: "x",
    })!;
    expect(ci.lower).toBeCloseTo(0.4, 12);
    expect(ci.upper).toBeCloseTo(0.4, 12);
    expect(ci.estimate).toBeCloseTo(0.4, 12);
  });

  it("reproduces itself from the same seed and moves with a different one", () => {
    const rng = new Rng("items");
    const items = Array.from({ length: 30 }, (_, i) => ({
      stratum: `s${i % 3}`,
      value: rng.normal(),
    }));
    const a = stratifiedBootstrap(items, {
      stratumOf,
      statistic: meanOf,
      seed: "a",
    });
    expect(
      stratifiedBootstrap(items, { stratumOf, statistic: meanOf, seed: "a" }),
    ).toEqual(a);
    expect(
      stratifiedBootstrap(items, { stratumOf, statistic: meanOf, seed: "b" }),
    ).not.toEqual(a);
  });

  it("keeps each stratum's size in every resample", () => {
    const items = [
      ...Array.from({ length: 5 }, () => ({ stratum: "a", value: 1 })),
      ...Array.from({ length: 15 }, () => ({ stratum: "b", value: 0 })),
    ];
    // The share of stratum a is 5/20 in every stratified resample.
    const ci = stratifiedBootstrap(items, {
      stratumOf,
      statistic: meanOf,
      seed: "s",
    })!;
    expect(ci.lower).toBeCloseTo(0.25, 12);
    expect(ci.upper).toBeCloseTo(0.25, 12);
  });

  it("drops resamples the statistic cannot score, and reports how many it kept", () => {
    // One scorable item in eight: (7/8)^8 ≈ 34% of resamples miss it.
    const items = Array.from({ length: 8 }, (_, i) => ({
      stratum: "only",
      value: i < 1 ? 1 : 0,
    }));
    const ci = stratifiedBootstrap(items, {
      stratumOf,
      statistic: (sample) =>
        sample.some((i) => i.value === 1) ? meanOf(sample) : null,
      seed: "d",
      resamples: 500,
    })!;
    expect(ci.resamples).toBeLessThan(400);
    expect(ci.resamples).toBeGreaterThan(250);
  });

  it("returns null when no resample can be scored", () => {
    const items = [{ stratum: "a", value: 1 }];
    expect(
      stratifiedBootstrap(items, {
        stratumOf,
        statistic: () => null,
        seed: "n",
      }),
    ).toBeNull();
  });

  it("covers the true mean about 95% of the time", () => {
    const rng = new Rng("coverage");
    const reps = 300;
    let covered = 0;
    for (let rep = 0; rep < reps; rep++) {
      const items = Array.from({ length: 40 }, (_, i) => ({
        stratum: `s${i % 4}`,
        value: rng.normal(),
      }));
      const ci = stratifiedBootstrap(items, {
        stratumOf,
        statistic: meanOf,
        seed: `rep-${rep}`,
        resamples: 1000,
      })!;
      if (ci.lower <= 0 && 0 <= ci.upper) covered++;
    }
    // Percentile intervals on n = 40 run slightly narrow; 300 reps give sd ≈ 1.3 pp.
    expect(covered / reps).toBeGreaterThan(0.9);
    expect(covered / reps).toBeLessThan(0.99);
  });
});
