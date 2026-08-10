/**
 * Turning an ensemble into an evidence base the abstention gate can judge.
 *
 * Every function here is mechanical. That is the point: the gate has to fire
 * before any likelihood exists, so it cannot depend on an adjudicator that may
 * decline to answer. An ensemble that concentrates produces evidence that
 * discriminates; an ensemble that spreads produces evidence that discriminates
 * nothing, and the gate sees the difference without asking a model.
 */

import { CONFIDENCE_LEVELS, aggregateConfidence } from "../evidence/icd203.js";
import {
  SIMULATION_READING_CREDIBILITY,
  SIMULATION_SOURCE_ID,
  orderedBands,
} from "./types.js";
import type {
  ConfidenceDriver,
  ConfidenceDriverKind,
  ConfidenceLevel,
} from "../evidence/icd203.js";
import type { AchCell, AchMatrix } from "../evidence/ach.js";
import type { ContradictionReport } from "../evidence/contradiction.js";
import type { AsOfCorpus } from "../corpus/as-of.js";
import type { OutcomeBand } from "../evidence/partition.js";
import type { Claim, EvidenceItem, Indicator } from "../evidence/types.js";
import type { RunSummary } from "./types.js";

// ─── Evidence ───

/**
 * One dated reading per ensemble member.
 *
 * Dated at the run's information cutoff rather than at wall-clock time: the
 * reading is a statement about the world as of that date, and giving it any
 * later date would make it unciteable under the leakage guard for no reason.
 */
export function evidenceFromEnsemble(
  summaries: readonly RunSummary[],
  asOf: string,
  credibility = SIMULATION_READING_CREDIBILITY,
): EvidenceItem[] {
  return summaries.map((summary) => ({
    id: `reading-${summary.specId}`,
    documentId: summary.runId,
    sourceId: SIMULATION_SOURCE_ID,
    publishedAt: asOf,
    credibility,
    summary: `Scenario ${summary.label} terminated at ${summary.quantity.toFixed(4)}, inside band ${summary.bandId}.`,
  }));
}

/**
 * The ACH matrix, scored mechanically.
 *
 * A reading is consistent with the band it landed in and inconsistent with every
 * other — which is what an outcome band MEANS. Diagnosticity then falls out of
 * Heuer's formula: when the ensemble concentrates, readings split the hypothesis
 * set and discriminate; when it spreads, every band collects the same weight of
 * inconsistency and separation goes to zero.
 */
export function achMatrixFromEnsemble(
  bands: readonly OutcomeBand[],
  summaries: readonly RunSummary[],
  asOf: string,
  credibility = SIMULATION_READING_CREDIBILITY,
): AchMatrix {
  const hypotheses = orderedBands(bands).map((band) => ({
    id: band.id,
    statement: band.statement,
  }));
  const evidence = evidenceFromEnsemble(summaries, asOf, credibility);

  const cells: AchCell[] = [];
  evidence.forEach((item, index) => {
    const landed = summaries[index]!.bandId;
    for (const hypothesis of hypotheses) {
      cells.push({
        evidenceId: item.id,
        hypothesisId: hypothesis.id,
        verdict: hypothesis.id === landed ? "consistent" : "inconsistent",
      });
    }
  });

  return { hypotheses, evidence, cells };
}

// ─── Claims ───

export interface EnsembleClaimInput {
  readonly summaries: readonly RunSummary[];
  readonly bands: readonly OutcomeBand[];
  readonly asOf: string;
}

/** One claim per occupied band, each citing the runs that support it. */
export function claimsFromEnsemble(input: EnsembleClaimInput): Claim[] {
  const { summaries, asOf } = input;
  const total = summaries.length;

  return orderedBands(input.bands)
    .map((band) => ({
      band,
      members: summaries.filter((s) => s.bandId === band.id),
    }))
    .filter((entry) => entry.members.length > 0)
    .map(({ band, members }) => ({
      text: `${members.length} of ${total} scenarios terminated inside ${band.id} (${band.statement}).`,
      support: members.map((member) => ({
        sourceId: SIMULATION_SOURCE_ID,
        documentId: member.runId,
        publishedAt: asOf,
        credibility: SIMULATION_READING_CREDIBILITY,
        excerpt: `${member.label}: ${member.quantity.toFixed(4)}`,
      })),
    }));
}

