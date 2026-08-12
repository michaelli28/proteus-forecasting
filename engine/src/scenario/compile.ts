/**
 * Turning an evaluator's description of a situation into something runnable.
 *
 * The worked packs prove the engine generalizes across domains. They do not
 * prove it generalizes on DEMAND, which is the thing an evaluator actually
 * wants: describe a situation in a sentence, get a model of it. That is what
 * this does.
 *
 * The compiler is the least trustworthy component in the system and is built to
 * be treated that way. A language model writing a scenario can invent an asset
 * with no dependency declared, a ladder whose top rung is milder than its
 * bottom, an actor that can reach a rung the ladder does not contain, or a
 * plausible-sounding system that does not exist. So nothing it emits is trusted:
 * the output passes the Zod schema, then `buildScenario`, then a set of
 * coherence checks below that no schema can express — and any failure is fed
 * back for repair rather than quietly patched.
 *
 * THE SCOPE BOUNDARY IS RESTATED AT THIS LAYER because this is the only layer a
 * model writes. The spec format has no field for a technique, a vulnerability,
 * or a real organisation, so a compiled scenario cannot contain one; the prompt
 * says so as well, since a model that tries and fails is better than a model
 * that tries.
 */

import { z } from "zod";

import { completeStructured } from "../llm/structured.js";
import type { LlmClient } from "../llm/client.js";
import { buildScenario, ScenarioSpecSchema } from "./spec.js";
import type { SituationSpec } from "./spec.js";
import type { DoctrineLibrary } from "../actors/library.js";
import type { EvidenceRef } from "../evidence/types.js";

/** The compiler writes a situation. Actors are cast from the library after. */
const SituationSchema = ScenarioSpecSchema.omit({
  actors: true,
  respondents: true,
});

export const CompiledScenarioSchema = z.object({
  situation: SituationSchema,
  /** Which library actors plausibly contest this system, and why. */
  suggestedActors: z
    .array(
      z.object({
        profileId: z.string().min(1),
        reasoning: z.string().min(1),
      }),
    )
    .min(1),
  /** What the compiler had to assume because the request did not say. */
  assumptions: z.array(z.string()).default([]),
  /** What it could not model, and what that omission does to the result. */
  limitations: z.array(z.string()).default([]),
});

export type CompiledScenario = z.infer<typeof CompiledScenarioSchema>;

export class CompilerError extends Error {}

export interface CompileOptions {
  readonly client: LlmClient;
  readonly library: DoctrineLibrary;
  /** The evaluator's description, in their own words. */
  readonly request: string;
  /** Retrieved documents to ground the situation in, with provenance. */
  readonly evidence?: readonly EvidenceRef[];
  readonly maxAttempts?: number;
  readonly onRetry?: (attempt: number, reason: string) => void;
}

export interface CompileResult {
  readonly compiled: CompiledScenario;
  /**
   * The compiled situation, with nobody cast in it yet.
   *
   * A SituationSpec rather than a ScenarioSpec on purpose: the compiler
   * describes a SYSTEM, and who contests it is a separate decision the evaluator
   * makes from the actor library. `suggestedActors` is a recommendation, not a
   * casting.
   */
  readonly situation: SituationSpec;
  readonly attempts: number;
  /** Coherence problems found and repaired, kept for the record. */
  readonly repairs: readonly string[];
}

