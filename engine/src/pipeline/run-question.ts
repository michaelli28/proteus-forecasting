/**
 * The orchestrator: one question in, one BLUF product out.
 *
 * Order is the design. The abstention gate runs on mechanically-derived evidence
 * BEFORE any likelihood exists, so a model that declines to adjudicate cannot
 * turn "we should not answer" into "we could not check". Adjudication is a
 * cross-check layered on top of a forecast the ensemble produced on its own —
 * which is why the pipeline still ships a product with no working model at all.
 *
 * Ground truth comes from a separate oracle run whose summary never enters a
 * prompt or an ensemble statistic. Without that separation a Brier score would
 * be measuring the ensemble against itself.
 */

import { hashCanonical } from "../artifact/canonical.js";
import { CorpusSnapshot } from "../corpus/snapshot.js";
import { CANONICAL_DEFINITION } from "../corpus/synthetic.js";
import { runFramer } from "../agents/framer.js";
import { planPanel, runAdjudicator } from "../agents/panel.js";
import { redTeamConfidencePenalty, runRedTeam } from "../agents/red-team.js";
import { LlmError, LlmRefusalError, UsageLedger } from "../llm/client.js";
import { runAch } from "../evidence/ach.js";
import { detectContradictions } from "../evidence/contradiction.js";
import {
  collectSignals,
  evaluateAbstention,
  isAbstention,
  provenanceCompleteness,
} from "../evidence/abstention.js";
import {
  PartitionError,
  resolveOutcome,
  uniformPartition,
} from "../evidence/partition.js";
import { forecastFromEnsemble } from "../metrics/ensemble.js";
import { degradationCheck } from "../metrics/operations.js";
import { mergeEnsembles, runEnsemble, runSeed } from "./ensemble.js";
import {
  achMatrixFromEnsemble,
  assessConfidence,
  claimsFromContradictions,
  claimsFromEnsemble,
  confidenceScore,
  ensembleSummaryText,
  evidenceFromEnsemble,
  indicatorsFromEnsemble,
} from "./analysis.js";
import { buildAbstainedProduct, buildForecastProduct } from "./product.js";
import { bandIndexOf, orderedBands } from "./types.js";
import type { ArtifactStore } from "../artifact/store.js";
import type { AsOfCorpus } from "../corpus/as-of.js";
import type { Framing, RunSpec } from "../agents/framer.js";
import type { AdjudicationResult } from "../agents/panel.js";
import type { RedTeamVerdict } from "../agents/red-team.js";
import type { LlmClient } from "../llm/client.js";
import type {
  AbstentionThresholds,
  AbstentionVerdict,
} from "../evidence/abstention.js";
import type { OutcomeBand, TargetQuantity } from "../evidence/partition.js";
import type {
  AnalyticProduct,
  Claim,
  Indicator,
  KeyAssumption,
  RedTeamChallenge,
} from "../evidence/types.js";
import type { DegradationCheck } from "../metrics/operations.js";
import type { EvaluationRegime } from "../metrics/index.js";
import type { CategoricalForecast } from "../metrics/types.js";
import type { EnsembleResult } from "./ensemble.js";
import type { ConfidenceAssessment } from "./analysis.js";
import type { DomainBinding, RunSummary } from "./types.js";

/** Documents pulled from the as-of corpus for contradiction detection. */
const RETRIEVAL_LIMIT = 12;

const DEFAULT_PANEL_SIZE = 3;
const DEFAULT_RERUN_BUDGET = 1;

export interface QuestionInput {
  readonly question: string;
  readonly quantity: TargetQuantity;
  /** Information cutoff. Nothing published later may be cited. */
  readonly asOf: string;
  readonly rootSeed: string;
  readonly hypothesisCount: number;
  readonly runCount: number;
  readonly concurrency?: number;
  /** Reruns the red team may force. 0 disables the mechanism. */
  readonly rerunBudget?: number;
  readonly panelSize?: number;
  /**
   * The scenario that actually obtains, for synthetic-oracle scoring.
   *
   * Runs in its own seed namespace and is never summarised into a prompt or an
   * ensemble statistic. Omit it and the product is still produced — just
   * explicitly unscorable.
   */
  readonly truth?: RunSpec;
  readonly context?: string;
  /**
   * The region of the adversary parameter space the evidence constrains the
   * actor to. A narrow region is a well-evidenced question; the whole square is
   * a question with nothing to go on, and the gate should say so.
   */
  readonly scenarioPrior?: ScenarioPrior;
  /**
   * Gate thresholds. Defaults to `DEFAULT_ABSTENTION_THRESHOLDS`.
   *
   * Injectable so a threshold chosen from a measured false-abstention curve can
   * actually be adopted, and so the offline sweep that produced that curve can
   * be checked against an end-to-end run at the same setting.
   */
  readonly abstentionThresholds?: AbstentionThresholds;
}

