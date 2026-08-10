/**
 * Anthropic Messages API backend.
 *
 * Preferred over the Agent SDK for analytic agents. They are single-turn
 * structured-output calls with no tools, no file access and no agent loop — the
 * SDK's subprocess buys nothing here and costs a great deal:
 *
 *   - An invalid API key surfaces from this client in ~160ms. The SDK spawns a
 *     CLI that reports system/init, swallows the auth failure, and hangs
 *     indefinitely. A forecasting system that hangs instead of failing is worse
 *     than one that fails, because a stalled ensemble looks like a slow one.
 *   - No subprocess, so no CLI binary, config directory or IPC pipe to go wrong.
 *
 * The Agent SDK backend stays for agents that genuinely need tools (the research
 * agent uses WebSearch). Both satisfy LlmClient, which is the point of the seam.
 *
 * Uses fetch directly rather than adding @anthropic-ai/sdk as a dependency.
 */

import { LlmError, LlmRefusalError } from "./client.js";
import type { LlmClient, LlmRequest, LlmResponse, LlmUsage } from "./client.js";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

/** USD per million tokens. Override via options when prices change. */
export const DEFAULT_PRICING: Readonly<
  Record<string, { input: number; output: number }>
> = {
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricing: Readonly<Record<string, { input: number; output: number }>>,
): number | undefined {
  const price = pricing[model];
  if (!price) return undefined;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

interface MessagesResponse {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
  stop_reason?: string;
}

export interface AnthropicClientOptions {
  readonly apiKey?: string;
  readonly defaultModel?: string;
  readonly maxTokens?: number;
  readonly maxRetries?: number;
  readonly pricing?: Readonly<
    Record<string, { input: number; output: number }>
  >;
  /** Injectable for tests. Defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

/** HTTP statuses worth retrying. An auth failure is not one of them. */
function isRetryable(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

export function createAnthropicClient(
  options: AnthropicClientOptions = {},
): LlmClient {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const defaultModel = options.defaultModel ?? DEFAULT_ANTHROPIC_MODEL;
  const maxTokens = options.maxTokens ?? 8192;
  const maxRetries = options.maxRetries ?? 3;
  const pricing = options.pricing ?? DEFAULT_PRICING;
  const doFetch = options.fetchImpl ?? fetch;

  if (!apiKey) {
    throw new LlmError("ANTHROPIC_API_KEY is not set");
  }

  return {
    name: `anthropic:${defaultModel}`,

    async complete(request: LlmRequest): Promise<LlmResponse> {
      const model = request.model ?? defaultModel;
      let lastError = "";

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = request.timeoutMs
          ? setTimeout(() => controller.abort(), request.timeoutMs)
          : undefined;

        try {
          const response = await doFetch(MESSAGES_URL, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": API_VERSION,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: maxTokens,
              system: request.system,
              messages: [{ role: "user", content: request.prompt }],
            }),
            signal: controller.signal,
          });

          const body = (await response.json()) as MessagesResponse;

          if (!response.ok || body.error) {
            const message = body.error?.message ?? `HTTP ${response.status}`;
            // Fail fast on auth and request errors — retrying a bad key just
            // turns an instant, actionable error into a slow mysterious one.
            if (!isRetryable(response.status)) {
              throw new LlmError(
                `Anthropic API error (${response.status}): ${message}`,
              );
            }
            lastError = message;
            if (attempt === maxRetries) {
              throw new LlmError(
                `Anthropic API error after ${maxRetries} attempts: ${message}`,
              );
            }
            await new Promise((resolve) =>
              setTimeout(resolve, 2 ** attempt * 250),
            );
            continue;
          }

          const text = (body.content ?? [])
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("");

          if (body.stop_reason === "refusal") {
            throw new LlmRefusalError(body.stop_reason);
          }

          if (text.length === 0) {
            throw new LlmError(
              `Anthropic returned no text (stop_reason: ${body.stop_reason})`,
            );
          }

          const inputTokens = body.usage?.input_tokens ?? 0;
          const outputTokens = body.usage?.output_tokens ?? 0;
          const usage: LlmUsage = {
            inputTokens,
            outputTokens,
            costUsd: estimateCost(model, inputTokens, outputTokens, pricing),
            turns: 1,
          };

          return { text, usage };
        } catch (error) {
          if (error instanceof LlmError) throw error;
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt === maxRetries) {
            throw new LlmError(`Anthropic request failed: ${lastError}`, error);
          }
          await new Promise((resolve) =>
            setTimeout(resolve, 2 ** attempt * 250),
          );
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }

      throw new LlmError(`Anthropic request failed: ${lastError}`);
    },
  };
}

/**
 * Check a credential without spending a real call.
 * Returns a plain result rather than throwing, so callers can report status.
 */
export async function checkCredential(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; detail: string }> {
  if (!apiKey) return { ok: false, detail: "no API key provided" };
  try {
    const response = await fetchImpl(MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const body = (await response.json()) as MessagesResponse;
    if (body.error)
      return { ok: false, detail: body.error.message ?? "unknown error" };
    return {
      ok: response.ok,
      detail: response.ok ? "credential valid" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
