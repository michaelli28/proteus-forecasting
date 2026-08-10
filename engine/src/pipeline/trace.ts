/**
 * One simulation run, flattened into something a dashboard can render.
 *
 * The same seam as `snapshot.ts` and for the same reason: the dashboard is
 * another package that cannot import this one, so the two meet at a JSON file
 * and everything derived is derived HERE. A detection signature recomputed in a
 * React component is a second implementation of the detector.
 *
 * Domain-specific, like `influence-ops-binding.ts` — it reads field names the
 * influence-ops adapter emits. The kernel stays domain-free; this does not
 * pretend to.
 *
 * The structural point of this file is the `truth` / `telemetry` split on every
 * tick. It mirrors the two event kinds exactly, so a consumer that wants to show
 * "what a defender could see" cannot reach ground truth by accident, and a
 * reader looking at the two panes can see how little the defender actually has.
 */

import { deriveSignatures } from "../sim/adapters/influence-ops/observable.js";
import {
  BELIEF_HISTOGRAM_BINS,
  histogramBinEdges,
} from "../sim/adapters/influence-ops/measures.js";
import type { DetectionSignatures } from "../sim/adapters/influence-ops/observable.js";
import type { ObservableTick } from "../sim/adapters/influence-ops/observable.js";

/**
 * What actually happened. A defender cannot observe any of it.
 *
 * Everything here comes off the `truth` event kind, which the adapter keeps
 * separate from telemetry precisely so this boundary survives serialisation.
 */
export interface TruthTick {
  readonly meanBelief: number;
  readonly variance: number;
  readonly bimodality: number;
  readonly clusterSeparation: number;
  readonly adoptionRate: number;
  /** Adversary injection events applied this tick. */
  readonly injections: number;
  /** Agents crossing the adoption threshold upward this tick. */
  readonly adoptions: number;
  /** Agents crossing back down. */
  readonly abandonments: number;
  /** Bin counts over [0,1]. Sums to the population. */
  readonly beliefHistogram: readonly number[];
}

/** What a platform's telemetry could plausibly capture, and nothing more. */
export interface TelemetryTick {
  readonly volume: number;
  readonly activeAccounts: number;
  readonly activeDegreeRatio: number;
  readonly clusterActivityShare: readonly number[];
}

export interface TraceTick {
  readonly tick: number;
  readonly truth: TruthTick;
  readonly telemetry: TelemetryTick;
}

export interface WorldSummary {
  readonly agents: number;
  readonly clusters: number;
  readonly narratives: number;
  readonly ticks: number;
  readonly influenceRate: number;
  readonly adoptionThreshold: number;
}

export interface CampaignSummary {
  readonly narrativeId: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly injectionNodes: number;
  readonly targetPosition: number;
  readonly injectionRate: number;
  readonly amplification: number;
  readonly coordinated: boolean;
}

export interface DefenseSummary {
  readonly kind: string;
  readonly startTick: number;
  readonly intensity: number;
  readonly coverage: number;
  readonly costPerTick: number;
}

export const SYNTHETIC_WORLD_CAVEAT =
  "SYNTHETIC WORLD. Every reading here comes from a simulation of a fictitious " +
  "population. No real account, platform or person is represented, and nothing " +
  "here is evidence about actual events.";

/**
 * The two adversary knobs this run was drawn from.
 *
 * Present because "why did this member land there" is the first question anyone
 * asks of an outlying ensemble run, and the answer is always these two numbers.
 */
export interface RunSpecSummary {
  readonly id: string;
  readonly label: string;
  readonly riskTolerance: number;
  readonly escalationPropensity: number;
  readonly rationale: string;
}

export interface RunTrace {
  readonly runId: string;
  readonly kernelVersion: string;
  readonly corpusSnapshotId: string;
  readonly seed: string;
  /** Null when the run was driven directly rather than by a run spec. */
  readonly spec: RunSpecSummary | null;
  readonly world: WorldSummary;
  /** Null on a control run — the arm with no adversary in it. */
  readonly campaign: CampaignSummary | null;
  readonly defense: DefenseSummary | null;
  readonly histogram: {
    readonly bins: number;
    /** Lower edge per bin, so the UI never re-derives the geometry. */
    readonly edges: readonly number[];
  };
  readonly ticks: readonly TraceTick[];
  /**
   * Whole-run detection signatures, from telemetry alone.
   *
   * Included so a reader can compare what the detector concluded against what
   * was actually happening — the comparison is the point of the whole
   * truth/telemetry split, and it cannot be made from either stream by itself.
   */
  readonly detection: DetectionSignatures;
  readonly caveat: string;
}

export class TraceError extends Error {}

/** The raw shape the adapter writes. Narrowed rather than trusted. */
interface RawEvent {
  readonly tick: number;
  readonly kind: string;
  readonly data: Record<string, unknown>;
}

/**
 * Build a trace from a run's identity and its event log.
 *
 * Pure: the caller does the reading. That keeps this testable without a
 * filesystem, and it is the only reason the trace tests run in milliseconds.
 */
