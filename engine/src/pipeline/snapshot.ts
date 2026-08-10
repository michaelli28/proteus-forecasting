/**
 * A benchmark run, flattened into something a dashboard can render.
 *
 * The dashboard lives in another package and cannot import this one, so the
 * seam between them is a JSON file. Everything the UI needs is computed HERE,
 * where the metrics code is, rather than re-derived over there — a reliability
 * curve recomputed in a React component is a second implementation of
 * calibration, and the two will disagree eventually.
 *
 * Two things travel with the numbers by construction: the regime caveat, and
 * the occupancy of the emptiest calibration bin. Both exist so a figure cannot
 * be read as more than it is once it leaves the terminal.
 */

import { calibrationReport } from "../metrics/calibration.js";
import { SYNTHETIC_ORACLE_CAVEAT } from "./benchmark.js";
import { expandToBinary } from "./score.js";
import { ARM_ANSWERABILITY } from "./threshold-sweep.js";
import type { AbstentionThresholds } from "../evidence/abstention.js";
import type { EvaluationRegime } from "../metrics/index.js";
import type { BenchmarkArm, BenchmarkReport } from "./benchmark.js";
import type { QuestionResult } from "./run-question.js";
import type { ArmAnswerability, SweepReport } from "./threshold-sweep.js";

export interface CalibrationPoint {
  readonly forecast: number;
  readonly observed: number;
  readonly count: number;
}

export interface ScoreSnapshot {
  /** One-vs-rest points behind the figures. */
  readonly n: number;
  readonly questions: number;
  readonly brier: number;
  readonly brierSkillVsBaseRate: number;
  readonly ignoranceBits: number;
  readonly expectedCalibrationError: number;
  readonly maximumCalibrationError: number;
  readonly reliability: number;
  readonly resolution: number;
  readonly uncertainty: number;
  readonly sharpness: number;
  readonly isHedging: boolean;
  /**
   * Forecasts in the emptiest occupied calibration bin.
   *
   * Travels with MCE because MCE IS that bin. At 1 or 2 the figure is a
   * sample-size artefact, and §8h measured that it does not improve with batch
   * size — so the UI has what it needs to say so rather than print a number
   * that looks like a calibration failure.
   */
  readonly emptiestOccupiedBin: number;
  readonly occupiedBins: number;
}

export interface EnsembleSnapshot {
  readonly coverageAt1: number;
  readonly coverageAt2: number;
  readonly tailRecall: number;
  readonly surprises: number;
}

export interface ArmSnapshot {
  readonly arm: BenchmarkArm;
  readonly answerability: ArmAnswerability;
  readonly bands: number;
  readonly questions: number;
  readonly abstained: number;
  readonly abstentionRate: number;
  readonly unresolved: number;
  readonly meanCompletionRatio: number;
  /** Null when the arm abstained on everything — never zero. */
  readonly score: ScoreSnapshot | null;
  readonly calibration: readonly CalibrationPoint[];
  readonly ensemble: EnsembleSnapshot | null;
}

/** One point on the abstention gate's operating curve. */
export interface OperatingPoint {
  readonly minSeparation: number;
  readonly falseAbstentionRate: number;
  readonly trueAbstentionRate: number;
  readonly youdenJ: number;
  /** Questions this setting would pass that the pipeline cannot forecast. */
  readonly undecidable: number;
}

export interface CostSnapshot {
  readonly llmCalls: number;
  readonly costUsd: number;
  readonly questionsAnswered: number;
  /** Null when no model ran — an unpriced run is not a free one. */
  readonly costPerAnswerUsd: number | null;
  readonly modelInLoop: boolean;
}

export interface BenchmarkSnapshot {
  /** Caller-supplied batch label, e.g. "80x32". */
  readonly label: string;
  /** Caller-supplied. `src/pipeline/` may not read the clock — see §8b. */
  readonly generatedAt: string;
  readonly regime: EvaluationRegime;
  readonly quantity: string;
  readonly bandCount: number;
  readonly ensembleSize: number;
  readonly questionsPerArm: number;
  readonly simulationRuns: number;
  readonly thresholds: AbstentionThresholds;
  readonly arms: readonly ArmSnapshot[];
  readonly operatingCurve: readonly OperatingPoint[];
  readonly cost: CostSnapshot;
  readonly caveat: string;
}

/**
 * The published file.
 *
 * A LIST, even with one entry. "Skill over time" needs at least two runs, and a
 * shape that can only hold one would force the UI to either invent a trend or
 * pretend the question was never asked.
 */
export interface SnapshotFile {
  readonly snapshots: readonly BenchmarkSnapshot[];
}

