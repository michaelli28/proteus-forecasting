/**
 * Storm-restoration configuration: synthetic radial feeders, storm damage and
 * repair crews. The fixed values here are pre-registered in
 * docs/RESTORATION-LAB-PREREG.md; change them there first, or not at all.
 *
 * Defensive scope: damage comes from weather and random faults only.
 */

/** Pre-registered repair-order rules, in the order the tables list them. */
export const RESTORATION_RULES = [
  "most-customers-now",
  "critical-first",
  "nearest-first",
  "upstream-first",
  "horn-order",
  "horn-order-hindsight",
] as const;
export type RestorationRule = (typeof RESTORATION_RULES)[number];

export const FEEDER_STYLES = ["recursive", "lateral"] as const;
export type FeederStyle = (typeof FEEDER_STYLES)[number];

/** One tick is 15 minutes — EAGLE-I's reporting interval. */
export const TICK_HOURS = 0.25;

export interface RestorationConfig {
  /** Broken segments per storm, a uniform integer in [min, max]. */
  readonly damagedSegments: { readonly min: number; readonly max: number };
  readonly repair: {
    /** Median repair time in ticks (6 = 1.5 h). Also what Horn-order plans on. */
    readonly medianTicks: number;
    /** Lognormal spread of repair times. 0 makes every repair the median. */
    readonly sigma: number;
    readonly minTicks: number;
    readonly maxTicks: number;
  };
  readonly crews: number;
  readonly rule: RestorationRule;
  readonly criticalBuses: number;
  readonly zeroCustomerShare: number;
  /** Must exceed damagedSegments.max × repair.maxTicks, so every repair finishes inside the run. */
  readonly horizonTicks: number;
}

export const DEFAULT_CONFIG: RestorationConfig = {
  damagedSegments: { min: 6, max: 12 },
  repair: { medianTicks: 6, sigma: 0.6, minTicks: 1, maxTicks: 16 },
  crews: 1,
  rule: "most-customers-now",
  criticalBuses: 2,
  zeroCustomerShare: 0.25,
  horizonTicks: 12 * 16 + 1,
};

function requireInteger(value: number, name: string, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} must be an integer >= ${min}; got ${value}`);
  }
}

export function validateConfig(config: RestorationConfig): void {
  const { damagedSegments: k, repair } = config;
  requireInteger(k.min, "damagedSegments.min", 1);
  requireInteger(k.max, "damagedSegments.max", k.min);
  requireInteger(repair.minTicks, "repair.minTicks", 1);
  requireInteger(repair.maxTicks, "repair.maxTicks", repair.minTicks);
  if (!(
    repair.medianTicks >= repair.minTicks &&
    repair.medianTicks <= repair.maxTicks
  )) {
    throw new RangeError(
      `repair.medianTicks must be in [${repair.minTicks}, ${repair.maxTicks}]; got ${repair.medianTicks}`,
    );
  }
  // Horn-order plans on it: a fractional value breaks Horn's exact ties (§9.1).
  if (!Number.isInteger(repair.medianTicks)) {
    throw new RangeError(
      `repair.medianTicks must be a whole number of ticks; got ${repair.medianTicks}`,
    );
  }
  if (!(repair.sigma >= 0)) {
    throw new RangeError(`repair.sigma must be >= 0; got ${repair.sigma}`);
  }
  requireInteger(config.crews, "crews", 1);
  requireInteger(config.criticalBuses, "criticalBuses", 0);
  if (!(config.zeroCustomerShare >= 0 && config.zeroCustomerShare < 1)) {
    throw new RangeError(
      `zeroCustomerShare must be in [0, 1); got ${config.zeroCustomerShare}`,
    );
  }
  if (!RESTORATION_RULES.includes(config.rule)) {
    throw new RangeError(`unknown rule ${String(config.rule)}`);
  }
  const longest = k.max * repair.maxTicks;
  if (
    !Number.isInteger(config.horizonTicks) ||
    config.horizonTicks <= longest
  ) {
    throw new RangeError(
      `horizonTicks must exceed ${longest} (damagedSegments.max × repair.maxTicks) so every repair finishes inside the run; got ${config.horizonTicks}`,
    );
  }
}
