/** Hand-shaped repair problems the random generator rarely produces. */

import type { Rng } from "../../../src/sim/rng.js";
import type { RepairProblem } from "../../../src/sim/adapters/restoration/objective.js";

export const PROBLEM_SHAPES = [
  "tree",
  "chain",
  "star",
  "zero-customers",
  "tie-heavy",
] as const;
export type ProblemShape = (typeof PROBLEM_SHAPES)[number];

export function randomProblem(
  rng: Rng,
  k: number,
  shape: ProblemShape,
): RepairProblem {
  const parent = Array.from({ length: k }, (_, j) => {
    if (j === 0 || shape === "star") return -1;
    if (shape === "chain") return j - 1;
    // Parents always have lower indices; -1 makes a new root.
    return rng.int(j + 1) - 1;
  });
  const customers = Array.from({ length: k }, () => {
    if (shape === "zero-customers")
      return rng.bernoulli(0.5) ? 0 : 1 + rng.int(40);
    if (shape === "tie-heavy") return 1 + rng.int(3);
    return rng.bernoulli(0.25) ? 0 : 1 + rng.int(60);
  });
  const ticks = Array.from({ length: k }, () =>
    shape === "tie-heavy" ? 1 + rng.int(2) : 1 + rng.int(16),
  );
  return { parent, customers, ticks };
}