/** Bounds on the two adversary parameters, each in [0,100]. */
export interface ScenarioPrior {
  readonly riskRange: readonly [number, number];
  readonly escalationRange: readonly [number, number];
}

export const FULL_PARAMETER_SQUARE: ScenarioPrior = {
  riskRange: [0, 100],
  escalationRange: [0, 100],
};

export interface QuestionDeps<TConfig, TState> {
  readonly client: LlmClient;
  readonly binding: DomainBinding<TConfig, TState>;
  readonly store: ArtifactStore;
  readonly corpus: AsOfCorpus;
}

export interface OracleOutcome {
  readonly runId: string;
  readonly artifactHash: string;
  readonly value: number;
  readonly bandId: string;
  readonly bandIndex: number;
}

export interface AdjudicationOutcome {
  readonly attempted: number;
  readonly results: readonly AdjudicationResult[];
  /** Deterministic declines. Counted, never retried. */
  readonly refusals: number;
  readonly errors: readonly string[];
  readonly available: boolean;
}

export interface RedTeamOutcomeRecord {
  readonly available: boolean;
  readonly verdict: RedTeamVerdict | null;
  readonly challenges: readonly RedTeamChallenge[];
  readonly forcedRerun: boolean;
  readonly penalty: number;
}

export interface QuestionResult {
  readonly questionId: string;
  readonly question: string;
  readonly asOf: string;
  readonly regime: EvaluationRegime;
  readonly bands: readonly OutcomeBand[];
  readonly bandCount: number;
  readonly framing: Framing;
  readonly framingSource: "llm" | "fallback";
  readonly framingFallbackReason: string | null;
  readonly ensemble: EnsembleResult;
  readonly oracle: OracleOutcome | null;
  readonly abstention: AbstentionVerdict;
  readonly abstained: boolean;
  /** Null whenever the gate fired — there is no likelihood to report. */
  readonly probabilities: readonly number[] | null;
  /** Null when abstained, or when no ground truth resolved the outcome. */
  readonly forecast: CategoricalForecast | null;
  readonly adjudication: AdjudicationOutcome;
  readonly redTeam: RedTeamOutcomeRecord;
  readonly confidence: ConfidenceAssessment;
  readonly degradation: DegradationCheck;
  readonly reruns: number;
  readonly product: AnalyticProduct;
  readonly llmCalls: number;
  readonly costUsd: number;
}

