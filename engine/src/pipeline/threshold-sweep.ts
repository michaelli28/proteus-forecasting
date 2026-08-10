/**
 * Measuring the abstention gate's operating point.
 *
 * §8g left one question open: is 0.15 the right ACH separation threshold? The
 * memo is explicit that it must be settled by measuring the false-abstention
 * rate, NOT by tuning until the negative control fires — so this module builds
 * the curve and leaves the choice to whoever reads it.
 *
 * The sweep is offline. `evaluateAbstention` is a pure function of the signals
 * an upstream run already recorded, and in the benchmark configuration nothing
 * downstream of the gate feeds back into those signals: the ensemble, the
 * oracle and the corpus claims are computed identically whichever way the gate
 * goes. One run therefore yields the whole curve, and `sweepAbstentionThresholds`
 * re-checks that assumption on every call rather than trusting it — it throws if
 * replaying the run's own thresholds does not reproduce the run's own decisions.
 *
 * That equivalence is configuration-specific. With a live client and a rerun
 * budget, a red-team challenge can force a second ensemble, and the signals a
 * question ends on then depend on the gate that let it get that far. Sweeping a
 * live batch offline would be measuring a counterfactual that never existed.
 */

import {
  ABSTENTION_REASONS,
  DEFAULT_ABSTENTION_THRESHOLDS,
  evaluateAbstention,
  isAbstention,
} from "../evidence/abstention.js";
import { coverageAtN, forecastFromEnsemble } from "../metrics/ensemble.js";
import { forecastQualityReport } from "../metrics/index.js";
import { toBinary } from "../metrics/types.js";
import type {
  AbstentionReason,
  AbstentionThresholds,
} from "../evidence/abstention.js";
import type { EvaluationRegime } from "../metrics/index.js";
import type { BinaryForecast, CategoricalForecast } from "../metrics/types.js";
import type { BenchmarkArm, BenchmarkReport } from "./benchmark.js";
import type { QuestionResult } from "./run-question.js";

/**
 * Which side of the gate's decision an arm sits on.
 *
 * `misspecified` is deliberately EXCLUDED rather than counted as answerable.
 * Its hypotheses are perfectly separable — the ensemble is confident, it is just
 * pointed at the wrong region — so an abstention there is not the gate catching
 * an unanswerable question. Folding it into either rate would credit or blame
 * the gate for something none of its signals can see.
 */
export type ArmAnswerability = "answerable" | "unanswerable" | "excluded";

export const ARM_ANSWERABILITY: Readonly<
  Record<BenchmarkArm, ArmAnswerability>
> = {
  narrow: "answerable",
  medium: "answerable",
  "wide-control": "answerable",
  // Answerable by the same band-width-against-seed-noise criterion that makes
  // `indistinguishable` unanswerable, and it is the only arm whose abstentions
  // the separation condition can claim credit for.
  tied: "answerable",
  indistinguishable: "unanswerable",
  misspecified: "excluded",
};

export interface ThresholdCandidate {
  readonly label: string;
  readonly thresholds: AbstentionThresholds;
}

/** Candidates that differ from the shipped thresholds in exactly one field. */
export function varyThreshold<K extends keyof AbstentionThresholds>(
  key: K,
  values: readonly AbstentionThresholds[K][],
  base: AbstentionThresholds = DEFAULT_ABSTENTION_THRESHOLDS,
): ThresholdCandidate[] {
  return values.map((value) => ({
    label: `${key}=${value}`,
    thresholds: { ...base, [key]: value },
  }));
}

export interface RetainedScore {
  readonly questions: number;
  /** One-vs-rest points behind the score: questions × bands. */
  readonly binaryPoints: number;
  readonly brier: number;
  readonly brierSkillVsBaseRate: number;
  readonly coverageAt1: number;
}

export interface SweepArmResult {
  readonly arm: BenchmarkArm;
  readonly answerability: ArmAnswerability;
  readonly questions: number;
  readonly abstained: number;
  readonly abstentionRate: number;
  /** Abstentions per gate condition. A question can trip several at once. */
  readonly reasonCounts: Readonly<Record<AbstentionReason, number>>;
  /** Questions no threshold can score — the truth escaped the partition. */
  readonly unresolved: number;
  /**
   * Questions this candidate would PROCEED on that the pipeline cannot answer.
   *
   * An ensemble that lost every member records separation 0 and diagnostic
   * evidence 0, so a candidate permissive on BOTH conditions passes the gate —
   * and `forecastFromEnsemble` then throws rather than producing a forecast.
   * That is neither an abstention nor an answer, so it is held out of the rates
   * below instead of being silently counted as a question the gate let through.
   */
  readonly undecidable: number;
  /** Scored on the questions this threshold let through. Null if none did. */
  readonly retained: RetainedScore | null;
  /**
   * Scored on the questions this threshold stopped.
   *
   * The cost side of the trade. A threshold that abstains on questions the
   * pipeline would have got right is buying safety with accuracy, and that is
   * invisible in an abstention rate alone.
   */
  readonly forfeited: RetainedScore | null;
}

