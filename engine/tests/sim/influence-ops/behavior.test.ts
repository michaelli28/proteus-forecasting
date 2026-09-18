import { describe, it, expect } from "vitest";
import { runSimulation } from "../../../src/sim/kernel.js";
import { Rng } from "../../../src/sim/rng.js";
import {
  influenceOpsAdapter,
  DEFAULT_CONFIG,
  REFERENCE_CAMPAIGN,
  BIMODALITY_THRESHOLD,
  measurePopulation,
  interventionEffect,
  deriveSignatures,
  detectCampaign,
  meanDegree,
  bridgeCount,
  buildPopulation,
  validateConfig,
  BELIEF_HISTOGRAM_BINS,
} from "../../../src/sim/adapters/influence-ops/index.js";
import type {
  InfluenceOpsConfig,
  DefenseKind,
} from "../../../src/sim/adapters/influence-ops/index.js";

const SEEDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

const control: InfluenceOpsConfig = {
  ...DEFAULT_CONFIG,
  campaign: null,
  defense: null,
};
const attacked: InfluenceOpsConfig = {
  ...control,
  campaign: REFERENCE_CAMPAIGN,
};

function defended(kind: DefenseKind, coverage: number): InfluenceOpsConfig {
  return {
    ...attacked,
    defense: { kind, startTick: 30, intensity: 0.6, costPerTick: 1, coverage },
  };
}

async function summarize(config: InfluenceOpsConfig, seed: string) {
  const result = await runSimulation(influenceOpsAdapter, config, seed);
  return {
    measures: measurePopulation(
      result.finalState.population.agents,
      config.campaign?.narrativeId ?? 0,
    ),
    signatures: deriveSignatures(result.finalState.observables),
    cost: result.finalState.totalDefenseCost,
    events: result.events,
  };
}

