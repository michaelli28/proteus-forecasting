import { describe, it, expect } from "vitest";
import { runSimulation } from "../../src/sim/kernel.js";
import {
  INFLUENCE_OPS_MEASURES,
  MEASURE_BOUNDS,
  createInfluenceOpsBinding,
  influenceOpsBinding,
  influenceOpsQuantity,
  signaturesUpTo,
} from "../../src/pipeline/influence-ops-binding.js";
import { DEFAULT_CONFIG } from "../../src/sim/adapters/influence-ops/index.js";
import type { RunSpec } from "../../src/agents/framer.js";
import type { SimEvent } from "../../src/sim/kernel.js";

/** Small world so the binding's tests stay in the millisecond range. */
const SMALL = {
  ...DEFAULT_CONFIG,
  ticks: 30,
  population: { ...DEFAULT_CONFIG.population, agents: 80, clusters: 3 },
  network: { intraClusterDegree: 4, interClusterEdges: 4 },
};

const binding = createInfluenceOpsBinding(SMALL);

function spec(id: string, risk: number, escalation: number): RunSpec {
  return {
    id,
    label: id,
    riskTolerance: risk,
    escalationPropensity: escalation,
    rationale: "fixture",
  };
}

describe("influenceOpsQuantity", () => {
  it("carries the measure's definitional bounds", () => {
    for (const measure of INFLUENCE_OPS_MEASURES) {
      const quantity = influenceOpsQuantity(measure, 25);
      const [min, max] = MEASURE_BOUNDS[measure];
      expect(quantity.min).toBe(min);
      expect(quantity.max).toBe(max);
      expect(quantity.name).toBe(measure);
      expect(quantity.resolveAtTick).toBe(25);
    }
  });

  it("rejects a negative resolution tick", () => {
    expect(() => influenceOpsQuantity("adoptionRate", -1)).toThrow(RangeError);
  });

  it("accepts a narrower pre-registered range for the question", () => {
    const quantity = influenceOpsQuantity("adoptionRate", 119, [0.35, 0.65]);
    expect(quantity.min).toBe(0.35);
    expect(quantity.max).toBe(0.65);
  });

  it("refuses a range outside the measure's definitional bounds", () => {
    expect(() => influenceOpsQuantity("variance", 119, [0, 0.5])).toThrow(
      RangeError,
    );
    expect(() => influenceOpsQuantity("adoptionRate", 119, [0.6, 0.6])).toThrow(
      RangeError,
    );
  });
});

describe("configFor", () => {
  it("gives the campaign more reach as risk tolerance rises", () => {
    const quantity = influenceOpsQuantity("adoptionRate", 25);
    const cautious = binding.configFor(spec("a", 10, 50), quantity);
    const aggressive = binding.configFor(spec("b", 90, 50), quantity);
    expect(aggressive.campaign!.injectionNodes).toBeGreaterThan(
      cautious.campaign!.injectionNodes,
    );
  });

  it("moves the campaign earlier as escalation propensity rises", () => {
    const quantity = influenceOpsQuantity("adoptionRate", 25);
    const patient = binding.configFor(spec("a", 50, 5), quantity);
    const eager = binding.configFor(spec("b", 50, 95), quantity);
    expect(eager.campaign!.startTick).toBeLessThan(patient.campaign!.startTick);
  });

  it("always runs long enough to reach the resolution tick", () => {
    const quantity = influenceOpsQuantity("adoptionRate", 200);
    expect(
      binding.configFor(spec("a", 50, 50), quantity).ticks,
    ).toBeGreaterThan(200);
  });
});

describe("readQuantity", () => {
  it("reads the requested measure at the resolution tick", async () => {
    const quantity = influenceOpsQuantity("adoptionRate", 20);
    const config = binding.configFor(spec("a", 60, 60), quantity);
    const result = await runSimulation(binding.adapter, config, "seed", {
      observeEvery: 0,
    });

    const value = binding.readQuantity(result, quantity);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);

    const truth = result.events.find(
      (e) => e.kind === "truth" && e.tick === 20,
    )!;
    expect(value).toBe(truth.data.adoptionRate);
  });

  it("throws when the run never reached the resolution tick", async () => {
    const quantity = influenceOpsQuantity("adoptionRate", 20);
    const short = {
      ...binding.configFor(spec("a", 50, 50), quantity),
      ticks: 5,
    };
    const result = await runSimulation(binding.adapter, short, "seed", {
      observeEvery: 0,
    });
    expect(() => binding.readQuantity(result, quantity)).toThrow(/tick 20/);
  });
});

