/**
 * Credential preflight.
 *
 * Answers "which providers actually work right now" with one command, so no
 * session has to re-derive auth state by watching something fail.
 *
 * Network access is required; inside a restricted sandbox Node's fetch may be
 * blocked even where curl is not.
 *
 *   node scripts/preflight.mjs
 */

import "dotenv/config";

const TIMEOUT_MS = 15_000;

async function probe(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    return { status: 0, ok: false, error: error?.message ?? String(error) };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  {
    name: "Anthropic",
    env: "ANTHROPIC_API_KEY",
    required: true,
    note: "analytic agents (framer, panel, red team)",
    async run(key) {
      const r = await probe("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (r.error) return { ok: false, detail: r.error };
      if (r.body?.error) return { ok: false, detail: r.body.error.message };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "Anthropic (OAuth)",
    env: "CLAUDE_CODE_OAUTH_TOKEN",
    required: false,
    note: "Claude Code subscription token; no engine code path uses it",
    async run(key) {
      const r = await probe("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (r.error) return { ok: false, detail: r.error };
      if (r.body?.error) return { ok: false, detail: r.body.error.message ?? "rejected" };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "OpenRouter",
    env: "OPENROUTER_API_KEY",
    required: false,
    note: "unused after the framer rewrite; kept for model-swap comparisons",
    async run(key) {
      const r = await probe("https://openrouter.ai/api/v1/key", {
        headers: { authorization: `Bearer ${key}` },
      });
      if (r.error) return { ok: false, detail: r.error };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "OpenAI",
    env: "OPENAI_API_KEY",
    required: false,
    note: "alternate backend for model-agnosticism metric",
    async run(key) {
      const r = await probe("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${key}` },
      });
      if (r.error) return { ok: false, detail: r.error };
      if (r.body?.error) return { ok: false, detail: r.body.error.message };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "Vercel",
    env: "VERCEL_TOKEN",
    required: false,
    note: "build mode only; unused by simulate mode",
    async run(key) {
      const r = await probe("https://api.vercel.com/v2/user", {
        headers: { authorization: `Bearer ${key}` },
      });
      if (r.error) return { ok: false, detail: r.error };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "BrowserBase",
    env: "BROWSERBASE_API_KEY",
    required: false,
    note: "build mode only; simulate mode needs no browser",
    async run(key) {
      const r = await probe("https://api.browserbase.com/v1/projects", {
        headers: { "x-bb-api-key": key },
      });
      if (r.error) return { ok: false, detail: r.error };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
  {
    name: "GitHub",
    env: "GITHUB_TOKEN",
    required: false,
    note: "build mode only",
    async run(key) {
      const r = await probe("https://api.github.com/user", {
        headers: { authorization: `Bearer ${key}`, "user-agent": "proteus-preflight" },
      });
      if (r.error) return { ok: false, detail: r.error };
      return { ok: r.ok, detail: r.ok ? "valid" : `HTTP ${r.status}` };
    },
  },
];

const results = [];

for (const check of checks) {
  const key = process.env[check.env];
  if (!key) {
    results.push({ ...check, state: "absent", detail: "not set in .env" });
    continue;
  }
  const outcome = await check.run(key);
  results.push({ ...check, state: outcome.ok ? "ok" : "invalid", detail: outcome.detail });
}

const mark = { ok: "PASS", invalid: "FAIL", absent: "----" };
const width = Math.max(...results.map((r) => r.name.length));

console.log("\nPROTEUS credential preflight\n");
for (const r of results) {
  const flag = r.required && r.state !== "ok" ? "  <-- REQUIRED" : "";
  console.log(`  ${mark[r.state]}  ${r.name.padEnd(width)}  ${r.detail}${flag}`);
  console.log(`        ${" ".repeat(width)}  ${r.note}`);
}

const blocking = results.filter((r) => r.required && r.state !== "ok");
console.log(
  blocking.length === 0
    ? "\nAll required credentials valid. Live runs unblocked.\n"
    : `\nBLOCKED: ${blocking.map((r) => r.env).join(", ")} must be valid before any live run.\n`,
);

process.exit(blocking.length === 0 ? 0 : 1);
