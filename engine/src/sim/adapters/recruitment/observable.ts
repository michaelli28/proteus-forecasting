/**
 * The restricted view, and the detection signal derived from it.
 *
 * Everything here is computable by a platform trust-and-safety team plus a
 * security office that receives reports. Nothing here reveals who is at which
 * rung, who took money, or who holds a clearance — a defender cannot see any of
 * that, and putting it here would make detection precision a tautology.
 *
 * The test for whether a field belongs: could a platform log it, or would
 * someone walk into a security office and say it? If neither, it does not go
 * here.
 */

import { employerConcentration, mean } from "./workforce.js";

/** One tick of what a defender could observe. */
export interface ObservableTick {
  readonly tick: number;
  /** Connection or message requests originating from recruiter accounts. */
  readonly connectionRequests: number;
  /** Requests that produced a reply. */
  readonly accepted: number;
  /** Approaches reported to a security office. */
  readonly reportsFiled: number;
  /** Distinct accounts sending requests. */
  readonly activeAccounts: number;
  /** Share of requests landing in the single most-targeted employer, in [0,1]. */
  readonly employerConcentration: number;
  /**
   * Share of this tick's requests sent by accounts younger than a year.
   *
   * A share rather than a mean age. Averaging swamps a handful of throwaway
   * accounts under a mature population — six 45-day accounts against twenty-six
   * 900-day ones averages to 740 days and the signal reads as zero — whereas
   * the share of young senders is both computable from the same logs and
   * actually moves.
   */
  readonly youngAccountShare: number;
}

export interface ObserveInput {
  readonly tick: number;
  readonly connectionRequests: number;
  readonly accepted: number;
  readonly reportsFiled: number;
  readonly activeAccounts: number;
  readonly contactsPerOrganization: readonly number[];
  /** Requests sent by accounts younger than YOUNG_ACCOUNT_DAYS. */
  readonly youngAccountRequests: number;
}

export function observeTick(input: ObserveInput): ObservableTick {
  return {
    tick: input.tick,
    connectionRequests: input.connectionRequests,
    accepted: input.accepted,
    reportsFiled: input.reportsFiled,
    activeAccounts: input.activeAccounts,
    employerConcentration: employerConcentration(input.contactsPerOrganization),
    youngAccountShare:
      input.connectionRequests === 0
        ? 0
        : input.youngAccountRequests / input.connectionRequests,
  };
}

/** Fano factor: variance over mean. Above 1 is bursty rather than steady. */
function burstiness(counts: readonly number[]): number {
  const m = mean(counts);
  if (m === 0) return 0;
  const v = counts.reduce((sum, c) => sum + (c - m) ** 2, 0) / counts.length;
  return v / m;
}

/** Signals a defender could compute from the stream above, and nothing else. */
export interface RecruitmentSignatures {
  /** Burstiness of request volume. Coordinated accounts move together. */
  readonly requestBurstiness: number;
  /** Mean share of requests concentrated in one employer. */
  readonly employerConcentration: number;
  /** Share of requests that got a reply. Unusually high suggests good targeting. */
  readonly acceptanceRate: number;
  /** Reports per request. The defender's earliest and cheapest signal. */
  readonly reportRate: number;
  /** Mean share of requests coming from accounts under a year old. */
  readonly accountYouth: number;
  /** Composite in [0,1]. Higher means more campaign-like. */
  readonly compositeScore: number;
}

/** An account younger than this counts as new. */
export const YOUNG_ACCOUNT_DAYS = 365;

