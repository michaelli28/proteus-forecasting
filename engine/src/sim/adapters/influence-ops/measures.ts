/**
 * Population measures. Pure functions over belief arrays — no simulation state,
 * so every one of them is directly unit-testable against hand-computed values.
 */

import { ADOPTION_THRESHOLD } from "./config.js";
import type { Agent } from "./network.js";

/** Bimodality coefficient above this suggests a split rather than a spread. */
export const BIMODALITY_THRESHOLD = 5 / 9;

export function beliefsOn(
  agents: readonly Agent[],
  narrative: number,
): number[] {
  return agents.map((a) => a.belief[narrative] ?? 0);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

/** Central moment of the given order. */
function centralMoment(values: readonly number[], order: number): number {
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** order, 0) / values.length;
}

export function skewness(values: readonly number[]): number {
  const m2 = centralMoment(values, 2);
  if (m2 === 0) return 0;
  return centralMoment(values, 3) / m2 ** 1.5;
}

/** Non-excess kurtosis: 3 for a normal distribution. */
export function kurtosis(values: readonly number[]): number {
  const m2 = centralMoment(values, 2);
  if (m2 === 0) return 0;
  return centralMoment(values, 4) / m2 ** 2;
}

/**
 * Sarle's bimodality coefficient, (skew² + 1) / kurtosis.
 *
 * Chosen over raw variance because a campaign that pushes everyone slightly in
 * one direction and a campaign that splits the population in two produce similar
 * variance but very different societies.
 */
export function bimodalityCoefficient(values: readonly number[]): number {
  const k = kurtosis(values);
  if (k === 0) return 0;
  return (skewness(values) ** 2 + 1) / k;
}

/** Largest gap between any two cluster means — overt echo-chamber separation. */
export function clusterSeparation(
  agents: readonly Agent[],
  narrative: number,
): number {
  const sums = new Map<number, { total: number; count: number }>();
  for (const agent of agents) {
    const entry = sums.get(agent.cluster) ?? { total: 0, count: 0 };
    entry.total += agent.belief[narrative] ?? 0;
    entry.count++;
    sums.set(agent.cluster, entry);
  }
  const means = [...sums.values()].map((e) => e.total / e.count);
  if (means.length < 2) return 0;
  return Math.max(...means) - Math.min(...means);
}

export function adoptionCount(
  agents: readonly Agent[],
  narrative: number,
  threshold = ADOPTION_THRESHOLD,
): number {
  return agents.filter((a) => (a.belief[narrative] ?? 0) >= threshold).length;
}

/** Bins in the emitted belief histogram. */
export const BELIEF_HISTOGRAM_BINS = 20;

/**
 * Belief distribution as fixed-width bin counts over [0,1].
 *
 * The summary measures say a population is bimodal; only the distribution shows
 * it splitting. Emitted as bins rather than raw beliefs because 20 counts per
 * tick is a fixed cost while 400 agent values is a population-sized one, and the
 * shape is what a reader needs — not agent 173's exact position.
 */
export function beliefHistogram(
  agents: readonly Agent[],
  narrative: number,
  bins: number = BELIEF_HISTOGRAM_BINS,
): number[] {
  if (!Number.isInteger(bins) || bins < 1) {
    throw new RangeError(`bins must be a positive integer: ${bins}`);
  }
  const counts = new Array<number>(bins).fill(0);
  for (const agent of agents) {
    const belief = agent.belief[narrative] ?? 0;
    // Clamped into the last bin: beliefs are closed on [0,1], so floor(1 * bins)
    // lands one past the end and would silently drop every fully-converted
    // agent — precisely the group a successful campaign creates.
    const index = Math.min(bins - 1, Math.max(0, Math.floor(belief * bins)));
    counts[index]!++;
  }
  return counts;
}

/** Lower edge of each bin, so no consumer re-derives the histogram's geometry. */
export function histogramBinEdges(
  bins: number = BELIEF_HISTOGRAM_BINS,
): number[] {
  return Array.from({ length: bins }, (_, i) => i / bins);
}

export interface PopulationMeasures {
  readonly meanBelief: number;
  readonly variance: number;
  readonly bimodality: number;
  readonly clusterSeparation: number;
  readonly adoptionRate: number;
}

export function measurePopulation(
  agents: readonly Agent[],
  narrative: number,
  adoptionThreshold = ADOPTION_THRESHOLD,
): PopulationMeasures {
  const values = beliefsOn(agents, narrative);
  return {
    meanBelief: mean(values),
    variance: variance(values),
    bimodality: bimodalityCoefficient(values),
    clusterSeparation: clusterSeparation(agents, narrative),
    adoptionRate:
      agents.length === 0
        ? 0
        : adoptionCount(agents, narrative, adoptionThreshold) / agents.length,
  };
}

/**
 * Belief drift attributable to a treatment: the difference between treated and
 * control means. Reported rather than raw drift because beliefs move on their
 * own, and attributing baseline movement to a campaign overstates its effect.
 */
export function attributableDrift(
  treatedMean: number,
  controlMean: number,
): number {
  return treatedMean - controlMean;
}

export interface InterventionEffect {
  /** Share of campaign drift undone. 1 = restored to counterfactual, >1 = overshot. */
  readonly restoredFraction: number;
  /** How far past the counterfactual the intervention pushed the population. */
  readonly overshoot: number;
  /** Budget spent per unit of drift genuinely corrected. Infinity when none was. */
  readonly costPerPointRestored: number;
}

/**
 * Score a defensive intervention against the no-campaign counterfactual.
 *
 * Deliberately NOT raw drift reduction. Measured counter-messaging drove mean
 * belief to 0.299 against a 0.497 control — it "reduced drift" by overshooting
 * into the opposite direction, which naive scoring would rank best. That is a
 * second influence operation, not a defence, and the resilience playbook must
 * never recommend it on those grounds.
 */
export function interventionEffect(
  controlMean: number,
  attackedMean: number,
  defendedMean: number,
  cost: number,
): InterventionEffect {
  const campaignDrift = attackedMean - controlMean;
  const corrected = attackedMean - defendedMean;
  const restoredFraction = campaignDrift === 0 ? 0 : corrected / campaignDrift;
  const overshoot = Math.max(0, controlMean - defendedMean);
  const usefulCorrection = Math.max(0, Math.min(corrected, campaignDrift));
  return {
    restoredFraction,
    overshoot,
    costPerPointRestored:
      usefulCorrection > 0 ? cost / usefulCorrection : Infinity,
  };
}

/**
 * Fano factor (variance/mean) of a count series.
 *
 * Above 1 means bursty rather than steady, which is the temporal fingerprint of
 * coordinated injection. Feeds the detection signatures.
 */
export function burstiness(counts: readonly number[]): number {
  const m = mean(counts);
  if (m === 0) return 0;
  return variance(counts) / m;
}
