/**
 * The contested-system adapter.
 *
 * Three event kinds leave this adapter, and which channel a fact travels in is
 * a correctness property, not a formatting choice:
 *
 *   truth         — what actually happened. Scores the forecast. No defender sees it.
 *   telemetry     — what a defender's own instrumentation could record. The
 *                   detector's entire input.
 *   deliberation  — what each actor weighed. Ground truth about reasoning, so it
 *                   is strictly MORE privileged than `truth`, never less.
 *
 * Deliberation is a separate kind rather than a field on the truth event for one
 * reason: `signatures()` in the binding layer reads telemetry and must be unable
 * to reach anything else. A third named channel makes that unreachability
 * structural — there is no filter a detector could write that would return
 * deliberation events — instead of relying on nobody reading the wrong field.
 */

import type { SimEvent, SimulationAdapter } from "../../kernel.js";
import type { Rng } from "../../rng.js";
import { validateScenario } from "./config.js";
import type { ContestedSystemConfig } from "./config.js";
import { initState, stepSystem } from "./dynamics.js";
import type { ContestedSystemState } from "./dynamics.js";
import type { Deliberation, ScoredMove } from "./decision.js";
import { readMeasure, CONTESTED_MEASURES } from "./measures.js";
import type { ObservableTick } from "./observable.js";

export const ADAPTER_NAME = "contested-system";
export const ADAPTER_VERSION = "1";

/**
 * Scored moves kept per actor per tick in the event log.
 *
 * The full choice set can run to hundreds of moves and the log is written for
 * every tick of every ensemble member, so it is truncated for transport. Best
 * first, so what survives truncation is what mattered. The count is generous
 * enough that the near-misses — the moves a defender most wants to see — are
 * still there.
 */
const CONSIDERED_KEPT = 8;

function trimMove(move: ScoredMove): Record<string, unknown> {
  return {
    assetId: move.assetId,
    rungId: move.rungId,
    total: round(move.terms.total),
    payoff: round(move.terms.payoff),
    attributionCost: round(move.terms.attributionCost),
    legitimacyCost: round(move.terms.legitimacyCost),
    civilianHarmCost: round(move.terms.civilianHarmCost),
    retaliationCost: round(move.terms.retaliationCost),
    signalingGain: round(move.terms.signalingGain),
    normalizedHarm: round(move.normalizedHarm),
    established: move.established,
  };
}

/** Six decimals: enough to compare moves, short enough that logs stay readable. */
function round(value: number): number {
  return Number(value.toFixed(6));
}

function deliberationPayload(
  deliberation: Deliberation,
): Readonly<Record<string, unknown>> {
  return {
    actorId: deliberation.actorId,
    actorLabel: deliberation.actorLabel,
    frame: deliberation.frame,
    decision: deliberation.decision,
    rationale: deliberation.rationale,
    disposition: deliberation.disposition,
    holdValue: round(deliberation.holdValue),
    consideredCount: deliberation.considered.length,
    considered: deliberation.considered.slice(0, CONSIDERED_KEPT).map(trimMove),
    blocked: deliberation.blocked,
    chosen: deliberation.chosen ? trimMove(deliberation.chosen) : null,
  };
}

export function createContestedSystemAdapter(): SimulationAdapter<
  ContestedSystemConfig,
  ContestedSystemState
> {
  return {
    name: ADAPTER_NAME,
    version: ADAPTER_VERSION,

    totalTicks(config) {
      return config.ticks;
    },

    init(config, rng) {
      validateScenario(config);
      return initState(config, rng);
    },

    step(state, tick, config, rng) {
      const outcome = stepSystem(config, state, tick, rng);
      const events: SimEvent[] = [];

      const measures: Record<string, number> = {};
      for (const measure of CONTESTED_MEASURES) {
        measures[measure] = readMeasure(measure, {
          activations: state.activations,
          ladder: config.ladder,
          ticks: config.ticks,
        });
      }

      events.push({
        tick,
        kind: "truth",
        data: {
          heldCount: outcome.heldCount,
          acquisitions: outcome.acquisitions,
          evictions: outcome.evictions,
          defenseCost: outcome.defenseCost,
          cumulativeDefenseCost: state.cumulativeDefenseCost,
          activationCount: outcome.activations.length,
          activations: outcome.activations.map((activation) => ({
            actorId: activation.actorId,
            assetId: activation.assetId,
            rungId: activation.rungId,
            durationHours: round(activation.durationHours),
            harm: round(activation.harm),
            peakUnitsAffected: round(activation.peakUnitsAffected),
            established: activation.established,
            dwellTicks: activation.dwellTicks,
            attributed: activation.attributed,
          })),
          actorFrames: state.actors.map((actor) => ({
            actorId: actor.actorId,
            frame: actor.frame,
            holdings: actor.holdings.length,
            sustainedCost: round(actor.sustainedCost),
          })),
          ...measures,
        },
      });

      events.push({
        tick,
        kind: "telemetry",
        data: {
          anomalyEvents: outcome.anomalyEvents,
          configChangeEvents: outcome.configChangeEvents,
          failedAuthEvents: outcome.failedAuthEvents,
          serviceComplaints: outcome.serviceComplaints,
        },
      });

      for (const deliberation of outcome.deliberations) {
        events.push({
          tick,
          kind: "deliberation",
          data: deliberationPayload(deliberation),
        });
      }

      return events;
    },

    /**
     * The restricted view handed to the analytic layer.
     *
     * Telemetry only. An observation carrying holdings, activations, or any part
     * of a deliberation would let the model read the answer off the world it is
     * forecasting, and the forecast would stop measuring anything.
     */
    observe(state, tick) {
      const latest = state.observables[state.observables.length - 1];
      return {
        tick,
        anomalyEvents: latest?.anomalyEvents ?? 0,
        configChangeEvents: latest?.configChangeEvents ?? 0,
        failedAuthEvents: latest?.failedAuthEvents ?? 0,
        serviceComplaints: latest?.serviceComplaints ?? 0,
      };
    },
  };
}

export const CONTESTED_SYSTEM_ADAPTER = createContestedSystemAdapter();

/** Telemetry ticks rebuilt from an event log, for the detection signatures. */
export function observableTicksFrom(
  events: readonly SimEvent[],
): ObservableTick[] {
  return events
    .filter((event) => event.kind === "telemetry")
    .map((event) => ({
      tick: event.tick,
      anomalyEvents: Number(event.data.anomalyEvents ?? 0),
      configChangeEvents: Number(event.data.configChangeEvents ?? 0),
      failedAuthEvents: Number(event.data.failedAuthEvents ?? 0),
      serviceComplaints: Number(event.data.serviceComplaints ?? 0),
    }));
}

export * from "./config.js";
export * from "./oracle.js";
export * from "./decision.js";
export * from "./dynamics.js";
export * from "./measures.js";
export * from "./observable.js";
