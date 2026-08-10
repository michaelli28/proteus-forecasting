import { describe, it, expect } from "vitest";
import { runFramer, runSpecDiversity } from "../../src/agents/framer.js";
import {
  planPanel,
  runAdjudicator,
  normalizeAssessments,
  SAT_TECHNIQUES,
} from "../../src/agents/panel.js";
import {
  runRedTeam,
  redTeamConfidencePenalty,
} from "../../src/agents/red-team.js";
import { createStubClient } from "../../src/llm/stub.js";
import {
  campaignFromRunSpec,
  configFromRunSpec,
  MAPPING_BOUNDS,
} from "../../src/sim/adapters/influence-ops/mapping.js";
import {
  validateConfig,
  DEFAULT_CONFIG,
} from "../../src/sim/adapters/influence-ops/config.js";
import type { FramerInput } from "../../src/agents/framer.js";
import type {
  AdjudicationInput,
  AdjudicationResult,
} from "../../src/agents/panel.js";
import type { OutcomeBand } from "../../src/evidence/partition.js";

const quantity = {
  name: "adoption_rate",
  description: "share of the population above the adoption threshold",
  min: 0,
  max: 1,
  resolveAtTick: 120,
};

const framerInput: FramerInput = {
  question: "How far will the narrative spread?",
  quantity,
  hypothesisCount: 3,
  runCount: 4,
  asOf: "2026-03-01",
};

const goodFraming = JSON.stringify({
  restatedQuestion: "How far will the narrative spread by tick 120?",
  hypotheses: [
    { id: "h1", statement: "contained", lower: 0, upper: 0.33 },
    { id: "h2", statement: "partial spread", lower: 0.33, upper: 0.66 },
    { id: "h3", statement: "widespread", lower: 0.66, upper: 1 },
  ],
  runSpecs: [
    {
      id: "r1",
      label: "cautious",
      riskTolerance: 20,
      escalationPropensity: 15,
      rationale: "probing",
    },
    {
      id: "r2",
      label: "moderate",
      riskTolerance: 50,
      escalationPropensity: 45,
      rationale: "standard",
    },
    {
      id: "r3",
      label: "aggressive",
      riskTolerance: 80,
      escalationPropensity: 75,
      rationale: "committed",
    },
    {
      id: "r4",
      label: "reckless",
      riskTolerance: 95,
      escalationPropensity: 90,
      rationale: "all-in",
    },
  ],
  partitionRationale:
    "Thirds of the adoption range, exhaustive and non-overlapping.",
});

function framerStub(response: string) {
  return createStubClient({ rules: [{ match: /./, respond: response }] });
}

describe("framer", () => {
  it("returns a validated framing", async () => {
    const result = await runFramer(framerStub(goodFraming), framerInput);
    expect(result.hypotheses).toHaveLength(3);
    expect(result.framing.runSpecs).toHaveLength(4);
    expect(result.attempts).toBe(1);
  });

  it("rejects an overlapping partition instead of repairing it", async () => {
    // A quietly patched partition makes every downstream Brier score wrong in a
    // way nothing else would surface.
    const overlapping = JSON.parse(goodFraming);
    overlapping.hypotheses[1].lower = 0.2;
    await expect(
      runFramer(framerStub(JSON.stringify(overlapping)), framerInput),
    ).rejects.toThrow(/overlap/);
  });

  it("rejects a partition with a gap", async () => {
    const gapped = JSON.parse(goodFraming);
    gapped.hypotheses[1].lower = 0.4;
    await expect(
      runFramer(framerStub(JSON.stringify(gapped)), framerInput),
    ).rejects.toThrow(/gap/);
  });

  it("rejects a partition that does not cover the range", async () => {
    const short = JSON.parse(goodFraming);
    short.hypotheses[2].upper = 0.9;
    await expect(
      runFramer(framerStub(JSON.stringify(short)), framerInput),
    ).rejects.toThrow(/ends at/);
  });

  it("rejects duplicate run spec ids", async () => {
    const duplicated = JSON.parse(goodFraming);
    duplicated.runSpecs[1].id = "r1";
    await expect(
      runFramer(framerStub(JSON.stringify(duplicated)), framerInput),
    ).rejects.toThrow(/unique/);
  });

  it("rejects parameters outside 0-100", async () => {
    const invalid = JSON.parse(goodFraming);
    invalid.runSpecs[0].riskTolerance = 150;
    await expect(
      runFramer(framerStub(JSON.stringify(invalid)), framerInput),
    ).rejects.toThrow();
  });

  it("puts the cutoff and the range in the prompt", async () => {
    const client = framerStub(goodFraming);
    await runFramer(client, framerInput);
    const prompt = client.requests[0]!.prompt;
    expect(prompt).toContain("2026-03-01");
    expect(prompt).toContain("adoption_rate");
    expect(prompt).toContain("tick 120");
  });
});