function systemPrompt(library: DoctrineLibrary): string {
  const actors = library.profiles
    .map((profile) => `  - ${profile.id} (${profile.kind}): ${profile.label}`)
    .join("\n");

  return `You compile a plain-language description of a contested system into a runnable simulation specification.

WHAT YOU ARE MODELLING. An adversary that already holds some access to a system chooses WHICH asset to affect, at WHAT rung of an escalation ladder, held for HOW LONG. A defender buys mitigations that change those choices. You are describing the decision space, not an attack.

HARD SCOPE BOUNDARY. Your output must contain NO technique, exploit, protocol, credential, payload, command sequence, vendor, product name, firmware version, network address, or real organisation, facility, or person. There is no field for any of these. Asset ids are opaque scenario-local labels like "SUB-URBAN-A" or "CLEARING-NODE-2". Effect kinds name a CONSEQUENCE ("supply_interrupted", "settlement_delayed"), never an action a person could take. If the request names a real facility, model a synthetic system of the same CLASS and say so in assumptions.

THE LADDER. Rungs ascend in severity and the array order IS the severity order. The first rung must be the null rung: id "none", statement "no action taken", all numbers 0, reversible true. Then rungs of increasing consequence. Each rung declares:
  - attributability: how likely the act is traced to whoever ordered it [0,1]
  - visibility: how visible the EFFECT is to the public and third parties [0,1]
  - civilianHarmShare: how much of the harm falls on noncombatants [0,1]
  - durationHours: hours of effect (0 for a pure signalling rung)
  - reversible: can the defender undo it unaided
  - legitimacyCost: the legal and reputational price of being the actor that did it [0,1]

Attributability and visibility are DIFFERENT. An outage everyone sees may still be unattributable, and that gap is what a deniability-seeking actor buys. A high-consequence, low-visibility rung is often the most dangerous one in a system, because nothing stops it — duration is set by when someone notices rather than by recovery. Include one where the domain admits it.

ASSETS. Every asset needs parametric properties, because the consequence oracle prices harm from them:
  - unitsDependent: units losing service when this asset is affected
  - immediateLossShare: share that lose service at once [0,1]
  - bufferHours: hours of reserve before loss begins
  - recoveryTailHours: hours of degraded service AFTER the effect ends
  - redundancy: share of load another asset absorbs [0,1]
An asset whose harm is mostly a long recovery tail (records, data integrity, scheduling) is exactly the kind a direct-harm ranking underrates. Include one if the domain has one.

servedUnits at the top level is the DISTINCT total the system serves. Do NOT make it the sum of the assets — assets overlap, and summing them inflates it and makes the whole model inert.

DEFENCES. Three or four candidate mitigations, all at the SAME coverage (0.6) so their ROI is comparable. Each acts through one or more of exactly four channels:
  - access_denial          — slows gaining new access
  - holding_attrition      — raises the chance existing access is lost
  - attribution_pressure   — raises attributability, deterring exposure-averse actors
  - consequence_limiting   — shortens an effect once it starts, without evicting anyone
A mitigation that maps to none of these has no modelled mechanism and must not be included.

AVAILABLE ACTORS — suggest from this list only, by id:
${actors}

BE HONEST IN assumptions AND limitations. Anything you invented because the request did not specify goes in assumptions. Anything the model cannot represent, and what that does to the result, goes in limitations. An evaluator reads these before the numbers.

Return ONLY valid JSON matching the schema. No prose, no code fences.`;
}

function userPrompt(
  request: string,
  evidence: readonly EvidenceRef[] | undefined,
): string {
  const grounding =
    evidence && evidence.length > 0
      ? `\n\nGROUND THE SITUATION IN THESE RETRIEVED SOURCES. Use them for scale, structure, and dependency; do not copy identifying details of any real facility into the spec.\n\n${evidence
          .map(
            (ref, index) =>
              `[${index + 1}] ${ref.sourceId} (${ref.publishedAt}) — ${ref.excerpt}`,
          )
          .join("\n")}`
      : "";

  return `Compile this into a runnable scenario specification.

REQUEST:
${request}${grounding}`;
}

/**
 * Coherence checks no schema can express.
 *
 * Each returns a repair instruction rather than a boolean, because the failure
 * is handed straight back to the model. "invalid" teaches it nothing; "your
 * ladder's rung 3 has a lower civilianHarmShare than rung 2" teaches it exactly
 * what to change.
 */
