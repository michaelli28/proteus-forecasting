import { describe, it, expect } from "vitest";
import {
  runAch,
  computeDiagnosticity,
  computeSeparation,
  achScoresToProbabilities,
  DIAGNOSTIC_THRESHOLD,
} from "../../src/evidence/ach.js";
import type { AchCell, AchMatrix } from "../../src/evidence/ach.js";
import type { EvidenceItem, Hypothesis } from "../../src/evidence/types.js";

const H: Hypothesis[] = [
  { id: "h1", statement: "Escalation" },
  { id: "h2", statement: "Hold" },
  { id: "h3", statement: "De-escalation" },
];

function evidence(id: string, credibility = 1): EvidenceItem {
  return {
    id,
    documentId: `doc-${id}`,
    sourceId: "s1",
    publishedAt: "2026-01-01",
    credibility,
    summary: `evidence ${id}`,
  };
}

function cells(
  spec: Record<string, Record<string, "C" | "I" | "N">>,
): AchCell[] {
  const out: AchCell[] = [];
  for (const [evidenceId, row] of Object.entries(spec)) {
    for (const [hypothesisId, mark] of Object.entries(row)) {
      out.push({
        evidenceId,
        hypothesisId,
        verdict:
          mark === "C"
            ? "consistent"
            : mark === "I"
              ? "inconsistent"
              : "not_applicable",
      });
    }
  }
  return out;
}

describe("diagnosticity", () => {
  it("is 0 for evidence consistent with every hypothesis", () => {
    const matrix: AchMatrix = {
      hypotheses: H,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "C", h3: "C" } }),
    };
    expect(computeDiagnosticity(matrix)[0]!.diagnosticity).toBe(0);
  });

  it("is 0 for evidence inconsistent with every hypothesis", () => {
    const matrix: AchMatrix = {
      hypotheses: H,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "I", h2: "I", h3: "I" } }),
    };
    expect(computeDiagnosticity(matrix)[0]!.diagnosticity).toBe(0);
  });

  it("is 1 at an even split", () => {
    const two: Hypothesis[] = [H[0]!, H[1]!];
    const matrix: AchMatrix = {
      hypotheses: two,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "I" } }),
    };
    expect(computeDiagnosticity(matrix)[0]!.diagnosticity).toBeCloseTo(1, 10);
  });

  it("scales with how evenly the evidence splits the field", () => {
    const matrix: AchMatrix = {
      hypotheses: H,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "C", h3: "I" } }),
    };
    // 2·min(2,1)/3
    expect(computeDiagnosticity(matrix)[0]!.diagnosticity).toBeCloseTo(
      2 / 3,
      10,
    );
  });

  it("ignores not-applicable cells in the denominator", () => {
    const matrix: AchMatrix = {
      hypotheses: H,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "I", h3: "N" } }),
    };
    const d = computeDiagnosticity(matrix)[0]!;
    expect(d.applicableCount).toBe(2);
    expect(d.diagnosticity).toBeCloseTo(1, 10);
  });

  it("treats a missing cell as not applicable", () => {
    const matrix: AchMatrix = {
      hypotheses: H,
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "I" } }),
    };
    expect(computeDiagnosticity(matrix)[0]!.applicableCount).toBe(2);
  });
});

describe("hypothesis ranking", () => {
  it("ranks by least evidence against, not most evidence for", () => {
    // h1 attracts a pile of non-diagnostic support and one diagnostic strike;
    // h2 attracts nothing at all. Consistency-counting would crown h1.
    const matrix: AchMatrix = {
      hypotheses: [H[0]!, H[1]!],
      evidence: [
        evidence("e1"),
        evidence("e2"),
        evidence("e3"),
        evidence("e4"),
      ],
      cells: cells({
        e1: { h1: "C", h2: "C" },
        e2: { h1: "C", h2: "C" },
        e3: { h1: "C", h2: "C" },
        e4: { h1: "I", h2: "C" },
      }),
    };
    const result = runAch(matrix);
    expect(result.scores[0]!.hypothesisId).toBe("h2");
    expect(result.scores[0]!.score).toBe(0);
    expect(result.scores[1]!.hypothesisId).toBe("h1");
    expect(result.scores[1]!.score).toBeGreaterThan(0);
  });

  it("gives non-diagnostic evidence no influence at all", () => {
    // Evidence inconsistent with everything cannot separate anything.
    const matrix: AchMatrix = {
      hypotheses: [H[0]!, H[1]!],
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "I", h2: "I" } }),
    };
    const result = runAch(matrix);
    expect(result.scores.every((s) => s.score === 0)).toBe(true);
    expect(result.diagnosticEvidenceCount).toBe(0);
  });

  it("weights a strike by source credibility", () => {
    const build = (credibility: number): AchMatrix => ({
      hypotheses: [H[0]!, H[1]!],
      evidence: [evidence("e1", credibility)],
      cells: cells({ e1: { h1: "I", h2: "C" } }),
    });
    const weak = runAch(build(0.2)).scores.find(
      (s) => s.hypothesisId === "h1",
    )!.score;
    const strong = runAch(build(0.9)).scores.find(
      (s) => s.hypothesisId === "h1",
    )!.score;
    expect(strong).toBeGreaterThan(weak);
  });

  it("counts diagnostic strikes separately from the weighted score", () => {
    const matrix: AchMatrix = {
      hypotheses: [H[0]!, H[1]!],
      evidence: [evidence("e1"), evidence("e2")],
      cells: cells({ e1: { h1: "I", h2: "C" }, e2: { h1: "I", h2: "C" } }),
    };
    const h1 = runAch(matrix).scores.find((s) => s.hypothesisId === "h1")!;
    expect(h1.inconsistentDiagnostic).toBe(2);
  });

  it("is deterministic under a tie", () => {
    const matrix: AchMatrix = {
      hypotheses: [H[1]!, H[0]!],
      evidence: [evidence("e1")],
      cells: cells({ e1: { h1: "C", h2: "C" } }),
    };
    expect(runAch(matrix).scores.map((s) => s.hypothesisId)).toEqual([
      "h1",
      "h2",
    ]);
  });

  it("handles an empty hypothesis set", () => {
    expect(runAch({ hypotheses: [], evidence: [], cells: [] }).scores).toEqual(
      [],
    );
  });

  it("counts diagnostic evidence above the threshold", () => {
    const matrix: AchMatrix = {
      hypotheses: [H[0]!, H[1]!],
      evidence: [evidence("e1"), evidence("e2")],
      cells: cells({ e1: { h1: "C", h2: "I" }, e2: { h1: "C", h2: "C" } }),
    };
    const result = runAch(matrix);
    expect(result.diagnosticEvidenceCount).toBe(1);
    expect(result.diagnosticity[0]!.diagnosticity).toBeGreaterThanOrEqual(
      DIAGNOSTIC_THRESHOLD,
    );
  });
});

