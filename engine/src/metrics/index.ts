/**
 * The metrics package.
 *
 * Reporting discipline baked into the API surface:
 *
 *   - A Brier score is never reported without a baseline (see baselines.ts).
 *   - Calibration is never reported without sharpness — a system that states the
 *     base rate on everything is perfectly calibrated and worthless.
 *   - A speedup is never reported without a MEASURED manual baseline; the
 *     function requires it as an argument.
 *   - Historical and post-cutoff results are separate figures and this package
 *     provides no function that pools them.
 */

export * from "./types.js";
export * from "./brier.js";
export * from "./murphy.js";
export * from "./calibration.js";
export * from "./scoring-rules.js";
export * from "./baselines.js";
export * from "./ensemble.js";
export * from "./stability.js";
export * from "./agreement.js";
export * from "./analytic-qa.js";
export * from "./operations.js";

import { brierScore, brierSkillScore } from "./brier.js";
import { murphyDecomposition, resolutionRatio } from "./murphy.js";
import { calibrationReport } from "./calibration.js";
import { ignoranceScore, sharpness } from "./scoring-rules.js";
import { baseRateBaseline } from "./baselines.js";
import type { BinaryForecast } from "./types.js";

/** Which evaluation regime produced a number. Never pooled. */
export const EVALUATION_REGIMES = [
  "synthetic_oracle",
  "historical_backtest",
  "live_post_cutoff",
] as const;
export type EvaluationRegime = (typeof EVALUATION_REGIMES)[number];

export interface ForecastQualityReport {
  readonly regime: EvaluationRegime;
  readonly n: number;
  readonly brier: number;
  readonly brierSkillVsBaseRate: number;
  readonly ignoranceBits: number;
  readonly expectedCalibrationError: number;
  readonly maximumCalibrationError: number;
  readonly reliability: number;
  readonly resolution: number;
  readonly uncertainty: number;
  readonly resolutionRatio: number;
  readonly sharpness: number;
  /** True when the system is hedging toward the base rate throughout. */
  readonly isHedging: boolean;
}

/**
 * The standard bundle for a forecast set.
 *
 * `regime` is required so a number cannot travel without the context that makes
 * it meaningful — a spectacular synthetic-oracle Brier says nothing about
 * real-world skill, and the two must never appear in one pooled figure.
 */
export function forecastQualityReport(
  forecasts: readonly BinaryForecast[],
  regime: EvaluationRegime,
): ForecastQualityReport {
  const brier = brierScore(forecasts);
  const decomposition = murphyDecomposition(forecasts);
  const calibration = calibrationReport(forecasts);
  const sharp = sharpness(forecasts);

  return {
    regime,
    n: forecasts.length,
    brier,
    brierSkillVsBaseRate: brierSkillScore(
      brier,
      brierScore(baseRateBaseline(forecasts)),
    ),
    ignoranceBits: ignoranceScore(forecasts),
    expectedCalibrationError: calibration.expectedCalibrationError,
    maximumCalibrationError: calibration.maximumCalibrationError,
    reliability: decomposition.reliability,
    resolution: decomposition.resolution,
    uncertainty: decomposition.uncertainty,
    resolutionRatio: resolutionRatio(decomposition),
    sharpness: sharp.meanDeviationFromBaseRate,
    isHedging: sharp.isHedging,
  };
}

/** Human-readable summary that always carries its regime and caveats. */
export function formatQualityReport(report: ForecastQualityReport): string {
  const lines = [
    `Regime: ${report.regime}  (n=${report.n})`,
    `  Brier              ${report.brier.toFixed(4)}`,
    `  Brier skill vs base rate  ${report.brierSkillVsBaseRate.toFixed(4)}`,
    `  Ignorance          ${report.ignoranceBits.toFixed(4)} bits`,
    `  ECE / MCE          ${report.expectedCalibrationError.toFixed(4)} / ${report.maximumCalibrationError.toFixed(4)}`,
    `  Murphy             rel ${report.reliability.toFixed(4)} - res ${report.resolution.toFixed(4)} + unc ${report.uncertainty.toFixed(4)}`,
    `  Resolution ratio   ${report.resolutionRatio.toFixed(4)}`,
    `  Sharpness          ${report.sharpness.toFixed(4)}`,
  ];
  if (report.isHedging) {
    lines.push(
      "  WARNING: hedging toward the base rate — calibration here is not skill.",
    );
  }
  if (report.regime === "synthetic_oracle") {
    lines.push(
      "  NOTE: synthetic oracle. Says nothing about real-world forecasting skill.",
    );
  }
  return lines.join("\n");
}