/**
 * Claims recording disagreement the pipeline could not reconcile.
 *
 * Dates come from the DOCUMENT, never from the fact's own as-of date — a
 * reading can legitimately describe a period after the document that reports it,
 * and using the later date would trip the leakage guard on evidence that never
 * leaked. Parties whose document is not visible at this cutoff are dropped.
 */
export function claimsFromContradictions(
  report: ContradictionReport,
  corpus: AsOfCorpus,
): Claim[] {
  return report.unresolved
    .map((conflict) => {
      const support = conflict.parties
        .map((party) => {
          const document = corpus.getDocument(party.documentId);
          if (!document) return null;
          return {
            sourceId: party.sourceId,
            documentId: party.documentId,
            publishedAt: document.publishedAt,
            credibility: party.credibility,
            excerpt: `${conflict.subject} reported as ${party.value}`,
          };
        })
        .filter((ref): ref is NonNullable<typeof ref> => ref !== null);

      return {
        text: `Sources disagree on ${conflict.subject} and the dispute is unreconciled; it is carried into confidence rather than resolved.`,
        support,
      };
    })
    .filter((claim) => claim.support.length > 0);
}

// ─── Confidence ───

/**
 * What confidence is assessed on.
 *
 * Deliberately absent: how spread out the forecast is. That is uncertainty, it
 * belongs in the likelihood, and folding it into confidence is exactly the
 * ICD 203 conflation this system refuses to make. "Roughly even, high
 * confidence" is a coherent and useful judgement.
 */
export interface ConfidenceInput {
  /** Share of planned ensemble members that finished. */
  readonly ensembleCompletion: number;
  readonly unresolvedRate: number;
  readonly provenanceCompleteness: number;
  readonly adjudicationAvailable: boolean;
  /** Weighted severity of surviving red-team challenges, in [0,1]. */
  readonly redTeamPenalty: number;
}

export interface ConfidenceAssessment {
  readonly level: ConfidenceLevel;
  readonly drivers: readonly ConfidenceDriver[];
}

/** Numeric rank, for degradation checks only. Never shown to an analyst. */
export function confidenceScore(level: ConfidenceLevel): number {
  return CONFIDENCE_LEVELS.indexOf(level) / (CONFIDENCE_LEVELS.length - 1);
}

function band(
  value: number,
  highAtLeast: number,
  moderateAtLeast: number,
): ConfidenceLevel {
  if (value >= highAtLeast) return "high";
  if (value >= moderateAtLeast) return "moderate";
  return "low";
}

function descending(
  value: number,
  highBelow: number,
  moderateBelow: number,
): ConfidenceLevel {
  if (value < highBelow) return "high";
  if (value < moderateBelow) return "moderate";
  return "low";
}

/**
 * Weakest-link confidence.
 *
 * Never a mean: averaging lets four comfortable dimensions outvote the one that
 * is actually broken, which is how a product ends up reporting high confidence
 * on an evidence base its own sources dispute.
 */
export function assessConfidence(input: ConfidenceInput): ConfidenceAssessment {
  const assessed: {
    kind: ConfidenceDriverKind;
    level: ConfidenceLevel;
    note: string;
  }[] = [
    {
      kind: "source_corroboration",
      level: band(input.ensembleCompletion, 0.9, 0.6),
      note: `${Math.round(input.ensembleCompletion * 100)}% of planned scenarios completed`,
    },
    {
      kind: "unresolved_contradiction",
      level: descending(input.unresolvedRate, 0.1, 0.35),
      note: `${Math.round(input.unresolvedRate * 100)}% of detected source conflicts remain unreconciled`,
    },
    {
      kind: "source_quality",
      level: band(input.provenanceCompleteness, 0.95, 0.8),
      note: `${Math.round(input.provenanceCompleteness * 100)}% of assertions trace to a dated source`,
    },
    {
      // Losing the adjudication layer removes a cross-check on a forecast the
      // ensemble can still produce on its own. That caps confidence; it does not
      // destroy it, and pretending otherwise would make the level constant and
      // therefore uninformative in the regime we are actually operating in.
      kind: "assumption_load",
      level: input.adjudicationAvailable ? "high" : "moderate",
      note: input.adjudicationAvailable
        ? "structured-technique adjudication cross-checked the ensemble"
        : "adjudication unavailable — the ensemble forecast stands uncross-checked",
    },
    {
      kind: "evidence_gaps",
      level: descending(input.redTeamPenalty, 0.15, 0.35),
      note: `surviving red-team challenge weight ${input.redTeamPenalty.toFixed(2)}`,
    },
  ];

  return {
    level: aggregateConfidence(assessed.map((entry) => entry.level)),
    drivers: assessed.map((entry) => ({
      kind: entry.kind,
      effect: entry.level === "high" ? "raises" : "lowers",
      note: entry.note,
    })),
  };
}

