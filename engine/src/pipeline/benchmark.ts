/**
 * The synthetic-oracle benchmark.
 *
 * Six arms, scored separately and never pooled, because each answers a
 * different question:
 *
 *   narrow / medium  — is the pipeline's uncertainty honest when the evidence
 *                      genuinely constrains the adversary?
 *   wide-control     — weak evidence, but still answerable (ARM_ANSWERABILITY
 *                      in threshold-sweep.ts). Its skill should fall toward the
 *                      base rate; the gate is not required to fire here.
 *   indistinguishable — the gate's real NEGATIVE control. Bands are finer than
 *                      seed noise, so no ensemble can separate them and every
 *                      question should be abstained on.
 *   tied             — the separation signal's OWN control, added in §8h. Few
 *                      enough bands that the diagnostic-evidence condition is
 *                      inert (B <= 10), and a prior wide enough that the top two
 *                      bands routinely tie. Every other arm leaves separation
 *                      either irrelevant or redundant, so without this one the
 *                      benchmark measures that threshold's cost and never its
 *                      benefit.
 *   misspecified     — the truth is drawn from a region the ensemble was told
 *                      the actor was NOT in. Scores must get worse here. If they
 *                      do not, the metrics are measuring nothing. Questions
 *                      whose truth lands outside every band go unresolved and
 *                      drop out of Brier and coverage.
 *
 * What this does NOT measure: real-world forecasting skill. Ensemble and oracle
 * are drawn from the same simulator, and outside `misspecified` the truth is
 * drawn from the very box the ensemble sweeps, so calibration on those arms
 * holds by construction. A good number here says the pipeline propagates
 * uncertainty correctly — not that the world behaves like the model.
 */

import { Rng } from "../sim/rng.js";
import { DEFAULT_ABSTENTION_THRESHOLDS } from "../evidence/abstention.js";
import { createFailingClient } from "../llm/stub.js";
import { runQuestion } from "./run-question.js";
import { ensembleQualityReport, scoreQuestions } from "./score.js";
import {
  DEFAULT_RESAMPLES,
  stratifiedBootstrap,
} from "../metrics/bootstrap.js";
import type { ArtifactStore } from "../artifact/store.js";
import type { AsOfCorpus } from "../corpus/as-of.js";
import type { LlmClient } from "../llm/client.js";
import type { RunSpec } from "../agents/framer.js";
import type { AbstentionThresholds } from "../evidence/abstention.js";
import type { TargetQuantity } from "../evidence/partition.js";
import type { EvaluationRegime } from "../metrics/index.js";
import type { Interval } from "../metrics/bootstrap.js";
import type { BatchScore, EnsembleQualityReport } from "./score.js";
import type { QuestionResult, ScenarioPrior } from "./run-question.js";
import type { DomainBinding } from "./types.js";

export const BENCHMARK_ARMS = [
  "narrow",
  "medium",
  "wide-control",
  "tied",
  "indistinguishable",
  "misspecified",
] as const;
export type BenchmarkArm = (typeof BENCHMARK_ARMS)[number];

export interface BenchmarkQuestion {
  readonly id: string;
  readonly arm: BenchmarkArm;
  readonly question: string;
  /** What the ensemble is told the actor's parameters are bounded to. */
  readonly prior: ScenarioPrior;
  /** Where the truth is actually drawn from. Differs only in `misspecified`. */
  readonly truthPrior: ScenarioPrior;
  /** How much finer than the benchmark's default this question's bands are. */
  readonly bandMultiplier: number;
  readonly rootSeed: string;
}

export interface BenchmarkOptions<TConfig, TState> {
  readonly binding: DomainBinding<TConfig, TState>;
  readonly store: ArtifactStore;
  readonly corpus: AsOfCorpus;
  readonly quantity: TargetQuantity;
  readonly asOf: string;
  readonly questionsPerArm: number;
  readonly ensembleSize: number;
  readonly bandCount: number;
  readonly seed: string;
  /**
   * Omitted by default. The benchmark runs the fully offline path — the
   * ensemble forecast alone — which is the configuration the system currently
   * ships in, and the one whose numbers are therefore worth having.
   */
  readonly client?: LlmClient;
  readonly regime?: EvaluationRegime;
  /** Gate thresholds for every question. Defaults to the shipped ones. */
  readonly abstentionThresholds?: AbstentionThresholds;
}