export interface SweepPoint {
  readonly label: string;
  readonly thresholds: AbstentionThresholds;
  readonly arms: readonly SweepArmResult[];
  /** Share of ANSWERABLE questions this threshold refused. Lower is better. */
  readonly falseAbstentionRate: number;
  /** Share of UNANSWERABLE questions this threshold refused. Higher is better. */
  readonly trueAbstentionRate: number;
  /** true − false. The single number an operating point is picked on. */
  readonly youdenJ: number;
}

export interface SignalSpread {
  readonly values: readonly number[];
  readonly min: number;
  readonly mean: number;
  readonly max: number;
}

/** What the gate actually saw, per arm — before any threshold is applied. */
export interface ArmSignalProfile {
  readonly arm: BenchmarkArm;
  readonly questions: number;
  readonly separation: SignalSpread;
  readonly diagnosticEvidenceCount: SignalSpread;
  readonly unresolvedRate: SignalSpread;
  readonly provenanceCompleteness: SignalSpread;
  /** Bands the arm's questions were partitioned into. */
  readonly bandCount: number;
}

export interface SweepReport {
  readonly regime: EvaluationRegime;
  readonly questionsPerArm: number;
  readonly baseline: AbstentionThresholds;
  readonly points: readonly SweepPoint[];
  readonly signals: readonly ArmSignalProfile[];
  /** Questions whose recorded decision was replayed and matched. */
  readonly faithfulnessChecks: number;
}

interface LabelledResult {
  readonly arm: BenchmarkArm;
  readonly result: QuestionResult;
}

/**
 * The forecast the ensemble would have reported, gate or no gate.
 *
 * Recomputed here rather than stored on `QuestionResult`, because an abstained
 * product must carry no likelihood anywhere it could be mistaken for a
 * judgement. This is a measurement artefact and never reaches a product.
 *
 * Null only when the ensemble lost every member, which no threshold can rescue.
 */
export function counterfactualProbabilities(
  result: QuestionResult,
): readonly number[] | null {
  if (result.ensemble.summaries.length === 0) return null;
  return forecastFromEnsemble(
    "ensemble",
    result.ensemble.summaries.map((summary) => summary.bandIndex),
    result.bandCount,
    0,
  ).probabilities;
}

export function sweepAbstentionThresholds(
  report: BenchmarkReport,
  candidates: readonly ThresholdCandidate[],
): SweepReport {
  if (report.questions.length !== report.results.length) {
    throw new RangeError(
      `benchmark report is malformed: ${report.questions.length} questions against ${report.results.length} results`,
    );
  }

  const labelled: LabelledResult[] = report.results.map((result, index) => ({
    arm: report.questions[index]!.arm,
    result,
  }));

  const faithfulnessChecks = assertReplayable(labelled, report.thresholds);
  const arms = report.arms.map((arm) => arm.arm);
  const byArm = new Map(
    arms.map((arm) => [arm, labelled.filter((item) => item.arm === arm)]),
  );

  return {
    regime: report.regime,
    questionsPerArm: report.results.length / Math.max(1, arms.length),
    baseline: report.thresholds,
    points: candidates.map((candidate) =>
      evaluatePoint(candidate, arms, byArm, report.regime),
    ),
    signals: arms.map((arm) => signalProfile(arm, byArm.get(arm) ?? [])),
    faithfulnessChecks,
  };
}

/**
 * Replay the run's own thresholds and demand its own answers back.
 *
 * The whole sweep rests on the gate being a pure function of recorded signals.
 * If that ever stops holding — a feedback path added upstream, a signal not
 * recorded — every curve below becomes fiction, so this fails loudly rather
 * than reporting a number nobody can trust.
 */
