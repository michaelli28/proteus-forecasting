import { describe, it, expect } from "vitest";
import {
  achMatrixFromEnsemble,
  assessConfidence,
  claimsFromContradictions,
  claimsFromEnsemble,
  confidenceScore,
  ensembleSummaryText,
  evidenceFromEnsemble,
  indicatorsFromEnsemble,
} from "../../src/pipeline/analysis.js";
import { runAch } from "../../src/evidence/ach.js";
import {
  collectSignals,
  evaluateAbstention,
} from "../../src/evidence/abstention.js";
import { CORPUS_AS_OF, STUB_BANDS, testCorpus } from "./harness.js";
import type { RunSummary } from "../../src/pipeline/types.js";

const AS_OF = "2026-03-01";

function summary(
  specId: string,
  bandId: string,
  quantity: number,
  signatures: Record<string, number> = { meanJitter: 0.002, peakJitter: 0.004 },
): RunSummary {
  return {
    runId: `run-${specId}`,
    specId,
    label: `spec ${specId}`,
    artifactHash: `hash-${specId}`,
    quantity,
    bandId,
    bandIndex: STUB_BANDS.findIndex((b) => b.id === bandId),
    signatures,
  };
}

/** Six runs, five of them agreeing on h2. */
const CONCENTRATED: RunSummary[] = [
  summary("r1", "h2", 0.5),
  summary("r2", "h2", 0.55),
  summary("r3", "h2", 0.6),
  summary("r4", "h2", 0.52),
  summary("r5", "h2", 0.58),
  summary("r6", "h3", 0.8),
];

/** Six runs spread evenly — nothing discriminates. */
const SPREAD: RunSummary[] = [
  summary("r1", "h1", 0.1),
  summary("r2", "h1", 0.2),
  summary("r3", "h2", 0.5),
  summary("r4", "h2", 0.6),
  summary("r5", "h3", 0.8),
  summary("r6", "h3", 0.9),
];

describe("evidenceFromEnsemble", () => {
  it("emits one dated reading per run", () => {
    const evidence = evidenceFromEnsemble(CONCENTRATED, AS_OF);
    expect(evidence).toHaveLength(6);
    expect(new Set(evidence.map((e) => e.id)).size).toBe(6);
    for (const item of evidence) {
      expect(item.publishedAt).toBe(AS_OF);
      expect(item.credibility).toBeGreaterThan(0);
      expect(item.credibility).toBeLessThanOrEqual(1);
    }
  });

  it("never dates a reading after the cutoff", () => {
    const evidence = evidenceFromEnsemble(CONCENTRATED, AS_OF);
    for (const item of evidence) {
      expect(Date.parse(item.publishedAt)).toBeLessThanOrEqual(
        Date.parse(AS_OF),
      );
    }
  });
});

describe("achMatrixFromEnsemble", () => {
  it("marks a run consistent with its own band and inconsistent with the others", () => {
    const matrix = achMatrixFromEnsemble(
      STUB_BANDS,
      [summary("r1", "h2", 0.5)],
      AS_OF,
    );
    const byHypothesis = new Map(
      matrix.cells.map((c) => [c.hypothesisId, c.verdict]),
    );
    expect(byHypothesis.get("h2")).toBe("consistent");
    expect(byHypothesis.get("h1")).toBe("inconsistent");
    expect(byHypothesis.get("h3")).toBe("inconsistent");
  });

  it("covers every hypothesis-evidence pair", () => {
    const matrix = achMatrixFromEnsemble(STUB_BANDS, CONCENTRATED, AS_OF);
    expect(matrix.cells).toHaveLength(STUB_BANDS.length * CONCENTRATED.length);
  });
});

describe("the abstention gate on ensemble-derived evidence", () => {
  it("proceeds when the ensemble concentrates", () => {
    const ach = runAch(achMatrixFromEnsemble(STUB_BANDS, CONCENTRATED, AS_OF));
    expect(ach.diagnosticEvidenceCount).toBeGreaterThanOrEqual(3);
    expect(ach.separation).toBeGreaterThan(0.15);

    const verdict = evaluateAbstention(
      collectSignals(
        ach,
        { conflicts: [], unresolved: [], unresolvedRate: 0 },
        claimsFromEnsemble({
          summaries: CONCENTRATED,
          bands: STUB_BANDS,
          asOf: AS_OF,
        }),
      ),
    );
    expect(verdict.verdict).toBe("PROCEED");
  });

  it("abstains when the ensemble spreads across the partition", () => {
    const ach = runAch(achMatrixFromEnsemble(STUB_BANDS, SPREAD, AS_OF));
    expect(ach.separation).toBe(0);

    const verdict = evaluateAbstention(
      collectSignals(
        ach,
        { conflicts: [], unresolved: [], unresolvedRate: 0 },
        claimsFromEnsemble({
          summaries: SPREAD,
          bands: STUB_BANDS,
          asOf: AS_OF,
        }),
      ),
    );
    expect(verdict.verdict).toBe("INSUFFICIENT_EVIDENCE");
    if (verdict.verdict === "INSUFFICIENT_EVIDENCE") {
      expect(verdict.findings.map((f) => f.reason)).toContain(
        "hypotheses_indistinguishable",
      );
    }
  });
});

describe("claimsFromEnsemble", () => {
  it("supports every claim with a dated reading", () => {
    const claims = claimsFromEnsemble({
      summaries: CONCENTRATED,
      bands: STUB_BANDS,
      asOf: AS_OF,
    });
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim.support.length).toBeGreaterThan(0);
      for (const ref of claim.support) {
        expect(Date.parse(ref.publishedAt)).toBeLessThanOrEqual(
          Date.parse(AS_OF),
        );
      }
    }
  });
});

