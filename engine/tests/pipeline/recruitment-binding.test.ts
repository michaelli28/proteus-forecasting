/**
 * The recruitment binding, and the seam it is the real test of.
 *
 * The architecture memo claims "one kernel, many domains". Until this domain
 * existed that claim had been exercised only by a toy test domain with no
 * simulation in it, which cannot fail in any interesting way. These tests drive
 * the ACTUAL orchestrator over the recruitment world end to end.
 */

import { describe, it, expect } from "vitest";
import { runQuestion } from "../../src/pipeline/run-question.js";
import {
  createRecruitmentBinding,
  recruitmentQuantity,
  isRecruitmentMeasure,
  RECRUITMENT_MEASURES,
  RECRUITMENT_MEASURE_BOUNDS,
  recruitmentCampaignFromRunSpec,
  recruitmentConfigFromRunSpec,
} from "../../src/pipeline/recruitment-binding.js";
import { DEFAULT_CONFIG } from "../../src/sim/adapters/recruitment/index.js";
import { runSimulation } from "../../src/sim/kernel.js";
import { ArtifactStore } from "../../src/artifact/store.js";
import { AsOfCorpus } from "../../src/corpus/as-of.js";
import { generateSyntheticCorpus } from "../../src/corpus/synthetic.js";
import { createFailingClient } from "../../src/llm/stub.js";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("recruitmentQuantity", () => {
  it("names every measure it accepts", () => {
    for (const measure of RECRUITMENT_MEASURES) {
      expect(isRecruitmentMeasure(measure)).toBe(true);
      const q = recruitmentQuantity(measure, 10);
      expect(q.name).toBe(measure);
      expect(q.description.length).toBeGreaterThan(0);
    }
    expect(isRecruitmentMeasure("meanBelief")).toBe(false);
  });

  it("keeps every measure a fraction, so two workforce sizes stay comparable", () => {
    for (const measure of RECRUITMENT_MEASURES) {
      expect(RECRUITMENT_MEASURE_BOUNDS[measure]).toEqual([0, 1]);
    }
  });

  it("refuses a range outside the measure's definitional bounds", () => {
    expect(() => recruitmentQuantity("taskedCleared", 10, [0, 2])).toThrow(
      /definitional/,
    );
    expect(() => recruitmentQuantity("taskedCleared", 10, [0.5, 0.5])).toThrow(
      /empty range/,
    );
    expect(() => recruitmentQuantity("taskedCleared", -1)).toThrow(
      /resolveAtTick/,
    );
  });
});

describe("the run-spec mapping", () => {
  it("reads risk as reach and escalation as speed", () => {
    const timid = recruitmentCampaignFromRunSpec(
      { riskTolerance: 0, escalationPropensity: 0 },
      180,
    );
    const bold = recruitmentCampaignFromRunSpec(
      { riskTolerance: 100, escalationPropensity: 100 },
      180,
    );

    expect(bold.accounts).toBeGreaterThan(timid.accounts);
    expect(bold.paymentK).toBeGreaterThan(timid.paymentK);
    expect(bold.selectivity).toBeGreaterThan(timid.selectivity);
    expect(bold.escalationRate).toBeGreaterThan(timid.escalationRate);
    // A more escalation-prone actor moves sooner, on newer accounts.
    expect(bold.startTick).toBeLessThan(timid.startTick);
    expect(bold.accountAgeDays).toBeLessThan(timid.accountAgeDays);
  });

  it("only coordinates above the documented threshold", () => {
    expect(
      recruitmentCampaignFromRunSpec(
        { riskTolerance: 50, escalationPropensity: 49 },
        180,
      ).coordinated,
    ).toBe(false);
    expect(
      recruitmentCampaignFromRunSpec(
        { riskTolerance: 50, escalationPropensity: 50 },
        180,
      ).coordinated,
    ).toBe(true);
  });

  it("never fields a campaign that ends before it starts", () => {
    for (const escalation of [0, 25, 50, 75, 100]) {
      const c = recruitmentCampaignFromRunSpec(
        { riskTolerance: 50, escalationPropensity: escalation },
        12,
      );
      expect(c.startTick).toBeLessThan(c.endTick);
    }
  });

  it("carries the base world's defence through unchanged", () => {
    const defended = {
      ...DEFAULT_CONFIG,
      defense: {
        kind: "awareness_training" as const,
        startTick: 5,
        intensity: 0.5,
        coverage: 0.5,
        costPerTick: 1,
      },
    };
    const config = recruitmentConfigFromRunSpec(
      { riskTolerance: 50, escalationPropensity: 50 },
      defended,
    );
    expect(config.defense).toEqual(defended.defense);
  });
});

