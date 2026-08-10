/**
 * Ensemble quality: turning simulation runs into a forecast, and scoring the
 * ensemble as an ensemble rather than as a point estimate.
 *
 * With the LLM adjudication layer abstaining, `forecastFromEnsemble` is the
 * system's primary forecast path: the distribution of run outcomes across the
 * hypothesis bands IS a forecast, and a defensible one.
 */

import { cosineSimilarity } from "../util/vector.js";
import { mean } from "./types.js";
import type { CategoricalForecast } from "./types.js";

/**
 * Add-alpha smoothing weight.
 *
 * An 8-run ensemble that put nothing in a band must not therefore claim 0%.
 * Zero probabilities are both dishonest — no finite sample rules an outcome
 * out — and fatal to log scoring, which returns −∞ on them. alpha = 1 is
 * Laplace's rule; it is a documented choice, not a hidden fudge.
 */
export const DEFAULT_SMOOTHING_ALPHA = 1;

export interface EnsembleForecastOptions {
  readonly smoothingAlpha?: number;
}

/**
 * Histogram of run outcomes over bands, smoothed, as a categorical forecast.
 *
 * `runBandIndices[i]` is the band that run i landed in.
 */
export function forecastFromEnsemble(
  id: string,
  runBandIndices: readonly number[],
  bandCount: number,
  outcomeIndex: number,
  options: EnsembleForecastOptions = {},
): CategoricalForecast {
  if (bandCount < 1) throw new RangeError("bandCount must be >= 1");
  if (runBandIndices.length === 0) throw new RangeError("ensemble has no runs");

  const alpha = options.smoothingAlpha ?? DEFAULT_SMOOTHING_ALPHA;
  if (alpha < 0) throw new RangeError("smoothingAlpha must be >= 0");

  const counts = new Array<number>(bandCount).fill(0);
  for (const band of runBandIndices) {
    if (band < 0 || band >= bandCount) {
      throw new RangeError(`run landed outside the partition: band ${band}`);
    }
    counts[band]!++;
  }

  const total = runBandIndices.length + alpha * bandCount;
  return {
    id,
    probabilities: counts.map((c) => (c + alpha) / total),
    outcomeIndex,
  };
}

/**
 * Did the ensemble's top-n bands contain what happened?
 *
 * Hit rate at n, the honest question for a scenario set: an analyst reads the
 * top few scenarios, so a correct outcome ranked eighth of eight was not
 * delivered to them.
 */
export function coverageAtN(
  forecasts: readonly CategoricalForecast[],
  n: number,
): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts");
  if (n < 1) throw new RangeError("n must be >= 1");

  const hits = forecasts.filter((forecast) => {
    const ranked = forecast.probabilities
      .map((p, index) => ({ p, index }))
      .sort((a, b) => b.p - a.p || a.index - b.index)
      .slice(0, n);
    return ranked.some((entry) => entry.index === forecast.outcomeIndex);
  });

  return hits.length / forecasts.length;
}

/** Probability below which a realized outcome counts as a surprise. */
export const SURPRISE_THRESHOLD = 0.1;

export interface TailRecallReport {
  /** Realized outcomes the ensemble had assigned below the threshold. */
  readonly surprises: number;
  /** Of those, how many the ensemble gave any weight at all. */
  readonly recalled: number;
  /** recalled / surprises. 1 means no surprise was entirely unimagined. */
  readonly recall: number;
}

/**
 * Of the outcomes that actually surprised us, how many did the ensemble at least
 * consider? Distinct from coverage: this is about the tail specifically, which
 * is where the value of a scenario ensemble lives.
 */
export function tailRecall(
  forecasts: readonly CategoricalForecast[],
  threshold = SURPRISE_THRESHOLD,
  weightFloor = 0,
): TailRecallReport {
  const surprising = forecasts.filter(
    (f) => (f.probabilities[f.outcomeIndex] ?? 0) < threshold,
  );
  const recalled = surprising.filter(
    (f) => (f.probabilities[f.outcomeIndex] ?? 0) > weightFloor,
  );
  return {
    surprises: surprising.length,
    recalled: recalled.length,
    recall: surprising.length === 0 ? 1 : recalled.length / surprising.length,
  };
}

/**
 * Mean pairwise diversity across ensemble members, in [0,1].
 *
 * Cosine rather than Euclidean distance on purpose: two runs that explore the
 * same region at different intensities are the SAME scenario at different
 * scales, and an ensemble that counts scale as variety reports a diversity it
 * has not earned.
 */
export function ensembleDiversity(
  vectors: readonly (readonly number[])[],
): number {
  if (vectors.length < 2) return 0;
  const distances: number[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      distances.push(1 - cosineSimilarity([...vectors[i]!], [...vectors[j]!]));
    }
  }
  return mean(distances);
}

/** Spread of run outcomes across bands: how much of the partition was explored. */
export function bandCoverage(
  runBandIndices: readonly number[],
  bandCount: number,
): number {
  if (bandCount < 1) throw new RangeError("bandCount must be >= 1");
  return new Set(runBandIndices).size / bandCount;
}
