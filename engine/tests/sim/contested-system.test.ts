import { describe, expect, it } from "vitest";

import { REGIONAL_GRID } from "../../src/scenario/packs/regional-grid.js";
import { buildScenario, castScenario } from "../../src/scenario/spec.js";
import { runScenario } from "../../src/scenario/run.js";
import { createMemoryObserver } from "../../src/observe/stream.js";
import type { RunEvent } from "../../src/observe/stream.js";
import { doctrineDistance } from "../../src/actors/doctrine.js";
import { decisionWeights, frameFor } from "../../src/actors/posture.js";
import {
  ALLY_BLOC,
  OPPORTUNIST,
  PATIENT_STATE,
  actorSpec,
  fixtureLibrary,
} from "./contested-fixtures.js";

const library = fixtureLibrary();

function respondentSpec() {
  return {
    profileId: "fixture-ally-bloc",
    alignment: "defender_aligned" as const,
    // Acts on high-confidence attribution, not on courtroom-grade proof.
    attributionThreshold: 0.5,
    responseCapacity: 4,
  };
}

async function run(
  actorIds: readonly string[],
  seed: string,
  options: { defense?: number | null; respondents?: boolean } = {},
) {
  const spec = castScenario(
    REGIONAL_GRID,
    actorIds.map((id) => actorSpec(id)),
    options.respondents === false ? [] : [respondentSpec()],
  );
  const defense =
    options.defense === undefined || options.defense === null
      ? null
      : REGIONAL_GRID.defenses[options.defense]!;
  const config = buildScenario(spec, { library, defense });
  const observer = createMemoryObserver();
  const result = await runScenario({
    config,
    seed,
    observers: [observer],
    tickDelayMs: 0,
    now: () => 0,
  });
  return { result, events: observer.events as readonly RunEvent[] };
}

function deliberations(events: readonly RunEvent[], actorId: string) {
  return events.filter(
    (event) =>
      event.type === "deliberation" &&
      (event.payload as { actorId?: string }).actorId === actorId,
  ) as Extract<RunEvent, { type: "deliberation" }>[];
}

describe("contested-system engine", () => {
  it("runs a scenario end to end and emits a complete, ordered stream", async () => {
    const { result, events } = await run(["fixture-patient-state"], "seed-a");

    expect(events[0]?.type).toBe("run_started");
    expect(events.at(-1)?.type).toBe("run_finished");
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));

    // One tick and one telemetry event per tick, one deliberation per actor.
    expect(events.filter((e) => e.type === "tick")).toHaveLength(180);
    expect(events.filter((e) => e.type === "telemetry")).toHaveLength(180);
    expect(events.filter((e) => e.type === "deliberation")).toHaveLength(180);
    expect(result.eventsEmitted).toBe(events.length);
  });

  it("is reproducible from its seed", async () => {
    const a = await run(
      ["fixture-patient-state", "fixture-opportunist"],
      "same",
    );
    const b = await run(
      ["fixture-patient-state", "fixture-opportunist"],
      "same",
    );

    expect(a.result.runId).toBe(b.result.runId);
    expect(a.result.totalHarm).toBe(b.result.totalHarm);
    expect(a.result.activations).toBe(b.result.activations);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
  });

  it("routes reasoning to the privileged channel and telemetry to its own", async () => {
    const { events } = await run(["fixture-patient-state"], "seed-c");

    for (const event of events) {
      if (event.type === "deliberation")
        expect(event.channel).toBe("privileged");
      if (event.type === "telemetry") expect(event.channel).toBe("telemetry");
    }

    // A defender-side consumer filtering to telemetry must see no reasoning and
    // no ground truth at all — this is the tautology guard.
    const defenderVisible = events.filter((e) => e.channel === "telemetry");
    expect(defenderVisible.length).toBe(180);
    expect(defenderVisible.every((e) => e.type === "telemetry")).toBe(true);
  });

  it("every rationale is derived from the terms that actually ran", async () => {
    const { events } = await run(["fixture-patient-state"], "seed-d");
    const all = deliberations(events, "fixture-patient-state");

    expect(all.length).toBeGreaterThan(0);
    for (const event of all) {
      const payload = event.payload as Record<string, unknown>;
      expect(typeof payload.rationale).toBe("string");
      expect((payload.rationale as string).length).toBeGreaterThan(0);
      expect(payload.disposition).toBeTruthy();
      expect(payload.decision).toBeTruthy();
    }
  });

  it("respects the earliest-activation window", async () => {
    const { events } = await run(["fixture-patient-state"], "seed-e");
    const early = deliberations(events, "fixture-patient-state").filter(
      (event) => event.tick < 10,
    );

    for (const event of early) {
      const decision = (event.payload as { decision: string }).decision;
      expect(["not_yet_active", "no_holdings"]).toContain(decision);
    }
  });
});

