/**
 * The adjudication panel — redefines agents/planner.ts and agents/judge.ts.
 *
 * Where the old system auto-designed a panel of judge personas, this designs a
 * panel of structured analytic techniques. The distinction matters: a persona
 * panel produces correlated opinions dressed as independent ones, while ACH, a
 * key-assumptions check, a devil's advocate and a premortem fail in genuinely
 * different directions.
 *
 * Adjudicators emit likelihood and confidence as separate fields and never a
 * combined score.
 */

import { z } from "zod";
import { completeStructured } from "../llm/structured.js";
import { CONFIDENCE_LEVELS, LIKELIHOOD_BANDS } from "../evidence/icd203.js";
import { ACH_VERDICTS } from "../evidence/types.js";
import { withScope } from "./scope.js";
import type { LlmClient } from "../llm/client.js";
import type { OutcomeBand } from "../evidence/partition.js";

/** The techniques the panel can be composed from. */
export const SAT_TECHNIQUES = [
  "analysis_of_competing_hypotheses",
  "key_assumptions_check",
  "devils_advocate",
  "premortem",
  "red_team",
] as const;
export type SatTechnique = (typeof SAT_TECHNIQUES)[number];

export const AdjudicatorSpecSchema = z.object({
  name: z.string().min(1),
  technique: z.enum(SAT_TECHNIQUES),
  focus: z.string().min(1),
  systemPrompt: z.string().min(1),
});
export type AdjudicatorSpec = z.infer<typeof AdjudicatorSpecSchema>;

export const PanelPlanSchema = z.object({
  scenario: z.string().min(1),
  adjudicators: z.array(AdjudicatorSpecSchema).min(2),
  rationale: z.string().min(1),
});
export type PanelPlan = z.infer<typeof PanelPlanSchema>;

export function buildPanelPlannerSystemPrompt(count: number): string {
  return `You design adjudication panels of structured analytic techniques for intelligence forecasting.

Available techniques:
- analysis_of_competing_hypotheses: score evidence against every hypothesis; weight evidence that DISCRIMINATES far above evidence merely consistent with all of them.
- key_assumptions_check: surface what the judgement rests on, and what would falsify each assumption.
- devils_advocate: argue the leading hypothesis is wrong.
- premortem: assume the forecast failed badly; explain how.
- red_team: adopt the adversary's perspective and objectives.

Design exactly ${count} adjudicators with distinct, non-overlapping techniques and focuses.
Each systemPrompt must be detailed: the technique's procedure, what this adjudicator looks
for, and how it decides. Do not create two adjudicators that would reason the same way.

Output ONLY valid JSON:
{
  "scenario": "string",
  "adjudicators": [{ "name": "string", "technique": "one of the above", "focus": "string", "systemPrompt": "string" }],
  "rationale": "string"
}`;
}

export async function planPanel(
  client: LlmClient,
  contextDocument: string,
  count = 4,
): Promise<PanelPlan> {
  const { value } = await completeStructured(
    client,
    {
      system: withScope(buildPanelPlannerSystemPrompt(count)),
      prompt: `Evaluation context:\n\n---\n${contextDocument}\n---\n\nDesign the adjudication panel. Output ONLY valid JSON.`,
      maxTurns: 1,
    },
    { schema: PanelPlanSchema },
  );
  return value;
}

// ─── Adjudicator output ───

export const EvidenceVerdictSchema = z.object({
  evidenceId: z.string().min(1),
  hypothesisId: z.string().min(1),
  verdict: z.enum(ACH_VERDICTS),
  reasoning: z.string().min(1),
});

export const HypothesisAssessmentSchema = z.object({
  hypothesisId: z.string().min(1),
  /** ICD 203 band. Never combined with confidence. */
  likelihood: z.enum(LIKELIHOOD_BANDS),
  /** Point estimate, for scoring only. */
  likelihoodPoint: z.number().min(0).max(1),
  drivers: z.array(z.string()).default([]),
});

export const AdjudicationResultSchema = z.object({
  adjudicatorName: z.string().min(1),
  technique: z.enum(SAT_TECHNIQUES),
  assessments: z.array(HypothesisAssessmentSchema).min(1),
  /** Separate axis. A mean over these is never taken. */
  confidence: z.enum(CONFIDENCE_LEVELS),
  confidenceReasoning: z.string().min(1),
  evidenceVerdicts: z.array(EvidenceVerdictSchema).default([]),
  keyAssumptions: z
    .array(
      z.object({
        statement: z.string().min(1),
        falsifier: z.string().min(1),
      }),
    )
    .default([]),
  indicators: z
    .array(
      z.object({
        observable: z.string().min(1),
        favorsHypothesis: z.string().min(1),
        likelihoodRatio: z.number().positive(),
        instrumentChannel: z.string().min(1),
      }),
    )
    .default([]),
  dissent: z.string().optional(),
});
export type AdjudicationResult = z.infer<typeof AdjudicationResultSchema>;

