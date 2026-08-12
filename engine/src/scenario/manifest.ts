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
import { lowConfidenceParameters } from "../actors/doctrine.js";
import type { DoctrineProfile } from "../actors/doctrine.js";
import { SCENARIO_PACKS } from "./packs/index.js";

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
}

export async function buildDossiers(
  profilePath?: string,
): Promise<DossierFile> {
  const library = await loadDoctrineLibrary(profilePath);
  return {
    generatedNote:
      "Published by the engine from data/doctrine-profiles.json. The dashboard renders this and never recomputes it.",
    reviewedAt: library.reviewedAt,
    method: library.method,
    profiles: library.profiles,
  };
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
    sourceCount: profile.sources.length,
    uncertainty: profile.uncertainty,
  }));

  return {
    generatedNote:
      "Published by the engine. The dashboard renders this and never recomputes it.",
    profilesReviewedAt: library.reviewedAt,
    profileMethod: library.method,
    packs,
    actors,
  };
}
