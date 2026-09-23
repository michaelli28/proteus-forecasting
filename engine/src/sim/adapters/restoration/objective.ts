/**
 * The restoration objective and the schedules it scores.
 *
 * Soft precedence: a crew may repair a segment while one upstream of it is
 * still broken, but the customers behind it come back only when every broken
 * segment on their path to the substation is fixed.
 */

export interface RepairProblem {
  /** Nearest broken segment upstream, or -1. Always lower than the segment's own index. */
  readonly parent: readonly number[];
  /** Customers whose nearest broken segment on the way to the substation is this one. */
  readonly customers: readonly number[];
  /** Repair time in 15-minute ticks, each at least 1. */
  readonly ticks: readonly number[];
}

export interface Schedule {
  readonly start: readonly number[];
  readonly completion: readonly number[];
  readonly crew: readonly number[];
}

/** Each segment's broken ancestors, itself first. */
export function ancestors(problem: RepairProblem): number[][] {
  return problem.parent.map((_, j) => {
    const chain: number[] = [];
    for (let a = j; a !== -1; a = problem.parent[a]!) chain.push(a);
    return chain;
  });
}

/** The tick each segment's customers come back: the last repair on their path. */
export function restorationTicks(
  problem: RepairProblem,
  completion: readonly number[],
): number[] {
  return ancestors(problem).map((chain) =>
    Math.max(...chain.map((a) => completion[a]!)),
  );
}

/** Σ customers × restoration tick. Multiply by TICK_HOURS for customer-hours. */
export function customerTicks(
  problem: RepairProblem,
  completion: readonly number[],
): number {
  return restorationTicks(problem, completion).reduce(
    (sum, tick, j) => sum + problem.customers[j]! * tick,
    0,
  );
}

/** The crew that frees up first, lowest index on a tie. */
export function earliestFree(free: readonly number[]): number {
  let best = 0;
  for (let c = 1; c < free.length; c++) if (free[c]! < free[best]!) best = c;
  return best;
}

/** Hand the jobs, in order, to whichever crew frees up first. Crews never idle. */
export function listSchedule(
  problem: RepairProblem,
  order: readonly number[],
  crews: number,
): Schedule {
  const k = problem.ticks.length;
  const free = new Array<number>(crews).fill(0);
  const start = new Array<number>(k).fill(0);
  const completion = new Array<number>(k).fill(0);
  const crew = new Array<number>(k).fill(0);
  for (const j of order) {
    const c = earliestFree(free);
    start[j] = free[c]!;
    free[c] = free[c]! + problem.ticks[j]!;
    completion[j] = free[c]!;
    crew[j] = c;
  }
  return { start, completion, crew };
}

/**
 * Crew assignment for a set of start ticks, or a RangeError saying why they are
 * not a schedule. Greedy by start time is enough: if no tick has more than
 * `crews` repairs under way, a free crew always exists.
 */
export function scheduleFromStarts(
  problem: RepairProblem,
  start: readonly number[],
  crews: number,
): Schedule {
  const k = problem.ticks.length;
  if (start.length !== k) {
    throw new RangeError(`expected ${k} segments' starts; got ${start.length}`);
  }
  for (const [j, s] of start.entries()) {
    if (!Number.isInteger(s) || s < 0) {
      throw new RangeError(
        `segment ${j} starts at ${s}, not a whole tick >= 0`,
      );
    }
  }
  const completion = start.map((s, j) => s + problem.ticks[j]!);
  const crew = new Array<number>(k).fill(0);
  const free = new Array<number>(crews).fill(0);
  const byStart = start
    .map((s, j) => ({ s, j }))
    .sort((a, b) => a.s - b.s || a.j - b.j);
  for (const { s, j } of byStart) {
    const c = free.findIndex((f) => f <= s);
    if (c === -1) {
      throw new RangeError(
        `more than ${crews} repairs under way at tick ${s} (segment ${j})`,
      );
    }
    crew[j] = c;
    free[c] = completion[j]!;
  }
  return { start: [...start], completion, crew };
}