export interface ArmReport {
  readonly arm: BenchmarkArm;
  readonly questions: number;
  readonly bandCount: number;
  readonly abstained: number;
  readonly abstentionRate: number;
  /** Ensemble members lost, by the phase that lost them. */
  readonly failuresByPhase: Readonly<Record<string, number>>;
  /** Questions with no resolved outcome — the truth escaped the partition. */
  readonly unresolved: number;
  /** Null when the whole arm abstained — as the negative control should. */
  readonly score: BatchScore | null;
  readonly ensemble: EnsembleQualityReport | null;
  readonly meanCompletionRatio: number;
  /** Null when the arm has nothing to score. */
  readonly intervals: ArmIntervals | null;
}

/**
 * 95% percentile intervals, resampling questions within prior boxes. None for
 * ECE: it is biased upward and not smooth, so a percentile interval undercovers,
 * and outside `misspecified` it is near zero by construction anyway.
 */
export interface ArmIntervals {
  readonly brier: Interval | null;
  readonly skill: Interval | null;
  readonly coverageAt1: Interval | null;
}

export interface BenchmarkReport {
  readonly regime: EvaluationRegime;
  readonly quantity: string;
  readonly bandCount: number;
  readonly ensembleSize: number;
  readonly arms: readonly ArmReport[];
  readonly results: readonly QuestionResult[];
  /**
   * The question definitions, index-aligned with `results`.
   *
   * Carried so downstream analysis can recover which arm a result belongs to
   * without re-deriving the question set from options the report does not keep.
   */
  readonly questions: readonly BenchmarkQuestion[];
  readonly simulationRuns: number;
  readonly thresholds: AbstentionThresholds;
}

const CENTRES: readonly (readonly [number, number])[] = [
  [25, 30],
  [45, 60],
  [65, 40],
  [80, 75],
];

/** Half-width of each arm's prior box, in parameter units. */
const HALF_WIDTHS: Readonly<Record<BenchmarkArm, number>> = {
  narrow: 6,
  medium: 18,
  "wide-control": 50,
  tied: 50,
  indistinguishable: 6,
  misspecified: 6,
};

/**
 * Bands per arm, as a multiple of the benchmark's band count.
 *
 * `indistinguishable` partitions the same range far more finely than the
 * simulator's irreducible seed noise, so no ensemble could separate adjacent
 * bands however much evidence it had. It is the gate's real negative control:
 * a question that CANNOT be answered, as opposed to `wide-control`, which is
 * merely poorly evidenced.
 *
 * `tied` sits deliberately between them at x2: fine enough to split a wide
 * ensemble across bands and tie the leaders, still coarse enough that each band
 * is wide against seed noise (0.0375 vs sd ~= 0.021) and that diagnosticity
 * 2/B clears DIAGNOSTIC_THRESHOLD. Its questions are therefore answerable by
 * the same criterion that makes `indistinguishable` unanswerable, which is what
 * makes an abstention there a measurable false abstention.
 */
const BAND_MULTIPLIERS: Readonly<Record<BenchmarkArm, number>> = {
  narrow: 1,
  medium: 1,
  "wide-control": 1,
  tied: 2,
  indistinguishable: 4,
  misspecified: 1,
};

function box(
  centre: readonly [number, number],
  halfWidth: number,
): ScenarioPrior {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    riskRange: [clamp(centre[0] - halfWidth), clamp(centre[0] + halfWidth)],
    escalationRange: [
      clamp(centre[1] - halfWidth),
      clamp(centre[1] + halfWidth),
    ],
  };
}

/**
 * Deterministic question set.
 *
 * Built from the arm and index alone so the same options reproduce the same
 * benchmark — a benchmark whose questions drift between runs cannot show that a
 * change helped.
 */
export function benchmarkQuestions(
  questionsPerArm: number,
  seed: string,
): BenchmarkQuestion[] {
  const questions: BenchmarkQuestion[] = [];

  for (const arm of BENCHMARK_ARMS) {
    for (let index = 0; index < questionsPerArm; index++) {
      const centre = CENTRES[index % CENTRES.length]!;
      const prior = box(centre, HALF_WIDTHS[arm]);
      // The misspecified arm's truth sits a full 30 units away from where the
      // ensemble was told to look — an analyst who read the evidence backwards.
      const truthCentre: readonly [number, number] =
        arm === "misspecified"
          ? [Math.min(95, centre[0] + 30), Math.min(95, centre[1] + 30)]
          : centre;

      questions.push({
        id: `${arm}-${index + 1}`,
        arm,
        question: `Given the constrained actor profile, where does the targeted quantity land at the resolution tick? (${arm} case ${index + 1})`,
        prior,
        truthPrior: box(truthCentre, HALF_WIDTHS[arm]),
        bandMultiplier: BAND_MULTIPLIERS[arm],
        rootSeed: `${seed}/${arm}/${index + 1}`,
      });
    }
  }

  return questions;
}

/**
 * One uniform draw from a prior box, rounded to hundredths. The truth and the
 * misspecification check's prior draws both come through here, so the check
 * compares the truth with draws made exactly the way the truth was.
 */
