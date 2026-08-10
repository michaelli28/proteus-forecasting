import { describe, it, expect } from "vitest";
import {
  forecastFromEnsemble,
  coverageAtN,
  tailRecall,
  ensembleDiversity,
  bandCoverage,
} from "../../src/metrics/ensemble.js";
import {
  stabilityReport,
  totalVariationDistance,
  isStable,
} from "../../src/metrics/stability.js";
import {
  cohensKappa,
  krippendorffAlphaNominal,
  agreementLabel,
} from "../../src/metrics/agreement.js";
import {
  contradictionDetectionScore,
  conflictClassificationScore,
  reconciliationScore,
  provenanceReport,
} from "../../src/metrics/analytic-qa.js";
import {
  costReport,
  timeComparison,
  scalingReport,
  reliabilityReport,
  degradationCheck,
  reproducibilityCheck,
  reproducibilityRate,
} from "../../src/metrics/operations.js";
import { assertValidForecast } from "../../src/metrics/types.js";
import { categoricalIgnoranceScore } from "../../src/metrics/scoring-rules.js";
import type { CategoricalForecast } from "../../src/metrics/types.js";
import type { Claim } from "../../src/evidence/types.js";
import type { DetectedConflict } from "../../src/evidence/contradiction.js";
import type { SeededConflict } from "../../src/corpus/types.js";

describe("forecastFromEnsemble", () => {
  it("turns run outcomes into a normalized distribution", () => {
    const forecast = forecastFromEnsemble("q", [0, 0, 1, 1, 1, 2], 3, 1);
    expect(() => assertValidForecast(forecast)).not.toThrow();
    expect(forecast.probabilities[1]).toBeGreaterThan(
      forecast.probabilities[0]!,
    );
  });

  it("never assigns 0% to a band no run reached", () => {
    // A finite sample cannot rule an outcome out, and a 0 makes the log score
    // infinite. Laplace smoothing is the documented fix.
    const forecast = forecastFromEnsemble("q", [0, 0, 0, 0], 4, 0);
    expect(forecast.probabilities.every((p) => p > 0)).toBe(true);
    expect(
      Number.isFinite(
        categoricalIgnoranceScore([{ ...forecast, outcomeIndex: 3 }]),
      ),
    ).toBe(true);
  });

  it("matches Laplace's rule exactly", () => {
    // 4 runs all in band 0, 2 bands, alpha=1 => (4+1)/(4+2) and (0+1)/(4+2)
    const forecast = forecastFromEnsemble("q", [0, 0, 0, 0], 2, 0);
    expect(forecast.probabilities[0]).toBeCloseTo(5 / 6, 10);
    expect(forecast.probabilities[1]).toBeCloseTo(1 / 6, 10);
  });

  it("honors a custom smoothing weight", () => {
    const unsmoothed = forecastFromEnsemble("q", [0, 0], 2, 0, {
      smoothingAlpha: 0,
    });
    expect(unsmoothed.probabilities[1]).toBe(0);
  });

  it("rejects a run outside the partition", () => {
    expect(() => forecastFromEnsemble("q", [0, 5], 3, 0)).toThrow(RangeError);
  });

  it("rejects an empty ensemble", () => {
    expect(() => forecastFromEnsemble("q", [], 3, 0)).toThrow(RangeError);
  });
});

describe("coverageAtN", () => {
  const forecasts: CategoricalForecast[] = [
    { id: "a", probabilities: [0.5, 0.3, 0.2], outcomeIndex: 0 },
    { id: "b", probabilities: [0.5, 0.3, 0.2], outcomeIndex: 1 },
    { id: "c", probabilities: [0.5, 0.3, 0.2], outcomeIndex: 2 },
  ];

  it("counts only the top band at n=1", () => {
    expect(coverageAtN(forecasts, 1)).toBeCloseTo(1 / 3, 10);
  });

  it("rises with n", () => {
    expect(coverageAtN(forecasts, 2)).toBeCloseTo(2 / 3, 10);
    expect(coverageAtN(forecasts, 3)).toBe(1);
  });

  it("breaks probability ties deterministically", () => {
    const tied: CategoricalForecast[] = [
      { id: "a", probabilities: [0.5, 0.5], outcomeIndex: 0 },
    ];
    expect(coverageAtN(tied, 1)).toBe(1);
  });

  it("rejects n below 1", () => {
    expect(() => coverageAtN(forecasts, 0)).toThrow(RangeError);
  });
});

