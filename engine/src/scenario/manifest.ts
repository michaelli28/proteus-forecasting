/**
 * The catalogue the dashboard renders its controls from.
 *
 * The dashboard must never hold its own copy of what packs exist, what
 * mitigations they offer, or which actors are available — a second list drifts
 * from the first, and the symptom is a control that offers something the engine
 * will reject. So the engine publishes this and the dashboard reads it, the same
 * arrangement the benchmark snapshot and run traces already use.
 *
 * It carries the sourcing metadata too. A control that lets someone drop the
 * Russian Federation into a power-grid scenario should show, in the same place,
 * how well-sourced that profile is and where its author said it was weak.
 */

import { loadDoctrineLibrary } from "../actors/library.js";
import {
  CONSTRAINED_ATTRIBUTES,
  citationCount,
  constraintReach,
  groupedSources,
  lowConfidenceParameters,
} from "../actors/doctrine.js";
import type {
  ConstrainedAttribute,
  DoctrineProfile,
} from "../actors/doctrine.js";
import { SCENARIO_PACKS } from "./packs/index.js";
import {
  PRESET_VERIFICATION_SEEDS,
  SCENARIO_PRESETS,
  validatePresets,
} from "./presets.js";
import type { ScenarioPreset } from "./presets.js";
import { compareArms, worstActorFor } from "./compare-arms.js";
import type { ArmComparison } from "./compare-arms.js";

export interface ManifestDefense {
  readonly kind: string;
  readonly label: string;
  readonly statement: string;
  readonly costPerTick: number;
}

export interface ManifestPack {
  readonly id: string;
  readonly statement: string;
  readonly provenance: string;
  readonly ticks: number;
  readonly tickUnit: string;
  readonly servedUnits: number;
  readonly harmUnit: string;
  readonly evidenceClass: string;
  readonly assetCount: number;
  readonly ladder: readonly { id: string; statement: string }[];
  readonly defenses: readonly ManifestDefense[];
}

export interface ManifestActor {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly summary: string;
  readonly rationalityPrecision: number;
  readonly redlines: readonly { statement: string; binding: boolean }[];
  /** Parameters whose sourcing the researcher rated weakest. */
  readonly lowConfidence: readonly string[];
  readonly sourceCount: number;
  readonly uncertainty: string;
}

export interface ScenarioManifest {
  readonly generatedNote: string;
  readonly profilesReviewedAt: string;
  readonly profileMethod: string;
  readonly packs: readonly ManifestPack[];
  readonly actors: readonly ManifestActor[];
  /** Configurations worth a reader's first ten minutes. See `presets.ts`. */
  readonly presets: readonly ScenarioPreset[];
}

/** The highest value each constrainable attribute reaches in one pack's ladder. */
function ladderMaxima(packId: string): {
  packId: string;
  maxima: Record<ConstrainedAttribute, number>;
} {
  const pack = SCENARIO_PACKS[packId]!;
  const maxima = {} as Record<ConstrainedAttribute, number>;
  for (const attribute of CONSTRAINED_ATTRIBUTES) {
    maxima[attribute] = Math.max(
      ...pack.ladder.map((rung) => rung[attribute] ?? 0),
    );
  }
  return { packId, maxima };
}

/**
 * The full profile, published for the dossier pages.
 *
 * Kept OUT of the manifest deliberately. The manifest is imported by a client
 * component to render the run controls, so everything in it ships to the
 * browser; the dossiers run to hundreds of kilobytes of sourced prose and are
 * read by server components only. One file that served both would put a quarter
 * of a megabyte of citations into the bundle of a page that shows a dropdown.
 */
export interface DossierFile {
  readonly generatedNote: string;
  readonly reviewedAt: string;
  readonly method: string;
  readonly profiles: readonly DoctrineProfile[];
  /**
   * For each enforceable commitment, the scenarios that can actually trip it.
   *
   * Computed here because it is the one fact about a redline that needs both
   * halves of the system — the profile that declares the threshold and the
   * ladders that do or do not reach it. Published rather than derived in the
   * dashboard so the page cannot disagree with the engine about whether a
   * commitment binds.
   */
  readonly constraintReach: readonly {
    readonly profileId: string;
    readonly redlineId: string;
    readonly attribute: string;
    readonly maxAcceptable: number;
    readonly reachedIn: readonly string[];
  }[];
  /**
   * Each profile's citations under the headings its author filed them beneath.
   *
   * Published beside the raw `sources` rather than replacing it: the flat array
   * is what the library actually holds and what a reader diffing the data will
   * see, and this is the repaired reading of it.
   */
  readonly sourceGroups: readonly {
    readonly profileId: string;
    readonly label: string;
    readonly citations: readonly string[];
  }[];
}

