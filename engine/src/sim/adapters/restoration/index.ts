/**
 * The storm-restoration adapter: synthetic radial feeders, storm damage, and
 * 1–4 crews repairing on 15-minute ticks.
 *
 * The schedule is fixed at init from the rule and the true repair times; each
 * tick then reveals what happened. `observe` returns only customers out — the
 * one number EAGLE-I publishes per county every 15 minutes — so the same
 * rank check can later be pointed at real outage curves.
 */

import type { SimEvent, SimulationAdapter } from "../../kernel.js";
import { validateConfig } from "./config.js";
import type { RestorationConfig } from "./config.js";
import { restorationTicks } from "./objective.js";
import type { Schedule } from "./objective.js";
import { dispatch } from "./rules.js";
import { drawStorm, problemOf } from "./storm.js";
import type { Storm } from "./storm.js";

export const ADAPTER_NAME = "restoration";
export const ADAPTER_VERSION = "1";

export interface RestorationState {
  readonly storm: Storm;
  readonly schedule: Schedule;
  /** Tick each segment's customers come back. */
  readonly restoredAt: readonly number[];
  customersOut: number;
}

export const restorationAdapter: SimulationAdapter<
  RestorationConfig,
  RestorationState
> = {
  name: ADAPTER_NAME,
  version: ADAPTER_VERSION,

  totalTicks(config) {
    return config.horizonTicks;
  },

  init(config, rng) {
    validateConfig(config);
    // The storm's own fork: the same seed draws the same storm under every rule and crew count.
    const storm = drawStorm(config, rng.fork("storm"));
    const schedule = dispatch(
      storm,
      config.crews,
      config.rule,
      config.repair.medianTicks,
    );
    return {
      storm,
      schedule,
      restoredAt: restorationTicks(problemOf(storm), schedule.completion),
      customersOut: 0,
    };
  },

  step(state, tick): SimEvent[] {
    const events: SimEvent[] = [];
    const { schedule, storm, restoredAt } = state;
    for (const [j, segment] of storm.segments.entries()) {
      if (schedule.start[j] === tick) {
        events.push({
          tick,
          kind: "repair-started",
          data: { segment: j, crew: schedule.crew[j]! },
        });
      }
      if (schedule.completion[j] === tick) {
        events.push({
          tick,
          kind: "repair-finished",
          data: { segment: j, crew: schedule.crew[j]! },
        });
      }
      if (restoredAt[j] === tick) {
        events.push({
          tick,
          kind: "restored",
          data: { segment: j, customers: segment.customers },
        });
      }
    }
    // Out during [tick, tick + 1): so the series sums to the objective exactly.
    state.customersOut = storm.segments.reduce(
      (sum, s, j) => sum + (restoredAt[j]! > tick ? s.customers : 0),
      0,
    );
    return events;
  },

  observe(state, tick) {
    return { tick, customersOut: state.customersOut };
  },
};

export * from "./config.js";
export * from "./objective.js";
export * from "./storm.js";
export { hornOrder } from "./horn.js";
export { dispatch, feederDistance } from "./rules.js";
