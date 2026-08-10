import { describe, it, expect } from "vitest";
import {
  generateSyntheticCorpus,
  CANONICAL_DEFINITION,
} from "../../src/corpus/synthetic.js";
import { CONFLICT_KINDS } from "../../src/corpus/types.js";
import { AsOfCorpus } from "../../src/corpus/as-of.js";
import { CorpusSnapshot } from "../../src/corpus/snapshot.js";
import type { SyntheticCorpusOptions } from "../../src/corpus/synthetic.js";
import type { Document } from "../../src/corpus/types.js";

const OPTIONS: SyntheticCorpusOptions = {
  seed: "corpus-test-1",
  documentCount: 60,
  sourceCount: 6,
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  conflictsPerKind: 3,
};

const corpus = generateSyntheticCorpus(OPTIONS);

function docsFor(conflictIndex: number): [Document, Document] {
  const conflict = corpus.seededConflicts[conflictIndex]!;
  const [aId, bId] = conflict.documentIds;
  return [corpus.snapshot.getDocument(aId)!, corpus.snapshot.getDocument(bId)!];
}

describe("determinism", () => {
  it("same options produce an identical snapshot id", () => {
    expect(generateSyntheticCorpus(OPTIONS).snapshot.id).toBe(
      corpus.snapshot.id,
    );
  });

  it("a different seed produces a different snapshot", () => {
    expect(
      generateSyntheticCorpus({ ...OPTIONS, seed: "other" }).snapshot.id,
    ).not.toBe(corpus.snapshot.id);
  });

  it("snapshot id ignores document insertion order", () => {
    const reordered = [...corpus.snapshot.documents].reverse();
    expect(
      new CorpusSnapshot({
        documents: reordered,
        sources: corpus.snapshot.sources,
      }).id,
    ).toBe(corpus.snapshot.id);
  });
});

describe("corpus shape", () => {
  it("emits background documents plus two per planted conflict", () => {
    const expected =
      OPTIONS.documentCount +
      CONFLICT_KINDS.length * OPTIONS.conflictsPerKind * 2;
    expect(corpus.snapshot.size).toBe(expected);
  });

  it("gives every document a unique id", () => {
    const ids = corpus.snapshot.documents.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only sources present in the snapshot", () => {
    expect(corpus.snapshot.danglingSourceRefs()).toEqual([]);
  });

  it("dates every document inside the requested range", () => {
    for (const d of corpus.snapshot.documents) {
      expect(Date.parse(d.publishedAt)).toBeGreaterThanOrEqual(
        Date.parse(OPTIONS.startDate),
      );
      expect(Date.parse(d.publishedAt)).toBeLessThanOrEqual(
        Date.parse(OPTIONS.endDate),
      );
    }
  });

  it("gives every source a credibility in [0,1]", () => {
    for (const s of corpus.snapshot.sources) {
      expect(s.credibility).toBeGreaterThanOrEqual(0);
      expect(s.credibility).toBeLessThanOrEqual(1);
    }
  });
});

describe("the gold set", () => {
  it("plants the requested count of every kind", () => {
    for (const kind of CONFLICT_KINDS) {
      const planted = corpus.seededConflicts.filter((c) => c.kind === kind);
      expect(planted, `kind ${kind}`).toHaveLength(OPTIONS.conflictsPerKind);
    }
  });

  it("points each conflict at two real, distinct documents", () => {
    for (const conflict of corpus.seededConflicts) {
      const [a, b] = conflict.documentIds;
      expect(a).not.toBe(b);
      expect(corpus.snapshot.getDocument(a)).toBeDefined();
      expect(corpus.snapshot.getDocument(b)).toBeDefined();
    }
  });

  it("makes both documents of a conflict assert the same subject with different values", () => {
    for (let i = 0; i < corpus.seededConflicts.length; i++) {
      const [a, b] = docsFor(i);
      const factA = a.facts[0]!;
      const factB = b.facts[0]!;
      expect(factA.subject).toBe(corpus.seededConflicts[i]!.subject);
      expect(factB.subject).toBe(factA.subject);
      expect(factA.value).not.toBe(factB.value);
    }
  });
});