function assertReplayable(
  labelled: readonly LabelledResult[],
  thresholds: AbstentionThresholds,
): number {
  for (const { result } of labelled) {
    const replayed = isAbstention(
      evaluateAbstention(result.abstention.signals, thresholds),
    );
    if (replayed !== result.abstained) {
      throw new Error(
        `abstention replay disagrees with the recorded run on ${result.questionId}: recorded ${result.abstained ? "abstain" : "proceed"}, replay says ${replayed ? "abstain" : "proceed"}. The sweep's offline assumption no longer holds.`,
      );
    }
    if (
      !result.abstained &&
      !sameVector(counterfactualProbabilities(result), result.probabilities)
    ) {
      throw new Error(
        `recomputed ensemble forecast disagrees with the reported one on ${result.questionId}. Counterfactual scoring would not be comparable.`,
      );
    }
  }
  return labelled.length;
}

function sameVector(
  left: readonly number[] | null,
  right: readonly number[] | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.length === right.length && left.every((v, i) => v === right[i]!);
}

function evaluatePoint(
  candidate: ThresholdCandidate,
  arms: readonly BenchmarkArm[],
  byArm: ReadonlyMap<BenchmarkArm, readonly LabelledResult[]>,
  regime: EvaluationRegime,
): SweepPoint {
  const armResults = arms.map((arm) =>
    evaluateArm(arm, byArm.get(arm) ?? [], candidate.thresholds, regime),
  );

  return {
    label: candidate.label,
    thresholds: candidate.thresholds,
    arms: armResults,
    falseAbstentionRate: rateOver(armResults, "answerable"),
    trueAbstentionRate: rateOver(armResults, "unanswerable"),
    youdenJ:
      rateOver(armResults, "unanswerable") - rateOver(armResults, "answerable"),
  };
}

function rateOver(
  arms: readonly SweepArmResult[],
  answerability: ArmAnswerability,
): number {
  const selected = arms.filter((arm) => arm.answerability === answerability);
  const decidable = selected.reduce(
    (sum, arm) => sum + arm.questions - arm.undecidable,
    0,
  );
  if (decidable === 0) return 0;
  return selected.reduce((sum, arm) => sum + arm.abstained, 0) / decidable;
}

function evaluateArm(
  arm: BenchmarkArm,
  items: readonly LabelledResult[],
  thresholds: AbstentionThresholds,
  regime: EvaluationRegime,
): SweepArmResult {
  const reasonCounts: Record<AbstentionReason, number> = Object.fromEntries(
    ABSTENTION_REASONS.map((reason) => [reason, 0]),
  ) as Record<AbstentionReason, number>;

  const retained: QuestionResult[] = [];
  const forfeited: QuestionResult[] = [];
  let abstained = 0;
  let unresolved = 0;
  let undecidable = 0;

  for (const { result } of items) {
    const verdict = evaluateAbstention(result.abstention.signals, thresholds);
    const stopped = isAbstention(verdict);
    const forecastable = counterfactualProbabilities(result) !== null;
    if (stopped) {
      abstained++;
      for (const finding of verdict.findings) reasonCounts[finding.reason]++;
    } else if (!forecastable) {
      undecidable++;
    }
    // A question with no resolved outcome is unscorable whichever way the gate
    // went; counting it on either side would move a score for a reason that has
    // nothing to do with the threshold.
    if (!result.oracle || !forecastable) {
      unresolved++;
      continue;
    }
    (stopped ? forfeited : retained).push(result);
  }

  return {
    arm,
    answerability: ARM_ANSWERABILITY[arm],
    questions: items.length,
    abstained,
    abstentionRate: items.length === 0 ? 0 : abstained / items.length,
    reasonCounts,
    unresolved,
    undecidable,
    retained: scoreSubset(retained, regime),
    forfeited: scoreSubset(forfeited, regime),
  };
}

/** Score a subset on its counterfactual forecasts. Null when there are none. */
function scoreSubset(
  results: readonly QuestionResult[],
  regime: EvaluationRegime,
): RetainedScore | null {
  if (results.length === 0) return null;

  const categorical: CategoricalForecast[] = [];
  const binary: BinaryForecast[] = [];

  for (const result of results) {
    const probabilities = counterfactualProbabilities(result);
    if (!probabilities || !result.oracle) continue;
    const forecast: CategoricalForecast = {
      id: result.questionId,
      probabilities: [...probabilities],
      outcomeIndex: result.oracle.bandIndex,
    };
    categorical.push(forecast);
    for (let band = 0; band < probabilities.length; band++) {
      binary.push(toBinary(forecast, band));
    }
  }

  if (binary.length === 0) return null;
  const report = forecastQualityReport(binary, regime);

  return {
    questions: categorical.length,
    binaryPoints: binary.length,
    brier: report.brier,
    brierSkillVsBaseRate: report.brierSkillVsBaseRate,
    coverageAt1: coverageAtN(categorical, 1),
  };
}

