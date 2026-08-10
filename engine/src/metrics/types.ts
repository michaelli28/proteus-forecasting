/**
 * Forecast and outcome primitives for scoring.
 *
 * Two shapes because the literature splits: Brier, Murphy and calibration are
 * classically defined on binary forecasts, while this system forecasts over an
 * ordered partition of outcome bands. Both are first-class here so neither has
 * to be faked by collapsing the other.
 */

/** A forecast over an ordered, mutually exclusive, exhaustive set of bands. */
export interface CategoricalForecast {
  readonly id: string;
  /** One probability per band, in band order. Should sum to 1. */
  readonly probabilities: readonly number[];
  /** Index of the band that actually occurred. */
  readonly outcomeIndex: number;
}

export interface BinaryForecast {
  readonly id: string;
  /** P(event). */
  readonly probability: number;
  /** 1 if the event occurred. */
  readonly outcome: 0 | 1;
}

/** Probabilities that are not finite, in [0,1], and summing to ~1 are a bug. */
export function assertValidProbabilities(
  probabilities: readonly number[],
  tolerance = 1e-6,
): void {
  if (probabilities.length === 0) {
    throw new RangeError("forecast has no probabilities");
  }
  let total = 0;
  for (const p of probabilities) {
    if (!Number.isFinite(p))
      throw new TypeError(`non-finite probability: ${p}`);
    if (p < 0 || p > 1) throw new RangeError(`probability out of [0,1]: ${p}`);
    total += p;
  }
  if (Math.abs(total - 1) > tolerance) {
    throw new RangeError(`probabilities sum to ${total}, expected 1`);
  }
}

export function assertValidForecast(forecast: CategoricalForecast): void {
  assertValidProbabilities(forecast.probabilities);
  const { outcomeIndex, probabilities } = forecast;
  if (
    !Number.isInteger(outcomeIndex) ||
    outcomeIndex < 0 ||
    outcomeIndex >= probabilities.length
  ) {
    throw new RangeError(
      `outcomeIndex ${outcomeIndex} outside 0..${probabilities.length - 1}`,
    );
  }
}

/** Collapse a categorical forecast to a binary one about a chosen band. */
export function toBinary(
  forecast: CategoricalForecast,
  bandIndex: number,
): BinaryForecast {
  return {
    id: forecast.id,
    probability: forecast.probabilities[bandIndex] ?? 0,
    outcome: forecast.outcomeIndex === bandIndex ? 1 : 0,
  };
}

/** One-hot vector for a realized outcome. */
export function oneHot(length: number, index: number): number[] {
  return Array.from({ length }, (_, i) => (i === index ? 1 : 0));
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
