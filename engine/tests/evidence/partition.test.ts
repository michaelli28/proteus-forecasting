import { describe, it, expect } from "vitest";
import {
  assertPartition,
  bandFor,
  resolveOutcome,
  uniformPartition,
  PartitionError,
} from "../../src/evidence/partition.js";
import type { OutcomeBand } from "../../src/evidence/partition.js";

const range = { min: 0, max: 1 };

const valid: OutcomeBand[] = [
  { id: "h1", statement: "low", lower: 0, upper: 0.33 },
  { id: "h2", statement: "mid", lower: 0.33, upper: 0.66 },
  { id: "h3", statement: "high", lower: 0.66, upper: 1 },
];

describe("assertPartition", () => {
  it("accepts a contiguous tiling", () => {
    expect(() => assertPartition(valid, range)).not.toThrow();
  });

  it("accepts bands supplied out of order", () => {
    expect(() =>
      assertPartition([valid[2]!, valid[0]!, valid[1]!], range),
    ).not.toThrow();
  });

  it("rejects overlapping bands", () => {
    // Overlap means the hypotheses are not mutually exclusive and the
    // probabilities cannot sum to 1.
    const overlapping = [
      { id: "h1", statement: "a", lower: 0, upper: 0.6 },
      { id: "h2", statement: "b", lower: 0.4, upper: 1 },
    ];
    expect(() => assertPartition(overlapping, range)).toThrow(/overlap/);
  });

  it("rejects a gap", () => {
    const gapped = [
      { id: "h1", statement: "a", lower: 0, upper: 0.3 },
      { id: "h2", statement: "b", lower: 0.5, upper: 1 },
    ];
    expect(() => assertPartition(gapped, range)).toThrow(/gap/);
  });

  it("rejects a partition not starting at the minimum", () => {
    const shifted = [
      { id: "h1", statement: "a", lower: 0.1, upper: 0.5 },
      { id: "h2", statement: "b", lower: 0.5, upper: 1 },
    ];
    expect(() => assertPartition(shifted, range)).toThrow(/starts at/);
  });

  it("rejects a partition not ending at the maximum", () => {
    const truncated = [
      { id: "h1", statement: "a", lower: 0, upper: 0.5 },
      { id: "h2", statement: "b", lower: 0.5, upper: 0.9 },
    ];
    expect(() => assertPartition(truncated, range)).toThrow(/ends at/);
  });

  it("rejects a single band", () => {
    expect(() =>
      assertPartition(
        [{ id: "h1", statement: "all", lower: 0, upper: 1 }],
        range,
      ),
    ).toThrow(PartitionError);
  });

  it("rejects duplicate ids", () => {
    const duplicated = [
      { id: "h1", statement: "a", lower: 0, upper: 0.5 },
      { id: "h1", statement: "b", lower: 0.5, upper: 1 },
    ];
    expect(() => assertPartition(duplicated, range)).toThrow(/unique/);
  });

  it("rejects an inverted band", () => {
    const inverted = [
      { id: "h1", statement: "a", lower: 0.5, upper: 0.2 },
      { id: "h2", statement: "b", lower: 0.5, upper: 1 },
    ];
    expect(() => assertPartition(inverted, range)).toThrow(/upper <= lower/);
  });

  it("rejects a non-finite bound", () => {
    const broken = [
      { id: "h1", statement: "a", lower: 0, upper: Number.NaN },
      { id: "h2", statement: "b", lower: 0.5, upper: 1 },
    ];
    expect(() => assertPartition(broken, range)).toThrow(/non-finite/);
  });
});

describe("bandFor", () => {
  it("assigns a value to exactly one band", () => {
    expect(bandFor(valid, 0.1)!.id).toBe("h1");
    expect(bandFor(valid, 0.5)!.id).toBe("h2");
    expect(bandFor(valid, 0.9)!.id).toBe("h3");
  });

  it("treats a boundary as belonging to the upper band", () => {
    expect(bandFor(valid, 0.33)!.id).toBe("h2");
    expect(bandFor(valid, 0.66)!.id).toBe("h3");
  });

  it("includes both endpoints of the full range", () => {
    // The top band closes so the maximum itself resolves rather than falling out.
    expect(bandFor(valid, 0)!.id).toBe("h1");
    expect(bandFor(valid, 1)!.id).toBe("h3");
  });

  it("returns null outside the range", () => {
    expect(bandFor(valid, -0.1)).toBeNull();
    expect(bandFor(valid, 1.1)).toBeNull();
  });
});

describe("resolveOutcome", () => {
  it("produces a one-hot vector in sorted band order", () => {
    expect(resolveOutcome(valid, 0.5)).toEqual({
      bandId: "h2",
      oneHot: [0, 1, 0],
    });
  });

  it("orders the vector independently of input order", () => {
    const shuffled = [valid[2]!, valid[0]!, valid[1]!];
    expect(resolveOutcome(shuffled, 0.5).oneHot).toEqual([0, 1, 0]);
  });

  it("sums to exactly 1", () => {
    const { oneHot } = resolveOutcome(valid, 0.9);
    expect(oneHot.reduce((s, v) => s + v, 0)).toBe(1);
  });

  it("throws rather than silently dropping an out-of-range outcome", () => {
    expect(() => resolveOutcome(valid, 2)).toThrow(PartitionError);
  });
});

describe("uniformPartition", () => {
  it("produces a valid partition", () => {
    const bands = uniformPartition(range, 4, (lo, hi) => `${lo}-${hi}`);
    expect(bands).toHaveLength(4);
    expect(() => assertPartition(bands, range)).not.toThrow();
  });

  it("closes exactly on the maximum despite floating point", () => {
    // Accumulated width arithmetic is the classic source of a 0.9999999 endpoint.
    const bands = uniformPartition({ min: 0, max: 1 }, 3, () => "x");
    expect(bands[2]!.upper).toBe(1);
  });

  it("handles a non-zero minimum", () => {
    const bands = uniformPartition({ min: 10, max: 20 }, 2, () => "x");
    expect(bands[0]!.lower).toBe(10);
    expect(bands[1]!.upper).toBe(20);
    expect(() => assertPartition(bands, { min: 10, max: 20 })).not.toThrow();
  });

  it("rejects fewer than two bands", () => {
    expect(() => uniformPartition(range, 1, () => "x")).toThrow(PartitionError);
  });
});
