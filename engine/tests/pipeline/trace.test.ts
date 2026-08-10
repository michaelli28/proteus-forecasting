/**
 * The trace seam, driven end to end through a real simulation.
 *
 * Deliberately not hand-built fixtures for the main cases: the value of this
 * module is that it agrees with what the adapter actually writes, and a fixture
 * that drifts from the emitter tests nothing.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runSimulation } from "../../src/sim/kernel.js";
import {
  influenceOpsAdapter,
  DEFAULT_CONFIG,
  REFERENCE_CAMPAIGN,
} from "../../src/sim/adapters/influence-ops/index.js";
import type { InfluenceOpsConfig } from "../../src/sim/adapters/influence-ops/index.js";
import { buildRunTrace, TraceError } from "../../src/pipeline/trace.js";
import type { RunTrace } from "../../src/pipeline/trace.js";

const config: InfluenceOpsConfig = {
  ...DEFAULT_CONFIG,
  ticks: 40,
  population: { ...DEFAULT_CONFIG.population, agents: 120, clusters: 3 },
  campaign: { ...REFERENCE_CAMPAIGN, startTick: 8, endTick: 34 },
};

const identity = {
  config,
  corpusSnapshotId: "corpus-abc",
  kernelVersion: "influence-ops@1",
};

let trace: RunTrace;

beforeAll(async () => {
  const result = await runSimulation(influenceOpsAdapter, config, "trace-test");
  trace = buildRunTrace("run-1", identity, result.events);
});

describe("buildRunTrace", () => {
  it("carries one entry per tick, in tick order", () => {
    expect(trace.ticks).toHaveLength(config.ticks);
    const ticks = trace.ticks.map((t) => t.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks[0]).toBe(0);
  });

  it("reads the world's shape off the identity rather than guessing it", () => {
    expect(trace.world.agents).toBe(120);
    expect(trace.world.clusters).toBe(3);
    expect(trace.world.ticks).toBe(40);
    expect(trace.kernelVersion).toBe("influence-ops@1");
    expect(trace.corpusSnapshotId).toBe("corpus-abc");
  });

  it("carries the campaign window so the UI can shade it", () => {
    expect(trace.campaign).not.toBeNull();
    expect(trace.campaign!.startTick).toBe(8);
    expect(trace.campaign!.endTick).toBe(34);
    expect(trace.campaign!.targetPosition).toBe(
      REFERENCE_CAMPAIGN.targetPosition,
    );
  });

  it("reports no campaign on a control run instead of a zeroed one", () => {
    const control = buildRunTrace(
      "run-2",
      { ...identity, config: { ...config, campaign: null } },
      [{ tick: 0, kind: "truth", data: { meanBelief: 0.5 } }],
    );
    expect(control.campaign).toBeNull();
  });

  it("gives every tick a histogram summing to the population", () => {
    for (const tick of trace.ticks) {
      expect(tick.truth.beliefHistogram).toHaveLength(trace.histogram.bins);
      const total = tick.truth.beliefHistogram.reduce((a, b) => a + b, 0);
      expect(total).toBe(120);
    }
  });

  it("publishes bin edges so the UI never re-derives the geometry", () => {
    expect(trace.histogram.edges).toHaveLength(trace.histogram.bins);
    expect(trace.histogram.edges[0]).toBe(0);
    expect(trace.histogram.edges.at(-1)).toBeCloseTo(
      1 - 1 / trace.histogram.bins,
      10,
    );
  });

  it("keeps truth and telemetry in separate objects on every tick", () => {
    for (const tick of trace.ticks) {
      expect(Object.keys(tick.telemetry).sort()).toEqual([
        "activeAccounts",
        "activeDegreeRatio",
        "clusterActivityShare",
        "volume",
      ]);
      expect(tick.telemetry).not.toHaveProperty("beliefHistogram");
      expect(tick.telemetry).not.toHaveProperty("meanBelief");
      expect(tick.truth).not.toHaveProperty("volume");
    }
  });

  it("derives detection signatures from telemetry alone", () => {
    // Same input the binding hands the detector, so the number on the page is
    // the number the pipeline actually used.
    expect(trace.detection.compositeScore).toBeGreaterThanOrEqual(0);
    expect(trace.detection.compositeScore).toBeLessThanOrEqual(1);
    expect(Number.isFinite(trace.detection.burstiness)).toBe(true);
  });

  it("shows the campaign moving the population it targets", () => {
    const before = trace.ticks[0]!.truth;
    const after = trace.ticks.at(-1)!.truth;
    expect(after.adoptionRate).toBeGreaterThan(before.adoptionRate);
  });

  it("records injections only inside the campaign window", () => {
    const outside = trace.ticks.filter((t) => t.tick < 8 || t.tick > 34);
    expect(outside.every((t) => t.truth.injections === 0)).toBe(true);
    const inside = trace.ticks.filter((t) => t.tick >= 8 && t.tick <= 34);
    expect(inside.some((t) => t.truth.injections > 0)).toBe(true);
  });

  it("carries the synthetic-world caveat with the data", () => {
    expect(trace.caveat).toMatch(/SYNTHETIC WORLD/);
  });

  it("refuses a run with no truth events rather than rendering an empty page", () => {
    expect(() =>
      buildRunTrace("run-3", identity, [
        { tick: 0, kind: "telemetry", data: { volume: 1 } },
      ]),
    ).toThrow(TraceError);
  });

  it("refuses an identity with no config", () => {
    expect(() => buildRunTrace("run-4", { kernelVersion: "x" }, [])).toThrow(
      TraceError,
    );
  });

  it("treats a missing telemetry tick as silence, not as a hole", () => {
    const partial = buildRunTrace("run-5", identity, [
      {
        tick: 0,
        kind: "truth",
        data: { meanBelief: 0.5, beliefHistogram: [1] },
      },
    ]);
    expect(partial.ticks[0]!.telemetry.volume).toBe(0);
    expect(partial.ticks[0]!.telemetry.clusterActivityShare).toEqual([]);
  });
});

describe("identity shapes", () => {
  /**
   * The pipeline nests the world config under `config.domain`, beside the run
   * spec that produced it. Reading only the outer object silently reports every
   * ensemble member as a control run with no adversary in it — which is what
   * happened the first time this was wired up.
   */
  it("unwraps the pipeline's nested identity and finds the campaign", () => {
    const nested = buildRunTrace(
      "run-6",
      {
        config: {
          domain: config,
          seed: "ns::fallback-3",
          spec: {
            id: "fallback-3",
            label: "sweep 3",
            riskTolerance: 62,
            escalationPropensity: 38,
            rationale: "Deterministic parameter sweep.",
          },
          quantity: { name: "adoptionRate", resolveAtTick: 39 },
        },
        corpusSnapshotId: "corpus-abc",
        kernelVersion: "influence-ops@1",
      },
      [{ tick: 0, kind: "truth", data: { meanBelief: 0.5, beliefHistogram: [1] } }],
    );

    expect(nested.campaign).not.toBeNull();
    expect(nested.campaign!.startTick).toBe(8);
    expect(nested.world.agents).toBe(120);
    expect(nested.spec!.riskTolerance).toBe(62);
    expect(nested.spec!.escalationPropensity).toBe(38);
    expect(nested.seed).toBe("ns::fallback-3");
  });

  it("still reads a flat identity from a directly-driven simulation", () => {
    expect(trace.campaign).not.toBeNull();
    expect(trace.spec).toBeNull();
  });
});