export async function runQuestion<TConfig, TState>(
  deps: QuestionDeps<TConfig, TState>,
  input: QuestionInput,
): Promise<QuestionResult> {
  const ledger = new UsageLedger();
  const questionId = hashCanonical({
    question: input.question,
    quantity: input.quantity,
    asOf: input.asOf,
    rootSeed: input.rootSeed,
    hypothesisCount: input.hypothesisCount,
    runCount: input.runCount,
  });

  const framed = await frameQuestion(deps.client, input, ledger);
  const bands = orderedBands(framed.framing.hypotheses);

  let ensemble = await runEnsemble({
    binding: deps.binding,
    specs: framed.framing.runSpecs,
    bands,
    quantity: input.quantity,
    store: deps.store,
    corpusSnapshotId: deps.corpus.snapshotId,
    seedNamespace: `${input.rootSeed}/ensemble`,
    concurrency: input.concurrency,
  });

  const oracle = input.truth
    ? await resolveOracle(deps, input, bands, input.truth)
    : null;

  const contradictions = detectCorpusContradictions(
    deps.corpus,
    input.question,
  );
  const corpusClaims = claimsFromContradictions(contradictions, deps.corpus);

  const rerunBudget = input.rerunBudget ?? DEFAULT_RERUN_BUDGET;
  let reruns = 0;
  let pass: ForecastPass | null = null;
  let gate: AbstentionVerdict;

  // The loop exists for one reason: a red-team challenge with standing can
  // demand a fresh ensemble, and the gate must then be re-applied to the larger
  // evidence base rather than inherited from the smaller one.
  for (;;) {
    const claims = [
      ...claimsFromEnsemble({
        summaries: ensemble.summaries,
        bands,
        asOf: input.asOf,
      }),
      ...corpusClaims,
    ];

    const ach = runAch(
      achMatrixFromEnsemble(bands, ensemble.summaries, input.asOf),
    );
    gate = evaluateAbstention(
      collectSignals(ach, contradictions, claims),
      input.abstentionThresholds,
    );
    if (isAbstention(gate)) {
      pass = null;
      break;
    }

    pass = await forecastPass({
      deps,
      input,
      bands,
      ensemble,
      claims,
      achScores: ach.scores,
      ledger,
      rerunsUsed: reruns,
      rerunBudget,
    });

    if (!pass.redTeam.forcedRerun) break;

    reruns++;
    ensemble = mergeEnsembles(
      ensemble,
      await runEnsemble({
        binding: deps.binding,
        specs: framed.framing.runSpecs,
        bands,
        quantity: input.quantity,
        store: deps.store,
        corpusSnapshotId: deps.corpus.snapshotId,
        seedNamespace: `${input.rootSeed}/rerun-${reruns}`,
        concurrency: input.concurrency,
      }),
    );
  }

  const confidenceInput = {
    ensembleCompletion: ensemble.completionRatio,
    unresolvedRate: contradictions.unresolvedRate,
    provenanceCompleteness: provenanceCompleteness(
      pass?.claims ??
        claimsForGate(ensemble.summaries, bands, input.asOf, corpusClaims),
    ),
    adjudicationAvailable: pass?.adjudication.available ?? false,
    redTeamPenalty: pass?.redTeam.penalty ?? 0,
  };
  const confidence = assessConfidence(confidenceInput);
  const degradation = degradationCheck(
    ensemble.planned,
    ensemble.summaries.length,
    confidenceScore(
      assessConfidence({ ...confidenceInput, ensembleCompletion: 1 }).level,
    ),
    confidenceScore(confidence.level),
  );

  const claims =
    pass?.claims ??
    claimsForGate(ensemble.summaries, bands, input.asOf, corpusClaims);
  const keyAssumptions = buildKeyAssumptions(
    bands,
    confidence,
    pass?.adjudication.results ?? [],
  );

  const product = pass
    ? buildForecastProduct({
        question: input.question,
        asOf: input.asOf,
        corpusSnapshotId: deps.corpus.snapshotId,
        bands,
        probabilities: pass.probabilities,
        achScores: pass.achScores,
        confidence,
        claims,
        keyAssumptions,
        indicators: pass.indicators,
        redTeam: pass.redTeam.challenges,
      })
    : buildAbstainedProduct({
        question: input.question,
        asOf: input.asOf,
        corpusSnapshotId: deps.corpus.snapshotId,
        bands,
        verdict: gate,
        claims,
        keyAssumptions,
        // A challenge is a challenge to a judgement. Once the gate fires there
        // is no judgement left for one to attach to.
        indicators: [],
        redTeam: [],
      });

  // Layer 3 of the leakage guard. Throws rather than warns: a product citing
  // something published after the cutoff has an invalid score, and shipping it
  // produces a number that looks fine and means nothing.
  deps.corpus.assertNoLeakage(
    product.claims.flatMap((claim) =>
      claim.support.map((ref) => ({
        id: ref.documentId,
        publishedAt: ref.publishedAt,
      })),
    ),
  );

  return {
    questionId,
    question: input.question,
    asOf: input.asOf,
    regime: "synthetic_oracle",
    bands,
    bandCount: bands.length,
    framing: framed.framing,
    framingSource: framed.source,
    framingFallbackReason: framed.reason,
    ensemble,
    oracle,
    abstention: gate,
    abstained: pass === null,
    probabilities: pass?.probabilities ?? null,
    forecast:
      pass && oracle
        ? {
            id: questionId,
            probabilities: pass.probabilities,
            outcomeIndex: oracle.bandIndex,
          }
        : null,
    adjudication: pass?.adjudication ?? EMPTY_ADJUDICATION,
    redTeam: pass?.redTeam ?? EMPTY_RED_TEAM,
    confidence,
    degradation,
    reruns,
    product,
    llmCalls: ledger.callCount,
    costUsd: ledger.totalCostUsd,
  };
}

