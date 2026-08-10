import { describe, it, expect } from "vitest";
import {
  evaluateAbstention,
  collectSignals,
  provenanceCompleteness,
  unsupportedAssertionCount,
  isAbstention,
  DEFAULT_ABSTENTION_THRESHOLDS,
  ABSTENTION_REASONS,
} from "../../src/evidence/abstention.js";
import type { AbstentionSignals } from "../../src/evidence/abstention.js";
import { runAch } from "../../src/evidence/ach.js";
import { detectContradictions } from "../../src/evidence/contradiction.js";
import {
  generateSyntheticCorpus,
  CANONICAL_DEFINITION,
} from "../../src/corpus/synthetic.js";
import type { Claim, EvidenceRef } from "../../src/evidence/types.js";

const ref: EvidenceRef = {
  sourceId: "s1",
  documentId: "d1",
  publishedAt: "2026-01-01",
  credibility: 0.8,
  excerpt: "…",
};

/** Signals that comfortably clear every threshold. */
const healthy: AbstentionSignals = {
  diagnosticEvidenceCount: 10,
  separation: 0.5,
  unresolvedRate: 0.1,
  provenanceCompleteness: 1,
};

describe("provenance counting", () => {
  it("counts the share of claims carrying a citation", () => {
    const claims: Claim[] = [
      { text: "a", support: [ref] },
      { text: "b", support: [ref] },
      { text: "c", support: [] },
      { text: "d", support: [] },
    ];
    expect(provenanceCompleteness(claims)).toBe(0.5);
    expect(unsupportedAssertionCount(claims)).toBe(2);
  });

  it("treats an empty product as vacuously complete", () => {
    expect(provenanceCompleteness([])).toBe(1);
  });

  it("counts an unsupported assertion rather than blocking it", () => {
    // Blocking would push unsupported reasoning into prose where it cannot be
    // measured. Counting keeps it visible.
    expect(unsupportedAssertionCount([{ text: "bare", support: [] }])).toBe(1);
  });
});

describe("the gate proceeds when evidence supports it", () => {
  it("returns PROCEED on healthy signals", () => {
    const verdict = evaluateAbstention(healthy);
    expect(verdict.verdict).toBe("PROCEED");
    expect(isAbstention(verdict)).toBe(false);
  });

  it("passes exactly at the threshold rather than just inside it", () => {
    const atThreshold: AbstentionSignals = {
      diagnosticEvidenceCount:
        DEFAULT_ABSTENTION_THRESHOLDS.minDiagnosticEvidence,
      separation: DEFAULT_ABSTENTION_THRESHOLDS.minSeparation,
      unresolvedRate: DEFAULT_ABSTENTION_THRESHOLDS.maxUnresolvedRate,
      provenanceCompleteness:
        DEFAULT_ABSTENTION_THRESHOLDS.minProvenanceCompleteness,
    };
    expect(evaluateAbstention(atThreshold).verdict).toBe("PROCEED");
  });

  it("reports the signals it decided on", () => {
    expect(evaluateAbstention(healthy).signals).toEqual(healthy);
  });
});