describe("tailRecall", () => {
  it("is 1 when every surprise had some weight", () => {
    const forecasts: CategoricalForecast[] = [
      { id: "a", probabilities: [0.95, 0.05], outcomeIndex: 1 },
    ];
    const report = tailRecall(forecasts);
    expect(report.surprises).toBe(1);
    expect(report.recall).toBe(1);
  });

  it("catches a surprise the ensemble never imagined", () => {
    const forecasts: CategoricalForecast[] = [
      { id: "a", probabilities: [1, 0], outcomeIndex: 1 },
    ];
    expect(tailRecall(forecasts).recall).toBe(0);
  });

  it("is 1 vacuously when nothing was surprising", () => {
    const forecasts: CategoricalForecast[] = [
      { id: "a", probabilities: [0.9, 0.1], outcomeIndex: 0 },
    ];
    expect(tailRecall(forecasts).surprises).toBe(0);
    expect(tailRecall(forecasts).recall).toBe(1);
  });
});

describe("ensembleDiversity", () => {
  it("is 0 for identical members", () => {
    expect(
      ensembleDiversity([
        [1, 0],
        [1, 0],
      ]),
    ).toBeCloseTo(0, 10);
  });

  it("is high for orthogonal members", () => {
    expect(
      ensembleDiversity([
        [1, 0],
        [0, 1],
      ]),
    ).toBeCloseTo(1, 10);
  });

  it("is 0 for a single member", () => {
    expect(ensembleDiversity([[1, 0]])).toBe(0);
  });

  it("reports how much of the partition the runs explored", () => {
    expect(bandCoverage([0, 0, 1], 4)).toBeCloseTo(0.5, 10);
  });
});

describe("stability", () => {
  const identical: CategoricalForecast[] = Array.from(
    { length: 4 },
    (_, i) => ({
      id: `r${i}`,
      probabilities: [0.6, 0.3, 0.1],
      outcomeIndex: 0,
    }),
  );

  it("reports perfect stability for identical repeats", () => {
    const report = stabilityReport(identical);
    expect(report.headlineAgreement).toBe(1);
    expect(report.meanTotalVariation).toBeCloseTo(0, 10);
    expect(report.worstBandStdDev).toBeCloseTo(0, 10);
    expect(isStable(report)).toBe(true);
  });

  it("catches a system that flips its headline between seeds", () => {
    // The failure this metric exists for: same inputs, different answer.
    const flipping: CategoricalForecast[] = [
      { id: "r1", probabilities: [0.7, 0.3], outcomeIndex: 0 },
      { id: "r2", probabilities: [0.3, 0.7], outcomeIndex: 0 },
      { id: "r3", probabilities: [0.6, 0.4], outcomeIndex: 0 },
      { id: "r4", probabilities: [0.2, 0.8], outcomeIndex: 0 },
    ];
    const report = stabilityReport(flipping);
    expect(report.headlineAgreement).toBeCloseTo(0.5, 10);
    expect(isStable(report)).toBe(false);
    expect(report.maxTotalVariation).toBeGreaterThan(0.4);
  });

  it("computes total variation distance as half the L1 distance", () => {
    expect(totalVariationDistance([1, 0], [0, 1])).toBeCloseTo(1, 10);
    expect(totalVariationDistance([0.5, 0.5], [0.5, 0.5])).toBeCloseTo(0, 10);
  });

  it("rejects a single repetition", () => {
    expect(() => stabilityReport([identical[0]!])).toThrow(RangeError);
  });

  it("rejects repeats with mismatched band counts", () => {
    expect(() =>
      stabilityReport([
        { id: "a", probabilities: [0.5, 0.5], outcomeIndex: 0 },
        { id: "b", probabilities: [0.3, 0.3, 0.4], outcomeIndex: 0 },
      ]),
    ).toThrow(RangeError);
  });
});

