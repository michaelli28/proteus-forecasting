/**
 * Driving one scenario, watchably.
 *
 * The kernel already accepts an `EventSink` it awaits once per event, which is
 * exactly the seam a live view needs: bridging that sink onto the run stream
 * turns an opaque batch job into something a person can watch without changing
 * the kernel at all. The optional per-tick delay exists for the same reason —
 * 180 ticks complete in milliseconds, which is correct for a benchmark and
 * useless for a demonstration.
 *
 * The delay is wall-clock only and touches nothing the model reads, so a run
 * watched slowly and the same run executed at full speed produce byte-identical
 * event logs from the same seed. That property is worth protecting: a demo that
 * is not the same computation as the benchmark is a different system wearing its
 * results.
 */

import { runSimulation } from "../sim/kernel.js";
import type { SimEvent } from "../sim/kernel.js";
import { CONTESTED_SYSTEM_ADAPTER } from "../sim/adapters/contested-system/index.js";
import type { ContestedSystemConfig } from "../sim/adapters/contested-system/config.js";
import type { ContestedSystemState } from "../sim/adapters/contested-system/dynamics.js";
import { describeOracle } from "../sim/adapters/contested-system/oracle.js";
import { RunEmitter } from "../observe/stream.js";
import type { EmittedEvent, RunObserver } from "../observe/stream.js";
import { hashCanonical } from "../artifact/canonical.js";

