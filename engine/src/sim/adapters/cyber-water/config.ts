/**
 * Closed-world cyber-water configuration.
 *
 * SCOPE BOUNDARY, enforced structurally: the adversary in this model chooses a
 * COMPONENT, an INSTRUMENT BAND, and a DURATION. There is no field anywhere in
 * this configuration for a technique, a protocol, a credential, a payload, a
 * command sequence, a vendor, a firmware version, or a network address — so no
 * code path can emit an attack procedure, because there is none in it to emit.
 * Components are opaque register ids over synthetic archetypes generated in
 * python/consequence/archetypes.py; none of them corresponds to a real utility.
 *
 * What the model DOES carry is the thing a defender can act on: which component,
 * held how long, spent when, at what cost to stop.
 */

import type { ConsequenceTable } from "./consequence.js";

/** Disclosed instrument progression, ascending in severity. */
export const INSTRUMENT_BANDS = [
  "none",
  "exposure",
  "lockout",
  "logic_modification",
  "setpoint_with_alarm_suppression",
] as const;
export type InstrumentBand = (typeof INSTRUMENT_BANDS)[number];

/** Ordinal severity, for the ordered-categorical outcome measure. */
export function instrumentSeverity(band: InstrumentBand): number {
  return INSTRUMENT_BANDS.indexOf(band);
}

export const COMPONENT_KINDS = [
  "pump",
  "booster",
  "valve",
  "tank_level",
] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const PERTURBATION_KINDS = [
  "none",
  "pump_stop",
  "valve_close",
  "level_spoof_high",
] as const;
export type PerturbationKind = (typeof PERTURBATION_KINDS)[number];

export const DEFENSE_KINDS = [
  "none",
  "network_segmentation",
  "credential_rotation",
  "anomaly_detection",
  "manual_fallback",
] as const;
export type DefenseKind = (typeof DEFENSE_KINDS)[number];

/** One controllable element, mirrored from the solver's register. */
export interface ComponentRef {
  readonly id: string;
  readonly kind: ComponentKind;
  readonly zone: string;
  /** The hydraulic action this component admits. One per kind. */
  readonly perturbation: PerturbationKind;
}

/**
 * The adversary's posture.
 *
 * These are the parameters an analyst argues about — how much access is already
 * held, how fast more is acquired, how much attribution risk is tolerated — and
 * the access-inventory prior is the one only classified reporting has. It is
 * named here so the confidence cap downstream can point at it.
 */
export interface AdversaryConfig {
  /** Expected components already held at t=0. The classified number. */
  readonly initialAccessMean: number;
  readonly initialAccessSd: number;
  /** Per-tick hazard of acquiring access to one further component. */
  readonly acquisitionHazard: number;
  /**
   * Attribution-risk sensitivity in [0,1]. High values hold access longer and
   * prefer lower instrument bands.
   */
  readonly riskSensitivity: number;
  /** Per-tick decay of an unexercised access's value. */
  readonly accessValueDecay: number;
  /** Political payoff at t=0 and its per-tick drift — the exogenous index. */
  readonly payoffBase: number;
  readonly payoffDrift: number;
  /** Ticks before the adversary will consider spending anything. */
  readonly earliestActivationTick: number;
  /**
   * Quantal-response inverse temperature over target choice.
   *
   * High → close to argmax (always the best move). Low → close to uniform
   * (explores weak moves too). A boundedly-rational adversary sits between, and
   * this is a property of the adversary rather than a tuning knob — the ranking
   * layer depends on the spread it produces, so it must not be quietly raised
   * to sharpen the output.
   */
  readonly rationality: number;
  /** Hours of effect per instrument band, before defensive shortening. */
  readonly durationHoursByBand: Readonly<Record<InstrumentBand, number>>;
}

/** The defensive arm. Each carries a cost so interventions can be compared. */
export interface DefenseConfig {
  readonly kind: DefenseKind;
  readonly startTick: number;
  /** Strength in [0,1]. */
  readonly intensity: number;
  /** Cost per tick while active, in abstract budget units. */
  readonly costPerTick: number;
  /** Share of the component register covered, in [0,1]. */
  readonly coverage: number;
}

export interface CyberWaterConfig {
  readonly ticks: number;
  readonly archetypeId: string;
  readonly register: readonly ComponentRef[];
  readonly servedPopulation: number;
  /**
   * The solved consequence map, carried as data.
   *
   * It rides in the config rather than being fetched during the run because
   * `step` is synchronous and seeded: a solver call inside a tick would break
   * both properties, and a table built once per ensemble is also the only
   * affordable way to run EPANET thousands of times.
   */
  readonly consequence: ConsequenceTable;
  readonly adversary: AdversaryConfig;
  readonly defense: DefenseConfig | null;
  /** Baseline per-tick rate of benign OT anomalies — the detector's noise floor. */
  readonly backgroundAnomalyRate: number;
}