describe("agreement", () => {
  it("kappa is 1 for perfect agreement", () => {
    expect(cohensKappa(["a", "b", "c"], ["a", "b", "c"])).toBeCloseTo(1, 10);
  });

  it("kappa is ~0 for chance-level agreement", () => {
    // Both raters split 50/50 independently and agree half the time.
    const a = ["x", "x", "y", "y"];
    const b = ["x", "y", "x", "y"];
    expect(cohensKappa(a, b)).toBeCloseTo(0, 10);
  });

  it("kappa is negative for systematic disagreement", () => {
    expect(cohensKappa(["x", "y"], ["y", "x"])).toBeLessThan(0);
  });

  it("kappa does not reward two raters who always say the same thing", () => {
    // 100% raw agreement, zero demonstrated skill.
    expect(cohensKappa(["x", "x", "x"], ["x", "x", "x"])).toBe(1);
  });

  it("alpha is 1 for perfect agreement", () => {
    const report = krippendorffAlphaNominal([
      ["a", "a", "a"],
      ["b", "b", "b"],
      ["c", "c", "c"],
    ]);
    expect(report.value).toBeCloseTo(1, 10);
  });

  it("alpha falls with disagreement", () => {
    const report = krippendorffAlphaNominal([
      ["a", "b"],
      ["a", "b"],
      ["b", "a"],
      ["b", "a"],
    ]);
    expect(report.value).toBeLessThan(0.5);
  });

  it("alpha tolerates missing ratings", () => {
    const report = krippendorffAlphaNominal([
      ["a", "a", null],
      ["b", null, "b"],
      [null, "c", "c"],
    ]);
    expect(report.unitsUsed).toBe(3);
    expect(report.value).toBeCloseTo(1, 10);
  });

  it("alpha ignores units rated fewer than twice", () => {
    const report = krippendorffAlphaNominal([
      ["a", "a"],
      ["b", null],
      ["c", "c"],
    ]);
    expect(report.unitsUsed).toBe(2);
  });

  it("rejects a set with nothing multiply rated", () => {
    expect(() => krippendorffAlphaNominal([["a", null]])).toThrow(RangeError);
  });

  it("labels values against conventional thresholds", () => {
    expect(agreementLabel(0.9)).toBe("reliable");
    expect(agreementLabel(0.7)).toBe("tentative");
    expect(agreementLabel(0.4)).toBe("unreliable");
  });
});

describe("analytic QA", () => {
  const gold: SeededConflict[] = [
    {
      subject: "s1",
      kind: "different_date",
      documentIds: ["d1", "d2"],
      reconciledValue: 20,
    },
    {
      subject: "s2",
      kind: "genuine_dispute",
      documentIds: ["d3", "d4"],
      reconciledValue: null,
    },
  ];

  function detected(
    overrides: Partial<DetectedConflict>[],
  ): DetectedConflict[] {
    return overrides.map((o) => ({
      subject: "s1",
      kind: "different_date",
      parties: [{} as never, {} as never],
      reconciledValue: 20,
      rationale: "",
      ...o,
    }));
  }

  it("scores perfect detection", () => {
    const score = contradictionDetectionScore(
      detected([
        { subject: "s1" },
        { subject: "s2", kind: "genuine_dispute", reconciledValue: null },
      ]),
      gold,
    );
    expect(score.recall).toBe(1);
    expect(score.f1).toBe(1);
  });

  it("counts a missed conflict as a false negative", () => {
    const score = contradictionDetectionScore(
      detected([{ subject: "s1" }]),
      gold,
    );
    expect(score.falseNegatives).toBe(1);
    expect(score.recall).toBeCloseTo(0.5, 10);
  });

  it("only counts extra detections as false positives in strict mode", () => {
    // Background sources legitimately disagree; counting those as errors would
    // punish the detector for being right.
    const extra = detected([
      { subject: "s1" },
      { subject: "s2", kind: "genuine_dispute", reconciledValue: null },
      { subject: "background" },
    ]);
    expect(contradictionDetectionScore(extra, gold).falsePositives).toBe(0);
    expect(contradictionDetectionScore(extra, gold, true).falsePositives).toBe(
      1,
    );
  });

  it("scores classification per kind", () => {
    const report = conflictClassificationScore(
      detected([{ subject: "s1" }, { subject: "s2", kind: "different_date" }]),
      gold,
    );
    expect(report.accuracy).toBeCloseTo(0.5, 10);
    expect(report.byKind.genuine_dispute).toEqual({ total: 1, correct: 0 });
  });

  it("flags a genuine dispute that was wrongly resolved", () => {
    // The dangerous error: picking a side manufactures unsupported confidence.
    const report = reconciliationScore(
      detected([
        { subject: "s2", kind: "genuine_dispute", reconciledValue: 99 },
      ]),
      gold,
    );
    expect(report.falseResolutions).toBe(1);
  });

  it("counts provenance completeness and undated citations", () => {
    const claims: Claim[] = [
      {
        text: "a",
        support: [
          {
            sourceId: "s",
            documentId: "d",
            publishedAt: "2026-01-01",
            credibility: 1,
            excerpt: "",
          },
        ],
      },
      { text: "b", support: [] },
      {
        text: "c",
        support: [
          {
            sourceId: "s",
            documentId: "d",
            publishedAt: "not-a-date",
            credibility: 1,
            excerpt: "",
          },
        ],
      },
    ];
    const report = provenanceReport(claims);
    expect(report.completeness).toBeCloseTo(2 / 3, 10);
    expect(report.unsupportedAssertions).toBe(1);
    expect(report.undatedCitations).toBe(1);
  });
});

