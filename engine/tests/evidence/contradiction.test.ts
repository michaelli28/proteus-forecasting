import { describe, it, expect } from "vitest";
import {
  detectContradictions,
  classifyConflict,
  reconcileConflict,
  disagreementPenalty,
} from "../../src/evidence/contradiction.js";
import type { ConflictParty } from "../../src/evidence/contradiction.js";
import {
  generateSyntheticCorpus,
  CANONICAL_DEFINITION,
  ALTERNATE_DEFINITION,
} from "../../src/corpus/synthetic.js";
import { CorpusSnapshot } from "../../src/corpus/snapshot.js";
import type { SyntheticCorpusOptions } from "../../src/corpus/synthetic.js";

function party(overrides: Partial<ConflictParty> = {}): ConflictParty {
  return {
    documentId: "doc-1",
    sourceId: "s1",
    value: 10,
    asOfDate: "2026-01-01",
    definition: CANONICAL_DEFINITION,
    unit: "pct",
    credibility: 0.5,
    measurementMethod: "panel_survey",
    ...overrides,
  };
}

describe("classifyConflict", () => {
  it("rules out scope first", () => {
    const a = party();
    const b = party({
      definition: ALTERNATE_DEFINITION,
      asOfDate: "2026-02-01",
    });
    // Both scope and date differ; scope is the reconcilable explanation checked
    // first, so this must not be reported as a date artefact.
    expect(classifyConflict(a, b)).toBe("different_definition");
  });

  it("rules out date next", () => {
    expect(classifyConflict(party(), party({ asOfDate: "2026-02-01" }))).toBe(
      "different_date",
    );
  });

  it("rules out instrument next", () => {
    expect(
      classifyConflict(
        party(),
        party({ measurementMethod: "platform_telemetry" }),
      ),
    ).toBe("different_measurement");
  });

  it("calls it a genuine dispute only when nothing else explains it", () => {
    expect(
      classifyConflict(party({ sourceId: "s1" }), party({ sourceId: "s2" })),
    ).toBe("genuine_dispute");
  });
});

describe("reconcileConflict", () => {
  it("takes the later observation for a date conflict", () => {
    const result = reconcileConflict(
      "different_date",
      party({ value: 10, asOfDate: "2026-01-01" }),
      party({ value: 20, asOfDate: "2026-02-01" }),
    );
    expect(result.value).toBe(20);
  });

  it("takes the more credible source for a measurement conflict", () => {
    const result = reconcileConflict(
      "different_measurement",
      party({ value: 10, credibility: 0.9 }),
      party({ value: 20, credibility: 0.3 }),
    );
    expect(result.value).toBe(10);
  });

  it("maps a definition conflict onto the canonical scope", () => {
    const result = reconcileConflict(
      "different_definition",
      party({ value: 10, definition: CANONICAL_DEFINITION }),
      party({ value: 20, definition: ALTERNATE_DEFINITION }),
      CANONICAL_DEFINITION,
    );
    expect(result.value).toBe(10);
  });

  it("refuses to guess when no canonical scope was supplied", () => {
    const result = reconcileConflict(
      "different_definition",
      party({ definition: CANONICAL_DEFINITION }),
      party({ definition: ALTERNATE_DEFINITION }),
    );
    expect(result.value).toBeNull();
  });

  it("never resolves a genuine dispute", () => {
    // The whole point: picking a side here manufactures confidence.
    const result = reconcileConflict(
      "genuine_dispute",
      party({ value: 10 }),
      party({ value: 90 }),
    );
    expect(result.value).toBeNull();
    expect(result.rationale).toContain("confidence");
  });
});

