/**
 * The framer — replaces api/src/ideation.ts.
 *
 * Turns one intelligence question into two things:
 *   1. a MECE partition of the outcome space (what we forecast over)
 *   2. M divergent run specifications (the Monte Carlo ensemble)
 *
 * `risk` and `temperature` keep their wire names from the original ideation
 * payload and gain their documented new semantics here: adversary risk tolerance
 * and escalation propensity. They were always the two knobs a wargame needs.
 *
 * The old module called google/gemma-2-9b-it and was dead code — api/src/task.ts
 * bypassed it entirely with Math.random()-assigned parameters.
 */

import { z } from "zod";
import { completeStructured } from "../llm/structured.js";
import { assertPartition } from "../evidence/partition.js";
import { withScope } from "./scope.js";
import type { LlmClient } from "../llm/client.js";
import type { OutcomeBand, TargetQuantity } from "../evidence/partition.js";

export const OutcomeBandSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  lower: z.number(),
  upper: z.number(),
});

/**
 * One simulation run's parameters.
 *
 * riskTolerance and escalationPropensity are the redefined `risk` and
 * `temperature`: how much downside the actor will accept, and how readily it
 * climbs the escalation ladder.
 */
export const RunSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Adversary appetite for downside, 0–100. Was `risk`. */
  riskTolerance: z.number().min(0).max(100),
  /** Readiness to escalate, 0–100. Was `temperature`. */
  escalationPropensity: z.number().min(0).max(100),
  rationale: z.string().min(1),
});
export type RunSpec = z.infer<typeof RunSpecSchema>;

export const FramingSchema = z.object({
  restatedQuestion: z.string().min(1),
  hypotheses: z.array(OutcomeBandSchema).min(2),
  runSpecs: z.array(RunSpecSchema).min(1),
  /** The model's own account of why the bands are exclusive and exhaustive. */
  partitionRationale: z.string().min(1),
});
export type Framing = z.infer<typeof FramingSchema>;

export interface FramerInput {
  readonly question: string;
  readonly quantity: TargetQuantity;
  readonly hypothesisCount: number;
  readonly runCount: number;
  readonly asOf: string;
  /** Domain background the framer may rely on. Never future information. */
  readonly context?: string;
}

export function buildFramerSystemPrompt(): string {
  return `You are an intelligence analyst framing a forecasting question for a Monte Carlo simulation ensemble.

You produce TWO things.

1. HYPOTHESES — a partition of the outcome space over a single measurable quantity.
   - They MUST tile the full range exactly: no gaps, no overlaps.
   - The lowest band starts at the quantity's minimum; the highest ends at its maximum.
   - Each band's "statement" is what an analyst would say if that band occurred.
   - Do NOT write hypotheses as free-text propositions. They are numeric bands.

2. RUN SPECS — divergent scenarios to simulate. Each carries two adversary parameters:
   - riskTolerance (0-100): how much downside this actor will accept.
   - escalationPropensity (0-100): how readily it climbs the escalation ladder.
   Span the plausible space. Runs that all look alike waste the ensemble; a run
   nobody would defend as plausible wastes it too.

Output ONLY valid JSON:
{
  "restatedQuestion": "string",
  "hypotheses": [{ "id": "h1", "statement": "string", "lower": number, "upper": number }],
  "runSpecs": [{ "id": "r1", "label": "string", "riskTolerance": number, "escalationPropensity": number, "rationale": "string" }],
  "partitionRationale": "string"
}`;
}

export function buildFramerPrompt(input: FramerInput): string {
  const { quantity } = input;
  return `QUESTION: ${input.question}

INFORMATION CUTOFF: ${input.asOf}. Reason only from what was knowable on or before this date.

TARGET QUANTITY
  name:  ${quantity.name}
  means: ${quantity.description}
  range: ${quantity.min} to ${quantity.max}
  read at simulation tick ${quantity.resolveAtTick}

Produce exactly ${input.hypothesisCount} hypothesis bands partitioning [${quantity.min}, ${quantity.max}], and exactly ${input.runCount} run specs.
${input.context ? `\nBACKGROUND\n${input.context}` : ""}

Output ONLY the JSON object.`;
}

export interface FramingResult {
  readonly framing: Framing;
  readonly hypotheses: readonly OutcomeBand[];
  readonly attempts: number;
}

/**
 * Frame a question.
 *
 * The partition is validated structurally after the model returns. A model that
 * produces overlapping or gappy bands has produced hypotheses whose
 * probabilities cannot sum to 1, so this throws rather than repairing silently —
 * a quietly patched partition would make every downstream Brier score wrong in a
 * way nothing else would surface.
 */
export async function runFramer(
  client: LlmClient,
  input: FramerInput,
): Promise<FramingResult> {
  const { value, attempts } = await completeStructured(
    client,
    {
      system: withScope(buildFramerSystemPrompt()),
      prompt: buildFramerPrompt(input),
      maxTurns: 1,
    },
    { schema: FramingSchema },
  );

  assertPartition(value.hypotheses, input.quantity);

  const ids = new Set(value.runSpecs.map((r) => r.id));
  if (ids.size !== value.runSpecs.length) {
    throw new Error("run spec ids must be unique");
  }

  return { framing: value, hypotheses: value.hypotheses, attempts };
}

/** Spread of the ensemble's parameters. Near-zero means wasted runs. */
export function runSpecDiversity(specs: readonly RunSpec[]): number {
  if (specs.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const dr = specs[i]!.riskTolerance - specs[j]!.riskTolerance;
      const de =
        specs[i]!.escalationPropensity - specs[j]!.escalationPropensity;
      total += Math.sqrt(dr * dr + de * de);
      pairs++;
    }
  }
  // Normalized by the diagonal of the 100×100 parameter square.
  return total / pairs / Math.sqrt(2 * 100 * 100);
}
