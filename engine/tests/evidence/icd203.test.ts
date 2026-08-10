import { describe, it, expect } from "vitest";
import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import {
  LIKELIHOOD_BANDS,
  CONFIDENCE_LEVELS,
  BAND_RANGES,
  bandForProbability,
  bandMidpoint,
  bandRange,
  judgmentFromProbability,
  aggregateConfidence,
  aggregateLikelihood,
  formatJudgment,
} from "../../src/evidence/icd203.js";

describe("ICD 203 bands", () => {
  it("covers the probability space without gaps", () => {
    for (let i = 1; i < LIKELIHOOD_BANDS.length; i++) {
      const previousMax = BAND_RANGES[LIKELIHOOD_BANDS[i - 1]!][1];
      const currentMin = BAND_RANGES[LIKELIHOOD_BANDS[i]!][0];
      expect(currentMin).toBeCloseTo(previousMax, 10);
    }
  });

  it("is ordered from least to most likely", () => {
    for (let i = 1; i < LIKELIHOOD_BANDS.length; i++) {
      expect(bandMidpoint(LIKELIHOOD_BANDS[i]!)).toBeGreaterThan(
        bandMidpoint(LIKELIHOOD_BANDS[i - 1]!),
      );
    }
  });

  it("maps representative probabilities to the published bands", () => {
    expect(bandForProbability(0.02)).toBe("almost_no_chance");
    expect(bandForProbability(0.1)).toBe("very_unlikely");
    expect(bandForProbability(0.3)).toBe("unlikely");
    expect(bandForProbability(0.5)).toBe("roughly_even");
    expect(bandForProbability(0.7)).toBe("likely");
    expect(bandForProbability(0.9)).toBe("very_likely");
    expect(bandForProbability(0.97)).toBe("almost_certain");
  });

  it("clamps values outside the published range", () => {
    expect(bandForProbability(0)).toBe("almost_no_chance");
    expect(bandForProbability(1)).toBe("almost_certain");
  });

  it("rejects a non-finite probability", () => {
    expect(() => bandForProbability(NaN)).toThrow(TypeError);
  });

  it("returns the published interval for a band", () => {
    expect(bandRange("likely")).toEqual([0.55, 0.8]);
  });
});

describe("judgmentFromProbability", () => {
  it("keeps band and point consistent", () => {
    const judgment = judgmentFromProbability(0.72, "moderate");
    expect(judgment.likelihood).toBe("likely");
    expect(judgment.likelihoodPoint).toBe(0.72);
  });

  it("carries confidence independently of likelihood", () => {
    // "Likely, low confidence" must be expressible — it is the common case.
    const judgment = judgmentFromProbability(0.7, "low");
    expect(judgment.likelihood).toBe("likely");
    expect(judgment.confidence).toBe("low");
  });
});

describe("aggregateConfidence — weakest link, never a mean", () => {
  it("returns the lowest level present", () => {
    expect(aggregateConfidence(["high", "moderate", "low"])).toBe("low");
    expect(aggregateConfidence(["high", "moderate"])).toBe("moderate");
    expect(aggregateConfidence(["high", "high"])).toBe("high");
  });

  it("does not let a majority outvote a single low-confidence view", () => {
    // A mean would return "high" here. Several confident readings of the same
    // thin evidence base do not manufacture a stronger evidence base.
    expect(aggregateConfidence(["high", "high", "high", "high", "low"])).toBe(
      "low",
    );
  });

  it("defaults to low on an empty ensemble", () => {
    expect(aggregateConfidence([])).toBe("low");
  });

  it("only ever returns a declared level", () => {
    expect(CONFIDENCE_LEVELS).toContain(
      aggregateConfidence(["moderate", "high"]),
    );
  });
});

describe("aggregateLikelihood", () => {
  it("averages point estimates", () => {
    expect(aggregateLikelihood([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 10);
  });

  it("honors weights", () => {
    expect(aggregateLikelihood([0, 1], [3, 1])).toBeCloseTo(0.25, 10);
  });

  it("rejects an empty ensemble rather than inventing 0.5", () => {
    expect(() => aggregateLikelihood([])).toThrow(RangeError);
  });

  it("rejects mismatched weights", () => {
    expect(() => aggregateLikelihood([0.5], [1, 2])).toThrow(RangeError);
  });

  it("rejects zero total weight", () => {
    expect(() => aggregateLikelihood([0.5, 0.5], [0, 0])).toThrow(RangeError);
  });
});

describe("formatJudgment", () => {
  it("always shows both axes", () => {
    const text = formatJudgment(judgmentFromProbability(0.7, "low"));
    expect(text).toContain("likely");
    expect(text).toContain("55%–80%");
    expect(text).toContain("low confidence");
  });
});

describe("structural guarantee: likelihood and confidence never collapse", () => {
  const EVIDENCE_DIR = fileURLToPath(
    new URL("../../src/evidence", import.meta.url),
  );

  async function sourceFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
    return files;
  }

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it("has files to scan", async () => {
    expect((await sourceFiles(EVIDENCE_DIR)).length).toBeGreaterThan(0);
  });

  it("declares no function reducing a Judgment to a number", async () => {
    // The requirement is enforced by the absence of the function, so the test
    // has to look for the function rather than for a behaviour.
    const collapsing =
      /\([^)]*:\s*(?:readonly\s+)?Judgment(?:\[\])?[^)]*\)\s*:\s*number/;
    const offenders: string[] = [];

    for (const path of await sourceFiles(EVIDENCE_DIR)) {
      if (collapsing.test(stripComments(await readFile(path, "utf-8")))) {
        offenders.push(relative(EVIDENCE_DIR, path));
      }
    }

    expect(
      offenders,
      `A function collapsing Judgment to a scalar destroys the ICD 203 separation. Found in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("detects such a function when one exists", async () => {
    // Negative control: the regex above must actually match the shape it bans,
    // otherwise the guard passes vacuously forever.
    const collapsing =
      /\([^)]*:\s*(?:readonly\s+)?Judgment(?:\[\])?[^)]*\)\s*:\s*number/;
    expect(
      collapsing.test("export function score(j: Judgment): number {"),
    ).toBe(true);
    expect(
      collapsing.test("export function agg(js: readonly Judgment[]): number {"),
    ).toBe(true);
    expect(collapsing.test("export function fine(j: Judgment): string {")).toBe(
      false,
    );
  });
});
