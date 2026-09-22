/**
 * Comparing two arms replayed across the same worlds.
 *
 * Both helpers assume the arms share their seeds element-for-element, which is
 * what makes the difference per world meaningful: the worlds cancel, and what
 * is left is the arm. A mean alone would hide an arm that helps in most worlds
 * and hurts in some, so the split is reported beside it — with ties kept apart
 * from losses, because an arm that changed nothing in a world neither beat the
 * baseline there nor lost to it.
 */

import { stratifiedBootstrap } from "./bootstrap.js";
import type { Interval } from "./bootstrap.js";

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Mean paired difference a − b over shared seeds, with a 95% seed bootstrap. */
export function pairedChange(
  a: readonly number[],
  b: readonly number[],
  seed: string,
): Interval | null {
  return stratifiedBootstrap(
    a.map((value, i) => value - b[i]!),
    { stratumOf: () => "seeds", statistic: mean, seed },
  );
}

/** How an arm's per-world harm landed against the baseline's, lower being better. */
export interface WinTieLoss {
  readonly better: number;
  readonly tied: number;
  readonly worse: number;
}

export function winTieLoss(
  arm: readonly number[],
  baseline: readonly number[],
): WinTieLoss {
  const count = (test: (value: number, base: number) => boolean): number =>
    arm.filter((value, i) => test(value, baseline[i]!)).length;

  return {
    better: count((v, b) => v < b),
    tied: count((v, b) => v === b),
    worse: count((v, b) => v > b),
  };
}