describe("runSpecDiversity", () => {
  it("is near zero for a clustered ensemble", () => {
    const clustered = Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`,
      label: "x",
      riskTolerance: 50 + i,
      escalationPropensity: 50,
      rationale: "y",
    }));
    expect(runSpecDiversity(clustered)).toBeLessThan(0.05);
  });

  it("rises with spread", () => {
    const spread = [
      {
        id: "a",
        label: "x",
        riskTolerance: 0,
        escalationPropensity: 0,
        rationale: "y",
      },
      {
        id: "b",
        label: "x",
        riskTolerance: 100,
        escalationPropensity: 100,
        rationale: "y",
      },
    ];
    expect(runSpecDiversity(spread)).toBeGreaterThan(0.5);
  });

  it("is zero for a single run", () => {
    expect(
      runSpecDiversity([
        {
          id: "a",
          label: "x",
          riskTolerance: 50,
          escalationPropensity: 50,
          rationale: "y",
        },
      ]),
    ).toBe(0);
  });
});

describe("run spec → simulation config mapping", () => {
  it("maps risk tolerance to reach and extremity", () => {
    const timid = campaignFromRunSpec(
      { riskTolerance: 0, escalationPropensity: 50 },
      120,
    );
    const bold = campaignFromRunSpec(
      { riskTolerance: 100, escalationPropensity: 50 },
      120,
    );
    expect(bold.injectionNodes).toBeGreaterThan(timid.injectionNodes);
    expect(bold.targetPosition).toBeGreaterThan(timid.targetPosition);
  });

  it("maps escalation propensity to amplification and timing", () => {
    const patient = campaignFromRunSpec(
      { riskTolerance: 50, escalationPropensity: 0 },
      120,
    );
    const hasty = campaignFromRunSpec(
      { riskTolerance: 50, escalationPropensity: 100 },
      120,
    );
    expect(hasty.amplification).toBeGreaterThan(patient.amplification);
    expect(hasty.startTick).toBeLessThan(patient.startTick);
  });

  it("switches to coordinated above the documented threshold", () => {
    expect(
      campaignFromRunSpec({ riskTolerance: 50, escalationPropensity: 49 }, 120)
        .coordinated,
    ).toBe(false);
    expect(
      campaignFromRunSpec({ riskTolerance: 50, escalationPropensity: 50 }, 120)
        .coordinated,
    ).toBe(true);
  });

  it("stays inside the documented bounds at the extremes", () => {
    for (const risk of [0, 50, 100]) {
      for (const escalation of [0, 50, 100]) {
        const c = campaignFromRunSpec(
          { riskTolerance: risk, escalationPropensity: escalation },
          120,
        );
        expect(c.injectionNodes).toBeGreaterThanOrEqual(
          MAPPING_BOUNDS.injectionNodes[0],
        );
        expect(c.injectionNodes).toBeLessThanOrEqual(
          MAPPING_BOUNDS.injectionNodes[1],
        );
        expect(c.targetPosition).toBeGreaterThanOrEqual(
          MAPPING_BOUNDS.targetPosition[0],
        );
        expect(c.targetPosition).toBeLessThanOrEqual(
          MAPPING_BOUNDS.targetPosition[1],
        );
      }
    }
  });

  it("produces a config the simulator accepts", () => {
    for (const risk of [0, 25, 50, 75, 100]) {
      const config = configFromRunSpec({
        riskTolerance: risk,
        escalationPropensity: risk,
      });
      expect(() => validateConfig(config)).not.toThrow();
    }
  });

  it("is deterministic", () => {
    const a = campaignFromRunSpec(
      { riskTolerance: 37, escalationPropensity: 61 },
      DEFAULT_CONFIG.ticks,
    );
    const b = campaignFromRunSpec(
      { riskTolerance: 37, escalationPropensity: 61 },
      DEFAULT_CONFIG.ticks,
    );
    expect(b).toEqual(a);
  });
});

describe("panel planner", () => {
  const plan = JSON.stringify({
    scenario: "influence operation forecast",
    adjudicators: [
      {
        name: "ach",
        technique: "analysis_of_competing_hypotheses",
        focus: "evidence",
        systemPrompt: "prompt",
      },
      {
        name: "kac",
        technique: "key_assumptions_check",
        focus: "assumptions",
        systemPrompt: "prompt",
      },
    ],
    rationale: "complementary failure modes",
  });

  it("returns a validated panel", async () => {
    const result = await planPanel(
      createStubClient({ rules: [{ match: /./, respond: plan }] }),
      "ctx",
      2,
    );
    expect(result.adjudicators).toHaveLength(2);
    expect(SAT_TECHNIQUES).toContain(result.adjudicators[0]!.technique);
  });

  it("rejects an unknown technique", async () => {
    const bad = JSON.parse(plan);
    bad.adjudicators[0].technique = "vibes";
    await expect(
      planPanel(
        createStubClient({
          rules: [{ match: /./, respond: JSON.stringify(bad) }],
        }),
        "ctx",
        2,
      ),
    ).rejects.toThrow();
  });

  it("rejects a single-member panel", async () => {
    const bad = JSON.parse(plan);
    bad.adjudicators = [bad.adjudicators[0]];
    await expect(
      planPanel(
        createStubClient({
          rules: [{ match: /./, respond: JSON.stringify(bad) }],
        }),
        "ctx",
        2,
      ),
    ).rejects.toThrow();
  });
});

describe("adjudicator", () => {
  const hypotheses: OutcomeBand[] = [
    { id: "h1", statement: "contained", lower: 0, upper: 0.5 },
    { id: "h2", statement: "widespread", lower: 0.5, upper: 1 },
  ];

  const input: AdjudicationInput = {
    spec: {
      name: "ach",
      technique: "analysis_of_competing_hypotheses",
      focus: "evidence",
      systemPrompt: "You run ACH.",
    },
    question: "How far will it spread?",
    asOf: "2026-03-01",
    hypotheses,
    ensembleSummary: "8 runs, adoption 0.31–0.62",
    evidence: [
      {
        id: "e1",
        summary: "telemetry burst",
        publishedAt: "2026-02-01",
        sourceId: "s1",
      },
    ],
  };

  const result = JSON.stringify({
    adjudicatorName: "ach",
    technique: "analysis_of_competing_hypotheses",
    assessments: [
      {
        hypothesisId: "h1",
        likelihood: "likely",
        likelihoodPoint: 0.6,
        drivers: ["low reach"],
      },
      {
        hypothesisId: "h2",
        likelihood: "unlikely",
        likelihoodPoint: 0.4,
        drivers: [],
      },
    ],
    confidence: "low",
    confidenceReasoning: "thin evidence base",
    evidenceVerdicts: [
      {
        evidenceId: "e1",
        hypothesisId: "h2",
        verdict: "consistent",
        reasoning: "burst suggests spread",
      },
    ],
    keyAssumptions: [
      {
        statement: "network topology is stable",
        falsifier: "observed rewiring",
      },
    ],
    indicators: [
      {
        observable: "cross-cluster synchrony",
        favorsHypothesis: "h2",
        likelihoodRatio: 3.2,
        instrumentChannel: "partition_transfer",
      },
    ],
  });

  it("returns a validated adjudication", async () => {
    const value = await runAdjudicator(
      createStubClient({ rules: [{ match: /./, respond: result }] }),
      input,
    );
    expect(value.assessments).toHaveLength(2);
    expect(value.confidence).toBe("low");
  });

  it("keeps likelihood and confidence independent", async () => {
    // "Likely, low confidence" must survive the round trip intact.
    const value = await runAdjudicator(
      createStubClient({ rules: [{ match: /./, respond: result }] }),
      input,
    );
    expect(value.assessments[0]!.likelihood).toBe("likely");
    expect(value.confidence).toBe("low");
  });

  it("rejects an assessment of an unknown hypothesis", async () => {
    const bad = JSON.parse(result);
    bad.assessments[0].hypothesisId = "h99";
    await expect(
      runAdjudicator(
        createStubClient({
          rules: [{ match: /./, respond: JSON.stringify(bad) }],
        }),
        input,
      ),
    ).rejects.toThrow(/unknown hypotheses/);
  });

  it("rejects an invalid ICD 203 band", async () => {
    const bad = JSON.parse(result);
    bad.assessments[0].likelihood = "pretty sure";
    await expect(
      runAdjudicator(
        createStubClient({
          rules: [{ match: /./, respond: JSON.stringify(bad) }],
        }),
        input,
      ),
    ).rejects.toThrow();
  });

  it("instructs the model not to couple the two axes", async () => {
    const client = createStubClient({
      rules: [{ match: /./, respond: result }],
    });
    await runAdjudicator(client, input);
    const prompt = client.requests[0]!.prompt;
    expect(prompt).toContain("SEPARATE field");
    expect(prompt).toContain(
      "do not raise confidence because a likelihood is high",
    );
  });

  it("passes the cutoff to the adjudicator", async () => {
    const client = createStubClient({
      rules: [{ match: /./, respond: result }],
    });
    await runAdjudicator(client, input);
    expect(client.requests[0]!.prompt).toContain("2026-03-01");
  });
});

describe("normalizeAssessments", () => {
  function withPoints(...points: number[]): AdjudicationResult {
    return {
      adjudicatorName: "a",
      technique: "premortem",
      assessments: points.map((p, i) => ({
        hypothesisId: `h${i + 1}`,
        likelihood: "roughly_even" as const,
        likelihoodPoint: p,
        drivers: [],
      })),
      confidence: "moderate",
      confidenceReasoning: "",
      evidenceVerdicts: [],
      keyAssumptions: [],
      indicators: [],
    };
  }

  it("renormalizes probabilities that do not sum to 1", () => {
    // Models routinely return 0.95 or 1.08; the partition is exhaustive so this
    // is safe, and leaving it would corrupt every Brier score downstream.
    const normalized = normalizeAssessments(withPoints(0.5, 0.45));
    expect([...normalized.values()].reduce((s, v) => s + v, 0)).toBeCloseTo(
      1,
      10,
    );
    expect(normalized.get("h1")!).toBeCloseTo(0.5 / 0.95, 10);
  });

  it("leaves an already-normalized set alone", () => {
    const normalized = normalizeAssessments(withPoints(0.3, 0.7));
    expect(normalized.get("h1")!).toBeCloseTo(0.3, 10);
  });

  it("falls back to uniform when everything is zero", () => {
    const normalized = normalizeAssessments(withPoints(0, 0));
    expect(normalized.get("h1")!).toBeCloseTo(0.5, 10);
  });
});

describe("red team", () => {
  const input = {
    question: "How far will it spread?",
    asOf: "2026-03-01",
    hypotheses: [
      { id: "h1", statement: "contained", lower: 0, upper: 0.5 },
      { id: "h2", statement: "widespread", lower: 0.5, upper: 1 },
    ],
    ensembleSummary: "8 runs",
    leadingHypothesisId: "h1",
    leadingProbability: 0.72,
    panelReasoning: "reach is limited",
  };

  const demanding = JSON.stringify({
    challenges: [
      {
        challenge: "tail underweighted",
        severity: "high",
        targetHypothesis: "h2",
        remedy: "rerun with wider reach",
      },
    ],
    strongestCounterCase:
      "the ensemble never sampled high-reach coordinated campaigns",
    demandsRerun: true,
    rerunRationale: "the unsampled region could flip the leader",
  });

  const content = JSON.stringify({
    challenges: [{ challenge: "minor", severity: "low", remedy: "note it" }],
    strongestCounterCase: "nothing decisive",
    demandsRerun: false,
    rerunRationale: "uncertainty is adequately reported through confidence",
  });

  it("can force a rerun when budget remains", async () => {
    const outcome = await runRedTeam(
      createStubClient({ rules: [{ match: /./, respond: demanding }] }),
      input,
      { rerunBudget: 1, rerunsUsed: 0 },
    );
    expect(outcome.forcesRerun).toBe(true);
    expect(outcome.budgetExhausted).toBe(false);
  });

  it("cannot force a rerun once budget is spent", async () => {
    // Bounded so a red team and an ensemble cannot loop forever.
    const outcome = await runRedTeam(
      createStubClient({ rules: [{ match: /./, respond: demanding }] }),
      input,
      { rerunBudget: 1, rerunsUsed: 1 },
    );
    expect(outcome.forcesRerun).toBe(false);
    expect(outcome.budgetExhausted).toBe(true);
  });

  it("does not force a rerun when it did not demand one", async () => {
    const outcome = await runRedTeam(
      createStubClient({ rules: [{ match: /./, respond: content }] }),
      input,
      { rerunBudget: 1, rerunsUsed: 0 },
    );
    expect(outcome.forcesRerun).toBe(false);
    expect(outcome.budgetExhausted).toBe(false);
  });

  it("emits no likelihood of its own", async () => {
    // An agent that both argues against the answer and helps produce it is
    // hedging, not adversarial.
    const outcome = await runRedTeam(
      createStubClient({ rules: [{ match: /./, respond: content }] }),
      input,
    );
    expect(outcome.verdict).not.toHaveProperty("assessments");
    expect(outcome.verdict).not.toHaveProperty("likelihood");
  });

  it("shows the red team the position it is attacking", async () => {
    const client = createStubClient({
      rules: [{ match: /./, respond: content }],
    });
    await runRedTeam(client, input);
    const prompt = client.requests[0]!.prompt;
    expect(prompt).toContain("h1");
    expect(prompt).toContain("72.0%");
  });
});

describe("redTeamConfidencePenalty", () => {
  it("is zero with no challenges", () => {
    expect(
      redTeamConfidencePenalty({
        challenges: [],
        strongestCounterCase: "",
        demandsRerun: false,
        rerunRationale: "",
      }),
    ).toBe(0);
  });

  it("weights severity", () => {
    const penalty = (severity: "low" | "moderate" | "high") =>
      redTeamConfidencePenalty({
        challenges: [{ challenge: "c", severity, remedy: "r" }],
        strongestCounterCase: "",
        demandsRerun: false,
        rerunRationale: "",
      });
    expect(penalty("high")).toBeGreaterThan(penalty("moderate"));
    expect(penalty("moderate")).toBeGreaterThan(penalty("low"));
  });

  it("caps at 1", () => {
    const many = Array.from({ length: 20 }, () => ({
      challenge: "c",
      severity: "high" as const,
      remedy: "r",
    }));
    expect(
      redTeamConfidencePenalty({
        challenges: many,
        strongestCounterCase: "",
        demandsRerun: false,
        rerunRationale: "",
      }),
    ).toBe(1);
  });
});
