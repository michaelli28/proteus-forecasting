/**
 * The cyber-water domain binding.
 *
 * The whole domain enters the orchestrator through this file, and it is where
 * the detector/oracle separation becomes structural: `readQuantity` reads the
 * ground-truth event stream, `signatures` reads the telemetry event stream, and
 * neither can reach the other's data. Everything downstream of `signatures` is
 * therefore computable by a utility that never saw the adversary's inventory.
 *
 * CONFIDENCE CEILING. The activation measures below depend on an access-
 * inventory prior that only classified reporting can set (`initialAccessMean`
 * in the adapter's config). An unclassified instantiation cannot observe held-
 * but-never-spent access at all, because it produces no artefact. Products
 * built on `daysToFirstActivation` are therefore capped, and the cap is named
 * here rather than left to an adjudicator's judgement.
 */

import {
  cyberWaterAdapter,
  configFromRunSpec,
  deriveSignatures,
} from "../sim/adapters/cyber-water/index.js";
import type {
  ConsequenceTable,
  CyberWaterConfig,
  CyberWaterState,
  DefenseConfig,
  ObservableTick,
} from "../sim/adapters/cyber-water/index.js";
import type { ConfidenceLevel } from "../evidence/icd203.js";
import type { TargetQuantity } from "../evidence/partition.js";
import type { DomainBinding } from "./types.js";

/** Measures this domain can be asked to forecast. */
export const CYBER_WATER_MEASURES = [
  "activationCount",
  "peakInstrumentSeverity",
  "personHoursBelow",
  "peakPeopleAffected",
  "daysToFirstActivation",
] as const;
export type CyberWaterMeasure = (typeof CYBER_WATER_MEASURES)[number];

/**
 * Definitional ranges, not observed ones.
 *
 * `personHoursBelow` and `peakPeopleAffected` are bounded by the archetype's
 * served population, so their upper bounds are supplied per-binding rather than
 * fixed here; the others are structural. A reading outside these is a bug in
 * the measure, which is why readQuantity throws rather than clamps.
 */
export const STRUCTURAL_BOUNDS: Readonly<
  Record<
    "activationCount" | "peakInstrumentSeverity",
    readonly [number, number]
  >
> = {
  activationCount: [0, 32],
  peakInstrumentSeverity: [0, 4],
};

const MEASURE_DESCRIPTIONS: Readonly<Record<CyberWaterMeasure, string>> = {
  activationCount:
    "distinct activations against control components in the window",
  peakInstrumentSeverity:
    "highest disclosed instrument band reached (0 none — 4 setpoint with alarm suppression)",
  personHoursBelow:
    "attributable person-hours of service below the pressure threshold, summed",
  peakPeopleAffected: "largest number of people simultaneously below threshold",
  daysToFirstActivation: "days from window open to first disruptive effect",
};

/**
 * Measures whose truth an unclassified corpus cannot observe.
 *
 * Timing questions are capped because "access held, never spent" leaves no
 * artefact: the oracle sees only activations that were DISCLOSED, and no amount
 * of adjudication fixes a censored sample.
 */
export const CONFIDENCE_CAPPED_MEASURES: Readonly<
  Partial<Record<CyberWaterMeasure, ConfidenceLevel>>
> = {
  daysToFirstActivation: "low",
};

export function isCyberWaterMeasure(name: string): name is CyberWaterMeasure {
  return (CYBER_WATER_MEASURES as readonly string[]).includes(name);
}

/** The confidence ceiling a measure imposes, or null when it imposes none. */
export function confidenceCeilingFor(
  measure: CyberWaterMeasure,
): ConfidenceLevel | null {
  return CONFIDENCE_CAPPED_MEASURES[measure] ?? null;
}

export interface QuantityOptions {
  readonly resolveAtTick: number;
  readonly servedPopulation: number;
  readonly range?: readonly [number, number];
}

/**
 * A forecastable quantity.
 *
 * `range` narrows the outcome space a question partitions. It defaults to the
 * measure's definitional bounds, but a question is usually asked over the range
 * the quantity can actually reach — partitioning [0, 300000] when every scenario
 * lands under 40000 puts the whole ensemble in one band and produces a forecast
 * that is trivially right and says nothing. The range must be pre-registered
 * from a sweep that is not the one being scored.
 */
