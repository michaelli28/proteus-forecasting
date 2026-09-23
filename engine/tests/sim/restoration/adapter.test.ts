import { describe, it, expect } from "vitest";
import { runSimulation } from "../../../src/sim/kernel.js";
import { Rng } from "../../../src/sim/rng.js";
import {
  restorationAdapter,
  DEFAULT_CONFIG,
  RESTORATION_RULES,
  customerTicks,
  dispatch,
  drawStorm,
  problemOf,
  restorationTicks,
} from "../../../src/sim/adapters/restoration/index.js";
import type { RestorationConfig } from "../../../src/sim/adapters/restoration/index.js";

const config = (over: Partial<RestorationConfig> = {}): RestorationConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

describe("the restoration adapter through the real kernel", () => {
  it("observes customers out per tick, and the series integrates to the objective", async () => {
    for (let i = 0; i < 40; i++) {
      for (const crews of [1, 3]) {
        const run = await runSimulation(
          restorationAdapter,
          config({ crews }),
          `adapter-${i}`,
        );
        const { storm, schedule } = run.finalState;
        const series = run.observations.map((o) => o.customersOut as number);
        expect(run.observations[0]).toEqual({
          tick: 0,
          customersOut: series[0],
        });
        expect(series.reduce((a, b) => a + b, 0)).toBe(
          customerTicks(problemOf(storm), schedule.completion),
        );
        expect(series[series.length - 1]).toBe(0);
      }
    }
  });

  it("keeps a broken line's customers out at every tick until it is restored, not just at report times", async () => {
    const run = await runSimulation(
      restorationAdapter,
      config({ crews: 2 }),
      "held-out",
    );
    const { storm, restoredAt, schedule } = run.finalState;
    for (const [t, o] of run.observations.entries()) {
      const expected = storm.segments.reduce(
        (sum, s, j) => sum + (restoredAt[j]! > t ? s.customers : 0),
        0,
      );
      expect(o.customersOut).toBe(expected);
      const busy = schedule.start.filter(
        (st, j) => st <= t && t < schedule.completion[j]!,
      ).length;
      expect(busy).toBeLessThanOrEqual(2);
    }
  });

  it("emits a finish event for every repair and a restore event for every customer group", async () => {
    const run = await runSimulation(
      restorationAdapter,
      config({ crews: 2 }),
      "events",
    );
    const { storm } = run.finalState;
    expect(run.events.filter((e) => e.kind === "repair-finished").length).toBe(
      storm.segments.length,
    );
    const restored = run.events
      .filter((e) => e.kind === "restored")
      .reduce((sum, e) => sum + (e.data.customers as number), 0);
    expect(restored).toBe(
      storm.segments.reduce((sum, s) => sum + s.customers, 0),
    );
  });

  it("stamps each segment's start, finish and restore at the schedule's ticks, with its crew", async () => {
    // Soft precedence must show up at least once, or this cannot tell a
    // restore stamped at the segment's own finish from one at its path's last.
    let restoredAfterFinish = 0;
    for (let i = 0; i < 10; i++) {
      for (const crews of [2, 3]) {
        const run = await runSimulation(
          restorationAdapter,
          config({ crews }),
          `stamps-${i}`,
        );
        const { storm, schedule, restoredAt } = run.finalState;
        expect(run.events.length).toBe(3 * storm.segments.length);
        for (const [j, segment] of storm.segments.entries()) {
          const stamped = (kind: string, field: string) =>
            run.events
              .filter((e) => e.kind === kind && e.data.segment === j)
              .map((e) => [e.tick, e.data[field]]);
          expect(stamped("repair-started", "crew")).toEqual([
            [schedule.start[j], schedule.crew[j]],
          ]);
          expect(stamped("repair-finished", "crew")).toEqual([
            [schedule.completion[j], schedule.crew[j]],
          ]);
          expect(stamped("restored", "customers")).toEqual([
            [restoredAt[j], segment.customers],
          ]);
          if (restoredAt[j]! > schedule.completion[j]!) restoredAfterFinish++;
        }
      }
    }
    expect(restoredAfterFinish).toBeGreaterThan(0);
  });

  it("plays out the configured rule with the configured crews on the storm the seed's own stream draws", async () => {
    // The lab's storm i comes from `restoration-lab/storm-i::init::storm`; a
    // renamed fork here would silently move every published number.
    for (let i = 0; i < 5; i++) {
      const seed = `restoration-lab/storm-${i}`;
      const storm = drawStorm(
        DEFAULT_CONFIG,
        new Rng(seed).fork("init").fork("storm"),
      );
      for (const rule of RESTORATION_RULES) {
        for (const crews of [1, 2, 3, 4]) {
          const { finalState } = await runSimulation(
            restorationAdapter,
            config({ rule, crews }),
            seed,
            { observeEvery: 0 },
          );
          expect(finalState.storm).toEqual(storm);
          expect(finalState.schedule).toEqual(
            dispatch(storm, crews, rule, DEFAULT_CONFIG.repair.medianTicks),
          );
          expect(finalState.restoredAt).toEqual(
            restorationTicks(problemOf(storm), finalState.schedule.completion),
          );
        }
      }
    }
  });

  it("gives every rule the same storm for the same seed", async () => {
    const storms = await Promise.all(
      RESTORATION_RULES.map(async (rule) =>
        JSON.stringify(
          (
            await runSimulation(
              restorationAdapter,
              config({ rule, crews: 2 }),
              "crn",
            )
          ).finalState.storm,
        ),
      ),
    );
    expect(new Set(storms).size).toBe(1);
  });

  it("runs every rule at the extremes of k: one break, and fifty on a 51–59-bus feeder", async () => {
    for (const k of [1, 50]) {
      for (const rule of RESTORATION_RULES) {
        for (const crews of [1, 4]) {
          const run = await runSimulation(
            restorationAdapter,
            config({
              rule,
              crews,
              damagedSegments: { min: k, max: k },
              horizonTicks: k * DEFAULT_CONFIG.repair.maxTicks + 1,
            }),
            `extreme-${k}`,
          );
          const { storm, schedule } = run.finalState;
          expect(storm.segments.length).toBe(k);
          const series = run.observations.map((o) => o.customersOut as number);
          expect(series.reduce((a, b) => a + b, 0)).toBe(
            customerTicks(problemOf(storm), schedule.completion),
          );
          expect(series[series.length - 1]).toBe(0);
        }
      }
    }
  });

  it("finishes the last repair inside the shortest allowed run, even when every repair takes the longest time", async () => {
    const k = 50;
    const longest = DEFAULT_CONFIG.repair.maxTicks;
    const run = await runSimulation(
      restorationAdapter,
      config({
        damagedSegments: { min: k, max: k },
        repair: { ...DEFAULT_CONFIG.repair, medianTicks: longest, sigma: 0 },
        horizonTicks: k * longest + 1,
      }),
      "tight",
    );
    const finishes = run.events.filter((e) => e.kind === "repair-finished");
    expect(finishes.length).toBe(k);
    expect(Math.max(...finishes.map((e) => e.tick))).toBe(k * longest);
    expect(run.observations[run.observations.length - 1]).toEqual({
      tick: k * longest,
      customersOut: 0,
    });
  });

  it("replays byte-identically from a seed", async () => {
    const a = await runSimulation(
      restorationAdapter,
      config({ rule: "nearest-first", crews: 3 }),
      "replay",
    );
    const b = await runSimulation(
      restorationAdapter,
      config({ rule: "nearest-first", crews: 3 }),
      "replay",
    );
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(JSON.stringify(a.observations)).toBe(JSON.stringify(b.observations));
  });

  it("refuses a config whose run could end before the last repair", async () => {
    await expect(
      runSimulation(restorationAdapter, config({ horizonTicks: 100 }), "short"),
    ).rejects.toThrow(/horizonTicks/);
  });
});
