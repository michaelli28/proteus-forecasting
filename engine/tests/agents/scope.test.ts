import { describe, it, expect } from "vitest";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { SCOPE_PREAMBLE, withScope } from "../../src/agents/scope.js";
import { runFramer } from "../../src/agents/framer.js";
import { planPanel, runAdjudicator } from "../../src/agents/panel.js";
import { runRedTeam } from "../../src/agents/red-team.js";
import { createStubClient } from "../../src/llm/stub.js";

const AGENTS_DIR = fileURLToPath(new URL("../../src/agents", import.meta.url));

const hypotheses = [
  { id: "h1", statement: "low", lower: 0, upper: 0.5 },
  { id: "h2", statement: "high", lower: 0.5, upper: 1 },
];

function stub(response: string) {
  return createStubClient({ rules: [{ match: /./, respond: response }] });
}

describe("scope preamble content", () => {
  it("states the agents are synthetic", () => {
    expect(SCOPE_PREAMBLE).toMatch(/No real people, systems or organisations/);
  });
  it("frames the input as instrument output", () => {
    // The content-generation ban is enforced structurally in the kernel (there
    // is no text anywhere in the model to emit), not by asking the prompt
    // nicely. Stating it here measurably caused refusals.
    expect(SCOPE_PREAMBLE).toMatch(/instrument output/);
  });
  it("describes the task positively rather than naming the sensitive topic", () => {
    // Measured: a preamble naming "information operations" / "manipulation"
    // refused 3/3 on prompts this version passes 0/3. The disclaimer read as
    // the topic rather than as reassurance.
    expect(SCOPE_PREAMBLE).toMatch(/forecast a numeric quantity/);
    expect(SCOPE_PREAMBLE).not.toMatch(/influence operation/i);
    expect(SCOPE_PREAMBLE).not.toMatch(/manipulation/i);
    expect(SCOPE_PREAMBLE).not.toMatch(/adversary/i);
    expect(SCOPE_PREAMBLE).not.toMatch(/propaganda/i);
  });
  it("stays short — every added safety bullet measurably raised refusals", () => {
    expect(SCOPE_PREAMBLE.length).toBeLessThan(700);
    expect(SCOPE_PREAMBLE).not.toMatch(/persuasive/i);
    expect(SCOPE_PREAMBLE).not.toMatch(/collection requirement/i);
  });
  it("prefixes rather than replaces the agent's own prompt", () => {
    const combined = withScope("ORIGINAL INSTRUCTIONS");
    expect(combined).toContain(SCOPE_PREAMBLE);
    expect(combined).toContain("ORIGINAL INSTRUCTIONS");
    expect(combined.indexOf(SCOPE_PREAMBLE)).toBeLessThan(combined.indexOf("ORIGINAL"));
  });
});

describe("every analytic agent sends the preamble", () => {
  // A live adjudicator call returned stop_reason: refusal because the prompt
  // never said the population was synthetic. These assert each agent carries it.

  it("framer does", async () => {
    const client = stub(JSON.stringify({
      restatedQuestion: "q",
      hypotheses: [{ id: "h1", statement: "a", lower: 0, upper: 0.5 }, { id: "h2", statement: "b", lower: 0.5, upper: 1 }],
      runSpecs: [{ id: "r1", label: "l", riskTolerance: 50, escalationPropensity: 50, rationale: "x" }],
      partitionRationale: "halves",
    }));
    await runFramer(client, {
      question: "q", quantity: { name: "n", description: "d", min: 0, max: 1, resolveAtTick: 10 },
      hypothesisCount: 2, runCount: 1, asOf: "2026-03-01",
    });
    expect(client.requests[0]!.system).toContain(SCOPE_PREAMBLE);
  });

  it("panel planner does", async () => {
    const client = stub(JSON.stringify({
      scenario: "s",
      adjudicators: [
        { name: "a", technique: "premortem", focus: "f", systemPrompt: "p" },
        { name: "b", technique: "devils_advocate", focus: "f", systemPrompt: "p" },
      ],
      rationale: "r",
    }));
    await planPanel(client, "ctx", 2);
    expect(client.requests[0]!.system).toContain(SCOPE_PREAMBLE);
  });

  it("adjudicator does", async () => {
    const client = stub(JSON.stringify({
      adjudicatorName: "a", technique: "premortem",
      assessments: [{ hypothesisId: "h1", likelihood: "likely", likelihoodPoint: 0.6, drivers: [] }],
      confidence: "low", confidenceReasoning: "r",
      evidenceVerdicts: [], keyAssumptions: [], indicators: [],
    }));
    await runAdjudicator(client, {
      spec: { name: "a", technique: "premortem", focus: "f", systemPrompt: "TECHNIQUE PROMPT" },
      question: "q", asOf: "2026-03-01", hypotheses, ensembleSummary: "s", evidence: [],
    });
    expect(client.requests[0]!.system).toContain(SCOPE_PREAMBLE);
    // The technique prompt must survive alongside it.
    expect(client.requests[0]!.system).toContain("TECHNIQUE PROMPT");
  });

  it("red team does", async () => {
    const client = stub(JSON.stringify({
      challenges: [], strongestCounterCase: "c", demandsRerun: false, rerunRationale: "r",
    }));
    await runRedTeam(client, {
      question: "q", asOf: "2026-03-01", hypotheses, ensembleSummary: "s",
      leadingHypothesisId: "h1", leadingProbability: 0.6, panelReasoning: "p",
    });
    expect(client.requests[0]!.system).toContain(SCOPE_PREAMBLE);
  });
});

describe("no agent calls the model without the preamble", () => {
  it("every completeStructured call site wraps its system prompt", async () => {
    // Static guard: a new agent that forgets withScope would otherwise only be
    // caught by a live refusal, which costs a real call to discover.
    const files = (await readdir(AGENTS_DIR)).filter((f) => f.endsWith(".ts") && f !== "scope.ts");
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(join(AGENTS_DIR, file), "utf-8");
      const systemLines = source.match(/^\s*system:\s*.+$/gm) ?? [];
      for (const line of systemLines) {
        if (!line.includes("withScope")) offenders.push(`${file}: ${line.trim()}`);
      }
    }

    expect(offenders, `system prompts not wrapped in withScope(): ${offenders.join(" | ")}`).toEqual([]);
  });

  it("detects an unwrapped call site", () => {
    // Negative control for the regex above.
    const bad = "      system: rawPrompt,";
    expect(/^\s*system:\s*.+$/m.test(bad) && !bad.includes("withScope")).toBe(true);
  });
});