export function coherenceProblems(situation: SituationSpec): string[] {
  const problems: string[] = [];

  const first = situation.ladder[0];
  if (!first || first.id !== "none" || first.durationHours !== 0) {
    problems.push(
      'The ladder must begin with the null rung: id "none", durationHours 0.',
    );
  }

  // Severity must actually ascend, or the ordinal measure is meaningless.
  const consequential = situation.ladder.filter(
    (rung) => rung.durationHours > 0,
  );
  for (let i = 1; i < consequential.length; i++) {
    if (consequential[i]!.durationHours < consequential[i - 1]!.durationHours) {
      problems.push(
        `Rung "${consequential[i]!.id}" has a shorter durationHours than "${consequential[i - 1]!.id}" but sits above it. Rungs must ascend in severity.`,
      );
      break;
    }
  }

  if (situation.ladder.length < 3) {
    problems.push(
      "The ladder needs the null rung plus at least two real rungs, or the actor has no escalation decision to make.",
    );
  }

  const missingParametric = situation.assets.filter(
    (asset) => !asset.parametric,
  );
  if (missingParametric.length > 0) {
    problems.push(
      `These assets declare no parametric properties and would price as harmless: ${missingParametric
        .map((asset) => asset.id)
        .join(", ")}.`,
    );
  }

  const largest = Math.max(
    0,
    ...situation.assets.map((asset) => asset.servedUnits),
  );
  if (situation.servedUnits < largest) {
    problems.push(
      `servedUnits (${situation.servedUnits}) is smaller than the largest single asset (${largest}). It must be the distinct total the whole system serves.`,
    );
  }

  const summed = situation.assets.reduce(
    (total, asset) => total + asset.servedUnits,
    0,
  );
  if (situation.assets.length > 1 && situation.servedUnits === summed) {
    problems.push(
      "servedUnits equals the sum of the assets, which double-counts overlapping service areas. Use the distinct total the system serves.",
    );
  }

  if (situation.defenses.length < 2) {
    problems.push(
      "At least two candidate mitigations are needed, or there is nothing to compare and no ROI to report.",
    );
  }

  return problems;
}

/**
 * Compile a request into a runnable scenario.
 *
 * Repairs are bounded. A compiler that retries indefinitely against a model that
 * cannot satisfy the constraints burns budget and eventually ships whatever
 * happened to pass, so this throws with the outstanding problems instead — an
 * evaluator can then fix the spec by hand, which is why the spec is JSON.
 */
export async function compileScenario(
  options: CompileOptions,
): Promise<CompileResult> {
  const { client, library, request } = options;
  const maxAttempts = options.maxAttempts ?? 3;
  const repairs: string[] = [];

  let prompt = userPrompt(request, options.evidence);
  let attempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await completeStructured(
      client,
      { system: systemPrompt(library), prompt, maxTurns: 1 },
      {
        schema: CompiledScenarioSchema,
        maxAttempts: 2,
        onRetry: options.onRetry,
      },
    );
    attempts += result.attempts;

    const compiled = result.value;
    const problems = coherenceProblems(compiled.situation);

    const unknownActors = compiled.suggestedActors.filter(
      (entry) => !library.has(entry.profileId),
    );
    if (unknownActors.length > 0) {
      problems.push(
        `These suggested actors are not in the library: ${unknownActors
          .map((entry) => entry.profileId)
          .join(", ")}. Use only the listed ids.`,
      );
    }

    if (problems.length === 0) {
      // Cast the suggested actors and build it, which is the only check that
      // exercises the same code path a run does.
      assertRunnable(
        compiled.situation,
        library,
        compiled.suggestedActors.map((entry) => entry.profileId),
      );
      return { compiled, situation: compiled.situation, attempts, repairs };
    }

    repairs.push(...problems);
    if (attempt === maxAttempts - 1) {
      throw new CompilerError(
        `the compiled scenario did not become coherent in ${maxAttempts} attempts. Outstanding:\n  - ${problems.join("\n  - ")}\n\nThe spec is JSON — fix it by hand and run it directly.`,
      );
    }
    prompt = `${userPrompt(request, options.evidence)}

Your previous attempt had these problems. Fix ALL of them and return the corrected JSON:
  - ${problems.join("\n  - ")}`;
  }

  throw new CompilerError("compiler exhausted its attempts");
}

/**
 * Validate a compiled situation by actually building it.
 *
 * The last check, and the only one that exercises the same code path a run
 * does: cross-references, oracle construction, and every fail-closed guard in
 * `validateScenario`.
 */
export function assertRunnable(
  situation: SituationSpec,
  library: DoctrineLibrary,
  actorIds: readonly string[],
): void {
  buildScenario(
    {
      ...situation,
      actors: actorIds.map((profileId) => ({
        profileId,
        initialHoldingsMean: 2,
        initialHoldingsSd: 1,
        acquisitionHazard: 0.012,
        holdingValueDecay: 0.001,
        payoffBase: 0.25,
        payoffDrift: 0.0035,
        earliestActivationTick: 10,
        reachableRungs: situation.ladder
          .filter((rung) => rung.id !== "none")
          .map((rung) => rung.id),
      })),
      respondents: [],
    },
    { library },
  );
}