export function buildRunTrace(
  runId: string,
  identity: unknown,
  events: readonly unknown[],
): RunTrace {
  const { config, kernelVersion, corpusSnapshotId } = narrowIdentity(identity);
  const parsed = events.map(narrowEvent);

  const truth = new Map<number, RawEvent>();
  const telemetry = new Map<number, RawEvent>();
  for (const event of parsed) {
    if (event.kind === "truth") truth.set(event.tick, event);
    else if (event.kind === "telemetry") telemetry.set(event.tick, event);
  }

  if (truth.size === 0) {
    throw new TraceError(
      `run ${runId} has no truth events — it was never stepped, or its event log is truncated`,
    );
  }

  const ticks: TraceTick[] = [...truth.keys()]
    .sort((a, b) => a - b)
    .map((tick) => ({
      tick,
      truth: truthTick(truth.get(tick)!),
      telemetry: telemetryTick(telemetry.get(tick)),
    }));

  const observable: ObservableTick[] = ticks.map((t) => ({
    tick: t.tick,
    volume: t.telemetry.volume,
    activeAccounts: t.telemetry.activeAccounts,
    activeDegreeRatio: t.telemetry.activeDegreeRatio,
    clusterActivityShare: [...t.telemetry.clusterActivityShare],
  }));

  const bins = ticks[0]!.truth.beliefHistogram.length || BELIEF_HISTOGRAM_BINS;

  return {
    runId,
    kernelVersion,
    corpusSnapshotId,
    seed: config.seed,
    spec: config.spec,
    world: config.world,
    campaign: config.campaign,
    defense: config.defense,
    histogram: { bins, edges: histogramBinEdges(bins) },
    ticks,
    detection: deriveSignatures(observable),
    caveat: SYNTHETIC_WORLD_CAVEAT,
  };
}

function truthTick(event: RawEvent): TruthTick {
  const d = event.data;
  return {
    meanBelief: num(d.meanBelief),
    variance: num(d.variance),
    bimodality: num(d.bimodality),
    clusterSeparation: num(d.clusterSeparation),
    adoptionRate: num(d.adoptionRate),
    injections: num(d.injections),
    adoptions: num(d.adoptions),
    abandonments: num(d.abandonments),
    beliefHistogram: numbers(d.beliefHistogram),
  };
}

/**
 * A tick with no telemetry reads as silence, not as a hole.
 *
 * Zero is the honest value: the telemetry event is only absent when nothing was
 * observable, and a null would force every consumer downstream to decide what
 * an absent activity reading means.
 */
function telemetryTick(event: RawEvent | undefined): TelemetryTick {
  const d = event?.data ?? {};
  return {
    volume: num(d.volume),
    activeAccounts: num(d.activeAccounts),
    activeDegreeRatio: num(d.activeDegreeRatio),
    clusterActivityShare: numbers(d.clusterActivityShare),
  };
}

interface NarrowedIdentity {
  readonly kernelVersion: string;
  readonly corpusSnapshotId: string;
  readonly config: {
    readonly seed: string;
    readonly spec: RunSpecSummary | null;
    readonly world: WorldSummary;
    readonly campaign: CampaignSummary | null;
    readonly defense: DefenseSummary | null;
  };
}

/**
 * Two identity shapes reach this function and both are legitimate.
 *
 * The pipeline wraps the world config as `config.domain` alongside the run spec
 * and seed that produced it; a simulation driven directly puts the world config
 * at `config`. Unwrapping one level when `domain` is present handles both
 * without either caller having to know about the other.
 */
function narrowIdentity(identity: unknown): NarrowedIdentity {
  if (!isRecord(identity)) {
    throw new TraceError("identity.json is not an object");
  }
  const outer = identity.config;
  if (!isRecord(outer)) {
    throw new TraceError("identity.json has no config");
  }
  const config = isRecord(outer.domain) ? outer.domain : outer;

  const population = isRecord(config.population) ? config.population : {};
  const campaign = isRecord(config.campaign) ? config.campaign : null;
  const defense = isRecord(config.defense) ? config.defense : null;
  const spec = isRecord(outer.spec) ? outer.spec : null;

  return {
    kernelVersion: str(identity.kernelVersion),
    corpusSnapshotId: str(identity.corpusSnapshotId),
    config: {
      seed: str(outer.seed),
      spec: spec
        ? {
            id: str(spec.id),
            label: str(spec.label),
            riskTolerance: num(spec.riskTolerance),
            escalationPropensity: num(spec.escalationPropensity),
            rationale: str(spec.rationale),
          }
        : null,
      world: {
        agents: num(population.agents),
        clusters: num(population.clusters),
        narratives: num(config.narratives),
        ticks: num(config.ticks),
        influenceRate: num(config.influenceRate),
        // Fixed by the model rather than configured, but a reader cannot
        // interpret the adoption curve without knowing where the line is.
        adoptionThreshold: 0.6,
      },
      campaign: campaign
        ? {
            narrativeId: num(campaign.narrativeId),
            startTick: num(campaign.startTick),
            endTick: num(campaign.endTick),
            injectionNodes: num(campaign.injectionNodes),
            targetPosition: num(campaign.targetPosition),
            injectionRate: num(campaign.injectionRate),
            amplification: num(campaign.amplification),
            coordinated: Boolean(campaign.coordinated),
          }
        : null,
      defense:
        defense && defense.kind !== "none"
          ? {
              kind: str(defense.kind),
              startTick: num(defense.startTick),
              intensity: num(defense.intensity),
              coverage: num(defense.coverage),
              costPerTick: num(defense.costPerTick),
            }
          : null,
    },
  };
}

function narrowEvent(event: unknown): RawEvent {
  if (!isRecord(event) || typeof event.tick !== "number") {
    throw new TraceError("event log contains a line that is not an event");
  }
  return {
    tick: event.tick,
    kind: str(event.kind),
    data: isRecord(event.data) ? event.data : {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numbers(value: unknown): number[] {
  return Array.isArray(value) ? value.map(num) : [];
}

/** The published file. A list so several runs can be compared side by side. */
export interface TraceFile {
  readonly traces: readonly RunTrace[];
}
