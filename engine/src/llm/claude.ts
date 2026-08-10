/**
 * Claude Agent SDK backend.
 *
 * The only file in the analytic layer that imports a vendor SDK. Everything else
 * depends on the LlmClient interface, which is what keeps model-swap cost small
 * and the analytic core testable offline.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { LlmError } from "./client.js";
import type { LlmClient, LlmRequest, LlmResponse, LlmUsage } from "./client.js";

export const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

function readUsage(message: Record<string, unknown>): LlmUsage | undefined {
  const usage = message.usage as Record<string, unknown> | undefined;
  const cost = message.total_cost_usd ?? message.cost_usd;
  if (!usage && typeof cost !== "number") return undefined;
  return {
    inputTokens: Number(usage?.input_tokens ?? 0),
    outputTokens: Number(usage?.output_tokens ?? 0),
    costUsd: typeof cost === "number" ? cost : undefined,
    turns:
      typeof message.num_turns === "number" ? message.num_turns : undefined,
  };
}

export interface ClaudeClientOptions {
  readonly defaultModel?: string;
  readonly defaultMaxTurns?: number;
}

export function createClaudeClient(
  options: ClaudeClientOptions = {},
): LlmClient {
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;
  const defaultMaxTurns = options.defaultMaxTurns ?? 1;

  return {
    name: `claude:${defaultModel}`,

    async complete(request: LlmRequest): Promise<LlmResponse> {
      // The SDK refuses to spawn inside an existing Claude Code session. The
      // eval server already does this; it belongs here so every caller inherits it.
      delete process.env.CLAUDECODE;

      const controller = new AbortController();
      const timeout = request.timeoutMs
        ? setTimeout(() => controller.abort(), request.timeoutMs)
        : undefined;

      let text = "";
      let usage: LlmUsage | undefined;

      try {
        for await (const message of query({
          prompt: request.prompt,
          options: {
            systemPrompt: request.system,
            model: request.model ?? defaultModel,
            allowedTools: [...(request.allowedTools ?? [])],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: request.maxTurns ?? defaultMaxTurns,
            abortController: controller,
          },
        })) {
          const record = message as unknown as Record<string, unknown>;
          if (record.type !== "result") continue;

          if (record.subtype === "success") {
            text = String(record.result ?? "");
            usage = readUsage(record);
          } else {
            throw new LlmError(
              `Claude returned ${String(record.subtype)}: ${String(record.result ?? "")}`,
            );
          }
        }
      } catch (error) {
        if (error instanceof LlmError) throw error;
        throw new LlmError(
          error instanceof Error ? error.message : String(error),
          error,
        );
      } finally {
        if (timeout) clearTimeout(timeout);
      }

      if (text.length === 0)
        throw new LlmError("Claude returned an empty result");
      return { text, usage };
    },
  };
}
