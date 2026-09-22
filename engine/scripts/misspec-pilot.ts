/**
 * SPIKE: Day-1 pilot of the misspecification rank check.
 *
 * On the benchmark's own questions (seed proteus-v1, adoptionRate at tick 119),
 * ranks each truth's early telemetry among N prior draws and reports how often
 * the check alarms at p ≤ α, per arm and per cutoff tick t0:
 *
 *   misspecified — truth drawn 30 units away from the prior: power.
 *   narrow       — same prior boxes, truth drawn from them: false alarms.
 *
 * t0 = 9 is the negative control. No campaign starts before tick 10, so up to
 * t0 = 9 the two arms' telemetry has the same distribution and the check can
 * only alarm at chance. Exploratory: the primary t0 is pre-registered later,
 * and not from this table — its questions are 20 of the 80 the headline is
 * measured on. Choose t0 and tune the statistic on a different seed.
 *
 *   node --import tsx scripts/misspec-pilot.ts [questionsPerArm] [draws] [out.json]
 */

import { writeFileSync } from "node:fs";
import { runSimulation } from "../src/sim/kernel.js";
import { runSeed } from "../src/pipeline/ensemble.js";
import { benchmarkQuestions, truthSpec } from "../src/pipeline/benchmark.js";
import {
  influenceOpsBinding,
  influenceOpsQuantity,
  signaturesUpTo,
} from "../src/pipeline/influence-ops-binding.js";
import { CHECK_CHANNELS, priorDraws } from "../src/pipeline/misspec-check.js";
import { pooledMahalanobis, rankPValue } from "../src/metrics/rank-check.js";
import type { RunSpec } from "../src/agents/framer.js";
import type { BenchmarkQuestion } from "../src/pipeline/benchmark.js";

const QUESTIONS = Number(process.argv[2] ?? 20);
const DRAWS = Number(process.argv[3] ?? 99);
const OUT = process.argv[4];
const ALPHA = 0.05;
const T0S = [9, 20, 40, 60, 80] as const;
const ARMS = ["misspecified", "narrow"] as const;

// The benchmark's own settings (tests/benchmark/calibration.test.ts).
const quantity = influenceOpsQuantity("adoptionRate", 119, [0.35, 0.65]);
const BENCH_SEED = "proteus-v1";
const BENCH_QUESTIONS_PER_ARM = 80;

async function events(spec: RunSpec, seed: string) {
  const config = influenceOpsBinding.configFor(spec, quantity);
  return runSimulation(influenceOpsBinding.adapter, config, seed, {
    observeEvery: 0,
  });
}

function vectorAt(result: Awaited<ReturnType<typeof events>>, t0: number) {
  const signatures = signaturesUpTo(result, t0);
  return CHECK_CHANNELS.map((channel) => signatures[channel]!);
}

async function checkQuestion(question: BenchmarkQuestion) {
  const truth = truthSpec(question);
  // Exactly the benchmark oracle's run: same spec, config and seed.
  const truthRun = await events(
    truth,
    runSeed(`${question.rootSeed}/oracle`, truth.id),
  );
  const outcome = influenceOpsBinding.readQuantity(truthRun, quantity);

  const seeds = Array.from(
    { length: DRAWS },
    (_, i) => `${question.rootSeed}/check-draw/${i}`,
  );
  const drawRuns = [];
  for (const draw of priorDraws(question.prior, seeds)) {
    drawRuns.push(
      await events(draw, runSeed(`${question.rootSeed}/check`, draw.id)),
    );
  }

  const pValues = Object.fromEntries(
    T0S.map((t0) => {
      const members = [truthRun, ...drawRuns].map((run) => vectorAt(run, t0));
      return [t0, rankPValue(pooledMahalanobis(members), 0)];
    }),
  );

  return {
    id: question.id,
    arm: question.arm,
    truth: {
      riskTolerance: truth.riskTolerance,
      escalationPropensity: truth.escalationPropensity,
    },
    outcome,
    resolved: outcome >= quantity.min && outcome <= quantity.max,
    pValues,
  };
}

/** Two-sided 95% Wilson interval for k successes in n. */
function wilson(k: number, n: number): [number, number] {
  const z = 1.959964;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const started = performance.now();
const questions = benchmarkQuestions(
  BENCH_QUESTIONS_PER_ARM,
  BENCH_SEED,
).filter(
  (q) =>
    (ARMS as readonly string[]).includes(q.arm) &&
    Number(q.id.split("-").pop()) <= QUESTIONS,
);

const results = [];
for (const question of questions) {
  results.push(await checkQuestion(question));
  process.stderr.write(".");
}
process.stderr.write("\n");

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const lines = [
  `misspecification pilot — ${QUESTIONS} questions per arm, N = ${DRAWS} prior draws, α = ${ALPHA}`,
  `alarm = p ≤ α. Each cell: alarms/questions [95% Wilson].`,
  "",
  ["arm".padEnd(14), ...T0S.map((t) => `t0=${t}`.padEnd(20))].join(""),
];
for (const arm of ARMS) {
  const rows = results.filter((r) => r.arm === arm);
  const cells = T0S.map((t0) => {
    const k = rows.filter((r) => r.pValues[t0]! <= ALPHA).length;
    const [lo, hi] = wilson(k, rows.length);
    return `${k}/${rows.length} [${pct(lo)},${pct(hi)}]`.padEnd(20);
  });
  lines.push([arm.padEnd(14), ...cells].join(""));
}
const unresolved = results.filter(
  (r) => r.arm === "misspecified" && !r.resolved,
);
lines.push(
  "",
  `misspecified truths outside the scored range: ${unresolved.length}/${QUESTIONS}`,
  `wall time ${((performance.now() - started) / 1000).toFixed(0)} s`,
);
process.stdout.write(lines.join("\n") + "\n");

if (OUT) {
  writeFileSync(
    OUT,
    JSON.stringify(
      { questions: QUESTIONS, draws: DRAWS, alpha: ALPHA, t0s: T0S, results },
      null,
      2,
    ) + "\n",
  );
}
