/**
 * Every curated configuration says what it will show. This checks that it does.
 *
 * The presets exist so a reader with ten minutes lands somewhere the model has
 * something to say. That is only worth doing if the sentence under the button is
 * true, and a sentence written once about a model that keeps changing is exactly
 * the kind of claim that quietly stops being true. So each preset's `finding` is
 * expressed as machine-checkable expectations and run here across six seeds — if
 * the engine drifts under a claim, this fails rather than a demo failing later.
 *
 * Six seeds, not one, because the mitigation preset was originally written from
 * three and said the opposite of what six show.
 */

import { describe, expect, it } from "vitest";
import { loadDoctrineLibrary } from "../../src/actors/library.js";
import {
  PRESET_VERIFICATION_SEEDS,
  SCENARIO_PRESETS,
  getPreset,
  validatePresets,
} from "../../src/scenario/presets.js";
import type { ScenarioPreset } from "../../src/scenario/presets.js";
import { runSimulate } from "../../src/simulate.js";

interface RunSummary {
  readonly acts: Readonly<Record<string, number>>;
  readonly rungs: ReadonlySet<string>;
  readonly attributed: number;
  readonly blocked: number;
  readonly harm: number;
}

/**
 * Run one configuration on the fast kernel and fold its stream into totals.
 *
 * Deliberately drives `runSimulate` in the same stream mode the dashboard's
 * route uses rather than reaching into the kernel directly. A preset is a
 * promise about what a reader will SEE, so it has to be checked against the
 * events a reader is shown, not against internal state they never reach.
 */
async function summarise(
  preset: ScenarioPreset,
  seed: string,
): Promise<RunSummary> {
  const chunks: string[] = [];
  await runSimulate({
    pack: preset.pack,
    actors: preset.actors,
    respondents: preset.respondents,
    seed,
    defense: preset.defense,
    tickDelayMs: 0,
    stream: true,
    write: (line) => chunks.push(line),
  });

  const acts: Record<string, number> = {};
  const rungs = new Set<string>();
  let attributed = 0;
  let blocked = 0;
  let harm = 0;

  for (const line of chunks.join("").split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as {
      type: string;
      totalHarm?: number;
      payload?: {
        actorId?: string;
        rungId?: string;
        attributed?: boolean;
        blocked?: unknown[];
      };
    };
    if (event.type === "activation" && event.payload) {
      const actorId = event.payload.actorId!;
      acts[actorId] = (acts[actorId] ?? 0) + 1;
      rungs.add(event.payload.rungId!);
      if (event.payload.attributed) attributed += 1;
    }
    if (event.type === "deliberation" && event.payload) {
      blocked += (event.payload.blocked ?? []).length;
    }
    if (event.type === "run_finished") harm = event.totalHarm ?? 0;
  }

  return { acts, rungs, attributed, blocked, harm };
}

describe("scenario presets", () => {
  it("name only packs, actors, mitigations and rungs the engine has", async () => {
    const library = await loadDoctrineLibrary();
    expect(() => validatePresets(library)).not.toThrow();
  });

  it("rejects a preset naming an actor it never casts", async () => {
    const library = await loadDoctrineLibrary();
    const broken: ScenarioPreset = {
      ...SCENARIO_PRESETS[0]!,
      expect: { neverActs: ["dprk"] },
    };
    expect(() => validatePresets(library, [broken])).toThrow(/not cast/);
  });

  it("rejects a preset expecting attribution with nobody watching", async () => {
    const library = await loadDoctrineLibrary();
    const broken: ScenarioPreset = {
      ...SCENARIO_PRESETS[0]!,
      respondents: [],
      expect: { attributedAtLeast: 1 },
    };
    expect(() => validatePresets(library, [broken])).toThrow(/attribute/);
  });

  it("carries a question, a finding and something to watch for", () => {
    for (const preset of SCENARIO_PRESETS) {
      expect(preset.question.length, `${preset.id} question`).toBeGreaterThan(
        10,
      );
      expect(preset.finding.length, `${preset.id} finding`).toBeGreaterThan(60);
      expect(preset.watchFor.length, `${preset.id} watchFor`).toBeGreaterThan(
        40,
      );
    }
  });

  it("resolves by id and refuses an unknown one", () => {
    expect(getPreset("identity-decides").pack).toBe("regional-grid");
    expect(() => getPreset("nope")).toThrow(/no preset/);
  });
});

// Each preset gets its own case so a failure names the claim that broke rather
// than reporting that "presets" failed.
describe.each(SCENARIO_PRESETS.map((preset) => [preset.id, preset] as const))(
  "preset %s holds across seeds",
  (_id, preset) => {
    it(
      preset.question,
      async () => {
        const runs = await Promise.all(
          PRESET_VERIFICATION_SEEDS.map((seed) => summarise(preset, seed)),
        );

        for (const [index, run] of runs.entries()) {
          const seed = PRESET_VERIFICATION_SEEDS[index];

          for (const [actorId, minimum] of Object.entries(
            preset.expect.actsAtLeast ?? {},
          )) {
            expect(
              run.acts[actorId] ?? 0,
              `${actorId} acts on ${seed}`,
            ).toBeGreaterThanOrEqual(minimum);
          }

          for (const actorId of preset.expect.neverActs ?? []) {
            expect(run.acts[actorId] ?? 0, `${actorId} acts on ${seed}`).toBe(
              0,
            );
          }

          for (const rung of preset.expect.rungsUsed ?? []) {
            expect([...run.rungs], `rungs on ${seed}`).toContain(rung);
          }

          if (preset.expect.attributedAtLeast !== undefined) {
            expect(
              run.attributed,
              `attributions on ${seed}`,
            ).toBeGreaterThanOrEqual(preset.expect.attributedAtLeast);
          }

          if (preset.expect.movesBlocked !== undefined) {
            expect(run.blocked, `blocked moves on ${seed}`).toBe(
              preset.expect.movesBlocked,
            );
          }
        }

        if (preset.expect.harmSpreadAtLeast !== undefined) {
          const harms = runs.map((run) => run.harm);
          const highest = Math.max(...harms);
          const lowest = Math.min(...harms);
          // A zero-harm world makes the ratio infinite, which is the strongest
          // possible form of the claim rather than an edge case to guard against.
          const spread = lowest === 0 ? Infinity : highest / lowest;
          expect(
            spread,
            `harm spread ${lowest}..${highest}`,
          ).toBeGreaterThanOrEqual(preset.expect.harmSpreadAtLeast);
        }
      },
      60_000,
    );
  },
);
