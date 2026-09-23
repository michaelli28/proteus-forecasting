/**
 * The repair-order lab's reference per storm and its paired table
 * (docs/RESTORATION-LAB-PREREG.md §4, §6). Pure: the lab script does the runs.
 *
 * Every reference is hindsight: it knows the true repair times. Against an LP
 * floor a gap is an upper bound on the gap to the best possible ("at most").
 */

import { stratifiedBootstrap } from "../metrics/bootstrap.js";
import type { Interval } from "../metrics/bootstrap.js";
import { winTieLoss } from "../metrics/paired.js";
import type { WinTieLoss } from "../metrics/paired.js";
import {
  RESTORATION_RULES,
  TICK_HOURS,
} from "../sim/adapters/restoration/config.js";
import type { RestorationRule } from "../sim/adapters/restoration/config.js";

/** Float noise allowed between the LP floor and a whole-number schedule cost. */
const FLOOR_NOISE = 1e-6;

export type Reference =
  | {
      readonly kind: "exact";
      readonly source: "horn" | "milp";
      readonly customerTicks: number;
    }
  | {
      /** A rule's schedule came in under HiGHS's proven incumbent, inside its 1e-4 gap. */
      readonly kind: "exact";
      readonly source: "rule";
      readonly rule: RestorationRule;
      readonly customerTicks: number;
    }
  | {
      readonly kind: "floor";
      readonly source: "lp";
      readonly customerTicks: number;
    };

export interface StormOutcome {
  readonly customerTicks: Readonly<Record<RestorationRule, number>>;
  readonly reference: Reference;
}

export interface ReferenceInput {
  readonly crews: number;
  readonly ruleCosts: Readonly<Record<RestorationRule, number>>;
  /** 1 crew: Horn's order on the true repair times. */
  readonly horn?: number;
  readonly milp?: {
    readonly proven: boolean;
    readonly customerTicks: number | null;
  };
  readonly lpFloor?: number;
}

function requireCost(value: number, name: string): void {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`${name} must be a finite number >= 0; got ${value}`);
  }
}

export function resolveReference(input: ReferenceInput): Reference {
  const { crews, ruleCosts, horn, milp, lpFloor } = input;
  if (!Number.isInteger(crews) || crews < 1) {
    throw new RangeError(`crews must be an integer >= 1; got ${crews}`);
  }
  for (const rule of RESTORATION_RULES) requireCost(ruleCosts[rule], rule);

  if (crews === 1) {
    if (horn === undefined) {
      throw new Error(
        "1 crew: the reference is Horn's cost, and none was given",
      );
    }
    requireCost(horn, "Horn");
    // Horn is exact for one crew: anything cheaper means a bug upstream.
    for (const rule of RESTORATION_RULES) {
      if (ruleCosts[rule] < horn) {
        throw new Error(
          `${rule} costs ${ruleCosts[rule]}, below Horn's ${horn}: a bug, not a result`,
        );
      }
    }
    return { kind: "exact", source: "horn", customerTicks: horn };
  }

  const schedules: [string, number][] = RESTORATION_RULES.map((rule) => [
    rule,
    ruleCosts[rule],
  ]);
  if (milp?.customerTicks != null) {
    requireCost(milp.customerTicks, "MILP");
    schedules.push(["MILP", milp.customerTicks]);
  }
  if (lpFloor !== undefined) {
    requireCost(lpFloor, "LP floor");
    const tolerance = FLOOR_NOISE * Math.max(1, lpFloor);
    for (const [name, cost] of schedules) {
      if (cost < lpFloor - tolerance) {
        throw new Error(
          `${name} costs ${cost}, below the LP floor ${lpFloor}: a bug, not a result`,
        );
      }
    }
  }

  if (milp?.proven) {
    if (milp.customerTicks === null) {
      throw new Error("the MILP is marked proven but has no cost");
    }
    // §4: the cheapest of the MILP's schedule and every rule's; ties keep the MILP's.
    let best: Reference = {
      kind: "exact",
      source: "milp",
      customerTicks: milp.customerTicks,
    };
    for (const rule of RESTORATION_RULES) {
      if (ruleCosts[rule] < best.customerTicks) {
        best = {
          kind: "exact",
          source: "rule",
          rule,
          customerTicks: ruleCosts[rule],
        };
      }
    }
    return best;
  }

  if (lpFloor === undefined) {
    throw new Error(
      `${crews} crews: the MILP is not proven and there is no LP floor to fall back to`,
    );
  }
  // A floor a hair above a schedule is float noise; bring it down so no gap is negative.
  return {
    kind: "floor",
    source: "lp",
    customerTicks: Math.min(lpFloor, ...schedules.map(([, cost]) => cost)),
  };
}

