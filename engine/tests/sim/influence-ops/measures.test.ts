import { describe, it, expect } from "vitest";
import {
  mean,
  variance,
  skewness,
  kurtosis,
  bimodalityCoefficient,
  clusterSeparation,
  adoptionCount,
  measurePopulation,
  burstiness,
  interventionEffect,
  attributableDrift,
  beliefsOn,
  BIMODALITY_THRESHOLD,
} from "../../../src/sim/adapters/influence-ops/measures.js";
import type { Agent } from "../../../src/sim/adapters/influence-ops/network.js";

function agent(id: number, cluster: number, belief: number[]): Agent {
  return {
    id,
    cluster,
    belief,
    epsilon: 0.25,
    susceptibility: 0.5,
    mediaTrust: [],
  };
}

describe("basic moments", () => {
  it("computes the mean", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it("computes population variance", () => {
    // [2,4,6]: deviations -2,0,2 ⇒ (4+0+4)/3 = 8/3
    expect(variance([2, 4, 6])).toBeCloseTo(8 / 3, 10);
    expect(variance([5, 5, 5])).toBe(0);
    expect(variance([])).toBe(0);
  });

  it("reports zero skew for a symmetric sample", () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 10);
  });

  it("reports positive skew for a right-tailed sample", () => {
    expect(skewness([1, 1, 1, 1, 10])).toBeGreaterThan(0);
  });

  it("gives a uniform sample kurtosis near 1.8", () => {
    // Discrete uniform kurtosis tends to 1.8; well below the normal's 3.
    const uniform = Array.from({ length: 101 }, (_, i) => i / 100);
    expect(kurtosis(uniform)).toBeGreaterThan(1.7);
    expect(kurtosis(uniform)).toBeLessThan(1.9);
  });

  it("returns zero moments for a constant sample", () => {
    expect(skewness([3, 3, 3])).toBe(0);
    expect(kurtosis([3, 3, 3])).toBe(0);
  });
});

describe("bimodality coefficient", () => {
  it("exceeds the threshold for a two-peak sample", () => {
    const split = [...Array(50).fill(0.1), ...Array(50).fill(0.9)];
    expect(bimodalityCoefficient(split)).toBeGreaterThan(BIMODALITY_THRESHOLD);
  });

  it("stays below the threshold for a single-peak sample", () => {
    // Triangular, unimodal.
    const unimodal = [0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.6, 0.6, 0.7];
    expect(bimodalityCoefficient(unimodal)).toBeLessThan(BIMODALITY_THRESHOLD);
  });

  it("separates a split population from a merely spread one", () => {
    // The distinction the measure exists for: same variance, different society.
    const split = [...Array(50).fill(0.2), ...Array(50).fill(0.8)];
    const spread = Array.from({ length: 100 }, (_, i) => 0.2 + (0.6 * i) / 99);
    expect(variance(split)).toBeGreaterThan(variance(spread));
    expect(bimodalityCoefficient(split)).toBeGreaterThan(
      bimodalityCoefficient(spread),
    );
  });

  it("returns 0 for a constant sample", () => {
    expect(bimodalityCoefficient([0.5, 0.5, 0.5])).toBe(0);
  });
});

describe("cluster separation", () => {
  it("is the gap between the extreme cluster means", () => {
    const agents = [
      agent(0, 0, [0.1]),
      agent(1, 0, [0.3]),
      agent(2, 1, [0.7]),
      agent(3, 1, [0.9]),
    ];
    expect(clusterSeparation(agents, 0)).toBeCloseTo(0.6, 10);
  });

  it("is zero with a single cluster", () => {
    expect(clusterSeparation([agent(0, 0, [0.2]), agent(1, 0, [0.8])], 0)).toBe(
      0,
    );
  });
});

