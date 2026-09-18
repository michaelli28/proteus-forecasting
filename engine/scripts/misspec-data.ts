/**
 * SPIKE: generate the per-question data the misspecification analysis reads.
 *
 * For each question it simulates N independent prior draws and a set of truth
 * worlds, and records every member's four telemetry channels at each look
 * plus its outcome at the resolution tick. Nothing is scored here — the
 * analysis script re-ranks the saved features, so tuning never re-simulates.
 *
 *   dose — the benchmark's misspecified root seeds. Truths at shift δ from the
 *          prior centre (δ = 30 is exactly the benchmark's misspecified truth),
 *          blind-spot truths at δ = 0 that count adoption at a different
 *          threshold, and the forecast the pipeline actually ships.
 *   arms — the well-specified narrow / medium / wide-control questions, truth
 *          exactly as the benchmark draws it.
 *
 *   node --import tsx scripts/misspec-data.ts <dose|arms> <seed> <questions> <draws> <shard>/<shards> <outDir>
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { runSimulation } from "../src/sim/kernel.js";
import { runSeed } from "../src/pipeline/ensemble.js";
import { runQuestion } from "../src/pipeline/run-question.js";
import {
  benchmarkQuestions,
  drawFromBox,
  truthSpec,
} from "../src/pipeline/benchmark.js";
import {
  createInfluenceOpsBinding,
  influenceOpsBinding,
  influenceOpsQuantity,
  signaturesUpTo,
} from "../src/pipeline/influence-ops-binding.js";
import { CHECK_CHANNELS, priorDraws } from "../src/pipeline/misspec-check.js";
import { DEFAULT_CONFIG } from "../src/sim/adapters/influence-ops/index.js";
import { ArtifactStore } from "../src/artifact/store.js";
import { AsOfCorpus } from "../src/corpus/as-of.js";
import { generateSyntheticCorpus } from "../src/corpus/synthetic.js";
import { createFailingClient } from "../src/llm/stub.js";
import type { RunSpec } from "../src/agents/framer.js";
import type { BenchmarkQuestion } from "../src/pipeline/benchmark.js";
import type { ScenarioPrior } from "../src/pipeline/run-question.js";

const [SET, SEED, QUESTIONS, DRAWS, SHARD, OUT] = process.argv.slice(2);
if (!SET || !SEED || !QUESTIONS || !DRAWS || !SHARD || !OUT) {
  throw new Error(
    "usage: misspec-data.ts <dose|arms> <seed> <questions> <draws> <shard>/<shards> <outDir>",
  );
}
const [shard, shards] = SHARD.split("/").map(Number) as [number, number];

export const LOOKS = [9, 20, 30, 40, 50, 60, 80, 100] as const;
export const DELTAS = [0, 3, 6, 12, 24, 30] as const;
export const BLIND_THRESHOLDS = [0.5, 0.55, 0.65, 0.7] as const;

// The benchmark's settings (tests/benchmark/calibration.test.ts).
const quantity = influenceOpsQuantity("adoptionRate", 119, [0.35, 0.65]);
const HALF_WIDTH = 6;

type Member = {
  riskTolerance: number;
  escalationPropensity: number;
  features: number[][];
  outcome: number;
};

async function member(
  spec: Pick<RunSpec, "id" | "riskTolerance" | "escalationPropensity"> &
    RunSpec,
  seed: string,
  binding = influenceOpsBinding,
): Promise<Member> {
  const config = binding.configFor(spec, quantity);
  const result = await runSimulation(binding.adapter, config, seed, {
    observeEvery: 0,
  });
  return {
    riskTolerance: spec.riskTolerance,
    escalationPropensity: spec.escalationPropensity,
    features: LOOKS.map((t0) => {
      const s = signaturesUpTo(result, t0);
      return CHECK_CHANNELS.map((c) => s[c]!);
    }),
    // Raw value, even outside the scored range: the analysis decides.
    outcome: result.events.find(
      (e) => e.kind === "truth" && e.tick === quantity.resolveAtTick,
    )!.data.adoptionRate as number,
  };
}

async function draws(question: BenchmarkQuestion): Promise<Member[]> {
  const seeds = Array.from(
    { length: Number(DRAWS) },
    (_, i) => `${question.rootSeed}/check-draw/${i}`,
  );
  const out: Member[] = [];
  for (const draw of priorDraws(question.prior, seeds)) {
    out.push(
      await member(draw, runSeed(`${question.rootSeed}/check`, draw.id)),
    );
  }
  return out;
}

/** The benchmark's box(), shifted by δ and capped as its misspecified arm is. */
function shiftedBox(prior: ScenarioPrior, delta: number): ScenarioPrior {
  const centre = [
    (prior.riskRange[0] + prior.riskRange[1]) / 2,
    (prior.escalationRange[0] + prior.escalationRange[1]) / 2,
  ].map((c) => Math.min(95, c + delta));
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    riskRange: [clamp(centre[0]! - HALF_WIDTH), clamp(centre[0]! + HALF_WIDTH)],
    escalationRange: [
      clamp(centre[1]! - HALF_WIDTH),
      clamp(centre[1]! + HALF_WIDTH),
    ],
  };
}

