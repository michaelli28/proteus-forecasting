/**
 * Test fixtures for the question pipeline.
 *
 * The toy domain exists so the orchestrator's tests prove it is domain-agnostic
 * — the central claim of "one kernel, three adapters" — and so they run in
 * milliseconds instead of the seconds a 400-agent ABM costs.
 */

import { AsOfCorpus } from "../../src/corpus/as-of.js";
import { generateSyntheticCorpus } from "../../src/corpus/synthetic.js";
import { createStubClient } from "../../src/llm/stub.js";
import { LlmRefusalError } from "../../src/llm/client.js";
import type { LlmClient } from "../../src/llm/client.js";
import type { SimEvent, SimulationAdapter } from "../../src/sim/kernel.js";
import type { RunSpec } from "../../src/agents/framer.js";
import type { TargetQuantity } from "../../src/evidence/partition.js";
import type { DomainBinding } from "../../src/pipeline/types.js";

// ─── Toy domain ───

export interface ToyConfig {
  readonly ticks: number;
  readonly drift: number;
  readonly noise: number;
}

export interface ToyState {
  value: number;
  readonly samples: number[];
}

export const toyAdapter: SimulationAdapter<ToyConfig, ToyState> = {
  name: "toy",
  version: "1",
  totalTicks: (config) => config.ticks,
  init: () => ({ value: 0.5, samples: [] }),
  step: (state, tick, config, rng): SimEvent[] => {
    const jitter = rng.uniform(-config.noise, config.noise);
    state.value = Math.min(1, Math.max(0, state.value + config.drift + jitter));
    state.samples.push(state.value);
    return [
      { tick, kind: "truth", data: { level: state.value } },
      { tick, kind: "telemetry", data: { jitter: Math.abs(jitter) } },
    ];
  },
  observe: (state, tick) => ({ tick, level: state.value }),
};

export const TOY_QUANTITY: TargetQuantity = {
  name: "level",
  description: "terminal level of the toy state variable",
  min: 0,
  max: 1,
  resolveAtTick: 19,
};

export const toyBinding: DomainBinding<ToyConfig, ToyState> = {
  adapter: toyAdapter,

  configFor: (spec, quantity) => ({
    ticks: quantity.resolveAtTick + 1,
    drift: (spec.riskTolerance / 100 - 0.5) * 0.04,
    noise: (spec.escalationPropensity / 100) * 0.01,
  }),

  readQuantity: (result, quantity) => {
    const event = result.events.find(
      (e) => e.kind === "truth" && e.tick === quantity.resolveAtTick,
    );
    if (!event)
      throw new Error(`no truth reading at tick ${quantity.resolveAtTick}`);
    return event.data.level as number;
  },

  signatures: (result) => {
    const jitters = result.events
      .filter((e) => e.kind === "telemetry")
      .map((e) => e.data.jitter as number);
    const total = jitters.reduce((sum, j) => sum + j, 0);
    return {
      meanJitter: jitters.length === 0 ? 0 : total / jitters.length,
      peakJitter: jitters.length === 0 ? 0 : Math.max(...jitters),
    };
  },
};

export function toySpec(
  id: string,
  riskTolerance: number,
  escalationPropensity: number,
): RunSpec {
  return {
    id,
    label: `toy ${id}`,
    riskTolerance,
    escalationPropensity,
    rationale: "fixture",
  };
}

// ─── Corpus ───

export const CORPUS_AS_OF = "2026-03-01";

export function testCorpus(asOf = CORPUS_AS_OF): AsOfCorpus {
  const { snapshot } = generateSyntheticCorpus({
    seed: "pipeline-tests",
    documentCount: 24,
    sourceCount: 5,
    startDate: "2026-01-01",
    endDate: "2026-02-20",
    conflictsPerKind: 1,
  });
  return new AsOfCorpus(snapshot, asOf);
}

// ─── Stub LLM ───

/** Bands the stub framer always returns. Partitions [0,1] exactly. */
export const STUB_BANDS = [
  { id: "h1", statement: "level stays low", lower: 0, upper: 0.4 },
  { id: "h2", statement: "level lands in the middle", lower: 0.4, upper: 0.7 },
  { id: "h3", statement: "level runs high", lower: 0.7, upper: 1 },
];

const STUB_FRAMING = JSON.stringify({
  restatedQuestion: "Where does the level land?",
  hypotheses: STUB_BANDS,
  runSpecs: [
    {
      id: "r1",
      label: "cautious",
      riskTolerance: 10,
      escalationPropensity: 20,
      rationale: "low end",
    },
    {
      id: "r2",
      label: "measured",
      riskTolerance: 40,
      escalationPropensity: 40,
      rationale: "middle",
    },
    {
      id: "r3",
      label: "assertive",
      riskTolerance: 70,
      escalationPropensity: 60,
      rationale: "upper middle",
    },
    {
      id: "r4",
      label: "maximal",
      riskTolerance: 95,
      escalationPropensity: 85,
      rationale: "top end",
    },
  ],
  partitionRationale: "Contiguous bands tiling [0,1].",
});

/** Marker planted in the panel plan so the adjudicator rule can match on it. */
export const ADJUDICATOR_MARKER = "STUB-ADJUDICATOR";

