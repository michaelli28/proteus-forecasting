/**
 * Ground-truth measures. Pure functions over funnel state.
 *
 * Everything here is what the SIMULATOR knows: exactly who sits at which rung,
 * who was paid, who holds a clearance. A defender has none of it — that is the
 * whole point of the split, and observable.ts is the other half.
 */

import { FUNNEL_STAGES, STAGE_INDEX } from "./config.js";
import type { TargetState } from "./funnel.js";
import type { Workforce } from "./workforce.js";

export interface FunnelCensus {
  /** People at each rung, indexed as FUNNEL_STAGES. */
  readonly byStage: readonly number[];
  /** Ever contacted, whether or not they are still active. */
  readonly contacted: number;
  /** Contacted people who hold a clearance. */
  readonly contactedCleared: number;
  /** Reached tasking. The number the whole question is about. */
  readonly tasked: number;
  /** Reached tasking AND hold a clearance. */
  readonly taskedCleared: number;
  /** Left the funnel by reporting the approach. */
  readonly reported: number;
  /** Access value lost, summed over everyone who reached tasking. */
  readonly compromisedAccess: number;
  /** Total paid to targets, in thousands. */
  readonly paidK: number;
}

export function census(
  workforce: Workforce,
  targets: readonly TargetState[],
): FunnelCensus {
  const byStage = new Array<number>(FUNNEL_STAGES.length).fill(0);
  let contacted = 0;
  let contactedCleared = 0;
  let tasked = 0;
  let taskedCleared = 0;
  let reported = 0;
  let compromisedAccess = 0;
  let paidK = 0;

  for (let id = 0; id < targets.length; id++) {
    const target = targets[id]!;
    const person = workforce.people[id]!;

    byStage[target.stage]!++;
    paidK += target.paidK;
    if (target.reported) reported++;

    if (target.stage >= STAGE_INDEX.contacted) {
      contacted++;
      if (person.cleared) contactedCleared++;
    }
    if (target.stage >= STAGE_INDEX.tasked) {
      tasked++;
      compromisedAccess += person.access;
      if (person.cleared) taskedCleared++;
    }
  }

  return {
    byStage,
    contacted,
    contactedCleared,
    tasked,
    taskedCleared,
    reported,
    compromisedAccess,
    paidK,
  };
}

/**
 * Share of contacted clearance-holders who reached tasking, in [0,1].
 *
 * The conversion rate a counterintelligence office would actually be judged on.
 * Zero when nobody has been contacted yet — not undefined, because a ratio with
 * an empty denominator is a real state of the world here, not an error.
 */
export function clearedConversionRate(census: FunnelCensus): number {
  if (census.contactedCleared === 0) return 0;
  return census.taskedCleared / census.contactedCleared;
}

/**
 * Mean ticks from first contact to tasking, over those who got there.
 *
 * Infinity would be the honest value when nobody has, but every consumer would
 * have to special-case it, so callers get 0 and the count alongside.
 */
export function meanTimeToTask(targets: readonly TargetState[]): {
  readonly mean: number;
  readonly count: number;
} {
  const durations = targets
    .filter((t) => t.taskedAt >= 0 && t.contactedAt >= 0)
    .map((t) => t.taskedAt - t.contactedAt);
  if (durations.length === 0) return { mean: 0, count: 0 };
  return {
    mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    count: durations.length,
  };
}

/**
 * Reports per contact so far, in [0,1].
 *
 * The defender's cheapest early signal, and the one the complicity assumption
 * predicts will dry up exactly when it starts to matter.
 */
export function reportRate(census: FunnelCensus): number {
  if (census.contacted === 0) return 0;
  return census.reported / census.contacted;
}