// ─── Framing ───

interface FramedQuestion {
  readonly framing: Framing;
  readonly source: "llm" | "fallback";
  readonly reason: string | null;
}

/**
 * Frame the question, falling back to a uniform partition when the model will
 * not or cannot.
 *
 * A gappy or overlapping partition is a model failure exactly like a refusal,
 * so both land here: the alternative is a pipeline that produces nothing at all
 * in the regime where the adjudicator already refuses 100% of the time.
 */
async function frameQuestion(
  client: LlmClient,
  input: QuestionInput,
  ledger: UsageLedger,
): Promise<FramedQuestion> {
  try {
    const { framing } = await runFramer(ledger.instrument(client, "framer"), {
      question: input.question,
      quantity: input.quantity,
      hypothesisCount: input.hypothesisCount,
      runCount: input.runCount,
      asOf: input.asOf,
      context: input.context,
    });
    return { framing, source: "llm", reason: null };
  } catch (error) {
    if (!(error instanceof LlmError) && !(error instanceof PartitionError)) {
      throw error;
    }
    return {
      framing: fallbackFraming(input),
      source: "fallback",
      reason: error.message,
    };
  }
}

/** Reciprocal of the golden ratio — the 1-D low-discrepancy sequence's step. */
const GOLDEN_STEP = 0.6180339887498949;

/** Even bands and an evenly-spread parameter sweep. No model involved. */
export function fallbackFraming(input: QuestionInput): Framing {
  const { quantity, runCount } = input;
  const prior = input.scenarioPrior ?? FULL_PARAMETER_SQUARE;
  const hypotheses = uniformPartition(
    quantity,
    input.hypothesisCount,
    (lower, upper) =>
      `${quantity.name} between ${lower.toFixed(3)} and ${upper.toFixed(3)}`,
  );

  const runSpecs: RunSpec[] = Array.from({ length: runCount }, (_, index) => {
    const risk = along(prior.riskRange, (index + 0.5) / runCount);
    // Escalation follows a golden-ratio sequence rather than the same ramp:
    // sweeping both parameters together explores one diagonal line through a
    // two-dimensional space and calls it an ensemble.
    const escalation = along(prior.escalationRange, (index * GOLDEN_STEP) % 1);
    return {
      id: `fallback-${index + 1}`,
      label: `sweep ${index + 1}`,
      riskTolerance: Number(risk.toFixed(2)),
      escalationPropensity: Number(escalation.toFixed(2)),
      rationale: "Deterministic parameter sweep — the framer was unavailable.",
    };
  });

  return {
    restatedQuestion: input.question,
    hypotheses,
    runSpecs,
    partitionRationale:
      "Uniform bands over the quantity's definitional range; exhaustive and non-overlapping by construction.",
  };
}

// ─── Oracle ───

async function resolveOracle<TConfig, TState>(
  deps: QuestionDeps<TConfig, TState>,
  input: QuestionInput,
  bands: readonly OutcomeBand[],
  truth: RunSpec,
): Promise<OracleOutcome | null> {
  const result = await runEnsemble({
    binding: deps.binding,
    specs: [truth],
    bands,
    quantity: input.quantity,
    store: deps.store,
    corpusSnapshotId: deps.corpus.snapshotId,
    seedNamespace: `${input.rootSeed}/oracle`,
    concurrency: 1,
  });

  const summary = result.summaries[0];
  if (!summary) return null;

  const { bandId } = resolveOutcome(bands, summary.quantity);
  return {
    runId: summary.runId,
    artifactHash: summary.artifactHash,
    value: summary.quantity,
    bandId,
    bandIndex: bandIndexOf(bands, bandId),
  };
}

// ─── The forecast pass ───

interface ForecastPass {
  readonly probabilities: readonly number[];
  readonly achScores: ReturnType<typeof runAch>["scores"];
  readonly claims: readonly Claim[];
  readonly indicators: readonly Indicator[];
  readonly adjudication: AdjudicationOutcome;
  readonly redTeam: RedTeamOutcomeRecord;
}

const EMPTY_ADJUDICATION: AdjudicationOutcome = {
  attempted: 0,
  results: [],
  refusals: 0,
  errors: [],
  available: false,
};

const EMPTY_RED_TEAM: RedTeamOutcomeRecord = {
  available: false,
  verdict: null,
  challenges: [],
  forcedRerun: false,
  penalty: 0,
};

