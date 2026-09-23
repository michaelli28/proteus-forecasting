/**
 * Horn (1972): the exact one-crew order for tree-shaped precedence,
 * minimising Σ customers × restoration time.
 *
 * Repeatedly take the group with the most customers per repair tick and append
 * it to the group holding its head's parent; a virtual root holds the forest.
 * Ratios are compared by cross-multiplication, so ties are exact on integers.
 */

import type { Rng } from "../../rng.js";
import type { RepairProblem } from "./objective.js";

/** Which of several equally dense groups merges first: lowest id, highest id, or a seeded pick. */
export type TieBreak = "low" | "high" | Rng;

export function hornOrder(
  problem: RepairProblem,
  tie: TieBreak = "low",
): number[] {
  const k = problem.ticks.length;
  const root = k;
  const headParent = problem.parent.map((p) => (p === -1 ? root : p));
  const group = Array.from({ length: k + 1 }, (_, v) => v);
  const weight = [...problem.customers, 0];
  const time = [...problem.ticks, 0];
  const sequence = new Map<number, number[]>();
  for (let g = 0; g < k; g++) sequence.set(g, [g]);
  sequence.set(root, []);

  const find = (v: number): number => {
    while (group[v] !== v) {
      group[v] = group[group[v]!]!;
      v = group[v]!;
    }
    return v;
  };
  const denser = (a: number, b: number): boolean =>
    weight[a]! * time[b]! > weight[b]! * time[a]!;

  const live = new Set(Array.from({ length: k }, (_, g) => g));
  while (live.size > 0) {
    const candidates = [...live].sort((a, b) => a - b);
    let best = [candidates[0]!];
    for (const g of candidates.slice(1)) {
      if (denser(g, best[0]!)) best = [g];
      else if (!denser(best[0]!, g)) best.push(g);
    }
    const g =
      tie === "low"
        ? best[0]!
        : tie === "high"
          ? best[best.length - 1]!
          : tie.pick(best);
    // The parent's group already holds everything that must precede g's head.
    const h = find(headParent[g]!);
    sequence.set(h, [...sequence.get(h)!, ...sequence.get(g)!]);
    weight[h] = weight[h]! + weight[g]!;
    time[h] = time[h]! + time[g]!;
    group[g] = h;
    live.delete(g);
    sequence.delete(g);
  }
  return sequence.get(root)!;
}
