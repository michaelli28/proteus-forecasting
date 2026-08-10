/**
 * Deterministic stub backend.
 *
 * Lets the whole analytic pipeline be exercised end to end with no network call
 * and no API key, so the orchestration logic has real tests rather than
 * integration-only coverage. Results from a stub run are labelled as such and
 * must never be reported as accuracy.
 */

import { LlmError } from "./client.js";
import type { LlmClient, LlmRequest, LlmResponse } from "./client.js";

export interface StubRule {
  /** Matched against the concatenated system + prompt text. */
  readonly match: RegExp | ((request: LlmRequest) => boolean);
  readonly respond: string | ((request: LlmRequest) => string);
}

export interface StubOptions {
  readonly rules: readonly StubRule[];
  /** Used when no rule matches. Omit to make an unmatched request throw. */
  readonly fallback?: string;
  readonly name?: string;
}

export interface StubLlmClient extends LlmClient {
  readonly requests: readonly LlmRequest[];
  reset(): void;
}

function matches(rule: StubRule, request: LlmRequest): boolean {
  if (typeof rule.match === "function") return rule.match(request);
  return rule.match.test(`${request.system}\n${request.prompt}`);
}

/**
 * A stub that throws on an unmatched request rather than returning something
 * plausible. Silent fallbacks turn a broken prompt into a passing test.
 */
export function createStubClient(options: StubOptions): StubLlmClient {
  const requests: LlmRequest[] = [];

  return {
    name: options.name ?? "stub",
    requests,
    reset() {
      requests.length = 0;
    },
    async complete(request: LlmRequest): Promise<LlmResponse> {
      requests.push(request);
      const rule = options.rules.find((r) => matches(r, request));

      if (!rule) {
        if (options.fallback !== undefined) {
          return { text: options.fallback, usage: stubUsage(options.fallback) };
        }
        throw new LlmError(
          `stub has no rule for request: ${request.prompt.slice(0, 120)}…`,
        );
      }

      const text =
        typeof rule.respond === "function"
          ? rule.respond(request)
          : rule.respond;
      return { text, usage: stubUsage(text) };
    },
  };
}

/** Token counts approximated from length so cost plumbing is exercised too. */
function stubUsage(text: string) {
  return {
    inputTokens: 100,
    outputTokens: Math.ceil(text.length / 4),
    costUsd: 0,
    turns: 1,
  };
}

/** A client that always fails, for testing degradation paths. */
export function createFailingClient(
  message = "simulated backend failure",
): LlmClient {
  return {
    name: "failing-stub",
    async complete(): Promise<LlmResponse> {
      throw new LlmError(message);
    },
  };
}

/** A client that fails `failures` times, then succeeds. For retry tests. */
export function createFlakyClient(
  failures: number,
  response: string,
): LlmClient {
  let remaining = failures;
  return {
    name: "flaky-stub",
    async complete(): Promise<LlmResponse> {
      if (remaining > 0) {
        remaining--;
        throw new LlmError("transient failure");
      }
      return { text: response, usage: stubUsage(response) };
    },
  };
}
