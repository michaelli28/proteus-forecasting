/**
 * A deep run — many worlds, real deliberation, adjudication at the end.
 *
 * `runScenario` executes one world in about a tenth of a second and streams what
 * happened. That is the benchmark path and it should stay that fast. This is the
 * other thing an evaluator asks for: not "what happened" but "what would this
 * institution actually have authorised, how differently could it have gone, and
 * which reading of it survives someone attacking it".
 *
 * Three stages, in order, each visible on the stream:
 *
 *   WORLDS   the same scenario replayed under different draws. Cheap, fast, and
 *            the reason a single run is never the answer — an ensemble is where
 *            the spread lives, and the spread is the finding.
 *   COUNCILS at the steps that mattered, the actor's own institutional gates
 *            deliberate as language-model agents and reach a call. Advisory: the
 *            kernel's arithmetic is never overwritten, so the run stays
 *            reproducible from its seed and the DISAGREEMENT becomes the product.
 *   JUDGES   structured analytic techniques adjudicate across the worlds, and
 *            are required to record dissent rather than converge politely.
 *
 * Everything a model was asked and everything it answered goes out on the
 * stream, raw, through `observeClient` — including the repair prompts when a
 * schema rejected an answer. A run that took eleven minutes should be able to
 * show eleven minutes of work.
 */

import { convene, moveRef, seatsFor } from "../actors/council.js";
import type { CouncilOption, CouncilVerdict } from "../actors/council.js";
import { SAT_TECHNIQUES } from "../agents/panel.js";
import { UsageLedger } from "../llm/client.js";
import type { LlmClient } from "../llm/client.js";
import { completeStructured } from "../llm/structured.js";
import { z } from "zod";
import { observeClient, RunEmitter, retryReporter } from "../observe/stream.js";
import type { RunObserver } from "../observe/stream.js";
import { mapWithConcurrency } from "../util/concurrency.js";
import type { ContestedSystemConfig } from "../sim/adapters/contested-system/config.js";
import { driveBranch, scenarioRunId, startedEvent } from "./run.js";
import type { CapturedDeliberation } from "./run.js";

export interface DeepRunOptions {
  readonly config: ContestedSystemConfig;
  readonly seed: string;
  readonly observers: readonly RunObserver[];
  /** Worlds to replay. One is legal and defeats the point. */
  readonly branches: number;
  /** Null runs the worlds and skips deliberation, saying so on the stream. */
  readonly client: LlmClient | null;
  /** Upper bound on councils per world. What it drops is logged, never silent. */
  readonly maxCouncilsPerBranch: number;
  readonly councilConcurrency: number;
  /** Adjudicators over the ensemble. Each uses a different technique. */
  readonly judges: number;
  readonly now?: () => number;
}

export interface DeepRunResult {
  readonly runId: string;
  readonly branches: readonly BranchSummary[];
  readonly councils: readonly CouncilVerdict[];
  readonly judgements: readonly Judgement[];
  readonly costUsd: number;
  readonly modelCalls: number;
  /** Councils that disagreed with the arithmetic. The headline finding. */
  readonly disagreements: number;
}

export interface BranchSummary {
  readonly branchId: string;
  readonly seed: string;
  readonly premise: string;
  readonly activations: number;
  readonly totalHarm: number;
  readonly decisionPoints: number;
}

export interface Judgement {
  readonly judgeId: string;
  readonly technique: string;
  readonly verdict: string;
  readonly reasoning: string;
  readonly confidence: string;
  readonly dissent: string;
  readonly ranking: readonly string[];
}

/** A step worth convening over, and the reason it qualified. */
interface DecisionPoint {
  readonly branchId: string;
  readonly tick: number;
  readonly actorId: string;
  readonly trigger: string;
  /** Ordering key. Lower is more interesting; the cap keeps the lowest. */
  readonly rank: number;
  readonly payload: DeliberationPayload;
}

