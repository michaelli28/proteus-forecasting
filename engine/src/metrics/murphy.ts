/**
 * Murphy decomposition: Brier = reliability − resolution + uncertainty.
 *
 * Worth the extra machinery because reliability and resolution fail in opposite
 * directions and one Brier number hides which:
 *
 *   - poor RELIABILITY  = the stated probabilities are wrong (say 70%, happens 40%)
 *   - poor RESOLUTION   = the probabilities are honest but undiscriminating
 *                         (say the base rate every time and be perfectly calibrated
 *                         while knowing nothing)
 *   - UNCERTAINTY       = the question set's intrinsic difficulty; not the
 *                         system's fault and not improvable by it
 *
 * A system can look identical on Brier while being useless in either direction,
 * so the decomposition is what actually tells you where to work.
 */

import { brierScore } from "./brier.js";
import { mean } from "./types.js";
import type { BinaryForecast } from "./types.js";

export interface MurphyDecomposition {
  readonly brier: number;
  /** Mean squared gap between stated probability and realized frequency. Lower better. */
  readonly reliability: number;
  /** Variance of realized frequency across forecast groups. Higher better. */
  readonly resolution: number;
  /** Base-rate variance ō(1−ō). A property of the questions, not the forecaster. */
  readonly uncertainty: number;
  /** brier − (reliability − resolution + uncertainty). Should be ~0. */
  readonly residual: number;
  readonly baseRate: number;
  readonly groups: readonly MurphyGroup[];
}

export interface MurphyGroup {
  readonly forecast: number;
  readonly count: number;
  readonly observedFrequency: number;
}

/**
 * Exact decomposition, grouping by unique forecast value.
 *
 * Grouping by value rather than by binned range makes the identity hold exactly.
 * Binning introduces a within-bin variance term, which shows up as a non-zero
 * residual and makes reliability look better than it is.
 */
export function murphyDecomposition(
  forecasts: readonly BinaryForecast[],
): MurphyDecomposition {
  if (forecasts.length === 0) throw new RangeError("no forecasts to decompose");

  const n = forecasts.length;
  const baseRate = mean(forecasts.map((f) => f.outcome));

  const byValue = new Map<number, BinaryForecast[]>();
  for (const forecast of forecasts) {
    const bucket = byValue.get(forecast.probability) ?? [];
    bucket.push(forecast);
    byValue.set(forecast.probability, bucket);
  }

  const groups: MurphyGroup[] = [...byValue.entries()]
    .sort(([a], [b]) => a - b)
    .map(([forecast, members]) => ({
      forecast,
      count: members.length,
      observedFrequency: mean(members.map((m) => m.outcome)),
    }));

  let reliability = 0;
  let resolution = 0;
  for (const group of groups) {
    const weight = group.count / n;
    reliability += weight * (group.forecast - group.observedFrequency) ** 2;
    resolution += weight * (group.observedFrequency - baseRate) ** 2;
  }

  const uncertainty = baseRate * (1 - baseRate);
  const brier = brierScore(forecasts);

  return {
    brier,
    reliability,
    resolution,
    uncertainty,
    residual: brier - (reliability - resolution + uncertainty),
    baseRate,
    groups,
  };
}

/**
 * Skill attributable to discrimination alone: resolution / uncertainty.
 *
 * 0 means the forecaster never departs usefully from the base rate; 1 means it
 * separates outcomes perfectly. Unlike Brier skill it cannot be gamed by
 * hedging, because hedging drives resolution to zero.
 */
export function resolutionRatio(decomposition: MurphyDecomposition): number {
  if (decomposition.uncertainty === 0) return 0;
  return decomposition.resolution / decomposition.uncertainty;
}

/** Reliability normalized by uncertainty, so it is comparable across question sets. */
export function reliabilityRatio(decomposition: MurphyDecomposition): number {
  if (decomposition.uncertainty === 0) return 0;
  return decomposition.reliability / decomposition.uncertainty;
}