describe("detection against the seeded gold set", () => {
  const options: SyntheticCorpusOptions = {
    seed: "contradiction-gold",
    documentCount: 40,
    sourceCount: 6,
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    conflictsPerKind: 5,
  };
  const corpus = generateSyntheticCorpus(options);
  const report = detectContradictions(
    corpus.snapshot,
    corpus.snapshot.documents,
    CANONICAL_DEFINITION,
  );

  function detectedFor(subject: string) {
    return report.conflicts.filter((c) => c.subject === subject);
  }

  it("recalls every planted conflict", () => {
    for (const seeded of corpus.seededConflicts) {
      expect(
        detectedFor(seeded.subject),
        `missed ${seeded.subject}`,
      ).toHaveLength(1);
    }
  });

  it("classifies every planted conflict correctly", () => {
    let correct = 0;
    for (const seeded of corpus.seededConflicts) {
      const detected = detectedFor(seeded.subject)[0]!;
      if (detected.kind === seeded.kind) correct++;
    }
    // Measured classification accuracy on the gold set.
    expect(correct).toBe(corpus.seededConflicts.length);
  });

  it("reconciles every planted conflict to the labelled value", () => {
    for (const seeded of corpus.seededConflicts) {
      const detected = detectedFor(seeded.subject)[0]!;
      expect(
        detected.reconciledValue,
        `wrong reconciliation for ${seeded.subject}`,
      ).toBe(seeded.reconciledValue);
    }
  });

  it("leaves exactly the genuine disputes unresolved", () => {
    const seededDisputes = corpus.seededConflicts.filter(
      (c) => c.kind === "genuine_dispute",
    );
    for (const dispute of seededDisputes) {
      expect(detectedFor(dispute.subject)[0]!.reconciledValue).toBeNull();
    }
  });

  it("links each detected conflict to both source documents", () => {
    for (const seeded of corpus.seededConflicts) {
      const detected = detectedFor(seeded.subject)[0]!;
      const ids = detected.parties.map((p) => p.documentId).sort();
      expect(ids).toEqual([...seeded.documentIds].sort());
    }
  });
});

describe("detection mechanics", () => {
  const corpus = generateSyntheticCorpus({
    seed: "mechanics",
    documentCount: 0,
    sourceCount: 6,
    startDate: "2026-01-01",
    endDate: "2026-03-01",
    conflictsPerKind: 2,
  });

  it("does not report agreement as conflict", () => {
    const doc = {
      id: "d1",
      sourceId: "src-001",
      publishedAt: "2026-01-01",
      title: "t",
      body: "b",
      facts: [
        {
          subject: "x",
          value: 5,
          asOfDate: "2026-01-01",
          definition: CANONICAL_DEFINITION,
        },
      ],
    };
    const doc2 = { ...doc, id: "d2", sourceId: "src-002" };
    const snapshot = new CorpusSnapshot({
      documents: [doc, doc2],
      sources: [...corpus.snapshot.sources],
    });
    expect(detectContradictions(snapshot).conflicts).toEqual([]);
  });

  it("returns an empty report for an empty corpus", () => {
    const snapshot = new CorpusSnapshot({ documents: [], sources: [] });
    const report = detectContradictions(snapshot);
    expect(report.conflicts).toEqual([]);
    expect(report.unresolvedRate).toBe(0);
  });

  it("is deterministic in ordering", () => {
    const a = detectContradictions(
      corpus.snapshot,
      corpus.snapshot.documents,
      CANONICAL_DEFINITION,
    );
    const b = detectContradictions(
      corpus.snapshot,
      corpus.snapshot.documents,
      CANONICAL_DEFINITION,
    );
    expect(b.conflicts.map((c) => c.subject)).toEqual(
      a.conflicts.map((c) => c.subject),
    );
  });

  it("computes the unresolved rate over detected conflicts", () => {
    const report = detectContradictions(
      corpus.snapshot,
      corpus.snapshot.documents,
      CANONICAL_DEFINITION,
    );
    expect(report.unresolvedRate).toBeCloseTo(
      report.unresolved.length / report.conflicts.length,
      10,
    );
  });
});

describe("disagreementPenalty", () => {
  it("is 0 when everything reconciled", () => {
    expect(
      disagreementPenalty({ conflicts: [], unresolved: [], unresolvedRate: 0 }),
    ).toBe(0);
  });

  it("rises with the unresolved rate", () => {
    expect(
      disagreementPenalty({
        conflicts: [],
        unresolved: [],
        unresolvedRate: 0.4,
      }),
    ).toBeCloseTo(0.4, 10);
  });

  it("caps at 1", () => {
    expect(
      disagreementPenalty({ conflicts: [], unresolved: [], unresolvedRate: 5 }),
    ).toBe(1);
  });
});
