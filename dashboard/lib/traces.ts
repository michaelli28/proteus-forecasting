/**
 * The dashboard's view of a simulation run.
 *
 * Mirrors `engine/src/pipeline/trace.ts` across a package boundary the two
 * cannot share. Nothing in this folder derives a measure — the engine computed
 * every number here, including the detection signatures, so what the page shows
 * is what the pipeline actually used.
 *
 * The `truth` / `telemetry` split is preserved exactly. It is the system's
 * central claim, and a UI that merged the two would quietly undo it.
 */

import raw from "../data/run-traces.json";

export interface TruthTick {
  meanBelief: number;
  variance: number;
  bimodality: number;
  clusterSeparation: number;
  adoptionRate: number;
  injections: number;
  adoptions: number;
  abandonments: number;
  beliefHistogram: number[];
}

export interface TelemetryTick {
  volume: number;
  activeAccounts: number;
  activeDegreeRatio: number;
  clusterActivityShare: number[];
}

export interface TraceTick {
  tick: number;
  truth: TruthTick;
  telemetry: TelemetryTick;
}

export interface WorldSummary {
  agents: number;
  clusters: number;
  narratives: number;
  ticks: number;
  influenceRate: number;
  adoptionThreshold: number;
}

export interface CampaignSummary {
  narrativeId: number;
  startTick: number;
  endTick: number;
  injectionNodes: number;
  targetPosition: number;
  injectionRate: number;
  amplification: number;
  coordinated: boolean;
}

export interface DefenseSummary {
  kind: string;
  startTick: number;
  intensity: number;
  coverage: number;
  costPerTick: number;
}

export interface RunSpecSummary {
  id: string;
  label: string;
  riskTolerance: number;
  escalationPropensity: number;
  rationale: string;
}

export interface DetectionSignatures {
  burstiness: number;
  surgeRatio: number;
  hubConcentration: number;
  clusterSynchrony: number;
  compositeScore: number;
}

export interface RunTrace {
  runId: string;
  kernelVersion: string;
  corpusSnapshotId: string;
  seed: string;
  spec: RunSpecSummary | null;
  world: WorldSummary;
  campaign: CampaignSummary | null;
  defense: DefenseSummary | null;
  histogram: { bins: number; edges: number[] };
  ticks: TraceTick[];
  detection: DetectionSignatures;
  caveat: string;
}

export interface TraceFile {
  traces: RunTrace[];
}

/**
 * The one place the generated file is trusted.
 *
 * Checked rather than assumed: the producer is another package on another
 * release cycle, and a page that renders a half-understood file quietly is
 * worse than one that refuses to build.
 */
function load(): TraceFile {
  const file = raw as unknown as TraceFile;
  if (!Array.isArray(file?.traces) || file.traces.length === 0) {
    throw new Error(
      "run-traces.json has no traces. Regenerate it with: " +
        "cd engine && npm run traces",
    );
  }
  for (const trace of file.traces) {
    if (
      !trace.caveat ||
      !Array.isArray(trace.ticks) ||
      trace.ticks.length === 0
    ) {
      throw new Error(
        `trace "${trace.runId}" is missing its ticks or its synthetic-world caveat`,
      );
    }
  }
  return file;
}

export const TRACES: RunTrace[] = load().traces;

export function traceById(id: string): RunTrace | undefined {
  return TRACES.find((t) => t.runId === id);
}

export function shortId(id: string): string {
  return id.slice(0, 12);
}

/** True while the adversary campaign is injecting at this tick. */
export function campaignActiveAt(trace: RunTrace, tick: number): boolean {
  const c = trace.campaign;
  return c !== null && tick >= c.startTick && tick <= c.endTick;
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * Fixed roles, assigned by meaning rather than by series order.
 *
 * Truth and telemetry never share a hue: the whole point of the two-pane layout
 * is that a reader can tell at a glance which side of the boundary a number
 * came from, and a shared colour would undo that faster than any caption.
 */
export const ROLE_COLOR = {
  truth: "#35b96a",
  telemetry: "#3987e5",
  adversary: "#d55181",
  threshold: "#c98500",
} as const;
