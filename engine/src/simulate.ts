/**
 * Running one scenario from the command line, watchably.
 *
 * Two output modes over one stream. `--stream` emits the raw NDJSON the
 * dashboard consumes; the default renders the same events for a terminal. They
 * are the same events in the same order — the pretty view is a rendering, not a
 * summary, so nothing appears on screen that a consumer of the stream could not
 * also see, and nothing is quietly dropped.
 *
 * The default casting parameters below are NOT doctrine. How much access an
 * actor already holds and how fast it gains more are properties of a situation
 * and of collection, not of a strategic culture, and putting them in the profile
 * would let a number nobody has measured ride along with numbers that are
 * sourced. They are stated here, in one place, as scenario defaults an evaluator
 * is expected to replace with their own figures.
 */

import { loadDoctrineLibrary } from "./actors/library.js";
import type { DoctrineLibrary } from "./actors/library.js";
import { getPack, PACK_IDS } from "./scenario/packs/index.js";
import { buildScenario, castScenario } from "./scenario/spec.js";
import type { ActorSpec, DefenseSpec } from "./scenario/spec.js";
import { runScenario } from "./scenario/run.js";
import { runDeep } from "./scenario/deep-run.js";
import { createAnthropicClient } from "./llm/anthropic.js";
import type { LlmClient } from "./llm/client.js";
import { createJsonlObserver } from "./observe/stream.js";
import type { RunEvent, RunObserver } from "./observe/stream.js";

/**
 * Casting defaults.
 *
 * `initialHoldingsMean` is the parameter only privileged reporting can set, and
 * a defensible run states what it assumed rather than burying it.
 */
export const DEFAULT_CASTING = {
  initialHoldingsMean: 2,
  initialHoldingsSd: 1,
  acquisitionHazard: 0.012,
  holdingValueDecay: 0.001,
  payoffBase: 0.25,
  payoffDrift: 0.0035,
  earliestActivationTick: 10,
} as const;

export interface SimulateOptions {
  readonly pack: string;
  readonly actors: readonly string[];
  readonly respondents: readonly string[];
  readonly seed: string;
  readonly defense: string | null;
  readonly tickDelayMs: number;
  readonly stream: boolean;
  readonly profilePath?: string;
  readonly write?: (line: string) => void;
  /**
   * Deep mode: many worlds, model-agent councils, adjudication.
   *
   * Off by default because it costs money and minutes, and because the fast path
   * is what the benchmark scores. Turning it on never changes how the kernel
   * decides — the councils are advisory — so the two modes remain the same
   * computation with different amounts of reasoning recorded around it.
   */
  readonly deep?: boolean;
  readonly branches?: number;
  readonly maxCouncilsPerBranch?: number;
  readonly councilConcurrency?: number;
  readonly judges?: number;
  readonly model?: string;
}

export interface SimulateResult {
  readonly runId: string;
  readonly activations: number;
  readonly totalHarm: number;
  readonly harmUnit: string;
  readonly evidenceClass: string;
  /** Present only for a deep run. */
  readonly deep?: {
    readonly branches: number;
    readonly councils: number;
    readonly disagreements: number;
    readonly judgements: number;
    readonly modelCalls: number;
    readonly costUsd: number;
  };
}

