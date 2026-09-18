/**
 * Percentile bootstrap over questions, resampled within strata.
 *
 * Questions are the unit, not the one-vs-rest binary forecasts they expand
 * into: a question's B bands share one outcome, so resampling bands would treat
 * correlated rows as independent and shrink every interval. Stratifying by
 * prior box keeps each resample's mix of boxes fixed, since the benchmark's
 * questions come from only four.
 */

import { Rng } from "../sim/rng.js";

export interface Interval {
  /** The statistic on the original items. */
  readonly estimate: number;
  readonly lower: number;
  readonly upper: number;
  /** Resamples the statistic could score; the interval rests on these. */
  readonly resamples: number;
}

export interface BootstrapOptions<T> {
  readonly stratumOf: (item: T) => string;
  /** Null when a resample cannot be scored (e.g. every question abstained). */
  readonly statistic: (sample: readonly T[]) => number | null;
  readonly seed: string;
  readonly resamples?: number;
  readonly level?: number;
}

export const DEFAULT_RESAMPLES = 2000;

export function stratifiedBootstrap<T>(
  items: readonly T[],
  options: BootstrapOptions<T>,
): Interval | null {
  const estimate = options.statistic(items);
  if (estimate === null) return null;

  const strata = new Map<string, T[]>();
  for (const item of items) {
    const key = options.stratumOf(item);
    strata.set(key, [...(strata.get(key) ?? []), item]);
  }

  const rng = new Rng(options.seed);
  const stats: number[] = [];
  for (let b = 0; b < (options.resamples ?? DEFAULT_RESAMPLES); b++) {
    const sample: T[] = [];
    for (const members of strata.values()) {
      for (let i = 0; i < members.length; i++) {
        sample.push(members[Math.floor(rng.next() * members.length)]!);
      }
    }
    const value = options.statistic(sample);
    if (value !== null) stats.push(value);
  }
  if (stats.length === 0) return null;

  stats.sort((a, b) => a - b);
  const tail = (1 - (options.level ?? 0.95)) / 2;
  const at = (q: number) => stats[Math.round(q * (stats.length - 1))]!;
  return {
    estimate,
    lower: at(tail),
    upper: at(1 - tail),
    resamples: stats.length,
  };
}
