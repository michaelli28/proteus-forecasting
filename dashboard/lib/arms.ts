/**
 * The measured mitigation comparison the engine publishes.
 *
 * Hand-mirrored from `engine/src/scenario/compare-arms.ts`, the same arrangement
 * the manifest and dossier types already use.
 *
 * SERVER ONLY. Each arm carries its per-seed harm array — the spread is the
 * finding, so it is kept rather than summarised — and there is no reason for
 * three packs' worth of those to ride into the browser to render a table the
 * server renders itself.
 */

import comparisons from "../data/arm-comparisons.json";

export interface ArmOutcome {
  defense: string | null;
  label: string;
  costPerTick: number;
  harm: number[];
  median: number;
  best: number;
  worst: number;
  beatBaseline: number;
}

export interface ArmComparison {
  pack: string;
  harmUnit: string;
  tickUnit: string;
  actorId: string;
  actorLabel: string;
  seeds: string[];
  baseline: ArmOutcome;
  defended: ArmOutcome[];
}

function load(): ArmComparison[] {
  const data = comparisons as unknown as ArmComparison[];
  if (!data?.length) {
    throw new Error(
      "arm-comparisons.json is empty — run `npm run manifest` in engine/",
    );
  }
  return data;
}

export const ARM_COMPARISONS = load();

/**
 * Mitigations that came out ahead in every world they were replayed in.
 *
 * The distinction the whole table exists to draw: a mitigation that helps on
 * four seeds out of six is not a cheaper version of one that helps on all six,
 * it is a different kind of thing, and a defender choosing between them on
 * median harm alone cannot tell them apart.
 */
export function reliable(comparison: ArmComparison): ArmOutcome[] {
  return comparison.defended.filter(
    (arm) => arm.beatBaseline === comparison.seeds.length,
  );
}
