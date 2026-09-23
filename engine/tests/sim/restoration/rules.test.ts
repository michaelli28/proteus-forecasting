import { describe, it, expect } from "vitest";
import { Rng } from "../../../src/sim/rng.js";
import {
  DEFAULT_CONFIG,
  RESTORATION_RULES,
} from "../../../src/sim/adapters/restoration/config.js";
import type { RestorationConfig } from "../../../src/sim/adapters/restoration/config.js";
import {
  dispatch,
  feederDistance,
} from "../../../src/sim/adapters/restoration/rules.js";
import {
  drawStorm,
  problemOf,
  feederDepth,
} from "../../../src/sim/adapters/restoration/storm.js";
import type { Storm } from "../../../src/sim/adapters/restoration/storm.js";
import {
  customerTicks,
  scheduleFromStarts,
} from "../../../src/sim/adapters/restoration/objective.js";
import { hornOrder } from "../../../src/sim/adapters/restoration/horn.js";
import { oneCrewCost } from "./exhaustive.js";

/** A storm from a feeder, per-bus customers, broken buses and their repair ticks. */
function handStorm(
  feederParent: number[],
  customersAtBus: number[],
  broken: number[],
  ticks: number[],
  criticalBuses: number[] = [],
): Storm {
  const index = new Map(broken.map((b, j) => [b, j]));
  const nearest = (bus: number): number => {
    for (let v = bus; v !== 0; v = feederParent[v]!) {
      const j = index.get(v);
      if (j !== undefined) return j;
    }
    return -1;
  };
  const customers = broken.map(() => 0);
  for (let v = 1; v < feederParent.length; v++) {
    const j = nearest(v);
    if (j >= 0) customers[j]! += customersAtBus[v]!;
  }
  const onPath = new Set<number>();
  for (const bus of criticalBuses)
    for (let v = bus; v > 0; v = feederParent[v]!) onPath.add(v);
  const depth = feederDepth(feederParent);
  return {
    style: "recursive",
    feederParent,
    customersAtBus,
    criticalBuses,
    segments: broken.map((bus, j) => ({
      bus,
      parent: nearest(feederParent[bus]!),
      ticks: ticks[j]!,
      customers: customers[j]!,
      depth: depth[bus]!,
      onCriticalPath: onPath.has(bus),
    })),
  };
}

// Feeder: 0 ─ 1 ─ 2 ─ 3, and 0 ─ 4. Buses 1..4 carry 5, 50, 1, 20 customers.
// Broken: 1 (seg 0), 2 (seg 1), 4 (seg 2). Segment 1 sits below segment 0.
const Y = handStorm([-1, 0, 1, 2, 0], [0, 5, 50, 1, 20], [1, 2, 4], [4, 1, 2]);

function drawn(config: Partial<RestorationConfig>, seed: string): Storm {
  const merged = { ...DEFAULT_CONFIG, ...config };
  return drawStorm(merged, new Rng(seed));
}