describe("the binding's two halves cannot reach each other", () => {
  const smallWorld = {
    ...DEFAULT_CONFIG,
    ticks: 60,
    workforce: { ...DEFAULT_CONFIG.workforce, people: 300, organizations: 4 },
  };
  // Rebuilt against the small world so readQuantity's denominator matches.
  const binding = createRecruitmentBinding(smallWorld);

  it("resolves the quantity from ground truth and the signature from telemetry", async () => {
    const spec = {
      id: "s1",
      label: "s1",
      riskTolerance: 70,
      escalationPropensity: 70,
      rationale: "test",
    };
    const quantity = recruitmentQuantity("taskedCleared", 55);
    const config = binding.configFor(spec, quantity);

    const result = await runSimulation(binding.adapter, config, "bind");

    const value = binding.readQuantity(result, quantity);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);

    const signatures = binding.signatures(result);
    // Everything the detector gets is a telemetry-derived number.
    expect(Object.keys(signatures).sort()).toEqual([
      "acceptanceRate",
      "accountYouth",
      "compositeScore",
      "employerConcentration",
      "reportRate",
      "requestBurstiness",
    ]);
    expect(signatures.compositeScore).toBeGreaterThanOrEqual(0);
    expect(signatures.compositeScore).toBeLessThanOrEqual(1);
  });

  it("refuses a quantity from another domain rather than returning a number", async () => {
    const spec = {
      id: "s2",
      label: "s2",
      riskTolerance: 50,
      escalationPropensity: 50,
      rationale: "test",
    };
    const quantity = recruitmentQuantity("taskedCleared", 55);
    const config = binding.configFor(spec, quantity);
    const result = await runSimulation(binding.adapter, config, "bind");

    expect(() =>
      binding.readQuantity(result, { ...quantity, name: "meanBelief" }),
    ).toThrow(/cannot resolve/);
  });
});

describe("the orchestrator drives the recruitment domain end to end", () => {
  it("produces an analytic product with no model in the loop", async () => {
    // The point of the whole exercise: sim/kernel.ts and pipeline/run-question.ts
    // were not touched to make this work.
    const root = await mkdtemp(join(tmpdir(), "proteus-recruit-"));
    try {
      const { snapshot } = generateSyntheticCorpus({
        seed: "recruit/corpus",
        documentCount: 30,
        sourceCount: 4,
        startDate: "2026-01-01",
        endDate: "2026-02-20",
        conflictsPerKind: 1,
      });

      const { createRecruitmentBinding } =
        await import("../../src/pipeline/recruitment-binding.js");
      const smallWorld = {
        ...DEFAULT_CONFIG,
        ticks: 40,
        workforce: {
          ...DEFAULT_CONFIG.workforce,
          people: 200,
          organizations: 4,
        },
      };

      const result = await runQuestion(
        {
          client: createFailingClient("offline"),
          binding: createRecruitmentBinding(smallWorld),
          store: new ArtifactStore(root),
          corpus: new AsOfCorpus(snapshot, "2026-03-01"),
        },
        {
          question:
            "How many of our clearance-holders reach paid tasking before the campaign is detected?",
          quantity: recruitmentQuantity("taskedCleared", 39),
          asOf: "2026-03-01",
          rootSeed: "recruit-e2e",
          hypothesisCount: 3,
          runCount: 4,
        },
      );

      expect(result.product.question).toContain("clearance-holders");
      expect(result.bandCount).toBe(3);
      expect(result.ensemble.summaries.length).toBeGreaterThan(0);
      // Abstained or not, a product is produced and its claims are dated.
      expect(result.product.claims.length).toBeGreaterThan(0);
      for (const claim of result.product.claims) {
        for (const ref of claim.support) {
          expect(ref.publishedAt <= "2026-03-01").toBe(true);
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