describe("operations", () => {
  it("computes cost per scenario and forecast", () => {
    const report = costReport({
      totalCostUsd: 10,
      scenarios: 20,
      forecasts: 5,
    });
    expect(report.costPerScenario).toBeCloseTo(0.5, 10);
    expect(report.costPerForecast).toBeCloseTo(2, 10);
  });

  it("omits cost per insight until a human has judged relevance", () => {
    expect(
      costReport({ totalCostUsd: 10, scenarios: 1, forecasts: 1 })
        .costPerDecisionRelevantInsight,
    ).toBeUndefined();
  });

  it("requires a measured manual baseline", () => {
    // Nobody can report a speedup against a guessed number.
    expect(() => timeComparison(60, 0)).toThrow(RangeError);
    const comparison = timeComparison(360, 7200);
    expect(comparison.speedup).toBeCloseTo(20, 10);
    expect(comparison.analystHoursDisplaced).toBeCloseTo(1.9, 10);
  });

  it("detects sublinear cost scaling", () => {
    const report = scalingReport([
      { n: 10, wallClockSeconds: 100, costUsd: 1 },
      { n: 100, wallClockSeconds: 120, costUsd: 9 },
    ]);
    expect(report.costIsSublinear).toBe(true);
    expect(report.wallClockSlope).toBeLessThan(1);
  });

  it("detects superlinear cost scaling", () => {
    const report = scalingReport([
      { n: 10, wallClockSeconds: 100, costUsd: 1 },
      { n: 100, wallClockSeconds: 2000, costUsd: 50 },
    ]);
    expect(report.costIsSublinear).toBe(false);
  });

  it("computes completion rate and attributes failures by phase", () => {
    const report = reliabilityReport([
      { runId: "a", completed: true },
      { runId: "b", completed: false, errorPhase: "agent" },
      { runId: "c", completed: false, errorPhase: "agent" },
      { runId: "d", completed: false, errorPhase: "git_push" },
    ]);
    expect(report.completionRate).toBeCloseTo(0.25, 10);
    expect(report.failuresByPhase.agent).toBe(2);
  });

  it("flags a system whose confidence ignores lost runs", () => {
    // Same confidence on 3 runs as on 10 is not robustness, it is not listening.
    expect(degradationCheck(10, 3, 0.8, 0.8).failedToDegrade).toBe(true);
    expect(degradationCheck(10, 3, 0.8, 0.4).failedToDegrade).toBe(false);
    expect(degradationCheck(10, 10, 0.8, 0.8).failedToDegrade).toBe(false);
  });

  it("checks artifact hash reproducibility", () => {
    expect(reproducibilityCheck("r", "abc", "abc").reproduced).toBe(true);
    expect(reproducibilityCheck("r", "abc", "xyz").reproduced).toBe(false);
    expect(
      reproducibilityRate([
        reproducibilityCheck("a", "1", "1"),
        reproducibilityCheck("b", "2", "3"),
      ]),
    ).toBeCloseTo(0.5, 10);
  });
});

describe("forecastQualityReport", () => {
  it("bundles the standard metrics with their regime", async () => {
    const { forecastQualityReport, formatQualityReport } = await import("../../src/metrics/index.js");
    const forecasts = [
      { id: "a", probability: 0.9, outcome: 1 as const },
      { id: "b", probability: 0.8, outcome: 1 as const },
      { id: "c", probability: 0.2, outcome: 0 as const },
      { id: "d", probability: 0.1, outcome: 0 as const },
    ];
    const report = forecastQualityReport(forecasts, "synthetic_oracle");
    expect(report.regime).toBe("synthetic_oracle");
    expect(report.n).toBe(4);
    expect(report.brier).toBeLessThan(0.05);
    expect(report.brierSkillVsBaseRate).toBeGreaterThan(0.8);
    expect(report.isHedging).toBe(false);

    // A synthetic-oracle number must never travel without its caveat.
    const text = formatQualityReport(report);
    expect(text).toContain("synthetic_oracle");
    expect(text.toLowerCase()).toContain("says nothing about real-world");
  });

  it("warns when the system is hedging", async () => {
    const { forecastQualityReport, formatQualityReport } = await import("../../src/metrics/index.js");
    const forecasts = Array.from({ length: 10 }, (_, i) => ({
      id: `x${i}`,
      probability: 0.5,
      outcome: (i % 2) as 0 | 1,
    }));
    const report = forecastQualityReport(forecasts, "synthetic_oracle");
    expect(report.isHedging).toBe(true);
    expect(report.resolutionRatio).toBeCloseTo(0, 10);
    expect(formatQualityReport(report)).toContain("hedging");
  });
});
