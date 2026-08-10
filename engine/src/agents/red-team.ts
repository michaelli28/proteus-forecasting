/**
 * The red team — the one adjudicator with standing to force a rerun.
 *
 * Its only job is to argue the ensemble is wrong. It is deliberately not scored
 * alongside the panel and does not contribute a likelihood: an agent that both
 * argues against the answer and helps produce it is not adversarial, it is
 * hedging.
 *
 * A forced rerun produces a DISTINCT artifact, so the provenance chain records
 * the challenge, the rerun, and whether the judgement actually moved.
 */

import { z } from "zod";
import { completeStructured } from "../llm/structured.js";
import { withScope } from "./scope.js";
import type { LlmClient } from "../llm/client.js";
import type { OutcomeBand } from "../evidence/partition.js";

export const CHALLENGE_SEVERITIES = ["low", "moderate", "high"] as const;

export const RedTeamChallengeSchema = z.object({
  challenge: z.string().min(1),
  severity: z.enum(CHALLENGE_SEVERITIES),
  targetHypothesis: z.string().optional(),
  /** What would have to be collected or rerun to settle it. */
  remedy: z.string().min(1),
});

export const RedTeamVerdictSchema = z.object({
  challenges: z.array(RedTeamChallengeSchema).default([]),
  /** The strongest case that the ensemble's leading answer is wrong. */
  strongestCounterCase: z.string().min(1),
  /** Set true only when a rerun could plausibly change the headline judgement. */
  demandsRerun: z.boolean(),
  rerunRationale: z.string().min(1),
});
export type RedTeamVerdict = z.infer<typeof RedTeamVerdictSchema>;

export const RED_TEAM_SYSTEM_PROMPT = `You are a red-team analyst. Your only job is to argue that the ensemble's judgement is WRONG.

You do not produce a forecast and you do not hedge. You attack:
- Hypotheses the ensemble underweighted, especially low-probability high-impact ones.
- Assumptions the ensemble treated as settled.
- Evidence the ensemble read as diagnostic that is actually consistent with everything.
- Structural blind spots: what the ensemble could not see, and how that biases it.
- Correlated reasoning: places every adjudicator made the same mistake.

Demand a rerun ONLY when a rerun could plausibly change the headline judgement — not
merely because uncertainty exists. Uncertainty is reported through confidence, not through
burning another ensemble. An unjustified rerun demand costs real budget and trains the
system to ignore you.

Output ONLY valid JSON:
{
  "challenges": [{ "challenge": "string", "severity": "low|moderate|high", "targetHypothesis": "string or omit", "remedy": "string" }],
  "strongestCounterCase": "string",
  "demandsRerun": boolean,
  "rerunRationale": "string"
}`;

export interface RedTeamInput {
  readonly question: string;
  readonly asOf: string;
  readonly hypotheses: readonly OutcomeBand[];
  readonly ensembleSummary: string;
  /** The panel's aggregated position, as the red team sees it. */
  readonly leadingHypothesisId: string;
  readonly leadingProbability: number;
  readonly panelReasoning: string;
}

export function buildRedTeamPrompt(input: RedTeamInput): string {
  const hypotheses = input.hypotheses
    .map((h) => `  ${h.id}: ${h.statement}  [${h.lower}, ${h.upper})`)
    .join("\n");

  return `QUESTION: ${input.question}

INFORMATION CUTOFF: ${input.asOf}.

HYPOTHESES
${hypotheses}

THE ENSEMBLE'S POSITION
  leading: ${input.leadingHypothesisId} at ${(input.leadingProbability * 100).toFixed(1)}%
  reasoning: ${input.panelReasoning}

SIMULATION ENSEMBLE (observable summary)
${input.ensembleSummary}

Attack this judgement. Output ONLY the JSON object.`;
}

export interface RedTeamOptions {
  /** Max reruns this run may trigger. Bounded so a loop cannot form. */
  readonly rerunBudget: number;
  /** Reruns already spent. */
  readonly rerunsUsed: number;
}

export interface RedTeamOutcome {
  readonly verdict: RedTeamVerdict;
  /** True only when the red team demanded a rerun AND budget remains. */
  readonly forcesRerun: boolean;
  readonly budgetExhausted: boolean;
}

export async function runRedTeam(
  client: LlmClient,
  input: RedTeamInput,
  options: RedTeamOptions = { rerunBudget: 1, rerunsUsed: 0 },
): Promise<RedTeamOutcome> {
  const { value } = await completeStructured(
    client,
    {
      system: withScope(RED_TEAM_SYSTEM_PROMPT),
      prompt: buildRedTeamPrompt(input),
      maxTurns: 1,
    },
    { schema: RedTeamVerdictSchema },
  );

  const budgetExhausted = options.rerunsUsed >= options.rerunBudget;
  return {
    verdict: value,
    forcesRerun: value.demandsRerun && !budgetExhausted,
    budgetExhausted: value.demandsRerun && budgetExhausted,
  };
}

/**
 * Confidence penalty from unanswered red-team challenges.
 *
 * A high-severity challenge that survived to the final product is a reason to
 * report lower confidence, not a reason to suppress the challenge.
 */
export function redTeamConfidencePenalty(verdict: RedTeamVerdict): number {
  const weights = { low: 0.05, moderate: 0.15, high: 0.35 } as const;
  const total = verdict.challenges.reduce(
    (sum, c) => sum + weights[c.severity],
    0,
  );
  return Math.min(1, total);
}