async function meanAcrossSeeds(
  config: InfluenceOpsConfig,
  pick: (s: Awaited<ReturnType<typeof summarize>>) => number,
) {
  const values = await Promise.all(
    SEEDS.map(async (seed) => pick(await summarize(config, seed))),
  );
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

describe("population and network", () => {
  it("builds the requested population with clustered structure", () => {
    const population = buildPopulation(control, new Rng("net"));
    expect(population.agents).toHaveLength(control.population.agents);
    expect(new Set(population.agents.map((a) => a.cluster)).size).toBe(
      control.population.clusters,
    );
  });

  it("produces a connected-enough graph with cross-cluster bridges", () => {
    const population = buildPopulation(control, new Rng("net"));
    expect(meanDegree(population)).toBeGreaterThan(4);
    expect(bridgeCount(population)).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    const a = buildPopulation(control, new Rng("net"));
    const b = buildPopulation(control, new Rng("net"));
    expect(b.agents.map((x) => x.belief)).toEqual(
      a.agents.map((x) => x.belief),
    );
    expect(b.neighbors).toEqual(a.neighbors);
  });

  it("normalizes each agent's media trust to 1", () => {
    for (const agent of buildPopulation(control, new Rng("net")).agents) {
      expect(agent.mediaTrust.reduce((s, t) => s + t, 0)).toBeCloseTo(1, 6);
    }
  });
});

describe("determinism end to end", () => {
  it("produces identical events for the same seed", async () => {
    const a = await summarize(attacked, "same");
    const b = await summarize(attacked, "same");
    expect(b.events).toEqual(a.events);
  });

  it("produces different events for different seeds", async () => {
    const a = await summarize(attacked, "one");
    const b = await summarize(attacked, "two");
    expect(b.events).not.toEqual(a.events);
  });

  it("keeps ground truth and telemetry in separate event kinds", async () => {
    // A consumer restricted to telemetry must not be able to read the answer.
    const { events } = await summarize(attacked, "a");
    const telemetry = events.filter((e) => e.kind === "telemetry");
    expect(telemetry.length).toBeGreaterThan(0);
    for (const event of telemetry) {
      expect(event.data).not.toHaveProperty("meanBelief");
      expect(event.data).not.toHaveProperty("adoptionRate");
      expect(event.data).not.toHaveProperty("injections");
    }
    expect(events.filter((e) => e.kind === "truth")[0]!.data).toHaveProperty(
      "meanBelief",
    );
  });
});

describe("polarization emerges rather than being assumed", () => {
  it("keeps the population split at the end of a control run", async () => {
    // Bounded confidence must sustain echo chambers. An earlier build let media
    // homogenise everyone within ~7 ticks; this is the regression guard.
    const bimodality = await meanAcrossSeeds(
      control,
      (s) => s.measures.bimodality,
    );
    const separation = await meanAcrossSeeds(
      control,
      (s) => s.measures.clusterSeparation,
    );
    expect(bimodality).toBeGreaterThan(BIMODALITY_THRESHOLD);
    expect(separation).toBeGreaterThan(0.5);
  });

  it("does not collapse belief variance to zero", async () => {
    expect(
      await meanAcrossSeeds(control, (s) => s.measures.variance),
    ).toBeGreaterThan(0.05);
  });
});

describe("the campaign moves belief", () => {
  it("raises mean belief on the targeted narrative", async () => {
    const controlMean = await meanAcrossSeeds(
      control,
      (s) => s.measures.meanBelief,
    );
    const attackedMean = await meanAcrossSeeds(
      attacked,
      (s) => s.measures.meanBelief,
    );
    expect(attackedMean).toBeGreaterThan(controlMean + 0.02);
  });

  it("raises adoption", async () => {
    const controlAdopt = await meanAcrossSeeds(
      control,
      (s) => s.measures.adoptionRate,
    );
    const attackedAdopt = await meanAcrossSeeds(
      attacked,
      (s) => s.measures.adoptionRate,
    );
    expect(attackedAdopt).toBeGreaterThan(controlAdopt + 0.03);
  });

  it("stops well short of saturation, leaving something to forecast", async () => {
    // A campaign that captures everyone makes every forecast trivially right.
    const attackedAdopt = await meanAcrossSeeds(
      attacked,
      (s) => s.measures.adoptionRate,
    );
    expect(attackedAdopt).toBeLessThan(0.8);
  });

  it("increases effect with reach", async () => {
    const wide = {
      ...attacked,
      campaign: { ...REFERENCE_CAMPAIGN, injectionNodes: 120 },
    };
    const narrow = {
      ...attacked,
      campaign: { ...REFERENCE_CAMPAIGN, injectionNodes: 40 },
    };
    expect(
      await meanAcrossSeeds(wide, (s) => s.measures.meanBelief),
    ).toBeGreaterThan(
      await meanAcrossSeeds(narrow, (s) => s.measures.meanBelief),
    );
  });

  it("cannot buy its way past a neighbour's confidence bound with amplification alone", async () => {
    // Measured finding: reach dominates boost. Amplification helps, but bounded
    // confidence caps it — content too far from you is ignored however loud.
    const loud = {
      ...attacked,
      campaign: { ...REFERENCE_CAMPAIGN, amplification: 20 },
    };
    const quiet = {
      ...attacked,
      campaign: { ...REFERENCE_CAMPAIGN, amplification: 1 },
    };
    const loudMean = await meanAcrossSeeds(loud, (s) => s.measures.meanBelief);
    const quietMean = await meanAcrossSeeds(
      quiet,
      (s) => s.measures.meanBelief,
    );
    const reachMean = await meanAcrossSeeds(
      { ...attacked, campaign: { ...REFERENCE_CAMPAIGN, injectionNodes: 160 } },
      (s) => s.measures.meanBelief,
    );
    expect(loudMean - quietMean).toBeLessThan(reachMean - quietMean);
  });
});

describe("the defensive half", () => {
  it("counter-messaging reduces campaign drift", async () => {
    const attackedMean = await meanAcrossSeeds(
      attacked,
      (s) => s.measures.meanBelief,
    );
    const defendedMean = await meanAcrossSeeds(
      defended("counter_messaging", 0.6),
      (s) => s.measures.meanBelief,
    );
    expect(defendedMean).toBeLessThan(attackedMean);
  });

  it("counter-messaging at high coverage overshoots the counterfactual", async () => {
    const controlMean = await meanAcrossSeeds(
      control,
      (s) => s.measures.meanBelief,
    );
    const attackedMean = await meanAcrossSeeds(
      attacked,
      (s) => s.measures.meanBelief,
    );
    const config = defended("counter_messaging", 0.6);
    const defendedMean = await meanAcrossSeeds(
      config,
      (s) => s.measures.meanBelief,
    );
    const cost = (await summarize(config, "a")).cost;

    const effect = interventionEffect(
      controlMean,
      attackedMean,
      defendedMean,
      cost,
    );
    expect(effect.overshoot).toBeGreaterThan(0);
    expect(effect.restoredFraction).toBeGreaterThan(1);
  });

  it("platform intervention scales with coverage", async () => {
    const low = await meanAcrossSeeds(
      defended("platform_intervention", 0.3),
      (s) => s.measures.meanBelief,
    );
    const high = await meanAcrossSeeds(
      defended("platform_intervention", 0.9),
      (s) => s.measures.meanBelief,
    );
    expect(high).toBeLessThan(low);
  });

  it("charges for every tick a defence is active", async () => {
    const { cost } = await summarize(defended("friction", 0.5), "a");
    expect(cost).toBe(DEFAULT_CONFIG.ticks - 30);
  });

  it("costs nothing when no defence runs", async () => {
    expect((await summarize(attacked, "a")).cost).toBe(0);
  });
});

describe("detection from telemetry alone", () => {
  it("scores attacked worlds higher than control worlds on average", async () => {
    const controlScore = await meanAcrossSeeds(
      control,
      (s) => s.signatures.compositeScore,
    );
    const attackedScore = await meanAcrossSeeds(
      attacked,
      (s) => s.signatures.compositeScore,
    );
    expect(attackedScore).toBeGreaterThan(controlScore + 0.05);
  });

  it("does not separate perfectly, so a precision/recall sweep would be a real measurement", async () => {
    // Perfect separation would mean the detector is reading something it should
    // not see. Overlap is the honest result, and what a sweep would measure.
    const controlScores = await Promise.all(
      SEEDS.map(
        async (s) => (await summarize(control, s)).signatures.compositeScore,
      ),
    );
    const attackedScores = await Promise.all(
      SEEDS.map(
        async (s) => (await summarize(attacked, s)).signatures.compositeScore,
      ),
    );
    expect(Math.max(...controlScores)).toBeGreaterThan(
      Math.min(...attackedScores),
    );
  });

  it("thresholds monotonically", async () => {
    const { signatures } = await summarize(attacked, "a");
    expect(detectCampaign(signatures, 0).detected).toBe(true);
    expect(detectCampaign(signatures, 1.01).detected).toBe(false);
  });

  it("keeps the composite score inside [0,1]", async () => {
    for (const seed of SEEDS) {
      const { signatures } = await summarize(attacked, seed);
      expect(signatures.compositeScore).toBeGreaterThanOrEqual(0);
      expect(signatures.compositeScore).toBeLessThanOrEqual(1);
    }
  });
});

describe("config validation", () => {
  it("rejects a campaign narrative outside the narrative range", () => {
    expect(() =>
      validateConfig({
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, narrativeId: 99 },
      }),
    ).toThrow(RangeError);
  });

  it("rejects a target position outside [0,1]", () => {
    expect(() =>
      validateConfig({
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, targetPosition: 1.5 },
      }),
    ).toThrow(RangeError);
  });

  it("rejects more injection nodes than agents", () => {
    expect(() =>
      validateConfig({
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, injectionNodes: 99999 },
      }),
    ).toThrow(RangeError);
  });

  it("rejects an inverted campaign window", () => {
    expect(() =>
      validateConfig({
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, startTick: 90, endTick: 10 },
      }),
    ).toThrow(RangeError);
  });

  it("accepts the reference configurations", () => {
    expect(() => validateConfig(control)).not.toThrow();
    expect(() => validateConfig(attacked)).not.toThrow();
  });
});