describe("the rules on a hand-built storm", () => {
  it("most customers now: a break below an unstarted break brings nobody back", () => {
    // Gains now: seg0 → 5, seg1 → 0 (seg0 unstarted), seg2 → 20. Pick seg2, then seg0, then seg1.
    const s = dispatch(Y, 1, "most-customers-now", 6);
    expect(s.start).toEqual([2, 6, 0]);
  });

  it("most customers now counts repairs under way as finished", () => {
    // 0 ─ 1 ─ 2, 0 ─ 3, 0 ─ 4. Broken 1 (seg0: 10 customers, 10 ticks), 2 (seg1: 100,
    // below seg0), 3 (seg2: 5), 4 (seg3: 3). Crew 0 takes seg0. At tick 0 crew 1 counts
    // seg0 as finished, so seg1 brings back 100 and beats seg2's 5.
    const s = dispatch(
      handStorm(
        [-1, 0, 1, 0, 0],
        [0, 10, 100, 5, 3],
        [1, 2, 3, 4],
        [10, 1, 1, 1],
      ),
      2,
      "most-customers-now",
      6,
    );
    expect(s.start).toEqual([0, 0, 1, 2]);
    expect(s.crew).toEqual([0, 1, 1, 1]);
  });

  it("upstream first orders by hops from the substation, then customers downstream", () => {
    // Depth: seg0 bus1 = 1, seg1 bus2 = 2, seg2 bus4 = 1. Downstream: seg0 = 56, seg2 = 20.
    const s = dispatch(Y, 1, "upstream-first", 6);
    expect(s.start).toEqual([0, 6, 4]);
  });

  it("nearest first moves from the crew's last repair", () => {
    // From the substation: seg0 (bus1) and seg2 (bus4) are 1 hop; tie → shallower equal → lower index: seg0.
    // From bus1: seg1 (bus2) is 1 hop, seg2 (bus4) is 2. Then seg2.
    const s = dispatch(Y, 1, "nearest-first", 6);
    expect(s.start).toEqual([0, 4, 5]);
    expect(feederDistance(Y.feederParent, 3, 4)).toBe(4);
    expect(feederDistance(Y.feederParent, 2, 2)).toBe(0);
  });

  it("nearest first: each crew moves from its own last repair", () => {
    // 0 ─ 1 ─ 2, 0 ─ 3 ─ 4. Crew 0 takes seg0 (bus 1), crew 1 seg2 (bus 3, 5 ticks).
    // Crew 0 frees at tick 1 on bus 1: seg1 (bus 2) is 1 hop, seg3 (bus 4) is 3.
    const s = dispatch(
      handStorm([-1, 0, 1, 0, 3], [0, 1, 1, 1, 1], [1, 2, 3, 4], [1, 1, 5, 1]),
      2,
      "nearest-first",
      6,
    );
    expect(s.start).toEqual([0, 1, 0, 2]);
    expect(s.crew).toEqual([0, 0, 1, 0]);
  });

  it("critical first clears the critical path, then falls back to most customers now", () => {
    const withCritical = handStorm(
      [-1, 0, 1, 2, 0],
      [0, 5, 50, 1, 20],
      [1, 2, 4],
      [4, 1, 2],
      [3],
    );
    // Critical bus 3 sits below segs 0 and 1: seg0 (depth 1) then seg1, then seg2.
    const s = dispatch(withCritical, 1, "critical-first", 6);
    expect(s.start).toEqual([0, 4, 5]);
  });

  it("critical first falls back to most customers now, not upstream or index order", () => {
    // 0 ─ 1 ─ 3, 0 ─ 2. Critical bus 1 puts only seg0 (no customers of its own) on a path.
    // Then seg2 (bus 3, depth 2) brings back 50 now and seg1 (bus 2, depth 1) only 5.
    const s = handStorm(
      [-1, 0, 0, 1],
      [0, 0, 5, 50],
      [1, 2, 3],
      [1, 1, 1],
      [1],
    );
    expect(dispatch(s, 1, "critical-first", 6).start).toEqual([0, 2, 1]);
  });

  it("Horn-order plans on the typical time; the hindsight version on the true times", () => {
    // True ticks [4,1,2]: hindsight Horn = true optimum order. Planned on 6 each, ratios change.
    const planned = dispatch(Y, 1, "horn-order", 6);
    const hindsight = dispatch(Y, 1, "horn-order-hindsight", 6);
    const problem = problemOf(Y);
    expect(customerTicks(problem, hindsight.completion)).toBe(
      oneCrewCost(problem, hornOrder(problem)),
    );
    const plannedOrder = hornOrder(problemOf(Y, [6, 6, 6]));
    expect(planned.start).toEqual(
      plannedOrder.reduce<number[]>(
        (start, j, n) => {
          start[j] =
            n === 0
              ? 0
              : start[plannedOrder[n - 1]!]! +
                Y.segments[plannedOrder[n - 1]!]!.ticks;
          return start;
        },
        [0, 0, 0],
      ),
    );
  });
});

describe("Horn-order against its hindsight twin", () => {
  it("plans on the typical time, so a quick repair the plan cannot see waits", () => {
    // 0 ─ 1, 0 ─ 2. seg0: 10 customers, 1 tick; seg1: 12 customers, 6 ticks.
    // Planned on 6 each: 12/6 > 10/6, seg1 first. True times: 10/1 > 12/6, seg0 first.
    const s = handStorm([-1, 0, 0], [0, 10, 12], [1, 2], [1, 6]);
    const problem = problemOf(s);
    const planned = dispatch(s, 1, "horn-order", 6);
    const hindsight = dispatch(s, 1, "horn-order-hindsight", 6);
    expect(planned.start).toEqual([6, 0]);
    expect(hindsight.start).toEqual([0, 1]);
    expect(customerTicks(problem, planned.completion)).toBe(10 * 7 + 12 * 6);
    expect(customerTicks(problem, hindsight.completion)).toBe(10 * 1 + 12 * 7);
  });
});

