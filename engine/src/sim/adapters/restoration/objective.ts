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
  const k = problem.parent.length;
  if (completion.length !== k) {
    throw new RangeError(
      `expected ${k} segments' completion ticks; got ${completion.length}`,
    );
  }
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
function earliestFree(free: readonly number[]): number {
  let best = 0;
  for (let c = 1; c < free.length; c++) if (free[c]! < free[best]!) best = c;
  return best;
}

/** Whenever a crew frees up (lowest index first), `next` names the segment it takes. Crews never idle. */
export function scheduleBy(
  problem: RepairProblem,
  crews: number,
  next: (crew: number, started: readonly boolean[]) => number,
): Schedule {
  const k = problem.ticks.length;
  const started = new Array<boolean>(k).fill(false);
  const free = new Array<number>(crews).fill(0);
  const start = new Array<number>(k).fill(0);
  const completion = new Array<number>(k).fill(0);
  const crew = new Array<number>(k).fill(0);
  for (let n = 0; n < k; n++) {
    const c = earliestFree(free);
    const j = next(c, started);
    if (!Number.isInteger(j) || j < 0 || j >= k) {
      throw new RangeError(`next: ${j} is not a segment of 0..${k - 1}`);
    }
    if (started[j])
      throw new RangeError(`next: segment ${j} is already started`);
    started[j] = true;
    start[j] = free[c]!;
    free[c] = free[c]! + problem.ticks[j]!;
    completion[j] = free[c]!;
    crew[j] = c;
  }
  return { start, completion, crew };
}

/** Hand the jobs, in order, to whichever crew frees up first. Crews never idle. */
export function listSchedule(
  problem: RepairProblem,
  order: readonly number[],
  crews: number,
): Schedule {
  const k = problem.ticks.length;
  // A segment left off the list would keep completion 0 and look restored at once.
  const seen = new Array<boolean>(k).fill(false);
  for (const j of order) {
    if (!Number.isInteger(j) || j < 0 || j >= k) {
      throw new RangeError(`order: ${j} is not a segment of 0..${k - 1}`);
    }
    if (seen[j]) throw new RangeError(`order: segment ${j} appears twice`);
    seen[j] = true;
  }
  const missing = seen.indexOf(false);
  if (missing !== -1) {
    throw new RangeError(`order: segment ${missing} is missing`);
  }
  let n = 0;
  return scheduleBy(problem, crews, () => order[n++]!);
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
