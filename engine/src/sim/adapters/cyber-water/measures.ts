/**
 * Run-level measures — the ground truth an oracle reads.
 *
 * Everything here is computed from the adversary's actual behaviour and the
 * solver's actual output. None of it is visible to the detector; observable.ts
 * owns that side of the wall.
 */

import type { Activation } from "./dynamics.js";
import { instrumentSeverity } from "./config.js";

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

/** Fano factor. > 1 means bursty rather than steady. */
export function burstiness(values: readonly number[]): number {
  const m = mean(values);
  if (m <= 0) return 0;
  return variance(values) / m;
}

export interface RunMeasures {
  /** Distinct activations over the run. */
  readonly activationCount: number;
  /** Highest instrument band reached, as an ordinal 0–4. */
  readonly peakInstrumentSeverity: number;
  /** Attributable person-hours below pressure threshold, summed. */
  readonly personHoursBelow: number;
  /** Largest number of people simultaneously below threshold. */
  readonly peakPeopleAffected: number;
  /** Ticks from first access to first activation; equals `ticks` if never spent. */
  readonly daysToFirstActivation: number;
  /** Activations whose consequence the sweep did not settle. */
  readonly unestablishedActivations: number;
}

export function measureRun(
  activations: readonly Activation[],
  ticks: number,
): RunMeasures {
  const kinetic = activations.filter((a) => a.durationHours > 0);

  return {
    activationCount: activations.length,
    peakInstrumentSeverity: activations.reduce(
      (peak, a) => Math.max(peak, instrumentSeverity(a.band)),
      0,
    ),
    // Summed, not maxed: two separate events on two components strand people
    // twice, and a max would report the larger one as the whole story.
    personHoursBelow: kinetic.reduce((sum, a) => sum + a.personHours, 0),
    peakPeopleAffected: activations.reduce(
      (peak, a) => Math.max(peak, a.peakPeopleBelow),
      0,
    ),
    // `ticks` rather than 0 when nothing was ever spent: zero would read as
    // "activated immediately", which is the opposite of what happened.
    daysToFirstActivation:
      activations.length > 0 ? activations[0]!.tick : ticks,
    unestablishedActivations: kinetic.filter((a) => !a.established).length,
  };
}