export interface AdjudicationInput {
  readonly spec: AdjudicatorSpec;
  readonly question: string;
  readonly asOf: string;
  readonly hypotheses: readonly OutcomeBand[];
  /** Restricted view of the ensemble — never the full simulation state. */
  readonly ensembleSummary: string;
  readonly evidence: readonly {
    id: string;
    summary: string;
    publishedAt: string;
    sourceId: string;
  }[];
}

export function buildAdjudicationPrompt(input: AdjudicationInput): string {
  const hypotheses = input.hypotheses
    .map((h) => `  ${h.id}: ${h.statement}  [${h.lower}, ${h.upper})`)
    .join("\n");

  const evidence =
    input.evidence.length > 0
      ? input.evidence
          .map(
            (e) =>
              `  ${e.id} (instrument: ${e.sourceId}, logged ${e.publishedAt}): ${e.summary}`,
          )
          .join("\n")
      : "  (no readings retrieved)";

  return `QUESTION: ${input.question}

INFORMATION CUTOFF: ${input.asOf}. Any reasoning that depends on information after this date is invalid.

HYPOTHESES (mutually exclusive and exhaustive)
${hypotheses}

MODEL ENSEMBLE (observable summary only)
${input.ensembleSummary}

INSTRUMENT READINGS (from the model's own diagnostic output)
${evidence}

Apply your technique. Then report:
- A likelihood for EVERY hypothesis. Point estimates must sum to approximately 1.
- Your confidence as a SEPARATE field. "likely" with "low" confidence is a valid and
  common answer — do not raise confidence because a likelihood is high, or lower a
  likelihood because confidence is low. They measure different things.
- Where you scored a reading against hypotheses, report those verdicts.
- Any key assumption you relied on, each with what reading would falsify it.
- Any model-observable that would discriminate between hypotheses, and which of the
  simulation's instrument channels would register it.

Output ONLY valid JSON matching this structure:
{
  "adjudicatorName": "${input.spec.name}",
  "technique": "${input.spec.technique}",
  "assessments": [{ "hypothesisId": "string", "likelihood": "ICD203 band", "likelihoodPoint": number, "drivers": ["string"] }],
  "confidence": "low" | "moderate" | "high",
  "confidenceReasoning": "string",
  "evidenceVerdicts": [{ "evidenceId": "string", "hypothesisId": "string", "verdict": "consistent|inconsistent|not_applicable", "reasoning": "string" }],
  "keyAssumptions": [{ "statement": "string", "falsifier": "string" }],
  "indicators": [{ "observable": "string", "favorsHypothesis": "string", "likelihoodRatio": number, "instrumentChannel": "string" }],
  "dissent": "string or omit"
}`;
}

export async function runAdjudicator(
  client: LlmClient,
  input: AdjudicationInput,
): Promise<AdjudicationResult> {
  const { value } = await completeStructured(
    client,
    {
      system: withScope(input.spec.systemPrompt),
      prompt: buildAdjudicationPrompt(input),
      maxTurns: 1,
    },
    { schema: AdjudicationResultSchema },
  );

  const known = new Set(input.hypotheses.map((h) => h.id));
  const unknown = value.assessments.filter((a) => !known.has(a.hypothesisId));
  if (unknown.length > 0) {
    throw new Error(
      `adjudicator ${value.adjudicatorName} assessed unknown hypotheses: ${unknown.map((a) => a.hypothesisId).join(", ")}`,
    );
  }

  return value;
}

/**
 * Renormalize an adjudicator's point estimates to sum to 1.
 *
 * Models routinely return probabilities summing to 0.95 or 1.08. Renormalizing
 * is safe because the partition is exhaustive by construction; leaving them
 * unnormalized would quietly corrupt every Brier score downstream.
 */
export function normalizeAssessments(
  result: AdjudicationResult,
): Map<string, number> {
  const total = result.assessments.reduce(
    (sum, a) => sum + a.likelihoodPoint,
    0,
  );
  const out = new Map<string, number>();
  if (total <= 0) {
    const uniform = 1 / result.assessments.length;
    for (const a of result.assessments) out.set(a.hypothesisId, uniform);
    return out;
  }
  for (const a of result.assessments)
    out.set(a.hypothesisId, a.likelihoodPoint / total);
  return out;
}
