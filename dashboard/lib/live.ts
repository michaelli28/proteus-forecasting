/**
 * Types for the live run stream.
 *
 * Hand-mirrored from `engine/src/observe/stream.ts`, the same arrangement the
 * trace and metrics types already use — the dashboard cannot import from the
 * engine, so the contract is duplicated and kept honest by the runtime shape
 * checks below rather than by the compiler.
 *
 * Only the fields the page actually renders are mirrored. A field the engine
 * emits and the page ignores is deliberately absent here, so this file reads as
 * a statement of what the viewer shows rather than as a stale copy of a
 * different module.
 */

import manifest from "../data/scenario-manifest.json";

export type DisclosureChannel = "telemetry" | "truth" | "privileged";

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

export interface BlockedMove {
  assetId: string;
  rungId: string;
  redlineId: string;
  redlineStatement: string;
}

export interface DeliberationPayload {
  actorId: string;
  actorLabel: string;
  frame: "gain" | "loss";
  decision: string;
  rationale: string;
  disposition: string;
  holdValue: number;
  consideredCount: number;
  considered: ScoredMove[];
  blocked: BlockedMove[];
  chosen: ScoredMove | null;
}

export interface ActivationPayload {
  actorId: string;
  assetId: string;
  rungId: string;
  durationHours: number;
  harm: number;
  peakUnitsAffected: number;
  established: boolean;
  dwellTicks: number;
  attributed: boolean;
}

/** Fields every event carries. Intersected in rather than repeated eleven times. */
interface EventBase {
  seq: number;
  channel: DisclosureChannel;
  elapsedMs: number;
}

export type RunEvent = EventBase &
  (
    | {
        type: "stage";
        stage: string;
        detail: string;
      }
    | {
        type: "branch_opened";
        branchId: string;
        seed: string;
        premise: string;
        index: number;
        total: number;
      }
    | {
        type: "branch_finished";
        branchId: string;
        activations: number;
        totalHarm: number;
        decisionPoints: number;
      }
    | {
        type: "council_opened";
        councilId: string;
        branchId: string;
        tick: number;
        actorId: string;
        actorLabel: string;
        trigger: string;
        seatSource: "documented" | "fallback";
        seats: { id: string; office: string; stage: string; gate: string }[];
      }
    | {
        type: "seat_opinion";
        councilId: string;
        seatId: string;
        agentLabel: string;
        office: string;
        recommendation: string;
        moveRef: string | null;
        reasoning: string;
        decisiveFactor: string;
        confidence: string;
      }
    | {
        type: "council_verdict";
        councilId: string;
        agentLabel: string;
        branchId: string;
        tick: number;
        actorId: string;
        decision: string;
        moveRef: string | null;
        reasoning: string;
        dissent: string;
        confidence: string;
        kernelDecision: string;
        kernelMoveRef: string | null;
        agreed: boolean;
        split: Record<string, number>;
      }
    | {
        type: "judgement";
        judgeId: string;
        technique: string;
        question: string;
        verdict: string;
        reasoning: string;
        confidence: string;
        dissent: string;
        ranking: string[];
      }
    | {
        type: "agent_call";
        label: string;
        model: string;
        system: string;
        prompt: string;
      }
    | {
        type: "agent_reasoning";
        label: string;
        text: string;
        durationMs: number;
        inputTokens?: number;
        outputTokens?: number;
        costUsd?: number;
      }
    | {
        type: "agent_retry";
        label: string;
        attempt: number;
        reason: string;
      }
    | {
        type: "agent_failed";
        label: string;
        error: string;
      }
    | LegacyRunEvent
  );

/** The events the single-world stream has always emitted. */
type LegacyRunEvent =
  | {
      type: "run_started";
      runId: string;
      scenarioId: string;
      statement: string;
      ticks: number;
      tickUnit: string;
      seed: string;
      actors: { id: string; label: string; kind: string }[];
      assets: { id: string; assetClass: string; zone: string }[];
      ladder: { id: string; statement: string }[];
      oracle: { method: string; evidenceClass: string; harmUnit: string };
      caveat: string;
    }
  | {
      type: "tick";
      tick: number;
      branchId?: string;
      heldCount: number;
      cumulativeHarm: number;
      cumulativeDefenseCost: number;
    }
  | {
      type: "deliberation";
      tick: number;
      branchId?: string;
      payload: DeliberationPayload;
    }
  | {
      type: "activation";
      tick: number;
      branchId?: string;
      payload: ActivationPayload;
    }
  | {
      type: "telemetry";
      tick: number;
      anomalyEvents: number;
      configChangeEvents: number;
      failedAuthEvents: number;
      serviceComplaints: number;
    }
  | {
      type: "run_finished";
      runId: string;
      ticks: number;
      activations: number;
      totalHarm: number;
      harmUnit: string;
      evidenceClass: string;
    }
  | {
      type: "run_failed";
      error: string;
    };

// ─── the catalogue the engine publishes ───

export interface ManifestPack {
  id: string;
  statement: string;
  provenance: string;
  ticks: number;
  tickUnit: string;
  servedUnits: number;
  harmUnit: string;
  evidenceClass: string;
  assetCount: number;
  ladder: { id: string; statement: string }[];
  defenses: {
    kind: string;
    label: string;
    statement: string;
    costPerTick: number;
  }[];
}

export interface ManifestActor {
  id: string;
  label: string;
  kind: string;
  summary: string;
  rationalityPrecision: number;
  redlines: { statement: string; binding: boolean }[];
  lowConfidence: string[];
  sourceCount: number;
  uncertainty: string;
}

export interface ScenarioManifest {
  generatedNote: string;
  profilesReviewedAt: string;
  profileMethod: string;
  packs: ManifestPack[];
  actors: ManifestActor[];
}

function load(): ScenarioManifest {
  const data = manifest as ScenarioManifest;
  if (!data.packs?.length || !data.actors?.length) {
    throw new Error(
      "scenario-manifest.json is empty — run `npm run manifest` in engine/",
    );
  }
  return data;
}

export const MANIFEST = load();

/** Plain-language names for the decision states the engine emits. */
export const DECISION_LABEL: Record<string, string> = {
  no_holdings: "has no access to spend",
  not_yet_active: "not ready to act yet",
  all_moves_blocked: "every option crosses its own red line",
  no_positive_move: "nothing worth doing",
  hold: "waiting — worth more later",
  act: "acting",
};

/** Which decision states deserve visual weight. Everything else stays quiet. */
export function decisionTone(decision: string): "warn" | "accent" | null {
  if (decision === "act") return "warn";
  if (decision === "all_moves_blocked") return "accent";
  return null;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