export async function runSimulate(
  options: SimulateOptions,
): Promise<SimulateResult> {
  const write = options.write ?? ((line: string) => process.stdout.write(line));
  const library = await loadDoctrineLibrary(options.profilePath);
  const situation = getPack(options.pack);

  const actors: ActorSpec[] = options.actors.map((profileId) =>
    castingFor(
      profileId,
      situation.ladder.map((rung) => rung.id),
      library,
    ),
  );

  const respondents = options.respondents.map((profileId) => {
    library.get(profileId);
    return {
      profileId,
      alignment: "defender_aligned" as const,
      // Acts on high-confidence attribution, not courtroom-grade proof. Below
      // this, an actor operating through surrogates escapes the term entirely.
      attributionThreshold: 0.5,
      responseCapacity: 4,
    };
  });

  const spec = castScenario(situation, actors, respondents);

  let defense: DefenseSpec | null = null;
  if (options.defense) {
    const found = situation.defenses.find((d) => d.kind === options.defense);
    if (!found) {
      throw new Error(
        `no defense "${options.defense}" in pack ${options.pack}; have ${situation.defenses
          .map((d) => d.kind)
          .join(", ")}`,
      );
    }
    defense = found;
  }

  const config = buildScenario(spec, { library, defense });

  const observers: RunObserver[] = options.stream
    ? [createJsonlObserver(write)]
    : [createTerminalObserver(write)];

  if (options.deep) {
    const deep = await runDeep({
      config,
      seed: options.seed,
      observers,
      branches: Math.max(1, options.branches ?? 6),
      client: councilClient(options.model),
      maxCouncilsPerBranch: Math.max(1, options.maxCouncilsPerBranch ?? 6),
      councilConcurrency: Math.max(1, options.councilConcurrency ?? 3),
      judges: Math.max(0, options.judges ?? 5),
    });

    return {
      runId: deep.runId,
      activations: deep.branches.reduce((sum, b) => sum + b.activations, 0),
      totalHarm: deep.branches.reduce((sum, b) => sum + b.totalHarm, 0),
      harmUnit: config.oracle.harmUnit,
      evidenceClass: config.oracle.evidenceClass,
      deep: {
        branches: deep.branches.length,
        councils: deep.councils.length,
        disagreements: deep.disagreements,
        judgements: deep.judgements.length,
        modelCalls: deep.modelCalls,
        costUsd: deep.costUsd,
      },
    };
  }

  const result = await runScenario({
    config,
    seed: options.seed,
    observers,
    tickDelayMs: options.tickDelayMs,
  });

  return {
    runId: result.runId,
    activations: result.activations,
    totalHarm: result.totalHarm,
    harmUnit: config.oracle.harmUnit,
    evidenceClass: config.oracle.evidenceClass,
  };
}

/**
 * The model backend for councils and judges, or null when none is configured.
 *
 * Returns null rather than throwing on a missing key, because a deep run without
 * a backend is still a legitimate thing to watch — it is the ensemble without
 * the deliberation — and the stream says so in as many words. Failing the whole
 * run would make an absent key look like a broken engine.
 */
function councilClient(model?: string): LlmClient | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    return createAnthropicClient(model ? { defaultModel: model } : {});
  } catch {
    return null;
  }
}

function castingFor(
  profileId: string,
  rungIds: readonly string[],
  library: DoctrineLibrary,
): ActorSpec {
  // Throws with the list of known ids if absent, which is the useful error.
  library.get(profileId);
  return {
    profileId,
    ...DEFAULT_CASTING,
    // Every rung except the null one. Capability limits are a scenario
    // judgement an evaluator should set deliberately, so the default is to let
    // doctrine rather than an unstated capability assumption do the limiting.
    reachableRungs: rungIds.filter((id) => id !== "none"),
  };
}

export { PACK_IDS };

// ─── terminal rendering ───

const DIM = "[2m";
const BOLD = "[1m";
const RESET = "[0m";
const RED = "[31m";
const YELLOW = "[33m";
const CYAN = "[36m";

/**
 * Renders the stream for a person.
 *
 * Deliberately does NOT print a line per tick. A 240-tick run that narrates
 * every quiet day buries the four events that mattered, and the whole point of
 * watching is to see the moments where the decision changed.
 */