describe("conflict kinds are structurally distinguishable", () => {
  function conflictsOf(kind: (typeof CONFLICT_KINDS)[number]) {
    return corpus.seededConflicts
      .map((c, i) => ({ c, i }))
      .filter((entry) => entry.c.kind === kind);
  }

  it("different_measurement differs only by instrument", () => {
    for (const { i } of conflictsOf("different_measurement")) {
      const [a, b] = docsFor(i);
      expect(a.facts[0]!.asOfDate).toBe(b.facts[0]!.asOfDate);
      expect(a.facts[0]!.definition).toBe(b.facts[0]!.definition);
      const methodA = corpus.snapshot.getSource(a.sourceId)!.measurementMethod;
      const methodB = corpus.snapshot.getSource(b.sourceId)!.measurementMethod;
      expect(methodA).not.toBe(methodB);
    }
  });

  it("different_date differs only by observation date", () => {
    for (const { i } of conflictsOf("different_date")) {
      const [a, b] = docsFor(i);
      expect(a.facts[0]!.asOfDate).not.toBe(b.facts[0]!.asOfDate);
      expect(a.facts[0]!.definition).toBe(b.facts[0]!.definition);
    }
  });

  it("different_definition differs only by scope", () => {
    for (const { i } of conflictsOf("different_definition")) {
      const [a, b] = docsFor(i);
      expect(a.facts[0]!.asOfDate).toBe(b.facts[0]!.asOfDate);
      expect(a.facts[0]!.definition).not.toBe(b.facts[0]!.definition);
      expect(a.facts[0]!.definition).toBe(CANONICAL_DEFINITION);
    }
  });

  it("genuine_dispute matches on date, scope, unit and instrument", () => {
    // Every reconcilable explanation is ruled out by construction, which is what
    // makes it a dispute rather than a measurement artefact.
    for (const { i } of conflictsOf("genuine_dispute")) {
      const [a, b] = docsFor(i);
      expect(a.facts[0]!.asOfDate).toBe(b.facts[0]!.asOfDate);
      expect(a.facts[0]!.definition).toBe(b.facts[0]!.definition);
      expect(a.facts[0]!.unit).toBe(b.facts[0]!.unit);
      expect(a.sourceId).not.toBe(b.sourceId);
      const methodA = corpus.snapshot.getSource(a.sourceId)!.measurementMethod;
      const methodB = corpus.snapshot.getSource(b.sourceId)!.measurementMethod;
      expect(methodA).toBe(methodB);
    }
  });
});

describe("reconciliation labels", () => {
  it("leaves genuine disputes unreconciled", () => {
    for (const c of corpus.seededConflicts.filter(
      (x) => x.kind === "genuine_dispute",
    )) {
      expect(c.reconciledValue).toBeNull();
    }
  });

  it("labels every reconcilable kind with a value drawn from its documents", () => {
    for (const c of corpus.seededConflicts.filter(
      (x) => x.kind !== "genuine_dispute",
    )) {
      expect(c.reconciledValue).not.toBeNull();
      const values = c.documentIds.map(
        (id) => corpus.snapshot.getDocument(id)!.facts[0]!.value,
      );
      expect(values).toContain(c.reconciledValue);
    }
  });

  it("reconciles different_date to the later observation", () => {
    for (const { c, i } of corpus.seededConflicts
      .map((c, i) => ({ c, i }))
      .filter((e) => e.c.kind === "different_date")) {
      const [a, b] = docsFor(i);
      const later =
        Date.parse(a.facts[0]!.asOfDate) > Date.parse(b.facts[0]!.asOfDate)
          ? a
          : b;
      expect(c.reconciledValue).toBe(later.facts[0]!.value);
    }
  });

  it("reconciles different_measurement to the more credible source", () => {
    for (const { c, i } of corpus.seededConflicts
      .map((c, i) => ({ c, i }))
      .filter((e) => e.c.kind === "different_measurement")) {
      const [a, b] = docsFor(i);
      const credA = corpus.snapshot.getSource(a.sourceId)!.credibility;
      const credB = corpus.snapshot.getSource(b.sourceId)!.credibility;
      const expected = credA >= credB ? a.facts[0]!.value : b.facts[0]!.value;
      expect(c.reconciledValue).toBe(expected);
    }
  });
});

describe("validation", () => {
  it("rejects an inverted date range", () => {
    expect(() =>
      generateSyntheticCorpus({
        ...OPTIONS,
        startDate: "2026-06-30",
        endDate: "2026-01-01",
      }),
    ).toThrow(RangeError);
  });

  it("rejects too few sources to plant a genuine dispute", () => {
    // Silently degrading to one source disputing itself would corrupt the gold set.
    expect(() =>
      generateSyntheticCorpus({ ...OPTIONS, sourceCount: 2 }),
    ).toThrow(RangeError);
  });

  it("allows few sources when no conflicts are requested", () => {
    expect(() =>
      generateSyntheticCorpus({
        ...OPTIONS,
        sourceCount: 2,
        conflictsPerKind: 0,
      }),
    ).not.toThrow();
  });
});

describe("composes with the as-of guard", () => {
  it("hides later documents at an earlier cutoff", () => {
    const early = new AsOfCorpus(corpus.snapshot, "2026-02-01");
    const late = new AsOfCorpus(corpus.snapshot, "2026-12-31");
    expect(early.visibleCount).toBeLessThan(late.visibleCount);
    expect(late.visibleCount).toBe(corpus.snapshot.size);
    for (const d of early.all()) {
      expect(Date.parse(d.publishedAt)).toBeLessThanOrEqual(
        Date.parse("2026-02-01"),
      );
    }
  });
});
