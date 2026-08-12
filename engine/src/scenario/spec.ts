/**
 * The scenario spec — a runnable situation, as data.
 *
 * A spec is the whole interface between "an evaluator described a situation" and
 * "the engine ran it". It is JSON: no closures, no imports, nothing that has to
 * be compiled. That matters for three reasons.
 *
 * An evaluator can write one by hand, or edit one the compiler produced, without
 * touching the codebase. A spec can be reviewed and argued with as a document
 * before anyone spends compute on it — which is the right order, because the
 * disagreements worth having are about the situation, not the run. And because
 * the language model that writes specs cannot be trusted to write valid ones,
 * everything it produces passes through the schema below and then through
 * `validateScenario`, which fails closed on anything degenerate.
 *
 * The spec carries NO techniques, targets, or real organisations — the same
 * structural boundary the config enforces, restated at the layer a model writes.
 */

import { z } from "zod";

import {
  DEFENSE_CHANNELS,
  RESPONDENT_ALIGNMENTS,
  validateScenario,
} from "../sim/adapters/contested-system/config.js";
import type {
  ActorConfig,
  ContestedSystemConfig,
  DefenseOption,
  EscalationRung,
} from "../sim/adapters/contested-system/config.js";
import {
  createParametricOracle,
  createTableOracle,
} from "../sim/adapters/contested-system/oracle.js";
import type { ConsequenceOracle } from "../sim/adapters/contested-system/oracle.js";
import type { DoctrineLibrary } from "../actors/library.js";

const RungSpecSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  attributability: z.number().min(0).max(1),
  visibility: z.number().min(0).max(1),
  civilianHarmShare: z.number().min(0).max(1),
  durationHours: z.number().min(0),
  reversible: z.boolean(),
  legitimacyCost: z.number().min(0).max(1),
});

/**
 * Parametric properties, required when the oracle is parametric.
 *
 * Kept on the asset rather than in a parallel table so an asset cannot exist
 * without the numbers needed to price it — the failure mode being an asset that
 * silently prices as harmless and therefore ranks as safe.
 */
const ParametricSpecSchema = z.object({
  unitsDependent: z.number().min(0),
  immediateLossShare: z.number().min(0).max(1),
  bufferHours: z.number().min(0),
  recoveryTailHours: z.number().min(0),
  redundancy: z.number().min(0).max(1),
});

const AssetSpecSchema = z.object({
  id: z.string().min(1),
  assetClass: z.string().min(1),
  zone: z.string().min(1),
  effectKind: z.string().min(1),
  servedUnits: z.number().min(0),
  parametric: ParametricSpecSchema.optional(),
});

const ActorSpecSchema = z.object({
  profileId: z.string().min(1),
  initialHoldingsMean: z.number().min(0),
  initialHoldingsSd: z.number().min(0),
  acquisitionHazard: z.number().min(0).max(1),
  holdingValueDecay: z.number().min(0).max(1),
  payoffBase: z.number(),
  payoffDrift: z.number(),
  earliestActivationTick: z.number().int().min(0),
  reachableRungs: z.array(z.string().min(1)).min(1),
});

const RespondentSpecSchema = z.object({
  profileId: z.string().min(1),
  alignment: z.enum(RESPONDENT_ALIGNMENTS),
  attributionThreshold: z.number().min(0).max(1),
  responseCapacity: z.number().min(0),
});

const DefenseSpecSchema = z.object({
  kind: z.string().min(1),
  label: z.string().min(1),
  statement: z.string().min(1),
  startTick: z.number().int().min(0),
  intensity: z.number().min(0).max(1),
  costPerTick: z.number().min(0),
  coverage: z.number().min(0).max(1),
  effects: z
    .array(
      z.object({
        channel: z.enum(DEFENSE_CHANNELS),
        strength: z.number().min(0).max(1),
      }),
    )
    .min(1),
});

const OracleSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("parametric"),
    harmUnit: z.string().min(1),
    uncertainty: z.number().min(0).max(1).optional(),
  }),
  z.object({
    kind: z.literal("table"),
    harmUnit: z.string().min(1),
    method: z.string().min(1),
    /** Path to a solved table, relative to the engine root. */
    tablePath: z.string().min(1),
  }),
]);

export const ScenarioSpecSchema = z.object({
  id: z.string().min(1),
  /** One line an analyst would recognise. Shown above every product. */
  statement: z.string().min(1),
  /** Where the situation came from, so a reader can judge it. */
  provenance: z.string().min(1),
  ticks: z.number().int().positive(),
  tickUnit: z.string().min(1),
  /**
   * Distinct units the whole system serves.
   *
   * Declared, never derived by summing the assets. Assets overlap by design — a
   * substation, the tie that backs it up, and the control system that watches
   * both serve the SAME customers — so a sum triple-counts and inflates the
   * denominator that normalizes harm. The symptom is subtle and total: every
   * move scores too low to be worth making, the adversary never acts, and the
   * run reports an attack surface of zero rather than an error.
   */
  servedUnits: z.number().positive(),
  assets: z.array(AssetSpecSchema).min(1),
  ladder: z.array(RungSpecSchema).min(2),
  actors: z.array(ActorSpecSchema).min(1),
  respondents: z.array(RespondentSpecSchema),
  defenses: z.array(DefenseSpecSchema),
  oracle: OracleSpecSchema,
  backgroundAnomalyRate: z.number().min(0),
});

