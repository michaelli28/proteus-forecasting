/**
 * Schema-validated completion with repair retries.
 *
 * Replaces three near-identical ad-hoc JSON extractors that had drifted apart in
 * agents/planner.ts, agents/research.ts and agents/judge.ts — each with slightly
 * different fence handling and failure behaviour. One extractor, one retry
 * policy, one place to fix a parsing bug.
 */

import type { ZodType } from "zod";
import { LlmError, LlmRefusalError } from "./client.js";
import type { LlmClient, LlmRequest, LlmUsage } from "./client.js";

export interface StructuredOptions<T> {
  readonly schema: ZodType<T>;
  /** Total attempts including the first. */
  readonly maxAttempts?: number;
  /** Called with each failure, for progress reporting. */
  readonly onRetry?: (attempt: number, reason: string) => void;
}

export interface StructuredResult<T> {
  readonly value: T;
  readonly attempts: number;
  readonly usage: readonly LlmUsage[];
}

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Pull a JSON value out of model output.
 *
 * Handles a bare object, a fenced block, and prose wrapped around either. Prefers
 * the outermost braces/brackets because nested JSON inside an explanation is
 * usually an example, not the answer.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];

  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }

  candidates.push(text.trim());

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  throw new LlmError(`no parseable JSON in response: ${text.slice(0, 200)}…`);
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Complete, parse and validate — retrying with the parse error fed back.
 *
 * Throws rather than returning a partial or defaulted object: a silently
 * defaulted analytic judgement is worse than no judgement, because it looks like
 * a real one downstream.
 */
export async function completeStructured<T>(
  client: LlmClient,
  request: LlmRequest,
  options: StructuredOptions<T>,
): Promise<StructuredResult<T>> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const usage: LlmUsage[] = [];
  let lastReason = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt =
      attempt === 1
        ? request.prompt
        : `${request.prompt}\n\nYour previous response could not be used: ${lastReason}\nReturn ONLY valid JSON matching the schema. No prose, no code fences.`;

    try {
      const response = await client.complete({ ...request, prompt });
      if (response.usage) usage.push(response.usage);

      const parsed = options.schema.safeParse(extractJson(response.text));
      if (parsed.success)
        return { value: parsed.data, attempts: attempt, usage };

      lastReason = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (error) {
      // A refusal is deterministic for a given prompt — measured 10/10 on
      // identical input. Re-sending with a repair note spends budget to get the
      // same answer, so it propagates instead.
      if (error instanceof LlmRefusalError) throw error;
      lastReason = describeFailure(error);
      // A backend failure is not a schema problem; retrying with a repair
      // prompt would just burn another call on the same outage.
      if (error instanceof LlmError && !/no parseable JSON/.test(lastReason)) {
        if (attempt === maxAttempts) throw error;
      }
    }

    options.onRetry?.(attempt, lastReason);
  }

  throw new LlmError(
    `structured completion failed after ${maxAttempts} attempts: ${lastReason}`,
  );
}