function createTerminalObserver(write: (line: string) => void): RunObserver {
  let lastDecision = new Map<string, string>();

  return {
    emit(event: RunEvent) {
      switch (event.type) {
        case "run_started": {
          write(`\n${BOLD}${event.statement}${RESET}\n`);
          write(
            `${DIM}run ${event.runId.slice(0, 12)} · seed ${event.seed} · ${event.ticks} ${event.tickUnit}s${RESET}\n`,
          );
          write(
            `${DIM}actors: ${event.actors.map((a) => a.label).join(", ")}${RESET}\n`,
          );
          write(
            `${DIM}consequences: ${event.oracle.method} (${event.oracle.evidenceClass}), in ${event.oracle.harmUnit}${RESET}\n`,
          );
          write(`${YELLOW}${wrap(event.caveat, 78)}${RESET}\n\n`);
          break;
        }

        case "deliberation": {
          const payload = event.payload as Record<string, string>;
          const key = payload.actorId ?? "";
          const decision = payload.decision ?? "";
          // Print only when an actor's posture CHANGES. Repetition is noise.
          if (lastDecision.get(key) === decision) break;
          lastDecision.set(key, decision);

          const frame =
            payload.frame === "loss" ? `${RED}[under pressure]${RESET}` : "";
          write(
            `${DIM}${String(event.tick).padStart(4)}${RESET}  ${CYAN}${payload.actorLabel}${RESET} ${frame}\n`,
          );
          write(`      ${payload.rationale}\n`);
          break;
        }

        case "activation": {
          const payload = event.payload as Record<string, unknown>;
          write(
            `${DIM}${String(event.tick).padStart(4)}${RESET}  ${BOLD}${RED}ACTS${RESET} ${payload.actorId} → ${payload.assetId} · ${payload.rungId}\n`,
          );
          write(
            `      ${DIM}harm ${Math.round(Number(payload.harm)).toLocaleString()} · held ${payload.dwellTicks} ticks before spending · ${payload.attributed ? "attributable" : "deniable"}${RESET}\n`,
          );
          break;
        }

        case "agent_reasoning":
          write(
            `${DIM}      [${event.label}] ${truncate(event.text, 160)}${RESET}\n`,
          );
          break;

        case "stage":
          write(
            `\n${BOLD}── ${event.stage} ──${RESET} ${DIM}${event.detail}${RESET}\n`,
          );
          break;

        case "branch_opened":
          write(
            `\n${CYAN}world ${event.branchId}${RESET} ${DIM}(${event.index + 1}/${event.total}) seed ${event.seed}${RESET}\n`,
          );
          break;

        case "branch_finished":
          write(
            `${DIM}world ${event.branchId}: ${event.activations} acts · ${Math.round(event.totalHarm).toLocaleString()} harm · ${event.decisionPoints} steps worth deliberating${RESET}\n`,
          );
          break;

        case "council_opened":
          write(
            `\n${BOLD}council${RESET} ${CYAN}${event.actorLabel}${RESET} ${DIM}${event.branchId} t${event.tick} · ${event.seats.length} seats (${event.seatSource}) · ${event.trigger}${RESET}\n`,
          );
          break;

        case "seat_opinion":
          write(
            `  ${event.office} → ${BOLD}${event.recommendation}${RESET} ${DIM}· ${event.decisiveFactor}${RESET}\n`,
          );
          break;

        case "council_verdict":
          write(
            `  ${BOLD}⇒ ${event.decision}${RESET} ${
              event.agreed
                ? `${DIM}agrees with the arithmetic${RESET}`
                : `${YELLOW}DISAGREES with the arithmetic, which said ${event.kernelDecision}${RESET}`
            }\n`,
          );
          if (event.dissent)
            write(
              `  ${DIM}overruled: ${truncate(event.dissent, 150)}${RESET}\n`,
            );
          break;

        case "judgement":
          write(
            `\n${CYAN}${event.technique}${RESET} ${DIM}(confidence ${event.confidence})${RESET}\n      ${event.verdict}\n`,
          );
          break;

        // A failed agent used to render as nothing at all, which made a council
        // that never reached a verdict look like a council that was never held.
        case "agent_retry":
          write(
            `  ${DIM}[${event.label}] asked again (attempt ${event.attempt}): ${truncate(event.reason, 120)}${RESET}\n`,
          );
          break;

        case "agent_failed":
          write(`  ${RED}[${event.label}] failed: ${event.error}${RESET}\n`);
          break;

        case "run_finished": {
          write(
            `\n${BOLD}${event.activations} acts · ${Math.round(event.totalHarm).toLocaleString()} ${event.harmUnit}${RESET}\n`,
          );
          write(`${YELLOW}evidence class: ${event.evidenceClass}${RESET}\n\n`);
          break;
        }

        case "run_failed":
          write(`\n${RED}run failed: ${event.error}${RESET}\n`);
          break;
      }
    },
  };
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
