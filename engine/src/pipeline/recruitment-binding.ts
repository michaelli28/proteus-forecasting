/**
 * The targeted-recruitment domain binding.
 *
 * The whole domain enters the orchestrator through this file. `readQuantity`
 * reads the ground-truth stream and `signatures` reads the telemetry stream,
 * and neither can reach the other's data — the same structural separation the
 * influence-ops binding enforces, for the same reason.
 *
 * The two adversary knobs are reinterpreted for this domain rather than
 * reinvented, so a framing produced for one domain still means something here:
 *
 *   riskTolerance        → how much exposure the actor accepts: how many
 *                          accounts it fields, how hard it targets, how large
 *                          the payments get.
 *   escalationPropensity → how hard and how early it pushes: campaign start,
 *                          escalation rate, and whether accounts move together.
 */

import {
  DEFAULT_CONFIG,
  recruitmentAdapter,
  deriveSignatures,
} from "../sim/adapters/recruitment/index.js";
import type {
  ObservableTick,
  RecruitmentConfig,
  RecruitmentState,
} from "../sim/adapters/recruitment/index.js";
import type { TargetQuantity } from "../evidence/partition.js";
import type { DomainBinding } from "./types.js";

/** Quantities this domain can be asked to forecast. */
export const RECRUITMENT_MEASURES = [
  "taskedCleared",
  "clearedConversionRate",
  "compromisedAccess",
  "reportRate",
] as const;
export type RecruitmentMeasure = (typeof RECRUITMENT_MEASURES)[number];

const MEASURE_DESCRIPTIONS: Readonly<Record<RecruitmentMeasure, string>> = {
  taskedCleared:
    "clearance-holders who reached paid tasking, as a share of the workforce",
  clearedConversionRate:
    "share of contacted clearance-holders who reached paid tasking",
  compromisedAccess:
    "access value lost to tasking, as a share of the workforce's total",
  reportRate: "share of contacted people who reported the approach",
};

/**
 * Every measure is a FRACTION of the workforce, not a count.
 *
 * Counts would need bounds that depend on the configured population, so the
 * same question asked against a 2,000-person and a 20,000-person workforce
 * would silently mean different things and could not be pooled or compared.
 * The demo converts back to people for display, where the denominator is on
 * screen next to it.
 */
export const RECRUITMENT_MEASURE_BOUNDS: Readonly<
  Record<RecruitmentMeasure, readonly [number, number]>
> = {
  taskedCleared: [0, 1],
  clearedConversionRate: [0, 1],
  compromisedAccess: [0, 1],
  reportRate: [0, 1],
};

export function isRecruitmentMeasure(name: string): name is RecruitmentMeasure {
  return (RECRUITMENT_MEASURES as readonly string[]).includes(name);
}

export function recruitmentQuantity(
  measure: RecruitmentMeasure,
  resolveAtTick: number,
  range?: readonly [number, number],
): TargetQuantity {
  if (!Number.isInteger(resolveAtTick) || resolveAtTick < 0) {
    throw new RangeError(
      `resolveAtTick must be a non-negative integer: ${resolveAtTick}`,
    );
  }

  const [definitionalMin, definitionalMax] = RECRUITMENT_MEASURE_BOUNDS[measure];
  const [min, max] = range ?? [definitionalMin, definitionalMax];
  if (min >= max) {
    throw new RangeError(`empty range for ${measure}: [${min}, ${max}]`);
  }
  if (min < definitionalMin || max > definitionalMax) {
    throw new RangeError(
      `range [${min}, ${max}] for ${measure} falls outside its definitional bounds [${definitionalMin}, ${definitionalMax}]`,
    );
  }

  return {
    name: measure,
    description: MEASURE_DESCRIPTIONS[measure],
    min,
    max,
    resolveAtTick,
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, t));
}

/** Documented bounds of the run-spec mapping, exported so tests assert on them. */
export const RECRUITMENT_MAPPING_BOUNDS = {
  // Capped so a mid-range ensemble member contacts a minority of the workforce.
  // At 20 accounts × 4 approaches a member reaches every person alive before the
  // campaign window closes, and selectivity stops meaning anything.
  accounts: [1, 10],
  selectivity: [0.2, 0.95],
  paymentK: [0.5, 12],
  escalationRate: [0.02, 0.12],
  /** Higher escalation propensity starts sooner. */
  startTick: [60, 10],
  accountAgeDays: [400, 20],
  coordinationThreshold: 50,
} as const;

export interface RecruitmentRunParameters {
  readonly riskTolerance: number;
  readonly escalationPropensity: number;
}

