/**
 * Did the mitigation work?
 *
 * The comparison exists because one run cannot answer that, so the thing most
 * worth testing is that the comparison does not quietly reintroduce the error it
 * was built to avoid: a tie counted as a win, or a mean standing in for a spread.
 */

import { describe, expect, it } from "vitest";
import {
  compareArms,
  harmFor,
  worstActorFor,
} from "../../src/scenario/compare-arms.js";
import { buildComparisons } from "../../src/scenario/manifest.js";
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
  it("replays every mitigation the pack offers, best median first", async () => {
    const comparison = await compareArms({
      pack: "port-throughput",
      actorId: "russia",
      actorLabel: "Russian Federation",
      seeds: SEEDS,
    });

    expect(comparison.defended).toHaveLength(
      getPack("port-throughput").defenses.length,
    );
    const medians = comparison.defended.map((arm) => arm.median);
    expect([...medians].sort((a, b) => a - b)).toEqual(medians);

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
    }
  }, 60_000);
});

describe("the shipped comparison", () => {
  it("finds mitigations that do not beat the undefended arm on every seed", async () => {
    // This is the claim the page makes. If every mitigation ever became
    // reliable, the page would be overstating the uncertainty and should change.
    const comparisons = await buildComparisons();
    expect(comparisons).toHaveLength(3);

    const unreliable = comparisons.flatMap((comparison) =>
      comparison.defended.filter(
        (arm) => arm.beatBaseline < comparison.seeds.length,
      ),
    );
    expect(unreliable.length).toBeGreaterThan(0);

    for (const comparison of comparisons) {
      expect(comparison.defended.length).toBeGreaterThan(0);
      expect(comparison.seeds.length).toBeGreaterThanOrEqual(6);
      expect(comparison.harmUnit.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
