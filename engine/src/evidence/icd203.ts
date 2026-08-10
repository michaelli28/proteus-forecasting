/**
 * ICD 203 analytic vocabulary.
 *
 * Likelihood and confidence are separate axes and are never combined into one
 * number. "Likely, low confidence" is a legitimate and common judgement; a
 * single blended score destroys the distinction an analyst is paid to draw.
 *
 * The separation is enforced structurally: nothing in this module — or anywhere
 * downstream — exports a function taking a Judgment and returning a scalar.
 * tests/evidence/icd203.test.ts asserts that no such function appears.
 */

/** ICD 203 likelihood expressions, ordered from least to most likely. */
export const LIKELIHOOD_BANDS = [
  "almost_no_chance",
  "very_unlikely",
  "unlikely",
  "roughly_even",
  "likely",
  "very_likely",
  "almost_certain",
] as const;
export type LikelihoodBand = (typeof LIKELIHOOD_BANDS)[number];

/** Probability interval per band, as published in ICD 203. */
export const BAND_RANGES: Readonly<
  Record<LikelihoodBand, readonly [number, number]>
> = {
  almost_no_chance: [0.01, 0.05],
  very_unlikely: [0.05, 0.2],
  unlikely: [0.2, 0.45],
  roughly_even: [0.45, 0.55],
  likely: [0.55, 0.8],
  very_likely: [0.8, 0.95],
  almost_certain: [0.95, 0.99],
};

export const CONFIDENCE_LEVELS = ["low", "moderate", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Why confidence sits where it does. Reported, never silently folded in. */
export const CONFIDENCE_DRIVER_KINDS = [
  "source_quality",
  "source_corroboration",
  "assumption_load",
  "evidence_gaps",
  "unresolved_contradiction",
] as const;
export type ConfidenceDriverKind = (typeof CONFIDENCE_DRIVER_KINDS)[number];

export interface ConfidenceDriver {
  readonly kind: ConfidenceDriverKind;
  readonly effect: "raises" | "lowers";
  readonly note: string;
}

/**
 * A judgement. `likelihoodPoint` exists so forecasts can be scored by Brier and
 * friends; it is never the thing shown to an analyst, and it carries no
 * information about confidence.
 */
export interface Judgment {
  readonly likelihood: LikelihoodBand;
  readonly likelihoodPoint: number;
  readonly confidence: ConfidenceLevel;
  readonly confidenceDrivers: readonly ConfidenceDriver[];
}

export function bandRange(band: LikelihoodBand): readonly [number, number] {
  return BAND_RANGES[band];
}

export function bandMidpoint(band: LikelihoodBand): number {
  const [min, max] = BAND_RANGES[band];
  return (min + max) / 2;
}

/** Nearest band for a probability. Values outside [0.01,0.99] clamp to the ends. */
export function bandForProbability(probability: number): LikelihoodBand {
  if (!Number.isFinite(probability))
    throw new TypeError("probability must be finite");
  if (probability <= 0.05) return "almost_no_chance";
  if (probability >= 0.95) return "almost_certain";
  for (const band of LIKELIHOOD_BANDS) {
    const [min, max] = BAND_RANGES[band];
    if (probability >= min && probability < max) return band;
  }
  return "roughly_even";
}

/** Build a judgement from a probability, keeping band and point consistent. */
export function judgmentFromProbability(
  probability: number,
  confidence: ConfidenceLevel,
  confidenceDrivers: readonly ConfidenceDriver[] = [],
): Judgment {
  return {
    likelihood: bandForProbability(probability),
    likelihoodPoint: probability,
    confidence,
    confidenceDrivers,
  };
}

const CONFIDENCE_RANK: Readonly<Record<ConfidenceLevel, number>> = {
  low: 0,
  moderate: 1,
  high: 2,
};

/**
 * Weakest-link confidence aggregation.
 *
 * Deliberately NOT a mean. An ensemble is no more confident than the evidence
 * base it shares, and averaging lets several moderate-confidence views
 * manufacture a high-confidence product out of nothing new.
 */
export function aggregateConfidence(
  levels: readonly ConfidenceLevel[],
): ConfidenceLevel {
  if (levels.length === 0) return "low";
  let lowest = CONFIDENCE_RANK[levels[0]!];
  for (const level of levels) lowest = Math.min(lowest, CONFIDENCE_RANK[level]);
  return CONFIDENCE_LEVELS[lowest]!;
}

/**
 * Ensemble likelihood as a weighted mean of point estimates.
 *
 * Likelihood may be averaged — it is a probability. Confidence may not, which is
 * why the two travel through different functions and meet only inside Judgment.
 */
export function aggregateLikelihood(
  points: readonly number[],
  weights?: readonly number[],
): number {
  if (points.length === 0)
    throw new RangeError("cannot aggregate an empty ensemble");
  const w = weights ?? points.map(() => 1);
  if (w.length !== points.length)
    throw new RangeError("weights length must match points");
  const total = w.reduce((sum, x) => sum + x, 0);
  if (total <= 0) throw new RangeError("weights must sum to > 0");
  return points.reduce((sum, p, i) => sum + p * w[i]!, 0) / total;
}

/** Analyst-facing rendering. Always shows both axes. */
export function formatJudgment(judgment: Judgment): string {
  const [min, max] = bandRange(judgment.likelihood);
  const label = judgment.likelihood.replace(/_/g, " ");
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return `${label} (${pct(min)}–${pct(max)}), ${judgment.confidence} confidence`;
}
