/**
 * Brier scores and skill scores.
 *
 * Ranges differ by variant and mixing them up silently halves or doubles a
 * headline number, so each is named and documented rather than left implicit.
 */

import { assertValidForecast, mean } from "./types.js";
import type { BinaryForecast, CategoricalForecast } from "./types.js";

/** Binary Brier score. Range [0,1]. Lower is better. */
export function brierScore(forecasts: readonly BinaryForecast[]): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts to score");
  return mean(forecasts.map((f) => (f.probability - f.outcome) ** 2));
}

/**
 * Multicategory Brier score, summed over classes (Brier 1950). Range [0,2].
 *
 * The factor-of-two trap: many papers report the half-Brier on [0,1] under the
 * same name. Use `halfBrierScore` when comparing against those.
 */
export function multicategoryBrierScore(
  forecasts: readonly CategoricalForecast[],
): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts to score");
  return mean(
    forecasts.map((forecast) => {
      assertValidForecast(forecast);
      return forecast.probabilities.reduce(
        (sum, p, k) => sum + (p - (k === forecast.outcomeIndex ? 1 : 0)) ** 2,
        0,
      );
    }),
  );
}

/** Multicategory Brier rescaled to [0,1], for comparison with binary scores. */
export function halfBrierScore(
  forecasts: readonly CategoricalForecast[],
): number {
  return multicategoryBrierScore(forecasts) / 2;
}

/**
 * Brier skill score against a reference: 1 − BS/BS_ref.
 *
 * 1 is perfect, 0 is no better than the reference, negative is worse. Reporting
 * a raw Brier without a baseline is close to meaningless — on a rare-event
 * question, always saying "no" scores well and knows nothing.
 */
export function brierSkillScore(score: number, referenceScore: number): number {
  if (referenceScore === 0) {
    // A perfect reference cannot be improved on; skill is 0 unless we also
    // scored perfectly. Dividing would produce Infinity or NaN.
    return score === 0 ? 0 : Number.NEGATIVE_INFINITY;
  }
  return 1 - score / referenceScore;
}

/** Per-item Brier contributions, for finding which questions hurt most. */
export function brierContributions(
  forecasts: readonly BinaryForecast[],
): { id: string; contribution: number }[] {
  return forecasts
    .map((f) => ({ id: f.id, contribution: (f.probability - f.outcome) ** 2 }))
    .sort((a, b) => b.contribution - a.contribution);
}
