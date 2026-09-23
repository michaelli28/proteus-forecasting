import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { Rng } from "../../src/sim/rng.js";
import {
  DEFAULT_PYTHON,
  parseOptimum,
  parseFloor,
  relistInStartOrder,
  solveOptimum,
  solveLpFloor,
} from "../../src/restoration/solver.js";
import {
  DEFAULT_CONFIG,
  RESTORATION_RULES,
  customerTicks,
  dispatch,
  drawStorm,
  hornOrder,
  listSchedule,
  problemOf,
  scheduleFromStarts,
} from "../../src/sim/adapters/restoration/index.js";
import type {
  RepairProblem,
  Schedule,
} from "../../src/sim/adapters/restoration/index.js";
import { exhaustiveOptimum } from "../sim/restoration/exhaustive.js";
import { randomProblem } from "../sim/restoration/fixtures.js";

const chain: RepairProblem = {
  parent: [-1, 0],
  customers: [0, 10],
  ticks: [2, 3],
};

/** First tick a crew stands idle while a repair is still unstarted, or null (pre-registration §2). */
function firstIdleTick(
  problem: RepairProblem,
  schedule: Schedule,
  crews: number,
): number | null {
  const lastStart = Math.max(...schedule.start);
  for (let t = 0; t < lastStart; t++) {
    const busy = schedule.start.filter(
      (s, j) => s <= t && t < s + problem.ticks[j]!,
    ).length;
    if (busy !== crews) return t;
  }
  return null;
}

