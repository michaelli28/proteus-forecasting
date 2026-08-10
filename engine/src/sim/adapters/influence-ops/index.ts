/**
 * The influence-operations adapter — Phase 1's domain plug-in for the shared
 * kernel. Closed-world and synthetic throughout; see config.ts for the scope
 * boundary this model is built to respect.
 */

import type { Rng } from "../../rng.js";
import type { SimEvent, SimulationAdapter } from "../../kernel.js";
import { validateConfig } from "./config.js";
import type { InfluenceOpsConfig } from "./config.js";
import { buildPopulation, meanDegree } from "./network.js";
import type { Population } from "./network.js";
import {
  selectDefenseCoverage,
  selectInjectionNodes,
  stepBeliefs,
} from "./dynamics.js";
import { beliefHistogram, measurePopulation } from "./measures.js";
import { observeTick } from "./observable.js";
import type { ObservableTick } from "./observable.js";

export const ADAPTER_NAME = "influence-ops";
export const ADAPTER_VERSION = "1";

export interface InfluenceOpsState {
  readonly population: Population;
  readonly injectionNodes: ReadonlySet<number>;
  readonly defenseCoverage: ReadonlySet<number>;
  readonly graphMeanDegree: number;
  /** Telemetry accumulated so far — the only history the detector may read. */
  readonly observables: ObservableTick[];
  totalDefenseCost: number;
  totalAdoptions: number;
}

export const influenceOpsAdapter: SimulationAdapter<
  InfluenceOpsConfig,
  InfluenceOpsState
> = {
  name: ADAPTER_NAME,
  version: ADAPTER_VERSION,

  totalTicks(config) {
    return config.ticks;
  },

  init(config, rng) {
    validateConfig(config);
    const population = buildPopulation(config, rng.fork("population"));
    return {
      population,
      injectionNodes: selectInjectionNodes(
        population,
        config,
        rng.fork("injection"),
      ),
      defenseCoverage: selectDefenseCoverage(
        population,
        config,
        rng.fork("defense"),
      ),
      graphMeanDegree: meanDegree(population),
      observables: [],
      totalDefenseCost: 0,
      totalAdoptions: 0,
    };
  },

  step(state, tick, config, rng): SimEvent[] {
    const outcome = stepBeliefs(
      state.population,
      config,
      tick,
      rng,
      state.injectionNodes,
      state.defenseCoverage,
    );

    state.totalDefenseCost += outcome.defenseCost;
    state.totalAdoptions += outcome.adoptions;

    const observable = observeTick(
      state.population,
      outcome,
      tick,
      state.graphMeanDegree,
      config.population.clusters,
    );
    state.observables.push(observable);

    const targetNarrative = config.campaign?.narrativeId ?? 0;
    const measures = measurePopulation(
      state.population.agents,
      targetNarrative,
    );

    // Ground truth and telemetry travel in separate event kinds so a consumer
    // cannot accidentally read the answer out of the observable stream. The
    // distribution and the cascade counts are ground truth — a defender sees
    // activity, never belief — so they belong here and nowhere else.
    return [
      {
        tick,
        kind: "truth",
        data: {
          ...measures,
          injections: outcome.injections,
          adoptions: outcome.adoptions,
          abandonments: outcome.abandonments,
          beliefHistogram: beliefHistogram(
            state.population.agents,
            targetNarrative,
          ),
        },
      },
      {
        tick,
        kind: "telemetry",
        data: {
          volume: observable.volume,
          activeAccounts: observable.activeAccounts,
          activeDegreeRatio: observable.activeDegreeRatio,
          clusterActivityShare: [...observable.clusterActivityShare],
        },
      },
    ];
  },

  observe(state, tick) {
    const latest = state.observables[state.observables.length - 1];
    return {
      tick,
      volume: latest?.volume ?? 0,
      activeAccounts: latest?.activeAccounts ?? 0,
      activeDegreeRatio: latest?.activeDegreeRatio ?? 0,
      clusterActivityShare: [...(latest?.clusterActivityShare ?? [])],
    };
  },
};

export * from "./config.js";
export * from "./mapping.js";
export * from "./measures.js";
export * from "./observable.js";
export { buildPopulation, meanDegree, bridgeCount } from "./network.js";
export type { Agent, MediaOutlet, Population } from "./network.js";
export {
  selectInjectionNodes,
  selectDefenseCoverage,
  stepBeliefs,
} from "./dynamics.js";
export type { TickOutcome } from "./dynamics.js";