function signalProfile(
  arm: BenchmarkArm,
  items: readonly LabelledResult[],
): ArmSignalProfile {
  const spread = (pick: (item: LabelledResult) => number): SignalSpread => {
    const values = items.map(pick);
    if (values.length === 0) return { values, min: 0, mean: 0, max: 0 };
    return {
      values,
      min: Math.min(...values),
      mean: values.reduce((sum, v) => sum + v, 0) / values.length,
      max: Math.max(...values),
    };
  };

  return {
    arm,
    questions: items.length,
    separation: spread((item) => item.result.abstention.signals.separation),
    diagnosticEvidenceCount: spread(
      (item) => item.result.abstention.signals.diagnosticEvidenceCount,
    ),
    unresolvedRate: spread(
      (item) => item.result.abstention.signals.unresolvedRate,
    ),
    provenanceCompleteness: spread(
      (item) => item.result.abstention.signals.provenanceCompleteness,
    ),
    bandCount: items[0]?.result.bandCount ?? 0,
  };
}

export function formatSweep(report: SweepReport): string {
  const lines = [
    `PROTEUS abstention-threshold sweep — regime: ${report.regime}`,
    `${report.questionsPerArm} questions per arm, replayed decisions verified on ${report.faithfulnessChecks} questions`,
    `baseline thresholds: ${JSON.stringify(report.baseline)}`,
    "",
    "── what the gate saw (threshold-independent)",
    "arm                   bands  separation min/mean/max     diagnostic evidence min/mean/max",
  ];

  for (const profile of report.signals) {
    lines.push(
      `${profile.arm.padEnd(21)} ${String(profile.bandCount).padStart(5)}  ` +
        `${fmt(profile.separation.min)} / ${fmt(profile.separation.mean)} / ${fmt(profile.separation.max)}      ` +
        `${fmt(profile.diagnosticEvidenceCount.min, 1)} / ${fmt(profile.diagnosticEvidenceCount.mean, 1)} / ${fmt(profile.diagnosticEvidenceCount.max, 1)}`,
    );
  }

  for (const point of report.points) {
    const undecidable = point.arms.reduce((sum, a) => sum + a.undecidable, 0);
    lines.push(
      "",
      `── ${point.label}   false-abstention ${pct(point.falseAbstentionRate)}  true-abstention ${pct(point.trueAbstentionRate)}  J ${fmt(point.youdenJ)}` +
        (undecidable > 0
          ? `   ⚠ INVALID OPERATING POINT: ${undecidable} question(s) would pass this gate with an empty ensemble, which the pipeline cannot forecast; held out of both rates`
          : ""),
      "   arm                   role          abstained  reasons                          kept: Brier / skill / cov@1     given up: Brier / skill / cov@1",
    );
    for (const arm of point.arms) {
      const reasons =
        Object.entries(arm.reasonCounts)
          .filter(([, count]) => count > 0)
          .map(([reason, count]) => `${reason}×${count}`)
          .join(" ") || "—";
      lines.push(
        `   ${arm.arm.padEnd(21)} ${arm.answerability.padEnd(13)} ` +
          `${String(arm.abstained).padStart(3)}/${String(arm.questions).padEnd(4)}${arm.undecidable > 0 ? `!${arm.undecidable}` : "  "}` +
          `${reasons.padEnd(32)} ${score(arm.retained).padEnd(31)} ${score(arm.forfeited)}`,
      );
    }
  }

  lines.push(
    "",
    "Arms are never pooled: only the abstention RATES cross arms, and they cross them by",
    "answerability label, not by score. The `misspecified` arm is excluded from both rates —",
    "nothing the gate can observe distinguishes it from a well-evidenced question.",
    "",
    "Brier does not compare ACROSS arms partitioned into different band counts: spreading mass",
    "over 16 bands scores a lower Brier than over 4 for reasons of arithmetic, not of skill.",
    "Read each arm's kept-vs-given-up pair against itself; skill vs base rate is the comparable",
    "figure, and even it shifts with the base rate a different band count implies.",
    "",
    "CAVEAT: synthetic oracle. Ensemble and ground truth come from the same simulator, so a",
    "threshold chosen here is calibrated to this benchmark's difficulty, not to the world's.",
    "Historical-backtest and live post-cutoff behaviour remain NOT YET MEASURED.",
  );

  return lines.join("\n");
}

function score(value: RetainedScore | null): string {
  if (!value) return "—";
  return `${value.questions}q ${fmt(value.brier)} / ${fmt(value.brierSkillVsBaseRate)} / ${fmt(value.coverageAt1)}`;
}

function fmt(value: number, digits = 4): string {
  return value.toFixed(digits);
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}
