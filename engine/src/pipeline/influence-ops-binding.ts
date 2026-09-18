/**
 * The influence-operations domain binding — Phase 1's plug-in.
 *
 * The whole domain enters the orchestrator through this file, and it is where
 * the detector/oracle separation becomes structural: `readQuantity` reads the
 * ground-truth event stream, `signatures` reads the telemetry event stream, and
 * neither can reach the other's data. Everything downstream of `signatures` is
 * therefore computable by a defender who never saw the campaign parameters.
 */

import {
  DEFAULT_CONFIG,
  configFromRunSpec,
  deriveSignatures,
} from "../sim/adapters/influence-ops/index.js";
import { influenceOpsAdapter } from "../sim/adapters/influence-ops/index.js";
import type {
  InfluenceOpsConfig,
  InfluenceOpsState,
  ObservableTick,
} from "../sim/adapters/influence-ops/index.js";
import type { TargetQuantity } from "../evidence/partition.js";
import type { SimEvent } from "../sim/kernel.js";
import type { DomainBinding } from "./types.js";

/** Population measures this domain can be asked to forecast. */
export const INFLUENCE_OPS_MEASURES = [
  "meanBelief",
  "variance",
  "bimodality",
  "clusterSeparation",
  "adoptionRate",
] as const;
export type InfluenceOpsMeasure = (typeof INFLUENCE_OPS_MEASURES)[number];

/**
 * Definitional ranges, not observed ones.
 *
 * Beliefs live in [0,1], so a mean and a between-cluster gap do too; variance of
 * a [0,1] variable cannot exceed 1/4; Sarle's bimodality coefficient is bounded
 * by 1 through Pearson's kurtosis-skewness inequality. A reading outside these
 * is a bug in the measure, which is why readQuantity throws rather than clamps.
 */
export const MEASURE_BOUNDS: Readonly<
  Record<InfluenceOpsMeasure, readonly [number, number]>
> = {
  meanBelief: [0, 1],
  variance: [0, 0.25],
  bimodality: [0, 1],
  clusterSeparation: [0, 1],
  adoptionRate: [0, 1],
};

const MEASURE_DESCRIPTIONS: Readonly<Record<InfluenceOpsMeasure, string>> = {
  meanBelief: "population mean belief on the targeted narrative",
  variance: "variance of belief on the targeted narrative",
  bimodality: "Sarle's bimodality coefficient — how split the population is",
  clusterSeparation: "largest gap between any two cluster means",
  adoptionRate: "share of the population above the adoption threshold",
};

/**
 * A forecastable quantity.
 *
 * `range` narrows the outcome space a question partitions. It defaults to the
 * measure's definitional bounds, but a question is usually asked over the range
 * the quantity can actually reach — partitioning [0,1] when every scenario lands
 * between 0.39 and 0.61 puts the entire ensemble in one band and produces a
 * forecast that is trivially right and says nothing. The range must be
 * pre-registered from a sweep that is not the one being scored; deriving it
 * from the scored runs would be fitting the question to its answer.
 */
export function influenceOpsQuantity(
  measure: InfluenceOpsMeasure,
  resolveAtTick: number,
  range?: readonly [number, number],
): TargetQuantity {
  if (!Number.isInteger(resolveAtTick) || resolveAtTick < 0) {
    throw new RangeError(
      `resolveAtTick must be a non-negative integer: ${resolveAtTick}`,
    );
  }

  const [definitionalMin, definitionalMax] = MEASURE_BOUNDS[measure];
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

/** Narrows a caller-supplied string — the CLI's validation seam. */
export function isInfluenceOpsMeasure(
  name: string,
): name is InfluenceOpsMeasure {
  return (INFLUENCE_OPS_MEASURES as readonly string[]).includes(name);
}

/**
 * Bind the domain to a base world.
 *
 * Parameterized on the base config purely so tests can drive a small world in
 * milliseconds instead of a 400-agent one in seconds — the same knob keeps the
 * production world in exactly one place.
 */
export function createInfluenceOpsBinding(
  base: InfluenceOpsConfig = DEFAULT_CONFIG,
): DomainBinding<InfluenceOpsConfig, InfluenceOpsState> {
  return {
    adapter: influenceOpsAdapter,

    configFor(spec, quantity) {
      // A run that stops before the resolution tick has no answer to give.
      const ticks = Math.max(base.ticks, quantity.resolveAtTick + 1);
      return configFromRunSpec(spec, { ...base, ticks });
    },

    readQuantity(result, quantity) {
      if (!isInfluenceOpsMeasure(quantity.name)) {
        throw new Error(
          `influence-ops cannot resolve quantity "${quantity.name}"`,
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

      const [min, max] = MEASURE_BOUNDS[quantity.name];
      if (value < min || value > max) {
        throw new RangeError(
          `${quantity.name} read ${value}, outside its definitional range [${min}, ${max}] — the measure is wrong, not the world`,
        );
      }
      return value;
    },

    signatures(result) {
      // Reconstructed from telemetry events alone. Reading finalState here
      // would hand the detector the population's actual beliefs and quietly
      // turn detection precision into a tautology.
      return signaturesFromTelemetry(
        result.events.filter((event) => event.kind === "telemetry"),
      );
    },
  };
}

/**
 * The same signatures, computed from telemetry at ticks 0..t0 only — what a
 * defender could know at t0. Takes the event stream and nothing else, so an
 * early check cannot read the future or the final state.
 */
export function signaturesUpTo(
  result: { readonly events: readonly SimEvent[] },
  t0: number,
): Readonly<Record<string, number>> {
  if (!Number.isInteger(t0) || t0 < 0) {
    throw new RangeError(`t0 must be a non-negative integer: ${t0}`);
  }
  return signaturesFromTelemetry(
    result.events.filter(
      (event) => event.kind === "telemetry" && event.tick <= t0,
    ),
  );
}

function signaturesFromTelemetry(
  telemetry: readonly SimEvent[],
): Readonly<Record<string, number>> {
  const ticks: ObservableTick[] = telemetry.map((event) => ({
    tick: event.tick,
    volume: event.data.volume as number,
    activeAccounts: event.data.activeAccounts as number,
    activeDegreeRatio: event.data.activeDegreeRatio as number,
    clusterActivityShare: event.data.clusterActivityShare as number[],
  }));

  const signatures = deriveSignatures(ticks);
  return {
    burstiness: signatures.burstiness,
    surgeRatio: signatures.surgeRatio,
    hubConcentration: signatures.hubConcentration,
    clusterSynchrony: signatures.clusterSynchrony,
    compositeScore: signatures.compositeScore,
  };
}

/** The production world. */
export const influenceOpsBinding = createInfluenceOpsBinding();
