/**
 * The restricted view and the detection signatures derived from it.
 *
 * This separation is what makes detection precision/recall a measured number
 * rather than a claim: the detector sees only what a platform's telemetry could
 * plausibly capture — activity volume, who was active, how concentrated by
 * degree, how synchronised across clusters — and never the campaign parameters,
 * the injection node identities, or any agent's actual belief.
 *
 * If a field here would not appear in real telemetry, it does not belong here.
 */

import { burstiness, mean, variance } from "./measures.js";
import type { Population } from "./network.js";
import type { TickOutcome } from "./dynamics.js";

/** One tick of platform-visible telemetry. */
export interface ObservableTick {
  readonly tick: number;
  /** Total peer interactions that moved someone. */
  readonly volume: number;
  /** Distinct accounts active. */
  readonly activeAccounts: number;
  /** Mean degree of active accounts, as a ratio of the graph's mean degree. */
  readonly activeDegreeRatio: number;
  /** Share of activity per cluster, in cluster-id order. */
  readonly clusterActivityShare: readonly number[];
}

export function observeTick(
  population: Population,
  outcome: TickOutcome,
  tick: number,
  graphMeanDegree: number,
  clusterCount: number,
): ObservableTick {
  const active = outcome.activeNodes;

  const activeDegrees = active.map((id) => population.neighbors[id]!.length);
  const activeDegreeRatio =
    graphMeanDegree > 0 && activeDegrees.length > 0
      ? mean(activeDegrees) / graphMeanDegree
      : 0;

  const perCluster = new Array<number>(clusterCount).fill(0);
  for (const id of active) perCluster[population.agents[id]!.cluster]!++;
  const totalActive = active.length;
  const clusterActivityShare = perCluster.map((c) =>
    totalActive === 0 ? 0 : c / totalActive,
  );

  return {
    tick,
    volume: outcome.transmissions,
    activeAccounts: totalActive,
    activeDegreeRatio,
    clusterActivityShare,
  };
}

/** Signatures a defender could compute from telemetry alone. */
export interface DetectionSignatures {
  /** Fano factor of volume. > 1 means bursty rather than organic-steady. */
  readonly burstiness: number;
  /** Peak volume relative to the median. Spikes indicate coordinated pushes. */
  readonly surgeRatio: number;
  /** Mean activity concentration on high-degree accounts. */
  readonly hubConcentration: number;
  /** How uniformly activity spreads across clusters. High = suspicious synchrony. */
  readonly clusterSynchrony: number;
  /** Composite in [0,1]. Higher means more campaign-like. */
  readonly compositeScore: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Synchrony across clusters.
 *
 * Organic spread reaches clusters unevenly and late, because it has to cross the
 * sparse bridges. Simultaneous even activity everywhere is the trace of parallel
 * injection rather than transmission.
 */
function synchrony(ticks: readonly ObservableTick[]): number {
  const active = ticks.filter((t) => t.activeAccounts > 0);
  if (active.length === 0) return 0;
  const evenness = active.map((t) => {
    const shares = t.clusterActivityShare;
    if (shares.length < 2) return 0;
    const uniform = 1 / shares.length;
    // 0 when all activity sits in one cluster, 1 when perfectly even.
    const deviation =
      mean(shares.map((s) => Math.abs(s - uniform))) /
      (2 * uniform * (1 - uniform) + 1e-9);
    return Math.max(0, 1 - deviation);
  });
  return mean(evenness);
}

export function deriveSignatures(
  ticks: readonly ObservableTick[],
): DetectionSignatures {
  const volumes = ticks.map((t) => t.volume);
  const med = median(volumes);
  const peak = volumes.length > 0 ? Math.max(...volumes) : 0;

  const burst = burstiness(volumes);
  const surgeRatio = med > 0 ? peak / med : 0;
  const hubConcentration = mean(ticks.map((t) => t.activeDegreeRatio));
  const clusterSynchrony = synchrony(ticks);

  // Weights are a starting point, not a fitted model. The benchmark measures
  // precision/recall at a swept threshold, so mis-weighting shows up as a worse
  // curve rather than as a silently wrong verdict.
  const normalizedBurst = Math.min(1, burst / 5);
  const normalizedSurge = Math.min(1, surgeRatio / 10);
  const normalizedHub = Math.min(1, Math.max(0, hubConcentration - 1) / 2);
  const compositeScore =
    0.3 * normalizedBurst +
    0.3 * normalizedSurge +
    0.25 * normalizedHub +
    0.15 * clusterSynchrony;

  return {
    burstiness: burst,
    surgeRatio,
    hubConcentration,
    clusterSynchrony,
    compositeScore: Math.min(1, compositeScore),
  };
}

/** Threshold decision. Sweeping the threshold yields the precision/recall curve. */
export function detectCampaign(
  signatures: DetectionSignatures,
  threshold: number,
): { detected: boolean; score: number } {
  return {
    detected: signatures.compositeScore >= threshold,
    score: signatures.compositeScore,
  };
}

export { median, variance };