describe("separation", () => {
  it("is 0 when every hypothesis scores identically", () => {
    expect(
      computeSeparation([
        { hypothesisId: "a", score: 1, inconsistentDiagnostic: 0 },
        { hypothesisId: "b", score: 1, inconsistentDiagnostic: 0 },
      ]),
    ).toBe(0);
  });

  it("is 0 with a single hypothesis", () => {
    expect(
      computeSeparation([
        { hypothesisId: "a", score: 0, inconsistentDiagnostic: 0 },
      ]),
    ).toBe(0);
  });

  it("rises as the leader pulls clear", () => {
    const close = computeSeparation([
      { hypothesisId: "a", score: 0, inconsistentDiagnostic: 0 },
      { hypothesisId: "b", score: 0.1, inconsistentDiagnostic: 0 },
      { hypothesisId: "c", score: 1, inconsistentDiagnostic: 0 },
    ]);
    const clear = computeSeparation([
      { hypothesisId: "a", score: 0, inconsistentDiagnostic: 0 },
      { hypothesisId: "b", score: 0.8, inconsistentDiagnostic: 0 },
      { hypothesisId: "c", score: 1, inconsistentDiagnostic: 0 },
    ]);
    expect(clear).toBeGreaterThan(close);
  });

  it("stays within [0,1]", () => {
    const value = computeSeparation([
      { hypothesisId: "a", score: 0, inconsistentDiagnostic: 0 },
      { hypothesisId: "b", score: 5, inconsistentDiagnostic: 0 },
      { hypothesisId: "c", score: 5, inconsistentDiagnostic: 0 },
    ]);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
});

describe("achScoresToProbabilities", () => {
  const ranked = [
    { hypothesisId: "a", score: 0, inconsistentDiagnostic: 0 },
    { hypothesisId: "b", score: 1, inconsistentDiagnostic: 1 },
    { hypothesisId: "c", score: 2, inconsistentDiagnostic: 2 },
  ];

  it("sums to 1", () => {
    const probs = achScoresToProbabilities(ranked);
    expect([...probs.values()].reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
  });

  it("gives the least-contradicted hypothesis the highest probability", () => {
    const probs = achScoresToProbabilities(ranked);
    expect(probs.get("a")!).toBeGreaterThan(probs.get("b")!);
    expect(probs.get("b")!).toBeGreaterThan(probs.get("c")!);
  });

  it("hedges toward uniform at high temperature", () => {
    const sharp = achScoresToProbabilities(ranked, 0.2);
    const flat = achScoresToProbabilities(ranked, 20);
    expect(flat.get("a")!).toBeLessThan(sharp.get("a")!);
    expect(flat.get("a")!).toBeCloseTo(1 / 3, 1);
  });

  it("is uniform when nothing separates the hypotheses", () => {
    const tied = achScoresToProbabilities([
      { hypothesisId: "a", score: 1, inconsistentDiagnostic: 0 },
      { hypothesisId: "b", score: 1, inconsistentDiagnostic: 0 },
    ]);
    expect(tied.get("a")!).toBeCloseTo(0.5, 10);
  });

  it("rejects a non-positive temperature", () => {
    expect(() => achScoresToProbabilities(ranked, 0)).toThrow(RangeError);
  });

  it("returns an empty map for an empty ranking", () => {
    expect(achScoresToProbabilities([]).size).toBe(0);
  });
});