describe("claimsFromContradictions", () => {
  const corpus = testCorpus();
  const documents = corpus.all().slice(0, 2);

  function party(document: (typeof documents)[number], value: number) {
    return {
      documentId: document.id,
      sourceId: document.sourceId,
      value,
      asOfDate: "2026-06-01",
      definition: "whole_population",
      unit: "pct",
      credibility: 0.6,
      measurementMethod: "panel_survey",
    };
  }

  const report = {
    conflicts: [],
    unresolvedRate: 1,
    unresolved: [
      {
        subject: "narrative.1.reach_pct",
        kind: "genuine_dispute" as const,
        parties: [party(documents[0]!, 22), party(documents[1]!, 71)] as const,
        reconciledValue: null,
        rationale: "Same date, scope, unit and instrument, different answers.",
      },
    ],
  };

  it("reports each unreconciled dispute as its own claim", () => {
    const claims = claimsFromContradictions(report, corpus);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.text).toMatch(/disagree|unreconciled/i);
    expect(claims[0]!.support).toHaveLength(2);
  });

  it("dates a citation by its document, never by the fact's later as-of date", () => {
    // The fixture's parties claim an as-of date months past the cutoff. Using it
    // as the citation date would trip the leakage guard on evidence that never
    // leaked, so the document's own publication date is what travels.
    const claims = claimsFromContradictions(report, corpus);
    for (const ref of claims[0]!.support) {
      expect(Date.parse(ref.publishedAt)).toBeLessThanOrEqual(
        Date.parse(CORPUS_AS_OF),
      );
    }
    expect(() =>
      corpus.assertNoLeakage(
        claims[0]!.support.map((ref) => ({
          id: ref.documentId,
          publishedAt: ref.publishedAt,
        })),
      ),
    ).not.toThrow();
  });

  it("drops a party whose document is not visible at this cutoff", () => {
    const hidden = {
      ...report,
      unresolved: [
        {
          ...report.unresolved[0]!,
          parties: [
            { ...party(documents[0]!, 22), documentId: "doc-9999" },
            { ...party(documents[1]!, 71), documentId: "doc-9998" },
          ] as const,
        },
      ],
    };
    expect(claimsFromContradictions(hidden, corpus)).toEqual([]);
  });
});

describe("assessConfidence", () => {
  // Deliberately no "how spread out is the forecast" term. Diffuseness is
  // uncertainty and belongs in the likelihood; folding it into confidence is
  // exactly the ICD 203 conflation this system refuses to make.
  const healthy = {
    ensembleCompletion: 1,
    unresolvedRate: 0,
    provenanceCompleteness: 1,
    adjudicationAvailable: true,
    redTeamPenalty: 0,
  };

  it("reaches high only when every driver is strong", () => {
    expect(assessConfidence(healthy).level).toBe("high");
  });

  it("takes the weakest link, never an average", () => {
    const assessment = assessConfidence({ ...healthy, unresolvedRate: 0.9 });
    expect(assessment.level).toBe("low");
  });

  it("falls when ensemble members are lost", () => {
    const full = confidenceScore(assessConfidence(healthy).level);
    const degraded = confidenceScore(
      assessConfidence({ ...healthy, ensembleCompletion: 0.5 }).level,
    );
    expect(degraded).toBeLessThan(full);
  });

  it("caps at moderate when adjudication is unavailable rather than collapsing to low", () => {
    const assessment = assessConfidence({
      ...healthy,
      adjudicationAvailable: false,
    });
    expect(assessment.level).toBe("moderate");
  });

  it("falls to low when a high-severity red-team challenge survives", () => {
    expect(assessConfidence({ ...healthy, redTeamPenalty: 0.35 }).level).toBe(
      "low",
    );
  });

  it("names a driver for every dimension it assessed", () => {
    const kinds = assessConfidence(healthy).drivers.map((d) => d.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain("source_corroboration");
    expect(kinds).toContain("unresolved_contradiction");
  });
});

describe("indicatorsFromEnsemble", () => {
  it("reports nothing when every run shares the leading band", () => {
    const uniform = CONCENTRATED.slice(0, 5);
    expect(indicatorsFromEnsemble(uniform, "h2")).toEqual([]);
  });

  it("names the channel that separates the leading band from the rest", () => {
    const runs: RunSummary[] = [
      summary("r1", "h2", 0.5, { meanJitter: 0.001, peakJitter: 0.002 }),
      summary("r2", "h2", 0.5, { meanJitter: 0.001, peakJitter: 0.002 }),
      summary("r3", "h3", 0.8, { meanJitter: 0.009, peakJitter: 0.02 }),
      summary("r4", "h3", 0.9, { meanJitter: 0.009, peakJitter: 0.02 }),
    ];
    const indicators = indicatorsFromEnsemble(runs, "h3");
    expect(indicators.length).toBeGreaterThan(0);
    expect(indicators[0]!.favorsHypothesis).toBe("h3");
    expect(indicators[0]!.likelihoodRatio).toBeGreaterThan(1);
    expect(["meanJitter", "peakJitter"]).toContain(
      indicators[0]!.instrumentChannel,
    );
  });
});

describe("ensembleSummaryText", () => {
  it("reports the band distribution without naming any single run's value", () => {
    const text = ensembleSummaryText(CONCENTRATED, STUB_BANDS);
    expect(text).toMatch(/h2/);
    expect(text).toMatch(/6 runs|6 of 6|runs: 6/i);
  });

  it("is stable for the same ensemble", () => {
    expect(ensembleSummaryText(CONCENTRATED, STUB_BANDS)).toBe(
      ensembleSummaryText(CONCENTRATED, STUB_BANDS),
    );
  });
});
