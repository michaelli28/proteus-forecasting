/**
 * Turning a run stream into something a page can render.
 *
 * Kept apart from the components on purpose. This is the only place that decides
 * what a run "is" — which worlds exist, which councils were held, what each
 * agent was asked — and it does it with plain data and no React, so the rules
 * about what gets kept and what gets dropped can be read and tested without
 * mounting anything.
 *
 * WHAT GETS DROPPED, and why it is stated here rather than discovered later: a
 * four-world run emits several thousand deliberations, nearly all of them an
 * actor repeating yesterday's posture. Keeping every one costs tens of megabytes
 * of browser memory to render a wall of identical cards. So a deliberation is
 * kept when the actor's posture CHANGED, when it acted, or when its own
 * commitments emptied the table — and the counters record how many were seen, so
 * the page can say "1,438 steps, 12 of them worth showing" instead of implying
 * that twelve is all there was.
 */

import type { RunEvent } from "./live";

export interface RunHeader {
  runId: string;
  statement: string;
  caveat: string;
  ticks: number;
  tickUnit: string;
  harmUnit: string;
  evidenceClass: string;
  seed: string;
  assets: { id: string; assetClass: string; zone: string }[];
  ladder: { id: string; statement: string }[];
  actors: { id: string; label: string; kind: string }[];
}

export interface StageEntry {
  stage: string;
  detail: string;
  elapsedMs: number;
}

export interface TickPoint {
  tick: number;
  harm: number;
  held: number;
}

export interface KeptDeliberation {
  seq: number;
  tick: number;
  actorId: string;
  actorLabel: string;
  frame: "gain" | "loss";
  decision: string;
  rationale: string;
  disposition: string;
  holdValue: number;
  consideredCount: number;
  considered: ScoredMove[];
  blocked: { assetId: string; rungId: string; redlineStatement: string }[];
  chosen: ScoredMove | null;
}

export interface ScoredMove {
  assetId: string;
  rungId: string;
  total: number;
  payoff: number;
  attributionCost: number;
  legitimacyCost: number;
  civilianHarmCost: number;
  retaliationCost: number;
  signalingGain: number;
  normalizedHarm: number;
  established: boolean;
}

export interface ActivationEntry {
  seq: number;
  tick: number;
  actorId: string;
  assetId: string;
  rungId: string;
  harm: number;
  attributed: boolean;
  dwellTicks: number;
  established: boolean;
}

export interface Branch {
  id: string;
  seed: string;
  premise: string;
  index: number;
  total: number;
  ticks: TickPoint[];
  activations: ActivationEntry[];
  deliberations: KeptDeliberation[];
  /** Every deliberation seen, including the ones not kept. */
  deliberationsSeen: number;
  finished?: { activations: number; totalHarm: number; decisionPoints: number };
}

export interface SeatOpinionEntry {
  seatId: string;
  agentLabel: string;
  office: string;
  recommendation: string;
  moveRef: string | null;
  reasoning: string;
  decisiveFactor: string;
  confidence: string;
}

export interface Council {
  councilId: string;
  branchId: string;
  tick: number;
  actorId: string;
  actorLabel: string;
  trigger: string;
  seatSource: "documented" | "fallback";
  seats: { id: string; office: string; stage: string; gate: string }[];
  opinions: SeatOpinionEntry[];
  verdict?: {
    agentLabel: string;
    decision: string;
    moveRef: string | null;
    reasoning: string;
    dissent: string;
    confidence: string;
    kernelDecision: string;
    kernelMoveRef: string | null;
    agreed: boolean;
    split: Record<string, number>;
  };
}

export interface JudgementEntry {
  judgeId: string;
  technique: string;
  question: string;
  verdict: string;
  reasoning: string;
  confidence: string;
  dissent: string;
  ranking: string[];
}

/**
 * One agent's whole episode: what it was asked, what it said, what it cost.
 *
 * The raw completion is kept unedited, including the code fences a model wraps
 * its JSON in. Cleaning it up would be showing a tidied transcript of what the
 * model said rather than what it said.
 */