export function recruitmentCampaignFromRunSpec(
  parameters: RecruitmentRunParameters,
  ticks: number,
): NonNullable<RecruitmentConfig["campaign"]> {
  const risk = parameters.riskTolerance / 100;
  const escalation = parameters.escalationPropensity / 100;

  const [accountMin, accountMax] = RECRUITMENT_MAPPING_BOUNDS.accounts;
  const [selMin, selMax] = RECRUITMENT_MAPPING_BOUNDS.selectivity;
  const [payMin, payMax] = RECRUITMENT_MAPPING_BOUNDS.paymentK;
  const [escMin, escMax] = RECRUITMENT_MAPPING_BOUNDS.escalationRate;
  const [startLate, startEarly] = RECRUITMENT_MAPPING_BOUNDS.startTick;
  const [ageOld, ageNew] = RECRUITMENT_MAPPING_BOUNDS.accountAgeDays;

  const endTick = Math.max(1, ticks - 10);

  return {
    startTick: Math.min(
      Math.round(lerp(startLate, startEarly, escalation)),
      Math.max(0, endTick - 1),
    ),
    endTick,
    accounts: Math.round(lerp(accountMin, accountMax, risk)),
    contactsPerAccountPerTick: 1,
    selectivity: lerp(selMin, selMax, risk),
    escalationRate: lerp(escMin, escMax, escalation),
    paymentK: lerp(payMin, payMax, risk),
    // A more escalation-prone actor stands up accounts closer to the operation,
    // so it moves faster and leaves a younger-account signature doing it.
    accountAgeDays: Math.round(lerp(ageOld, ageNew, escalation)),
    coordinated:
      parameters.escalationPropensity >= RECRUITMENT_MAPPING_BOUNDS.coordinationThreshold,
  };
}

export function recruitmentConfigFromRunSpec(
  parameters: RecruitmentRunParameters,
  base: RecruitmentConfig = DEFAULT_CONFIG,
): RecruitmentConfig {
  return {
    ...base,
    campaign: recruitmentCampaignFromRunSpec(parameters, base.ticks),
    defense: base.defense,
  };
}

export function createRecruitmentBinding(
  base: RecruitmentConfig = DEFAULT_CONFIG,
): DomainBinding<RecruitmentConfig, RecruitmentState> {
  return {
    adapter: recruitmentAdapter,

    configFor(spec, quantity) {
      const ticks = Math.max(base.ticks, quantity.resolveAtTick + 1);
      return recruitmentConfigFromRunSpec(spec, { ...base, ticks });
    },

    readQuantity(result, quantity) {
      if (!isRecruitmentMeasure(quantity.name)) {
        throw new Error(
          `recruitment cannot resolve quantity "${quantity.name}"`,
        );
      }
      const event = result.events.find(
        (e) => e.kind === "truth" && e.tick === quantity.resolveAtTick,
      );
      if (!event) {
        throw new Error(
          `no ground-truth reading at tick ${quantity.resolveAtTick}`,
        );
      }

      const people = base.workforce.people;
      const value = readMeasure(quantity.name, event.data, people);

      const [min, max] = RECRUITMENT_MEASURE_BOUNDS[quantity.name];
      if (!Number.isFinite(value) || value < min || value > max) {
        throw new RangeError(
          `${quantity.name} read ${value}, outside its definitional range [${min}, ${max}] — the measure is wrong, not the world`,
        );
      }
      return value;
    },

    signatures(result) {
      // Reconstructed from telemetry events alone. Reading finalState here
      // would hand the detector the funnel census and turn detection precision
      // into a tautology.
      const ticks: ObservableTick[] = result.events
        .filter((event) => event.kind === "telemetry")
        .map((event) => ({
          tick: event.tick,
          connectionRequests: event.data.connectionRequests as number,
          accepted: event.data.accepted as number,
          reportsFiled: event.data.reportsFiled as number,
          activeAccounts: event.data.activeAccounts as number,
          employerConcentration: event.data.employerConcentration as number,
          youngAccountShare: event.data.youngAccountShare as number,
        }));

      const signatures = deriveSignatures(ticks);
      return {
        requestBurstiness: signatures.requestBurstiness,
        employerConcentration: signatures.employerConcentration,
        acceptanceRate: signatures.acceptanceRate,
        reportRate: signatures.reportRate,
        accountYouth: signatures.accountYouth,
        compositeScore: signatures.compositeScore,
      };
    },
  };
}

function readMeasure(
  measure: RecruitmentMeasure,
  data: Readonly<Record<string, unknown>>,
  people: number,
): number {
  switch (measure) {
    case "taskedCleared":
      return (data.taskedCleared as number) / people;
    case "compromisedAccess":
      return (data.compromisedAccess as number) / people;
    case "clearedConversionRate":
      return data.clearedConversionRate as number;
    case "reportRate":
      return data.reportRate as number;
  }
}

/** The production world. */
export const recruitmentBinding = createRecruitmentBinding();
