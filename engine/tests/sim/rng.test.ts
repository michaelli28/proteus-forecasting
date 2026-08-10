import { describe, it, expect } from "vitest";
import { Rng } from "../../src/sim/rng.js";

function draw(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

describe("Rng determinism", () => {
  it("same seed produces an identical stream", () => {
    expect(draw(new Rng("alpha"), 200)).toEqual(draw(new Rng("alpha"), 200));
  });

  it("different seeds diverge", () => {
    expect(draw(new Rng("alpha"), 50)).not.toEqual(draw(new Rng("beta"), 50));
  });

  it("a one-character seed change fully changes the stream", () => {
    const a = draw(new Rng("run-0001"), 50);
    const b = draw(new Rng("run-0002"), 50);
    const shared = a.filter((v, i) => v === b[i]).length;
    expect(shared).toBe(0);
  });

  it("advances state on every draw", () => {
    const rng = new Rng("s");
    const before = [...rng.snapshot()];
    rng.next();
    expect([...rng.snapshot()]).not.toEqual(before);
  });
});

describe("Rng.fork", () => {
  it("is deterministic for the same label", () => {
    const parentSnapshot = () => new Rng("root").fork("network");
    expect(draw(parentSnapshot(), 50)).toEqual(draw(parentSnapshot(), 50));
  });

  it("gives independent streams to different labels", () => {
    const root = new Rng("root");
    expect(draw(root.fork("network"), 50)).not.toEqual(
      draw(root.fork("campaign"), 50),
    );
  });

  it("insulates a sub-stream from draws taken on the parent", () => {
    // The reason fork exists: adding a draw to one subsystem must not silently
    // shift another subsystem's results.
    const withoutParentDraws = new Rng("root");
    const a = draw(withoutParentDraws.fork("campaign"), 30);

    const withParentDraws = new Rng("root");
    draw(withParentDraws, 17);
    const b = draw(withParentDraws.fork("campaign"), 30);

    expect(a).toEqual(b);
  });

  it("insulates sibling sub-streams from each other", () => {
    const root = new Rng("root");
    const campaignFirst = draw(root.fork("campaign"), 20);

    const root2 = new Rng("root");
    draw(root2.fork("network"), 99);
    const campaignAfterNetwork = draw(root2.fork("campaign"), 20);

    expect(campaignFirst).toEqual(campaignAfterNetwork);
  });
});

describe("Rng distributions", () => {
  it("next() stays in [0, 1)", () => {
    const values = draw(new Rng("range"), 5000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("next() is roughly uniform", () => {
    const values = draw(new Rng("uniform"), 20000);
    const m = values.reduce((s, v) => s + v, 0) / values.length;
    expect(m).toBeGreaterThan(0.48);
    expect(m).toBeLessThan(0.52);
  });

  it("uniform(min, max) respects bounds", () => {
    const rng = new Rng("bounds");
    for (let i = 0; i < 1000; i++) {
      const v = rng.uniform(-3, 7);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(7);
    }
  });

  it("int() covers every value and stays in range", () => {
    const rng = new Rng("ints");
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("int() rejects a non-positive bound", () => {
    expect(() => new Rng("x").int(0)).toThrow(RangeError);
  });

  it("bernoulli(p) approximates p", () => {
    const rng = new Rng("bern");
    const hits = Array.from({ length: 20000 }, () => rng.bernoulli(0.3)).filter(
      Boolean,
    ).length;
    expect(hits / 20000).toBeGreaterThan(0.28);
    expect(hits / 20000).toBeLessThan(0.32);
  });

  it("normal() has approximately the requested mean and stddev", () => {
    const rng = new Rng("norm");
    const values = Array.from({ length: 20000 }, () => rng.normal(5, 2));
    const m = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(
      values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length,
    );
    expect(m).toBeGreaterThan(4.9);
    expect(m).toBeLessThan(5.1);
    expect(sd).toBeGreaterThan(1.9);
    expect(sd).toBeLessThan(2.1);
  });

  it("normal() output does not depend on call parity", () => {
    // A cached Box-Muller spare would make these differ.
    const a = new Rng("parity");
    a.next();
    const afterOneDraw = a.normal();

    const b = new Rng("parity");
    b.next();
    const alsoAfterOneDraw = b.normal();

    expect(afterOneDraw).toBe(alsoAfterOneDraw);
  });

  it("clampedNormal() respects its bounds", () => {
    const rng = new Rng("clamp");
    for (let i = 0; i < 2000; i++) {
      const v = rng.clampedNormal(0.5, 5, 0, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("weightedIndex() honors the weights", () => {
    const rng = new Rng("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[rng.weightedIndex([1, 3, 6])]!++;
    expect(counts[0]! / 20000).toBeCloseTo(0.1, 1);
    expect(counts[1]! / 20000).toBeCloseTo(0.3, 1);
    expect(counts[2]! / 20000).toBeCloseTo(0.6, 1);
  });

  it("weightedIndex() rejects all-zero weights", () => {
    expect(() => new Rng("z").weightedIndex([0, 0])).toThrow(RangeError);
  });
});

describe("Rng collection helpers", () => {
  it("shuffle() permutes without mutating the input", () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = new Rng("shuf").shuffle(input);
    expect(out).toHaveLength(8);
    expect([...out].sort((a, b) => a - b)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("shuffle() is deterministic", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(new Rng("s").shuffle(items)).toEqual(new Rng("s").shuffle(items));
  });

  it("sample() returns distinct items and caps at array length", () => {
    const items = [1, 2, 3, 4, 5];
    const out = new Rng("samp").sample(items, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    expect(new Rng("samp").sample(items, 99)).toHaveLength(5);
  });

  it("pick() rejects an empty array", () => {
    expect(() => new Rng("p").pick([])).toThrow(RangeError);
  });
});
