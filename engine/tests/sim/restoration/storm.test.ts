import { describe, it, expect } from "vitest";
import { Rng } from "../../../src/sim/rng.js";
import {
  DEFAULT_CONFIG,
  validateConfig,
} from "../../../src/sim/adapters/restoration/config.js";
import type { RestorationConfig } from "../../../src/sim/adapters/restoration/config.js";
import {
  drawStorm,
  feederDepth,
  problemOf,
  downstreamCustomers,
} from "../../../src/sim/adapters/restoration/storm.js";
import type { Storm } from "../../../src/sim/adapters/restoration/storm.js";

// Storm 0 of the lab (seed restoration-lab/storm-0, DEFAULT_CONFIG). A renamed fork or a
// reordered draw silently moves every published number; this turns it into a failure.
// Change it only with a deliberate generator change, recorded as a deviation.
const LAB_STORM_0 =
  '{"style":"recursive",' +
  '"feederParent":[-1,0,0,1,2,3,4,6,6,4,5,6,0,1,13,7,1,15,6,3,14,19,3,6,6,2,8,14,6,8,10,10],' +
  '"customersAtBus":[0,0,18,2,9,4,34,0,13,10,10,1,2,12,7,20,14,0,3,5,0,13,7,48,9,0,4,3,15,180,5,36],' +
  '"criticalBuses":[4,18],"segments":[' +
  '{"bus":1,"parent":-1,"ticks":12,"customers":20,"depth":1,"onCriticalPath":false},' +
  '{"bus":5,"parent":0,"ticks":5,"customers":55,"depth":3,"onCriticalPath":false},' +
  '{"bus":6,"parent":-1,"ticks":8,"customers":252,"depth":3,"onCriticalPath":true},' +
  '{"bus":9,"parent":-1,"ticks":3,"customers":10,"depth":3,"onCriticalPath":false},' +
  '{"bus":13,"parent":0,"ticks":16,"customers":22,"depth":2,"onCriticalPath":false},' +
  '{"bus":16,"parent":0,"ticks":6,"customers":14,"depth":2,"onCriticalPath":false},' +
  '{"bus":18,"parent":2,"ticks":8,"customers":3,"depth":4,"onCriticalPath":true},' +
  '{"bus":20,"parent":4,"ticks":5,"customers":0,"depth":4,"onCriticalPath":false},' +
  '{"bus":22,"parent":0,"ticks":10,"customers":7,"depth":3,"onCriticalPath":false},' +
  '{"bus":23,"parent":2,"ticks":5,"customers":48,"depth":4,"onCriticalPath":false},' +
  '{"bus":24,"parent":2,"ticks":3,"customers":9,"depth":4,"onCriticalPath":false},' +
  '{"bus":28,"parent":2,"ticks":4,"customers":15,"depth":4,"onCriticalPath":false}]}';

const mean = (xs: readonly number[]): number =>
  xs.reduce((sum, x) => sum + x, 0) / xs.length;
const spread = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const median = (xs: readonly number[]): number =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

function expectWithin(
  value: number,
  low: number,
  high: number,
  what: string,
): void {
  expect(value, what).toBeGreaterThanOrEqual(low);
  expect(value, what).toBeLessThanOrEqual(high);
}

function drawMany(config: RestorationConfig, count = 2000): Storm[] {
  return Array.from({ length: count }, (_, i) =>
    drawStorm(config, new Rng(`dist-${i}`)),
  );
}

function withK(min: number, max: number, sigma = 0.6): RestorationConfig {
  return {
    ...DEFAULT_CONFIG,
    damagedSegments: { min, max },
    repair: { ...DEFAULT_CONFIG.repair, sigma },
    horizonTicks: max * DEFAULT_CONFIG.repair.maxTicks + 1,
  };
}

function nearestBrokenAbove(
  feederParent: readonly number[],
  brokenBuses: ReadonlySet<number>,
  bus: number,
): number {
  for (let v = feederParent[bus]!; v > 0; v = feederParent[v]!) {
    if (brokenBuses.has(v)) return v;
  }
  return -1;
}

