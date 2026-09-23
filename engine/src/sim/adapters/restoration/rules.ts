/**
 * The pre-registered repair-order rules (docs/RESTORATION-LAB-PREREG.md §3).
 *
 * Whenever a crew is free — lowest index first — it takes one unstarted
 * segment. Rules look at repairs already under way as if finished; the
 * schedule is then played out with the true repair times.
 */

import type { RestorationRule } from "./config.js";
import { hornOrder } from "./horn.js";
import { ancestors, listSchedule, scheduleBy } from "./objective.js";
import type { Schedule } from "./objective.js";
import { downstreamCustomers, problemOf } from "./storm.js";
import type { Storm } from "./storm.js";

/** Hops between two feeder buses. */
export function feederDistance(
  feederParent: readonly number[],
  a: number,
  b: number,
): number {
  const up = new Map<number, number>();
  for (let v = a, d = 0; v !== -1; v = feederParent[v]!, d++) up.set(v, d);
  let d = 0;
  let v = b;
  while (!up.has(v)) {
    v = feederParent[v]!;
    d++;
  }
  return d + up.get(v)!;
}

/** Lexicographic: the first differing entry decides. */
function lessThan(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
}

function minBy(
  candidates: readonly number[],
  key: (j: number) => readonly number[],
): number {
  let best = candidates[0]!;
  let bestKey = key(best);
  for (const j of candidates.slice(1)) {
    const k = key(j);
    if (lessThan(k, bestKey)) {
      best = j;
      bestKey = k;
    }
  }
  return best;
}

export function dispatch(
  storm: Storm,
  crews: number,
  rule: RestorationRule,
  plannedTicks: number,
): Schedule {
  if (!Number.isInteger(crews) || crews < 1) {
    throw new RangeError(`crews must be an integer >= 1; got ${crews}`);
  }
  // A fractional time would turn Horn's exact ties into float near-ties (§9.1).
  if (!(Number.isInteger(plannedTicks) && plannedTicks >= 1)) {
    throw new RangeError(
      `plannedTicks must be a whole number of ticks >= 1; got ${plannedTicks}`,
    );
  }
  const problem = problemOf(storm);
  const segments = storm.segments;
  const downstream = downstreamCustomers(problem);

  // Fixed lists: each free crew takes the next unstarted segment on the list.
  if (rule === "horn-order") {
    // Any uniform planned time gives the same list: every ratio scales alike (pre-registration §9.2).
    const planned = problemOf(
      storm,
      segments.map(() => plannedTicks),
    );
    return listSchedule(problem, hornOrder(planned), crews);
  }
  if (rule === "horn-order-hindsight") {
    return listSchedule(problem, hornOrder(problem), crews);
  }
  if (rule === "upstream-first") {
    const order = segments
      .map((_, j) => j)
      .sort(
        (a, b) =>
          segments[a]!.depth - segments[b]!.depth ||
          downstream[b]! - downstream[a]! ||
          a - b,
      );
    return listSchedule(problem, order, crews);
  }

  const chains = ancestors(problem);
  const children = segments.map((_, j) =>
    segments.flatMap((s, i) => (s.parent === j ? [i] : [])),
  );
  const at = new Array<number>(crews).fill(0);

  // Customers back the moment j finishes, counting started repairs as done.
  // These rules never start a segment before its broken ancestors, so the
  // descendant walk finds nothing today; it keeps §3's definition literal.
  const gainNow = (j: number, started: readonly boolean[]): number => {
    if (chains[j]!.slice(1).some((a) => !started[a])) return 0;
    let gain = segments[j]!.customers;
    const stack = [...children[j]!];
    while (stack.length > 0) {
      const d = stack.pop()!;
      if (started[d]) {
        gain += segments[d]!.customers;
        stack.push(...children[d]!);
      }
    }
    return gain;
  };
  const mostCustomersKey = (started: readonly boolean[]) => (j: number) => [
    -gainNow(j, started),
    -downstream[j]!,
    segments[j]!.depth,
    j,
  ];

  return scheduleBy(problem, crews, (c, started) => {
    const todo = segments.flatMap((_, j) => (started[j] ? [] : [j]));
    let j: number;
    if (rule === "most-customers-now") {
      j = minBy(todo, mostCustomersKey(started));
    } else if (rule === "nearest-first") {
      j = minBy(todo, (i) => [
        feederDistance(storm.feederParent, at[c]!, segments[i]!.bus),
        segments[i]!.depth,
        i,
      ]);
    } else if (rule === "critical-first") {
      const critical = todo.filter((i) => segments[i]!.onCriticalPath);
      j =
        critical.length > 0
          ? minBy(critical, (i) => [segments[i]!.depth, -downstream[i]!, i])
          : minBy(todo, mostCustomersKey(started));
    } else {
      const unhandled: never = rule;
      throw new RangeError(`no dispatch for rule ${String(unhandled)}`);
    }
    at[c] = segments[j]!.bus;
    return j;
  });
}
