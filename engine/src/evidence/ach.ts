/**
 * Analysis of Competing Hypotheses.
 *
 * Heuer's algorithm, implemented as specified rather than as usually shipped:
 * hypotheses are ranked by weighted INCONSISTENCY, ascending — the hypothesis
 * with the least evidence against it wins. Counting supporting evidence instead
 * is the classic mis-implementation, and it rewards whichever hypothesis
 * attracted the most confirmation-seeking collection.
 *
 * Diagnostic evidence dominates by construction: evidence consistent with every
 * hypothesis has diagnosticity 0 and contributes nothing, however much of it
 * there is.
 */

import type { AchVerdict, EvidenceItem, Hypothesis } from "./types.js";

export interface AchCell {
  readonly evidenceId: string;
  readonly hypothesisId: string;
  readonly verdict: AchVerdict;
}

export interface AchMatrix {
  readonly hypotheses: readonly Hypothesis[];
  readonly evidence: readonly EvidenceItem[];
  readonly cells: readonly AchCell[];
}

export interface EvidenceDiagnosticity {
  readonly evidenceId: string;
  readonly diagnosticity: number;
  readonly consistentCount: number;
  readonly inconsistentCount: number;
  readonly applicableCount: number;
}

export interface HypothesisScore {
  readonly hypothesisId: string;
  /** Weighted inconsistency. Lower means better supported. */
  readonly score: number;
  /** Diagnostic evidence items weighing against this hypothesis. */
  readonly inconsistentDiagnostic: number;
}

export interface AchResult {
  readonly scores: readonly HypothesisScore[];
  readonly diagnosticity: readonly EvidenceDiagnosticity[];
  /** Count of evidence items that discriminate at all. */
  readonly diagnosticEvidenceCount: number;
  /**
   * Normalized gap between the best and second-best hypothesis, in [0,1].
   * Near zero means the evidence does not discriminate — the abstention signal.
   */
  readonly separation: number;
}

/** Diagnosticity above this counts an item as genuinely discriminating. */
export const DIAGNOSTIC_THRESHOLD = 0.2;

function verdictLookup(matrix: AchMatrix): Map<string, AchVerdict> {
  const map = new Map<string, AchVerdict>();
  for (const cell of matrix.cells) {
    map.set(`${cell.evidenceId}::${cell.hypothesisId}`, cell.verdict);
  }
  return map;
}

/**
 * Diagnosticity of each evidence item.
 *
 *   diagnosticity = 2 · min(nConsistent, nInconsistent) / nApplicable
 *
 * 0 when an item points the same way for every hypothesis (worthless, and the
 * common case), 1.0 at an even split (maximally discriminating).
 */
export function computeDiagnosticity(
  matrix: AchMatrix,
): EvidenceDiagnosticity[] {
  const lookup = verdictLookup(matrix);

  return matrix.evidence.map((item) => {
    let consistentCount = 0;
    let inconsistentCount = 0;
    let applicableCount = 0;

    for (const hypothesis of matrix.hypotheses) {
      const verdict =
        lookup.get(`${item.id}::${hypothesis.id}`) ?? "not_applicable";
      if (verdict === "not_applicable") continue;
      applicableCount++;
      if (verdict === "consistent") consistentCount++;
      else inconsistentCount++;
    }

    const diagnosticity =
      applicableCount === 0
        ? 0
        : (2 * Math.min(consistentCount, inconsistentCount)) / applicableCount;

    return {
      evidenceId: item.id,
      diagnosticity,
      consistentCount,
      inconsistentCount,
      applicableCount,
    };
  });
}

/**
 * Score every hypothesis and rank ascending by weighted inconsistency.
 *
 *   S(h) = Σ_e diagnosticity(e) · credibility(e) · 1[verdict(e,h) = INCONSISTENT]
 */
export function runAch(matrix: AchMatrix): AchResult {
  if (matrix.hypotheses.length === 0) {
    return {
      scores: [],
      diagnosticity: [],
      diagnosticEvidenceCount: 0,
      separation: 0,
    };
  }

  const lookup = verdictLookup(matrix);
  const diagnosticity = computeDiagnosticity(matrix);
  const byEvidence = new Map(diagnosticity.map((d) => [d.evidenceId, d]));
  const credibility = new Map(
    matrix.evidence.map((e) => [e.id, e.credibility]),
  );

  const scores: HypothesisScore[] = matrix.hypotheses.map((hypothesis) => {
    let score = 0;
    let inconsistentDiagnostic = 0;

    for (const item of matrix.evidence) {
      const verdict =
        lookup.get(`${item.id}::${hypothesis.id}`) ?? "not_applicable";
      if (verdict !== "inconsistent") continue;
      const d = byEvidence.get(item.id)?.diagnosticity ?? 0;
      score += d * (credibility.get(item.id) ?? 0);
      if (d >= DIAGNOSTIC_THRESHOLD) inconsistentDiagnostic++;
    }

    return { hypothesisId: hypothesis.id, score, inconsistentDiagnostic };
  });

  // Ascending: least evidence against wins. Stable tiebreak keeps runs identical.
  const ranked = [...scores].sort(
    (a, b) => a.score - b.score || a.hypothesisId.localeCompare(b.hypothesisId),
  );

  const diagnosticEvidenceCount = diagnosticity.filter(
    (d) => d.diagnosticity >= DIAGNOSTIC_THRESHOLD,
  ).length;

  return {
    scores: ranked,
    diagnosticity,
    diagnosticEvidenceCount,
    separation: computeSeparation(ranked),
  };
}

/**
 * How decisively the evidence picks a winner.
 *
 * Normalized by the score range so it is comparable across questions with
 * different amounts of evidence. Zero when nothing separates the field, which is
 * exactly the condition the abstention gate looks for.
 */
export function computeSeparation(ranked: readonly HypothesisScore[]): number {
  if (ranked.length < 2) return 0;
  const best = ranked[0]!.score;
  const second = ranked[1]!.score;
  const worst = ranked[ranked.length - 1]!.score;
  const range = worst - best;
  if (range <= 0) return 0;
  return (second - best) / range;
}

/**
 * Convert ACH scores to probabilities via a softmax over negated scores.
 *
 * Negated because lower inconsistency means more likely. Temperature controls
 * how sharply the ensemble commits; it is a documented knob rather than a fitted
 * one, and calibration measures whether the setting is honest.
 */
export function achScoresToProbabilities(
  ranked: readonly HypothesisScore[],
  temperature = 1,
): Map<string, number> {
  const result = new Map<string, number>();
  if (ranked.length === 0) return result;
  if (temperature <= 0) throw new RangeError("temperature must be > 0");

  const logits = ranked.map((s) => -s.score / temperature);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const total = exps.reduce((sum, e) => sum + e, 0);

  ranked.forEach((s, i) => result.set(s.hypothesisId, exps[i]! / total));
  return result;
}
