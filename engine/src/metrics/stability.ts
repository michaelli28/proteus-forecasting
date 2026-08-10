/**
 * Inter-run stability: identical inputs, different seeds, how much does the
 * headline judgement move?
 *
 * The differentiator metric. LLM ensembles are wildly unstable here and almost
 * nobody measures it — a system that returns "likely" on Monday and "unlikely"
 * on Tuesday from the same inputs is not a forecasting system, however good its
 * Brier score looks once averaged.
 */

import { mean } from "./types.js";
import type { CategoricalForecast } from "./types.js";

export interface StabilityReport {
  readonly repetitions: number;
  /** Fraction of repetitions agreeing with the modal leading band. */
  readonly headlineAgreement: number;
  /** Mean pairwise total-variation distance between repeated forecasts. */
  readonly meanTotalVariation: number;
  /** Largest pairwise total-variation distance. */
  readonly maxTotalVariation: number;
  /** Per-band standard deviation of assigned probability. */
  readonly bandStdDev: readonly number[];
  /** Largest per-band standard deviation. */
  readonly worstBandStdDev: number;
  /** The band most often ranked first. */
  readonly modalLeadingBand: number;
}

/**
 * Total variation distance between two distributions: half the L1 distance.
 * In [0,1]; 0 is identical, 1 is disjoint support.
 */
export function totalVariationDistance(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length)
    throw new RangeError("distributions differ in length");
  return a.reduce((sum, p, i) => sum + Math.abs(p - b[i]!), 0) / 2;
}

function leadingBand(probabilities: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i]! > probabilities[best]!) best = i;
  }
  return best;
}

/**
 * Stability across repetitions of the same question.
 *
 * `repeats` must be forecasts of the SAME question under different seeds. This
 * measures the system's own noise, not question difficulty.
 */
export function stabilityReport(
  repeats: readonly CategoricalForecast[],
): StabilityReport {
  if (repeats.length < 2)
    throw new RangeError("stability needs at least 2 repetitions");

  const bandCount = repeats[0]!.probabilities.length;
  for (const repeat of repeats) {
    if (repeat.probabilities.length !== bandCount) {
      throw new RangeError("repetitions disagree on band count");
    }
  }

  const leaders = repeats.map((r) => leadingBand(r.probabilities));
  const tally = new Map<number, number>();
  for (const leader of leaders) tally.set(leader, (tally.get(leader) ?? 0) + 1);
  let modalLeadingBand = leaders[0]!;
  let modalCount = 0;
  for (const [band, count] of [...tally.entries()].sort(([a], [b]) => a - b)) {
    if (count > modalCount) {
      modalCount = count;
      modalLeadingBand = band;
    }
  }

  const distances: number[] = [];
  for (let i = 0; i < repeats.length; i++) {
    for (let j = i + 1; j < repeats.length; j++) {
      distances.push(
        totalVariationDistance(
          repeats[i]!.probabilities,
          repeats[j]!.probabilities,
        ),
      );
    }
  }

  const bandStdDev = Array.from({ length: bandCount }, (_, band) => {
    const values = repeats.map((r) => r.probabilities[band]!);
    const m = mean(values);
    return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
  });

  return {
    repetitions: repeats.length,
    headlineAgreement: modalCount / repeats.length,
    meanTotalVariation: mean(distances),
    maxTotalVariation: distances.length === 0 ? 0 : Math.max(...distances),
    bandStdDev,
    worstBandStdDev: Math.max(...bandStdDev),
    modalLeadingBand,
  };
}

/** Headline agreement below this makes a single run unreportable on its own. */
export const STABILITY_FLOOR = 0.8;

export function isStable(
  report: StabilityReport,
  floor = STABILITY_FLOOR,
): boolean {
  return report.headlineAgreement >= floor;
}
