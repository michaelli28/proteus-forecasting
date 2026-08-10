import { describe, it, expect } from "vitest";
import {
  buildAbstainedProduct,
  buildForecastProduct,
  formatProduct,
} from "../../src/pipeline/product.js";
import { STUB_BANDS } from "./harness.js";
import type { AbstentionVerdict } from "../../src/evidence/abstention.js";

const BASE = {
  question: "Where does the level land?",
  asOf: "2026-03-01",
  corpusSnapshotId: "corpus-test",
  bands: STUB_BANDS,
  claims: [
    {
      text: "Five of six runs terminated inside band h2.",
      support: [
        {
          sourceId: "simulation-instrument",
          documentId: "run-r1",
          publishedAt: "2026-03-01",
          credibility: 0.8,
          excerpt: "terminal level 0.55",
        },
      ],
    },
  ],
  keyAssumptions: [
    {
      statement: "The ensemble spans the plausible parameter space.",
      confidence: "moderate" as const,
      falsifier: "A realized value outside every band the ensemble explored.",
      affectedHypotheses: ["h1", "h2", "h3"],
    },
  ],
  indicators: [],
  redTeam: [],
};

const ACH_SCORES = [
  { hypothesisId: "h2", score: 1.07, inconsistentDiagnostic: 2 },
  { hypothesisId: "h1", score: 1.6, inconsistentDiagnostic: 3 },
  { hypothesisId: "h3", score: 1.6, inconsistentDiagnostic: 3 },
];

describe("buildForecastProduct", () => {
  const product = buildForecastProduct({
    ...BASE,
    probabilities: [0.2, 0.65, 0.15],
    achScores: ACH_SCORES,
    confidence: {
      level: "moderate",
      drivers: [
        {
          kind: "source_corroboration",
          effect: "raises",
          note: "every planned run completed",
        },
      ],
    },
  });

  it("leads with the leading band, its likelihood and its confidence", () => {
    expect(product.bluf).toMatch(/h2|middle/i);
    expect(product.bluf).toMatch(/likely/i);
    expect(product.bluf).toMatch(/moderate confidence/i);
  });

  it("ranks one hypothesis per band, in band order", () => {
    expect(product.hypotheses.map((h) => h.hypothesis.id)).toEqual([
      "h1",
      "h2",
      "h3",
    ]);
  });

  it("keeps each judgment's band and point estimate consistent", () => {
    const leading = product.hypotheses.find((h) => h.hypothesis.id === "h2")!;
    expect(leading.judgment.likelihoodPoint).toBeCloseTo(0.65, 10);
    expect(leading.judgment.likelihood).toBe("likely");
    expect(leading.judgment.confidence).toBe("moderate");
  });

  it("carries the ACH score onto every hypothesis", () => {
    const leading = product.hypotheses.find((h) => h.hypothesis.id === "h2")!;
    expect(leading.achScore).toBeCloseTo(1.07, 10);
  });

  it("carries no abstention record", () => {
    expect(product.abstention).toBeUndefined();
  });

  it("rejects probabilities that do not match the partition", () => {
    expect(() =>
      buildForecastProduct({
        ...BASE,
        probabilities: [0.5, 0.5],
        achScores: ACH_SCORES,
        confidence: { level: "low", drivers: [] },
      }),
    ).toThrow(RangeError);
  });
});

describe("buildAbstainedProduct", () => {
  const verdict: AbstentionVerdict = {
    verdict: "INSUFFICIENT_EVIDENCE",
    signals: {
      diagnosticEvidenceCount: 6,
      separation: 0,
      unresolvedRate: 0,
      provenanceCompleteness: 1,
    },
    findings: [
      {
        reason: "hypotheses_indistinguishable",
        observed: 0,
        required: 0.15,
        detail: "The leading hypotheses score too closely to separate.",
      },
    ],
    evidenceGaps: ["Narrow the hypothesis set."],
  };

  const product = buildAbstainedProduct({ ...BASE, verdict });

  it("emits no ranked hypotheses at all, so no likelihood can escape", () => {
    expect(product.hypotheses).toEqual([]);
  });

  it("states insufficient evidence without stating a probability", () => {
    expect(product.bluf).toMatch(/insufficient evidence/i);
    expect(product.bluf).not.toMatch(/\d+%/);
  });

  it("records the reasons and what to collect next", () => {
    expect(product.abstention?.reasons).toContain(
      "hypotheses_indistinguishable",
    );
    expect(product.abstention?.evidenceGaps.length).toBeGreaterThan(0);
  });

  it("rejects a PROCEED verdict — abstaining on one is a caller bug", () => {
    expect(() =>
      buildAbstainedProduct({
        ...BASE,
        verdict: {
          verdict: "PROCEED",
          signals: verdict.signals,
        },
      }),
    ).toThrow();
  });
});

describe("formatProduct", () => {
  it("always shows both axes and the closed-world caveat", () => {
    const text = formatProduct(
      buildForecastProduct({
        ...BASE,
        probabilities: [0.2, 0.65, 0.15],
        achScores: ACH_SCORES,
        confidence: { level: "moderate", drivers: [] },
      }),
    );
    expect(text).toMatch(/likely/i);
    expect(text).toMatch(/moderate confidence/i);
    expect(text).toMatch(/closed-world|synthetic/i);
  });
});
