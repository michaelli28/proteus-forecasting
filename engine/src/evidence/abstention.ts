/**
 * The abstention gate.
 *
 * Runs BEFORE any likelihood is produced, not as a post-hoc filter on a number
 * already computed. A system that always answers is not calibrated, it is
 * fluent — "insufficient evidence" is a first-class verdict here, and negative
 * controls in the benchmark exist to check that it fires when it should.
 *
 * Every threshold is explicit and configurable so the false-abstention rate can
 * be measured and traded off, rather than buried in a prompt.
 */

import type { AchResult } from "./ach.js";
import type { ContradictionReport } from "./contradiction.js";
import type { Claim } from "./types.js";

export const ABSTENTION_REASONS = [
  "insufficient_diagnostic_evidence",
  "hypotheses_indistinguishable",
  "unresolved_contradictions",
  "incomplete_provenance",
] as const;
export type AbstentionReason = (typeof ABSTENTION_REASONS)[number];

export interface AbstentionThresholds {
  /** Minimum evidence items that actually discriminate between hypotheses. */
  readonly minDiagnosticEvidence: number;
  /** Minimum normalized ACH gap between best and second-best. */
  readonly minSeparation: number;
  /** Maximum share of detected conflicts that may remain unreconciled. */
  readonly maxUnresolvedRate: number;
  /** Minimum share of claims carrying at least one dated citation. */
  readonly minProvenanceCompleteness: number;
}

/**
 * Measured, not chosen. §8h swept every one of these against the benchmark.
 *
 * `minSeparation` was 0.15 and cost 12% false abstention for no measurable gain
 * in true abstention — the unanswerable arm was already caught in full by
 * `minDiagnosticEvidence`. 0.05 is the smallest setting that still stops an
 * exactly-tied field, which is the only thing this signal is measured to be
 * good for. `minDiagnosticEvidence` sits mid-plateau: 1 through 16 all behave
 * identically, 32 starts costing.
 */
export const DEFAULT_ABSTENTION_THRESHOLDS: AbstentionThresholds = {
  minDiagnosticEvidence: 3,
  minSeparation: 0.05,
  maxUnresolvedRate: 0.5,
  minProvenanceCompleteness: 0.8,
};

export interface AbstentionSignals {
  readonly diagnosticEvidenceCount: number;
  readonly separation: number;
  readonly unresolvedRate: number;
  readonly provenanceCompleteness: number;
}

export interface AbstentionFinding {
  readonly reason: AbstentionReason;
  readonly observed: number;
  readonly required: number;
  readonly detail: string;
}

export type AbstentionVerdict =
  | { readonly verdict: "PROCEED"; readonly signals: AbstentionSignals }
  | {
      readonly verdict: "INSUFFICIENT_EVIDENCE";
      readonly signals: AbstentionSignals;
      readonly findings: readonly AbstentionFinding[];
      readonly evidenceGaps: readonly string[];
    };

/** Share of claims carrying at least one dated citation, in [0,1]. */
export function provenanceCompleteness(claims: readonly Claim[]): number {
  if (claims.length === 0) return 1;
  const supported = claims.filter((c) => c.support.length > 0).length;
  return supported / claims.length;
}

/** Count of claims with no citation at all. */
export function unsupportedAssertionCount(claims: readonly Claim[]): number {
  return claims.filter((c) => c.support.length === 0).length;
}

/** Assemble the gate's inputs from the upstream analytic stages. */
export function collectSignals(
  ach: AchResult,
  contradictions: ContradictionReport,
  claims: readonly Claim[],
): AbstentionSignals {
  return {
    diagnosticEvidenceCount: ach.diagnosticEvidenceCount,
    separation: ach.separation,
    unresolvedRate: contradictions.unresolvedRate,
    provenanceCompleteness: provenanceCompleteness(claims),
  };
}

/**
 * Decide whether there is enough to answer at all.
 *
 * Reports every failing condition rather than short-circuiting on the first: an
 * analyst deciding what to collect next needs the full list of what is missing,
 * not the alphabetically-first gap.
 */
export function evaluateAbstention(
  signals: AbstentionSignals,
  thresholds: AbstentionThresholds = DEFAULT_ABSTENTION_THRESHOLDS,
): AbstentionVerdict {
  const findings: AbstentionFinding[] = [];

  if (signals.diagnosticEvidenceCount < thresholds.minDiagnosticEvidence) {
    findings.push({
      reason: "insufficient_diagnostic_evidence",
      observed: signals.diagnosticEvidenceCount,
      required: thresholds.minDiagnosticEvidence,
      detail:
        "Too little evidence discriminates between the hypotheses. Volume of consistent evidence does not substitute.",
    });
  }

  if (signals.separation < thresholds.minSeparation) {
    findings.push({
      reason: "hypotheses_indistinguishable",
      observed: signals.separation,
      required: thresholds.minSeparation,
      detail:
        "The leading hypotheses score too closely to separate. Reporting a winner here would be reporting noise.",
    });
  }

  if (signals.unresolvedRate > thresholds.maxUnresolvedRate) {
    findings.push({
      reason: "unresolved_contradictions",
      observed: signals.unresolvedRate,
      required: thresholds.maxUnresolvedRate,
      detail:
        "Sources genuinely disagree on the underlying facts and the disputes cannot be reconciled.",
    });
  }

  if (signals.provenanceCompleteness < thresholds.minProvenanceCompleteness) {
    findings.push({
      reason: "incomplete_provenance",
      observed: signals.provenanceCompleteness,
      required: thresholds.minProvenanceCompleteness,
      detail: "Too many assertions cannot be traced to a dated source.",
    });
  }

  if (findings.length === 0) return { verdict: "PROCEED", signals };

  return {
    verdict: "INSUFFICIENT_EVIDENCE",
    signals,
    findings,
    evidenceGaps: findings.map((f) => collectionGuidance(f.reason)),
  };
}

/** What to collect next, per failure mode. */
function collectionGuidance(reason: AbstentionReason): string {
  switch (reason) {
    case "insufficient_diagnostic_evidence":
      return "Collect evidence that would be INCONSISTENT with at least one hypothesis; corroborating detail will not move the estimate.";
    case "hypotheses_indistinguishable":
      return "Either narrow the hypothesis set or collect against the specific observables that discriminate between the leaders.";
    case "unresolved_contradictions":
      return "Obtain the underlying measurement methodology and definitions from the disputing sources.";
    case "incomplete_provenance":
      return "Re-derive the unsupported assertions from dated sources, or drop them from the product.";
  }
}

export function isAbstention(
  verdict: AbstentionVerdict,
): verdict is Extract<AbstentionVerdict, { verdict: "INSUFFICIENT_EVIDENCE" }> {
  return verdict.verdict === "INSUFFICIENT_EVIDENCE";
}