export function deriveSignatures(
  ticks: readonly ObservableTick[],
): RecruitmentSignatures {
  const active = ticks.filter((t) => t.connectionRequests > 0);
  const requests = ticks.map((t) => t.connectionRequests);

  const totalRequests = requests.reduce((sum, r) => sum + r, 0);
  const totalAccepted = ticks.reduce((sum, t) => sum + t.accepted, 0);
  const totalReports = ticks.reduce((sum, t) => sum + t.reportsFiled, 0);

  const requestBurstiness = burstiness(requests);
  const concentration = mean(active.map((t) => t.employerConcentration));
  const acceptanceRate =
    totalRequests === 0 ? 0 : totalAccepted / totalRequests;
  const reportRate = totalRequests === 0 ? 0 : totalReports / totalRequests;
  const accountYouth = mean(active.map((t) => t.youngAccountShare));

  // Weights are a starting point, not a fitted model. The benchmark sweeps the
  // decision threshold, so mis-weighting shows as a worse operating curve
  // rather than as a silently wrong verdict.
  const compositeScore = Math.min(
    1,
    0.3 * Math.min(1, concentration * 1.5) +
      0.25 * Math.min(1, requestBurstiness / 3) +
      0.2 * Math.min(1, acceptanceRate * 4) +
      0.15 * accountYouth +
      0.1 * Math.min(1, reportRate * 20),
  );

  return {
    requestBurstiness,
    employerConcentration: concentration,
    acceptanceRate,
    reportRate,
    accountYouth,
    compositeScore,
  };
}

/**
 * Ticks of quiet traffic a detector learns "normal" from before it may fire.
 *
 * A campaign that begins before this is over is not detectable by deviation,
 * because there is no clean baseline to deviate from. That is a real limitation
 * of the method, not a parameter to tune away.
 */
export const BASELINE_TICKS = 20;

/** Trailing window compared against the baseline. */
export const DETECTION_WINDOW = 15;

/**
 * How far the recent window departs from the learned baseline, in [0,1].
 *
 * Deviation rather than level. Scoring absolute levels means a channel with a
 * high resting value — employer concentration sits near 1/n on ordinary traffic
 * — contributes the same score whether or not anything is happening, which
 * swamps the channels that actually moved. Measured: on absolute levels the
 * control and campaign score bands overlapped, so the detector had no operating
 * point at all.
 */
export function deviationScore(
  baseline: readonly ObservableTick[],
  window: readonly ObservableTick[],
): number {
  if (baseline.length === 0 || window.length === 0) return 0;

  const ratio = (recent: number, base: number) =>
    base <= 1e-9 ? (recent > 1e-9 ? 1 : 0) : Math.max(0, recent / base - 1);

  const baseRequests = mean(baseline.map((t) => t.connectionRequests));
  const winRequests = mean(window.map((t) => t.connectionRequests));

  const baseConcentration = mean(baseline.map((t) => t.employerConcentration));
  const winConcentration = mean(window.map((t) => t.employerConcentration));

  const baseYouth = mean(baseline.map((t) => t.youngAccountShare));
  const winYouth = mean(window.map((t) => t.youngAccountShare));

  const baseReports = mean(baseline.map((t) => t.reportsFiled));
  const winReports = mean(window.map((t) => t.reportsFiled));

  const volume = Math.min(1, ratio(winRequests, baseRequests) * 2);
  const concentration = Math.min(
    1,
    ratio(winConcentration, baseConcentration) * 4,
  );
  const youth = Math.min(1, ratio(winYouth, baseYouth) * 2);
  const reports = Math.min(1, ratio(winReports, baseReports) * 1.5);

  return Math.min(
    1,
    0.3 * concentration + 0.3 * youth + 0.2 * volume + 0.2 * reports,
  );
}

/**
 * The first tick at which a running detector would have fired.
 *
 * Recomputed over the prefix at each tick, because a defender does not get to
 * see the future. This is what makes "exposure before detection" answerable at
 * all: everyone tasked before this tick is damage no amount of watching the
 * telemetry could have prevented.
 */
export function detectionTick(
  ticks: readonly ObservableTick[],
  threshold: number,
  baselineTicks = BASELINE_TICKS,
  windowTicks = DETECTION_WINDOW,
): number | null {
  if (ticks.length <= baselineTicks) return null;
  const baseline = ticks.slice(0, baselineTicks);

  for (let end = baselineTicks + 1; end <= ticks.length; end++) {
    const window = ticks.slice(Math.max(baselineTicks, end - windowTicks), end);
    if (deviationScore(baseline, window) >= threshold) {
      return ticks[end - 1]!.tick;
    }
  }
  return null;
}