describe("parsing the solver's answer", () => {
  it("accepts a proven schedule whose cost matches, and assigns crews", () => {
    const parsed = parseOptimum([chain], 2, {
      ok: true,
      solver: "scipy 1.18.0 / HiGHS",
      results: [
        // Two crews start both at once: segment 1 done at 3, its parent at 2 → 10 × 3.
        { status: "optimal", objective: 30, starts: [0, 0], seconds: 0.01 },
      ],
    });
    expect(parsed.solver).toBe("scipy 1.18.0 / HiGHS");
    expect(parsed.results[0]).toMatchObject({
      proven: true,
      status: "optimal",
      customerTicks: 30,
      seconds: 0.01,
    });
    expect(parsed.results[0]!.schedule!.crew).toEqual([0, 1]);
  });

  it("never reports a time-limited incumbent as proven", () => {
    const parsed = parseOptimum([chain], 1, {
      ok: true,
      solver: "s",
      results: [
        { status: "time_limit", objective: 50, starts: [0, 2], seconds: 60 },
      ],
    });
    expect(parsed.results[0]!.proven).toBe(false);
    expect(parsed.results[0]!.customerTicks).toBe(50);
  });

  it("accepts a time-limited objective above its schedule's cost, and publishes the cost", () => {
    // HiGHS's objective is Σ customers × R_j with R_j held only from below; a
    // schedule found before the time limit can leave R_1 at 6, not 5 → 60, not 50.
    // Pre-registration §4 then falls back to the LP floor, so this must not throw.
    const parsed = parseOptimum([chain], 1, {
      ok: true,
      solver: "s",
      results: [
        { status: "time_limit", objective: 60, starts: [0, 2], seconds: 60 },
      ],
    });
    expect(parsed.results[0]).toMatchObject({
      proven: false,
      status: "time_limit",
      customerTicks: 50,
    });
    expect(parsed.results[0]!.schedule!.start).toEqual([0, 2]);
  });

  it("lets a proven objective sit above its schedule's cost by no more than HiGHS's 1e-4 gap", () => {
    // 50.004 is within 1e-4 × 50.004 ≈ 0.005 of 50: the proof still covers it.
    const parsed = parseOptimum([chain], 1, {
      ok: true,
      solver: "s",
      results: [
        { status: "optimal", objective: 50.004, starts: [0, 2], seconds: 0 },
      ],
    });
    expect(parsed.results[0]).toMatchObject({
      proven: true,
      customerTicks: 50,
    });
    // 60 is 20% above 50: a proof that loose means the formulation overcounts.
    expect(() =>
      parseOptimum([chain], 1, {
        ok: true,
        solver: "s",
        results: [
          { status: "optimal", objective: 60, starts: [0, 2], seconds: 0 },
        ],
      }),
    ).toThrow(/objective 60 is above the recomputed 50 by more than/);
  });

  it("reports no cost at all when HiGHS found no schedule in time", () => {
    const parsed = parseOptimum([chain], 1, {
      ok: true,
      solver: "s",
      results: [
        { status: "time_limit", objective: null, starts: null, seconds: 60 },
      ],
    });
    expect(parsed.results[0]).toEqual({
      proven: false,
      status: "time_limit",
      customerTicks: null,
      schedule: null,
      seconds: 60,
    });
  });

  it("rejects a schedule that costs more than the solver's objective, proven or not", () => {
    // Below the true cost means the formulation undercounts: a bug, whatever the status.
    for (const status of ["optimal", "time_limit"] as const) {
      expect(() =>
        parseOptimum([chain], 1, {
          ok: true,
          solver: "s",
          results: [{ status, objective: 49, starts: [0, 2], seconds: 0 }],
        }),
      ).toThrow(/objective 49 is below the recomputed 50/);
    }
  });

  it("rejects an infeasible schedule, a wrong result count, a proven answer with no schedule and a failure report", () => {
    expect(() =>
      parseOptimum([chain], 1, {
        ok: true,
        solver: "s",
        results: [
          { status: "optimal", objective: 50, starts: [0, 0], seconds: 0 },
        ],
      }),
    ).toThrow(/more than 1/);
    expect(() =>
      parseOptimum([chain, chain], 1, { ok: true, solver: "s", results: [] }),
    ).toThrow(/2 problems.*0 results/);
    expect(() =>
      parseOptimum([chain], 1, {
        ok: true,
        solver: "s",
        results: [
          { status: "optimal", objective: 50, starts: null, seconds: 0 },
        ],
      }),
    ).toThrow(/problem 0.*optimal.*no schedule/);
    expect(() =>
      parseFloor([chain], { ok: false, error: "ValueError: crews" }),
    ).toThrow(/ValueError: crews/);
  });

  it("hands HiGHS's schedule out again in its start order, so no crew idles while a repair waits", () => {
    // Three separate breaks, 2 crews. HiGHS's raw answer: crew 1 frees up at 3,
    // but segment 1 (no customers, so the delay is free) waits until 5.
    const problem: RepairProblem = {
      parent: [-1, -1, -1],
      customers: [10, 0, 5],
      ticks: [4, 2, 3],
    };
    const raw = [0, 5, 0];
    expect(firstIdleTick(problem, scheduleFromStarts(problem, raw, 2), 2)).toBe(
      3,
    );
    const parsed = parseOptimum([problem], 2, {
      ok: true,
      solver: "s",
      // 10 × 4 + 0 × 7 + 5 × 3
      results: [{ status: "optimal", objective: 55, starts: raw, seconds: 0 }],
    });
    const result = parsed.results[0]!;
    // Start order 0, 2, 1: segment 1 goes to crew 1 the moment it frees up.
    expect(result.schedule).toEqual({
      start: [0, 3, 0],
      completion: [4, 5, 3],
      crew: [0, 1, 1],
    });
    expect(result.customerTicks).toBe(55);
    expect(firstIdleTick(problem, result.schedule!, 2)).toBeNull();
  });

  it("publishes the re-listed schedule's cost, not the solver's objective", () => {
    // As above, but segment 1 has 3 customers: back at 5 instead of 7.
    const problem: RepairProblem = {
      parent: [-1, -1, -1],
      customers: [10, 3, 5],
      ticks: [4, 2, 3],
    };
    const parsed = parseOptimum([problem], 2, {
      ok: true,
      solver: "s",
      // 10 × 4 + 3 × 7 + 5 × 3 = 76; re-listed 10 × 4 + 3 × 5 + 5 × 3 = 70.
      results: [
        { status: "time_limit", objective: 76, starts: [0, 5, 0], seconds: 60 },
      ],
    });
    expect(parsed.results[0]!.customerTicks).toBe(70);
    expect(parsed.results[0]!.proven).toBe(false);
  });

  it("treats a re-listing that raises the cost as a bug, never a result", () => {
    // No feasible input can do this (re-listing moves no repair later, next
    // test), so the check is pinned with a doctored cost: the true one is 50.
    expect(() =>
      relistInStartOrder(chain, { start: [0, 2], customerTicks: 49 }, 1),
    ).toThrow(/re-listing raised the cost from 49 to 50/);
  });

  it("re-listing in start order moves no repair later, on schedules with idle gaps", () => {
    // Each crew works its own queue and waits 0–5 ticks before each repair: feasible, often idle.
    const rng = new Rng("relist-no-later");
    let idleBefore = 0;
    for (let n = 0; n < 500; n++) {
      const k = 1 + rng.int(11);
      const crews = 1 + rng.int(4);
      const problem = randomProblem(rng, k, "tree");
      const free = new Array<number>(crews).fill(0);
      const start = new Array<number>(k).fill(0);
      for (const j of rng.shuffle(Array.from({ length: k }, (_, i) => i))) {
        const c = rng.int(crews);
        start[j] = free[c]! + rng.int(6);
        free[c] = start[j]! + problem.ticks[j]!;
      }
      const raw = scheduleFromStarts(problem, start, crews);
      if (firstIdleTick(problem, raw, crews) !== null) idleBefore++;
      const rawCost = customerTicks(problem, raw.completion);
      const relisted = relistInStartOrder(
        problem,
        { start, customerTicks: rawCost },
        crews,
      );
      for (const [j, s] of relisted.schedule.start.entries()) {
        expect(s).toBeLessThanOrEqual(start[j]!);
      }
      expect(relisted.customerTicks).toBeLessThanOrEqual(rawCost);
      expect(firstIdleTick(problem, relisted.schedule, crews)).toBeNull();
    }
    // The property was exercised on idle schedules, not only on ones already tight.
    expect(idleBefore).toBeGreaterThan(400);
  });

  it("takes the LP floor as the solver's objective, and refuses one that did not solve", () => {
    expect(
      parseFloor([chain, chain], {
        ok: true,
        solver: "s",
        results: [
          { status: "optimal", objective: 42.5, starts: null, seconds: 0.2 },
          { status: "optimal", objective: 50, starts: null, seconds: 0.1 },
        ],
      }),
    ).toEqual({
      solver: "s",
      results: [
        { customerTicks: 42.5, seconds: 0.2 },
        { customerTicks: 50, seconds: 0.1 },
      ],
    });
    expect(() =>
      parseFloor([chain, chain], {
        ok: true,
        solver: "s",
        results: [
          { status: "optimal", objective: 50, starts: null, seconds: 0 },
          { status: "time_limit", objective: 48, starts: null, seconds: 60 },
        ],
      }),
    ).toThrow(/problem 1.*time_limit/);
  });
});

