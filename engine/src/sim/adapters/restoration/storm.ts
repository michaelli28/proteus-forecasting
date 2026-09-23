/**
 * Seeded storm damage on a synthetic radial feeder — a port of spike S2's
 * make_instance, pre-registered in docs/RESTORATION-LAB-PREREG.md §2.
 *
 * Each part of the storm draws from its own named fork, so the same seed gives
 * the same feeder and damage under every rule and crew count, and the same
 * z-values under every σ: only the repair times stretch.
 */

import type { Rng } from "../../rng.js";
import { FEEDER_STYLES } from "./config.js";
import type { FeederStyle, RestorationConfig } from "./config.js";
import type { RepairProblem } from "./objective.js";

export interface Segment {
  /** The segment is the line into this bus. */
  readonly bus: number;
  /** Nearest broken segment upstream, or -1. */
  readonly parent: number;
  readonly ticks: number;
  /** Customers whose nearest broken segment on the way to the substation is this one. */
  readonly customers: number;
  /** Hops from the substation to `bus`. */
  readonly depth: number;
  readonly onCriticalPath: boolean;
}

export interface Storm {
  readonly style: FeederStyle;
  /** Bus 0 is the substation; every other bus's parent has a lower id. */
  readonly feederParent: readonly number[];
  readonly customersAtBus: readonly number[];
  readonly criticalBuses: readonly number[];
  /** Sorted by bus, so a segment's broken ancestors always have lower indices. */
  readonly segments: readonly Segment[];
}

export function feederDepth(feederParent: readonly number[]): number[] {
  const depth = new Array<number>(feederParent.length).fill(0);
  for (let v = 1; v < feederParent.length; v++) {
    depth[v] = depth[feederParent[v]!]! + 1;
  }
  return depth;
}

function drawFeeder(rng: Rng, nodes: number, style: FeederStyle): number[] {
  const parent = [-1];
  for (let i = 1; i < nodes; i++) {
    if (style === "recursive") parent.push(rng.int(i));
    else parent.push(rng.next() < 0.55 ? i - 1 : rng.int(i));
  }
  return parent;
}

export function drawStorm(config: RestorationConfig, rng: Rng): Storm {
  const { min, max } = config.damagedSegments;
  const k = min + rng.fork("size").int(max - min + 1);

  const shape = rng.fork("feeder");
  const style = shape.pick(FEEDER_STYLES);
  const low = Math.max(k + 1, 12);
  const high = Math.max(k + 2, 60);
  const nodes = low + shape.int(high - low);
  const feederParent = drawFeeder(shape, nodes, style);

  // Both draws happen for every bus so the stream stays positional.
  const people = rng.fork("customers");
  const customersAtBus = feederParent.map((_, v) => {
    const zero = people.next() < config.zeroCustomerShare;
    const count = Math.max(1, Math.round(Math.exp(people.normal(2.5, 1.2))));
    return v === 0 || zero ? 0 : count;
  });

  const buses = Array.from({ length: nodes - 1 }, (_, i) => i + 1);
  const brokenBuses = rng
    .fork("damage")
    .sample(buses, k)
    .sort((a, b) => a - b);
  const criticalBuses = rng
    .fork("critical")
    .sample(buses, Math.min(config.criticalBuses, nodes - 1))
    .sort((a, b) => a - b);

  const times = rng.fork("repair");
  const { medianTicks, sigma, minTicks, maxTicks } = config.repair;
  const ticks = brokenBuses.map(() =>
    Math.min(
      maxTicks,
      Math.max(
        minTicks,
        Math.round(Math.exp(Math.log(medianTicks) + sigma * times.normal())),
      ),
    ),
  );

  const index = new Map<number, number>(brokenBuses.map((bus, j) => [bus, j]));
  const nearestBroken = (bus: number): number => {
    for (let v = bus; v !== 0; v = feederParent[v]!) {
      const j = index.get(v);
      if (j !== undefined) return j;
    }
    return -1;
  };
  const parent = brokenBuses.map((bus) => nearestBroken(feederParent[bus]!));
  const customers = new Array<number>(k).fill(0);
  for (let v = 1; v < nodes; v++) {
    const j = nearestBroken(v);
    if (j >= 0) customers[j] = customers[j]! + customersAtBus[v]!;
  }
  const critical = new Array<boolean>(k).fill(false);
  for (const bus of criticalBuses) {
    for (let j = nearestBroken(bus); j !== -1; j = parent[j]!)
      critical[j] = true;
  }
  const depth = feederDepth(feederParent);

  return {
    style,
    feederParent,
    customersAtBus,
    criticalBuses,
    segments: brokenBuses.map((bus, j) => ({
      bus,
      parent: parent[j]!,
      ticks: ticks[j]!,
      customers: customers[j]!,
      depth: depth[bus]!,
      onCriticalPath: critical[j]!,
    })),
  };
}

/** The scheduling view of a storm; `ticks` overrides the true repair times (for planning). */
export function problemOf(
  storm: Storm,
  ticks: readonly number[] = storm.segments.map((s) => s.ticks),
): RepairProblem {
  if (ticks.length !== storm.segments.length) {
    throw new RangeError(
      `expected ${storm.segments.length} segments' repair ticks; got ${ticks.length}`,
    );
  }
  return {
    parent: storm.segments.map((s) => s.parent),
    customers: storm.segments.map((s) => s.customers),
    ticks,
  };
}

/** Each segment's customers plus every customer below it. Parents have lower indices. */
export function downstreamCustomers(problem: RepairProblem): number[] {
  const total = [...problem.customers];
  for (let j = total.length - 1; j >= 0; j--) {
    const p = problem.parent[j]!;
    if (p !== -1) total[p] = total[p]! + total[j]!;
  }
  return total;
}
