/**
 * The run stream — everything a watcher is allowed to see, as it happens.
 *
 * Until now a Proteus run was opaque while it ran and legible only afterwards,
 * and the most interesting thing in it was never legible at all: the analytic
 * agents' reasoning was discarded the instant Zod validated their output
 * (`llm/structured.ts` keeps `value` and drops the raw completion), so a run's
 * deliberation existed only in memory and died with the process.
 *
 * This module makes a run watchable. Two sources feed one ordered stream:
 *
 *   the simulation  — actor deliberations, activations, telemetry, per tick
 *   the analytic layer — each agent's prompt, its raw completion, its retries
 *
 * ONE DISCLOSURE RULE, and it is the same rule the event kinds enforce inside
 * the kernel: every event carries the channel it belongs to, and a consumer
 * built to stand in for a defender must filter to `telemetry`. Ground truth is
 * emitted because a human evaluator watching a demo is not a defender inside the
 * model — but the labelling is structural, so a detector that reads privileged
 * events is committing an obvious, greppable error rather than a subtle one.
 */

import type { LlmClient, LlmRequest, LlmResponse } from "../llm/client.js";

/**
 * Who is allowed to see this event.
 *
 * `telemetry` is what a defender inside the scenario could observe.
 * `truth` is what actually happened. `privileged` is reasoning — actor
 * deliberation and agent deliberation both — which is strictly more sensitive
 * than truth because it reveals not just what happened but what nearly did.
 */
export const DISCLOSURE_CHANNELS = [
  "telemetry",
  "truth",
  "privileged",
] as const;
export type DisclosureChannel = (typeof DISCLOSURE_CHANNELS)[number];

export interface RunEventBase {
  /** Monotonic within a run, so a consumer can order and detect drops. */
  readonly seq: number;
  readonly channel: DisclosureChannel;
  /** Milliseconds since the run started. Wall-clock, never used in the model. */
  readonly elapsedMs: number;
}