describe("a bridge that cannot answer", () => {
  it("a missing interpreter names the path instead of returning nothing", async () => {
    await expect(
      solveLpFloor([chain], 1, { pythonPath: "/nonexistent/python" }),
    ).rejects.toThrow(/\/nonexistent\/python/);
  });

  it("an interpreter that exits without answering names the path and says so", async () => {
    // Node refuses `-m`: it exits non-zero with nothing on stdout, like a crashed bridge.
    // A batch the size of the lab's fifty-breaks cell (~135 KB) outlasts the pipe
    // buffer, so the request write breaks the pipe: that must reject, not crash.
    const fifty: RepairProblem = {
      parent: Array.from({ length: 50 }, (_, j) => j - 1),
      customers: new Array<number>(50).fill(123456),
      ticks: new Array<number>(50).fill(16),
    };
    const batch = Array.from({ length: 200 }, () => fifty);
    const pending = solveOptimum(batch, 2, {
      pythonPath: process.execPath,
    });
    await expect(pending).rejects.toThrow(process.execPath);
    await expect(pending).rejects.toThrow(/exited \d+ with no output/);
  });
});

describe.skipIf(!existsSync(DEFAULT_PYTHON))("the real HiGHS bridge", () => {
  it("the MILP equals an exhaustive search over every crew assignment and order (k ≤ 7), and never idles", async () => {
    const rng = new Rng("exhaustive");
    const cases: { problem: RepairProblem; crews: number }[] = [];
    for (let i = 0; i < 120; i++) {
      const k = 4 + rng.int(4);
      const config = {
        ...DEFAULT_CONFIG,
        damagedSegments: { min: k, max: k },
        horizonTicks: k * 16 + 1,
      };
      cases.push({
        problem: problemOf(drawStorm(config, new Rng(`exh-${i}`))),
        crews: 2 + (i % 3),
      });
    }
    for (const crews of [2, 3, 4]) {
      const group = cases.filter((c) => c.crews === crews);
      const { results } = await solveOptimum(
        group.map((c) => c.problem),
        crews,
        { timeLimitSeconds: 60 },
      );
      for (const [i, r] of results.entries()) {
        const problem = group[i]!.problem;
        expect(r.proven).toBe(true);
        expect(r.customerTicks).toBe(exhaustiveOptimum(problem, crews));
        expect(firstIdleTick(problem, r.schedule!, crews)).toBeNull();
      }
    }
  }, 600_000);

  it("with one crew the MILP equals Horn", async () => {
    const problems = Array.from({ length: 50 }, (_, i) =>
      problemOf(
        drawStorm(
          {
            ...DEFAULT_CONFIG,
            damagedSegments: { min: 2, max: 10 },
            horizonTicks: 161,
          },
          new Rng(`one-${i}`),
        ),
      ),
    );
    const { results } = await solveOptimum(problems, 1, {
      timeLimitSeconds: 60,
    });
    for (const [i, r] of results.entries()) {
      const p = problems[i]!;
      expect(r.proven).toBe(true);
      expect(r.customerTicks).toBe(
        customerTicks(p, listSchedule(p, hornOrder(p), 1).completion),
      );
    }
  }, 300_000);

  it("the LP floor sits at or below the MILP and every rule's schedule; the MILP's never idles", async () => {
    const storms = Array.from({ length: 60 }, (_, i) =>
      drawStorm(DEFAULT_CONFIG, new Rng(`floor-${i}`)),
    );
    for (const crews of [2, 4]) {
      const problems = storms.map((s) => problemOf(s));
      const floor = await solveLpFloor(problems, crews);
      const optimum = await solveOptimum(problems, crews, {
        timeLimitSeconds: 60,
      });
      for (const [i, storm] of storms.entries()) {
        const lp = floor.results[i]!.customerTicks;
        const milp = optimum.results[i]!;
        expect(lp).toBeLessThanOrEqual(milp.customerTicks! * (1 + 1e-9));
        expect(firstIdleTick(problems[i]!, milp.schedule!, crews)).toBeNull();
        for (const rule of RESTORATION_RULES) {
          expect(lp).toBeLessThanOrEqual(
            customerTicks(
              problems[i]!,
              dispatch(storm, crews, rule, 6).completion,
            ) *
              (1 + 1e-9),
          );
        }
      }
    }
  }, 600_000);
});
