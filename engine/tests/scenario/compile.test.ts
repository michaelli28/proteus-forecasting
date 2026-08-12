import { describe, expect, it } from "vitest";

import { createStubClient } from "../../src/llm/stub.js";
import {
  coherenceProblems,
  compileScenario,
  CompilerError,
} from "../../src/scenario/compile.js";
import { REGIONAL_GRID } from "../../src/scenario/packs/regional-grid.js";
import { fixtureLibrary } from "../sim/contested-fixtures.js";
import type { SituationSpec } from "../../src/scenario/spec.js";

const library = fixtureLibrary();

/** A minimal situation the coherence checks should accept. */
function goodSituation(): SituationSpec {
  return {
    id: "test-situation",
    statement: "A test system, contested over 60 days.",
    provenance: "Synthetic, for tests.",
    ticks: 60,
    tickUnit: "day",
    servedUnits: 1000,
    assets: [
      {
        id: "NODE-A",
        assetClass: "node",
        zone: "core",
        effectKind: "service_lost",
        servedUnits: 800,
        parametric: {
          unitsDependent: 800,
          immediateLossShare: 0.8,
          bufferHours: 0,
          recoveryTailHours: 4,
          redundancy: 0.2,
        },
      },
      {
        id: "NODE-B",
        assetClass: "node",
        zone: "edge",
        effectKind: "service_lost",
        servedUnits: 400,
        parametric: {
          unitsDependent: 400,
          immediateLossShare: 0.6,
          bufferHours: 2,
          recoveryTailHours: 6,
          redundancy: 0.4,
        },
      },
    ],
    ladder: [
      {
        id: "none",
        statement: "no action taken",
        attributability: 0,
        visibility: 0,
        civilianHarmShare: 0,
        durationHours: 0,
        reversible: true,
        legitimacyCost: 0,
      },
      {
        id: "brief_outage",
        statement: "service briefly unavailable",
        attributability: 0.4,
        visibility: 0.5,
        civilianHarmShare: 0.3,
        durationHours: 6,
        reversible: true,
        legitimacyCost: 0.3,
      },
      {
        id: "sustained_outage",
        statement: "service unavailable for an extended period",
        attributability: 0.6,
        visibility: 0.8,
        civilianHarmShare: 0.6,
        durationHours: 24,
        reversible: true,
        legitimacyCost: 0.6,
      },
    ],
    defenses: [
      {
        kind: "segmentation",
        label: "segmentation",
        statement: "separates the nodes",
        startTick: 0,
        intensity: 0.6,
        costPerTick: 10,
        coverage: 0.6,
        effects: [{ channel: "access_denial", strength: 0.9 }],
      },
      {
        kind: "fallback",
        label: "manual fallback",
        statement: "run it by hand",
        startTick: 0,
        intensity: 0.6,
        costPerTick: 5,
        coverage: 0.6,
        effects: [{ channel: "consequence_limiting", strength: 0.8 }],
      },
    ],
    oracle: { kind: "parametric", harmUnit: "user-hours", uncertainty: 0.5 },
    backgroundAnomalyRate: 1.5,
  };
}

function compiledPayload(
  situation: SituationSpec,
  actorId = "fixture-opportunist",
) {
  return JSON.stringify({
    situation,
    suggestedActors: [{ profileId: actorId, reasoning: "test" }],
    assumptions: ["assumed a synthetic system"],
    limitations: ["no domain solver behind the consequences"],
  });
}