// ─── Indicators ───

/** Below this the channel is not telling the analyst anything. */
const MIN_LOG_LIKELIHOOD_RATIO = 0.05;

const MAX_INDICATORS = 3;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Warning indicators computed from telemetry, not asked of a model.
 *
 * For each channel: how much more often does it run hot when the outcome lands
 * in the leading band than when it does not? That ratio is what an analyst
 * actually uses — "if you see this, the leading branch just got more likely" —
 * and it is available even when every adjudicator declines to answer.
 *
 * Add-half smoothing keeps a small ensemble from claiming an infinite ratio off
 * a single run.
 */
export function indicatorsFromEnsemble(
  summaries: readonly RunSummary[],
  leadingBandId: string,
): Indicator[] {
  const leading = summaries.filter((s) => s.bandId === leadingBandId);
  const rest = summaries.filter((s) => s.bandId !== leadingBandId);
  // Nothing discriminates when everything agrees; saying otherwise would be
  // manufacturing an indicator out of unanimity.
  if (leading.length === 0 || rest.length === 0) return [];

  const channels = [
    ...new Set(summaries.flatMap((s) => Object.keys(s.signatures))),
  ].sort();

  return channels
    .map((channel) => {
      const valueOf = (s: RunSummary) => s.signatures[channel] ?? 0;
      const threshold = median(summaries.map(valueOf));
      const above = (group: readonly RunSummary[]) =>
        group.filter((s) => valueOf(s) > threshold).length;

      const pLeading = (above(leading) + 0.5) / (leading.length + 1);
      const pRest = (above(rest) + 0.5) / (rest.length + 1);

      return {
        observable: `${channel} above ${threshold.toFixed(4)}`,
        favorsHypothesis: leadingBandId,
        likelihoodRatio: pLeading / pRest,
        instrumentChannel: channel,
      };
    })
    .filter(
      (indicator) =>
        Math.abs(Math.log(indicator.likelihoodRatio)) >=
        MIN_LOG_LIKELIHOOD_RATIO,
    )
    .sort(
      (a, b) =>
        Math.abs(Math.log(b.likelihoodRatio)) -
          Math.abs(Math.log(a.likelihoodRatio)) ||
        a.instrumentChannel.localeCompare(b.instrumentChannel),
    )
    .slice(0, MAX_INDICATORS);
}

// ─── The restricted view handed to prompts ───

/**
 * What an adjudicator is allowed to see of the ensemble.
 *
 * Distribution over bands plus mean telemetry — never a per-run trace, and
 * never anything derived from the oracle run, which does not travel through
 * this function at all.
 */
export function ensembleSummaryText(
  summaries: readonly RunSummary[],
  bands: readonly OutcomeBand[],
): string {
  const total = summaries.length;
  const lines = [
    `Ensemble: ${total} runs across ${bands.length} outcome bands.`,
  ];

  for (const band of orderedBands(bands)) {
    const count = summaries.filter((s) => s.bandId === band.id).length;
    const share = total === 0 ? 0 : Math.round((count / total) * 100);
    lines.push(
      `  ${band.id}  ${count}/${total} runs (${share}%)  [${band.lower}, ${band.upper}) — ${band.statement}`,
    );
  }

  const channels = [
    ...new Set(summaries.flatMap((s) => Object.keys(s.signatures))),
  ].sort();
  if (channels.length > 0) {
    const means = channels.map((channel) => {
      const values = summaries.map((s) => s.signatures[channel] ?? 0);
      const mean =
        values.length === 0
          ? 0
          : values.reduce((sum, v) => sum + v, 0) / values.length;
      return `${channel} ${mean.toFixed(4)}`;
    });
    lines.push(`  instrument channels (ensemble mean): ${means.join(", ")}`);
  }

  return lines.join("\n");
}
