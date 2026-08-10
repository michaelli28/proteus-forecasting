/**
 * Log/ignorance scoring and sharpness.
 *
 * Sharpness is the antidote to the calibration loophole: a system that answers
 * the base rate on every question is perfectly calibrated and worthless. Brier
 * and ECE both reward that behaviour; sharpness exposes it.
 */

import { assertValidForecast, mean } from "./types.js";
import type { BinaryForecast, CategoricalForecast } from "./types.js";

/**
 * Probability floor for log scoring.
 *
 * A confident wrong answer at p=0 scores −∞ and destroys the mean, so one
 * question would decide the metric. Clipping bounds the penalty; the floor is
 * explicit because the choice changes the number.
 */
export const LOG_SCORE_EPSILON = 1e-6;

function clip(p: number): number {
  return Math.min(1 - LOG_SCORE_EPSILON, Math.max(LOG_SCORE_EPSILON, p));
}

/**
 * Ignorance score: mean −log2(probability assigned to what happened).
 *
 * In bits. 0 is perfect; 1 bit is a coin flip. Unlike Brier it is strictly
 * proper AND unboundedly punishing of confident errors, which is why it is
 * reported alongside rather than instead.
 */
export function ignoranceScore(forecasts: readonly BinaryForecast[]): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts to score");
  return mean(
    forecasts.map((f) => {
      const assigned = f.outcome === 1 ? f.probability : 1 - f.probability;
      return -Math.log2(clip(assigned));
    }),
  );
}

/** Ignorance score over an outcome partition. */
export function categoricalIgnoranceScore(
  forecasts: readonly CategoricalForecast[],
): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts to score");
  return mean(
    forecasts.map((forecast) => {
      assertValidForecast(forecast);
      return -Math.log2(clip(forecast.probabilities[forecast.outcomeIndex]!));
    }),
  );
}

/** Natural-log variant, for comparison with likelihood-based literature. */
export function logScore(forecasts: readonly BinaryForecast[]): number {
  return ignoranceScore(forecasts) * Math.LN2;
}

export interface SharpnessReport {
  /** Mean |p − base rate|. 0 means the forecaster never leaves the base rate. */
  readonly meanDeviationFromBaseRate: number;
  /** Variance of the stated probabilities. */
  readonly forecastVariance: number;
  /** Mean distance from maximum uncertainty (0.5). Higher means more decisive. */
  readonly meanDecisiveness: number;
  readonly baseRate: number;
  /** True when the forecaster is hedging near the base rate throughout. */
  readonly isHedging: boolean;
}

/** Below this mean deviation, the forecaster is effectively restating the base rate. */
export const HEDGING_THRESHOLD = 0.05;

/**
 * Sharpness of a forecast set.
 *
 * Deliberately independent of outcomes: sharpness is a property of the
 * forecasts alone. A system can be sharp and wrong — that combination shows up
 * in Brier, not here, and keeping them separate is the point.
 */
export function sharpness(
  forecasts: readonly BinaryForecast[],
): SharpnessReport {
  if (forecasts.length === 0) throw new RangeError("no forecasts");

  const probabilities = forecasts.map((f) => f.probability);
  const baseRate = mean(forecasts.map((f) => f.outcome));
  const meanForecast = mean(probabilities);

  const meanDeviationFromBaseRate = mean(
    probabilities.map((p) => Math.abs(p - baseRate)),
  );

  return {
    meanDeviationFromBaseRate,
    forecastVariance: mean(probabilities.map((p) => (p - meanForecast) ** 2)),
    meanDecisiveness: mean(probabilities.map((p) => Math.abs(p - 0.5))) * 2,
    baseRate,
    isHedging: meanDeviationFromBaseRate < HEDGING_THRESHOLD,
  };
}

/**
 * Shannon entropy of a categorical forecast, in bits.
 * Low entropy is a confident forecast; the maximum is log2(bands).
 */
export function forecastEntropy(probabilities: readonly number[]): number {
  return -probabilities.reduce(
    (sum, p) => (p <= 0 ? sum : sum + p * Math.log2(p)),
    0,
  );
}

/** Mean entropy across a forecast set, normalized to [0,1] by band count. */
export function meanNormalizedEntropy(
  forecasts: readonly CategoricalForecast[],
): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts");
  const bands = forecasts[0]!.probabilities.length;
  const maxEntropy = Math.log2(bands);
  if (maxEntropy === 0) return 0;
  return mean(
    forecasts.map((f) => forecastEntropy(f.probabilities) / maxEntropy),
  );
}
