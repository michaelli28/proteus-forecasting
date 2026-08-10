import { describe, it, expect, vi } from "vitest";
import { createAnthropicClient, checkCredential, DEFAULT_PRICING } from "../../src/llm/anthropic.js";
import { LlmError } from "../../src/llm/client.js";

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const okBody = {
  content: [{ type: "text", text: '{"a":1}' }],
  usage: { input_tokens: 1000, output_tokens: 500 },
};

describe("createAnthropicClient", () => {
  it("returns text and usage", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okBody));
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const response = await client.complete({ system: "s", prompt: "p" });
    expect(response.text).toBe('{"a":1}');
    expect(response.usage!.inputTokens).toBe(1000);
    expect(response.usage!.outputTokens).toBe(500);
  });

  it("prices the call from the token counts", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okBody));
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const { usage } = await client.complete({ system: "s", prompt: "p" });
    const price = DEFAULT_PRICING["claude-sonnet-4-5-20250929"]!;
    expect(usage!.costUsd).toBeCloseTo((1000 * price.input + 500 * price.output) / 1e6, 10);
  });

  it("fails fast on an invalid key instead of retrying", async () => {
    // The failure that cost a 25s hang: retrying a bad credential turns an
    // instant actionable error into a slow mysterious one.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { type: "authentication_error", message: "API key is invalid." } }, 401),
    );
    const client = createAnthropicClient({ apiKey: "bad", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.complete({ system: "s", prompt: "p" })).rejects.toThrow(/API key is invalid/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not retry a 400", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: "bad request" } }, 400));
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.complete({ system: "s", prompt: "p" })).rejects.toThrow(LlmError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retries a 429 and succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return calls === 1 ? jsonResponse({ error: { message: "rate limited" } }, 429) : jsonResponse(okBody);
    });
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect((await client.complete({ system: "s", prompt: "p" })).text).toBe('{"a":1}');
    expect(calls).toBe(2);
  });

  it("retries a 500 up to the limit then throws", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: "boom" } }, 500));
    const client = createAnthropicClient({ apiKey: "k", maxRetries: 2, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.complete({ system: "s", prompt: "p" })).rejects.toThrow(/after 2 attempts/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws when no key is configured", () => {
    expect(() => createAnthropicClient({ apiKey: "" })).toThrow(/not set/);
  });

  it("rejects an empty completion rather than returning one", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ content: [], stop_reason: "max_tokens" }));
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.complete({ system: "s", prompt: "p" })).rejects.toThrow(/no text/);
  });

  it("sends the system prompt and model", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okBody));
    const client = createAnthropicClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.complete({ system: "SYS", prompt: "P", model: "claude-opus-4-6" });
    const body = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.system).toBe("SYS");
    expect(body.model).toBe("claude-opus-4-6");
    expect(body.messages[0].content).toBe("P");
  });

  it("omits cost for an unpriced model rather than guessing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okBody));
    const client = createAnthropicClient({ apiKey: "k", defaultModel: "future-model", fetchImpl: fetchImpl as unknown as typeof fetch });
    const { usage } = await client.complete({ system: "s", prompt: "p" });
    expect(usage!.costUsd).toBeUndefined();
  });
});

describe("checkCredential", () => {
  it("reports a valid credential", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(okBody));
    expect(await checkCredential("k", fetchImpl as unknown as typeof fetch)).toEqual({ ok: true, detail: "credential valid" });
  });

  it("reports an invalid credential without throwing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: "API key is invalid." } }, 401));
    const result = await checkCredential("bad", fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("invalid");
  });

  it("reports a missing credential", async () => {
    expect((await checkCredential(undefined)).ok).toBe(false);
  });
});
