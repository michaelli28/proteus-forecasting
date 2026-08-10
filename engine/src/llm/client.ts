/**
 * Model-agnostic completion seam.
 *
 * Generalizes the existing `agent: "claude" | "codex"` field into an interface,
 * so model-swap cost is a measurable quantity rather than a claim. Every analytic
 * agent depends on this interface and none of them imports a vendor SDK
 * directly — which is also what makes the whole analytic layer testable without
 * a network call.
 */

export interface LlmRequest {
  readonly system: string;
  readonly prompt: string;
  readonly model?: string;
  readonly maxTurns?: number;
  readonly allowedTools?: readonly string[];
  readonly timeoutMs?: number;
}

export interface LlmUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Vendor-reported cost when available. Feeds the cost-per-insight metric. */
  readonly costUsd?: number;
  readonly turns?: number;
}

export interface LlmResponse {
  readonly text: string;
  readonly usage?: LlmUsage;
}

export interface LlmClient {
  /** Identifies the backend in artifacts, so a run records which model produced it. */
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

/** Raised when a backend fails after its own retries. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * The model declined to answer.
 *
 * Distinguished from a transient failure because it is DETERMINISTIC: measured
 * 10/10 on an identical prompt. Retrying the same text just spends the budget
 * again, so callers must either vary the prompt or record the adjudicator as
 * abstained and let ensemble confidence drop.
 */
export class LlmRefusalError extends LlmError {
  constructor(readonly stopReason: string) {
    super(`model declined to answer (stop_reason: ${stopReason})`);
    this.name = "LlmRefusalError";
  }
}

/** Accumulates spend across a run. */
export class UsageLedger {
  private entries: { label: string; usage: LlmUsage }[] = [];

  record(label: string, usage: LlmUsage | undefined): void {
    if (usage) this.entries.push({ label, usage });
  }

  get totalCostUsd(): number {
    return this.entries.reduce((sum, e) => sum + (e.usage.costUsd ?? 0), 0);
  }

  get totalInputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.usage.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.usage.outputTokens, 0);
  }

  get callCount(): number {
    return this.entries.length;
  }

  /** Per-label breakdown, for attributing cost to analytic stages. */
  byLabel(): Record<string, { costUsd: number; calls: number }> {
    const out: Record<string, { costUsd: number; calls: number }> = {};
    for (const entry of this.entries) {
      const current = out[entry.label] ?? { costUsd: 0, calls: 0 };
      current.costUsd += entry.usage.costUsd ?? 0;
      current.calls += 1;
      out[entry.label] = current;
    }
    return out;
  }

  /** Wrap a client so every call it makes lands in this ledger. */
  instrument(client: LlmClient, label: string): LlmClient {
    return {
      name: client.name,
      complete: async (request) => {
        const response = await client.complete(request);
        this.record(label, response.usage);
        return response;
      },
    };
  }
}
