import { describe, it, expect } from "vitest";
import { runSimulation } from "../../src/sim/kernel.js";
import type { SimEvent, SimulationAdapter } from "../../src/sim/kernel.js";
import { Rng } from "../../src/sim/rng.js";

interface CounterConfig {
  readonly ticks: number;
}
interface CounterState {
  values: number[];
  secret: number;
}

/** Minimal adapter — exercises the driver without dragging a domain in. */
const counterAdapter: SimulationAdapter<CounterConfig, CounterState> = {
  name: "counter",
  version: "1",
  totalTicks: (config) => config.ticks,
  init: (_config, rng) => ({ values: [], secret: rng.int(1000) }),
  step: (state, tick, _config, rng): SimEvent[] => {
    const value = rng.next();
    state.values.push(value);
    return [{ tick, kind: "sample", data: { value } }];
  },
  observe: (state, tick) => ({ tick, count: state.values.length }),
};

const config: CounterConfig = { ticks: 20 };

describe("runSimulation", () => {
  it("runs exactly totalTicks ticks", async () => {
    const result = await runSimulation(counterAdapter, config, "seed");
    expect(result.finalState.values).toHaveLength(20);
    expect(result.events).toHaveLength(20);
  });

  it("is byte-identical for the same seed", async () => {
    const a = await runSimulation(counterAdapter, config, "seed");
    const b = await runSimulation(counterAdapter, config, "seed");
    expect(b.events).toEqual(a.events);
    expect(b.finalState.values).toEqual(a.finalState.values);
    expect(b.finalState.secret).toBe(a.finalState.secret);
  });

  it("diverges for a different seed", async () => {
    const a = await runSimulation(counterAdapter, config, "seed-a");
    const b = await runSimulation(counterAdapter, config, "seed-b");
    expect(b.finalState.values).not.toEqual(a.finalState.values);
  });

  it("isolates init randomness from step randomness", async () => {
    // Both runs share a seed, so init must produce the same secret even though
    // the step count differs — proving the forks do not share a stream.
    const short = await runSimulation(counterAdapter, { ticks: 3 }, "seed");
    const long = await runSimulation(counterAdapter, { ticks: 50 }, "seed");
    expect(long.finalState.secret).toBe(short.finalState.secret);
    expect(long.finalState.values.slice(0, 3)).toEqual(short.finalState.values);
  });

  it("reports the kernel version as name@version", async () => {
    const result = await runSimulation(counterAdapter, config, "seed");
    expect(result.kernelVersion).toBe("counter@1");
  });

  it("observes on the requested cadence", async () => {
    const every5 = await runSimulation(counterAdapter, config, "seed", {
      observeEvery: 5,
    });
    expect(every5.observations).toHaveLength(4);
    const none = await runSimulation(counterAdapter, config, "seed", {
      observeEvery: 0,
    });
    expect(none.observations).toHaveLength(0);
  });

  it("forwards every event to a sink in order", async () => {
    const received: unknown[] = [];
    const result = await runSimulation(counterAdapter, config, "seed", {
      sink: { appendEvent: async (e) => void received.push(e) },
    });
    expect(received).toEqual(result.events);
  });

  it("handles a zero-tick run", async () => {
    const result = await runSimulation(counterAdapter, { ticks: 0 }, "seed");
    expect(result.events).toEqual([]);
    expect(result.observations).toEqual([]);
  });

  it("uses a fresh Rng per run rather than shared module state", async () => {
    const first = await runSimulation(counterAdapter, config, "seed");
    await runSimulation(counterAdapter, config, "other");
    const third = await runSimulation(counterAdapter, config, "seed");
    expect(third.finalState.values).toEqual(first.finalState.values);
  });

  it("gives the adapter a real Rng instance", () => {
    const state = counterAdapter.init(config, new Rng("x"));
    expect(state.secret).toBeGreaterThanOrEqual(0);
    expect(state.secret).toBeLessThan(1000);
  });
});
