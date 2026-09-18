import { describe, it, expect } from "vitest";
import { Rng } from "../../src/sim/rng.js";
import { benchmarkQuestions, truthSpec } from "../../src/pipeline/benchmark.js";
import {
  pooledMahalanobis,
  priorDraws,
  rankPValue,
} from "../../src/pipeline/misspec-check.js";

describe("rankPValue", () => {
  it("is 1/(N+1) when the observed member is strictly the most extreme", () => {
    expect(rankPValue([9, 1, 2, 3, 4], 0)).toBeCloseTo(1 / 5, 12);
  });

  it("is 1 when the observed member is the least extreme", () => {
    expect(rankPValue([0, 1, 2, 3, 4], 0)).toBe(1);
  });

  it("counts ties against the alarm", () => {
    expect(rankPValue([2, 2, 2, 2], 0)).toBe(1);
    expect(rankPValue([5, 5, 1, 1], 0)).toBeCloseTo(2 / 4, 12);
  });
});

describe("pooledMahalanobis", () => {
  const points = [
    [1, 0.2, 3],
    [1.1, 0.25, 2.9],
    [0.9, 0.18, 3.2],
    [1.05, 0.22, 3.05],
    [0.95, 0.21, 2.95],
    [1.02, 0.19, 3.1],
  ];

  it("gives each member the same score whatever order the set arrives in", () => {
    const order = [3, 0, 5, 1, 4, 2];
    const scores = pooledMahalanobis(points);
    const shuffled = pooledMahalanobis(order.map((i) => points[i]!));
    order.forEach((original, position) =>
      expect(shuffled[position]).toBeCloseTo(scores[original]!, 10),
    );
  });

  it("scores a far outlier highest", () => {
    const scores = pooledMahalanobis([...points, [3, 0.9, 8]]);
    expect(scores.indexOf(Math.max(...scores))).toBe(points.length);
  });

  it("stays finite when a channel never varies", () => {
    const flat = points.map(([a, b]) => [a!, b!, 7]);
    for (const score of pooledMahalanobis(flat)) {
      expect(Number.isFinite(score)).toBe(true);
    }
  });

  it("matches (x − x̄)²/s² in one dimension", () => {
    const scores = pooledMahalanobis([[1], [2], [3], [4]]);
    // x̄ = 2.5, s² = 5/3.
    [1, 2, 3, 4].forEach((x, i) =>
      expect(scores[i]).toBeCloseTo((x - 2.5) ** 2 / (5 / 3), 6),
    );
  });

  it("matches cᵀΣ⁻¹c with off-diagonals shrunk by 10% in two dimensions", () => {
    const pts = [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 3],
    ];
    // x̄ = (1.5, 1.25); sample covariance [[5/3, 17/12], [17/12, 1.5833…]].
    const mx = 1.5;
    const my = 1.25;
    const c = pts.map(([x, y]) => [x! - mx, y! - my]);
    const sxx = c.reduce((s, [x]) => s + x! * x!, 0) / 3;
    const syy = c.reduce((s, [, y]) => s + y! * y!, 0) / 3;
    const sxy = 0.9 * (c.reduce((s, [x, y]) => s + x! * y!, 0) / 3);
    const det = sxx * syy - sxy * sxy;
    const expected = c.map(
      ([x, y]) => (syy * x! * x! - 2 * sxy * x! * y! + sxx * y! * y!) / det,
    );
    const scores = pooledMahalanobis(pts);
    expected.forEach((e, i) => expect(scores[i]).toBeCloseTo(e, 6));
  });

  it("gives the same scores whatever units a channel is measured in", () => {
    // Channels whose variances differ by twelve orders of magnitude, as
    // burstiness and hubConcentration do on the reference world.
    const wide = [10, -5, 3, 12, -8, 0, 7, -2];
    const narrow = [3, -1, 2, -4, 0, 1, -2, 5].map((v) => 1 + 1e-5 * v);
    const raw = wide.map((w, i) => [w, narrow[i]!]);
    const rescaled = wide.map((w, i) => [w, narrow[i]! * 1e6]);
    const a = pooledMahalanobis(raw);
    const b = pooledMahalanobis(rescaled);
    a.forEach((score, i) => expect(b[i]).toBeCloseTo(score, 6));
  });
});

describe("the rank check when the model is right", () => {
  // The theorem: if the truth is exchangeable with the draws, the rank of its
  // score is uniform, so P(p ≤ α) ≤ α. N = 19 makes α(N+1) = 1 an integer and
  // the bound exact at 1/20 when there are no ties.
  it("alarms on at most α of exchangeable worlds", () => {
    const rng = new Rng("exchangeable");
    const N = 19;
    const reps = 4000;
    let alarms = 0;
    for (let rep = 0; rep < reps; rep++) {
      const members = Array.from({ length: N + 1 }, () => [
        rng.normal(),
        rng.normal(0, 3),
        rng.uniform(0, 1),
        rng.normal(5, 0.1),
      ]);
      if (rankPValue(pooledMahalanobis(members), 0) <= 0.05) alarms++;
    }
    // sd of the rate at 4000 reps is 0.0034; ±0.012 is 3.5 sd.
    expect(alarms / reps).toBeGreaterThan(0.05 - 0.012);
    expect(alarms / reps).toBeLessThan(0.05 + 0.012);
  });
});

describe("priorDraws", () => {
  const [question] = benchmarkQuestions(1, "draws");

  it("draws exactly as truthSpec does: same uniforms, same rounding", () => {
    const [draw] = priorDraws(question!.truthPrior, [
      `${question!.rootSeed}/truth-draw`,
    ]);
    const truth = truthSpec(question!);
    expect(draw!.riskTolerance).toBe(truth.riskTolerance);
    expect(draw!.escalationPropensity).toBe(truth.escalationPropensity);
  });

  it("lands every draw inside the box, rounded to hundredths", () => {
    const seeds = Array.from({ length: 50 }, (_, i) => `s/${i}`);
    const { riskRange, escalationRange } = question!.prior;
    for (const draw of priorDraws(question!.prior, seeds)) {
      expect(draw.riskTolerance).toBeGreaterThanOrEqual(riskRange[0]);
      expect(draw.riskTolerance).toBeLessThanOrEqual(riskRange[1]);
      expect(draw.escalationPropensity).toBeGreaterThanOrEqual(
        escalationRange[0],
      );
      expect(draw.escalationPropensity).toBeLessThanOrEqual(escalationRange[1]);
      expect(Number(draw.riskTolerance.toFixed(2))).toBe(draw.riskTolerance);
    }
  });

  it("gives every draw its own id", () => {
    const draws = priorDraws(question!.prior, ["a", "b", "c"]);
    expect(new Set(draws.map((d) => d.id)).size).toBe(3);
  });
});
