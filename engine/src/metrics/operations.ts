/**
 * Cost, throughput, scalability and reliability.
 *
 * Every "time saved" figure needs a MEASURED manual baseline, never an assumed
 * one. The functions here take the baseline as a required argument so an
 * unmeasured comparison cannot be produced by accident.
 */

import { mean } from "./types.js";

// ─── Cost ───

export interface CostInputs {
  readonly totalCostUsd: number;
  readonly scenarios: number;
  readonly forecasts: number;
  /** Insights an analyst judged decision-relevant. Requires human review. */
  readonly decisionRelevantInsights?: number;
}

export interface CostReport {
  readonly totalCostUsd: number;
  readonly costPerScenario: number;
  readonly costPerForecast: number;
  /** Undefined until a human has actually judged relevance. */
  readonly costPerDecisionRelevantInsight?: number;
}

export function costReport(inputs: CostInputs): CostReport {
  if (inputs.scenarios <= 0) throw new RangeError("scenarios must be > 0");
  if (inputs.forecasts <= 0) throw new RangeError("forecasts must be > 0");

  return {
    totalCostUsd: inputs.totalCostUsd,
    costPerScenario: inputs.totalCostUsd / inputs.scenarios,
    costPerForecast: inputs.totalCostUsd / inputs.forecasts,
    costPerDecisionRelevantInsight:
      inputs.decisionRelevantInsights && inputs.decisionRelevantInsights > 0
        ? inputs.totalCostUsd / inputs.decisionRelevantInsights
        : undefined,
  };
}

export interface TimeComparison {
  readonly systemSeconds: number;
  /** Measured, not assumed. Required. */
  readonly manualBaselineSeconds: number;
  readonly speedup: number;
  readonly analystHoursDisplaced: number;
}

/**
 * Time-to-product against a measured manual baseline.
 *
 * The baseline is a required parameter precisely so nobody can report a speedup
 * against a number somebody guessed.
 */
export function timeComparison(
  systemSeconds: number,
  manualBaselineSeconds: number,
): TimeComparison {
  if (manualBaselineSeconds <= 0) {
    throw new RangeError("manual baseline must be measured and > 0");
  }
  return {
    systemSeconds,
    manualBaselineSeconds,
    speedup: manualBaselineSeconds / systemSeconds,
    analystHoursDisplaced: Math.max(
      0,
      (manualBaselineSeconds - systemSeconds) / 3600,
    ),
  };
}

// ─── Scalability ───

export interface ScalingPoint {
  readonly n: number;
  readonly wallClockSeconds: number;
  readonly costUsd: number;
}

export interface ScalingReport {
  readonly points: readonly ScalingPoint[];
  /** Slope of wall-clock vs N by least squares. Flat means good parallelism. */
  readonly wallClockSlope: number;
  /** Cost per scenario at each N; should be flat or falling. */
  readonly costPerScenario: readonly number[];
  /** True when cost per scenario does not grow with N. */
  readonly costIsSublinear: boolean;
}

export function scalingReport(points: readonly ScalingPoint[]): ScalingReport {
  if (points.length < 2)
    throw new RangeError("scaling needs at least 2 points");

  const sorted = [...points].sort((a, b) => a.n - b.n);
  const xs = sorted.map((p) => p.n);
  const ys = sorted.map((p) => p.wallClockSeconds);
  const meanX = mean(xs);
  const meanY = mean(ys);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < xs.length; i++) {
    numerator += (xs[i]! - meanX) * (ys[i]! - meanY);
    denominator += (xs[i]! - meanX) ** 2;
  }

  const costPerScenario = sorted.map((p) => p.costUsd / p.n);
  const first = costPerScenario[0]!;
  const last = costPerScenario[costPerScenario.length - 1]!;

  return {
    points: sorted,
    wallClockSlope: denominator === 0 ? 0 : numerator / denominator,
    costPerScenario,
    // Small tolerance: measurement noise should not flip the verdict.
    costIsSublinear: last <= first * 1.05,
  };
}

// ─── Reliability ───

export interface RunOutcome {
  readonly runId: string;
  readonly completed: boolean;
  readonly errorPhase?: string;
}

export interface ReliabilityReport {
  readonly total: number;
  readonly completed: number;
  readonly completionRate: number;
  /** Failure counts by phase, so the weak stage is visible. */
  readonly failuresByPhase: Readonly<Record<string, number>>;
}

/** Instruments the JOB_ERROR path the codebase already emits. */
export function reliabilityReport(
  outcomes: readonly RunOutcome[],
): ReliabilityReport {
  const completed = outcomes.filter((o) => o.completed).length;
  const failuresByPhase: Record<string, number> = {};
  for (const outcome of outcomes) {
    if (outcome.completed) continue;
    const phase = outcome.errorPhase ?? "unknown";
    failuresByPhase[phase] = (failuresByPhase[phase] ?? 0) + 1;
  }
  return {
    total: outcomes.length,
    completed,
    completionRate: outcomes.length === 0 ? 0 : completed / outcomes.length,
    failuresByPhase,
  };
}

export interface DegradationCheck {
  readonly runsPlanned: number;
  readonly runsCompleted: number;
  readonly completionRatio: number;
  readonly confidenceBefore: number;
  readonly confidenceAfter: number;
  /** Did confidence actually fall when runs were lost? */
  readonly confidenceDropped: boolean;
  /** True when confidence held steady despite losing runs — a defect. */
  readonly failedToDegrade: boolean;
}

/**
 * Graceful degradation: with k of N runs lost, did confidence drop?
 *
 * A system reporting the same confidence on 3 runs as on 10 is not robust, it
 * is not listening. `failedToDegrade` is the assertion a test should make.
 */
export function degradationCheck(
  runsPlanned: number,
  runsCompleted: number,
  confidenceBefore: number,
  confidenceAfter: number,
): DegradationCheck {
  if (runsPlanned <= 0) throw new RangeError("runsPlanned must be > 0");
  const lost = runsCompleted < runsPlanned;
  const dropped = confidenceAfter < confidenceBefore;
  return {
    runsPlanned,
    runsCompleted,
    completionRatio: runsCompleted / runsPlanned,
    confidenceBefore,
    confidenceAfter,
    confidenceDropped: dropped,
    failedToDegrade: lost && !dropped,
  };
}

export interface ReproducibilityCheck {
  readonly runId: string;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly reproduced: boolean;
}

/** Pinned seed plus pinned corpus must yield an identical artifact hash. */
export function reproducibilityCheck(
  runId: string,
  expectedHash: string,
  actualHash: string,
): ReproducibilityCheck {
  return {
    runId,
    expectedHash,
    actualHash,
    reproduced: expectedHash === actualHash,
  };
}

export function reproducibilityRate(
  checks: readonly ReproducibilityCheck[],
): number {
  if (checks.length === 0) return 1;
  return checks.filter((c) => c.reproduced).length / checks.length;
}
