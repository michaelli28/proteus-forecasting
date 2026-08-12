/**
 * The defender's restricted view, and the signatures derived from it.
 *
 * This is the wall that makes detection performance a measured number rather
 * than a claim. What a utility's own instrumentation can actually record is:
 * how many OT anomalies fired, how many controller configuration changes were
 * logged, how many authentication failures occurred, and how many customers
 * called about water. That is all that appears here.
 *
 * What does NOT appear, and must never: which components the adversary holds,
 * when it acquired them, what it intends, or what the solver computed. If a
 * field here would not exist in a real historian or SIEM, it does not belong.
 */

import { burstiness, mean } from "./measures.js";

/** One tick of defender-visible telemetry. */
export interface ObservableTick {
  readonly tick: number;
  readonly anomalyEvents: number;
  readonly configChangeEvents: number;
  readonly failedAuthEvents: number;
  readonly serviceComplaints: number;
}

/** Signatures a defender could compute from telemetry alone. */
export interface DetectionSignatures {
  /** Fano factor of the anomaly stream. Coordinated activity is bursty. */
  readonly anomalyBurstiness: number;
  /** Mean controller configuration changes per tick. */
  readonly configChangeRate: number;
  /** Peak authentication failures relative to the median. */
  readonly authFailureSurge: number;
  /**
   * Do complaints arrive alongside config changes?
   *
   * The discriminating channel. Ordinary main breaks produce complaints with no
   * controller changes; ordinary maintenance produces changes with no
   * complaints. Both together is the shape of a control-layer event.
   */
  readonly complaintCoincidence: number;
  /** Composite in [0,1]. Higher means more attack-like. */
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
 * Share of complaint-bearing ticks that also carry a configuration change.
 *
 * Computed over ticks with complaints rather than over all ticks: dividing by
 * the whole run would let a long quiet period drive the statistic toward zero
 * and mask a real coincidence in the few ticks where anything happened.
 */
function complaintCoincidence(ticks: readonly ObservableTick[]): number {
  const noisy = ticks.filter((t) => t.serviceComplaints > 0);
  if (noisy.length === 0) return 0;
  const both = noisy.filter((t) => t.configChangeEvents > 0).length;
  return both / noisy.length;
}

export function deriveSignatures(
  ticks: readonly ObservableTick[],
): DetectionSignatures {
  const anomalies = ticks.map((t) => t.anomalyEvents);
  const auth = ticks.map((t) => t.failedAuthEvents);

  const authMedian = median(auth);
  const authPeak = auth.length > 0 ? Math.max(...auth) : 0;

  const anomalyBurstiness = burstiness(anomalies);
  const configChangeRate = mean(ticks.map((t) => t.configChangeEvents));
  const authFailureSurge = authMedian > 0 ? authPeak / authMedian : authPeak;
  const coincidence = complaintCoincidence(ticks);

  // Weights are a starting point, not a fitted model. The benchmark measures
  // precision/recall at a swept threshold, so mis-weighting shows up as a worse
  // curve rather than as a silently wrong verdict.
  const normalizedBurst = Math.min(1, anomalyBurstiness / 4);
  const normalizedConfig = Math.min(1, configChangeRate / 1.5);
  const normalizedAuth = Math.min(1, authFailureSurge / 8);
  const compositeScore = Math.min(
    1,
    0.25 * normalizedBurst +
      0.3 * normalizedConfig +
      0.15 * normalizedAuth +
      0.3 * coincidence,
  );

  return {
    anomalyBurstiness,
    configChangeRate,
    authFailureSurge,
    complaintCoincidence: coincidence,
    compositeScore,
  };
}

/** Threshold decision. Sweeping the threshold yields the precision/recall curve. */
export function detectIntrusion(
  signatures: DetectionSignatures,
  threshold: number,
): { detected: boolean; score: number } {
  return {
    detected: signatures.compositeScore >= threshold,
    score: signatures.compositeScore,
  };
}

export { median };