describe("doctrine actually changes behaviour", () => {
  it("the two fixture actors are genuinely distinct in doctrine space", () => {
    // If this collapses, every downstream behavioural difference is noise.
    expect(doctrineDistance(PATIENT_STATE, OPPORTUNIST)).toBeGreaterThan(0.25);
  });

  it("patience alone changes when an advantage is spent", async () => {
    // Single-variable experiment: the two fixtures differ ONLY in timeHorizon,
    // so any difference in timing is attributable to patience and nothing else.
    const patient = await run(["fixture-patient-opportunist"], "hold-test");
    const impatient = await run(["fixture-opportunist"], "hold-test");

    const holds = (events: readonly RunEvent[], id: string) =>
      deliberations(events, id).filter(
        (event) => (event.payload as { decision: string }).decision === "hold",
      ).length;

    expect(
      holds(patient.events, "fixture-patient-opportunist"),
    ).toBeGreaterThan(0);
    expect(holds(impatient.events, "fixture-opportunist")).toBe(0);
  });

  it("a redline removes moves from the choice set rather than discounting them", async () => {
    const { events } = await run(["fixture-patient-state"], "redline-test");

    const blockedCounts = deliberations(events, "fixture-patient-state").map(
      (event) => (event.payload as { blocked: unknown[] }).blocked.length,
    );
    expect(Math.max(...blockedCounts)).toBeGreaterThan(0);

    // The top rung puts 0.85 of the harm on noncombatants and the commitment
    // caps at 0.8, so it must never execute — at any price, in any frame.
    const chosen = events
      .filter((e) => e.type === "activation")
      .map((e) => (e.payload as { rungId: string }).rungId);
    expect(chosen).not.toContain("interruption_without_alarm");
  });

  it("an actor with no such commitment will reach the top rung", async () => {
    // Same system, same capability, different doctrine. If this never fires,
    // the redline test above proves nothing.
    const reached = new Set<string>();
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
      const { events } = await run(["fixture-opportunist"], seed);
      for (const event of events) {
        if (event.type === "activation") {
          reached.add((event.payload as { rungId: string }).rungId);
        }
      }
    }
    expect(reached.has("interruption_without_alarm")).toBe(true);
  });

  it("the loss frame discounts own exposure but never civilian restraint", () => {
    const gain = decisionWeights(PATIENT_STATE, "gain");
    const loss = decisionWeights(PATIENT_STATE, "loss");

    expect(loss.attributionCost).toBeLessThan(gain.attributionCost);
    expect(loss.retaliationCost).toBeLessThan(gain.retaliationCost);
    expect(loss.counterpartHarmCost).toBe(gain.counterpartHarmCost);
  });

  it("sustained pressure flips an actor into the loss frame", () => {
    expect(
      frameFor(OPPORTUNIST, {
        sustainedCost: 0,
        attritionRate: 0,
        redlineCrossed: false,
      }),
    ).toBe("gain");
    expect(
      frameFor(OPPORTUNIST, {
        sustainedCost: 0.95,
        attritionRate: 0.8,
        redlineCrossed: false,
      }),
    ).toBe("loss");
  });
});

describe("third parties change the arithmetic", () => {
  it("removing the responding bloc raises attributable action", async () => {
    let withBloc = 0;
    let without = 0;

    for (const seed of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
      const a = await run(["fixture-patient-state"], seed);
      const b = await run(["fixture-patient-state"], seed, {
        respondents: false,
      });
      withBloc += a.events.filter(
        (e) =>
          e.type === "activation" &&
          (e.payload as { attributed: boolean }).attributed,
      ).length;
      without += b.events.filter(
        (e) =>
          e.type === "activation" &&
          (e.payload as { attributed: boolean }).attributed,
      ).length;
    }

    // The whole point of modelling respondents: an actor prices who reacts.
    expect(without).toBeGreaterThanOrEqual(withBloc);
  });

  it("acting through proxies buys out of the retaliation term entirely", async () => {
    // The central claim of the proxy literature, as arithmetic: the two actors
    // face the SAME respondent at the SAME rungs. The one that prefers
    // surrogates drops its effective attributability below the bloc's threshold
    // and the response term vanishes — not shrinks, vanishes — while the actor
    // that operates directly pays it in full.
    const direct = await run(["fixture-opportunist"], "terms");
    const viaProxy = await run(["fixture-patient-state"], "terms");

    const retaliationTerms = (
      events: readonly RunEvent[],
      id: string,
    ): number[] =>
      deliberations(events, id)
        .flatMap((event) => (event.payload as { considered: any[] }).considered)
        .map((move) => move.retaliationCost);

    const directTerms = retaliationTerms(direct.events, "fixture-opportunist");
    const proxyTerms = retaliationTerms(
      viaProxy.events,
      "fixture-patient-state",
    );

    expect(directTerms.some((cost) => cost > 0)).toBe(true);
    expect(proxyTerms.every((cost) => cost === 0)).toBe(true);
  });
});

