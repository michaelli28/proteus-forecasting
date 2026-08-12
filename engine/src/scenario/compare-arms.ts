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
 * What this deliberately does NOT report is a single "harm avoided" figure.
 * Averaging over the seeds would reproduce the error the preset was built to
 * expose — a mean hides that the same mitigation helps in four worlds and hurts
 * in two, and a defender who buys on the mean is buying a coin flip they were
 * told was a discount.
 */

import { getPack } from "./packs/index.js";
import { runSimulate } from "../simulate.js";

/** One arm — undefended, or the same scenario with one mitigation running. */
export interface ArmOutcome {
  /** Null for the baseline arm. */
  readonly defense: string | null;
  readonly label: string;
  /** What the mitigation costs per tick, in the pack's own cost unit. */
  readonly costPerTick: number;
  /** Harm in each seed, in seed order, so a reader can see the spread itself. */
  readonly harm: readonly number[];
  readonly median: number;
  readonly best: number;
  readonly worst: number;
  /** Seeds where this arm came out better than the baseline did on that seed. */
  readonly beatBaseline: number;
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
 * The one that does the most damage undefended. Chosen by measurement rather
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
    const score = median(harms);
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
    return {
      defense,
      label,
      costPerTick,
      harm,
      median: median(harm),
      best: Math.min(...harm),
      worst: Math.max(...harm),
      // Ties are not wins: a mitigation that changed nothing on a seed did not
      // beat the baseline there, and counting it as a win would inflate every
      // measure against a pack where most seeds produce no harm at all.
      beatBaseline: baselineHarm
        ? harm.filter((value, index) => value < baselineHarm[index]!).length
        : 0,
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
    // Best median first — the ordering a defender reads down.
    defended: defended.sort((a, b) => a.median - b.median),
  };
}
