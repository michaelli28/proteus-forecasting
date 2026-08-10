import { describe, it, expect } from "vitest";
import { CorpusSnapshot } from "../../src/corpus/snapshot.js";
import { AsOfCorpus, LeakageError } from "../../src/corpus/as-of.js";
import type { Document, Source } from "../../src/corpus/types.js";

const sources: Source[] = [
  {
    id: "s1",
    name: "Source One",
    credibility: 0.8,
    measurementMethod: "panel_survey",
  },
];

function doc(
  id: string,
  publishedAt: string,
  title: string,
  body: string,
): Document {
  return { id, sourceId: "s1", publishedAt, title, body, facts: [] };
}

const documents: Document[] = [
  doc(
    "past-1",
    "2026-01-10",
    "escalation indicators",
    "early warning of escalation in region",
  ),
  doc(
    "past-2",
    "2026-02-15",
    "supply chain report",
    "chokepoint analysis of supply chain",
  ),
  doc(
    "edge",
    "2026-03-01",
    "boundary report",
    "escalation observed exactly at cutoff",
  ),
  doc(
    "future-1",
    "2026-03-02",
    "escalation outcome",
    "the escalation resolved as follows",
  ),
  doc("future-2", "2026-06-01", "final answer", "escalation outcome confirmed"),
];

const snapshot = new CorpusSnapshot({ documents, sources });
const CUTOFF = "2026-03-01T23:59:59.999Z";

function corpusAt(asOf: string): AsOfCorpus {
  return new AsOfCorpus(snapshot, asOf);
}

describe("as-of visibility", () => {
  it("hides documents published after the cutoff", () => {
    const corpus = corpusAt(CUTOFF);
    expect(corpus.visibleCount).toBe(3);
    expect(corpus.hiddenCount).toBe(2);
  });

  it("includes a document published exactly at the cutoff", () => {
    expect(corpusAt(CUTOFF).isVisible("edge")).toBe(true);
  });

  it("never returns a future document from retrieve()", () => {
    const query = "escalation outcome confirmed answer";

    // Negative control first: without the cutoff this query DOES surface both
    // future documents. Otherwise the assertions below pass vacuously and a
    // broken filter would look fine.
    const unrestricted = corpusAt("2027-01-01")
      .retrieve(query, 50)
      .map((d) => d.id);
    expect(unrestricted).toContain("future-1");
    expect(unrestricted).toContain("future-2");

    const restricted = corpusAt(CUTOFF)
      .retrieve(query, 50)
      .map((d) => d.id);
    expect(restricted).not.toContain("future-1");
    expect(restricted).not.toContain("future-2");
  });

  it("never returns a future document from getDocument(), even by exact id", () => {
    // Closes the bypass where an id leaks in from somewhere other than retrieval.
    const corpus = corpusAt(CUTOFF);
    expect(corpus.getDocument("future-1")).toBeUndefined();
    expect(corpus.getDocument("past-1")).toBeDefined();
  });

  it("never exposes a future document through all()", () => {
    const ids = corpusAt(CUTOFF)
      .all()
      .map((d) => d.id);
    expect(ids).toEqual(["edge", "past-1", "past-2"]);
  });

  it("exposes everything when the cutoff is after all documents", () => {
    expect(corpusAt("2027-01-01").visibleCount).toBe(5);
  });

  it("exposes nothing when the cutoff precedes all documents", () => {
    const corpus = corpusAt("2020-01-01");
    expect(corpus.visibleCount).toBe(0);
    expect(corpus.retrieve("escalation")).toEqual([]);
  });

  it("rejects an invalid cutoff rather than defaulting", () => {
    expect(() => corpusAt("not-a-date")).toThrow(TypeError);
  });

  it("exposes the snapshot id for run pinning", () => {
    expect(corpusAt(CUTOFF).snapshotId).toBe(snapshot.id);
  });
});

describe("retrieval determinism", () => {
  it("returns identical results across constructions", () => {
    const a = corpusAt(CUTOFF).retrieve("escalation region", 10);
    const b = corpusAt(CUTOFF).retrieve("escalation region", 10);
    expect(a.map((d) => d.id)).toEqual(b.map((d) => d.id));
  });

  it("honors the limit", () => {
    expect(
      corpusAt(CUTOFF).retrieve("escalation supply chokepoint", 1),
    ).toHaveLength(1);
  });

  it("returns nothing for a query with no matching terms", () => {
    expect(corpusAt(CUTOFF).retrieve("zzzz qqqq")).toEqual([]);
  });

  it("returns nothing for an empty query", () => {
    expect(corpusAt(CUTOFF).retrieve("")).toEqual([]);
  });
});

describe("assertNoLeakage — layer 3", () => {
  it("passes on evidence that predates the cutoff", () => {
    const corpus = corpusAt(CUTOFF);
    expect(() =>
      corpus.assertNoLeakage([
        { id: "past-1", publishedAt: "2026-01-10" },
        { id: "edge", publishedAt: "2026-03-01" },
      ]),
    ).not.toThrow();
  });

  it("throws when a product cites a post-cutoff document", () => {
    const corpus = corpusAt(CUTOFF);
    expect(() =>
      corpus.assertNoLeakage([
        { id: "past-1", publishedAt: "2026-01-10" },
        { id: "future-2", publishedAt: "2026-06-01" },
      ]),
    ).toThrow(LeakageError);
  });

  it("names every offender in the error", () => {
    const corpus = corpusAt(CUTOFF);
    try {
      corpus.assertNoLeakage([
        { id: "future-1", publishedAt: "2026-03-02" },
        { id: "future-2", publishedAt: "2026-06-01" },
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LeakageError);
      const leak = error as LeakageError;
      expect(leak.offenders.map((o) => o.id)).toEqual(["future-1", "future-2"]);
      expect(leak.message).toContain("future-2@2026-06-01");
    }
  });

  it("reports without throwing via findLeakage", () => {
    const corpus = corpusAt(CUTOFF);
    const offenders = corpus.findLeakage([
      { id: "past-1", publishedAt: "2026-01-10" },
      { id: "future-1", publishedAt: "2026-03-02" },
    ]);
    expect(offenders.map((o) => o.id)).toEqual(["future-1"]);
  });

  it("passes trivially on empty evidence", () => {
    expect(() => corpusAt(CUTOFF).assertNoLeakage([])).not.toThrow();
  });

  it("rejects a ref with an unparseable date rather than letting it through", () => {
    // Silently admitting an undated citation is the leak this guard exists to stop.
    expect(() =>
      corpusAt(CUTOFF).assertNoLeakage([{ id: "x", publishedAt: "???" }]),
    ).toThrow(TypeError);
  });
});