export interface AgentRecord {
  label: string;
  model: string;
  system: string;
  prompt: string;
  text?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  retries: { attempt: number; reason: string }[];
  error?: string;
  startedMs: number;
}

export interface RunState {
  header: RunHeader | null;
  stages: StageEntry[];
  branchOrder: string[];
  branches: Record<string, Branch>;
  councils: Council[];
  judgements: JudgementEntry[];
  agentOrder: string[];
  agents: Record<string, AgentRecord>;
  finished: {
    runId: string;
    activations: number;
    totalHarm: number;
    harmUnit: string;
    evidenceClass: string;
  } | null;
  error: string | null;
  /** Latest step reached, for the progress bar. */
  tick: number;
  totalHarm: number;
  heldCount: number;
  /**
   * What the defensive measure has cost so far, per world.
   *
   * Every world runs the same mitigation over the same window, so this is a
   * per-world figure rather than a sum — adding it across an ensemble would
   * report a defender buying the same control four times.
   */
  defenseCost: number;
  elapsedMs: number;
  eventCount: number;
}

export const EMPTY_RUN: RunState = {
  header: null,
  stages: [],
  branchOrder: [],
  branches: {},
  councils: [],
  judgements: [],
  agentOrder: [],
  agents: {},
  finished: null,
  error: null,
  tick: 0,
  totalHarm: 0,
  heldCount: 0,
  defenseCost: 0,
  elapsedMs: 0,
  eventCount: 0,
};

/** Cap on kept deliberations per world. What it drops is counted, not hidden. */
const KEPT_PER_BRANCH = 240;

/** The single-world stream carries no branch id; it is one unnamed world. */
const SOLO = "run";

/**
 * Fold one event into the run.
 *
 * Returns a new object whenever anything changed, so React re-renders, and the
 * SAME object when an event was ignored — a stream that emits a thousand quiet
 * ticks should not repaint the page a thousand times for no visible difference.
 */
