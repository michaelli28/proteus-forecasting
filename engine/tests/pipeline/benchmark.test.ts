import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import {
  BENCHMARK_ARMS,
  benchmarkQuestions,
  formatBenchmark,
  runBenchmark,
  truthSpec,
} from "../../src/pipeline/benchmark.js";
import { fallbackFraming } from "../../src/pipeline/run-question.js";
import {
  CORPUS_AS_OF,
  TOY_QUANTITY,
  testCorpus,
  toyBinding,
} from "./harness.js";

let root: string;
let store: ArtifactStore;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-benchmark-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("benchmarkQuestions", () => {
  it("builds the same question set from the same seed", () => {
    expect(benchmarkQuestions(3, "s")).toEqual(benchmarkQuestions(3, "s"));
  });

  it("covers every arm equally", () => {
    const questions = benchmarkQuestions(3, "s");
    expect(questions).toHaveLength(BENCHMARK_ARMS.length * 3);
    for (const arm of BENCHMARK_ARMS) {
      expect(questions.filter((q) => q.arm === arm)).toHaveLength(3);
    }
  });

  it("draws truth from the ensemble's own prior everywhere except the misspecified arm", () => {
    for (const question of benchmarkQuestions(2, "s")) {
      if (question.arm === "misspecified") {
        expect(question.truthPrior).not.toEqual(question.prior);
      } else {
        expect(question.truthPrior).toEqual(question.prior);
      }
    }
  });

  it("gives the negative control a materially wider prior", () => {
    const questions = benchmarkQuestions(1, "s");
    const width = (q: (typeof questions)[number]) =>
      q.prior.riskRange[1] - q.prior.riskRange[0];
    const narrow = questions.find((q) => q.arm === "narrow")!;
    const control = questions.find((q) => q.arm === "wide-control")!;
    expect(width(control)).toBeGreaterThan(width(narrow) * 3);
  });
});

describe("truthSpec", () => {
  it("is deterministic and lands inside the truth prior", () => {
    for (const question of benchmarkQuestions(3, "s")) {
      const spec = truthSpec(question);
      expect(spec).toEqual(truthSpec(question));
      expect(spec.riskTolerance).toBeGreaterThanOrEqual(
        question.truthPrior.riskRange[0],
      );
      expect(spec.riskTolerance).toBeLessThanOrEqual(
        question.truthPrior.riskRange[1],
      );
      expect(spec.escalationPropensity).toBeGreaterThanOrEqual(
        question.truthPrior.escalationRange[0],
      );
      expect(spec.escalationPropensity).toBeLessThanOrEqual(
        question.truthPrior.escalationRange[1],
      );
    }
  });

  it("varies with the question", () => {
    const questions = benchmarkQuestions(3, "s");
    const specs = questions.map((q) => truthSpec(q).riskTolerance);
    expect(new Set(specs).size).toBeGreaterThan(1);
  });
});

describe("fallbackFraming honours a scenario prior", () => {
  const base = {
    question: "q",
    quantity: TOY_QUANTITY,
    asOf: CORPUS_AS_OF,
    rootSeed: "s",
    hypothesisCount: 3,
    runCount: 8,
  };

  it("keeps every sweep point inside the prior box", () => {
    const framing = fallbackFraming({
      ...base,
      scenarioPrior: { riskRange: [40, 60], escalationRange: [10, 20] },
    });
    for (const spec of framing.runSpecs) {
      expect(spec.riskTolerance).toBeGreaterThanOrEqual(40);
      expect(spec.riskTolerance).toBeLessThanOrEqual(60);
      expect(spec.escalationPropensity).toBeGreaterThanOrEqual(10);
      expect(spec.escalationPropensity).toBeLessThanOrEqual(20);
    }
  });

  it("sweeps the whole square when nothing constrains the actor", () => {
    const framing = fallbackFraming(base);
    const risks = framing.runSpecs.map((s) => s.riskTolerance);
    expect(Math.min(...risks)).toBeLessThan(20);
    expect(Math.max(...risks)).toBeGreaterThan(80);
  });

  it("does not sweep both parameters down one diagonal", () => {
    const framing = fallbackFraming(base);
    const collinear = framing.runSpecs.every(
      (spec) => Math.abs(spec.riskTolerance - spec.escalationPropensity) < 1,
    );
    expect(collinear).toBe(false);
  });
});

