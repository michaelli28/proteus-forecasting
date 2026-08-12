/**
 * The defender's restricted view, and the signatures derived from it.
 *
 * This is the wall that makes detection performance a measured number rather
 * than a claim. A defender sees counts: how many anomalies fired, how many
 * configuration changes were logged, how many authentication failures occurred,
 * how many users complained. That is all that appears here.
 *
 * What does NOT appear, and must never: which assets any actor holds, when it
 * acquired them, what it is weighing, or what the oracle priced. The
 * deliberation stream — the most interesting thing this engine produces — is
 * ground truth and is unavailable to every detector by construction. If a field
 * here would not exist in a real log, it does not belong.
 *
 * The four channels deliberately match the cyber-water adapter's, so detection
 * curves remain comparable between the specific domain and the general one.
 */

import { burstiness, mean, median } from "./measures.js";

export interface ObservableTick {
  readonly tick: number;
  readonly anomalyEvents: number;
  readonly configChangeEvents: number;
  readonly failedAuthEvents: number;
  readonly serviceComplaints: number;
}

export interface DetectionSignatures {
  /** Fano factor of the anomaly stream. Coordinated activity is bursty. */
  readonly anomalyBurstiness: number;
  readonly configChangeRate: number;
  /** Peak authentication failures relative to the median. */
  readonly authFailureSurge: number;
  /**
   * Do complaints arrive alongside configuration changes?
   *
   * The discriminating channel in every domain tried so far. Ordinary faults
   * produce complaints with no changes; ordinary maintenance produces changes
   * with no complaints. Both together is the shape of a control-layer event.
   */
  readonly complaintCoincidence: number;
  /** Composite in [0,1]. Higher means more attack-like. */
  readonly compositeScore: number;
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
  return noisy.filter((t) => t.configChangeEvents > 0).length / noisy.length;
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
  const compositeScore = Math.min(
    1,
    0.25 * Math.min(1, anomalyBurstiness / 4) +
      0.3 * Math.min(1, configChangeRate / 1.5) +
      0.15 * Math.min(1, authFailureSurge / 8) +
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
