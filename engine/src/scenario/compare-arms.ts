/**
 * Answering the question the run cannot: did the mitigation work?
 *
 * One run cannot say. Harm in this engine is driven by when stochastic access
 * happens to land relative to the payoff drift, and that varies enough between
 * worlds to swamp most mitigations — the `one-world-cannot-tell-you` preset
 * exists to demonstrate exactly that. Having demonstrated it, the product owed a
 * reader the way to actually find out, and the kernel is cheap enough to give
 * one: replay both arms across the same seeds and report the distribution.
 *
 * A mean alone would hide that the same mitigation helps in most worlds and
 * hurts in some, so every arm carries its per-seed harm and its wins, ties and
 * losses against no mitigation, next to the mean. Arms are ranked by mean harm
 * over many shared seeds, each with a paired interval against the baseline and
 * against the next arm down, so a gap the seeds cannot resolve reads as a tie.
 */

import { getPack } from "./packs/index.js";
import { runSimulate } from "../simulate.js";
import { stratifiedBootstrap } from "../metrics/bootstrap.js";
import type { Interval } from "../metrics/bootstrap.js";

/**
 * The shared seeds every published comparison replays. Six seeds could not
 * separate most mitigations, and a median of six re-ranked them by chance.
 */
export const COMPARISON_SEEDS: readonly string[] = Array.from(
  { length: 200 },
  (_, i) => `crn-${i}`,
);

/** One arm — undefended, or the same scenario with one mitigation running. */
export interface ArmOutcome {
  /** Null for the baseline arm. */
  readonly defense: string | null;
  readonly label: string;
  /** What the mitigation costs per tick, in the pack's own cost unit. */
  readonly costPerTick: number;
  /** Harm in each seed, in seed order, so a reader can see the spread itself. */
  readonly harm: readonly number[];
  readonly mean: number;
  readonly median: number;
  readonly best: number;
  readonly worst: number;
  /** Seeds where this arm came out better than the baseline did on that seed. */
  readonly beatBaseline: number;
  /** Seeds where it made no difference at all. */
  readonly tiedBaseline: number;
  /** Seeds where it came out worse. */
  readonly lostToBaseline: number;
  /** Mean of (this arm − baseline) per seed, 95% seed bootstrap. Null for the baseline. */
  readonly changeVsBaseline: Interval | null;
  /**
   * Mean of (this arm − the next arm down the ranking) per seed. An interval
   * that spans 0 means the seeds cannot tell the two apart. Null for the last
   * arm and the baseline.
   */
  readonly vsNext: Interval | null;
}

export interface ArmComparison {
  readonly pack: string;
  readonly harmUnit: string;
  readonly tickUnit: string;
  /** The actor the arms were measured against, and why it was chosen. */
  readonly actorId: string;
  readonly actorLabel: string;
  readonly seeds: readonly string[];
  readonly baseline: ArmOutcome;
  readonly defended: readonly ArmOutcome[];
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Mean paired difference a − b over shared seeds, with a 95% seed bootstrap. */
function pairedChange(
  a: readonly number[],
  b: readonly number[],
  seed: string,
): Interval | null {
  return stratifiedBootstrap(
    a.map((value, i) => value - b[i]!),
    { stratumOf: () => "seeds", statistic: mean, seed },
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

/**
 * Total harm from one fast-kernel run.
 *
 * Reads it off the stream rather than the return value for the same reason the
 * preset suite does: what is measured should be what a reader is shown.
 */
export async function harmFor(
  pack: string,
  actorId: string,
  defense: string | null,
  seed: string,
  profilePath?: string,
): Promise<number> {
  const chunks: string[] = [];
  await runSimulate({
    pack,
    actors: [actorId],
    respondents: [],
    seed,
    defense,
    tickDelayMs: 0,
    stream: true,
    profilePath,
    write: (line) => chunks.push(line),
  });

  for (const line of chunks.join("").split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as { type: string; totalHarm?: number };
    if (event.type === "run_finished") return event.totalHarm ?? 0;
  }
  return 0;
}

/**
 * The actor this pack's mitigations are worth measuring against.
 *
 * The one that does the most mean damage undefended. Chosen by measurement rather
 * than named in a constant so it cannot quietly stop being true — a mitigation
 * ranked against an actor that stopped being the worst case is a ranking of the
 * wrong thing.
 */
export async function worstActorFor(
  pack: string,
  actorIds: readonly string[],
  seeds: readonly string[],
  profilePath?: string,
): Promise<string> {
  let worst = actorIds[0]!;
  let worstHarm = -1;

  for (const actorId of actorIds) {
    const harms = await Promise.all(
      seeds.map((seed) => harmFor(pack, actorId, null, seed, profilePath)),
    );
    const score = mean(harms);
    if (score > worstHarm) {
      worstHarm = score;
      worst = actorId;
    }
  }
  return worst;
}

export interface CompareArmsOptions {
  readonly pack: string;
  readonly actorId: string;
  readonly actorLabel: string;
  readonly seeds: readonly string[];
  readonly profilePath?: string;
}

/** Replay every arm of one pack across the same seeds. */
export async function compareArms(
  options: CompareArmsOptions,
): Promise<ArmComparison> {
  const { pack, actorId, actorLabel, seeds, profilePath } = options;
  const situation = getPack(pack);

  const summarise = async (
    defense: string | null,
    label: string,
    costPerTick: number,
    baselineHarm: readonly number[] | null,
  ): Promise<ArmOutcome> => {
    const harm = await Promise.all(
      seeds.map((seed) => harmFor(pack, actorId, defense, seed, profilePath)),
    );
    const against = (compare: (value: number, base: number) => boolean) =>
      baselineHarm
        ? harm.filter((value, index) => compare(value, baselineHarm[index]!))
            .length
        : 0;
    return {
      defense,
      label,
      costPerTick,
      harm,
      mean: mean(harm),
      median: median(harm),
      best: Math.min(...harm),
      worst: Math.max(...harm),
      // Ties are neither wins nor losses: a mitigation that changed nothing on
      // a seed did not beat the baseline there, and did not lose to it either.
      beatBaseline: against((v, b) => v < b),
      tiedBaseline: against((v, b) => v === b),
      lostToBaseline: against((v, b) => v > b),
      changeVsBaseline: baselineHarm
        ? pairedChange(harm, baselineHarm, `${pack}/${defense}/baseline`)
        : null,
      vsNext: null,
    };
  };

  const baseline = await summarise(null, "no mitigation", 0, null);

  const defended: ArmOutcome[] = [];
  for (const defense of situation.defenses) {
    defended.push(
      await summarise(
        defense.kind,
        defense.label,
        defense.costPerTick,
        baseline.harm,
      ),
    );
  }

  return {
    pack,
    harmUnit: situation.oracle.harmUnit,
    tickUnit: situation.tickUnit,
    actorId,
    actorLabel,
    seeds: [...seeds],
    baseline,
    // Lowest mean harm first — the ordering a defender reads down.
    defended: [...defended]
      .sort((a, b) => a.mean - b.mean)
      .map((arm, i, ranked) => {
        const next = ranked[i + 1];
        return next
          ? {
              ...arm,
              vsNext: pairedChange(
                arm.harm,
                next.harm,
                `${pack}/${arm.defense}/${next.defense}`,
              ),
            }
          : arm;
      }),
  };
}
