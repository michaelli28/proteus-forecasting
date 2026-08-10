import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { extractJson, completeStructured } from "../../src/llm/structured.js";
import {
  createStubClient,
  createFailingClient,
  createFlakyClient,
} from "../../src/llm/stub.js";
import { LlmError, UsageLedger } from "../../src/llm/client.js";

const Schema = z.object({ name: z.string(), count: z.number() });

function clientReturning(...responses: string[]) {
  let index = 0;
  return {
    name: "sequenced",
    async complete() {
      const text = responses[Math.min(index, responses.length - 1)]!;
      index++;
      return {
        text,
        usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.001 },
      };
    },
  };
}

describe("extractJson", () => {
  it("parses a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a bare array", () => {
    expect(extractJson("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("parses a fenced block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses a fenced block with no language tag", () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips surrounding prose", () => {
    expect(
      extractJson('Here is my answer:\n{"a":1}\nHope that helps!'),
    ).toEqual({ a: 1 });
  });

  it("takes the outermost object when prose contains an example", () => {
    const text = 'Analysis follows.\n{"outer":{"inner":2},"a":1}\ndone';
    expect(extractJson(text)).toEqual({ outer: { inner: 2 }, a: 1 });
  });

  it("throws on unparseable output rather than returning a default", () => {
    expect(() => extractJson("I cannot answer that.")).toThrow(LlmError);
  });
});

describe("completeStructured", () => {
  it("returns a validated value on the first attempt", async () => {
    const client = clientReturning('{"name":"x","count":2}');
    const result = await completeStructured(
      client,
      { system: "s", prompt: "p" },
      { schema: Schema },
    );
    expect(result.value).toEqual({ name: "x", count: 2 });
    expect(result.attempts).toBe(1);
  });

  it("retries with the validation error fed back", async () => {
    const client = clientReturning('{"name":"x"}', '{"name":"x","count":3}');
    const onRetry = vi.fn();
    const result = await completeStructured(
      client,
      { system: "s", prompt: "p" },
      { schema: Schema, onRetry },
    );
    expect(result.value.count).toBe(3);
    expect(result.attempts).toBe(2);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry.mock.calls[0]![1]).toContain("count");
  });

  it("includes the failure reason in the repair prompt", async () => {
    const seen: string[] = [];
    const client = {
      name: "capture",
      async complete(request: { prompt: string }) {
        seen.push(request.prompt);
        return { text: seen.length === 1 ? "{}" : '{"name":"x","count":1}' };
      },
    };
    await completeStructured(
      client,
      { system: "s", prompt: "original" },
      { schema: Schema },
    );
    expect(seen[0]).toBe("original");
    expect(seen[1]).toContain("could not be used");
    expect(seen[1]).toContain("name");
  });

  it("retries unparseable output", async () => {
    const client = clientReturning(
      "sorry, no JSON here",
      '{"name":"y","count":1}',
    );
    const result = await completeStructured(
      client,
      { system: "s", prompt: "p" },
      { schema: Schema },
    );
    expect(result.value.name).toBe("y");
    expect(result.attempts).toBe(2);
  });

  it("throws after exhausting attempts rather than defaulting", async () => {
    // A silently defaulted analytic judgement is worse than none — it looks real
    // to everything downstream.
    const client = clientReturning('{"wrong":true}');
    await expect(
      completeStructured(
        client,
        { system: "s", prompt: "p" },
        { schema: Schema, maxAttempts: 2 },
      ),
    ).rejects.toThrow(/failed after 2 attempts/);
  });

  it("honors a custom attempt budget", async () => {
    const onRetry = vi.fn();
    const client = clientReturning("{}");
    await expect(
      completeStructured(
        client,
        { system: "s", prompt: "p" },
        { schema: Schema, maxAttempts: 4, onRetry },
      ),
    ).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(4);
  });

  it("accumulates usage across attempts", async () => {
    const client = clientReturning("{}", '{"name":"x","count":1}');
    const result = await completeStructured(
      client,
      { system: "s", prompt: "p" },
      { schema: Schema },
    );
    expect(result.usage).toHaveLength(2);
  });

  it("surfaces a backend outage rather than burning the whole budget on it", async () => {
    await expect(
      completeStructured(
        createFailingClient("backend down"),
        { system: "s", prompt: "p" },
        { schema: Schema, maxAttempts: 2 },
      ),
    ).rejects.toThrow(/backend down/);
  });

  it("recovers from a transient backend failure", async () => {
    const client = createFlakyClient(1, '{"name":"z","count":9}');
    const result = await completeStructured(
      client,
      { system: "s", prompt: "p" },
      { schema: Schema, maxAttempts: 3 },
    );
    expect(result.value.name).toBe("z");
  });
});

describe("stub client", () => {
  it("dispatches by rule", async () => {
    const client = createStubClient({
      rules: [
        { match: /framer/i, respond: "framed" },
        { match: /panel/i, respond: "planned" },
      ],
    });
    expect(
      (await client.complete({ system: "framer", prompt: "x" })).text,
    ).toBe("framed");
    expect((await client.complete({ system: "panel", prompt: "y" })).text).toBe(
      "planned",
    );
  });

  it("records requests for assertion", async () => {
    const client = createStubClient({ rules: [], fallback: "ok" });
    await client.complete({ system: "s", prompt: "p" });
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]!.prompt).toBe("p");
  });

  it("throws on an unmatched request when no fallback is set", async () => {
    // A silent plausible fallback turns a broken prompt into a passing test.
    const client = createStubClient({ rules: [] });
    await expect(client.complete({ system: "s", prompt: "p" })).rejects.toThrow(
      /no rule/,
    );
  });
});

describe("UsageLedger", () => {
  it("totals cost and tokens", () => {
    const ledger = new UsageLedger();
    ledger.record("framer", {
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    });
    ledger.record("panel", {
      inputTokens: 200,
      outputTokens: 80,
      costUsd: 0.02,
    });
    expect(ledger.totalCostUsd).toBeCloseTo(0.03, 10);
    expect(ledger.totalInputTokens).toBe(300);
    expect(ledger.totalOutputTokens).toBe(130);
    expect(ledger.callCount).toBe(2);
  });

  it("attributes cost per stage", () => {
    const ledger = new UsageLedger();
    ledger.record("panel", { inputTokens: 1, outputTokens: 1, costUsd: 0.01 });
    ledger.record("panel", { inputTokens: 1, outputTokens: 1, costUsd: 0.02 });
    expect(ledger.byLabel().panel).toEqual({ costUsd: 0.03, calls: 2 });
  });

  it("ignores calls that reported no usage", () => {
    const ledger = new UsageLedger();
    ledger.record("x", undefined);
    expect(ledger.callCount).toBe(0);
  });

  it("instruments a client transparently", async () => {
    const ledger = new UsageLedger();
    const wrapped = ledger.instrument(clientReturning('{"a":1}'), "framer");
    const response = await wrapped.complete({ system: "s", prompt: "p" });
    expect(response.text).toBe('{"a":1}');
    expect(ledger.byLabel().framer!.calls).toBe(1);
  });
});