describe("consequence honesty", () => {
  it("a parametric oracle never claims its estimates are established", async () => {
    const { events } = await run(["fixture-opportunist"], "parametric");
    const activations = events.filter((e) => e.type === "activation");

    expect(activations.length).toBeGreaterThan(0);
    for (const event of activations) {
      expect((event.payload as { established: boolean }).established).toBe(
        false,
      );
    }
  });

  it("the run announces its evidence class and carries the caveat", async () => {
    const { events } = await run(["fixture-opportunist"], "caveat");

    const started = events.find((e) => e.type === "run_started")!;
    expect(started.type).toBe("run_started");
    if (started.type === "run_started") {
      expect(started.oracle.evidenceClass).toBe("parametric");
      expect(started.caveat).toMatch(/STRUCTURED GUESSES/);
    }

    const finished = events.at(-1)!;
    if (finished.type === "run_finished") {
      expect(finished.evidenceClass).toBe("parametric");
    }
  });
});

describe("defensive arms", () => {
  it("a consequence-limiting mitigation reduces harm across seeds", async () => {
    let baseline = 0;
    let mitigated = 0;
    const manualFallback = REGIONAL_GRID.defenses.findIndex(
      (d) => d.kind === "manual-fallback",
    );

    for (const seed of ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"]) {
      baseline += (await run(["fixture-opportunist"], seed)).result.totalHarm;
      mitigated += (
        await run(["fixture-opportunist"], seed, { defense: manualFallback })
      ).result.totalHarm;
    }

    expect(mitigated).toBeLessThan(baseline);
  });

  it("charges for the mitigation every tick it is active", async () => {
    const segmentation = REGIONAL_GRID.defenses.findIndex(
      (d) => d.kind === "segmentation",
    );
    const { events } = await run(["fixture-opportunist"], "cost", {
      defense: segmentation,
    });

    const last = [...events]
      .reverse()
      .find((e) => e.type === "tick") as Extract<RunEvent, { type: "tick" }>;
    expect(last.cumulativeDefenseCost).toBe(180 * 18);
  });
});

describe("scenario validation fails closed", () => {
  it("rejects an actor naming a rung that is not on the ladder", () => {
    const spec = castScenario(REGIONAL_GRID, [
      actorSpec("fixture-opportunist", { reachableRungs: ["not_a_rung"] }),
    ]);
    expect(() => buildScenario(spec, { library })).toThrow(/not on the ladder/);
  });

  it("rejects an actor naming a doctrine profile the library lacks", () => {
    const spec = castScenario(REGIONAL_GRID, [actorSpec("nobody")]);
    expect(() => buildScenario(spec, { library })).toThrow(
      /library does not have/,
    );
  });

  it("rejects a parametric scenario with an asset that declared no properties", () => {
    const broken = {
      ...REGIONAL_GRID,
      assets: REGIONAL_GRID.assets.map((asset, index) =>
        index === 0 ? { ...asset, parametric: undefined } : asset,
      ),
    };
    const spec = castScenario(broken, [actorSpec("fixture-opportunist")]);
    expect(() => buildScenario(spec, { library })).toThrow(
      /would price as harmless/,
    );
  });
});

describe("profile validation", () => {
  it("refuses a parameter with no stated basis", async () => {
    const { createLibrary } = await import("../../src/actors/library.js");
    const broken = structuredClone(ALLY_BLOC) as typeof ALLY_BLOC;
    (broken.doctrine as any).timeHorizon.basis = "   ";

    expect(() =>
      createLibrary([broken], { reviewedAt: "x", method: "x" }),
    ).toThrow(/basis is required/);
  });
});