describe("adoption", () => {
  it("counts agents at or above the threshold", () => {
    const agents = [
      agent(0, 0, [0.59]),
      agent(1, 0, [0.6]),
      agent(2, 0, [0.9]),
    ];
    expect(adoptionCount(agents, 0)).toBe(2);
  });

  it("honors a custom threshold", () => {
    const agents = [agent(0, 0, [0.5]), agent(1, 0, [0.9])];
    expect(adoptionCount(agents, 0, 0.4)).toBe(2);
  });
});

describe("measurePopulation", () => {
  it("reports every measure together", () => {
    const agents = [
      agent(0, 0, [0.1]),
      agent(1, 0, [0.2]),
      agent(2, 1, [0.8]),
      agent(3, 1, [0.9]),
    ];
    const m = measurePopulation(agents, 0);
    expect(m.meanBelief).toBeCloseTo(0.5, 10);
    expect(m.adoptionRate).toBeCloseTo(0.5, 10);
    expect(m.clusterSeparation).toBeCloseTo(0.7, 10);
    expect(m.variance).toBeGreaterThan(0);
  });

  it("handles an empty population without dividing by zero", () => {
    const m = measurePopulation([], 0);
    expect(m.adoptionRate).toBe(0);
    expect(m.meanBelief).toBe(0);
  });

  it("reads the requested narrative dimension", () => {
    expect(beliefsOn([agent(0, 0, [0.1, 0.9])], 1)).toEqual([0.9]);
  });
});

describe("burstiness", () => {
  it("is 0 for a perfectly steady series", () => {
    expect(burstiness([5, 5, 5, 5])).toBe(0);
  });

  it("exceeds 1 for a spiky series", () => {
    expect(burstiness([0, 0, 0, 40])).toBeGreaterThan(1);
  });

  it("is 0 when nothing happened", () => {
    expect(burstiness([0, 0, 0])).toBe(0);
  });
});

describe("attributableDrift", () => {
  it("is the treated-minus-control difference", () => {
    expect(attributableDrift(0.55, 0.5)).toBeCloseTo(0.05, 10);
  });
});

describe("interventionEffect", () => {
  it("reports full restoration as ~1 with no overshoot", () => {
    const effect = interventionEffect(0.5, 0.6, 0.5, 90);
    expect(effect.restoredFraction).toBeCloseTo(1, 10);
    expect(effect.overshoot).toBe(0);
    expect(effect.costPerPointRestored).toBeCloseTo(900, 6);
  });

  it("reports partial restoration", () => {
    const effect = interventionEffect(0.5, 0.6, 0.55, 90);
    expect(effect.restoredFraction).toBeCloseTo(0.5, 10);
    expect(effect.overshoot).toBe(0);
  });

  it("flags overshoot instead of rewarding it", () => {
    // Measured counter-messaging behaviour: drove belief far past the
    // counterfactual. Raw drift reduction would score this best; it is a second
    // influence operation, not a defence.
    const effect = interventionEffect(0.497, 0.548, 0.299, 90);
    expect(effect.restoredFraction).toBeGreaterThan(1);
    expect(effect.overshoot).toBeCloseTo(0.198, 3);
  });

  it("caps useful correction at the campaign's actual drift", () => {
    // Overshooting must not buy a cheaper cost-per-point than exact correction.
    const exact = interventionEffect(0.5, 0.6, 0.5, 90);
    const overshot = interventionEffect(0.5, 0.6, 0.2, 90);
    expect(overshot.costPerPointRestored).toBeCloseTo(
      exact.costPerPointRestored,
      6,
    );
  });

  it("reports infinite cost when nothing was corrected", () => {
    expect(interventionEffect(0.5, 0.6, 0.6, 90).costPerPointRestored).toBe(
      Infinity,
    );
    expect(interventionEffect(0.5, 0.6, 0.65, 90).costPerPointRestored).toBe(
      Infinity,
    );
  });

  it("returns zero restoration when there was no campaign drift", () => {
    expect(interventionEffect(0.5, 0.5, 0.5, 0).restoredFraction).toBe(0);
  });
});
