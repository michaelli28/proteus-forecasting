/**
 * Analytic quality: contradiction detection, reconciliation accuracy, and
 * provenance completeness.
 *
 * Every number here is scored against a labelled gold set. Carries the caveat
 * that belongs in the white paper: the synthetic generator plants conflicts
 * using the same structural rules the classifier identifies them by, so these
 * measure implementation correctness, NOT real-world detection accuracy.
 */

import type { Claim } from "../evidence/types.js";
import type { ConflictKind, SeededConflict } from "../corpus/types.js";
import type { DetectedConflict } from "../evidence/contradiction.js";

export interface PrecisionRecall {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
}

function score(tp: number, fp: number, fn: number): PrecisionRecall {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
  };
}

/**
 * Contradiction detection against the planted set.
 *
 * Matching is by subject, since that identifies a conflict uniquely in the
 * synthetic corpus. Detections on subjects with no planted conflict are counted
 * as false positives only when `strictPrecision` is set — background documents
 * legitimately disagree, and counting those as errors would punish the detector
 * for being right.
 */
export function contradictionDetectionScore(
  detected: readonly DetectedConflict[],
  gold: readonly SeededConflict[],
  strictPrecision = false,
): PrecisionRecall {
  const goldSubjects = new Set(gold.map((g) => g.subject));
  const detectedSubjects = new Set(detected.map((d) => d.subject));

  const tp = [...goldSubjects].filter((s) => detectedSubjects.has(s)).length;
  const fn = goldSubjects.size - tp;
  const fp = strictPrecision
    ? [...detectedSubjects].filter((s) => !goldSubjects.has(s)).length
    : 0;

  return score(tp, fp, fn);
}

export interface ClassificationReport {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  /** Per-kind accuracy, so one failing category is not hidden by an average. */
  readonly byKind: Readonly<Record<string, { total: number; correct: number }>>;
}

/** Did the detector assign each planted conflict its planted kind? */
export function conflictClassificationScore(
  detected: readonly DetectedConflict[],
  gold: readonly SeededConflict[],
): ClassificationReport {
  const bySubject = new Map(detected.map((d) => [d.subject, d]));
  const byKind: Record<string, { total: number; correct: number }> = {};
  let correct = 0;

  for (const planted of gold) {
    const entry = byKind[planted.kind] ?? { total: 0, correct: 0 };
    entry.total++;
    const match = bySubject.get(planted.subject);
    if (match?.kind === planted.kind) {
      entry.correct++;
      correct++;
    }
    byKind[planted.kind] = entry;
  }

  return {
    total: gold.length,
    correct,
    accuracy: gold.length === 0 ? 1 : correct / gold.length,
    byKind,
  };
}

export interface ReconciliationReport {
  readonly total: number;
  readonly correct: number;
  readonly accuracy: number;
  /** Genuine disputes wrongly given a resolved value. The dangerous error. */
  readonly falseResolutions: number;
}

/**
 * Reconciliation accuracy.
 *
 * `falseResolutions` is tracked separately because it is the failure that
 * matters: silently picking a side in a genuine dispute manufactures confidence
 * the evidence does not support, whereas failing to reconcile a reconcilable
 * conflict merely leaves confidence lower than it could be.
 */
export function reconciliationScore(
  detected: readonly DetectedConflict[],
  gold: readonly SeededConflict[],
): ReconciliationReport {
  const bySubject = new Map(detected.map((d) => [d.subject, d]));
  let correct = 0;
  let falseResolutions = 0;

  for (const planted of gold) {
    const match = bySubject.get(planted.subject);
    if (!match) continue;
    if (match.reconciledValue === planted.reconciledValue) correct++;
    if (planted.reconciledValue === null && match.reconciledValue !== null) {
      falseResolutions++;
    }
  }

  return {
    total: gold.length,
    correct,
    accuracy: gold.length === 0 ? 1 : correct / gold.length,
    falseResolutions,
  };
}

export interface ProvenanceReport {
  readonly totalClaims: number;
  readonly supportedClaims: number;
  /** Share of claims traceable to a dated source. */
  readonly completeness: number;
  /** Claims with no citation at all. */
  readonly unsupportedAssertions: number;
  readonly unsupportedAssertionRate: number;
  /** Citations missing a parseable date — untraceable in practice. */
  readonly undatedCitations: number;
}

export function provenanceReport(claims: readonly Claim[]): ProvenanceReport {
  const supported = claims.filter((c) => c.support.length > 0);
  const undatedCitations = claims
    .flatMap((c) => c.support)
    .filter((ref) => Number.isNaN(Date.parse(ref.publishedAt))).length;

  return {
    totalClaims: claims.length,
    supportedClaims: supported.length,
    completeness: claims.length === 0 ? 1 : supported.length / claims.length,
    unsupportedAssertions: claims.length - supported.length,
    unsupportedAssertionRate:
      claims.length === 0
        ? 0
        : (claims.length - supported.length) / claims.length,
    undatedCitations,
  };
}

export type { ConflictKind };
