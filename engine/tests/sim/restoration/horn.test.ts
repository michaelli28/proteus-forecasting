import { describe, it, expect } from "vitest";
import { Rng } from "../../../src/sim/rng.js";
import { hornOrder } from "../../../src/sim/adapters/restoration/horn.js";
import type { RepairProblem } from "../../../src/sim/adapters/restoration/objective.js";
import { DEFAULT_CONFIG } from "../../../src/sim/adapters/restoration/config.js";
import {
  drawStorm,
  problemOf,
} from "../../../src/sim/adapters/restoration/storm.js";
import { PROBLEM_SHAPES, randomProblem } from "./fixtures.js";
import {
  bruteForceOneCrew,
  exhaustiveOptimum,
  oneCrewCost,
} from "./exhaustive.js";

/** ≥1,000 non-trivial trees (k 2–8): the generator's own plus hand shapes. */
function trees(): RepairProblem[] {
  const out: RepairProblem[] = [];
  const rng = new Rng("horn-trees");
  const config = {
    ...DEFAULT_CONFIG,
    damagedSegments: { min: 2, max: 8 },
    horizonTicks: 8 * 16 + 1,
  };
  for (let i = 0; i < 1200; i++) {
    out.push(problemOf(drawStorm(config, new Rng(`horn-storm-${i}`))));
  }
  for (const shape of PROBLEM_SHAPES) {
    for (let i = 0; i < 120; i++)
      out.push(randomProblem(rng, 2 + rng.int(7), shape));
  }
  return out;
}

function smithIgnoringTree(problem: RepairProblem): number[] {
  return problem.ticks
    .map((_, j) => j)
    .sort(
      (a, b) =>
        problem.customers[b]! * problem.ticks[a]! -
          problem.customers[a]! * problem.ticks[b]! || a - b,
    );
}

/** Plausible but wrong: among repairable-now segments, best own ratio, no merging. */
function readyBestRatio(problem: RepairProblem): number[] {
  const done = new Set<number>();
  const order: number[] = [];
  while (order.length < problem.ticks.length) {
    const ready = problem.ticks
      .map((_, j) => j)
      .filter(
        (j) =>
          !done.has(j) &&
          (problem.parent[j] === -1 || done.has(problem.parent[j]!)),
      );
    const j = ready.reduce((best, c) =>
      problem.customers[c]! * problem.ticks[best]! >
      problem.customers[best]! * problem.ticks[c]!
        ? c
        : best,
    );
    done.add(j);
    order.push(j);
  }
  return order;
}

const ALL = trees();
const BRUTE = ALL.map((problem) => bruteForceOneCrew(problem));

describe("Horn's algorithm", () => {
  it("has at least 1,000 non-trivial trees to test on", () => {
    const nonTrivial = ALL.filter((p) => p.parent.some((q) => q !== -1));
    expect(nonTrivial.length).toBeGreaterThanOrEqual(1000);
  });

  it("the brute force visits every order, and exactly the tree-respecting ones", () => {
    const factorial = (n: number): number =>
      n <= 1 ? 1 : n * factorial(n - 1);
    for (const [i, problem] of ALL.entries()) {
      const k = problem.ticks.length;
      // A forest on k nodes has k! / Π(subtree sizes) orders with parents first.
      const size = new Array<number>(k).fill(1);
      for (let j = k - 1; j >= 0; j--) {
        const p = problem.parent[j]!;
        if (p !== -1) size[p] = size[p]! + size[j]!;
      }
      const extensions = factorial(k) / size.reduce((a, b) => a * b, 1);
      expect(BRUTE[i]!.orders).toBe(factorial(k));
      expect(BRUTE[i]!.precedenceOrders).toBe(extensions);
    }
  });

  it("one crew never gains by repairing downstream first", () => {
    const bad = BRUTE.filter((b) => b.all !== b.precedence);
    expect(bad).toEqual([]);
  });

  for (const tie of ["low", "high", "random"] as const) {
    it(`equals brute force on every tree (tie-break: ${tie})`, () => {
      const rng = new Rng(`horn-tie-${tie}`);
      const wrong: number[] = [];
      for (const [i, problem] of ALL.entries()) {
        const order = hornOrder(problem, tie === "random" ? rng : tie);
        expect([...order].sort((a, b) => a - b)).toEqual(
          problem.ticks.map((_, j) => j),
        );
        const position = new Map(order.map((j, n) => [j, n]));
        for (const [j, p] of problem.parent.entries()) {
          if (p !== -1) expect(position.get(p)!).toBeLessThan(position.get(j)!);
        }
        if (oneCrewCost(problem, order) !== BRUTE[i]!.all) wrong.push(i);
      }
      expect(wrong).toEqual([]);
    }, 60_000);
  }

  it("ties go to the group with the lowest head index by default (pre-registration §9.1)", () => {
    // Two lone breaks, 10 customers and 6 ticks each: 10·6 = 10·6.
    const lone: RepairProblem = {
      parent: [-1, -1],
      customers: [10, 10],
      ticks: [6, 6],
    };
    expect(hornOrder(lone)).toEqual([0, 1]);
    expect(hornOrder(lone, "high")).toEqual([1, 0]);
    // seg1 (20 per 6) merges into seg0 first, making group {0,1}: 20 per 12.
    // That ties seg2's 10 per 6 (20·6 = 10·12), and head 0 < head 2.
    const merged: RepairProblem = {
      parent: [-1, 0, -1],
      customers: [0, 20, 10],
      ticks: [6, 6, 6],
    };
    expect(hornOrder(merged)).toEqual([0, 1, 2]);
    expect(hornOrder(merged, "high")).toEqual([2, 0, 1]);
  });

  it("Smith's rule equals brute force when nothing is above anything", () => {
    const rng = new Rng("smith-stars");
    for (let i = 0; i < 1000; i++) {
      const star = randomProblem(rng, 1 + rng.int(8), "star");
      expect(oneCrewCost(star, smithIgnoringTree(star))).toBe(
        bruteForceOneCrew(star).all,
      );
    }
  }, 60_000);

  it("negative controls: the brute force catches two plausible wrong algorithms", () => {
    const smithWrong = ALL.filter(
      (p, i) => oneCrewCost(p, smithIgnoringTree(p)) !== BRUTE[i]!.all,
    ).length;
    const readyWrong = ALL.filter(
      (p, i) => oneCrewCost(p, readyBestRatio(p)) !== BRUTE[i]!.all,
    ).length;
    expect(smithWrong).toBeGreaterThan(100);
    expect(readyWrong).toBeGreaterThan(20);
  });

  it("the exhaustive multi-crew search with one crew agrees with brute force", () => {
    for (const [i, problem] of ALL.slice(0, 200).entries()) {
      if (problem.ticks.length > 7) continue;
      expect(exhaustiveOptimum(problem, 1)).toBe(BRUTE[i]!.all);
    }
  }, 60_000);
});
