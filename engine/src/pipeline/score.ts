/**
 * Scoring a batch of questions.
 *
 * Nothing here invents an outcome. A question the gate abstained on, or one run
 * without a ground truth, is NAMED in `skipped` rather than dropped — a scorer
 * that quietly shrinks n reports a better number for having answered less, which
 * is precisely the incentive an abstention mechanism must not create.
 */

import { forecastQualityReport } from "../metrics/index.js";
import { coverageAtN, tailRecall } from "../metrics/ensemble.js";
import { toBinary } from "../metrics/types.js";
import type {
  EvaluationRegime,
  ForecastQualityReport,
} from "../metrics/index.js";
import type { TailRecallReport } from "../metrics/ensemble.js";
import type { BinaryForecast, CategoricalForecast } from "../metrics/types.js";
import type { QuestionResult } from "./run-question.js";

export type SkipReason = "abstained" | "unresolved";

export interface SkippedQuestion {
  readonly questionId: string;
  readonly reason: SkipReason;
}

export interface BatchScore {
  readonly report: ForecastQualityReport;
  readonly scored: number;
  readonly skipped: readonly SkippedQuestion[];
}

/**
 * Score a batch under one regime.
 *
 * Categorical forecasts are expanded one-vs-rest: every band of every question
 * becomes a binary forecast. That is the standard reduction, and it is what
 * makes Brier, Murphy and calibration defined on a system that forecasts over
 * bands rather than over a single event.
 *
 * `regime` is required and never inferred — a synthetic-oracle number and a
 * live post-cutoff number must not meet inside one figure.
 */
export interface ExpandedBatch {
  readonly forecasts: readonly BinaryForecast[];
  readonly scored: number;
  readonly skipped: readonly SkippedQuestion[];
}

/**
 * The one-vs-rest expansion, in one place.
 *
 * Every consumer that wants calibration bins, a reliability diagram or a Brier
 * score has to expand the same way or the figures stop describing the same set.
 */
export function expandToBinary(
  results: readonly QuestionResult[],
): ExpandedBatch {
  const skipped: SkippedQuestion[] = [];
  const forecasts: BinaryForecast[] = [];
  let scored = 0;

  for (const result of results) {
    if (result.abstained || !result.probabilities) {
      skipped.push({ questionId: result.questionId, reason: "abstained" });
      continue;
    }
    if (!result.forecast) {
      skipped.push({ questionId: result.questionId, reason: "unresolved" });
      continue;
    }
    scored++;
    for (let band = 0; band < result.forecast.probabilities.length; band++) {
      forecasts.push(toBinary(result.forecast, band));
    }
  }

  return { forecasts, scored, skipped };
}

export function scoreQuestions(
  results: readonly QuestionResult[],
  regime: EvaluationRegime,
): BatchScore {
  const { forecasts, scored, skipped } = expandToBinary(results);

  if (forecasts.length === 0) {
    throw new RangeError(
      `no scorable forecasts: ${skipped.length} question(s) abstained or went unresolved`,
    );
  }

  return { report: forecastQualityReport(forecasts, regime), scored, skipped };
}

export interface EnsembleQualityReport {
  readonly scored: number;
  readonly abstentionRate: number;
  /** Share of questions whose realized band was the ensemble's top pick. */
  readonly coverageAt1: number;
  readonly coverageAt2: number;
  readonly tailRecall: TailRecallReport;
}

/**
 * How the ensemble performed as an ensemble.
 *
 * Coverage answers the question an analyst actually asks of a scenario set: was
 * what happened among the few scenarios I read? A correct outcome ranked eighth
 * of eight was not delivered to anyone.
 */
export function ensembleQualityReport(
  results: readonly QuestionResult[],
): EnsembleQualityReport {
  const forecasts: CategoricalForecast[] = results
    .map((result) => result.forecast)
    .filter((forecast): forecast is CategoricalForecast => forecast !== null);

  if (forecasts.length === 0) {
    throw new RangeError("no resolved forecasts to report on");
  }

  return {
    scored: forecasts.length,
    abstentionRate:
      results.length === 0
        ? 0
        : results.filter((result) => result.abstained).length / results.length,
    coverageAt1: coverageAtN(forecasts, 1),
    coverageAt2: coverageAtN(forecasts, 2),
    tailRecall: tailRecall(forecasts),
  };
}
