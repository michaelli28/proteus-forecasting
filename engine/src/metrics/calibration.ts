/**
 * Calibration: expected/maximum calibration error and reliability diagrams.
 *
 * Calibration alone is a weak claim — a forecaster that always states the base
 * rate is perfectly calibrated and useless. Always read it beside sharpness
 * (scoring-rules.ts) and resolution (murphy.ts).
 */

import { mean } from "./types.js";
import type { BinaryForecast } from "./types.js";

export interface CalibrationBin {
  readonly lower: number;
  readonly upper: number;
  readonly count: number;
  /** Mean stated probability among forecasts in this bin. */
  readonly meanForecast: number;
  /** Fraction that actually occurred. */
  readonly observedFrequency: number;
  /** observedFrequency − meanForecast. Positive means under-confident. */
  readonly gap: number;
}

export interface CalibrationReport {
  readonly bins: readonly CalibrationBin[];
  /** Count-weighted mean |gap|. Range [0,1]. Lower is better. */
  readonly expectedCalibrationError: number;
  /** Worst single bin |gap|. Catches a bad region that ECE averages away. */
  readonly maximumCalibrationError: number;
  readonly total: number;
}

export const DEFAULT_BIN_COUNT = 10;

/**
 * Bin forecasts by stated probability.
 *
 * Empty bins are retained so a reliability diagram keeps its x-axis, but they
 * contribute nothing to ECE — weighting an empty bin would invent evidence.
 */
export function calibrationBins(
  forecasts: readonly BinaryForecast[],
  binCount = DEFAULT_BIN_COUNT,
): CalibrationBin[] {
  if (binCount < 1) throw new RangeError("binCount must be >= 1");

  const buckets: BinaryForecast[][] = Array.from(
    { length: binCount },
    () => [],
  );
  for (const forecast of forecasts) {
    // The top edge belongs to the last bin so p = 1 is not dropped.
    const raw = Math.floor(forecast.probability * binCount);
    buckets[Math.min(binCount - 1, Math.max(0, raw))]!.push(forecast);
  }

  return buckets.map((members, i) => {
    const meanForecast =
      members.length === 0 ? 0 : mean(members.map((m) => m.probability));
    const observedFrequency =
      members.length === 0 ? 0 : mean(members.map((m) => m.outcome));
    return {
      lower: i / binCount,
      upper: (i + 1) / binCount,
      count: members.length,
      meanForecast,
      observedFrequency,
      gap: members.length === 0 ? 0 : observedFrequency - meanForecast,
    };
  });
}

export function calibrationReport(
  forecasts: readonly BinaryForecast[],
  binCount = DEFAULT_BIN_COUNT,
): CalibrationReport {
  if (forecasts.length === 0) throw new RangeError("no forecasts to calibrate");

  const bins = calibrationBins(forecasts, binCount);
  const total = forecasts.length;

  let ece = 0;
  let mce = 0;
  for (const bin of bins) {
    if (bin.count === 0) continue;
    const absGap = Math.abs(bin.gap);
    ece += (bin.count / total) * absGap;
    mce = Math.max(mce, absGap);
  }

  return {
    bins,
    expectedCalibrationError: ece,
    maximumCalibrationError: mce,
    total,
  };
}

/** Points for a reliability diagram. Empty bins are omitted. */
export function reliabilityDiagram(
  report: CalibrationReport,
): { x: number; y: number; count: number }[] {
  return report.bins
    .filter((bin) => bin.count > 0)
    .map((bin) => ({
      x: bin.meanForecast,
      y: bin.observedFrequency,
      count: bin.count,
    }));
}

/**
 * Signed calibration bias: positive means systematically under-confident,
 * negative means over-confident. ECE reports magnitude and hides direction,
 * and the two call for opposite fixes.
 */
export function calibrationBias(forecasts: readonly BinaryForecast[]): number {
  if (forecasts.length === 0) throw new RangeError("no forecasts");
  return mean(forecasts.map((f) => f.outcome - f.probability));
}