export interface RuleRow {
  readonly rule: RestorationRule;
  readonly meanCustomerHours: number;
  /** 100 × (Σ rule − Σ reference) ÷ Σ reference, with a storm bootstrap; null when Σ reference is 0. */
  readonly extraPercent: Interval | null;
  /** Storms tied with an exact reference; null when no storm had an exact one. */
  readonly tiesWithReference: number | null;
  readonly vsMostCustomersNow: WinTieLoss;
  /** Descriptive only: median per-storm gap, 0 ÷ 0 counted as 0. */
  readonly medianStormGapPercent: number;
}

export interface LabTable {
  readonly storms: number;
  readonly exactReferences: number;
  readonly floorReferences: number;
  readonly referenceMeanCustomerHours: number;
  readonly rows: readonly RuleRow[];
  /** pairwise[a][b]: rule a against rule b, storm by storm, lower being better. */
  readonly pairwise: Readonly<
    Record<RestorationRule, Readonly<Record<RestorationRule, WinTieLoss>>>
  >;
}

function byRule<T>(
  value: (rule: RestorationRule) => T,
): Record<RestorationRule, T> {
  return Object.fromEntries(
    RESTORATION_RULES.map((rule) => [rule, value(rule)]),
  ) as Record<RestorationRule, T>;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stormGapPercent(
  rule: RestorationRule,
  cost: number,
  reference: number,
): number {
  if (cost < reference) {
    throw new Error(
      `${rule} costs ${cost}, below its reference ${reference}: a bug, not a result`,
    );
  }
  if (reference === 0) {
    if (cost === 0) return 0;
    throw new Error(
      `${rule} costs ${cost} on a storm whose reference 0 says no customer was out`,
    );
  }
  return (100 * (cost - reference)) / reference;
}

/** Extra customer-hours over the reference, pooled over storms (§6); null when Σ reference is 0. */
function extraPercent(
  sample: readonly StormOutcome[],
  rule: RestorationRule,
): number | null {
  const reference = sum(sample.map((o) => o.reference.customerTicks));
  const cost = sum(sample.map((o) => o.customerTicks[rule]));
  return reference === 0 ? null : (100 * (cost - reference)) / reference;
}

export function labTable(
  outcomes: readonly StormOutcome[],
  seed: string,
): LabTable {
  if (outcomes.length === 0) throw new RangeError("labTable: no storms");
  const costs = byRule((rule) => outcomes.map((o) => o.customerTicks[rule]));
  const references = outcomes.map((o) => o.reference.customerTicks);
  const exactReferences = outcomes.filter(
    (o) => o.reference.kind === "exact",
  ).length;
  const meanHours = (ticks: readonly number[]) =>
    (sum(ticks) / ticks.length) * TICK_HOURS;

  const rows = RESTORATION_RULES.map((rule): RuleRow => ({
    rule,
    meanCustomerHours: meanHours(costs[rule]),
    extraPercent: stratifiedBootstrap(outcomes, {
      stratumOf: () => "storms",
      statistic: (sample) => extraPercent(sample, rule),
      seed: `${seed}/${rule}`,
    }),
    // Both are whole numbers against an exact reference; never counted against a floor.
    tiesWithReference:
      exactReferences === 0
        ? null
        : outcomes.filter(
            (o) =>
              o.reference.kind === "exact" &&
              o.customerTicks[rule] === o.reference.customerTicks,
          ).length,
    vsMostCustomersNow: winTieLoss(costs[rule], costs["most-customers-now"]),
    medianStormGapPercent: median(
      costs[rule].map((cost, i) => stormGapPercent(rule, cost, references[i]!)),
    ),
  }));

  return {
    storms: outcomes.length,
    exactReferences,
    floorReferences: outcomes.length - exactReferences,
    referenceMeanCustomerHours: meanHours(references),
    rows,
    pairwise: byRule((a) => byRule((b) => winTieLoss(costs[a], costs[b]))),
  };
}