const STUB_PANEL = JSON.stringify({
  scenario: "toy level forecast",
  adjudicators: [
    {
      name: "ACH",
      technique: "analysis_of_competing_hypotheses",
      focus: "discriminating readings",
      systemPrompt: `${ADJUDICATOR_MARKER} score readings against every band.`,
    },
    {
      name: "Premortem",
      technique: "premortem",
      focus: "how this forecast fails",
      systemPrompt: `${ADJUDICATOR_MARKER} assume the forecast failed.`,
    },
  ],
  rationale: "Two techniques that fail differently.",
});

function stubAdjudication(): string {
  return JSON.stringify({
    adjudicatorName: "ACH",
    technique: "analysis_of_competing_hypotheses",
    assessments: [
      {
        hypothesisId: "h1",
        likelihood: "unlikely",
        likelihoodPoint: 0.2,
        drivers: ["low drift"],
      },
      {
        hypothesisId: "h2",
        likelihood: "likely",
        likelihoodPoint: 0.5,
        drivers: ["central mass"],
      },
      {
        hypothesisId: "h3",
        likelihood: "unlikely",
        likelihoodPoint: 0.3,
        drivers: [],
      },
    ],
    confidence: "moderate",
    confidenceReasoning: "Readings discriminate but the sample is small.",
    evidenceVerdicts: [],
    keyAssumptions: [
      {
        statement: "The ensemble spans the plausible parameter space.",
        falsifier: "A reading outside every band.",
      },
    ],
    indicators: [
      {
        observable: "jitter above 0.004",
        favorsHypothesis: "h3",
        likelihoodRatio: 2.1,
        instrumentChannel: "meanJitter",
      },
    ],
    dissent: undefined,
  });
}

const STUB_RED_TEAM = JSON.stringify({
  challenges: [
    {
      challenge: "The ensemble may under-sample the upper tail.",
      severity: "low",
      targetHypothesis: "h3",
      remedy: "Add runs at higher risk tolerance.",
    },
  ],
  strongestCounterCase: "A high-risk scenario nobody simulated.",
  demandsRerun: false,
  rerunRationale:
    "Uncertainty alone does not justify burning another ensemble.",
});

const RED_TEAM_DEMANDING_RERUN = JSON.stringify({
  challenges: [
    {
      challenge: "The leading band rests on two runs.",
      severity: "high",
      targetHypothesis: "h2",
      remedy: "Rerun the ensemble under a fresh seed.",
    },
  ],
  strongestCounterCase: "The mode is a sampling artefact.",
  demandsRerun: true,
  rerunRationale: "A fresh ensemble could move the headline band.",
});

/** Six specs that land two per band — the ensemble discriminates nothing. */
const STUB_SPREAD_FRAMING = JSON.stringify({
  restatedQuestion: "Where does the level land?",
  hypotheses: STUB_BANDS,
  runSpecs: [
    {
      id: "s1",
      label: "floor",
      riskTolerance: 5,
      escalationPropensity: 10,
      rationale: "low",
    },
    {
      id: "s2",
      label: "low",
      riskTolerance: 15,
      escalationPropensity: 10,
      rationale: "low",
    },
    {
      id: "s3",
      label: "mid-low",
      riskTolerance: 40,
      escalationPropensity: 10,
      rationale: "middle",
    },
    {
      id: "s4",
      label: "mid",
      riskTolerance: 50,
      escalationPropensity: 10,
      rationale: "middle",
    },
    {
      id: "s5",
      label: "high",
      riskTolerance: 80,
      escalationPropensity: 10,
      rationale: "upper",
    },
    {
      id: "s6",
      label: "ceiling",
      riskTolerance: 95,
      escalationPropensity: 10,
      rationale: "upper",
    },
  ],
  partitionRationale: "Contiguous bands tiling [0,1].",
});

export interface StubBehaviour {
  /** Adjudicators refuse deterministically, as the live model currently does. */
  readonly adjudicatorRefuses?: boolean;
  readonly redTeamDemandsRerun?: boolean;
  readonly framerFails?: boolean;
  /** Frame an ensemble that spreads evenly across the partition. */
  readonly spreadFraming?: boolean;
}

/** A stub wired for the whole pipeline: framer, panel, adjudicators, red team. */
export function pipelineStub(behaviour: StubBehaviour = {}) {
  return createStubClient({
    name: "pipeline-stub",
    rules: [
      {
        match: /framing a forecasting question/,
        respond: () => {
          if (behaviour.framerFails) throw new LlmRefusalError("refusal");
          return behaviour.spreadFraming ? STUB_SPREAD_FRAMING : STUB_FRAMING;
        },
      },
      { match: /design adjudication panels/, respond: STUB_PANEL },
      {
        match: new RegExp(ADJUDICATOR_MARKER),
        respond: () => {
          if (behaviour.adjudicatorRefuses)
            throw new LlmRefusalError("refusal");
          return stubAdjudication();
        },
      },
      {
        match: /red-team analyst/,
        respond: behaviour.redTeamDemandsRerun
          ? RED_TEAM_DEMANDING_RERUN
          : STUB_RED_TEAM,
      },
    ],
  });
}

/** Every prompt text the client was asked to complete. */
export function promptCorpus(
  client: LlmClient & {
    requests: readonly { system: string; prompt: string }[];
  },
): string {
  return client.requests.map((r) => `${r.system}\n${r.prompt}`).join("\n");
}
