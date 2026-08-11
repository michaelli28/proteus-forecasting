/**
 * The consequence twin, as the kernel sees it: a lookup, not a solver.
 *
 * EPANET runs in python/consequence/ ahead of the ensemble and writes a table
 * keyed by (archetype, component, perturbation, duration). Nothing here shells
 * out, reads a file, or awaits anything — `step` is synchronous and seeded, and
 * a subprocess inside it would destroy both properties at once.
 *
 * The table IS the deterministic map g the ensemble pushes particles through.
 * Precomputing it on a grid is what makes the pushforward cheap enough to run
 * thousands of times.
 */

import type { InstrumentBand, PerturbationKind } from "./config.js";

/** One solved cell: the attributable effect of one perturbation. */
export interface ConsequenceCell {
  /** Lowest attributable person-hours across the required_pressure sweep. */
  readonly deltaPersonHoursLow: number;
  readonly deltaPersonHoursHigh: number;
  /** Peak additional people below threshold, over the sweep. */
  readonly peakPeopleBelow: number;
  readonly band: string;
  /** False when the sweep straddles a band edge — the outcome is not settled. */
  readonly bandAgreed: boolean;
  readonly converged: boolean;
}

export interface ConsequenceTable {
  readonly archetypeId: string;
  readonly servedPopulation: number;
  readonly sweepM: readonly number[];
  readonly durationsHours: readonly number[];
  readonly solver: string;
  readonly cells: Readonly<Record<string, ConsequenceCell>>;
}

export const NO_EFFECT: ConsequenceCell = {
  deltaPersonHoursLow: 0,
  deltaPersonHoursHigh: 0,
  peakPeopleBelow: 0,
  band: "c1",
  bandAgreed: true,
  converged: true,
};

export function cellKey(
  archetypeId: string,
  componentId: string,
  perturbation: PerturbationKind,
  durationHours: number,
): string {
  // Matches bridge.py's `f"{archetype}|{component}|{kind}|{duration:g}"`.
  return `${archetypeId}|${componentId}|${perturbation}|${formatDuration(durationHours)}`;
}

/** Mirrors Python's `%g` for the integral durations the grid uses. */
function formatDuration(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(hours);
}

/**
 * Snap a requested duration onto the solved grid.
 *
 * Rounds DOWN to the nearest solved duration, never up: rounding up would
 * credit an attack with hours it did not run, and consequence is monotone in
 * duration, so the error would always be in the flattering direction. Requests
 * below the shortest solved duration snap to it and are reported as clamped,
 * because pretending a 1-hour event resolves to zero is the opposite error.
 */
export function snapDuration(
  table: ConsequenceTable,
  requestedHours: number,
): { hours: number; clamped: boolean } {
  const grid = [...table.durationsHours].sort((a, b) => a - b);
  if (grid.length === 0) {
    throw new Error("consequence table has no solved durations");
  }
  const shortest = grid[0]!;
  if (requestedHours < shortest) return { hours: shortest, clamped: true };

  let chosen = shortest;
  for (const candidate of grid) {
    if (candidate <= requestedHours) chosen = candidate;
  }
  return { hours: chosen, clamped: false };
}

export interface ConsequenceLookup {
  readonly cell: ConsequenceCell;
  readonly durationHoursUsed: number;
  readonly durationClamped: boolean;
}

/**
 * The cell for one activation.
 *
 * Throws on a missing key rather than returning a zero cell. A silent zero is
 * indistinguishable from "this attack does nothing", which is a finding — so a
 * table that does not cover the grid the adversary can reach must fail loudly.
 */
export function lookupConsequence(
  table: ConsequenceTable,
  componentId: string,
  perturbation: PerturbationKind,
  requestedHours: number,
): ConsequenceLookup {
  if (perturbation === "none" || requestedHours <= 0) {
    return { cell: NO_EFFECT, durationHoursUsed: 0, durationClamped: false };
  }

  const { hours, clamped } = snapDuration(table, requestedHours);
  const key = cellKey(table.archetypeId, componentId, perturbation, hours);
  const cell = table.cells[key];
  if (!cell) {
    throw new Error(
      `consequence table has no cell for ${key} — the solved grid does not cover the adversary's reachable moves`,
    );
  }
  return { cell, durationHoursUsed: hours, durationClamped: clamped };
}

/**
 * The effect this run reports for a cell.
 *
 * Uses the LOW end of the required_pressure sweep, and floors at zero. Two
 * separate disciplines:
 *
 *   - The low end is the effect that survives every q in the sweep. Reporting
 *     the high end would let the headline be chosen by the most flattering
 *     pressure assumption, which is the exact artefact the sweep exists to
 *     expose.
 *   - A negative delta is real — stopping a booster can relieve the zone it
 *     draws from — but it is not consequence. It floors to zero here and is
 *     surfaced separately by the ranking layer as "not established", never
 *     netted against another component's harm.
 */
export function reportedPersonHours(cell: ConsequenceCell): number {
  return Math.max(0, cell.deltaPersonHoursLow);
}

/** True when the sweep agrees on both sign and band. */
export function isEstablished(cell: ConsequenceCell): boolean {
  return cell.converged && cell.bandAgreed && cell.deltaPersonHoursLow > 0;
}

/** Instrument bands with no hydraulic action. */
export function isKinetic(band: InstrumentBand): boolean {
  return band !== "none" && band !== "exposure";
}