export type RunEvent =
  | (RunEventBase & {
      readonly type: "run_started";
      readonly runId: string;
      readonly scenarioId: string;
      readonly statement: string;
      readonly ticks: number;
      readonly tickUnit: string;
      readonly seed: string;
      readonly actors: readonly { id: string; label: string; kind: string }[];
      readonly assets: readonly {
        id: string;
        assetClass: string;
        zone: string;
      }[];
      readonly ladder: readonly { id: string; statement: string }[];
      readonly oracle: {
        method: string;
        evidenceClass: string;
        harmUnit: string;
      };
      readonly caveat: string;
    })
  // `branchId` is absent on a single-run stream and present on an ensemble one.
  // Carrying it on the event rather than inferring it from the last
  // `branch_opened` keeps a consumer correct if branches are ever interleaved.
  | (RunEventBase & {
      readonly type: "tick";
      readonly tick: number;
      readonly heldCount: number;
      readonly cumulativeHarm: number;
      readonly cumulativeDefenseCost: number;
      readonly branchId?: string;
    })
  | (RunEventBase & {
      readonly type: "deliberation";
      readonly tick: number;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly branchId?: string;
    })
  | (RunEventBase & {
      readonly type: "activation";
      readonly tick: number;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly branchId?: string;
    })
  | (RunEventBase & {
      readonly type: "telemetry";
      readonly tick: number;
      readonly anomalyEvents: number;
      readonly configChangeEvents: number;
      readonly failedAuthEvents: number;
      readonly serviceComplaints: number;
    })
  | (RunEventBase & {
      readonly type: "stage";
      readonly stage: string;
      readonly detail: string;
    })
  | (RunEventBase & {
      readonly type: "agent_call";
      readonly label: string;
      readonly model: string;
      readonly system: string;
      readonly prompt: string;
    })
  | (RunEventBase & {
      readonly type: "agent_reasoning";
      readonly label: string;
      /** The model's raw completion, before schema validation discards it. */
      readonly text: string;
      readonly durationMs: number;
      readonly inputTokens?: number;
      readonly outputTokens?: number;
      readonly costUsd?: number;
    })
  | (RunEventBase & {
      readonly type: "agent_retry";
      readonly label: string;
      readonly attempt: number;
      /** The schema violation, which is itself a signal about the prompt. */
      readonly reason: string;
    })
  | (RunEventBase & {
      readonly type: "agent_failed";
      readonly label: string;
      readonly error: string;
    })
  | (RunEventBase & {
      readonly type: "branch_opened";
      readonly branchId: string;
      readonly seed: string;
      /** What distinguishes this world from the others in the ensemble. */
      readonly premise: string;
      readonly index: number;
      readonly total: number;
    })
  | (RunEventBase & {
      readonly type: "branch_finished";
      readonly branchId: string;
      readonly activations: number;
      readonly totalHarm: number;
      readonly decisionPoints: number;
    })
  | (RunEventBase & {
      readonly type: "council_opened";
      readonly councilId: string;
      readonly branchId: string;
      readonly tick: number;
      readonly actorId: string;
      readonly actorLabel: string;
      /** Why this step was worth convening over. */
      readonly trigger: string;
      readonly seatSource: "documented" | "fallback";
      readonly seats: readonly {
        id: string;
        office: string;
        stage: string;
        gate: string;
      }[];
    })
  | (RunEventBase & {
      readonly type: "seat_opinion";
      readonly councilId: string;
      readonly seatId: string;
      /** Ties this seat to its `agent_call` and `agent_reasoning` on the stream. */
      readonly agentLabel: string;
      readonly office: string;
      readonly recommendation: string;
      readonly moveRef: string | null;
      readonly reasoning: string;
      readonly decisiveFactor: string;
      readonly confidence: string;
    })
  | (RunEventBase & {
      readonly type: "council_verdict";
      readonly councilId: string;
      /** Ties the chair to its own prompt and completion on the stream. */
      readonly agentLabel: string;
      readonly branchId: string;
      readonly tick: number;
      readonly actorId: string;
      readonly decision: string;
      readonly moveRef: string | null;
      readonly reasoning: string;
      readonly dissent: string;
      readonly confidence: string;
      readonly kernelDecision: string;
      readonly kernelMoveRef: string | null;
      /** The finding: did institutional judgement land where the arithmetic did. */
      readonly agreed: boolean;
      readonly split: Readonly<Record<string, number>>;
    })
  | (RunEventBase & {
      readonly type: "judgement";
      readonly judgeId: string;
      readonly technique: string;
      readonly question: string;
      readonly verdict: string;
      readonly reasoning: string;
      readonly confidence: string;
      readonly dissent: string;
      /** Branch ids this judge ranked, best first. */
      readonly ranking: readonly string[];
    })
  | (RunEventBase & {
      readonly type: "run_finished";
      readonly runId: string;
      readonly ticks: number;
      readonly activations: number;
      readonly totalHarm: number;
      readonly harmUnit: string;
      readonly evidenceClass: string;
    })
  | (RunEventBase & {
      readonly type: "run_failed";
      readonly error: string;
    });

export type RunEventType = RunEvent["type"];

/** Anything that can receive run events. Sync, so emitting cannot reorder them. */
export interface RunObserver {
  emit(event: RunEvent): void;
}

/**
 * Fields the emitter fills in, so callers never invent a sequence number.
 *
 * Distributes over the union deliberately: a bare `Omit<RunEvent, …>` collapses
 * to the keys every variant shares, which is four of them, and every payload
 * field would then be rejected at the call site.
 */
type Emitted<T> = T extends unknown
  ? Omit<T, "seq" | "elapsedMs" | "channel"> & {
      readonly channel?: DisclosureChannel;
    }
  : never;

export type EmittedEvent = Emitted<RunEvent>;

/**
 * Default channel per event type.
 *
 * Centralized so the classification is decided once, in a table a reviewer can
 * read top to bottom, rather than at each of the twenty call sites that emit.
 * Getting one of these wrong is a disclosure bug, and a table makes it a
 * one-line review.
 */