export interface SnapshotOptions {
  readonly label: string;
  readonly generatedAt: string;
  /** A minSeparation sweep of the same run. Any other sweep is meaningless here. */
  readonly separationSweep?: SweepReport;
}

export function benchmarkSnapshot(
  report: BenchmarkReport,
  options: SnapshotOptions,
): BenchmarkSnapshot {
  const byArm = groupByArm(report);

  return {
    label: options.label,
    generatedAt: options.generatedAt,
    regime: report.regime,
    quantity: report.quantity,
    bandCount: report.bandCount,
    ensembleSize: report.ensembleSize,
    questionsPerArm:
      report.arms.length === 0 ? 0 : report.results.length / report.arms.length,
    simulationRuns: report.simulationRuns,
    thresholds: report.thresholds,
    arms: report.arms.map((arm) =>
      armSnapshot(arm, byArm.get(arm.arm) ?? [], report.regime),
    ),
    operatingCurve: operatingCurve(options.separationSweep),
    cost: costSnapshot(report.results),
    caveat: SYNTHETIC_ORACLE_CAVEAT,
  };
}

function groupByArm(
  report: BenchmarkReport,
): Map<BenchmarkArm, QuestionResult[]> {
  const byArm = new Map<BenchmarkArm, QuestionResult[]>();
  report.results.forEach((result, index) => {
    const arm = report.questions[index]!.arm;
    byArm.set(arm, [...(byArm.get(arm) ?? []), result]);
  });
  return byArm;
}

function armSnapshot(
  arm: BenchmarkReport["arms"][number],
  results: readonly QuestionResult[],
  regime: EvaluationRegime,
): ArmSnapshot {
  const { forecasts } = expandToBinary(results);
  const bins =
    forecasts.length === 0
      ? []
      : calibrationReport(forecasts).bins.filter((bin) => bin.count > 0);

  return {
    arm: arm.arm,
    answerability: ARM_ANSWERABILITY[arm.arm],
    bands: arm.bandCount,
    questions: arm.questions,
    abstained: arm.abstained,
    abstentionRate: arm.abstentionRate,
    unresolved: arm.unresolved,
    meanCompletionRatio: arm.meanCompletionRatio,
    score: arm.score
      ? {
          n: arm.score.report.n,
          questions: arm.score.scored,
          brier: arm.score.report.brier,
          brierSkillVsBaseRate: arm.score.report.brierSkillVsBaseRate,
          ignoranceBits: arm.score.report.ignoranceBits,
          expectedCalibrationError: arm.score.report.expectedCalibrationError,
          maximumCalibrationError: arm.score.report.maximumCalibrationError,
          reliability: arm.score.report.reliability,
          resolution: arm.score.report.resolution,
          uncertainty: arm.score.report.uncertainty,
          sharpness: arm.score.report.sharpness,
          isHedging: arm.score.report.isHedging,
          emptiestOccupiedBin:
            bins.length === 0 ? 0 : Math.min(...bins.map((b) => b.count)),
          occupiedBins: bins.length,
        }
      : null,
    calibration: bins.map((bin) => ({
      forecast: bin.meanForecast,
      observed: bin.observedFrequency,
      count: bin.count,
    })),
    ensemble: arm.ensemble
      ? {
          coverageAt1: arm.ensemble.coverageAt1,
          coverageAt2: arm.ensemble.coverageAt2,
          tailRecall: arm.ensemble.tailRecall.recall,
          surprises: arm.ensemble.tailRecall.surprises,
        }
      : null,
  };
}

function operatingCurve(sweep?: SweepReport): OperatingPoint[] {
  if (!sweep) return [];
  return sweep.points.map((point) => ({
    minSeparation: point.thresholds.minSeparation,
    falseAbstentionRate: point.falseAbstentionRate,
    trueAbstentionRate: point.trueAbstentionRate,
    youdenJ: point.youdenJ,
    undecidable: point.arms.reduce((sum, arm) => sum + arm.undecidable, 0),
  }));
}

function costSnapshot(results: readonly QuestionResult[]): CostSnapshot {
  const llmCalls = results.reduce((sum, r) => sum + r.llmCalls, 0);
  const costUsd = results.reduce((sum, r) => sum + r.costUsd, 0);
  const questionsAnswered = results.filter(
    (r) => !r.abstained && r.forecast,
  ).length;

  return {
    llmCalls,
    costUsd,
    questionsAnswered,
    // A run with no model in it has no cost per insight — reporting $0.00
    // would read as "insights are free" rather than "nothing was priced".
    costPerAnswerUsd:
      llmCalls === 0 || questionsAnswered === 0
        ? null
        : costUsd / questionsAnswered,
    modelInLoop: llmCalls > 0,
  };
}