export function reduceRun(state: RunState, event: RunEvent): RunState {
  const next: RunState = {
    ...state,
    eventCount: state.eventCount + 1,
    elapsedMs: Math.max(state.elapsedMs, event.elapsedMs ?? 0),
  };

  switch (event.type) {
    case "run_started":
      return {
        ...next,
        header: {
          runId: event.runId,
          statement: event.statement,
          caveat: event.caveat,
          ticks: event.ticks,
          tickUnit: event.tickUnit,
          harmUnit: event.oracle.harmUnit,
          evidenceClass: event.oracle.evidenceClass,
          seed: event.seed,
          assets: event.assets,
          ladder: event.ladder,
          actors: event.actors,
        },
      };

    case "stage":
      return {
        ...next,
        stages: [
          ...state.stages,
          {
            stage: event.stage,
            detail: event.detail,
            elapsedMs: event.elapsedMs,
          },
        ],
      };

    case "branch_opened":
      return {
        ...next,
        branchOrder: [...state.branchOrder, event.branchId],
        branches: {
          ...state.branches,
          [event.branchId]: {
            id: event.branchId,
            seed: event.seed,
            premise: event.premise,
            index: event.index,
            total: event.total,
            ticks: [],
            activations: [],
            deliberations: [],
            deliberationsSeen: 0,
          },
        },
      };

    case "branch_finished": {
      const branch = state.branches[event.branchId];
      if (!branch) return next;
      return {
        ...next,
        branches: {
          ...state.branches,
          [event.branchId]: {
            ...branch,
            finished: {
              activations: event.activations,
              totalHarm: event.totalHarm,
              decisionPoints: event.decisionPoints,
            },
          },
        },
      };
    }

    case "tick": {
      const branch = ensureBranch(next, event.branchId);
      branch.ticks = [
        ...branch.ticks,
        {
          tick: event.tick,
          harm: event.cumulativeHarm,
          held: event.heldCount,
        },
      ];
      return {
        ...next,
        tick: event.tick,
        totalHarm: event.cumulativeHarm,
        heldCount: event.heldCount,
        defenseCost: Math.max(state.defenseCost, event.cumulativeDefenseCost),
        branches: { ...next.branches, [branch.id]: branch },
      };
    }

    case "activation": {
      const branch = ensureBranch(next, event.branchId);
      const payload = event.payload;
      branch.activations = [
        ...branch.activations,
        {
          seq: event.seq,
          tick: event.tick,
          actorId: String(payload.actorId ?? ""),
          assetId: String(payload.assetId ?? ""),
          rungId: String(payload.rungId ?? ""),
          harm: Number(payload.harm ?? 0),
          attributed: Boolean(payload.attributed),
          dwellTicks: Number(payload.dwellTicks ?? 0),
          established: Boolean(payload.established),
        },
      ];
      return { ...next, branches: { ...next.branches, [branch.id]: branch } };
    }

    case "deliberation": {
      const branch = ensureBranch(next, event.branchId);
      branch.deliberationsSeen += 1;

      const payload = event.payload;
      const previous = [...branch.deliberations]
        .reverse()
        .find((entry) => entry.actorId === payload.actorId);

      // Kept when something actually changed. A posture repeated for eighty
      // days is one fact, not eighty.
      const worthKeeping =
        !previous ||
        previous.decision !== payload.decision ||
        payload.decision === "act" ||
        (payload.blocked?.length ?? 0) > 0 ||
        previous.frame !== payload.frame;

      if (!worthKeeping) {
        return { ...next, branches: { ...next.branches, [branch.id]: branch } };
      }

      branch.deliberations = [
        ...branch.deliberations,
        {
          seq: event.seq,
          tick: event.tick,
          actorId: payload.actorId,
          actorLabel: payload.actorLabel,
          frame: payload.frame,
          decision: payload.decision,
          rationale: payload.rationale,
          disposition: payload.disposition,
          holdValue: payload.holdValue,
          consideredCount: payload.consideredCount,
          considered: payload.considered,
          blocked: payload.blocked,
          chosen: payload.chosen,
        },
      ].slice(-KEPT_PER_BRANCH);

      return { ...next, branches: { ...next.branches, [branch.id]: branch } };
    }

    case "council_opened":
      return {
        ...next,
        councils: [
          ...state.councils,
          {
            councilId: event.councilId,
            branchId: event.branchId,
            tick: event.tick,
            actorId: event.actorId,
            actorLabel: event.actorLabel,
            trigger: event.trigger,
            seatSource: event.seatSource,
            seats: event.seats,
            opinions: [],
          },
        ],
      };

    case "seat_opinion":
      return {
        ...next,
        councils: state.councils.map((council) =>
          council.councilId === event.councilId
            ? {
                ...council,
                opinions: [
                  ...council.opinions,
                  {
                    seatId: event.seatId,
                    agentLabel: event.agentLabel,
                    office: event.office,
                    recommendation: event.recommendation,
                    moveRef: event.moveRef,
                    reasoning: event.reasoning,
                    decisiveFactor: event.decisiveFactor,
                    confidence: event.confidence,
                  },
                ],
              }
            : council,
        ),
      };

    case "council_verdict":
      return {
        ...next,
        councils: state.councils.map((council) =>
          council.councilId === event.councilId
            ? {
                ...council,
                verdict: {
                  agentLabel: event.agentLabel,
                  decision: event.decision,
                  moveRef: event.moveRef,
                  reasoning: event.reasoning,
                  dissent: event.dissent,
                  confidence: event.confidence,
                  kernelDecision: event.kernelDecision,
                  kernelMoveRef: event.kernelMoveRef,
                  agreed: event.agreed,
                  split: event.split,
                },
              }
            : council,
        ),
      };

    case "judgement":
      return {
        ...next,
        judgements: [
          ...state.judgements,
          {
            judgeId: event.judgeId,
            technique: event.technique,
            question: event.question,
            verdict: event.verdict,
            reasoning: event.reasoning,
            confidence: event.confidence,
            dissent: event.dissent,
            ranking: event.ranking,
          },
        ],
      };

    case "agent_call":
      return {
        ...next,
        agentOrder: state.agents[event.label]
          ? state.agentOrder
          : [...state.agentOrder, event.label],
        agents: {
          ...state.agents,
          [event.label]: {
            label: event.label,
            model: event.model,
            system: event.system,
            prompt: event.prompt,
            retries: state.agents[event.label]?.retries ?? [],
            startedMs: event.elapsedMs,
          },
        },
      };

    case "agent_reasoning": {
      const agent = state.agents[event.label];
      if (!agent) return next;
      return {
        ...next,
        agents: {
          ...state.agents,
          [event.label]: {
            ...agent,
            text: event.text,
            durationMs: event.durationMs,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            costUsd: event.costUsd,
          },
        },
      };
    }

    case "agent_retry": {
      const agent = state.agents[event.label];
      if (!agent) return next;
      return {
        ...next,
        agents: {
          ...state.agents,
          [event.label]: {
            ...agent,
            retries: [
              ...agent.retries,
              { attempt: event.attempt, reason: event.reason },
            ],
          },
        },
      };
    }

    case "agent_failed": {
      const agent = state.agents[event.label];
      return {
        ...next,
        agentOrder: agent
          ? state.agentOrder
          : [...state.agentOrder, event.label],
        agents: {
          ...state.agents,
          [event.label]: {
            label: event.label,
            model: agent?.model ?? "",
            system: agent?.system ?? "",
            prompt: agent?.prompt ?? "",
            retries: agent?.retries ?? [],
            startedMs: agent?.startedMs ?? event.elapsedMs,
            error: event.error,
          },
        },
      };
    }

    case "run_finished":
      return {
        ...next,
        finished: {
          runId: event.runId,
          activations: event.activations,
          totalHarm: event.totalHarm,
          harmUnit: event.harmUnit,
          evidenceClass: event.evidenceClass,
        },
      };

    case "run_failed":
      return { ...next, error: event.error };

    default:
      return next;
  }
}