interface ForecastPassInput<TConfig, TState> {
  readonly deps: QuestionDeps<TConfig, TState>;
  readonly input: QuestionInput;
  readonly bands: readonly OutcomeBand[];
  readonly ensemble: EnsembleResult;
  readonly claims: readonly Claim[];
  readonly achScores: ReturnType<typeof runAch>["scores"];
  readonly ledger: UsageLedger;
  readonly rerunsUsed: number;
  readonly rerunBudget: number;
}

async function forecastPass<TConfig, TState>(
  args: ForecastPassInput<TConfig, TState>,
): Promise<ForecastPass> {
  const { bands, ensemble, input, deps, ledger } = args;

  // The ensemble IS the forecast. Adjudication cross-checks it and shapes
  // confidence; it does not move these probabilities, which is what lets the
  // product ship while the adjudicator refuses.
  const probabilities = forecastFromEnsemble(
    "ensemble",
    ensemble.summaries.map((summary) => summary.bandIndex),
    bands.length,
    0,
  ).probabilities;

  const leadingIndex = probabilities.reduce(
    (best, p, index) => (p > probabilities[best]! ? index : best),
    0,
  );
  const leadingBand = bands[leadingIndex]!;
  const summaryText = ensembleSummaryText(ensemble.summaries, bands);

  const adjudication = await adjudicate(
    deps.client,
    ledger,
    input,
    bands,
    ensemble.summaries,
    summaryText,
    input.panelSize ?? DEFAULT_PANEL_SIZE,
  );

  const redTeam = await challenge(deps.client, ledger, {
    input,
    bands,
    summaryText,
    leadingHypothesisId: leadingBand.id,
    leadingProbability: probabilities[leadingIndex]!,
    panelReasoning: adjudication.available
      ? adjudication.results
          .map(
            (result) =>
              `${result.adjudicatorName}: ${result.confidenceReasoning}`,
          )
          .join(" | ")
      : "No adjudication available; the judgement rests on the simulation ensemble alone.",
    rerunsUsed: args.rerunsUsed,
    rerunBudget: args.rerunBudget,
  });

  const indicators = mergeIndicators(
    indicatorsFromEnsemble(ensemble.summaries, leadingBand.id),
    adjudication.results.flatMap((result) => result.indicators),
  );

  return {
    probabilities,
    achScores: args.achScores,
    claims: args.claims,
    indicators,
    adjudication,
    redTeam,
  };
}

async function adjudicate(
  client: LlmClient,
  ledger: UsageLedger,
  input: QuestionInput,
  bands: readonly OutcomeBand[],
  summaries: readonly RunSummary[],
  summaryText: string,
  panelSize: number,
): Promise<AdjudicationOutcome> {
  const instrumented = ledger.instrument(client, "panel");
  const evidence = evidenceFromEnsemble(summaries, input.asOf).map((item) => ({
    id: item.id,
    summary: item.summary,
    publishedAt: item.publishedAt,
    sourceId: item.sourceId,
  }));

  let plan;
  try {
    plan = await planPanel(
      instrumented,
      [
        `QUESTION: ${input.question}`,
        `INFORMATION CUTOFF: ${input.asOf}`,
        "",
        "OUTCOME BANDS",
        ...bands.map((band) => `  ${band.id}: ${band.statement}`),
        "",
        summaryText,
      ].join("\n"),
      panelSize,
    );
  } catch (error) {
    return {
      ...EMPTY_ADJUDICATION,
      refusals: error instanceof LlmRefusalError ? 1 : 0,
      errors: [describe(error)],
    };
  }

  const outcomes = await Promise.all(
    plan.adjudicators.map(async (spec) => {
      try {
        return {
          result: await runAdjudicator(instrumented, {
            spec,
            question: input.question,
            asOf: input.asOf,
            hypotheses: bands,
            ensembleSummary: summaryText,
            evidence,
          }),
        };
      } catch (error) {
        return {
          refused: error instanceof LlmRefusalError,
          error: describe(error),
        };
      }
    }),
  );

  const results = outcomes
    .map((outcome) => outcome.result)
    .filter((result): result is AdjudicationResult => result !== undefined);

  return {
    attempted: plan.adjudicators.length,
    results,
    refusals: outcomes.filter((outcome) => outcome.refused).length,
    errors: outcomes
      .map((outcome) => outcome.error)
      .filter((error): error is string => error !== undefined),
    available: results.length > 0,
  };
}