describe("drawStorm", () => {
  it("draws a well-formed feeder and damage at every k in range", () => {
    const seenK = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const config = withK(1, 50);
      const storm = drawStorm(config, new Rng(`storm-shape-${i}`));
      const n = storm.feederParent.length;
      const k = storm.segments.length;
      seenK.add(k);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(50);
      expect(n).toBeGreaterThanOrEqual(Math.max(k + 1, 12));
      expect(n).toBeLessThan(Math.max(k + 2, 60));
      expect(storm.feederParent[0]).toBe(-1);
      for (let v = 1; v < n; v++) {
        expect(storm.feederParent[v]).toBeGreaterThanOrEqual(0);
        expect(storm.feederParent[v]).toBeLessThan(v);
      }
      expect(storm.customersAtBus[0]).toBe(0);
      const buses = storm.segments.map((s) => s.bus);
      expect(buses).toEqual([...buses].sort((a, b) => a - b));
      expect(new Set(buses).size).toBe(k);
      const broken = new Set(buses);
      for (const [j, segment] of storm.segments.entries()) {
        expect(segment.bus).toBeGreaterThanOrEqual(1);
        expect(segment.parent).toBeLessThan(j);
        const above = nearestBrokenAbove(
          storm.feederParent,
          broken,
          segment.bus,
        );
        expect(
          segment.parent === -1 ? -1 : storm.segments[segment.parent]!.bus,
        ).toBe(above);
        expect(segment.ticks).toBeGreaterThanOrEqual(1);
        expect(segment.ticks).toBeLessThanOrEqual(16);
        expect(Number.isInteger(segment.ticks)).toBe(true);
      }
      expect(storm.criticalBuses.length).toBe(2);
    }
    // The extremes are the risky cases: one break, and a 51–59-bus feeder with 50 down.
    expect(seenK.has(1) && seenK.has(50)).toBe(true);
  });

  it("assigns each customer to the nearest break on its way to the substation", () => {
    for (let i = 0; i < 100; i++) {
      const storm = drawStorm(withK(6, 12), new Rng(`storm-customers-${i}`));
      const indexOf = new Map(storm.segments.map((s, j) => [s.bus, j]));
      const expected = storm.segments.map(() => 0);
      for (let v = 1; v < storm.feederParent.length; v++) {
        let u = v;
        while (u > 0 && !indexOf.has(u)) u = storm.feederParent[u]!;
        if (u > 0) expected[indexOf.get(u)!]! += storm.customersAtBus[v]!;
      }
      // Per segment, not a total: these counts are the weights every rule and reference uses.
      expect(storm.segments.map((s) => s.customers)).toEqual(expected);
    }
  });

  it("marks exactly the segments between a critical bus and the substation", () => {
    for (let i = 0; i < 100; i++) {
      const storm = drawStorm(withK(6, 12), new Rng(`storm-critical-${i}`));
      const onPath = new Set<number>();
      for (const bus of storm.criticalBuses) {
        for (let v = bus; v > 0; v = storm.feederParent[v]!) onPath.add(v);
      }
      for (const segment of storm.segments) {
        expect(segment.onCriticalPath).toBe(onPath.has(segment.bus));
      }
    }
  });

  it("is a pure function of its seed", () => {
    const a = drawStorm(DEFAULT_CONFIG, new Rng("same"));
    const b = drawStorm(DEFAULT_CONFIG, new Rng("same"));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(
      JSON.stringify(drawStorm(DEFAULT_CONFIG, new Rng("other"))),
    ).not.toBe(JSON.stringify(a));
  });

  it("does not depend on the rule or the crew count", () => {
    const base = drawStorm(DEFAULT_CONFIG, new Rng("crn"));
    const other = drawStorm(
      { ...DEFAULT_CONFIG, rule: "upstream-first", crews: 4 },
      new Rng("crn"),
    );
    expect(JSON.stringify(other)).toBe(JSON.stringify(base));
  });

  it("changes only repair times when sigma changes, and in the same direction", () => {
    for (let i = 0; i < 50; i++) {
      const a = drawStorm(withK(6, 12, 0.6), new Rng(`sigma-${i}`));
      const b = drawStorm(withK(6, 12, 1.0), new Rng(`sigma-${i}`));
      const flat = drawStorm(withK(6, 12, 0), new Rng(`sigma-${i}`));
      expect(b.feederParent).toEqual(a.feederParent);
      expect(b.customersAtBus).toEqual(a.customersAtBus);
      expect(b.criticalBuses).toEqual(a.criticalBuses);
      expect(b.segments.map((s) => s.bus)).toEqual(
        a.segments.map((s) => s.bus),
      );
      expect(flat.segments.every((s) => s.ticks === 6)).toBe(true);
      for (const [j, seg] of a.segments.entries()) {
        // Same z, wider spread: never on the other side of the median.
        expect(
          Math.sign(b.segments[j]!.ticks - 6) * Math.sign(seg.ticks - 6),
        ).not.toBe(-1);
      }
    }
  });

  // Pre-registration §2. Bands are several standard errors wide at 2,000 storms.
  it("draws from the pre-registered distributions", () => {
    const storms = drawMany(DEFAULT_CONFIG);

    const atBus = storms.flatMap((s) => s.customersAtBus.slice(1));
    expectWithin(
      atBus.filter((c) => c === 0).length / atBus.length,
      0.23,
      0.27,
      "share of buses with no customers",
    );
    // max(1, round(exp(N(2.5, 1.2)))) above 1 customer: exact mean 2.61, spread 1.09.
    const logCustomers = atBus.filter((c) => c > 1).map(Math.log);
    expectWithin(mean(logCustomers), 2.5, 2.72, "mean ln(customers)");
    expectWithin(spread(logCustomers), 0.99, 1.19, "spread of ln(customers)");

    const lateral = storms.filter((s) => s.style === "lateral");
    const recursive = storms.filter((s) => s.style === "recursive");
    expectWithin(lateral.length / storms.length, 0.45, 0.55, "lateral share");
    const maxDepth = (group: readonly Storm[]): number =>
      mean(group.map((s) => Math.max(...feederDepth(s.feederParent))));
    expectWithin(maxDepth(lateral), 10, 12, "lateral feeder depth");
    expectWithin(maxDepth(recursive), 5.5, 6.5, "recursive feeder depth");

    // Clipping to 1–16 ticks shrinks the spread of ln(ticks): exact 0.581 at σ 0.6, 0.843 at σ 1.
    const ticks = storms.flatMap((s) => s.segments.map((seg) => seg.ticks));
    expect(median(ticks)).toBe(6);
    expectWithin(
      spread(ticks.map(Math.log)),
      0.53,
      0.63,
      "spread of ln(ticks), σ 0.6",
    );
    const wide = drawMany(withK(6, 12, 1.0)).flatMap((s) =>
      s.segments.map((seg) => Math.log(seg.ticks)),
    );
    expectWithin(spread(wide), 0.79, 0.89, "spread of ln(ticks), σ 1");

    // Critical buses are drawn independently of the damage, so each is broken with chance k/(n−1).
    const criticalBroken = storms.flatMap((s) => {
      const broken = new Set(s.segments.map((seg) => seg.bus));
      return s.criticalBuses.map((bus) => (broken.has(bus) ? 1 : 0));
    });
    const chance = mean(
      storms.map((s) => s.segments.length / (s.feederParent.length - 1)),
    );
    expectWithin(
      mean(criticalBroken) - chance,
      -0.03,
      0.03,
      "critical buses broken beyond chance",
    );
  }, 30_000);

  it("draws the lab's first storms byte for byte", () => {
    expect(
      JSON.stringify(
        drawStorm(DEFAULT_CONFIG, new Rng("restoration-lab/storm-0")),
      ),
    ).toBe(LAB_STORM_0);
    // Storm 0 is recursive; storm 1 pins the lateral branch of the feeder draw.
    const lateral = drawStorm(
      DEFAULT_CONFIG,
      new Rng("restoration-lab/storm-1"),
    );
    expect(lateral.style).toBe("lateral");
    expect(JSON.stringify(lateral.feederParent)).toBe(
      "[-1,0,0,0,3,4,5,0,7,8,8,10,11,12,13,12,6,10,7,18,16,20,12,22,20,9,25,26,27,28,0,29]",
    );
  });

  it("rejects configs whose run could end before the last repair", () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, horizonTicks: 12 * 16 }),
    ).toThrow(/horizonTicks must exceed 192/);
    expect(() =>
      validateConfig({
        ...DEFAULT_CONFIG,
        damagedSegments: { min: 5, max: 4 },
      }),
    ).toThrow(/damagedSegments.max/);
    expect(() => validateConfig({ ...DEFAULT_CONFIG, crews: 0 })).toThrow(
      /crews/,
    );
  });

  it("rejects a customer share, spread or rule outside the pre-registered model", () => {
    for (const zeroCustomerShare of [-0.1, 1, Number.NaN]) {
      expect(() =>
        validateConfig({ ...DEFAULT_CONFIG, zeroCustomerShare }),
      ).toThrow(/zeroCustomerShare must be in \[0, 1\)/);
    }
    expect(() =>
      validateConfig({
        ...DEFAULT_CONFIG,
        repair: { ...DEFAULT_CONFIG.repair, sigma: -0.1 },
      }),
    ).toThrow(/sigma must be >= 0/);
    expect(() =>
      validateConfig({
        ...DEFAULT_CONFIG,
        rule: "shortest-first" as RestorationConfig["rule"],
      }),
    ).toThrow(/unknown rule shortest-first/);
  });

  it("rejects a median repair time outside the clip range", () => {
    // Outside the clip range, the drawn repair times cannot have this median.
    const withMedian = (medianTicks: number): RestorationConfig => ({
      ...DEFAULT_CONFIG,
      repair: { ...DEFAULT_CONFIG.repair, medianTicks },
    });
    for (const medianTicks of [0.5, 17, Number.NaN]) {
      expect(() => validateConfig(withMedian(medianTicks))).toThrow(
        /medianTicks must be in \[1, 16\]/,
      );
    }
    for (const medianTicks of [1, 6, 16]) {
      expect(() => validateConfig(withMedian(medianTicks))).not.toThrow();
    }
  });
});