export function drawFromBox(
  box: ScenarioPrior,
  seed: string,
): Pick<RunSpec, "riskTolerance" | "escalationPropensity"> {
  const rng = new Rng(seed);
  const risk = rng.uniform(box.riskRange[0], box.riskRange[1]);
  const escalation = rng.uniform(
    box.escalationRange[0],
    box.escalationRange[1],
  );
  return {
    riskTolerance: Number(risk.toFixed(2)),
    escalationPropensity: Number(escalation.toFixed(2)),
  };
}

/** One draw from a prior box. Its seed is disjoint from every ensemble seed. */
export function truthSpec(question: BenchmarkQuestion): RunSpec {
  return {
    id: "truth",
    label: "ground truth",
    ...drawFromBox(question.truthPrior, `${question.rootSeed}/truth-draw`),
    rationale:
      "The scenario that actually obtains. Never shown to the forecaster.",
  };
}

export async function runBenchmark<TConfig, TState>(
  options: BenchmarkOptions<TConfig, TState>,
): Promise<BenchmarkReport> {
  const regime = options.regime ?? "synthetic_oracle";
  const client =
    options.client ?? createFailingClient("benchmark runs offline");
  const questions = benchmarkQuestions(options.questionsPerArm, options.seed);

  const results: QuestionResult[] = [];
  const byArm = new Map<BenchmarkArm, QuestionResult[]>();

  for (const question of questions) {
    const result = await runQuestion(
      {
        client,
        binding: options.binding,
        store: options.store,
        corpus: options.corpus,
      },
      {
        question: question.question,
        quantity: options.quantity,
        asOf: options.asOf,
        rootSeed: question.rootSeed,
        hypothesisCount: options.bandCount * question.bandMultiplier,
        runCount: options.ensembleSize,
        scenarioPrior: question.prior,
        truth: truthSpec(question),
        abstentionThresholds: options.abstentionThresholds,
        // The red team cannot run offline, so no rerun can be forced. Stating
        // it here keeps the benchmark's run count exactly predictable.
        rerunBudget: 0,
      },
    );
    results.push(result);
    byArm.set(question.arm, [...(byArm.get(question.arm) ?? []), result]);
  }

  const arms: ArmReport[] = BENCHMARK_ARMS.map((arm) => {
    const armResults = byArm.get(arm) ?? [];
    const score = safely(() => scoreQuestions(armResults, regime));
    const abstained = armResults.filter((r) => r.abstained).length;
    const failuresByPhase: Record<string, number> = {};
    for (const result of armResults) {
      for (const failure of result.ensemble.failures) {
        failuresByPhase[failure.phase] =
          (failuresByPhase[failure.phase] ?? 0) + 1;
      }
    }
    return {
      arm,
      questions: armResults.length,
      bandCount: options.bandCount * BAND_MULTIPLIERS[arm],
      abstained,
      abstentionRate:
        armResults.length === 0 ? 0 : abstained / armResults.length,
      failuresByPhase,
      unresolved: armResults.filter((r) => !r.abstained && !r.forecast).length,
      score,
      ensemble: safely(() => ensembleQualityReport(armResults)),
      meanCompletionRatio:
        armResults.length === 0
          ? 0
          : armResults.reduce((sum, r) => sum + r.ensemble.completionRatio, 0) /
            armResults.length,
      intervals: score
        ? armIntervals(
            questions.flatMap((question, i) =>
              question.arm === arm ? [{ question, result: results[i]! }] : [],
            ),
            { regime, seed: `${options.seed}/bootstrap/${arm}` },
          )
        : null,
    };
  });

  return {
    regime,
    quantity: options.quantity.name,
    bandCount: options.bandCount,
    ensembleSize: options.ensembleSize,
    arms,
    results,
    questions,
    simulationRuns: results.reduce(
      (sum, r) => sum + r.ensemble.planned + (r.oracle ? 1 : 0),
      0,
    ),
    thresholds: options.abstentionThresholds ?? DEFAULT_ABSTENTION_THRESHOLDS,
  };
}

function armIntervals(
  paired: readonly { question: BenchmarkQuestion; result: QuestionResult }[],
  options: { regime: EvaluationRegime; seed: string },
): ArmIntervals {
  // One seed for all three, so every statistic sees the same resamples and
  // skill's interval is exactly Brier's mapped through 1 − Brier/reference.
  const interval = (statistic: (results: readonly QuestionResult[]) => number) =>
    stratifiedBootstrap(paired, {
      // The prior box a question was drawn around.
      stratumOf: (p) => JSON.stringify(p.question.prior),
      statistic: (sample) => safely(() => statistic(sample.map((p) => p.result))),
      seed: options.seed,
    });
  return {
    brier: interval((r) => scoreQuestions(r, options.regime).report.brier),
    skill: interval(
      (r) => scoreQuestions(r, options.regime).report.brierSkillVsBaseRate,
    ),
    coverageAt1: interval((r) => ensembleQualityReport(r).coverageAt1),
  };
}