export interface ScenarioRunOptions {
  readonly config: ContestedSystemConfig;
  readonly seed: string;
  readonly observers: readonly RunObserver[];
  /** Wall-clock pause per tick, for watching. 0 runs at full speed. */
  readonly tickDelayMs?: number;
  /** Injected for deterministic tests. */
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface ScenarioRunResult {
  readonly runId: string;
  readonly events: readonly SimEvent[];
  readonly finalState: ContestedSystemState;
  readonly totalHarm: number;
  readonly activations: number;
  readonly eventsEmitted: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

export async function runScenario(
  options: ScenarioRunOptions,
): Promise<ScenarioRunResult> {
  const { config, seed, observers } = options;
  const emitter = new RunEmitter(observers, options.now);
  const runId = scenarioRunId(config, seed);

  emitter.emit(startedEvent(runId, config, seed));

  try {
    const branch = await driveBranch({
      emitter,
      config,
      seed,
      tickDelayMs: options.tickDelayMs,
      sleep: options.sleep,
    });

    emitter.emit({
      type: "run_finished",
      runId,
      ticks: config.ticks,
      activations: branch.activations,
      totalHarm: branch.totalHarm,
      harmUnit: config.oracle.harmUnit,
      evidenceClass: config.oracle.evidenceClass,
    });

    return {
      runId,
      events: branch.events,
      finalState: branch.finalState,
      totalHarm: branch.totalHarm,
      activations: branch.activations,
      eventsEmitted: emitter.emitted,
    };
  } catch (error) {
    emitter.emit({
      type: "run_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Stable identity for a scenario run.
 *
 * Excludes the oracle's closures, which are not serializable. The oracle's id
 * and method stand in for it, so two runs differing only in how consequences
 * were priced still get different run ids.
 */
export function scenarioRunId(
  config: ContestedSystemConfig,
  seed: string,
): string {
  return hashCanonical({
    scenarioId: config.scenarioId,
    seed,
    ticks: config.ticks,
    register: config.register,
    ladder: config.ladder,
    actors: config.actors.map((actor) => ({
      id: actor.profile.id,
      initialHoldingsMean: actor.initialHoldingsMean,
      acquisitionHazard: actor.acquisitionHazard,
      payoffBase: actor.payoffBase,
      payoffDrift: actor.payoffDrift,
      earliestActivationTick: actor.earliestActivationTick,
      reachableRungs: actor.reachableRungs,
    })),
    defense: config.defense,
    oracle: { id: config.oracle.id, method: config.oracle.method },
  });
}

/** The opening event, shared by the single run and the ensemble. */
export function startedEvent(
  runId: string,
  config: ContestedSystemConfig,
  seed: string,
): EmittedEvent {
  return {
    type: "run_started",
    runId,
    scenarioId: config.scenarioId,
    statement: config.statement,
    ticks: config.ticks,
    tickUnit: config.tickUnit,
    seed,
    actors: config.actors.map((actor) => ({
      id: actor.profile.id,
      label: actor.profile.label,
      kind: actor.profile.kind,
    })),
    assets: config.register.map((asset) => ({
      id: asset.id,
      assetClass: asset.assetClass,
      zone: asset.zone,
    })),
    ladder: config.ladder.map((rung) => ({
      id: rung.id,
      statement: rung.statement,
    })),
    oracle: {
      method: config.oracle.method,
      evidenceClass: config.oracle.evidenceClass,
      harmUnit: config.oracle.harmUnit,
    },
    caveat: describeOracle(config.oracle),
  };
}

/** One actor's deliberation at one tick, as it went out on the stream. */
export interface CapturedDeliberation {
  readonly tick: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface BranchOptions {
  readonly emitter: RunEmitter;
  readonly config: ContestedSystemConfig;
  readonly seed: string;
  /** Stamped on every event when this branch is one world of an ensemble. */
  readonly branchId?: string;
  readonly tickDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface BranchResult {
  readonly events: readonly SimEvent[];
  readonly finalState: ContestedSystemState;
  readonly totalHarm: number;
  readonly activations: number;
  /** Every deliberation, retained so a later stage can pick decision points. */
  readonly deliberations: readonly CapturedDeliberation[];
}

/**
 * Run one world and translate its kernel events onto the run stream.
 *
 * Shared by `runScenario` and the ensemble, so the translation from kernel event
 * to watchable event exists exactly once. A second copy would drift, and the
 * symptom would be a live view that disagrees with the ensemble about what
 * happened in a run they both executed.
 */
export async function driveBranch(
  options: BranchOptions,
): Promise<BranchResult> {
  const { emitter, config, seed, branchId } = options;
  const tickDelayMs = options.tickDelayMs ?? 0;
  const sleep = options.sleep ?? defaultSleep;

  let cumulativeHarm = 0;
  let activations = 0;
  let lastTick = -1;
  const deliberations: CapturedDeliberation[] = [];

  const sink = {
    async appendEvent(raw: unknown): Promise<void> {
      const event = raw as SimEvent;

      // One pause per tick, taken on the tick's first event so the whole tick
      // lands together rather than dribbling out event by event.
      if (tickDelayMs > 0 && event.tick !== lastTick) {
        lastTick = event.tick;
        await sleep(tickDelayMs);
      }

      switch (event.kind) {
        case "truth": {
          const activationList = (event.data.activations ?? []) as readonly {
            harm?: number;
          }[];
          for (const activation of activationList) {
            cumulativeHarm += Number(activation.harm ?? 0);
            activations++;
            emitter.emit({
              type: "activation",
              tick: event.tick,
              branchId,
              payload: activation as Readonly<Record<string, unknown>>,
            });
          }
          emitter.emit({
            type: "tick",
            tick: event.tick,
            branchId,
            heldCount: Number(event.data.heldCount ?? 0),
            cumulativeHarm,
            cumulativeDefenseCost: Number(
              event.data.cumulativeDefenseCost ?? 0,
            ),
          });
          break;
        }

        case "telemetry":
          emitter.emit({
            type: "telemetry",
            tick: event.tick,
            anomalyEvents: Number(event.data.anomalyEvents ?? 0),
            configChangeEvents: Number(event.data.configChangeEvents ?? 0),
            failedAuthEvents: Number(event.data.failedAuthEvents ?? 0),
            serviceComplaints: Number(event.data.serviceComplaints ?? 0),
          });
          break;

        case "deliberation":
          deliberations.push({ tick: event.tick, payload: event.data });
          emitter.emit({
            type: "deliberation",
            tick: event.tick,
            branchId,
            payload: event.data,
          });
          break;
      }
    },
  };

  const result = await runSimulation<
    ContestedSystemConfig,
    ContestedSystemState
  >(CONTESTED_SYSTEM_ADAPTER, config, seed, { sink, observeEvery: 0 });

  return {
    events: result.events,
    finalState: result.finalState,
    totalHarm: cumulativeHarm,
    activations,
    deliberations,
  };
}