describe("runBenchmark", () => {
  it("scores each arm separately and never pools them", async () => {
    const report = await runBenchmark({
      binding: toyBinding,
      store,
      corpus: testCorpus(),
      quantity: TOY_QUANTITY,
      asOf: CORPUS_AS_OF,
      questionsPerArm: 1,
      ensembleSize: 4,
      bandCount: 3,
      seed: "toy-bench",
    });

    expect(report.regime).toBe("synthetic_oracle");
    expect(report.arms.map((a) => a.arm)).toEqual([...BENCHMARK_ARMS]);
    expect(report.results).toHaveLength(BENCHMARK_ARMS.length);
    expect(report.simulationRuns).toBe(BENCHMARK_ARMS.length * (4 + 1));
  });

  it("reports an unscorable arm as null rather than as a perfect score", async () => {
    const report = await runBenchmark({
      binding: toyBinding,
      store,
      corpus: testCorpus(),
      quantity: TOY_QUANTITY,
      asOf: CORPUS_AS_OF,
      questionsPerArm: 1,
      ensembleSize: 4,
      bandCount: 3,
      seed: "toy-bench",
    });
    for (const arm of report.arms) {
      if (arm.abstained === arm.questions) expect(arm.score).toBeNull();
    }
  });

  it("reproduces the same numbers from the same seed", async () => {
    const options = {
      binding: toyBinding,
      store,
      corpus: testCorpus(),
      quantity: TOY_QUANTITY,
      asOf: CORPUS_AS_OF,
      questionsPerArm: 1,
      ensembleSize: 4,
      bandCount: 3,
      seed: "toy-bench",
    };
    const first = await runBenchmark(options);
    const second = await runBenchmark(options);

    expect(second.results.map((r) => r.probabilities)).toEqual(
      first.results.map((r) => r.probabilities),
    );
    expect(second.arms.map((a) => a.score?.report.brier ?? null)).toEqual(
      first.arms.map((a) => a.score?.report.brier ?? null),
    );
  });

  it("puts question-level intervals on Brier, skill and coverage@1, never on ECE", async () => {
    const report = await runBenchmark({
      binding: toyBinding,
      store,
      corpus: testCorpus(),
      quantity: TOY_QUANTITY,
      asOf: CORPUS_AS_OF,
      questionsPerArm: 40,
      ensembleSize: 4,
      bandCount: 3,
      seed: "toy-bench",
    });
    const scored = report.arms.find((a) => a.score !== null)!;
    const { brier, skill, coverageAt1 } = scored.intervals!;
    expect(brier!.estimate).toBe(scored.score!.report.brier);
    expect(skill!.estimate).toBe(scored.score!.report.brierSkillVsBaseRate);
    expect(coverageAt1!.estimate).toBe(scored.ensemble!.coverageAt1);
    for (const ci of [brier!, skill!, coverageAt1!]) {
      expect(ci.lower).toBeLessThanOrEqual(ci.estimate);
      expect(ci.estimate).toBeLessThanOrEqual(ci.upper);
    }
    expect(Object.keys(scored.intervals!)).not.toContain(
      "expectedCalibrationError",
    );
    expect(formatBenchmark(report)).toMatch(
      /Brier \d\.\d{4} \[\d\.\d{4}, \d\.\d{4}\]/,
    );
    // Skill is 1 − Brier/reference, so both intervals must come from the same
    // resamples: skill's ends are Brier's ends mapped through that line.
    const reference = brier!.estimate / (1 - skill!.estimate);
    expect(skill!.lower).toBeCloseTo(1 - brier!.upper / reference, 10);
    expect(skill!.upper).toBeCloseTo(1 - brier!.lower / reference, 10);
    expect(formatBenchmark(report)).toMatch(/95% percentile bootstrap/);
  });

  it("always states the synthetic-oracle caveat when formatted", async () => {
    const report = await runBenchmark({
      binding: toyBinding,
      store,
      corpus: testCorpus(),
      quantity: TOY_QUANTITY,
      asOf: CORPUS_AS_OF,
      questionsPerArm: 1,
      ensembleSize: 4,
      bandCount: 3,
      seed: "toy-bench",
    });
    const text = formatBenchmark(report);
    expect(text).toMatch(/synthetic oracle/i);
    expect(text).toMatch(/NOT YET MEASURED/);
  });
});
