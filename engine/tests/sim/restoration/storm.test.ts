import { describe, it, expect } from "vitest";
import { Rng } from "../../../src/sim/rng.js";
import {
  DEFAULT_CONFIG,
  validateConfig,
} from "../../../src/sim/adapters/restoration/config.js";
import type { RestorationConfig } from "../../../src/sim/adapters/restoration/config.js";
import {
  drawStorm,
  problemOf,
  downstreamCustomers,
} from "../../../src/sim/adapters/restoration/storm.js";

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

  it("assigns every customer below a break to exactly one segment", () => {
    for (let i = 0; i < 100; i++) {
      const storm = drawStorm(withK(6, 12), new Rng(`storm-customers-${i}`));
      const broken = new Set(storm.segments.map((s) => s.bus));
      let expected = 0;
      for (let v = 1; v < storm.feederParent.length; v++) {
        let u = v;
        while (u > 0 && !broken.has(u)) u = storm.feederParent[u]!;
        if (u > 0) expected += storm.customersAtBus[v]!;
      }
      const assigned = storm.segments.reduce((sum, s) => sum + s.customers, 0);
      expect(assigned).toBe(expected);
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
