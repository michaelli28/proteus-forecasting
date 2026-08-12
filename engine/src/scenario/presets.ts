/**
 * Configurations worth showing someone who has ten minutes.
 *
 * WHY THIS EXISTS. The run controls expose every knob the engine has, which is
 * correct and useless as a first contact: a reader who does not already know
 * which of nine actors, three scenarios and five mitigations produce a result
 * worth looking at will pick a combination that produces a flat run, and
 * conclude the model has nothing to say. It usually does have something to say.
 * They just did not know where to stand.
 *
 * So each preset below is a question, a configuration that answers it, and the
 * answer — and the answer is not editorial. `expect` states what the fast kernel
 * must actually produce, and `tests/scenario/presets.test.ts` runs every preset
 * across a fixed seed set and fails if it does not. A preset whose claim stops
 * being true breaks the build rather than quietly misleading a reader, which is
 * the only arrangement under which a curated demo is safe to ship.
 *
 * `watchFor` is deliberately NOT asserted. It describes what the councils tend
 * to surface, and councils are language-model judgement that varies run to run;
 * writing it as prose the reader can check for themselves is honest, and
 * asserting it would be a test that fails for being right about the wrong thing.
 */

import { getPack, PACK_IDS } from "./packs/index.js";
import type { DoctrineLibrary } from "../actors/library.js";

/**
 * What the fast kernel must produce for the preset's claim to hold.
 *
 * Every field is checked across a set of seeds, not one, so a claim cannot ride
 * on a lucky world. A preset that only holds on the seed it ships with is a
 * screenshot, not a finding.
 */
export interface PresetExpectation {
  /** Actor id → the fewest activations it must reach. */
  readonly actsAtLeast?: Readonly<Record<string, number>>;
  /** Actors that must never act. The whole point of several presets. */
  readonly neverActs?: readonly string[];
  /** Ladder rungs that must appear among the chosen moves. */
  readonly rungsUsed?: readonly string[];
  /** The fewest acts a responder must attribute. */
  readonly attributedAtLeast?: number;
  /** Exact number of moves removed by a commitment before scoring. */
  readonly movesBlocked?: number;
  /**
   * Total harm must differ by at least this factor between the best and worst
   * seed. Set where the finding IS the spread — where one world cannot tell you
   * whether something worked.
   */
  readonly harmSpreadAtLeast?: number;
}

export interface ScenarioPreset {
  readonly id: string;
  /** The question this configuration answers, in a reader's words. */
  readonly question: string;
  /** What the run shows. Stated as fact because `expect` below enforces it. */
  readonly finding: string;
  /** What the deliberation tends to surface. Judgement, so never asserted. */
  readonly watchFor: string;
  readonly pack: string;
  readonly actors: readonly string[];
  readonly respondents: readonly string[];
  readonly defense: string | null;
  /** The seed the button loads. The claim holds across many; this is one. */
  readonly seed: string;
  /** Whether this preset only makes its point with councils convened. */
  readonly needsDeliberation: boolean;
  readonly expect: PresetExpectation;
}

/**
 * The seeds every preset's claim is checked against.
 *
 * Six rather than one because three of these findings were written from a
 * three-seed sample that turned out to be wrong at six — the mitigation preset
 * below says what it says because the extra seeds contradicted the first draft.
 */