describe("the truth stream carries the population's shape", () => {
  const attacked: InfluenceOpsConfig = {
    ...DEFAULT_CONFIG,
    ticks: 60,
    campaign: { ...REFERENCE_CAMPAIGN, startTick: 10, endTick: 55 },
  };

  it("emits a belief histogram whose counts total the population", async () => {
    const result = await runSimulation(influenceOpsAdapter, attacked, "hist");
    const truth = result.events.filter((e) => e.kind === "truth");

    for (const event of truth) {
      const bins = event.data.beliefHistogram as number[];
      expect(bins).toHaveLength(BELIEF_HISTOGRAM_BINS);
      expect(bins.reduce((a, b) => a + b, 0)).toBe(
        DEFAULT_CONFIG.population.agents,
      );
    }
  });

  it("shows mass moving toward the campaign's target position", async () => {
    const result = await runSimulation(influenceOpsAdapter, attacked, "hist");
    const truth = result.events.filter((e) => e.kind === "truth");
    const upper = (e: (typeof truth)[number]) =>
      (e.data.beliefHistogram as number[]).slice(12).reduce((a, b) => a + b, 0);

    // The campaign pushes toward 0.85; the top of the distribution must fill.
    expect(upper(truth.at(-1)!)).toBeGreaterThan(upper(truth[0]!));
  });

  it("reports adoptions and abandonments per tick, not just the running rate", async () => {
    const result = await runSimulation(influenceOpsAdapter, attacked, "hist");
    const truth = result.events.filter((e) => e.kind === "truth");

    for (const event of truth) {
      expect(typeof event.data.adoptions).toBe("number");
      expect(typeof event.data.abandonments).toBe("number");
    }
    // A campaign that converts nobody would make the cascade view meaningless.
    const converted = truth.reduce(
      (sum, e) => sum + (e.data.adoptions as number),
      0,
    );
    expect(converted).toBeGreaterThan(0);
  });

  it("NEVER leaks belief data into the telemetry stream", async () => {
    // The detector reads telemetry alone. A belief histogram there would hand it
    // the answer and turn detection precision into a tautology.
    const result = await runSimulation(influenceOpsAdapter, attacked, "hist");
    const telemetry = result.events.filter((e) => e.kind === "telemetry");
    expect(telemetry.length).toBeGreaterThan(0);

    const forbidden = [
      "beliefHistogram",
      "adoptions",
      "abandonments",
      "injections",
      "meanBelief",
      "adoptionRate",
      "variance",
      "bimodality",
      "clusterSeparation",
    ];
    for (const event of telemetry) {
      for (const key of forbidden) {
        expect(event.data).not.toHaveProperty(key);
      }
    }
  });
});