const CHANNEL_BY_TYPE: Readonly<Record<RunEventType, DisclosureChannel>> = {
  run_started: "truth",
  tick: "truth",
  deliberation: "privileged",
  activation: "truth",
  telemetry: "telemetry",
  stage: "truth",
  agent_call: "privileged",
  agent_reasoning: "privileged",
  agent_retry: "privileged",
  agent_failed: "truth",
  branch_opened: "truth",
  branch_finished: "truth",
  // A council IS the actor's deliberation, so it carries the same clearance the
  // kernel's own deliberation record does — strictly more sensitive than truth,
  // because it discloses not only what the actor did but what it nearly did.
  council_opened: "privileged",
  seat_opinion: "privileged",
  council_verdict: "privileged",
  // A judge reasons about the model's published output, not about any actor's
  // private state, so its verdict is a product a defender is meant to read.
  judgement: "truth",
  run_finished: "truth",
  run_failed: "truth",
};

/**
 * Stamps sequence and timing onto events and forwards them.
 *
 * `now` is injected so tests can drive it deterministically — the elapsed field
 * is the one piece of wall-clock in a system whose whole value proposition is
 * that a seed reproduces a run byte for byte, and it is kept strictly out of the
 * model for that reason.
 */
export class RunEmitter {
  private sequence = 0;
  private readonly start: number;

  constructor(
    private readonly observers: readonly RunObserver[],
    private readonly now: () => number = () => Date.now(),
  ) {
    this.start = now();
  }

  emit(event: EmittedEvent): void {
    const full = {
      ...event,
      seq: this.sequence++,
      elapsedMs: this.now() - this.start,
      channel: event.channel ?? CHANNEL_BY_TYPE[event.type],
    } as RunEvent;

    for (const observer of this.observers) observer.emit(full);
  }

  get emitted(): number {
    return this.sequence;
  }
}

/** Collects events in memory. For tests and for replaying a finished run. */
export function createMemoryObserver(): RunObserver & {
  readonly events: readonly RunEvent[];
} {
  const events: RunEvent[] = [];
  return {
    events,
    emit(event) {
      events.push(event);
    },
  };
}

/**
 * Writes newline-delimited JSON.
 *
 * NDJSON rather than a JSON array because the stream must be consumable while
 * it is still being produced — a live viewer cannot wait for a closing bracket,
 * and a run that crashes mid-way should still leave a readable partial log.
 */
export function createJsonlObserver(
  write: (line: string) => void,
): RunObserver {
  return {
    emit(event) {
      write(`${JSON.stringify(event)}\n`);
    },
  };
}

/** Drops events outside the given channels. The seam a defender-side consumer uses. */
export function createFilteredObserver(
  inner: RunObserver,
  channels: readonly DisclosureChannel[],
): RunObserver {
  const allowed = new Set(channels);
  return {
    emit(event) {
      if (allowed.has(event.channel)) inner.emit(event);
    },
  };
}

/**
 * Wrap an LLM client so every call it makes is visible on the stream.
 *
 * This is the capture point the whole reasoning feed depends on. It sits OUTSIDE
 * `completeStructured`, so it sees the raw completion before schema validation
 * throws the text away, and it sees the repair prompts on retry — which are
 * often the most informative thing in a run, because a model that had to be
 * asked twice was asked badly the first time.
 *
 * Composes with `UsageLedger.instrument`: both are plain decorators over
 * `complete`, and order does not matter to either.
 */
export function observeClient(
  client: LlmClient,
  emitter: RunEmitter,
  label: string,
): LlmClient {
  return {
    name: client.name,
    async complete(request: LlmRequest): Promise<LlmResponse> {
      const started = Date.now();
      emitter.emit({
        type: "agent_call",
        label,
        model: request.model ?? client.name,
        system: request.system,
        prompt: request.prompt,
      });

      try {
        const response = await client.complete(request);
        emitter.emit({
          type: "agent_reasoning",
          label,
          text: response.text,
          durationMs: Date.now() - started,
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
          costUsd: response.usage?.costUsd,
        });
        return response;
      } catch (error) {
        emitter.emit({
          type: "agent_failed",
          label,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

/**
 * Retry callback for `completeStructured`.
 *
 * That option has existed since the module was written and nothing ever passed
 * it, so schema-repair rounds were invisible. Wiring it costs one argument and
 * turns "the run was slow" into "the framer was asked three times because it
 * kept omitting a required field".
 */
export function retryReporter(
  emitter: RunEmitter,
  label: string,
): (attempt: number, reason: string) => void {
  return (attempt, reason) => {
    emitter.emit({ type: "agent_retry", label, attempt, reason });
  };
}