describe("coherence checks", () => {
  it("accepts a well-formed situation", () => {
    expect(coherenceProblems(goodSituation())).toEqual([]);
  });

  it("accepts every shipped pack", () => {
    // The packs are the reference for what "coherent" means. If a check
    // rejects one of them, the check is wrong, not the pack.
    expect(coherenceProblems(REGIONAL_GRID)).toEqual([]);
  });

  it("catches a ladder that does not begin with the null rung", () => {
    const situation = goodSituation();
    const problems = coherenceProblems({
      ...situation,
      ladder: situation.ladder.slice(1),
    });
    expect(problems.join(" ")).toMatch(/null rung/);
  });

  it("catches a ladder whose severity does not ascend", () => {
    const situation = goodSituation();
    const [nullRung, brief, sustained] = situation.ladder;
    const problems = coherenceProblems({
      ...situation,
      ladder: [nullRung!, sustained!, brief!],
    });
    expect(problems.join(" ")).toMatch(/ascend in severity/);
  });

  it("catches an asset with no parametric properties", () => {
    const situation = goodSituation();
    const problems = coherenceProblems({
      ...situation,
      assets: [
        { ...situation.assets[0]!, parametric: undefined },
        situation.assets[1]!,
      ],
    });
    expect(problems.join(" ")).toMatch(/price as harmless/);
  });

  it("catches servedUnits summed from overlapping assets", () => {
    // The exact defect that made the first grid pack inert: summing assets that
    // serve the same people inflates the denominator until nothing is worth doing.
    const situation = goodSituation();
    const summed = situation.assets.reduce((t, a) => t + a.servedUnits, 0);
    const problems = coherenceProblems({ ...situation, servedUnits: summed });
    expect(problems.join(" ")).toMatch(/double-counts/);
  });

  it("catches servedUnits smaller than a single asset", () => {
    const situation = goodSituation();
    const problems = coherenceProblems({ ...situation, servedUnits: 10 });
    expect(problems.join(" ")).toMatch(/smaller than the largest single asset/);
  });

  it("catches a scenario with nothing to compare", () => {
    const situation = goodSituation();
    const problems = coherenceProblems({
      ...situation,
      defenses: [situation.defenses[0]!],
    });
    expect(problems.join(" ")).toMatch(/at least two candidate mitigations/i);
  });
});

describe("compileScenario", () => {
  it("compiles a coherent response into a runnable spec", async () => {
    const client = createStubClient({
      rules: [{ match: /compile/i, respond: compiledPayload(goodSituation()) }],
    });

    const result = await compileScenario({
      client,
      library,
      request: "a test system",
    });

    expect(result.situation.id).toBe("test-situation");
    expect(result.compiled.suggestedActors[0]!.profileId).toBe(
      "fixture-opportunist",
    );
    expect(result.repairs).toEqual([]);
  });

  it("feeds coherence problems back and accepts the repair", async () => {
    const broken = goodSituation();
    const summed = broken.assets.reduce((t, a) => t + a.servedUnits, 0);
    let call = 0;

    const client = createStubClient({
      rules: [
        {
          match: () => true,
          respond: () => {
            call++;
            // First answer is incoherent; the repair prompt gets the good one.
            return call === 1
              ? compiledPayload({ ...broken, servedUnits: summed })
              : compiledPayload(broken);
          },
        },
      ],
    });

    const result = await compileScenario({
      client,
      library,
      request: "a test system",
    });

    expect(call).toBe(2);
    expect(result.repairs.join(" ")).toMatch(/double-counts/);
    expect(result.situation.servedUnits).toBe(1000);
  });

  it("rejects a suggested actor the library does not have", async () => {
    const client = createStubClient({
      rules: [
        {
          match: () => true,
          respond: compiledPayload(goodSituation(), "not-a-real-actor"),
        },
      ],
    });

    await expect(
      compileScenario({ client, library, request: "x", maxAttempts: 1 }),
    ).rejects.toThrow(/not in the library/);
  });

  it("gives up with the outstanding problems rather than shipping a broken spec", async () => {
    const broken = goodSituation();
    const client = createStubClient({
      rules: [
        {
          match: () => true,
          respond: compiledPayload({ ...broken, servedUnits: 10 }),
        },
      ],
    });

    await expect(
      compileScenario({ client, library, request: "x", maxAttempts: 2 }),
    ).rejects.toThrow(CompilerError);
  });

  it("passes retrieved evidence into the prompt with its provenance", async () => {
    const client = createStubClient({
      rules: [{ match: () => true, respond: compiledPayload(goodSituation()) }],
    });

    await compileScenario({
      client,
      library,
      request: "a test system",
      evidence: [
        {
          sourceId: "example.gov",
          documentId: "doc-1",
          publishedAt: "2026-01-15",
          credibility: 0.7,
          excerpt: "the system serves roughly 40,000 households",
        },
      ],
    });

    const prompt = client.requests[0]!.prompt;
    expect(prompt).toContain("example.gov");
    expect(prompt).toContain("2026-01-15");
    expect(prompt).toContain("40,000 households");
  });
});
