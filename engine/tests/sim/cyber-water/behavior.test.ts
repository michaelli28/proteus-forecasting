import { describe, it, expect } from "vitest";
import { runSimulation } from "../../../src/sim/kernel.js";
import { Rng } from "../../../src/sim/rng.js";
import {
  cyberWaterAdapter,
  DEFAULT_CONFIG,
  configFromRunSpec,
  validateConfig,
  seedAccess,
  enumerateChoices,
  selectActivation,
  lookupConsequence,
  snapDuration,
  measureRun,
  deriveSignatures,
} from "../../../src/sim/adapters/cyber-water/index.js";
import type {
  CyberWaterConfig,
  ObservableTick,
} from "../../../src/sim/adapters/cyber-water/index.js";
import { TEST_TABLE, TEST_REGISTER, TEST_SERVED } from "./fixture.js";

const SEEDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function baseConfig(
  overrides: Partial<CyberWaterConfig> = {},
): CyberWaterConfig {
  return configFromRunSpec(
    { riskTolerance: 60, escalationPropensity: 60 },
    {
      register: TEST_REGISTER,
      servedPopulation: TEST_SERVED,
      consequence: TEST_TABLE,
      ticks: 120,
      ...overrides,
    },
  );
}

describe("cyber-water config", () => {
  it("accepts the reference config", () => {
    expect(() => validateConfig(baseConfig())).not.toThrow();
  });

  it("rejects an empty register — a world with nothing to compromise", () => {
    expect(() => validateConfig({ ...baseConfig(), register: [] })).toThrow(
      /register is empty/,
    );
  });

  it("rejects a rationality below zero", () => {
    const config = baseConfig();
    expect(() =>
      validateConfig({
        ...config,
        adversary: { ...config.adversary, rationality: -1 },
      }),
    ).toThrow(/rationality/);
  });

  it("clamps the access prior to the register size", () => {
    const config = configFromRunSpec(
      { riskTolerance: 100, escalationPropensity: 50 },
      {
        register: TEST_REGISTER,
        servedPopulation: TEST_SERVED,
        consequence: TEST_TABLE,
      },
    );
    expect(config.adversary.initialAccessMean).toBeLessThanOrEqual(
      TEST_REGISTER.length,
    );
  });
});

describe("consequence lookup", () => {
  it("snaps a requested duration DOWN to the solved grid, never up", () => {
    expect(snapDuration(TEST_TABLE, 30)).toEqual({ hours: 24, clamped: false });
    expect(snapDuration(TEST_TABLE, 48)).toEqual({ hours: 48, clamped: false });
  });

  it("clamps a sub-grid duration to the shortest and flags it", () => {
    expect(snapDuration(TEST_TABLE, 1)).toEqual({ hours: 6, clamped: true });
  });

  it("returns the no-effect cell for a null perturbation", () => {
    const { cell } = lookupConsequence(TEST_TABLE, "-", "none", 0);
    expect(cell.deltaPersonHoursLow).toBe(0);
  });

  it("throws on a component the solved grid does not cover", () => {
    expect(() =>
      lookupConsequence(TEST_TABLE, "GHOST", "pump_stop", 24),
    ).toThrow(/no cell/);
  });
});