/**
 * Hours of effect per band.
 *
 * Alarm suppression is the whole reason the top band is worse than the one
 * below it: the hydraulic action is the same, but nobody is told, so the
 * duration is set by when someone notices the water rather than by when the
 * alarm fires. AA26-097A documents exactly that instrument — shutdown and alarm
 * logic disabled "without notifying operators of the anomalies".
 */
export const DEFAULT_DURATION_HOURS: Readonly<Record<InstrumentBand, number>> =
  {
    none: 0,
    exposure: 0,
    lockout: 6,
    logic_modification: 12,
    setpoint_with_alarm_suppression: 48,
  };

export const DEFAULT_ADVERSARY: AdversaryConfig = {
  initialAccessMean: 2.0,
  initialAccessSd: 1.0,
  acquisitionHazard: 0.012,
  riskSensitivity: 0.55,
  accessValueDecay: 0.004,
  payoffBase: 0.25,
  payoffDrift: 0.0035,
  earliestActivationTick: 10,
  rationality: 6,
  durationHoursByBand: DEFAULT_DURATION_HOURS,
};

/** 180 daily ticks — roughly the two 90-day windows the chain is framed over. */
export const DEFAULT_CONFIG: Omit<
  CyberWaterConfig,
  "register" | "servedPopulation" | "consequence"
> = {
  ticks: 180,
  archetypeId: "municipal_pumped",
  adversary: DEFAULT_ADVERSARY,
  defense: null,
  backgroundAnomalyRate: 1.4,
};

/**
 * Reference defense used by tests and the paired-arm benchmark.
 *
 * Deliberately partial: full coverage makes every comparison trivial, and no
 * utility has it. The interesting question is what 60% buys.
 */
export const REFERENCE_DEFENSE: DefenseConfig = {
  kind: "anomaly_detection",
  startTick: 0,
  intensity: 0.6,
  costPerTick: 12,
  coverage: 0.6,
};

export function isDefenseActive(
  config: CyberWaterConfig,
  tick: number,
): boolean {
  const d = config.defense;
  return d !== null && d.kind !== "none" && tick >= d.startTick;
}

/** Rejects configurations that would silently produce a degenerate world. */
export function validateConfig(config: CyberWaterConfig): void {
  const { adversary, defense, register } = config;

  if (config.ticks <= 0) throw new RangeError("ticks must be > 0");
  if (register.length === 0) {
    throw new RangeError(
      "register is empty — an adversary with nothing to compromise makes every run identical",
    );
  }

  const ids = new Set(register.map((c) => c.id));
  if (ids.size !== register.length) {
    throw new RangeError("component ids must be unique");
  }

  if (adversary.initialAccessMean < 0) {
    throw new RangeError("initialAccessMean must be >= 0");
  }
  if (adversary.initialAccessSd < 0) {
    throw new RangeError("initialAccessSd must be >= 0");
  }
  if (adversary.acquisitionHazard < 0 || adversary.acquisitionHazard > 1) {
    throw new RangeError("acquisitionHazard must be in [0,1]");
  }
  if (adversary.riskSensitivity < 0 || adversary.riskSensitivity > 1) {
    throw new RangeError("riskSensitivity must be in [0,1]");
  }
  if (adversary.earliestActivationTick < 0) {
    throw new RangeError("earliestActivationTick must be >= 0");
  }
  if (!Number.isFinite(adversary.rationality) || adversary.rationality < 0) {
    throw new RangeError("rationality must be finite and >= 0");
  }
  if (config.backgroundAnomalyRate < 0) {
    throw new RangeError("backgroundAnomalyRate must be >= 0");
  }

  for (const band of INSTRUMENT_BANDS) {
    const hours = adversary.durationHoursByBand[band];
    if (!Number.isFinite(hours) || hours < 0) {
      throw new RangeError(
        `durationHoursByBand.${band} must be finite and >= 0`,
      );
    }
  }

  if (defense) {
    if (defense.intensity < 0 || defense.intensity > 1) {
      throw new RangeError("defense.intensity must be in [0,1]");
    }
    if (defense.coverage < 0 || defense.coverage > 1) {
      throw new RangeError("defense.coverage must be in [0,1]");
    }
    if (defense.costPerTick < 0) {
      throw new RangeError("defense.costPerTick must be >= 0");
    }
    if (defense.startTick < 0) {
      throw new RangeError("defense.startTick must be >= 0");
    }
  }
}
