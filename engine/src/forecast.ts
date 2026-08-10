/**
 * One question, answered from the command line.
 *
 * The pipeline had no entry point outside its tests, which meant the Phase-1
 * slice could be verified but not shown. This is that entry point, and it is
 * deliberately thin: it builds the four dependencies `runQuestion` needs, calls
 * it, and gets out of the way.
 *
 * The corpus is SYNTHETIC and generated here. Nothing in this path reaches a
 * real source, and the caller is told so in the first line of output — a
 * forecast that reads like analysis of the world, produced entirely from a
 * simulator, is the one output this system must never ship quietly.
 */

import { mkdir } from "fs/promises";
import { resolve } from "path";
import { ArtifactStore } from "./artifact/store.js";
import { AsOfCorpus } from "./corpus/as-of.js";
import { generateSyntheticCorpus } from "./corpus/synthetic.js";
import { createAnthropicClient } from "./llm/anthropic.js";
import { createFailingClient } from "./llm/stub.js";
import { runQuestion } from "./pipeline/run-question.js";
import {
  influenceOpsBinding,
  influenceOpsQuantity,
} from "./pipeline/influence-ops-binding.js";
import type { LlmClient } from "./llm/client.js";
import type { InfluenceOpsMeasure } from "./pipeline/influence-ops-binding.js";
import type { QuestionResult } from "./pipeline/run-question.js";

export interface ForecastOptions {
  readonly question: string;
  readonly measure: InfluenceOpsMeasure;
  readonly resolveAtTick: number;
  /** Outcome range the bands tile. Narrower than definitional costs runs. */
  readonly range?: readonly [number, number];
  readonly bands: number;
  readonly runs: number;
  readonly seed: string;
  readonly asOf: string;
  readonly storeDir: string;
  /**
   * Skip the model entirely.
   *
   * Not a degraded mode: the framer falls back to a uniform partition and a
   * golden-ratio parameter sweep, and the ensemble forecast is produced without
   * an LLM at any point. It is the configuration the benchmark measures.
   */
  readonly offline: boolean;
  readonly concurrency?: number;
  /** Injectable so tests drive the whole path without a network or a key. */
  readonly client?: LlmClient;
}

export interface ForecastOutcome {
  readonly result: QuestionResult;
  readonly storeDir: string;
  readonly corpusSnapshotId: string;
  readonly clientName: string;
}

export const DEFAULT_FORECAST_OPTIONS = {
  measure: "adoptionRate",
  resolveAtTick: 119,
  bands: 4,
  runs: 16,
  seed: "proteus",
  asOf: "2026-03-01",
  storeDir: ".proteus-artifacts",
} as const;

/**
 * Corpus parameters fixed here rather than exposed as flags.
 *
 * They are the benchmark's, so a CLI run and a benchmark question see the same
 * evidence base. Making them tunable would let a caller widen the corpus until
 * the contradiction rate looked better, which is a knob nobody should have.
 */
const CORPUS = {
  documentCount: 60,
  sourceCount: 6,
  startDate: "2026-01-01",
  endDate: "2026-02-20",
  conflictsPerKind: 2,
} as const;

export async function runForecast(
  options: ForecastOptions,
): Promise<ForecastOutcome> {
  const storeDir = resolve(options.storeDir);
  await mkdir(storeDir, { recursive: true });

  const { snapshot } = generateSyntheticCorpus({
    seed: `${options.seed}/corpus`,
    ...CORPUS,
  });
  const corpus = new AsOfCorpus(snapshot, options.asOf);
  const client = options.client ?? selectClient(options.offline);

  const result = await runQuestion(
    {
      client,
      binding: influenceOpsBinding,
      store: new ArtifactStore(storeDir),
      corpus,
    },
    {
      question: options.question,
      quantity: influenceOpsQuantity(
        options.measure,
        options.resolveAtTick,
        options.range,
      ),
      asOf: options.asOf,
      rootSeed: options.seed,
      hypothesisCount: options.bands,
      runCount: options.runs,
      concurrency: options.concurrency,
    },
  );

  return {
    result,
    storeDir,
    corpusSnapshotId: corpus.snapshotId,
    clientName: client.name,
  };
}

/**
 * Offline unless a key is present.
 *
 * Falling back rather than failing is the honest default: the adjudication layer
 * refuses in this domain anyway, so the no-model path is the one that actually
 * ships, and a missing key should not read as a broken install.
 */
function selectClient(offline: boolean): LlmClient {
  if (offline) return createFailingClient("offline mode requested");
  try {
    return createAnthropicClient();
  } catch {
    return createFailingClient("ANTHROPIC_API_KEY not set");
  }
}

/**
 * `--range 0.35,0.65`.
 *
 * Rejected rather than clamped: the range decides which outcomes are scorable at
 * all, so quietly repairing a malformed one would change the question and the
 * caller would never know it happened.
 */
export function parseRange(
  value?: string,
): readonly [number, number] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(
      `--range must be two numbers, e.g. 0.35,0.65 (got "${value}")`,
    );
  }
  if (parts[0]! >= parts[1]!) {
    throw new Error(`--range lower bound must be below upper: "${value}"`);
  }
  return [parts[0]!, parts[1]!];
}

/** The run's own caveats — what the product itself cannot say about itself. */
export function formatRunSummary(outcome: ForecastOutcome): string {
  const { result } = outcome;
  const lost = result.ensemble.planned - result.ensemble.summaries.length;

  const lines = [
    "SYNTHETIC WORLD. Every reading below comes from a simulation of a fictitious",
    "population. No real account, platform or person is represented, and nothing here",
    "is evidence about actual events.",
    "",
    `run:       ${result.questionId}`,
    `model:     ${outcome.clientName}${result.framingSource === "fallback" ? "  (framer unavailable — uniform partition and parameter sweep instead)" : ""}`,
    `ensemble:  ${result.ensemble.summaries.length}/${result.ensemble.planned} runs completed${lost > 0 ? `, ${lost} lost to values leaving the partition` : ""}`,
    `artifacts: ${outcome.storeDir}`,
  ];

  if (result.framingFallbackReason) {
    lines.push(`framer:    ${result.framingFallbackReason}`);
  }
  if (result.llmCalls > 0) {
    lines.push(
      `cost:      ${result.llmCalls} model call(s), $${result.costUsd.toFixed(4)}`,
    );
  }
  if (result.adjudication.refusals > 0) {
    lines.push(
      `panel:     ${result.adjudication.refusals} adjudicator(s) declined; the ensemble forecast stands uncross-checked`,
    );
  }

  return lines.join("\n");
}
