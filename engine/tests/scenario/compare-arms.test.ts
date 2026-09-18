/**
 * Did the mitigation work?
 *
 * The comparison exists because one run cannot answer that, so the thing most
 * worth testing is that the comparison does not quietly reintroduce the error it
 * was built to avoid: a tie counted as a win, or a mean standing in for a spread.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  COMPARISON_SEEDS,
  compareArms,
  harmFor,
  worstActorFor,
} from "../../src/scenario/compare-arms.js";
import type { ArmComparison } from "../../src/scenario/compare-arms.js";
import { getPack } from "../../src/scenario/packs/index.js";

const SEEDS = ["proteus", "atlas", "meridian"];

describe("harmFor", () => {
  it("reads total harm off the stream a reader is shown", async () => {
    const harm = await harmFor(
      "regional-grid",
      "criminal-syndicate",
      null,
      "proteus",
    );
    expect(harm).toBeGreaterThan(0);
  });

  it("is reproducible from its seed", async () => {
    const once = await harmFor("port-throughput", "russia", null, "atlas");
    const twice = await harmFor("port-throughput", "russia", null, "atlas");
    expect(twice).toBe(once);
  });
});

describe("worstActorFor", () => {
  it("picks by measurement, not by name", async () => {
    // china never acts on the grid and the syndicate does; whichever way the
    // numbers move later, the chooser must never return the idle one.
    const worst = await worstActorFor(
      "regional-grid",
      ["china", "criminal-syndicate"],
      SEEDS,
    );
    expect(worst).toBe("criminal-syndicate");
  });
});

describe("compareArms", () => {
  it("replays every mitigation the pack offers, lowest mean harm first", async () => {
    const comparison = await compareArms({
      pack: "port-throughput",
      actorId: "russia",
      actorLabel: "Russian Federation",
      seeds: SEEDS,
    });

    expect(comparison.defended).toHaveLength(
      getPack("port-throughput").defenses.length,
    );
    const means = comparison.defended.map((arm) => arm.mean);
    for (const m of means) expect(Number.isFinite(m)).toBe(true);
    expect([...means].sort((a, b) => a - b)).toEqual(means);

    for (const arm of [comparison.baseline, ...comparison.defended]) {
      expect(arm.harm).toHaveLength(SEEDS.length);
      expect(arm.best).toBeLessThanOrEqual(arm.worst);
      expect(arm.beatBaseline).toBeLessThanOrEqual(SEEDS.length);
    }
  }, 60_000);

  it("keeps the per-seed harm, not just a summary of it", async () => {
    // The spread IS the finding. A comparison that reported only medians would
    // reproduce exactly the mistake the mitigation preset exists to expose.
    const comparison = await compareArms({
      pack: "regional-grid",
      actorId: "criminal-syndicate",
      actorLabel: "Profit-motivated criminal syndicate",
      seeds: SEEDS,
    });
    expect(comparison.baseline.harm).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(new Set(comparison.baseline.harm).size).toBeGreaterThan(1);
  }, 60_000);

  it("does not count a tie as beating the baseline", async () => {
    // Comparing the undefended arm against itself: every seed ties, so a
    // correct counter reports zero wins rather than a clean sweep.
    const comparison = await compareArms({
      pack: "regional-grid",
      actorId: "china",
      actorLabel: "People's Republic of China",
      seeds: SEEDS,
    });
    // China never acts here, so every arm produces zero harm and ties.
    for (const arm of comparison.defended) {
      expect(arm.beatBaseline, arm.label).toBe(0);
      expect(arm.tiedBaseline, arm.label).toBe(SEEDS.length);
      expect(arm.lostToBaseline, arm.label).toBe(0);
    }
  }, 60_000);

  it("puts a paired interval on each defense's change against no defense", async () => {
    const comparison = await compareArms({
      pack: "port-throughput",
      actorId: "russia",
      actorLabel: "Russian Federation",
      seeds: SEEDS,
    });
    const base = comparison.baseline.harm;
    for (const arm of comparison.defended) {
      const change = arm.harm.reduce((s, h, i) => s + h - base[i]!, 0) / SEEDS.length;
      expect(arm.changeVsBaseline!.estimate).toBeCloseTo(change, 6);
      expect(arm.changeVsBaseline!.lower).toBeLessThanOrEqual(change);
      expect(arm.changeVsBaseline!.upper).toBeGreaterThanOrEqual(change);
      expect(arm.beatBaseline + arm.tiedBaseline + arm.lostToBaseline).toBe(SEEDS.length);
    }
    expect(comparison.baseline.changeVsBaseline).toBeNull();
  }, 60_000);

  it("says how far each defense is from the next one down, on the same seeds", async () => {
    const comparison = await compareArms({
      pack: "port-throughput",
      actorId: "russia",
      actorLabel: "Russian Federation",
      seeds: SEEDS,
    });
    const ranked = comparison.defended;
    ranked.forEach((arm, i) => {
      const next = ranked[i + 1];
      if (!next) return expect(arm.vsNext).toBeNull();
      const gap = arm.harm.reduce((s, h, k) => s + h - next.harm[k]!, 0) / SEEDS.length;
      expect(arm.vsNext!.estimate).toBeCloseTo(gap, 6);
    });
  }, 60_000);
});

describe("the shipped comparison", () => {
  // What the page renders is the committed JSON, so that is what is checked.
  // Rebuilding it here would replay ~8,000 runs inside the unit suite.
  const shipped = JSON.parse(
    readFileSync(
      new URL("../../../dashboard/data/arm-comparisons.json", import.meta.url),
      "utf8",
    ),
  ) as ArmComparison[];

  it("replays every arm on the shared seeds, ranked by mean", () => {
    expect(shipped).toHaveLength(3);
    for (const comparison of shipped) {
      expect(comparison.seeds).toEqual([...COMPARISON_SEEDS]);
      const means = comparison.defended.map((arm) => arm.mean);
      expect([...means].sort((a, b) => a - b)).toEqual(means);
      for (const arm of comparison.defended) {
        expect(arm.changeVsBaseline, arm.label).not.toBeNull();
        expect(
          arm.beatBaseline + arm.tiedBaseline + arm.lostToBaseline,
          arm.label,
        ).toBe(comparison.seeds.length);
      }
    }
  });

  it("finds mitigations that make some worlds worse", () => {
    // The claim the page makes. If no mitigation ever lost a seed, the page
    // would be overstating the uncertainty and should change.
    const hurtSomewhere = shipped.flatMap((comparison) =>
      comparison.defended.filter((arm) => arm.lostToBaseline > 0),
    );
    expect(hurtSomewhere.length).toBeGreaterThan(0);
  });
});
