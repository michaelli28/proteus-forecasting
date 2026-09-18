/**
 * The BLUF product.
 *
 * Two constructors, not one with a flag. An abstained product has no ranked
 * hypotheses AT ALL — there is no field for a likelihood to hide in, so
 * "the gate ran before any likelihood was emitted" is a property of the type
 * rather than a promise about the control flow.
 */

import { formatJudgment, judgmentFromProbability } from "../evidence/icd203.js";
import { assertValidProbabilities } from "../metrics/types.js";
import { orderedBands } from "./types.js";
import type { AbstentionVerdict } from "../evidence/abstention.js";
import type { HypothesisScore } from "../evidence/ach.js";
import type { OutcomeBand } from "../evidence/partition.js";
import type {
  AnalyticProduct,
  Claim,
  Indicator,
  KeyAssumption,
  RankedHypothesis,
  RedTeamChallenge,
} from "../evidence/types.js";
import type { ConfidenceAssessment } from "./analysis.js";

interface ProductBase {
  readonly question: string;
  readonly asOf: string;
  readonly corpusSnapshotId: string;
  readonly bands: readonly OutcomeBand[];
  readonly claims: readonly Claim[];
  readonly keyAssumptions: readonly KeyAssumption[];
  readonly indicators: readonly Indicator[];
  readonly redTeam: readonly RedTeamChallenge[];
}

export interface ForecastProductInput extends ProductBase {
  /** One probability per band, in band order. */
  readonly probabilities: readonly number[];
  readonly achScores: readonly HypothesisScore[];
  readonly confidence: ConfidenceAssessment;
}

export interface AbstainedProductInput extends ProductBase {
  readonly verdict: AbstentionVerdict;
}

export function buildForecastProduct(
  input: ForecastProductInput,
): AnalyticProduct {
  const bands = orderedBands(input.bands);
  if (input.probabilities.length !== bands.length) {
    throw new RangeError(
      `forecast has ${input.probabilities.length} probabilities for ${bands.length} bands`,
    );
  }
  assertValidProbabilities(input.probabilities);

  const achScore = new Map(
    input.achScores.map((score) => [score.hypothesisId, score.score]),
  );

  const hypotheses: RankedHypothesis[] = bands.map((band, index) => ({
    hypothesis: { id: band.id, statement: band.statement },
    judgment: judgmentFromProbability(
      input.probabilities[index]!,
      input.confidence.level,
      input.confidence.drivers,
    ),
    achScore: achScore.get(band.id) ?? 0,
    // A ratio below 1 is evidence against the band it names, so it is no
    // driver of it, whatever the indicator claims to favour.
    drivers: input.indicators
      .filter(
        (indicator) =>
          indicator.favorsHypothesis === band.id &&
          indicator.likelihoodRatio >= 1,
      )
      .map((indicator) => indicator.observable),
  }));

  const leading = [...hypotheses].sort(
    (a, b) =>
      b.judgment.likelihoodPoint - a.judgment.likelihoodPoint ||
      a.hypothesis.id.localeCompare(b.hypothesis.id),
  )[0]!;

  return {
    question: input.question,
    bluf: `${leading.hypothesis.statement} — ${formatJudgment(leading.judgment)}.`,
    asOf: input.asOf,
    corpusSnapshotId: input.corpusSnapshotId,
    hypotheses,
    keyAssumptions: input.keyAssumptions,
    indicators: input.indicators,
    claims: input.claims,
    redTeam: input.redTeam,
  };
}

export function buildAbstainedProduct(
  input: AbstainedProductInput,
): AnalyticProduct {
  if (input.verdict.verdict !== "INSUFFICIENT_EVIDENCE") {
    throw new Error(
      "buildAbstainedProduct called on a PROCEED verdict — the caller has the gate backwards",
    );
  }

  const reasons = input.verdict.findings.map((finding) => finding.reason);
  return {
    question: input.question,
    bluf: `Insufficient evidence to issue a judgement. ${input.verdict.findings
      .map((finding) => finding.detail)
      .join(" ")}`,
    asOf: input.asOf,
    corpusSnapshotId: input.corpusSnapshotId,
    // Empty by construction: an abstention that still shipped a ranked
    // hypothesis list would be a forecast wearing a disclaimer.
    hypotheses: [],
    keyAssumptions: input.keyAssumptions,
    indicators: input.indicators,
    claims: input.claims,
    redTeam: input.redTeam,
    abstention: {
      reasons,
      evidenceGaps: input.verdict.evidenceGaps,
    },
  };
}

/** Analyst-facing rendering. Always both axes, always the provenance caveat. */
export function formatProduct(product: AnalyticProduct): string {
  const lines = [
    `QUESTION: ${product.question}`,
    `AS OF:    ${product.asOf}  (corpus ${product.corpusSnapshotId.slice(0, 12)})`,
    "",
    `BLUF: ${product.bluf}`,
  ];

  if (product.abstention) {
    lines.push("", "WHAT WOULD CHANGE THIS:");
    for (const gap of product.abstention.evidenceGaps) lines.push(`  - ${gap}`);
  } else {
    lines.push("", "HYPOTHESES");
    for (const ranked of product.hypotheses) {
      lines.push(
        `  ${ranked.hypothesis.id}  ${formatJudgment(ranked.judgment)}  ${ranked.hypothesis.statement}`,
      );
    }
  }

  if (product.indicators.length > 0) {
    lines.push("", "INDICATORS & WARNINGS");
    for (const indicator of product.indicators) {
      lines.push(
        `  ${indicator.observable} → ${indicator.likelihoodRatio >= 1 ? "favours" : "weighs against"} ${indicator.favorsHypothesis} (LR ${indicator.likelihoodRatio.toFixed(2)}, channel ${indicator.instrumentChannel})`,
      );
    }
  }

  if (product.keyAssumptions.length > 0) {
    lines.push("", "KEY ASSUMPTIONS");
    for (const assumption of product.keyAssumptions) {
      lines.push(
        `  ${assumption.statement}  [falsified by: ${assumption.falsifier}]`,
      );
    }
  }

  if (product.redTeam.length > 0) {
    lines.push("", "RED TEAM");
    for (const challenge of product.redTeam) {
      lines.push(`  (${challenge.severity}) ${challenge.challenge}`);
    }
  }

  lines.push(
    "",
    "PROVENANCE: judgements derive from a closed-world synthetic simulation. Numbers",
    "describe the model, and say nothing on their own about real-world forecasting skill.",
  );

  return lines.join("\n");
}
