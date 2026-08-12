/**
 * The cyber-water adapter — the third domain plug-in for the shared kernel.
 *
 * Closed-world and synthetic throughout; see config.ts for the scope boundary
 * this model is built to respect, and python/consequence/archetypes.py for the
 * networks it acts on, none of which is a real utility.
 *
 * One tick is one day. The horizon is set by the question being asked, not by
 * the hydraulics: the solver already reduced the physics to a table indexed in
 * hours, so the kernel only has to decide WHEN access is spent.
 */

import type { Rng } from "../../rng.js";
import type { SimEvent, SimulationAdapter } from "../../kernel.js";
import { validateConfig } from "./config.js";
import type { CyberWaterConfig } from "./config.js";
import {
  seedAccess,
  selectDefenseCoverage,
  stepAdversary,
} from "./dynamics.js";
import type { Activation, HeldAccess } from "./dynamics.js";
import { measureRun } from "./measures.js";
import type { ObservableTick } from "./observable.js";

export const ADAPTER_NAME = "cyber-water";
export const ADAPTER_VERSION = "1";

export interface CyberWaterState {
  readonly held: HeldAccess[];
  readonly covered: ReadonlySet<string>;
  readonly activations: Activation[];
  /** Telemetry accumulated so far — the only history the detector may read. */
  readonly observables: ObservableTick[];
  totalDefenseCost: number;
  totalAcquisitions: number;
  totalEvictions: number;
}

export const cyberWaterAdapter: SimulationAdapter<
  CyberWaterConfig,
  CyberWaterState
> = {
  name: ADAPTER_NAME,
  version: ADAPTER_VERSION,

  totalTicks(config) {
    return config.ticks;
  },

  init(config, rng) {
    validateConfig(config);
    return {
      held: seedAccess(config.register, config, rng.fork("access")),
      covered: selectDefenseCoverage(
        config.register,
        config,
        rng.fork("defense"),
      ),
      activations: [],
      observables: [],
      totalDefenseCost: 0,
      totalAcquisitions: 0,
      totalEvictions: 0,
    };
  },

  step(state, tick, config, rng): SimEvent[] {
    const outcome = stepAdversary(
      config,
      state.held,
      state.covered,
      state.activations,
      tick,
      rng,
    );

    if (outcome.activation) state.activations.push(outcome.activation);
    state.totalDefenseCost += outcome.defenseCost;
    state.totalAcquisitions += outcome.acquisitions;
    state.totalEvictions += outcome.evictions;

    const observable: ObservableTick = {
      tick,
      anomalyEvents: outcome.anomalyEvents,
      configChangeEvents: outcome.configChangeEvents,
      failedAuthEvents: outcome.failedAuthEvents,
      serviceComplaints: outcome.serviceComplaints,
    };
    state.observables.push(observable);

    const measures = measureRun(state.activations, config.ticks);

    // Ground truth and telemetry travel in separate event kinds so a consumer
    // cannot accidentally read the answer out of the observable stream. Held
    // access, dwell, the chosen component and the solver's output are all
    // ground truth — a defender sees anomalies and complaints, never the
    // adversary's inventory — so they belong here and nowhere else.
    return [
      {
        tick,
        kind: "truth",
        data: {
          ...measures,
          heldCount: outcome.heldCount,
          acquisitions: outcome.acquisitions,
          evictions: outcome.evictions,
          defenseCost: outcome.defenseCost,
          cumulativeDefenseCost: state.totalDefenseCost,
          activatedComponent: outcome.activation?.componentId ?? "",
          activatedBand: outcome.activation?.band ?? "",
          activatedDurationHours: outcome.activation?.durationHours ?? 0,
          activatedPersonHours: outcome.activation?.personHours ?? 0,
          activatedDwellTicks: outcome.activation?.dwellTicks ?? -1,
          activatedEstablished: outcome.activation?.established ?? false,
        },
      },
      {
        tick,
        kind: "telemetry",
        data: {
          anomalyEvents: observable.anomalyEvents,
          configChangeEvents: observable.configChangeEvents,
          failedAuthEvents: observable.failedAuthEvents,
          serviceComplaints: observable.serviceComplaints,
        },
      },
    ];
  },

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

export * from "./config.js";
export * from "./consequence.js";
export * from "./mapping.js";
export * from "./measures.js";
export * from "./observable.js";
export {
  bestActivation,
  enumerateChoices,
  effectiveDurationHours,
  selectActivation,
  seedAccess,
  selectDefenseCoverage,
  stepAdversary,
} from "./dynamics.js";
export type {
  Activation,
  ActivationChoice,
  HeldAccess,
  TickOutcome,
} from "./dynamics.js";
