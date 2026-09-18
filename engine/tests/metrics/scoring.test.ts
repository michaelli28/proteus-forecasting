import { describe, it, expect } from "vitest";
import {
  brierScore,
  multicategoryBrierScore,
  halfBrierScore,
  brierSkillScore,
  brierContributions,
} from "../../src/metrics/brier.js";
import {
  murphyDecomposition,
  resolutionRatio,
  reliabilityRatio,
} from "../../src/metrics/murphy.js";
import {
  calibrationBins,
  calibrationReport,
  reliabilityDiagram,
} from "../../src/metrics/calibration.js";
import {
  ignoranceScore,
  categoricalIgnoranceScore,
  logScore,
  sharpness,
  forecastEntropy,
  meanNormalizedEntropy,
  HEDGING_THRESHOLD,
} from "../../src/metrics/scoring-rules.js";
import {
  baseRateBaseline,
  uniformBaseline,
  coinFlipBaseline,
  singleRunBaseline,
  compareToBaselines,
} from "../../src/metrics/baselines.js";
import {
  assertValidForecast,
  toBinary,
  oneHot,
} from "../../src/metrics/types.js";
import type {
  BinaryForecast,
  CategoricalForecast,
} from "../../src/metrics/types.js";

function bin(id: string, probability: number, outcome: 0 | 1): BinaryForecast {
  return { id, probability, outcome };
}

describe("brierScore", () => {
  it("is 0 for a perfect forecaster", () => {
    expect(brierScore([bin("a", 1, 1), bin("b", 0, 0)])).toBe(0);
  });

  it("is 1 for a perfectly wrong forecaster", () => {
    expect(brierScore([bin("a", 0, 1), bin("b", 1, 0)])).toBe(1);
  });

  it("is 0.25 for a coin flip", () => {
    expect(brierScore([bin("a", 0.5, 1), bin("b", 0.5, 0)])).toBeCloseTo(
      0.25,
      10,
    );
  });

  it("matches a hand computation", () => {
    // (0.7-1)^2 + (0.3-0)^2 + (0.9-1)^2 = 0.09 + 0.09 + 0.01 = 0.19; /3
    const score = brierScore([
      bin("a", 0.7, 1),
      bin("b", 0.3, 0),
      bin("c", 0.9, 1),
    ]);
    expect(score).toBeCloseTo(0.19 / 3, 10);
  });

  it("rejects an empty set rather than returning 0", () => {
    expect(() => brierScore([])).toThrow(RangeError);
  });

  it("ranks the worst contributors first", () => {
    const contributions = brierContributions([
      bin("good", 0.9, 1),
      bin("bad", 0.1, 1),
    ]);
    expect(contributions[0]!.id).toBe("bad");
  });
});

describe("multicategoryBrierScore", () => {
  const perfect: CategoricalForecast = {
    id: "a",
    probabilities: [1, 0, 0],
    outcomeIndex: 0,
  };
  const worst: CategoricalForecast = {
    id: "b",
    probabilities: [0, 0, 1],
    outcomeIndex: 0,
  };

  it("is 0 for a perfect forecast", () => {
    expect(multicategoryBrierScore([perfect])).toBe(0);
  });

  it("is 2 at the maximum, not 1", () => {
    // The factor-of-two trap: summed over classes the range is [0,2].
    expect(multicategoryBrierScore([worst])).toBeCloseTo(2, 10);
  });

  it("halves to [0,1] on request", () => {
    expect(halfBrierScore([worst])).toBeCloseTo(1, 10);
  });

  it("matches a hand computation", () => {
    // (0.6-1)^2 + (0.3-0)^2 + (0.1-0)^2 = 0.16 + 0.09 + 0.01 = 0.26
    const forecast: CategoricalForecast = {
      id: "x",
      probabilities: [0.6, 0.3, 0.1],
      outcomeIndex: 0,
    };
    expect(multicategoryBrierScore([forecast])).toBeCloseTo(0.26, 10);
  });

  it("rejects probabilities that do not sum to 1", () => {
    expect(() =>
      multicategoryBrierScore([
        { id: "x", probabilities: [0.5, 0.2], outcomeIndex: 0 },
      ]),
    ).toThrow(RangeError);
  });

  it("rejects an out-of-range outcome index", () => {
    expect(() =>
      multicategoryBrierScore([
        { id: "x", probabilities: [0.5, 0.5], outcomeIndex: 5 },
      ]),
    ).toThrow(RangeError);
  });
});