export type ScenarioSpec = z.infer<typeof ScenarioSpecSchema>;
export type AssetSpec = z.infer<typeof AssetSpecSchema>;
export type DefenseSpec = z.infer<typeof DefenseSpecSchema>;
export type ActorSpec = z.infer<typeof ActorSpecSchema>;
export type RespondentSpec = z.infer<typeof RespondentSpecSchema>;

/**
 * A situation with nobody cast in it yet.
 *
 * The split matters analytically, not just structurally. "What is exposed here"
 * and "who would actually move against it" are different questions with
 * different evidence behind them, and fusing them into one artifact means a
 * scenario can never be re-run against a different adversary without editing the
 * system description too. Keeping them apart is what makes "run this same
 * infrastructure against a patient state actor, then against a criminal
 * affiliate network" a one-line change.
 */
export type SituationSpec = Omit<ScenarioSpec, "actors" | "respondents">;

/** Place actors and third parties into a situation, producing a runnable spec. */
export function castScenario(
  situation: SituationSpec,
  actors: readonly ActorSpec[],
  respondents: readonly RespondentSpec[] = [],
): ScenarioSpec {
  return ScenarioSpecSchema.parse({
    ...situation,
    actors,
    respondents,
  });
}

export class SpecError extends Error {}

export interface BuildOptions {
  readonly library: DoctrineLibrary;
  /** Which mitigation to run this arm with. Null is the baseline arm. */
  readonly defense?: DefenseSpec | null;
  /** Supplied when the oracle is table-backed. */
  readonly oracle?: ConsequenceOracle;
}

/**
 * Turn a spec into a runnable config.
 *
 * Every cross-reference the schema cannot express is checked here — a rung an
 * actor cannot reach, a profile the library does not have, a parametric oracle
 * over assets that never declared their properties. Each throws with the name of
 * the thing that is wrong, because these specs are frequently machine-written
 * and "invalid scenario" is not a message anyone can act on.
 */
export function buildScenario(
  spec: ScenarioSpec,
  options: BuildOptions,
): ContestedSystemConfig {
  const { library } = options;

  const ladder: EscalationRung[] = spec.ladder.map((rung) => ({ ...rung }));
  const servedUnits = spec.servedUnits;

  const oracle = options.oracle ?? buildOracle(spec, servedUnits);

  const actors: ActorConfig[] = spec.actors.map((actor) => {
    if (!library.has(actor.profileId)) {
      throw new SpecError(
        `actor references doctrine profile "${actor.profileId}", which the library does not have`,
      );
    }
    return {
      profile: library.get(actor.profileId),
      initialHoldingsMean: actor.initialHoldingsMean,
      initialHoldingsSd: actor.initialHoldingsSd,
      acquisitionHazard: actor.acquisitionHazard,
      holdingValueDecay: actor.holdingValueDecay,
      payoffBase: actor.payoffBase,
      payoffDrift: actor.payoffDrift,
      earliestActivationTick: actor.earliestActivationTick,
      reachableRungs: actor.reachableRungs,
    };
  });

  const respondents = spec.respondents.map((respondent) => {
    if (!library.has(respondent.profileId)) {
      throw new SpecError(
        `respondent references doctrine profile "${respondent.profileId}", which the library does not have`,
      );
    }
    return {
      profile: library.get(respondent.profileId),
      alignment: respondent.alignment,
      attributionThreshold: respondent.attributionThreshold,
      responseCapacity: respondent.responseCapacity,
    };
  });

  const defenseSpec = options.defense ?? null;
  const defense: DefenseOption | null = defenseSpec
    ? { ...defenseSpec, effects: [...defenseSpec.effects] }
    : null;

  const config: ContestedSystemConfig = {
    scenarioId: spec.id,
    statement: spec.statement,
    ticks: spec.ticks,
    tickUnit: spec.tickUnit,
    register: spec.assets.map((asset) => ({
      id: asset.id,
      assetClass: asset.assetClass,
      zone: asset.zone,
      effectKind: asset.effectKind,
      servedUnits: asset.servedUnits,
    })),
    ladder,
    oracle,
    actors,
    respondents,
    defense,
    backgroundAnomalyRate: spec.backgroundAnomalyRate,
    servedUnits,
  };

  validateScenario(config);
  return config;
}

function buildOracle(
  spec: ScenarioSpec,
  servedUnits: number,
): ConsequenceOracle {
  if (spec.oracle.kind === "table") {
    throw new SpecError(
      `scenario "${spec.id}" declares a table-backed oracle; load it and pass it as options.oracle — this layer will not read a solver table off disk implicitly, because a run that silently shells out has provenance nobody can reconstruct`,
    );
  }

  const missing = spec.assets.filter((asset) => !asset.parametric);
  if (missing.length > 0) {
    throw new SpecError(
      `parametric oracle needs properties on every asset; missing on ${missing
        .map((asset) => asset.id)
        .join(
          ", ",
        )} — an asset with no declared dependency would price as harmless and rank as safe`,
    );
  }

  return createParametricOracle({
    id: `${spec.id}-parametric`,
    harmUnit: spec.oracle.harmUnit,
    servedUnits,
    uncertainty:
      spec.oracle.kind === "parametric" ? spec.oracle.uncertainty : undefined,
    assets: spec.assets.map((asset) => ({
      assetId: asset.id,
      effectKind: asset.effectKind,
      ...asset.parametric!,
    })),
  });
}

/** Re-export so a caller building a table oracle does not reach into the adapter. */
export { createTableOracle };

export function parseScenarioSpec(raw: unknown): ScenarioSpec {
  return ScenarioSpecSchema.parse(raw);
}