describe("signatures — the detector/oracle separation", () => {
  it("exposes only telemetry channels, never a belief measure", async () => {
    const quantity = influenceOpsQuantity("adoptionRate", 20);
    const config = binding.configFor(spec("a", 70, 70), quantity);
    const result = await runSimulation(binding.adapter, config, "seed", {
      observeEvery: 0,
    });

    const keys = Object.keys(binding.signatures(result));
    expect(keys.length).toBeGreaterThan(0);
    for (const measure of INFLUENCE_OPS_MEASURES) {
      expect(keys).not.toContain(measure);
    }
    expect(keys).toContain("compositeScore");
  });

  it("is derived from the telemetry event stream, not from final state", async () => {
    const quantity = influenceOpsQuantity("adoptionRate", 20);
    const config = binding.configFor(spec("a", 70, 70), quantity);
    const result = await runSimulation(binding.adapter, config, "seed", {
      observeEvery: 0,
    });

    // Stripping ground-truth events must leave the signatures unchanged.
    const telemetryOnly = {
      ...result,
      events: result.events.filter((e) => e.kind !== "truth"),
      finalState: undefined as never,
    };
    expect(binding.signatures(telemetryOnly)).toEqual(
      binding.signatures(result),
    );
  });
});

describe("signaturesUpTo — telemetry through tick t0 and nothing later", () => {
  const quantity = influenceOpsQuantity("adoptionRate", 25);

  async function run(risk: number, escalation: number) {
    const config = binding.configFor(spec("a", risk, escalation), quantity);
    return runSimulation(binding.adapter, config, "seed", { observeEvery: 0 });
  }

  function scramble(event: SimEvent): SimEvent {
    return event.kind === "telemetry"
      ? {
          ...event,
          data: {
            volume: 1e6,
            activeAccounts: 1e6,
            activeDegreeRatio: 99,
            clusterActivityShare: [1, 0, 0],
          },
        }
      : { ...event, data: { adoptionRate: 1 } };
  }

  it("ignores every event, truth or telemetry, after t0", async () => {
    const result = await run(70, 70);
    const t0 = 12;
    const tampered = {
      ...result,
      events: result.events.map((e) => (e.tick > t0 ? scramble(e) : e)),
    };
    expect(signaturesUpTo(tampered, t0)).toEqual(signaturesUpTo(result, t0));

    // Not vacuous: tampering with tick t0 itself does move the reading.
    const atCutoff = {
      ...result,
      events: result.events.map((e) => (e.tick === t0 ? scramble(e) : e)),
    };
    expect(signaturesUpTo(atCutoff, t0)).not.toEqual(
      signaturesUpTo(result, t0),
    );
  });

  it("cannot tell two campaigns apart before either has started", async () => {
    // On this 30-tick world both campaigns start at tick 13 or later.
    const quiet = await run(20, 20);
    const loud = await run(90, 90);
    expect(signaturesUpTo(loud, 12)).toEqual(signaturesUpTo(quiet, 12));
    expect(signaturesUpTo(loud, 29)).not.toEqual(signaturesUpTo(quiet, 29));
  });

  it("matches the full-run signatures when t0 is the last tick", async () => {
    const result = await run(70, 70);
    expect(signaturesUpTo(result, 29)).toEqual(binding.signatures(result));
  });

  it("rejects a cutoff that is not a non-negative integer", async () => {
    const result = await run(70, 70);
    expect(() => signaturesUpTo(result, -1)).toThrow(RangeError);
    expect(() => signaturesUpTo(result, 2.5)).toThrow(RangeError);
  });
});

describe("adoptionThreshold — a truth-only change telemetry cannot see", () => {
  const quantity = influenceOpsQuantity("adoptionRate", 25);

  async function run(threshold?: number) {
    const b = createInfluenceOpsBinding(
      threshold === undefined
        ? SMALL
        : { ...SMALL, adoptionThreshold: threshold },
    );
    const config = b.configFor(spec("a", 70, 70), quantity);
    const result = await runSimulation(b.adapter, config, "seed", {
      observeEvery: 0,
    });
    return { b, result };
  }

  it("leaves every telemetry event identical while moving the answer", async () => {
    const reference = await run();
    const shifted = await run(0.5);
    const telemetry = (r: typeof reference) =>
      r.result.events.filter((e) => e.kind === "telemetry");
    expect(telemetry(shifted)).toEqual(telemetry(reference));
    expect(shifted.b.readQuantity(shifted.result, quantity)).toBeGreaterThan(
      reference.b.readQuantity(reference.result, quantity),
    );
  });

  it("defaults to 0.6 without adding a field to the run's config", async () => {
    const reference = await run();
    const explicit = await run(0.6);
    expect(explicit.result.events).toEqual(reference.result.events);
    const config = binding.configFor(spec("a", 70, 70), quantity);
    expect("adoptionThreshold" in config).toBe(false);
  });

  it("rejects a threshold outside (0, 1)", async () => {
    await expect(run(0)).rejects.toThrow(RangeError);
    await expect(run(1.2)).rejects.toThrow(RangeError);
  });
});

describe("the default binding", () => {
  it("uses the reference world configuration", () => {
    const quantity = influenceOpsQuantity("adoptionRate", 50);
    expect(
      influenceOpsBinding.configFor(spec("a", 50, 50), quantity).population
        .agents,
    ).toBe(DEFAULT_CONFIG.population.agents);
  });
});
