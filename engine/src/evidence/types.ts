/**
 * Analytic primitives: hypotheses, evidence, claims, provenance.
 *
 * Claims are structured rather than prose so provenance completeness and the
 * unsupported-assertion rate are counted, not estimated. The report writer emits
 * Claim[] and prose is rendered from it — never the other way round.
 */

import type { ConfidenceLevel, Judgment } from "./icd203.js";

/** ACH cell verdicts. Heuer's three states, nothing more. */
export const ACH_VERDICTS = [
  "consistent",
  "inconsistent",
  "not_applicable",
] as const;
export type AchVerdict = (typeof ACH_VERDICTS)[number];

export interface Hypothesis {
  readonly id: string;
  readonly statement: string;
}

/** One piece of evidence, always traceable to a dated source. */
export interface EvidenceItem {
  readonly id: string;
  readonly documentId: string;
  readonly sourceId: string;
  /** ISO date. Required — undated evidence cannot pass the leakage guard. */
  readonly publishedAt: string;
  /** Source reliability in [0,1]. Weights the ACH score; never a hard filter. */
  readonly credibility: number;
  readonly summary: string;
}

/** A citation attached to a claim. */
export interface EvidenceRef {
  readonly sourceId: string;
  readonly documentId: string;
  readonly publishedAt: string;
  readonly credibility: number;
  readonly excerpt: string;
}

/**
 * An assertion in the final product.
 *
 * An empty `support` array is not blocked — it is counted, and the count is a
 * reported metric. Blocking would just push unsupported reasoning into prose
 * where it cannot be measured.
 */
export interface Claim {
  readonly text: string;
  readonly support: readonly EvidenceRef[];
}

/** An assumption the judgement rests on, with what would break it. */
export interface KeyAssumption {
  readonly statement: string;
  readonly confidence: ConfidenceLevel;
  /** Required. An assumption nobody can falsify is not an assumption. */
  readonly falsifier: string;
  readonly affectedHypotheses: readonly string[];
}

/**
 * An observable that discriminates between branches.
 *
 * The deliverable an analyst actually uses: "if you observe X, branch B just
 * became three times more likely" beats any single point prediction.
 */
export interface Indicator {
  readonly observable: string;
  readonly favorsHypothesis: string;
  /** Likelihood ratio: P(observable | hypothesis) / P(observable | not hypothesis). */
  readonly likelihoodRatio: number;
  /** Which of the simulation's instrument channels would register it. */
  readonly instrumentChannel: string;
}

/** A red-team challenge, with standing to force a rerun. */
export interface RedTeamChallenge {
  readonly challenge: string;
  readonly severity: "low" | "moderate" | "high";
  readonly forcesRerun: boolean;
  readonly targetHypothesis?: string;
}

/** The BLUF product. */
export interface AnalyticProduct {
  readonly question: string;
  readonly bluf: string;
  readonly asOf: string;
  readonly corpusSnapshotId: string;
  readonly hypotheses: readonly RankedHypothesis[];
  readonly keyAssumptions: readonly KeyAssumption[];
  readonly indicators: readonly Indicator[];
  readonly claims: readonly Claim[];
  readonly redTeam: readonly RedTeamChallenge[];
  /** Present only when the abstention gate fired. */
  readonly abstention?: AbstentionRecord;
}

export interface RankedHypothesis {
  readonly hypothesis: Hypothesis;
  readonly judgment: Judgment;
  /** Weighted inconsistency from ACH. Lower is stronger. */
  readonly achScore: number;
  readonly drivers: readonly string[];
}

export interface AbstentionRecord {
  readonly reasons: readonly string[];
  readonly evidenceGaps: readonly string[];
}
