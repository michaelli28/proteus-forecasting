/**
 * Brute force, for tests only. Deliberately independent of the list-schedule
 * argument the MILP's horizon rests on: every crew assignment × every order.
 */

import {
  ancestors,
  customerTicks,
  listSchedule,
} from "../../../src/sim/adapters/restoration/objective.js";
import type { RepairProblem } from "../../../src/sim/adapters/restoration/objective.js";

export function oneCrewCost(
  problem: RepairProblem,
  order: readonly number[],
): number {
  return customerTicks(problem, listSchedule(problem, order, 1).completion);
}

/** Heap's algorithm: visits all k! orders, reusing one mutated array. */
function permutations(
  k: number,
  visit: (order: readonly number[]) => void,
): void {
  const order = Array.from({ length: k }, (_, i) => i);
  const c = new Array<number>(k).fill(0);
  visit(order);
  let i = 0;
  while (i < k) {
    if (c[i]! < i) {
      const swap = i % 2 === 0 ? 0 : c[i]!;
      [order[swap], order[i]] = [order[i]!, order[swap]!];
      visit(order);
      c[i]!++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

function costOf(
  problem: RepairProblem,
  chains: readonly (readonly number[])[],
  completion: readonly number[],
): number {
  let cost = 0;
  for (let j = 0; j < chains.length; j++) {
    let r = 0;
    for (const a of chains[j]!) r = Math.max(r, completion[a]!);
    cost += problem.customers[j]! * r;
  }
  return cost;
}

export interface OneCrewBruteForce {
  /** Min customer-ticks over all k! orders. */
  readonly all: number;
  /** Min over upstream-before-downstream orders only. */
  readonly precedence: number;
  readonly orders: number;
  readonly precedenceOrders: number;
}

export function bruteForceOneCrew(problem: RepairProblem): OneCrewBruteForce {
  const k = problem.ticks.length;
  const chains = ancestors(problem);
  let all = Infinity;
  let precedence = Infinity;
  let orders = 0;
  let precedenceOrders = 0;
  const completion = new Array<number>(k).fill(0);
  const position = new Array<number>(k).fill(0);
  permutations(k, (order) => {
    orders++;
    let t = 0;
    for (let i = 0; i < k; i++) {
      const j = order[i]!;
      t += problem.ticks[j]!;
      completion[j] = t;
      position[j] = i;
    }
    const cost = costOf(problem, chains, completion);
    all = Math.min(all, cost);
    const respects = problem.parent.every(
      (p, j) => p === -1 || position[p]! < position[j]!,
    );
    if (respects) {
      precedenceOrders++;
      precedence = Math.min(precedence, cost);
    }
  });
  return { all, precedence, orders, precedenceOrders };
}

/** Every split of every order into `crews` back-to-back sequences, crew c taking part c. */
export function exhaustiveOptimum(
  problem: RepairProblem,
  crews: number,
): number {
  const k = problem.ticks.length;
  const chains = ancestors(problem);
  let best = Infinity;
  const completion = new Array<number>(k).fill(0);
  const cuts = new Array<number>(crews - 1).fill(0);
  permutations(k, (order) => {
    // Non-decreasing cut points 0..k split the order into `crews` (possibly empty) parts.
    const recurse = (index: number, from: number): void => {
      if (index === crews - 1) {
        let part = 0;
        let t = 0;
        for (let i = 0; i < k; i++) {
          while (part < crews - 1 && i >= cuts[part]!) {
            part++;
            t = 0;
          }
          t += problem.ticks[order[i]!]!;
          completion[order[i]!] = t;
        }
        best = Math.min(best, costOf(problem, chains, completion));
        return;
      }
      for (let cut = from; cut <= k; cut++) {
        cuts[index] = cut;
        recurse(index + 1, cut);
      }
    };
    recurse(0, 0);
  });
  return best;
}
