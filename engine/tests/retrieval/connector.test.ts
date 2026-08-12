import { describe, expect, it } from "vitest";

import {
  createSuppliedConnector,
  describeOrigin,
  enforceCutoff,
  RetrievalError,
} from "../../src/retrieval/connector.js";
import type { RetrievedDocument } from "../../src/retrieval/connector.js";
import {
  createWebConnector,
  parsePublishedDate,
} from "../../src/retrieval/web.js";

function doc(overrides: Partial<RetrievedDocument> = {}): RetrievedDocument {
  return {
    id: "d1",
    origin: "supplied",
    sourceId: "example.gov",
    title: "A report",
    publishedAt: "2026-01-01",
    excerpt: "the network serves 40000 households across two zones",
    retrievedAt: "2026-08-01",
    ...overrides,
  };
}

describe("as-of enforcement", () => {
  it("keeps documents published on or before the cutoff", () => {
    const { kept, excluded } = enforceCutoff(
      [
        doc({ id: "a", publishedAt: "2025-06-01" }),
        doc({ id: "b", publishedAt: "2026-01-01" }),
      ],
      "2026-01-01",
    );
    expect(kept.map((d) => d.id)).toEqual(["a", "b"]);
    expect(excluded).toBe(0);
  });

  it("excludes documents published after the cutoff", () => {
    const { kept, excluded } = enforceCutoff(
      [doc({ id: "a", publishedAt: "2026-09-01" })],
      "2026-08-01",
    );
    expect(kept).toEqual([]);
    expect(excluded).toBe(1);
  });

  it("excludes an undated document rather than admitting it", () => {
    // The one gap the guard cannot see: an unparseable date admitted as "old"
    // would let post-cutoff material through undetected.
    const { kept, excluded } = enforceCutoff(
      [doc({ id: "a", publishedAt: "sometime last spring" })],
      "2026-08-01",
    );
    expect(kept).toEqual([]);
    expect(excluded).toBe(1);
  });

  it("throws on an unparseable cutoff rather than passing everything", () => {
    expect(() => enforceCutoff([doc()], "not-a-date")).toThrow(RetrievalError);
  });
});

describe("supplied connector", () => {
  const connector = createSuppliedConnector(
    "eval-holdings",
    "an evaluator system",
    [
      doc({ id: "a", excerpt: "the grid serves 40000 households" }),
      doc({ id: "b", excerpt: "the port handles 9000 containers a day" }),
      doc({
        id: "c",
        publishedAt: "2027-01-01",
        excerpt: "grid households future",
      }),
    ],
  );

  it("returns matching documents and nothing else", async () => {
    const result = await connector.retrieve({
      question: "how many households does the grid serve",
      asOf: "2026-08-01",
    });
    expect(result.documents.map((d) => d.id)).toEqual(["a"]);
  });

  it("applies the cutoff before matching", async () => {
    const result = await connector.retrieve({
      question: "grid households",
      asOf: "2026-08-01",
    });
    expect(result.documents.map((d) => d.id)).not.toContain("c");
    expect(result.excludedByCutoff).toBe(1);
  });

  it("is stable across identical calls", async () => {
    const query = { question: "grid port", asOf: "2026-08-01" };
    const first = await connector.retrieve(query);
    const second = await connector.retrieve(query);
    expect(first.documents.map((d) => d.id)).toEqual(
      second.documents.map((d) => d.id),
    );
  });

  it("declares its origin so the product can say where this came from", () => {
    expect(connector.origin).toBe("supplied");
    expect(describeOrigin(connector)).toMatch(
      /asserts nothing about this material/,
    );
  });
});

describe("web connector", () => {
  it("parses a date it can read and refuses one it cannot", () => {
    expect(parsePublishedDate("April 30, 2025")).toBe("2025-04-30");
    expect(parsePublishedDate("2025-04-30")).toBe("2025-04-30");
    expect(parsePublishedDate("a while ago")).toBeNull();
    expect(parsePublishedDate(undefined)).toBeNull();
  });

  it("keeps cited passages and drops the model's prose", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "server_tool_use",
              name: "web_search",
              input: { query: "grid capacity" },
            },
            {
              type: "web_search_tool_result",
              content: [
                {
                  type: "web_search_result",
                  url: "https://example.gov/report",
                  title: "Annual Report",
                  page_age: "March 2, 2026",
                },
              ],
            },
            {
              type: "text",
              text: "This prose summary must not survive.",
              citations: [
                {
                  type: "web_search_result_location",
                  url: "https://example.gov/report",
                  title: "Annual Report",
                  cited_text: "the system serves 76,400 customers",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const connector = createWebConnector({
      apiKey: "test-key",
      fetchImpl,
      now: () => new Date("2026-08-01T00:00:00Z"),
    });

    const result = await connector.retrieve({
      question: "grid capacity",
      asOf: "2026-08-01",
    });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]!.excerpt).toBe(
      "the system serves 76,400 customers",
    );
    expect(result.documents[0]!.sourceId).toBe("example.gov");
    expect(result.documents[0]!.publishedAt).toBe("2026-03-02");
    expect(result.queriesIssued).toEqual(["grid capacity"]);
    expect(JSON.stringify(result)).not.toContain("prose summary");
  });

  it("drops a citation whose page has no parseable date", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: "web_search_tool_result",
              content: [
                {
                  type: "web_search_result",
                  url: "https://example.gov/x",
                  title: "X",
                },
              ],
            },
            {
              type: "text",
              text: "",
              citations: [
                {
                  type: "web_search_result_location",
                  url: "https://example.gov/x",
                  cited_text: "an undated claim",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;

    const connector = createWebConnector({ apiKey: "k", fetchImpl });
    const result = await connector.retrieve({
      question: "x",
      asOf: "2026-08-01",
    });
    expect(result.documents).toEqual([]);
  });

  it("fails with an actionable message when the tool identifier is stale", async () => {
    const fetchImpl = (async () =>
      new Response("unsupported tool type: web_search_20250305", {
        status: 400,
      })) as unknown as typeof fetch;

    const connector = createWebConnector({ apiKey: "k", fetchImpl });
    await expect(
      connector.retrieve({ question: "x", asOf: "2026-08-01" }),
    ).rejects.toThrow(/PROTEUS_WEB_SEARCH_TOOL/);
  });

  it("says plainly that live retrieval is unavailable without a key", async () => {
    const connector = createWebConnector({ apiKey: "", fetchImpl: fetch });
    await expect(
      connector.retrieve({ question: "x", asOf: "2026-08-01" }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY is not set/);
  });
});
