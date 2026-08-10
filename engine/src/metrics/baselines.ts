/**
 * Explicit baselines for skill scoring.
 *
 * A Brier score without a baseline is close to meaningless. On a question set
 * where the event is rare, answering "almost no chance" every time scores
 * beautifully and knows nothing — the skill score against a base-rate baseline
 * is what exposes that.
 */

import { mean } from "./types.js";
import type { BinaryForecast, CategoricalForecast } from "./types.js";

export const BASELINE_KINDS = [
  "base_rate",
  "uniform",
  "single_model",
  "human_analyst",
] as const;
export type BaselineKind = (typeof BASELINE_KINDS)[number];

/**
 * Always forecast the observed base rate.
 *
 * The baseline to beat: perfectly calibrated, zero resolution. Anything that
 * cannot beat it has learned nothing about individual questions.
 */
export function baseRateBaseline(
  forecasts: readonly BinaryForecast[],
): BinaryForecast[] {
  const rate = mean(forecasts.map((f) => f.outcome));
  return forecasts.map((f) => ({
    id: f.id,
    probability: rate,
    outcome: f.outcome,
  }));
}

/** Always forecast 1/bands. Knows nothing, including the base rate. */
export function uniformBaseline(
  forecasts: readonly CategoricalForecast[],
): CategoricalForecast[] {
  return forecasts.map((f) => ({
    id: f.id,
    probabilities: f.probabilities.map(() => 1 / f.probabilities.length),
    outcomeIndex: f.outcomeIndex,
  }));
}

/** Always forecast 0.5. The binary no-information baseline. */
export function coinFlipBaseline(
  forecasts: readonly BinaryForecast[],
): BinaryForecast[] {
  return forecasts.map((f) => ({
    id: f.id,
    probability: 0.5,
    outcome: f.outcome,
  }));
}

/**
 * Single-run baseline: one ensemble member, no aggregation.
 *
 * The comparison that answers "is the fan-out doing anything?" If N runs do not
 * beat one run, the Monte Carlo layer is expensive decoration.
 */
export function singleRunBaseline(
  id: string,
  runBandIndex: number,
  bandCount: number,
  outcomeIndex: number,
  smoothingAlpha = 1,
): CategoricalForecast {
  const counts = new Array<number>(bandCount).fill(0);
  counts[runBandIndex] = 1;
  const total = 1 + smoothingAlpha * bandCount;
  return {
    id,
    probabilities: counts.map((c) => (c + smoothingAlpha) / total),
    outcomeIndex,
  };
}

export interface BaselineComparison {
  readonly kind: BaselineKind;
  readonly score: number;
  readonly skillScore: number;
}

/**
 * Score a system against several baselines at once.
 *
 * `human_analyst` is deliberately absent unless supplied: it requires measuring
 * a human on the same questions, and inventing that number would be the single
 * most misleading thing this package could do.
 */
export function compareToBaselines(
  systemScore: number,
  baselines: readonly { kind: BaselineKind; score: number }[],
): BaselineComparison[] {
  return baselines.map(({ kind, score }) => ({
    kind,
    score,
    skillScore:
      score === 0
        ? systemScore === 0
          ? 0
          : -Infinity
        : 1 - systemScore / score,
  }));
}