interface DeliberationPayload {
  readonly actorId: string;
  readonly actorLabel: string;
  readonly frame: "gain" | "loss";
  readonly decision: string;
  readonly holdValue: number;
  readonly considered: readonly ScoredMovePayload[];
  readonly blocked: readonly {
    assetId: string;
    rungId: string;
    redlineStatement: string;
  }[];
  readonly chosen: ScoredMovePayload | null;
}

interface ScoredMovePayload {
  readonly assetId: string;
  readonly rungId: string;
  readonly total: number;
  readonly payoff: number;
  readonly attributionCost: number;
  readonly legitimacyCost: number;
  readonly civilianHarmCost: number;
  readonly retaliationCost: number;
}

export async function runDeep(options: DeepRunOptions): Promise<DeepRunResult> {
  const { config, seed, observers, branches } = options;
  const emitter = new RunEmitter(observers, options.now);
  const ledger = new UsageLedger();
  const runId = scenarioRunId(config, seed);

  emitter.emit(startedEvent(runId, config, seed));

  try {
    // ── worlds ──
    emitter.emit({
      type: "stage",
      stage: "worlds",
      detail: `replaying the same situation ${branches} times under different draws`,
    });

    const summaries: BranchSummary[] = [];
    const points: DecisionPoint[] = [];

    for (let index = 0; index < branches; index++) {
      const branchId = `w${index + 1}`;
      const branchSeed = branches === 1 ? seed : `${seed}:${branchId}`;
      const premise =
        index === 0
          ? "the reference world"
          : "the same situation, a different draw of who gains access when, and of which option a boundedly-rational actor picks";

      emitter.emit({
        type: "branch_opened",
        branchId,
        seed: branchSeed,
        premise,
        index,
        total: branches,
      });

      const branch = await driveBranch({
        emitter,
        config,
        seed: branchSeed,
        branchId,
      });

      const found = decisionPoints(branchId, branch.deliberations);
      points.push(...found);
      summaries.push({
        branchId,
        seed: branchSeed,
        premise,
        activations: branch.activations,
        totalHarm: branch.totalHarm,
        decisionPoints: found.length,
      });

      emitter.emit({
        type: "branch_finished",
        branchId,
        activations: branch.activations,
        totalHarm: branch.totalHarm,
        decisionPoints: found.length,
      });
    }

    // ── councils ──
    const { kept, dropped } = capPerBranch(
      points,
      options.maxCouncilsPerBranch,
    );

    if (!options.client) {
      emitter.emit({
        type: "stage",
        stage: "councils",
        detail:
          "skipped — no model backend was configured, so no institution deliberated. " +
          "Everything above is the arithmetic kernel alone.",
      });
    } else {
      emitter.emit({
        type: "stage",
        stage: "councils",
        detail:
          `convening ${kept.length} councils across ${branches} worlds` +
          (dropped > 0
            ? ` — ${dropped} further qualifying steps were left out by the per-world cap of ${options.maxCouncilsPerBranch}`
            : ""),
      });
    }

    const councils = options.client
      ? await runCouncils(kept, options, emitter, ledger, config)
      : [];

    // ── judges ──
    const judgements =
      options.client && options.judges > 0
        ? await runJudges(options, emitter, ledger, summaries, councils, config)
        : [];

    if (options.client && options.judges > 0 && judgements.length === 0) {
      emitter.emit({
        type: "stage",
        stage: "judges",
        detail:
          "no judge returned a usable verdict — the ensemble stands unadjudicated",
      });
    }

    const disagreements = councils.filter((council) => !council.agreed).length;

    emitter.emit({
      type: "run_finished",
      runId,
      ticks: config.ticks,
      activations: summaries.reduce((sum, entry) => sum + entry.activations, 0),
      totalHarm: summaries.reduce((sum, entry) => sum + entry.totalHarm, 0),
      harmUnit: config.oracle.harmUnit,
      evidenceClass: config.oracle.evidenceClass,
    });

    return {
      runId,
      branches: summaries,
      councils,
      judgements,
      costUsd: ledger.totalCostUsd,
      modelCalls: ledger.callCount,
      disagreements,
    };
  } catch (error) {
    emitter.emit({
      type: "run_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ─── choosing where to convene ───

/** Fraction within which waiting and acting count as a near-tie. */
const NEAR_TIE = 0.05;

/**
 * The steps worth a council.
 *
 * Convening on every tick would be honest and unaffordable — 180 days times four
 * actors times six seats is thousands of model calls for a run whose interesting
 * moments number in the dozens. So the filter picks the steps where a human
 * reviewer would also stop: the institution acted, its own commitments emptied
 * the table, its framing flipped, or waiting and acting were within a hair of
 * each other. Everything else is a quiet day, and a quiet day deliberated at
 * length is cost without information.
 */
export function decisionPoints(
  branchId: string,
  deliberations: readonly CapturedDeliberation[],
): DecisionPoint[] {
  const points: DecisionPoint[] = [];
  const lastFrame = new Map<string, string>();
  const actorsSeen = new Set<string>();
  const nearest = new Map<
    string,
    { entry: CapturedDeliberation; gap: number }
  >();

  for (const entry of deliberations) {
    const payload = entry.payload as unknown as DeliberationPayload;
    const actorId = payload.actorId;
    if (!actorId) continue;

    const previousFrame = lastFrame.get(actorId);
    lastFrame.set(actorId, payload.frame);
    actorsSeen.add(actorId);

    const best = payload.considered?.[0];
    const add = (trigger: string, rank: number): void => {
      points.push({
        branchId,
        tick: entry.tick,
        actorId,
        trigger,
        rank,
        payload,
      });
    };

    // Track how close this actor ever came to acting, in case it never does.
    if (best) {
      const gap = payload.holdValue - best.total;
      const held = nearest.get(actorId);
      if (!held || gap < held.gap) nearest.set(actorId, { entry, gap });
    }

    if (payload.decision === "act") {
      add("the model authorised a move at this step", 0);
      continue;
    }
    if (previousFrame === "gain" && payload.frame === "loss") {
      add("the institution began treating its position as losing", 1);
      continue;
    }
    if (payload.decision === "all_moves_blocked") {
      add("its own commitments emptied the table", 2);
      continue;
    }
    if (
      payload.decision === "hold" &&
      best &&
      Math.abs(payload.holdValue - best.total) <=
        NEAR_TIE * Math.max(Math.abs(payload.holdValue), Math.abs(best.total))
    ) {
      add("waiting and acting were within a hair of each other", 3);
    }
  }

  // An actor that spends the whole window doing nothing is the case that most
  // looks like the model is idle, and it is the one worth asking about: this
  // institution held capability for months and judged every use of it not worth
  // making. Convening once at its closest call turns a blank timeline into the
  // question a defender actually has — what would have changed its mind.
  for (const actorId of actorsSeen) {
    if (points.some((point) => point.actorId === actorId)) continue;
    const closest = nearest.get(actorId);
    if (!closest) continue;
    points.push({
      branchId,
      tick: closest.entry.tick,
      actorId,
      trigger:
        "this institution never acted in the whole window, and this is the step where it came closest",
      rank: 4,
      payload: closest.entry.payload as unknown as DeliberationPayload,
    });
  }

  return points;
}

/**
 * Apply the per-world cap, keeping the most interesting steps.
 *
 * Each actor is guaranteed its best step before any actor gets a second. Strict
 * rank order does not survive contact with the comparison this product exists
 * to make: put Russia and China in one grid and Russia authorises six moves
 * while China authorises none, so six rank-0 Russian steps fill the budget and
 * the actor that declined — the whole point of running them together — convenes
 * nothing. Its silence then reads as the model having nothing to say about it.
 *
 * Returns what it discarded rather than discarding quietly. A bounded search
 * reported as an exhaustive one is the same defect as an unsourced parameter:
 * the number looks like more than it is.
 */
export function capPerBranch(
  points: readonly DecisionPoint[],
  max: number,
): { kept: DecisionPoint[]; dropped: number } {
  const byBranch = new Map<string, DecisionPoint[]>();
  for (const point of points) {
    const list = byBranch.get(point.branchId) ?? [];
    list.push(point);
    byBranch.set(point.branchId, list);
  }

  const kept: DecisionPoint[] = [];
  let dropped = 0;
  for (const list of byBranch.values()) {
    const ordered = [...list].sort(
      (a, b) => a.rank - b.rank || a.tick - b.tick,
    );

    const firstPerActor: DecisionPoint[] = [];
    const remainder: DecisionPoint[] = [];
    const claimed = new Set<string>();
    for (const point of ordered) {
      if (claimed.has(point.actorId)) remainder.push(point);
      else {
        claimed.add(point.actorId);
        firstPerActor.push(point);
      }
    }

    const chosen = [...firstPerActor, ...remainder].slice(0, max);
    kept.push(...chosen);
    dropped += Math.max(0, ordered.length - chosen.length);
  }
  // Chronological within the run, so the stream reads as a story rather than as
  // the priority queue it was selected by.
  kept.sort((a, b) => a.branchId.localeCompare(b.branchId) || a.tick - b.tick);
  return { kept, dropped };
}

// ─── councils ───

async function runCouncils(
  points: readonly DecisionPoint[],
  options: DeepRunOptions,
  emitter: RunEmitter,
  ledger: UsageLedger,
  config: ContestedSystemConfig,
): Promise<CouncilVerdict[]> {
  const profiles = new Map(
    config.actors.map((actor) => [actor.profile.id, actor.profile]),
  );
  const rungs = new Map(config.ladder.map((rung) => [rung.id, rung.statement]));

  const results = await mapWithConcurrency(
    points,
    Math.max(1, options.councilConcurrency),
    async (point, index): Promise<CouncilVerdict | null> => {
      const profile = profiles.get(point.actorId);
      if (!profile) return null;

      const councilId = `${point.branchId}-t${point.tick}-${point.actorId}`;
      const label = `council:${councilId}`;
      // One labelled client per speaker, so every prompt and completion on the
      // stream names the seat that produced it. The label is built in one place
      // and reused by the events, so a viewer's lookup cannot drift from it.
      const speakerLabel = (speaker: string): string => `${label}:${speaker}`;
      const clientFor = (speaker: string): LlmClient =>
        observeClient(
          ledger.instrument(options.client!, speakerLabel(speaker)),
          emitter,
          speakerLabel(speaker),
        );

      const chosenRef = point.payload.chosen
        ? moveRef(point.payload.chosen.assetId, point.payload.chosen.rungId)
        : null;

      // Announce the table before any seat speaks, so a viewer sees who is
      // about to deliberate and on whose documented authority.
      const table = seatsFor(profile);
      emitter.emit({
        type: "council_opened",
        councilId,
        branchId: point.branchId,
        tick: point.tick,
        actorId: point.actorId,
        actorLabel: point.payload.actorLabel,
        trigger: point.trigger,
        seatSource: table.source,
        seats: table.seats.map((seat) => ({
          id: seat.id,
          office: seat.office,
          stage: seat.stage,
          gate: seat.gate,
        })),
      });

      try {
        const verdict = await convene({
          clientFor,
          kernelDecision: point.payload.decision,
          kernelMoveRef: chosenRef,
          onRetry: (seatLabel, attempt, reason) =>
            retryReporter(emitter, `${label}:${seatLabel}`)(attempt, reason),
          onSeatClosed: (deliberation) =>
            emitter.emit({
              type: "seat_opinion",
              councilId,
              seatId: deliberation.seat.id,
              agentLabel: speakerLabel(`seat:${deliberation.seat.id}`),
              office: deliberation.seat.office,
              recommendation: deliberation.opinion.recommendation,
              moveRef: deliberation.opinion.moveRef,
              reasoning: deliberation.opinion.reasoning,
              decisiveFactor: deliberation.opinion.decisiveFactor,
              confidence: deliberation.opinion.confidence,
            }),
          input: {
            profile,
            tick: point.tick,
            tickUnit: config.tickUnit,
            situation: config.statement,
            options: councilOptions(point.payload, rungs),
            blocked: (point.payload.blocked ?? []).map((entry) => ({
              ref: moveRef(entry.assetId, entry.rungId),
              redlineStatement: entry.redlineStatement,
            })),
            holdValue: point.payload.holdValue ?? 0,
            frame: point.payload.frame,
            runSoFar: `${point.trigger}. This is world ${point.branchId}, decision ${index + 1} of ${points.length} the run stopped on.`,
          },
        });

        emitter.emit({
          type: "council_verdict",
          councilId,
          agentLabel: speakerLabel("chair"),
          branchId: point.branchId,
          tick: point.tick,
          actorId: point.actorId,
          decision: verdict.chair.decision,
          moveRef: verdict.chair.moveRef,
          reasoning: verdict.chair.reasoning,
          dissent: verdict.chair.dissent,
          confidence: verdict.chair.confidence,
          kernelDecision: verdict.kernelDecision,
          kernelMoveRef: verdict.kernelMoveRef,
          agreed: verdict.agreed,
          split: verdict.split,
        });

        return verdict;
      } catch (error) {
        // One council failing must not lose the run. The failure is emitted so
        // the viewer sees a gap it can name, rather than a council that quietly
        // never happened.
        emitter.emit({
          type: "agent_failed",
          label,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  );

  // A council that threw was already reported as a failed agent above; dropping
  // it here keeps the verdict list free of holes a caller would have to re-check.
  return results.filter(
    (verdict): verdict is CouncilVerdict => verdict !== null,
  );
}

/** The kernel's scored options, rendered for a seat that has to weigh them. */
function councilOptions(
  payload: DeliberationPayload,
  rungs: ReadonlyMap<string, string>,
): CouncilOption[] {
  return (payload.considered ?? []).map((move) => ({
    ref: moveRef(move.assetId, move.rungId),
    assetId: move.assetId,
    rungStatement: rungs.get(move.rungId) ?? move.rungId,
    total: move.total,
    payoff: move.payoff,
    attributionCost: move.attributionCost,
    legitimacyCost: move.legitimacyCost,
    civilianHarmCost: move.civilianHarmCost,
    retaliationCost: move.retaliationCost,
  }));
}

// ─── judges ───

const JudgementSchema = z.object({
  verdict: z.string().min(1),
  reasoning: z.string().min(1),
  confidence: z.enum(["low", "moderate", "high"]),
  dissent: z.string(),
  ranking: z.array(z.string()),
});

const TECHNIQUE_BRIEF: Readonly<Record<string, string>> = {
  analysis_of_competing_hypotheses:
    "Score the evidence against every world. Weight evidence that DISCRIMINATES between them far above evidence merely consistent with all of them.",
  key_assumptions_check:
    "Surface what this ensemble's conclusion rests on, and state what reading would falsify each assumption.",
  devils_advocate:
    "Argue that the leading world is the wrong one to plan against, as strongly as the evidence permits.",
  premortem:
    "Assume a defender planned against this ensemble and was badly surprised. Explain how that happened.",
  red_team:
    "Take the adversary's side. Say which world flatters the defender and why the adversary would prefer a different one.",
};

async function runJudges(
  options: DeepRunOptions,
  emitter: RunEmitter,
  ledger: UsageLedger,
  branches: readonly BranchSummary[],
  councils: readonly CouncilVerdict[],
  config: ContestedSystemConfig,
): Promise<Judgement[]> {
  const techniques = SAT_TECHNIQUES.slice(0, Math.max(1, options.judges));

  emitter.emit({
    type: "stage",
    stage: "judges",
    detail: `${techniques.length} adjudicators, each applying a different technique to the same ${branches.length} worlds`,
  });

  const brief = buildEnsembleBrief(branches, councils, config);

  const results = await mapWithConcurrency(
    techniques,
    Math.max(1, options.councilConcurrency),
    async (technique): Promise<Judgement | null> => {
      const label = `judge:${technique}`;
      const client = observeClient(
        ledger.instrument(options.client!, label),
        emitter,
        label,
      );

      const system = `You are an adjudicator applying one structured analytic technique to the output of a closed policy simulation. Everything you are shown is that model's own instrument output — worlds it replayed, options it priced, and the deliberation records of the institutions it represents.

YOUR TECHNIQUE: ${technique}
${TECHNIQUE_BRIEF[technique] ?? ""}

Apply only your technique. Do not average toward the other adjudicators; a panel whose members agree because they expected to agree has measured nothing. Where the evidence does not support a confident answer, say so and keep your confidence low — "the leading world is likely, confidence low" is a valid and common finding.

You are never asked how any modelled action would be carried out.`;

      const prompt = `${brief}

Apply your technique to this ensemble and report:
- verdict: one sentence — what a defender should take from these worlds.
- reasoning: 3-6 sentences applying your technique specifically.
- confidence: "low" | "moderate" | "high", as a SEPARATE judgement from the verdict.
- dissent: what the other techniques are most likely to get wrong here. Empty string if none.
- ranking: the world ids from most to least worth planning against.

Output ONLY valid JSON: {"verdict":"...","reasoning":"...","confidence":"...","dissent":"","ranking":["w1"]}`;

      try {
        const { value } = await completeStructured(
          client,
          { system, prompt, maxTurns: 1 },
          {
            schema: JudgementSchema,
            onRetry: retryReporter(emitter, label),
          },
        );

        emitter.emit({
          type: "judgement",
          judgeId: label,
          technique,
          question: "which of these worlds should a defender plan against",
          verdict: value.verdict,
          reasoning: value.reasoning,
          confidence: value.confidence,
          dissent: value.dissent,
          ranking: value.ranking,
        });

        return { judgeId: label, technique, ...value };
      } catch (error) {
        emitter.emit({
          type: "agent_failed",
          label,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  );

  return results.filter((entry): entry is Judgement => entry !== null);
}

/**
 * What the judges are allowed to see.
 *
 * Summaries and deliberation outcomes, not the raw state — the same restriction
 * the forecasting panel operates under, for the same reason: an adjudicator
 * handed the world's internals is scoring the answer key.
 */
function buildEnsembleBrief(
  branches: readonly BranchSummary[],
  councils: readonly CouncilVerdict[],
  config: ContestedSystemConfig,
): string {
  const worlds = branches
    .map(
      (branch) =>
        `  ${branch.branchId}: ${branch.activations} acts, ${Math.round(branch.totalHarm).toLocaleString()} ${config.oracle.harmUnit}, ` +
        `${branch.decisionPoints} steps the run stopped on. Premise: ${branch.premise}`,
    )
    .join("\n");

  const disagreements = councils.filter((council) => !council.agreed);
  const deliberations =
    councils.length > 0
      ? councils
          .slice(0, 12)
          .map(
            (council) =>
              `  ${council.actorId} at step ${council.tick}: the institution's own gates reached "${council.chair.decision}" ` +
              `(seats split act ${council.split.act} / hold ${council.split.hold} / refuse ${council.split.refuse}); ` +
              `the arithmetic reached "${council.kernelDecision}". ${council.agreed ? "They agreed." : "They DISAGREED."} ` +
              `${council.chair.dissent ? `Surviving objection: ${council.chair.dissent}` : ""}`,
          )
          .join("\n")
      : "  (no council convened — no model backend was configured for this run)";

  return `SITUATION
${config.statement}

CONSEQUENCE MEASUREMENT
${config.oracle.method}, reported in ${config.oracle.harmUnit}, evidence class "${config.oracle.evidenceClass}".

WORLDS REPLAYED
${worlds}

WHERE INSTITUTIONAL JUDGEMENT AND ARITHMETIC MET
${deliberations}

${disagreements.length} of ${councils.length} councils reached a different call than the model's arithmetic.`;
}