export const PRESET_VERIFICATION_SEEDS = [
  "proteus",
  "atlas",
  "meridian",
  "beacon",
  "kestrel",
  "orpheus",
] as const;

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: "identity-decides",
    question: "Does it matter which attacker you are up against?",
    finding:
      "Russia and China get the same grid, the same access, the same options and the same ladder of escalation. Russia attacks six times. China never once finds a move worth making in a hundred and eighty days — every option costs it more in law and allies than it gains. They are given the same capability here, so nothing about capability separates them — only what each one weighs.",
    watchFor:
      "China holds a council too — its own officials, at the step it came closest to attacking — so both sides answer the same question about the same grid. Open one official from each and compare the reasons they give.",
    pack: "regional-grid",
    actors: ["russia", "china"],
    respondents: [],
    defense: null,
    seed: "atlas",
    needsDeliberation: false,
    expect: {
      actsAtLeast: { russia: 4 },
      neverActs: ["china"],
      movesBlocked: 0,
    },
  },
  {
    id: "commitment-the-arithmetic-misses",
    question:
      "Can the calculation see a red line the attacker set for itself that would actually stop this?",
    finding:
      "Russia has one red line: never admit it did this. The calculation does enforce that red line. But no move in any scenario shipped here is traced back to Russia clearly enough to count as breaking it, so the red line never removes a single move. The calculation runs as if the red line were not there, and Russia attacks.",
    watchFor:
      "Russia's documented procedure includes an official who has to sign off, and whose whole job is keeping that denial intact. Watch for councils turning down steps the calculation approved, then open that official: it is weighing the risk of being blamed for using access nobody knows it has — a cost the calculation never manages to charge.",
    pack: "regional-grid",
    actors: ["russia"],
    respondents: [],
    defense: null,
    seed: "atlas",
    needsDeliberation: true,
    expect: {
      actsAtLeast: { russia: 4 },
      movesBlocked: 0,
    },
  },
  {
    id: "one-world-cannot-tell-you",
    question: "Did the defense work?",
    finding:
      "Credential rotation — regularly changing passwords and keys — is bought against the attacker that does the most damage to this grid. Across replays of the same situation, that same defense lands anywhere from no harm at all to more harm than having no defense. How much the result changes between replays is larger than the effect being measured.",
    watchFor:
      "Look at the worlds panel before anything else. Take any single number out of one of those worlds and it would let you say, confidently, the opposite of the world beside it — which is the whole argument for replaying.",
    pack: "regional-grid",
    actors: ["criminal-syndicate"],
    respondents: [],
    defense: "credential-rotation",
    seed: "proteus",
    needsDeliberation: false,
    expect: {
      harmSpreadAtLeast: 3,
      movesBlocked: 0,
    },
  },
  {
    id: "the-target-nobody-declines",
    question: "What kind of target does no attacker walk away from?",
    finding:
      "Four of the nine attackers refuse the power grid outright. Against benefits delivery every one of them attacks, and they all settle on the same move. It is not an outage. It is silent determination drift: the system stays up and quietly starts giving people the wrong answers. The worst case here never looks like a failure.",
    watchFor:
      "How the councils argue about a move that sets off no alarm. The officials who have to sign off on a visible attack have much less to say about one nobody notices.",
    pack: "benefits-delivery",
    actors: ["russia", "criminal-syndicate"],
    respondents: [],
    defense: null,
    seed: "atlas",
    needsDeliberation: false,
    expect: {
      actsAtLeast: { russia: 2, "criminal-syndicate": 2 },
      rungsUsed: ["silent_determination_drift"],
    },
  },
  {
    id: "the-one-that-gets-caught",
    question: "Who gets named, and who gets away with it?",
    finding:
      "A hacktivist group works the grid while a third party watches for attacks it can trace back to someone. The hacktivists are named every time. The criminal syndicate, which does more damage in the same scenario, is never once traced back — it picks the moves that hide. Getting caught here is a choice, not bad luck.",
    watchFor:
      "The officials who weigh the risk of being blamed for it. For a group whose whole purpose is claiming the attack, being blamed is not the cost the other profiles treat it as — read how its council weighs it.",
    pack: "regional-grid",
    actors: ["hacktivist"],
    respondents: ["us"],
    defense: null,
    seed: "meridian",
    needsDeliberation: false,
    expect: {
      actsAtLeast: { hacktivist: 3 },
      attributedAtLeast: 1,
    },
  },
];

export class PresetError extends Error {}

export function getPreset(id: string): ScenarioPreset {
  const preset = SCENARIO_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new PresetError(
      `no preset "${id}"; have ${SCENARIO_PRESETS.map((p) => p.id).join(", ")}`,
    );
  }
  return preset;
}

/**
 * Reject a preset that names something the engine does not have.
 *
 * Run at manifest build and in the suite. A curated configuration is the one
 * kind of content that silently rots — an actor id renamed six months from now
 * leaves a button that produces a stack trace, and the failure surfaces in front
 * of whoever the demo was for.
 */
export function validatePresets(
  library: DoctrineLibrary,
  presets: readonly ScenarioPreset[] = SCENARIO_PRESETS,
): void {
  const seen = new Set<string>();

  for (const preset of presets) {
    if (seen.has(preset.id)) {
      throw new PresetError(`duplicate preset id "${preset.id}"`);
    }
    seen.add(preset.id);

    if (!PACK_IDS.includes(preset.pack)) {
      throw new PresetError(
        `preset ${preset.id}: no scenario pack "${preset.pack}"`,
      );
    }
    const pack = getPack(preset.pack);

    if (preset.actors.length === 0) {
      throw new PresetError(`preset ${preset.id}: needs at least one actor`);
    }
    for (const id of [...preset.actors, ...preset.respondents]) {
      if (!library.has(id)) {
        throw new PresetError(`preset ${preset.id}: no profile "${id}"`);
      }
    }

    if (
      preset.defense &&
      !pack.defenses.some((defense) => defense.kind === preset.defense)
    ) {
      throw new PresetError(
        `preset ${preset.id}: pack ${preset.pack} has no defense "${preset.defense}"`,
      );
    }

    const rungIds = new Set(pack.ladder.map((rung) => rung.id));
    for (const rung of preset.expect.rungsUsed ?? []) {
      if (!rungIds.has(rung)) {
        throw new PresetError(
          `preset ${preset.id}: pack ${preset.pack} has no rung "${rung}"`,
        );
      }
    }

    // An expectation naming an actor that is not in the run can never fail, so
    // it would sit in the file reading like a check while checking nothing.
    const cast = new Set(preset.actors);
    for (const id of [
      ...Object.keys(preset.expect.actsAtLeast ?? {}),
      ...(preset.expect.neverActs ?? []),
    ]) {
      if (!cast.has(id)) {
        throw new PresetError(
          `preset ${preset.id}: expectation names "${id}", who is not cast in the run`,
        );
      }
    }

    if (
      preset.expect.attributedAtLeast !== undefined &&
      preset.respondents.length === 0
    ) {
      throw new PresetError(
        `preset ${preset.id}: expects attribution but casts nobody to attribute`,
      );
    }
  }
}