describe("problemOf and downstreamCustomers", () => {
  it("lifts a storm into the scheduling view, with optional planned times", () => {
    const storm = drawStorm(DEFAULT_CONFIG, new Rng("lift"));
    const problem = problemOf(storm);
    expect(problem.parent).toEqual(storm.segments.map((s) => s.parent));
    expect(problem.customers).toEqual(storm.segments.map((s) => s.customers));
    expect(problem.ticks).toEqual(storm.segments.map((s) => s.ticks));
    const planned = problemOf(
      storm,
      storm.segments.map(() => 6),
    );
    expect(planned.ticks.every((t) => t === 6)).toBe(true);
    const k = storm.segments.length;
    expect(() => problemOf(storm, new Array<number>(k - 1).fill(6))).toThrow(
      new RegExp(`${k} segments.*got ${k - 1}`),
    );
    expect(() => problemOf(storm, new Array<number>(k + 1).fill(6))).toThrow(
      new RegExp(`${k} segments.*got ${k + 1}`),
    );
  });

  it("totals each segment's customers plus everything below it", () => {
    const totals = downstreamCustomers({
      parent: [-1, 0, 1, 0, -1],
      customers: [1, 2, 4, 8, 16],
      ticks: [1, 1, 1, 1, 1],
    });
    expect(totals).toEqual([15, 6, 4, 8, 16]);
  });
});
