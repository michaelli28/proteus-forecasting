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

export interface Interval {
  estimate: number;
  lower: number;
  upper: number;
  resamples: number;
}

export interface ArmOutcome {
  defense: string | null;
  label: string;
  costPerTick: number;
  harm: number[];
  mean: number;
  median: number;
  best: number;
  worst: number;
  beatBaseline: number;
  tiedBaseline: number;
  lostToBaseline: number;
  /** Mean change in harm against no defense, 95% interval. Null on the baseline. */
  changeVsBaseline: Interval | null;
  /** Mean gap to the next defense down. Spanning 0 means the worlds cannot tell them apart. */
  vsNext: Interval | null;
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
      "arm-comparisons.json is empty — run `node dist/cli.js manifest` in engine/",
    );
  }
  return data;
}

export const ARM_COMPARISONS = load();

/** Defenses whose average harm is lower than no defense by more than chance. */
export function clearlyHelps(comparison: ArmComparison): ArmOutcome[] {
  return comparison.defended.filter(
    (arm) => arm.changeVsBaseline !== null && arm.changeVsBaseline.upper < 0,
  );
}

/**
 * Neighbouring defenses the replayed worlds cannot separate. Only neighbours:
 * each defense is compared with the next one down, and a tie with your
 * neighbour does not carry further down the list — A≈B and B≈C can still
 * leave A clearly ahead of C.
 */
export function unresolvedPairs(
  comparison: ArmComparison,
): [ArmOutcome, ArmOutcome][] {
  return comparison.defended.flatMap((arm, i) => {
    const next = comparison.defended[i + 1];
    return next && arm.vsNext && arm.vsNext.lower <= 0 && arm.vsNext.upper >= 0
      ? [[arm, next] as [ArmOutcome, ArmOutcome]]
      : [];
  });
}
