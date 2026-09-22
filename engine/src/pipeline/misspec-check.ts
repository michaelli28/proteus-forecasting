/**
 * What the misspecification check reads, and the draws it compares against.
 *
 * The statistics themselves live in `../metrics/rank-check.js`, which knows
 * nothing about this scenario: a rank check is the same arithmetic wherever the
 * series comes from. What is domain-specific is here — which telemetry channels
 * the check reads, and how a draw from the forecast's assumed prior is made so
 * it matches the benchmark's own truth exactly.
 *
 * The guarantee it inherits: score N draws and the observed world with a
 * statistic symmetric in all N+1, rank the observed one, and P(p ≤ α) ≤ α
 * averaged over the prior — not for any fixed θ, and with nothing promised
 * about power.
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