/**
 * An arm with nothing scorable reports null, not zero.
 *
 * A zero would read as a perfect Brier on a set that was never scored, which is
 * the single most misleading number this system could emit.
 */
function safely<T>(compute: () => T): T | null {
  try {
    return compute();
  } catch {
    return null;
  }
}

/**
 * The sentence that must travel with every number this benchmark produces.
 *
 * Defined once because it is the claim most likely to be dropped in transit: a
 * dashboard, a slide or a paper that quotes the table without it is asserting
 * real-world skill the system has never measured.
 */
export const SYNTHETIC_ORACLE_CAVEAT = [
  "CAVEAT: synthetic oracle. Ensemble and ground truth come from the same simulator,",
  "so these numbers describe how honestly the pipeline propagates its own uncertainty.",
  "They are not evidence of real-world forecasting skill; historical-backtest and live",
  "post-cutoff accuracy remain NOT YET MEASURED and must never be pooled with these.",
].join("\n");

export const MCE_CAVEAT = [
  "MCE is the worst SINGLE calibration bin. The ensemble's probabilities cluster, so most",
  "bins stay near-empty at any batch size and MCE tracks the emptiest occupied bin rather",
  "than sample size — read ECE, which weights bins by occupancy. (Measured: §8h.)",
].join("\n");

function ci(interval: Interval | null | undefined, digits = 4): string {
  if (!interval) return "";
  const kept =
    interval.resamples < DEFAULT_RESAMPLES
      ? ` (${interval.resamples} scorable resamples)`
      : "";
  return ` [${interval.lower.toFixed(digits)}, ${interval.upper.toFixed(digits)}]${kept}`;
}

const INTERVAL_LEGEND = `[lo, hi] = 95% percentile bootstrap over questions, resampled within each prior box (${DEFAULT_RESAMPLES} resamples, ensembles held fixed). No interval on ECE.`;

export function formatBenchmark(report: BenchmarkReport): string {
  const lines = [
    `PROTEUS benchmark — regime: ${report.regime}`,
    `quantity ${report.quantity}, ${report.bandCount} bands, ${report.ensembleSize} runs/ensemble, ${report.simulationRuns} simulations total`,
    "",
  ];

  for (const arm of report.arms) {
    const lost = Object.entries(arm.failuresByPhase);
    lines.push(
      `── ${arm.arm}  (${arm.questions} questions, ${arm.bandCount} bands, abstained ${arm.abstained}/${arm.questions} = ${(arm.abstentionRate * 100).toFixed(0)}%)`,
      `   runs lost: ${lost.length === 0 ? "none" : lost.map(([phase, n]) => `${n} in ${phase}`).join(", ")}   questions with no resolved outcome: ${arm.unresolved}`,
    );
    if (!arm.score) {
      lines.push("   no scorable forecasts in this arm");
    } else {
      const r = arm.score.report;
      lines.push(
        `   n=${r.n} binary forecasts from ${arm.score.scored} questions`,
        `   Brier ${r.brier.toFixed(4)}${ci(arm.intervals?.brier)}   skill vs base rate ${r.brierSkillVsBaseRate.toFixed(4)}${ci(arm.intervals?.skill)}   ignorance ${r.ignoranceBits.toFixed(3)} bits`,
        `   ECE ${r.expectedCalibrationError.toFixed(4)}   MCE ${r.maximumCalibrationError.toFixed(4)}   sharpness ${r.sharpness.toFixed(4)}${r.isHedging ? "  [HEDGING]" : ""}`,
        `   Murphy: reliability ${r.reliability.toFixed(4)} − resolution ${r.resolution.toFixed(4)} + uncertainty ${r.uncertainty.toFixed(4)}`,
      );
    }
    if (arm.ensemble) {
      lines.push(
        `   coverage@1 ${arm.ensemble.coverageAt1.toFixed(3)}${ci(arm.intervals?.coverageAt1, 3)}   coverage@2 ${arm.ensemble.coverageAt2.toFixed(3)}   tail recall ${arm.ensemble.tailRecall.recall.toFixed(3)} (${arm.ensemble.tailRecall.surprises} surprises)`,
      );
    }
    lines.push("");
  }

  lines.push(INTERVAL_LEGEND, "", MCE_CAVEAT, "", SYNTHETIC_ORACLE_CAVEAT);

  return lines.join("\n");
}