describe("ties follow the pre-registered keys, then the lowest index", () => {
  // 0 ─ 1, 0 ─ 2 ─ 3. Broken 1, 2, 3 carrying 10, 10, 30. Downstream: 10, 40, 30.
  const fork = handStorm([-1, 0, 0, 2], [0, 10, 10, 30], [1, 2, 3], [1, 1, 1]);

  it("most customers now: equal gains go to the most customers downstream", () => {
    // Gains 10, 10, 0 → seg1 (40 downstream) beats seg0. Then seg2 (30 now), then seg0.
    expect(dispatch(fork, 1, "most-customers-now", 6).start).toEqual([2, 0, 1]);
  });

  it("most customers now: equal gains and downstream go to the shallower segment", () => {
    // 0 ─ 1 ─ 2, 0 ─ 3. Broken 2 (seg0, depth 2) and 3 (seg1, depth 1), 7 customers each.
    const s = handStorm([-1, 0, 1, 0], [0, 0, 7, 7], [2, 3], [1, 1]);
    expect(dispatch(s, 1, "most-customers-now", 6).start).toEqual([1, 0]);
  });

  it("most customers now: customers downstream decide before depth", () => {
    // 0 ─ 1, 0 ─ 2 ─ 3 ─ 4, bus 2 intact. seg0 (bus 1, depth 1) and seg1 (bus 3, depth 2)
    // both bring back 7 now; seg1 has 27 downstream to seg0's 7, so it goes first.
    const s = handStorm(
      [-1, 0, 0, 2, 3],
      [0, 7, 0, 7, 20],
      [1, 3, 4],
      [1, 1, 1],
    );
    expect(dispatch(s, 1, "most-customers-now", 6).start).toEqual([2, 0, 1]);
  });

  it("upstream first: equal depths go to the most customers downstream", () => {
    // seg0 and seg1 both 1 hop; seg1 has 40 downstream, seg0 10. Then seg0, then seg2.
    expect(dispatch(fork, 1, "upstream-first", 6).start).toEqual([1, 0, 2]);
  });

  it("critical first: equal depths go to the most downstream, and depth beats customers now", () => {
    // Critical buses 1 and 3 put all three segments on a critical path.
    // Depth 1: seg0 (10 down) vs seg1 (40 down) → seg1. Then seg0 (depth 1) before
    // seg2 (depth 2), though seg2 would bring back 30 now.
    const critical = handStorm(
      [-1, 0, 0, 2],
      [0, 10, 10, 30],
      [1, 2, 3],
      [1, 1, 1],
      [1, 3],
    );
    expect(dispatch(critical, 1, "critical-first", 6).start).toEqual([1, 0, 2]);
  });

  it("nearest first: equal hops go to the shallower segment before the lower index", () => {
    // 0 ─ 1 ─ 2 ─ 3, 0 ─ 4. Broken 1 (seg0), 3 (seg1, depth 3), 4 (seg2, depth 1).
    // From bus 1, seg1 and seg2 are both 2 hops; seg2 is shallower.
    const s = handStorm(
      [-1, 0, 1, 2, 0],
      [0, 1, 1, 1, 1],
      [1, 3, 4],
      [1, 1, 1],
    );
    expect(dispatch(s, 1, "nearest-first", 6).start).toEqual([0, 2, 1]);
  });
});

describe("every rule on drawn storms", () => {
  const configs: Partial<RestorationConfig>[] = [
    {},
    { damagedSegments: { min: 1, max: 1 }, horizonTicks: 17 },
    { damagedSegments: { min: 50, max: 50 }, horizonTicks: 50 * 16 + 1 },
    { repair: { ...DEFAULT_CONFIG.repair, sigma: 0 } },
  ];

  it("produces a valid, never-idle schedule for every rule and crew count", () => {
    for (const [c, config] of configs.entries()) {
      for (let i = 0; i < 25; i++) {
        const storm = drawn(config, `rules-valid-${c}-${i}`);
        const problem = problemOf(storm);
        for (const crews of [1, 2, 3, 4]) {
          for (const rule of RESTORATION_RULES) {
            const s = dispatch(storm, crews, rule, 6);
            const rebuilt = scheduleFromStarts(problem, s.start, crews);
            expect(rebuilt.completion).toEqual(s.completion);
            // Never idle: while any repair is unstarted, every crew is busy.
            const lastStart = Math.max(...s.start);
            for (let t = 0; t < lastStart; t++) {
              const busy = s.start.filter(
                (st, j) => st <= t && t < s.completion[j]!,
              ).length;
              expect(busy).toBe(Math.min(crews, problem.ticks.length));
            }
          }
        }
      }
    }
  }, 60_000);

  it("no rule beats Horn's optimum with one crew, and hindsight Horn-order equals it", () => {
    for (let i = 0; i < 300; i++) {
      const storm = drawn({}, `rules-horn-${i}`);
      const problem = problemOf(storm);
      const optimum = oneCrewCost(problem, hornOrder(problem));
      for (const rule of RESTORATION_RULES) {
        expect(
          customerTicks(problem, dispatch(storm, 1, rule, 6).completion),
        ).toBeGreaterThanOrEqual(optimum);
      }
      expect(
        customerTicks(
          problem,
          dispatch(storm, 1, "horn-order-hindsight", 6).completion,
        ),
      ).toBe(optimum);
    }
  });

  it("Horn-order and its hindsight twin agree when every repair takes the median", () => {
    for (let i = 0; i < 100; i++) {
      const storm = drawn(
        { repair: { ...DEFAULT_CONFIG.repair, sigma: 0 } },
        `rules-flat-${i}`,
      );
      for (const crews of [1, 2, 4]) {
        expect(dispatch(storm, crews, "horn-order", 6)).toEqual(
          dispatch(storm, crews, "horn-order-hindsight", 6),
        );
      }
    }
  });

  it("breaks every tie the same way every time", () => {
    for (let i = 0; i < 50; i++) {
      const storm = drawn(
        { repair: { ...DEFAULT_CONFIG.repair, sigma: 0 } },
        `rules-ties-${i}`,
      );
      for (const rule of RESTORATION_RULES) {
        expect(JSON.stringify(dispatch(storm, 3, rule, 6))).toBe(
          JSON.stringify(dispatch(storm, 3, rule, 6)),
        );
      }
    }
  });
});