export function cyberWaterQuantity(
  measure: CyberWaterMeasure,
  options: QuantityOptions,
): TargetQuantity {
  const { resolveAtTick, servedPopulation } = options;
  if (!Number.isInteger(resolveAtTick) || resolveAtTick < 0) {
    throw new RangeError(
      `resolveAtTick must be a non-negative integer: ${resolveAtTick}`,
    );
  }
  if (servedPopulation <= 0) {
    throw new RangeError("servedPopulation must be > 0");
  }

  const [definitionalMin, definitionalMax] = definitionalBounds(
    measure,
    servedPopulation,
    resolveAtTick,
  );
  const [min, max] = options.range ?? [definitionalMin, definitionalMax];
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

export function definitionalBounds(
  measure: CyberWaterMeasure,
  servedPopulation: number,
  ticks: number,
): readonly [number, number] {
  switch (measure) {
    case "activationCount":
      return STRUCTURAL_BOUNDS.activationCount;
    case "peakInstrumentSeverity":
      return STRUCTURAL_BOUNDS.peakInstrumentSeverity;
    case "peakPeopleAffected":
      return [0, servedPopulation];
    case "personHoursBelow":
      // Everyone, for the whole window. Unreachable in practice, which is why
      // a question is asked over a pre-registered narrower range.
      return [0, servedPopulation * 24 * Math.max(1, ticks)];
    case "daysToFirstActivation":
      // Inclusive of `ticks` itself: that is the value a run reports when
      // access was never spent, and excluding it would make the commonest
      // outcome unresolvable.
      return [0, Math.max(1, ticks)];
  }
}

export interface CyberWaterBindingOptions {
  readonly consequence: ConsequenceTable;
  readonly register: CyberWaterConfig["register"];
  readonly ticks?: number;
  readonly defense?: DefenseConfig | null;
  readonly backgroundAnomalyRate?: number;
}

/**
 * Bind the domain to a base world.
 *
 * `defense` is the paired-arm knob: the same seed and the same run specs with
 * and without a defense produce two comparable ensembles, which is the only way
 * the marginal effect of a mitigation is measurable rather than asserted.
 */
export function createCyberWaterBinding(
  options: CyberWaterBindingOptions,
): DomainBinding<CyberWaterConfig, CyberWaterState> {
  const { consequence, register } = options;

  return {
    adapter: cyberWaterAdapter,

    configFor(spec, quantity) {
      // A run that stops before the resolution tick has no answer to give.
      const ticks = Math.max(options.ticks ?? 180, quantity.resolveAtTick + 1);
      return configFromRunSpec(spec, {
        register,
        servedPopulation: consequence.servedPopulation,
        consequence,
        ticks,
        defense: options.defense ?? null,
        backgroundAnomalyRate: options.backgroundAnomalyRate,
      });
    },

    readQuantity(result, quantity) {
      if (!isCyberWaterMeasure(quantity.name)) {
        throw new Error(
          `cyber-water cannot resolve quantity "${quantity.name}"`,
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

      const value = event.data[quantity.name];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError(
          `${quantity.name} at tick ${quantity.resolveAtTick} is not a finite number`,
        );
      }

      const [min, max] = definitionalBounds(
        quantity.name,
        consequence.servedPopulation,
        quantity.resolveAtTick + 1,
      );
      if (value < min || value > max) {
        throw new RangeError(
          `${quantity.name} read ${value}, outside its definitional range [${min}, ${max}] — the measure is wrong, not the world`,
        );
      }
      return value;
    },

    signatures(result) {
      // Reconstructed from telemetry events alone. Reading finalState here
      // would hand the detector the adversary's access inventory and quietly
      // turn detection precision into a tautology.
      const ticks: ObservableTick[] = result.events
        .filter((event) => event.kind === "telemetry")
        .map((event) => ({
          tick: event.tick,
          anomalyEvents: event.data.anomalyEvents as number,
          configChangeEvents: event.data.configChangeEvents as number,
          failedAuthEvents: event.data.failedAuthEvents as number,
          serviceComplaints: event.data.serviceComplaints as number,
        }));

      const signatures = deriveSignatures(ticks);
      return {
        anomalyBurstiness: signatures.anomalyBurstiness,
        configChangeRate: signatures.configChangeRate,
        authFailureSurge: signatures.authFailureSurge,
        complaintCoincidence: signatures.complaintCoincidence,
        compositeScore: signatures.compositeScore,
      };
    },
  };
}