describe("brierSkillScore", () => {
  it("is 1 for a perfect system", () => {
    expect(brierSkillScore(0, 0.25)).toBe(1);
  });

  it("is 0 when the system matches the reference", () => {
    expect(brierSkillScore(0.25, 0.25)).toBe(0);
  });

  it("is negative when the system is worse than the reference", () => {
    expect(brierSkillScore(0.4, 0.25)).toBeLessThan(0);
  });

  it("handles a perfect reference without producing NaN", () => {
    expect(brierSkillScore(0, 0)).toBe(0);
    expect(brierSkillScore(0.1, 0)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("murphyDecomposition", () => {
  it("satisfies brier = reliability - resolution + uncertainty", () => {
    const forecasts = [
      bin("a", 0.2, 0),
      bin("b", 0.2, 0),
      bin("c", 0.2, 1),
      bin("d", 0.8, 1),
      bin("e", 0.8, 1),
      bin("f", 0.8, 0),
      bin("g", 0.5, 1),
      bin("h", 0.5, 0),
    ];
    const d = murphyDecomposition(forecasts);
    expect(d.residual).toBeCloseTo(0, 12);
    expect(d.brier).toBeCloseTo(
      d.reliability - d.resolution + d.uncertainty,
      12,
    );
  });

  it("gives a perfectly calibrated forecaster zero reliability", () => {
    // Forecast 0.5, half occur: stated probability matches realized frequency.
    const d = murphyDecomposition([bin("a", 0.5, 1), bin("b", 0.5, 0)]);
    expect(d.reliability).toBeCloseTo(0, 12);
  });

  it("gives a base-rate forecaster zero resolution", () => {
    // Perfectly calibrated and completely undiscriminating — the failure mode
    // a single Brier number hides.
    const forecasts = [
      bin("a", 0.5, 1),
      bin("b", 0.5, 0),
      bin("c", 0.5, 1),
      bin("d", 0.5, 0),
    ];
    const d = murphyDecomposition(forecasts);
    expect(d.reliability).toBeCloseTo(0, 12);
    expect(d.resolution).toBeCloseTo(0, 12);
    expect(resolutionRatio(d)).toBeCloseTo(0, 12);
  });

  it("gives a perfect forecaster resolution equal to uncertainty", () => {
    const forecasts = [
      bin("a", 1, 1),
      bin("b", 0, 0),
      bin("c", 1, 1),
      bin("d", 0, 0),
    ];
    const d = murphyDecomposition(forecasts);
    expect(d.resolution).toBeCloseTo(d.uncertainty, 12);
    expect(d.brier).toBeCloseTo(0, 12);
    expect(resolutionRatio(d)).toBeCloseTo(1, 12);
  });

  it("computes uncertainty as base-rate variance", () => {
    const d = murphyDecomposition([
      bin("a", 0.5, 1),
      bin("b", 0.5, 0),
      bin("c", 0.5, 0),
      bin("d", 0.5, 0),
    ]);
    expect(d.baseRate).toBeCloseTo(0.25, 12);
    expect(d.uncertainty).toBeCloseTo(0.25 * 0.75, 12);
  });

  it("separates a miscalibrated forecaster from an undiscriminating one", () => {
    const overconfident = murphyDecomposition([
      bin("a", 0.9, 1),
      bin("b", 0.9, 0),
      bin("c", 0.9, 0),
      bin("d", 0.9, 0),
    ]);
    const hedger = murphyDecomposition([
      bin("a", 0.25, 1),
      bin("b", 0.25, 0),
      bin("c", 0.25, 0),
      bin("d", 0.25, 0),
    ]);
    expect(overconfident.reliability).toBeGreaterThan(hedger.reliability);
    expect(reliabilityRatio(hedger)).toBeCloseTo(0, 10);
  });

  it("groups by unique forecast value", () => {
    const d = murphyDecomposition([
      bin("a", 0.3, 1),
      bin("b", 0.3, 0),
      bin("c", 0.7, 1),
    ]);
    expect(d.groups).toHaveLength(2);
    expect(d.groups[0]!.forecast).toBe(0.3);
    expect(d.groups[0]!.count).toBe(2);
    expect(d.groups[0]!.observedFrequency).toBeCloseTo(0.5, 12);
  });
});

describe("calibration", () => {
  it("bins by stated probability and keeps empty bins for the axis", () => {
    const bins = calibrationBins([bin("a", 0.05, 0), bin("b", 0.95, 1)], 10);
    expect(bins).toHaveLength(10);
    expect(bins[0]!.count).toBe(1);
    expect(bins[9]!.count).toBe(1);
    expect(bins[5]!.count).toBe(0);
  });

  it("puts p = 1 in the last bin rather than dropping it", () => {
    const bins = calibrationBins([bin("a", 1, 1)], 10);
    expect(bins[9]!.count).toBe(1);
  });

  it("reports zero ECE for a perfectly calibrated set", () => {
    const forecasts = [
      bin("a", 0.5, 1),
      bin("b", 0.5, 0),
      bin("c", 0.9, 1),
      bin("d", 0.9, 1),
      bin("e", 0.9, 1),
      bin("f", 0.9, 1),
      bin("g", 0.9, 1),
      bin("h", 0.9, 1),
      bin("i", 0.9, 1),
      bin("j", 0.9, 1),
      bin("k", 0.9, 1),
      bin("l", 0.9, 0),
    ];
    expect(calibrationReport(forecasts).expectedCalibrationError).toBeLessThan(
      0.02,
    );
  });

  it("reports large ECE for an overconfident set", () => {
    const forecasts = Array.from({ length: 10 }, (_, i) =>
      bin(`x${i}`, 0.9, i < 3 ? 1 : 0),
    );
    const report = calibrationReport(forecasts);
    expect(report.expectedCalibrationError).toBeGreaterThan(0.5);
    expect(report.maximumCalibrationError).toBeGreaterThan(0.5);
  });

  it("exposes a bad region that ECE averages away", () => {
    // 100 well-calibrated forecasts plus 4 catastrophic ones: ECE stays small,
    // MCE does not.
    const good = Array.from({ length: 100 }, (_, i) =>
      bin(`g${i}`, 0.5, (i % 2) as 0 | 1),
    );
    const bad = Array.from({ length: 4 }, (_, i) => bin(`b${i}`, 0.95, 0));
    const report = calibrationReport([...good, ...bad]);
    expect(report.expectedCalibrationError).toBeLessThan(0.05);
    expect(report.maximumCalibrationError).toBeGreaterThan(0.9);
  });

  it("omits empty bins from the reliability diagram", () => {
    const report = calibrationReport(
      [bin("a", 0.05, 0), bin("b", 0.95, 1)],
      10,
    );
    expect(reliabilityDiagram(report)).toHaveLength(2);
  });

  // green-guard: allow calibrationBias was dead code (no caller outside this test), deleted with owner approval 2026-09-18

  it("rejects a zero bin count", () => {
    expect(() => calibrationBins([bin("a", 0.5, 1)], 0)).toThrow(RangeError);
  });
});

describe("ignorance and log scores", () => {
  it("is 0 bits for a perfect forecast", () => {
    expect(ignoranceScore([bin("a", 1, 1)])).toBeCloseTo(0, 5);
  });

  it("is 1 bit for a coin flip", () => {
    expect(ignoranceScore([bin("a", 0.5, 1), bin("b", 0.5, 0)])).toBeCloseTo(
      1,
      10,
    );
  });

  it("is 2 bits for a confident-but-quarter-right forecast", () => {
    expect(ignoranceScore([bin("a", 0.25, 1)])).toBeCloseTo(2, 10);
  });

  it("clips rather than returning infinity on a confident error", () => {
    // One question must not be allowed to decide the metric.
    const score = ignoranceScore([bin("a", 0, 1)]);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThan(15);
  });

  it("scores a categorical forecast on the band that occurred", () => {
    const forecast: CategoricalForecast = {
      id: "x",
      probabilities: [0.25, 0.5, 0.25],
      outcomeIndex: 1,
    };
    expect(categoricalIgnoranceScore([forecast])).toBeCloseTo(1, 10);
  });

  it("converts to nats", () => {
    expect(logScore([bin("a", 0.5, 1)])).toBeCloseTo(Math.LN2, 10);
  });
});

describe("sharpness", () => {
  it("flags a hedger who always states the base rate", () => {
    // Perfectly calibrated, zero information. Brier and ECE both approve.
    const forecasts = Array.from({ length: 10 }, (_, i) =>
      bin(`x${i}`, 0.3, i < 3 ? 1 : 0),
    );
    const report = sharpness(forecasts);
    expect(report.meanDeviationFromBaseRate).toBeLessThan(HEDGING_THRESHOLD);
    expect(report.isHedging).toBe(true);
  });

  it("does not flag a decisive forecaster", () => {
    const forecasts = [
      bin("a", 0.95, 1),
      bin("b", 0.05, 0),
      bin("c", 0.9, 1),
      bin("d", 0.1, 0),
    ];
    const report = sharpness(forecasts);
    expect(report.isHedging).toBe(false);
    expect(report.meanDecisiveness).toBeGreaterThan(0.7);
  });

  it("is independent of whether the forecasts were right", () => {
    // Sharpness is a property of the forecasts alone; being sharp and wrong
    // shows up in Brier, not here.
    const right = sharpness([bin("a", 0.9, 1), bin("b", 0.1, 0)]);
    const wrong = sharpness([bin("a", 0.9, 1), bin("b", 0.1, 1)]);
    expect(right.forecastVariance).toBeCloseTo(wrong.forecastVariance, 10);
  });
});

describe("entropy", () => {
  it("is 0 for a certain forecast", () => {
    expect(forecastEntropy([1, 0, 0])).toBeCloseTo(0, 10);
  });

  it("is log2(n) for a uniform forecast", () => {
    expect(forecastEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2, 10);
  });

  it("normalizes to 1 for a uniform forecast set", () => {
    const forecasts: CategoricalForecast[] = [
      { id: "a", probabilities: [0.25, 0.25, 0.25, 0.25], outcomeIndex: 0 },
    ];
    expect(meanNormalizedEntropy(forecasts)).toBeCloseTo(1, 10);
  });
});

describe("baselines", () => {
  const forecasts = [
    bin("a", 0.9, 1),
    bin("b", 0.8, 0),
    bin("c", 0.7, 1),
    bin("d", 0.2, 0),
  ];

  it("base rate baseline states the observed rate everywhere", () => {
    const baseline = baseRateBaseline(forecasts);
    expect(baseline.every((f) => f.probability === 0.5)).toBe(true);
  });

  it("base rate baseline has zero resolution by construction", () => {
    expect(
      resolutionRatio(murphyDecomposition(baseRateBaseline(forecasts))),
    ).toBeCloseTo(0, 10);
  });

  it("coin flip baseline scores 0.25", () => {
    expect(brierScore(coinFlipBaseline(forecasts))).toBeCloseTo(0.25, 10);
  });

  it("uniform baseline spreads evenly", () => {
    const categorical: CategoricalForecast[] = [
      { id: "a", probabilities: [0.7, 0.2, 0.1], outcomeIndex: 0 },
    ];
    expect(uniformBaseline(categorical)[0]!.probabilities).toEqual([
      1 / 3,
      1 / 3,
      1 / 3,
    ]);
  });

  it("single-run baseline never asserts 0% on the bands it missed", () => {
    const baseline = singleRunBaseline("x", 0, 4, 2);
    expect(baseline.probabilities.every((p) => p > 0)).toBe(true);
    expect(() => assertValidForecast(baseline)).not.toThrow();
  });

  it("compares against several baselines at once", () => {
    const comparisons = compareToBaselines(0.1, [
      { kind: "base_rate", score: 0.25 },
      { kind: "uniform", score: 0.5 },
    ]);
    expect(comparisons[0]!.skillScore).toBeCloseTo(0.6, 10);
    expect(comparisons[1]!.skillScore).toBeCloseTo(0.8, 10);
  });

  it("omits the human baseline unless one was actually measured", () => {
    // Inventing this number would be the most misleading thing here.
    const comparisons = compareToBaselines(0.1, [
      { kind: "base_rate", score: 0.25 },
    ]);
    expect(comparisons.map((c) => c.kind)).not.toContain("human_analyst");
  });
});

describe("type helpers", () => {
  it("collapses a categorical forecast to a binary one", () => {
    const forecast: CategoricalForecast = {
      id: "x",
      probabilities: [0.2, 0.5, 0.3],
      outcomeIndex: 1,
    };
    expect(toBinary(forecast, 1)).toEqual({
      id: "x",
      probability: 0.5,
      outcome: 1,
    });
    expect(toBinary(forecast, 0)).toEqual({
      id: "x",
      probability: 0.2,
      outcome: 0,
    });
  });

  it("builds one-hot vectors", () => {
    expect(oneHot(3, 1)).toEqual([0, 1, 0]);
  });
});