/**
 * The world an event belongs to, created on first sight.
 *
 * Mutates a branch copy rather than rebuilding the map for every tick: a run
 * emits one of these per step per world, and rebuilding the whole structure
 * each time is the difference between a page that keeps up with the stream and
 * one that falls behind it.
 */
function ensureBranch(state: RunState, branchId?: string): Branch {
  const id = branchId ?? SOLO;
  const existing = state.branches[id];
  if (existing) return { ...existing };
  const created: Branch = {
    id,
    seed: state.header?.seed ?? "",
    premise: "",
    index: state.branchOrder.length,
    total: state.branchOrder.length + 1,
    ticks: [],
    activations: [],
    deliberations: [],
    deliberationsSeen: 0,
  };
  state.branchOrder = [...state.branchOrder, id];
  return created;
}

/** Agents belonging to one council seat or chair, matched by label. */
export function agentFor(
  state: RunState,
  label: string | undefined,
): AgentRecord | undefined {
  return label ? state.agents[label] : undefined;
}

export function totalCost(state: RunState): {
  costUsd: number;
  calls: number;
  priced: boolean;
  inputTokens: number;
  outputTokens: number;
} {
  let costUsd = 0;
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let priced = true;
  for (const label of state.agentOrder) {
    const agent = state.agents[label];
    if (!agent?.text) continue;
    calls += 1;
    inputTokens += agent.inputTokens ?? 0;
    outputTokens += agent.outputTokens ?? 0;
    if (agent.costUsd === undefined) priced = false;
    else costUsd += agent.costUsd;
  }
  return { costUsd, calls, priced, inputTokens, outputTokens };
}