interface ChallengeInput {
  readonly input: QuestionInput;
  readonly bands: readonly OutcomeBand[];
  readonly summaryText: string;
  readonly leadingHypothesisId: string;
  readonly leadingProbability: number;
  readonly panelReasoning: string;
  readonly rerunsUsed: number;
  readonly rerunBudget: number;
}

async function challenge(
  client: LlmClient,
  ledger: UsageLedger,
  args: ChallengeInput,
): Promise<RedTeamOutcomeRecord> {
  try {
    const outcome = await runRedTeam(
      ledger.instrument(client, "red-team"),
      {
        question: args.input.question,
        asOf: args.input.asOf,
        hypotheses: args.bands,
        ensembleSummary: args.summaryText,
        leadingHypothesisId: args.leadingHypothesisId,
        leadingProbability: args.leadingProbability,
        panelReasoning: args.panelReasoning,
      },
      { rerunBudget: args.rerunBudget, rerunsUsed: args.rerunsUsed },
    );

    return {
      available: true,
      verdict: outcome.verdict,
      challenges: outcome.verdict.challenges.map((item) => ({
        challenge: item.challenge,
        severity: item.severity,
        forcesRerun: outcome.forcesRerun,
        targetHypothesis: item.targetHypothesis,
      })),
      forcedRerun: outcome.forcesRerun,
      penalty: redTeamConfidencePenalty(outcome.verdict),
    };
  } catch {
    // A red team that could not run leaves no surviving challenges, so it
    // carries no confidence penalty. Its absence is recorded instead.
    return EMPTY_RED_TEAM;
  }
}

// ─── Assembly helpers ───

function claimsForGate(
  summaries: readonly RunSummary[],
  bands: readonly OutcomeBand[],
  asOf: string,
  corpusClaims: readonly Claim[],
): Claim[] {
  return [...claimsFromEnsemble({ summaries, bands, asOf }), ...corpusClaims];
}

function detectCorpusContradictions(corpus: AsOfCorpus, question: string) {
  const retrieved = corpus.retrieve(question, RETRIEVAL_LIMIT);
  if (retrieved.length === 0) {
    return { conflicts: [], unresolved: [], unresolvedRate: 0 };
  }
  // A snapshot of the retrieved set only. Building it from the visible
  // documents means no code path here can reach a document the cutoff hides,
  // even by mistake.
  const scoped = new CorpusSnapshot({
    documents: [...retrieved],
    sources: [...corpus.sources],
  });
  return detectContradictions(scoped, retrieved, CANONICAL_DEFINITION);
}

function buildKeyAssumptions(
  bands: readonly OutcomeBand[],
  confidence: ConfidenceAssessment,
  adjudications: readonly AdjudicationResult[],
): KeyAssumption[] {
  const affected = bands.map((band) => band.id);

  const structural: KeyAssumption[] = [
    {
      statement:
        "The ensemble's parameter spread contains the scenario that actually obtains.",
      confidence: confidence.level,
      falsifier:
        "A realized value falling outside every band any ensemble member reached.",
      affectedHypotheses: affected,
    },
    {
      // Stated at low confidence deliberately: the model's realism is an
      // assumption, not a result, and the product must not launder it.
      statement:
        "The simulation's dynamics are a usable proxy for the process being forecast.",
      confidence: "low",
      falsifier:
        "A measured outcome the model cannot produce under any parameterisation.",
      affectedHypotheses: affected,
    },
  ];

  const adjudicated = adjudications.flatMap((result) =>
    result.keyAssumptions.map((assumption) => ({
      statement: assumption.statement,
      confidence: result.confidence,
      falsifier: assumption.falsifier,
      affectedHypotheses: affected,
    })),
  );

  return [...structural, ...adjudicated];
}

/** Computed indicators first; a model's assertions are additions, not sources. */
function mergeIndicators(
  computed: readonly Indicator[],
  asserted: readonly Indicator[],
): Indicator[] {
  const seen = new Set(computed.map((indicator) => indicator.observable));
  return [
    ...computed,
    ...asserted.filter((indicator) => !seen.has(indicator.observable)),
  ];
}

function along(range: readonly [number, number], fraction: number): number {
  return range[0] + (range[1] - range[0]) * fraction;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { runSeed };
