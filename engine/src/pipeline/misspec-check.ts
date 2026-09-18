/**
 * A prior-predictive rank check: does the real world's early telemetry look
 * like a world drawn from the prior the forecast assumed?
 *
 * Draw N worlds from that prior, score all N+1 members (the truth included)
 * with one statistic that treats them symmetrically, and rank the truth. If the
 * truth really came from that prior, the members are exchangeable, the truth's
 * rank is uniform, and P(p ≤ α) ≤ α. The bound is an average over the prior,
 * not a promise for any fixed θ, and it says nothing about power: how often a
 * wrong prior is caught has to be measured.
 */

import { drawFromBox } from "./benchmark.js";
import type { RunSpec } from "../agents/framer.js";
import type { ScenarioPrior } from "./run-question.js";

/** The channels the check reads. compositeScore is a function of these four. */
export const CHECK_CHANNELS = [
  "burstiness",
  "surgeRatio",
  "hubConcentration",
  "clusterSynchrony",
] as const;

/** One independent draw per seed, made exactly as the benchmark draws its truth. */
export function priorDraws(
  prior: ScenarioPrior,
  seeds: readonly string[],
): RunSpec[] {
  return seeds.map((seed, index) => ({
    id: `draw-${index}`,
    label: `prior draw ${index}`,
    ...drawFromBox(prior, seed),
    rationale: "An independent draw from the prior the forecast assumed.",
  }));
}

/**
 * Share of members scoring at least the observed one, itself included. Ties
 * count against the alarm, which keeps P(p ≤ α) ≤ α when scores tie.
 */
export function rankPValue(
  scores: readonly number[],
  observedIndex: number,
): number {
  const observed = scores[observedIndex];
  if (observed === undefined) {
    throw new RangeError(`no score at index ${observedIndex}`);
  }
  return scores.filter((score) => score >= observed).length / scores.length;
}

/** Weight moved from the off-diagonal covariances onto the diagonal. */
const SHRINKAGE = 0.1;

/**
 * Each member's squared Mahalanobis distance from the pooled mean, under the
 * pooled covariance shrunk toward its diagonal. Everything is estimated from
 * the whole set, so the statistic is a symmetric function of the members —
 * the only property the rank guarantee needs.
 */
export function pooledMahalanobis(
  points: readonly (readonly number[])[],
): number[] {
  const n = points.length;
  const d = points[0]?.length ?? 0;
  if (n < 2 || d === 0) {
    throw new RangeError("need at least two points with one coordinate each");
  }

  const mean = Array.from(
    { length: d },
    (_, k) => points.reduce((sum, p) => sum + p[k]!, 0) / n,
  );
  const centred = points.map((p) => p.map((v, k) => v - mean[k]!));
  const covariance = Array.from({ length: d }, (_, a) =>
    Array.from(
      { length: d },
      (_, b) => centred.reduce((sum, c) => sum + c[a]! * c[b]!, 0) / (n - 1),
    ),
  );

  // The ridge is relative to each channel's own variance, so rescaling a
  // channel rescales its ridge and the score does not depend on units. A
  // channel that never varies is centred to zero for every member and adds
  // nothing; MIN_VALUE only keeps the factorisation finite.
  const shrunk = covariance.map((row, a) =>
    row.map((v, b) =>
      a === b ? v * (1 + 1e-9) + Number.MIN_VALUE : (1 - SHRINKAGE) * v,
    ),
  );

  const lower = cholesky(shrunk);
  return centred.map((c) =>
    forwardSolve(lower, c).reduce((sum, v) => sum + v * v, 0),
  );
}

function cholesky(matrix: readonly (readonly number[])[]): number[][] {
  const d = matrix.length;
  const lower = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i]![j]!;
      for (let k = 0; k < j; k++) sum -= lower[i]![k]! * lower[j]![k]!;
      lower[i]![j] = i === j ? Math.sqrt(sum) : sum / lower[j]![j]!;
    }
  }
  return lower;
}

/** Solves L·y = b; |y|² is then bᵀΣ⁻¹b. */
function forwardSolve(
  lower: readonly (readonly number[])[],
  b: readonly number[],
): number[] {
  const y: number[] = [];
  for (let i = 0; i < b.length; i++) {
    let sum = b[i]!;
    for (let k = 0; k < i; k++) sum -= lower[i]![k]! * y[k]!;
    y.push(sum / lower[i]![i]!);
  }
  return y;
}