describe("the gate abstains when it should", () => {
  it("fires on too little diagnostic evidence", () => {
    const verdict = evaluateAbstention({
      ...healthy,
      diagnosticEvidenceCount: 1,
    });
    expect(isAbstention(verdict)).toBe(true);
    if (!isAbstention(verdict)) throw new Error("unreachable");
    expect(verdict.findings.map((f) => f.reason)).toContain(
      "insufficient_diagnostic_evidence",
    );
  });

  it("fires when the hypotheses do not separate", () => {
    const verdict = evaluateAbstention({ ...healthy, separation: 0.01 });
    expect(isAbstention(verdict)).toBe(true);
    if (!isAbstention(verdict)) throw new Error("unreachable");
    expect(verdict.findings.map((f) => f.reason)).toContain(
      "hypotheses_indistinguishable",
    );
  });

  it("fires when sources genuinely disagree", () => {
    const verdict = evaluateAbstention({ ...healthy, unresolvedRate: 0.9 });
    expect(isAbstention(verdict)).toBe(true);
  });

  it("fires when claims cannot be traced to sources", () => {
    const verdict = evaluateAbstention({
      ...healthy,
      provenanceCompleteness: 0.2,
    });
    expect(isAbstention(verdict)).toBe(true);
  });

  it("is not rescued by a mountain of non-diagnostic evidence", () => {
    // Volume of consistent evidence must not substitute for discrimination.
    const verdict = evaluateAbstention({
      ...healthy,
      diagnosticEvidenceCount: 0,
      separation: 0,
    });
    expect(isAbstention(verdict)).toBe(true);
  });

  it("reports every failing condition, not just the first", () => {
    // An analyst deciding what to collect next needs the whole list.
    const verdict = evaluateAbstention({
      diagnosticEvidenceCount: 0,
      separation: 0,
      unresolvedRate: 1,
      provenanceCompleteness: 0,
    });
    if (!isAbstention(verdict)) throw new Error("expected abstention");
    expect(verdict.findings).toHaveLength(ABSTENTION_REASONS.length);
    expect(new Set(verdict.findings.map((f) => f.reason)).size).toBe(
      ABSTENTION_REASONS.length,
    );
  });

  it("states what was observed against what was required", () => {
    const verdict = evaluateAbstention({
      ...healthy,
      diagnosticEvidenceCount: 1,
    });
    if (!isAbstention(verdict)) throw new Error("expected abstention");
    const finding = verdict.findings.find(
      (f) => f.reason === "insufficient_diagnostic_evidence",
    )!;
    expect(finding.observed).toBe(1);
    expect(finding.required).toBe(
      DEFAULT_ABSTENTION_THRESHOLDS.minDiagnosticEvidence,
    );
  });

  it("returns actionable collection guidance for each gap", () => {
    const verdict = evaluateAbstention({
      ...healthy,
      diagnosticEvidenceCount: 0,
    });
    if (!isAbstention(verdict)) throw new Error("expected abstention");
    expect(verdict.evidenceGaps).toHaveLength(verdict.findings.length);
    expect(verdict.evidenceGaps[0]).toContain("INCONSISTENT");
  });

  it("honors custom thresholds", () => {
    const permissive = {
      ...DEFAULT_ABSTENTION_THRESHOLDS,
      minDiagnosticEvidence: 0,
      minSeparation: 0,
    };
    const signals = { ...healthy, diagnosticEvidenceCount: 0, separation: 0 };
    expect(evaluateAbstention(signals, permissive).verdict).toBe("PROCEED");
    expect(evaluateAbstention(signals).verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("collectSignals wires the upstream stages together", () => {
  it("abstains on a question with no discriminating evidence", () => {
    // Negative control: evidence consistent with every hypothesis, so nothing
    // separates them however much there is.
    const hypotheses = [
      { id: "h1", statement: "A" },
      { id: "h2", statement: "B" },
    ];
    const evidence = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      documentId: `d${i}`,
      sourceId: "s1",
      publishedAt: "2026-01-01",
      credibility: 0.9,
      summary: "consistent with everything",
    }));
    const cells = evidence.flatMap((e) =>
      hypotheses.map((h) => ({
        evidenceId: e.id,
        hypothesisId: h.id,
        verdict: "consistent" as const,
      })),
    );

    const ach = runAch({ hypotheses, evidence, cells });
    const corpus = generateSyntheticCorpus({
      seed: "abstain",
      documentCount: 0,
      sourceCount: 6,
      startDate: "2026-01-01",
      endDate: "2026-03-01",
      conflictsPerKind: 0,
    });
    const contradictions = detectContradictions(
      corpus.snapshot,
      corpus.snapshot.documents,
      CANONICAL_DEFINITION,
    );

    const signals = collectSignals(ach, contradictions, [
      { text: "x", support: [ref] },
    ]);
    expect(signals.diagnosticEvidenceCount).toBe(0);
    expect(isAbstention(evaluateAbstention(signals))).toBe(true);
  });

  it("proceeds when the evidence genuinely discriminates", () => {
    const hypotheses = [
      { id: "h1", statement: "A" },
      { id: "h2", statement: "B" },
    ];
    const evidence = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`,
      documentId: `d${i}`,
      sourceId: "s1",
      publishedAt: "2026-01-01",
      credibility: 0.9,
      summary: "discriminating",
    }));
    const cells = evidence.flatMap((e, i) => [
      { evidenceId: e.id, hypothesisId: "h1", verdict: "consistent" as const },
      {
        evidenceId: e.id,
        hypothesisId: "h2",
        verdict: (i < 5 ? "inconsistent" : "consistent") as
          "inconsistent" | "consistent",
      },
    ]);

    const ach = runAch({ hypotheses, evidence, cells });
    const signals = collectSignals(
      ach,
      { conflicts: [], unresolved: [], unresolvedRate: 0 },
      [{ text: "x", support: [ref] }],
    );
    expect(signals.diagnosticEvidenceCount).toBeGreaterThanOrEqual(5);
    expect(evaluateAbstention(signals).verdict).toBe("PROCEED");
  });
});