export async function buildDossiers(
  profilePath?: string,
): Promise<DossierFile> {
  const library = await loadDoctrineLibrary(profilePath);
  const ladders = Object.keys(SCENARIO_PACKS).map(ladderMaxima);

  return {
    generatedNote:
      "Published by the engine from data/doctrine-profiles.json. The dashboard renders this and never recomputes it.",
    reviewedAt: library.reviewedAt,
    method: library.method,
    profiles: library.profiles,
    constraintReach: library.profiles.flatMap((profile) =>
      constraintReach(profile, ladders).map((reach) => ({
        profileId: profile.id,
        ...reach,
      })),
    ),
    sourceGroups: library.profiles.flatMap((profile) =>
      groupedSources(profile).map((group) => ({
        profileId: profile.id,
        ...group,
      })),
    ),
  };
}

/**
 * Every pack's mitigations, replayed against its worst actor across six seeds.
 *
 * Published as its own file rather than folded into the manifest: the manifest
 * is imported by a client component, and per-seed harm arrays for three packs
 * would ride into the browser to render a table the server can render itself.
 *
 * Uses the same six seeds the presets are checked against, so a reader who runs
 * `--preset one-world-cannot-tell-you` and then reads this table is looking at
 * the same worlds from two directions.
 */
export async function buildComparisons(
  profilePath?: string,
): Promise<readonly ArmComparison[]> {
  const library = await loadDoctrineLibrary(profilePath);
  const actorIds = library.profiles.map((profile) => profile.id);
  const seeds = [...PRESET_VERIFICATION_SEEDS];

  const comparisons: ArmComparison[] = [];
  for (const pack of Object.keys(SCENARIO_PACKS)) {
    const actorId = await worstActorFor(pack, actorIds, seeds, profilePath);
    comparisons.push(
      await compareArms({
        pack,
        actorId,
        actorLabel: library.get(actorId).label,
        seeds,
        profilePath,
      }),
    );
  }
  return comparisons;
}

export async function buildManifest(
  profilePath?: string,
): Promise<ScenarioManifest> {
  const library = await loadDoctrineLibrary(profilePath);

  const packs: ManifestPack[] = Object.entries(SCENARIO_PACKS).map(
    ([id, pack]) => ({
      id,
      statement: pack.statement,
      provenance: pack.provenance,
      ticks: pack.ticks,
      tickUnit: pack.tickUnit,
      servedUnits: pack.servedUnits,
      harmUnit: pack.oracle.harmUnit,
      evidenceClass: pack.oracle.kind === "table" ? "solved" : "parametric",
      assetCount: pack.assets.length,
      ladder: pack.ladder
        .filter((rung) => rung.id !== "none")
        .map((rung) => ({ id: rung.id, statement: rung.statement })),
      defenses: pack.defenses.map((defense) => ({
        kind: defense.kind,
        label: defense.label,
        statement: defense.statement,
        costPerTick: defense.costPerTick,
      })),
    }),
  );

  const actors: ManifestActor[] = library.profiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    kind: profile.kind,
    summary: profile.summary,
    rationalityPrecision: profile.rationalityPrecision,
    redlines: profile.redlines.map((redline) => ({
      statement: redline.statement,
      // A redline with no constraint changes no behaviour. Saying so here
      // stops the UI presenting inert prose as if it bound the model.
      binding: redline.constraint !== undefined,
    })),
    lowConfidence: lowConfidenceParameters(profile),
    sourceCount: citationCount(profile),
    uncertainty: profile.uncertainty,
  }));

  // Fails the build rather than shipping a button that names an actor or a
  // mitigation the engine no longer has.
  validatePresets(library);

  return {
    generatedNote:
      "Published by the engine. The dashboard renders this and never recomputes it.",
    profilesReviewedAt: library.reviewedAt,
    profileMethod: library.method,
    packs,
    actors,
    presets: SCENARIO_PRESETS,
  };
}