function truthAt(question: BenchmarkQuestion, box: ScenarioPrior): RunSpec {
  return {
    id: "truth",
    label: "ground truth",
    ...drawFromBox(box, `${question.rootSeed}/truth-draw`),
    rationale: "The scenario that actually obtains.",
  };
}

async function pipelineForecast(question: BenchmarkQuestion) {
  const root = await mkdtemp(join(tmpdir(), "misspec-data-"));
  const { snapshot } = generateSyntheticCorpus({
    seed: "benchmark-corpus",
    documentCount: 60,
    sourceCount: 6,
    startDate: "2026-01-01",
    endDate: "2026-02-20",
    conflictsPerKind: 2,
  });
  const result = await runQuestion(
    {
      client: createFailingClient("benchmark runs offline"),
      binding: influenceOpsBinding,
      store: new ArtifactStore(root),
      corpus: new AsOfCorpus(snapshot, "2026-03-01"),
    },
    {
      question: question.question,
      quantity,
      asOf: "2026-03-01",
      rootSeed: question.rootSeed,
      hypothesisCount: 4 * question.bandMultiplier,
      runCount: 32,
      scenarioPrior: question.prior,
      truth: truthSpec(question),
      rerunBudget: 0,
    },
  );
  return {
    abstained: result.abstained,
    probabilities: result.probabilities,
    bands: result.bands.map((b) => [b.lower, b.upper]),
  };
}

async function doseQuestion(question: BenchmarkQuestion) {
  const truthSeed = runSeed(`${question.rootSeed}/oracle`, "truth");
  const benchmarkTruth = truthSpec(question);
  const truths: Record<string, Member> = {};
  for (const delta of DELTAS) {
    const spec = truthAt(question, shiftedBox(question.prior, delta));
    if (delta === 30) {
      // δ = 30 must be the benchmark's own misspecified truth, draw for draw.
      if (
        spec.riskTolerance !== benchmarkTruth.riskTolerance ||
        spec.escalationPropensity !== benchmarkTruth.escalationPropensity
      ) {
        throw new Error(`${question.id}: δ=30 truth differs from truthSpec`);
      }
    }
    truths[`delta-${delta}`] = await member(spec, truthSeed);
  }
  const wellSpecified = truthAt(question, shiftedBox(question.prior, 0));
  for (const threshold of BLIND_THRESHOLDS) {
    const binding = createInfluenceOpsBinding({
      ...DEFAULT_CONFIG,
      adoptionThreshold: threshold,
    });
    truths[`blind-${threshold}`] = await member(
      wellSpecified,
      truthSeed,
      binding,
    );
  }
  return {
    truths,
    draws: await draws(question),
    pipeline: await pipelineForecast(question),
  };
}

async function armsQuestion(question: BenchmarkQuestion) {
  const truth = truthSpec(question);
  return {
    truths: {
      truth: await member(
        truth,
        runSeed(`${question.rootSeed}/oracle`, truth.id),
      ),
    },
    draws: await draws(question),
  };
}

const selected = benchmarkQuestions(Number(QUESTIONS), SEED).filter((q) =>
  SET === "dose"
    ? q.arm === "misspecified"
    : ["narrow", "medium", "wide-control"].includes(q.arm),
);

mkdirSync(OUT, { recursive: true });
let done = 0;
for (const [index, question] of selected.entries()) {
  if (index % shards !== shard) continue;
  const file = join(OUT, `${question.id}.json`);
  if (existsSync(file)) continue;
  const started = performance.now();
  const body =
    SET === "dose"
      ? await doseQuestion(question)
      : await armsQuestion(question);
  writeFileSync(
    file,
    JSON.stringify({
      id: question.id,
      arm: question.arm,
      rootSeed: question.rootSeed,
      prior: question.prior,
      looks: LOOKS,
      channels: CHECK_CHANNELS,
      ...body,
    }),
  );
  done++;
  process.stderr.write(
    `${question.id} ${((performance.now() - started) / 1000).toFixed(1)}s (${done})\n`,
  );
}
