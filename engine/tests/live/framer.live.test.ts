import { describe, it, expect } from "vitest";
import "dotenv/config";
import { createAnthropicClient } from "../../src/llm/anthropic.js";
import { runFramer, runSpecDiversity } from "../../src/agents/framer.js";
import { runAdjudicator } from "../../src/agents/panel.js";
import { assertPartition } from "../../src/evidence/partition.js";
import { UsageLedger, LlmRefusalError } from "../../src/llm/client.js";
import type { FramerInput } from "../../src/agents/framer.js";

/**
 * LIVE tests — real Anthropic API calls, real cost.
 *
 * Skipped unless PROTEUS_LIVE=1, so the default suite stays offline, free and
 * fast. Anything these assert is evidence class (c): live against a real model.
 * Everything else in the repo is (a) units with mocks or (b) local e2e on stubs,
 * and the distinction is never blurred in reporting.
 *
 *   PROTEUS_LIVE=1 npx vitest run tests/live
 */

const LIVE = process.env.PROTEUS_LIVE === "1";
const suite = LIVE ? describe : describe.skip;

const quantity = {
  name: "adoption_rate",
  description:
    "fraction of model agents whose belief coordinate exceeds the adoption threshold",
  min: 0,
  max: 1,
  resolveAtTick: 120,
};

const framerInput: FramerInput = {
  question:
    "In a 400-agent bounded-confidence diffusion model with 4 belief clusters, what terminal value will state variable X reach by step 120?",
  quantity,
  hypothesisCount: 4,
  runCount: 5,
  asOf: "2026-03-01",
  context:
    "Agents update a numeric belief coordinate by bounded-confidence peer averaging plus a homophilous source term. A subset of seed nodes is held at a fixed coordinate and given extra weight in their neighbours' averaging.",
};

suite("live framer", () => {
  const ledger = new UsageLedger();

  it("produces a structurally valid partition from a real model", async () => {
    const client = ledger.instrument(createAnthropicClient(), "framer");
    const result = await runFramer(client, framerInput);

    // runFramer already asserts this; repeated here so a failure names the
    // partition rather than surfacing as a generic agent error.
    expect(() => assertPartition(result.hypotheses, quantity)).not.toThrow();

    expect(result.hypotheses).toHaveLength(4);
    expect(result.framing.runSpecs).toHaveLength(5);

    for (const spec of result.framing.runSpecs) {
      expect(spec.riskTolerance).toBeGreaterThanOrEqual(0);
      expect(spec.riskTolerance).toBeLessThanOrEqual(100);
      expect(spec.escalationPropensity).toBeGreaterThanOrEqual(0);
      expect(spec.escalationPropensity).toBeLessThanOrEqual(100);
    }

    const diversity = runSpecDiversity(result.framing.runSpecs);
    console.log(
      `[live] framer: ${result.attempts} attempt(s), diversity ${diversity.toFixed(3)}, cost $${ledger.totalCostUsd.toFixed(4)}`,
    );
    console.log(
      `[live] bands: ${result.hypotheses.map((h) => `${h.id}[${h.lower.toFixed(2)},${h.upper.toFixed(2)})`).join(" ")}`,
    );
    console.log(
      `[live] runs: ${result.framing.runSpecs.map((r) => `${r.label}(r${r.riskTolerance}/e${r.escalationPropensity})`).join(" ")}`,
    );

    // An ensemble whose members all sit on top of each other wastes the fan-out.
    expect(diversity).toBeGreaterThan(0.05);
  }, 180_000);

  it(
    "MEASURES the adjudicator refusal rate (does not assert success)",
    async () => {
      // The adjudication prompt sits on a model decision boundary: it is
      // refused often enough that asserting success would be asserting luck.
      // Measured contributors, each on identical repeated prompts:
      //   structured reporting instructions   0/3 -> 3/3 once added
      //   dated observation block             3/3 either wording
      //   "name the collection source"        1/3
      // Neutral instrument vocabulary reduced but did not eliminate it.
      // Recording the rate is the honest artifact; the pipeline must degrade
      // gracefully when an adjudicator abstains, which is what the ensemble
      // confidence path is for.
      const client = ledger.instrument(createAnthropicClient(), "adjudicator");
      const hypotheses = [
        { id: "h1", statement: "X below 0.25", lower: 0, upper: 0.25 },
        { id: "h2", statement: "X between 0.25 and 0.60", lower: 0.25, upper: 0.6 },
        { id: "h3", statement: "X above 0.60", lower: 0.6, upper: 1 },
      ];

      const attempts = 5;
      let refused = 0;
      let succeeded = 0;
      let sample: string | null = null;

      for (let i = 0; i < attempts; i++) {
        try {
          const result = await runAdjudicator(client, {
            spec: {
              name: "ach_adjudicator",
              technique: "analysis_of_competing_hypotheses",
              focus: "diagnostic readings",
              systemPrompt:
                "You apply Analysis of Competing Hypotheses to model output. Weight readings that DISCRIMINATE between hypotheses far above readings merely consistent with all of them.",
            },
            question:
              "In a 400-agent bounded-confidence diffusion model with 4 belief clusters, what terminal value will state variable X reach by step 120?",
            asOf: "2026-03-01",
            hypotheses,
            ensembleSummary:
              "5 independent runs. Terminal values of X: 0.31, 0.38, 0.44, 0.52, 0.61. Mean 0.452, spread 0.30.",
            evidence: [
              {
                id: "e1",
                summary: "Interaction volume concentrated on high-degree nodes of the graph.",
                publishedAt: "2026-02-10",
                sourceId: "degree_distribution",
              },
              {
                id: "e2",
                summary: "Transfer between graph partitions remained low across the window.",
                publishedAt: "2026-02-18",
                sourceId: "partition_transfer",
              },
            ],
          });
          succeeded++;
          if (!sample) {
            sample = result.assessments
              .map((a) => `${a.hypothesisId}=${a.likelihood}/${a.likelihoodPoint.toFixed(2)}`)
              .join(" ");
            const total = result.assessments.reduce((s, a) => s + a.likelihoodPoint, 0);
            console.log(`[live] adjudicator sample: ${sample} | confidence=${result.confidence}`);
            console.log(`[live] probabilities sum to ${total.toFixed(3)}`);
            console.log(`[live] indicators returned: ${result.indicators.length}`);
          }
        } catch (error) {
          if (error instanceof LlmRefusalError) refused++;
          else throw error;
        }
      }

      console.log(
        `[live] ADJUDICATOR REFUSAL RATE: ${refused}/${attempts} (${((refused / attempts) * 100).toFixed(0)}%), ${succeeded} succeeded`,
      );
      console.log(`[live] total measured cost: $${ledger.totalCostUsd.toFixed(4)}`);

      // Asserts only that the failure mode is CLASSIFIED correctly, which is
      // what the pipeline depends on. It does not assert the model complied.
      expect(refused + succeeded).toBe(attempts);
    },
    300_000,
  );
});