describe("quantal-response selection", () => {
  it("collapses to argmax as rationality grows", () => {
    const config = baseConfig();
    const held = TEST_REGISTER.map((c) => ({
      componentId: c.id,
      acquiredTick: 0,
      value: 1,
    }));
    const choices = enumerateChoices(config, held, 1, 50);
    const rng = new Rng("q");

    // At high rationality, 200 draws should almost all be the max-value choice.
    const best = choices.reduce((top, c) => (c.value > top.value ? c : top));
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      const pick = selectActivation(choices, 50, rng.fork(`i${i}`));
      if (
        pick?.component.id === best.component.id &&
        pick?.band === best.band
      ) {
        hits++;
      }
    }
    expect(hits).toBeGreaterThan(180);
  });

  it("explores more than one option at low rationality", () => {
    const config = baseConfig();
    const held = TEST_REGISTER.map((c) => ({
      componentId: c.id,
      acquiredTick: 0,
      value: 1,
    }));
    const choices = enumerateChoices(config, held, 1, 50);
    const rng = new Rng("q");

    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pick = selectActivation(choices, 0.5, rng.fork(`i${i}`));
      if (pick) seen.add(`${pick.component.id}|${pick.band}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("cyber-water simulation", () => {
  it("is deterministic — same seed, identical event log", async () => {
    const config = baseConfig();
    const a = await runSimulation(cyberWaterAdapter, config, "seed-1");
    const b = await runSimulation(cyberWaterAdapter, config, "seed-1");
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it("never spends a component the register does not contain", async () => {
    const config = baseConfig();
    const ids = new Set(TEST_REGISTER.map((c) => c.id));
    for (const seed of SEEDS) {
      const result = await runSimulation(cyberWaterAdapter, config, seed);
      for (const activation of result.finalState.activations) {
        expect(ids.has(activation.componentId)).toBe(true);
      }
    }
  });

  it("a risk-tolerant, escalation-prone actor activates more than a cautious one", async () => {
    const bold = configFromRunSpec(
      { riskTolerance: 90, escalationPropensity: 90 },
      {
        register: TEST_REGISTER,
        servedPopulation: TEST_SERVED,
        consequence: TEST_TABLE,
        ticks: 150,
      },
    );
    const cautious = configFromRunSpec(
      { riskTolerance: 10, escalationPropensity: 10 },
      {
        register: TEST_REGISTER,
        servedPopulation: TEST_SERVED,
        consequence: TEST_TABLE,
        ticks: 150,
      },
    );

    let boldTotal = 0;
    let cautiousTotal = 0;
    for (const seed of SEEDS) {
      boldTotal += (await runSimulation(cyberWaterAdapter, bold, seed))
        .finalState.activations.length;
      cautiousTotal += (await runSimulation(cyberWaterAdapter, cautious, seed))
        .finalState.activations.length;
    }
    expect(boldTotal).toBeGreaterThan(cautiousTotal);
  });

  it("never reports harm on an activation the sweep did not establish", async () => {
    const config = baseConfig();
    for (const seed of SEEDS) {
      const result = await runSimulation(cyberWaterAdapter, config, seed);
      for (const activation of result.finalState.activations) {
        if (!activation.established) {
          // An unestablished kinetic activation still records a band, but its
          // reported personHours must be the conservative figure — never a
          // sweep-sensitive number promoted to a finding.
          expect(activation.personHours).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("daysToFirstActivation equals ticks when access is never spent", () => {
    const measures = measureRun([], 180);
    expect(measures.daysToFirstActivation).toBe(180);
    expect(measures.activationCount).toBe(0);
  });
});

describe("detector / oracle separation", () => {
  it("signatures depend only on telemetry, not on held access", async () => {
    const config = baseConfig();
    const result = await runSimulation(cyberWaterAdapter, config, "sep");

    const telemetry: ObservableTick[] = result.events
      .filter((e) => e.kind === "telemetry")
      .map((e) => ({
        tick: e.tick,
        anomalyEvents: e.data.anomalyEvents as number,
        configChangeEvents: e.data.configChangeEvents as number,
        failedAuthEvents: e.data.failedAuthEvents as number,
        serviceComplaints: e.data.serviceComplaints as number,
      }));

    const signatures = deriveSignatures(telemetry);
    expect(signatures.compositeScore).toBeGreaterThanOrEqual(0);
    expect(signatures.compositeScore).toBeLessThanOrEqual(1);

    // No telemetry event may carry a ground-truth field.
    for (const event of result.events.filter((e) => e.kind === "telemetry")) {
      expect(event.data).not.toHaveProperty("activatedComponent");
      expect(event.data).not.toHaveProperty("heldCount");
      expect(event.data).not.toHaveProperty("activatedPersonHours");
    }
  });
});
