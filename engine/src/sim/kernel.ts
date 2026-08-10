/**
 * Domain-agnostic simulation driver.
 *
 * Deliberately knows nothing about influence operations, adversaries or
 * technology diffusion — exactly as scoring/ knows nothing about the projects it
 * ranks. Three domain adapters plug in here; there is one kernel, not three
 * systems.
 */

import { Rng } from "./rng.js";

/** Emitted per tick and appended to the run's event log. */
export interface SimEvent {
  readonly tick: number;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * A domain plugs in by supplying init/step/observe.
 *
 * `observe` is what separates a forecast from a lookup: it returns only what an
 * outside analyst could plausibly see. The LLM layer receives this, never the
 * full state, so it cannot read the answer off the world it is forecasting.
 */
export interface SimulationAdapter<TConfig, TState> {
  readonly name: string;
  readonly version: string;
  totalTicks(config: TConfig): number;
  init(config: TConfig, rng: Rng): TState;
  step(state: TState, tick: number, config: TConfig, rng: Rng): SimEvent[];
  observe(
    state: TState,
    tick: number,
    config: TConfig,
  ): Readonly<Record<string, unknown>>;
}

export interface SimRunResult<TState> {
  readonly finalState: TState;
  readonly events: readonly SimEvent[];
  readonly observations: readonly Readonly<Record<string, unknown>>[];
  readonly kernelVersion: string;
}

/** Anything that can persist events as they are produced. */
export interface EventSink {
  appendEvent(event: unknown): Promise<void>;
}

export interface RunOptions {
  /** Emit an observation every N ticks. 0 disables observation capture. */
  readonly observeEvery?: number;
  readonly sink?: EventSink;
}

/**
 * Advance a simulation to completion.
 *
 * Every stochastic subsystem draws from a named fork of the root seed, so adding
 * a draw in one place cannot shift results elsewhere — the failure mode that
 * makes an unrelated change look like a real effect.
 */
export async function runSimulation<TConfig, TState>(
  adapter: SimulationAdapter<TConfig, TState>,
  config: TConfig,
  seed: string,
  options: RunOptions = {},
): Promise<SimRunResult<TState>> {
  const observeEvery = options.observeEvery ?? 1;
  const root = new Rng(seed);

  const state = adapter.init(config, root.fork("init"));
  const stepRng = root.fork("step");

  const events: SimEvent[] = [];
  const observations: Readonly<Record<string, unknown>>[] = [];
  const ticks = adapter.totalTicks(config);

  for (let tick = 0; tick < ticks; tick++) {
    const tickEvents = adapter.step(state, tick, config, stepRng);
    for (const event of tickEvents) {
      events.push(event);
      if (options.sink) await options.sink.appendEvent(event);
    }
    if (observeEvery > 0 && tick % observeEvery === 0) {
      observations.push(adapter.observe(state, tick, config));
    }
  }

  return {
    finalState: state,
    events,
    observations,
    kernelVersion: `${adapter.name}@${adapter.version}`,
  };
}
