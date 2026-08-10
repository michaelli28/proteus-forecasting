/**
 * The seam between the orchestrator and a domain.
 *
 * The orchestrator knows about hypotheses, ensembles, evidence and abstention.
 * It knows nothing about influence operations, technology diffusion or
 * geopolitics — exactly as scoring/ knows nothing about the projects it ranks.
 * A domain plugs in by supplying four functions, which is what makes "one kernel,
 * three adapters" a testable property rather than a claim: the pipeline's own
 * tests drive it with a toy domain that has no ABM in it at all.
 */

import type { SimRunResult, SimulationAdapter } from "../sim/kernel.js";
import type { OutcomeBand, TargetQuantity } from "../evidence/partition.js";
import type { RunSpec } from "../agents/framer.js";

/** Source id every simulation-derived reading carries. */
export const SIMULATION_SOURCE_ID = "simulation-instrument";

/**
 * Credibility of a reading taken off the model's own instrumentation.
 *
 * Deliberately below 1: the instrument is exact about the model, and the model
 * is an assumption about the world. Treating it as certain would let a
 * synthetic world manufacture high-confidence products.
 */
export const SIMULATION_READING_CREDIBILITY = 0.8;

/**
 * The restricted view of one ensemble member.
 *
 * `signatures` carries telemetry-derived channels only. The target quantity is
 * present because an ensemble member's outcome IS the forecast machinery — but
 * the oracle run's summary never enters this path, which is what keeps the
 * forecast honest.
 */
export interface RunSummary {
  readonly runId: string;
  readonly specId: string;
  readonly label: string;
  readonly artifactHash: string;
  /** Terminal value of the target quantity for this run. */
  readonly quantity: number;
  readonly bandId: string;
  readonly bandIndex: number;
  readonly signatures: Readonly<Record<string, number>>;
}

/** A member that did not finish, with the phase that lost it. */
export interface RunFailure {
  readonly specId: string;
  readonly phase: string;
  readonly message: string;
}

export interface DomainBinding<TConfig, TState> {
  readonly adapter: SimulationAdapter<TConfig, TState>;
  /** Configuration for one ensemble member. */
  configFor(spec: RunSpec, quantity: TargetQuantity): TConfig;
  /** The target quantity as the oracle reads it, at `quantity.resolveAtTick`. */
  readQuantity(result: SimRunResult<TState>, quantity: TargetQuantity): number;
  /**
   * Telemetry-derived channels only.
   *
   * Anything a defender could not compute from observable telemetry does not
   * belong here — that separation is what makes detection metrics measurable
   * rather than asserted.
   */
  signatures(result: SimRunResult<TState>): Readonly<Record<string, number>>;
}

/**
 * Bands in ascending order.
 *
 * Band ORDER is load-bearing: a forecast is a probability vector indexed by
 * band, and the metrics package resolves outcomes by index. One place sorts
 * them so index 2 means the same band everywhere.
 */
export function orderedBands(
  bands: readonly OutcomeBand[],
): readonly OutcomeBand[] {
  return [...bands].sort((a, b) => a.lower - b.lower);
}

export function bandIndexOf(
  bands: readonly OutcomeBand[],
  bandId: string,
): number {
  return orderedBands(bands).findIndex((band) => band.id === bandId);
}
