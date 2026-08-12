/**
 * Outcome measures, and the small statistics they need.
 *
 * Every measure here is defined without reference to any domain: harm is
 * whatever the scenario's oracle prices, severity is position on the scenario's
 * own ladder. That is what lets one benchmark compare a grid scenario against a
 * port scenario without the comparison being a category error.
 *
 * The stats helpers are duplicated from the cyber-water adapter rather than
 * shared. Fifteen lines of arithmetic is a cheaper duplication than a dependency
 * from the generic adapter onto a specific one, which would invert the layering
 * and make the water domain load-bearing for domains that have nothing to do
 * with it.
 */

import type { EscalationRung } from "./config.js";
import type { Activation } from "./dynamics.js";

export const CONTESTED_MEASURES = [
  /** Total harm across the run, in the oracle's unit. */
  "harmTotal",
  /** Largest number of units affected simultaneously. */
  "peakUnitsAffected",
  /** Ticks until the first consequential act. Ceiling when none occurs. */
  "ticksToFirstActivation",
  /** Highest rung reached, as a share of the ladder's height, in [0,1]. */
  "maxSeverityReached",
  /** Count of consequential acts. */
  "activationCount",
  /** Share of acts third parties could attribute, in [0,1]. */
  "attributedShare",
] as const;
export type ContestedMeasure = (typeof CONTESTED_MEASURES)[number];

export const MEASURE_DESCRIPTIONS: Readonly<Record<ContestedMeasure, string>> =
  {
    harmTotal: "total harm across the run, in the oracle's unit",
    peakUnitsAffected: "the most units out of service at any one moment",
    ticksToFirstActivation: "how long before the first consequential act",
    maxSeverityReached: "how far up the escalation ladder anyone went",
    activationCount: "how many consequential acts occurred",
    attributedShare:
      "the share of acts that could be traced to whoever ordered them",
  };

export function isContestedMeasure(name: string): name is ContestedMeasure {
  return (CONTESTED_MEASURES as readonly string[]).includes(name);
}

export interface MeasureInput {
  readonly activations: readonly Activation[];
  readonly ladder: readonly EscalationRung[];
  readonly ticks: number;
}

/**
 * Read one measure off the run.
 *
 * `ticksToFirstActivation` returns the full run length when nothing happened,
 * rather than a sentinel. A sentinel would have to be excluded from every
 * downstream average by hand, and the first time someone forgot, the mean would
 * silently improve.
 */
export function readMeasure(
  measure: ContestedMeasure,
  input: MeasureInput,
): number {
  const { activations, ladder, ticks } = input;
  const consequential = activations.filter((a) => a.durationHours > 0);

  switch (measure) {
    case "harmTotal":
      return activations.reduce((sum, a) => sum + a.harm, 0);

    case "peakUnitsAffected":
      return activations.reduce(
        (peak, a) => Math.max(peak, a.peakUnitsAffected),
        0,
      );

    case "ticksToFirstActivation": {
      if (consequential.length === 0) return ticks;
      return Math.min(...consequential.map((a) => a.tick));
    }

    case "maxSeverityReached": {
      if (activations.length === 0) return 0;
      const height = Math.max(1, ladder.length - 1);
      const highest = activations.reduce((max, a) => {
        const index = ladder.findIndex((r) => r.id === a.rungId);
        return Math.max(max, index < 0 ? 0 : index);
      }, 0);
      return highest / height;
    }

    case "activationCount":
      return consequential.length;

    case "attributedShare": {
      if (activations.length === 0) return 0;
      return (
        activations.filter((a) => a.attributed).length / activations.length
      );
    }
  }
}

/**
 * Bounds a measure cannot leave by definition.
 *
 * Depends on runtime config, so it is a function rather than a record: harm is
 * bounded by the system's size, and a fixed table would either be wrong for
 * large scenarios or uselessly wide for small ones.
 */
export function definitionalBounds(
  measure: ContestedMeasure,
  servedUnits: number,
  ticks: number,
): { min: number; max: number } {
  switch (measure) {
    case "harmTotal":
      return { min: 0, max: servedUnits * 24 * ticks };
    case "peakUnitsAffected":
      return { min: 0, max: servedUnits };
    case "ticksToFirstActivation":
      return { min: 0, max: ticks };
    case "maxSeverityReached":
    case "attributedShare":
      return { min: 0, max: 1 };
    case "activationCount":
      return { min: 0, max: ticks };
  }
}

// ─── statistics ───

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

/** Fano factor. Coordinated activity clusters; independent noise does not. */
export function burstiness(values: readonly number[]): number {
  const m = mean(values);
  return m > 0 ? variance(values) / m : 0;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
