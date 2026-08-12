/**
 * Live retrieval from the public internet.
 *
 * Uses the Anthropic Messages API's server-side web search, for one practical
 * reason above the others: the credential is already configured for the analytic
 * layer, so live sourcing costs an evaluator no additional key, contract, or
 * vendor. The model issues the searches, reads the pages, and returns citations
 * with the passages it actually relied on — and it is those CITATIONS this
 * module keeps, not the model's prose summary of them.
 *
 * That distinction is the whole design. A summary cannot be audited against a
 * source; a cited passage with a resolvable URL can. Anything the search returns
 * without a usable citation and a parseable date is discarded rather than
 * admitted with a guessed date, because a document that slips past the as-of
 * guard invalidates the score of every forecast that cites it.
 */

import { enforceCutoff, RetrievalError } from "./connector.js";
import type {
  RetrievalConnector,
  RetrievalQuery,
  RetrievalResult,
  RetrievedDocument,
} from "./connector.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/**
 * The server tool identifier, overridable by environment.
 *
 * Pinned rather than assumed current: this string is versioned by the vendor and
 * a stale default should fail with a legible message an operator can fix in one
 * environment variable, not with an opaque 400.
 */
const DEFAULT_TOOL_TYPE =
  process.env.PROTEUS_WEB_SEARCH_TOOL ?? "web_search_20250305";
const DEFAULT_MODEL =
  process.env.PROTEUS_RETRIEVAL_MODEL ?? "claude-sonnet-4-5-20250929";

export interface WebConnectorOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly toolType?: string;
  readonly maxSearches?: number;
  readonly fetchImpl?: typeof fetch;
  /** Injected so tests do not depend on the wall clock. */
  readonly now?: () => Date;
}

interface Citation {
  readonly type?: string;
  readonly url?: string;
  readonly title?: string;
  readonly cited_text?: string;
}

interface ContentBlock {
  readonly type: string;
  readonly text?: string;
  readonly citations?: Citation[];
  readonly name?: string;
  readonly input?: { query?: string };
  readonly content?: {
    readonly type?: string;
    readonly url?: string;
    readonly title?: string;
    readonly page_age?: string;
  }[];
}

/**
 * Parse the loosely-formatted age string the search returns.
 *
 * Returns null rather than a fallback when it cannot parse. A guessed date is
 * worse than no document: it would let post-cutoff material through the one
 * guard that cannot detect its own bypass.
 */
export function parsePublishedDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function createWebConnector(
  options: WebConnectorOptions = {},
): RetrievalConnector {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const model = options.model ?? DEFAULT_MODEL;
  const toolType = options.toolType ?? DEFAULT_TOOL_TYPE;
  const maxSearches = options.maxSearches ?? 5;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    id: "anthropic-web-search",
    origin: "open",
    description:
      "Live public-internet retrieval via the Anthropic Messages API's server-side web search. Keeps cited passages with resolvable URLs; discards anything undated.",

    async retrieve(query: RetrievalQuery): Promise<RetrievalResult> {
      if (!apiKey) {
        throw new RetrievalError(
          "ANTHROPIC_API_KEY is not set — live retrieval is unavailable. Run with the synthetic corpus, or supply documents through a supplied-evidence connector.",
        );
      }

      const response = await fetchImpl(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: buildPrompt(query),
            },
          ],
          tools: [
            { type: toolType, name: "web_search", max_uses: maxSearches },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new RetrievalError(
          `web search failed (${response.status}). If this mentions an unsupported tool type, set PROTEUS_WEB_SEARCH_TOOL to the current identifier. ${detail.slice(0, 300)}`,
        );
      }

      const body = (await response.json()) as { content?: ContentBlock[] };
      const blocks = body.content ?? [];
      const retrievedAt = now().toISOString().slice(0, 10);

      const queriesIssued: string[] = [];
      const pageAges = new Map<string, string>();
      const titles = new Map<string, string>();

      for (const block of blocks) {
        if (block.type === "server_tool_use" && block.input?.query) {
          queriesIssued.push(block.input.query);
        }
        if (block.type === "web_search_tool_result") {
          for (const entry of block.content ?? []) {
            if (!entry.url) continue;
            if (entry.page_age) pageAges.set(entry.url, entry.page_age);
            if (entry.title) titles.set(entry.url, entry.title);
          }
        }
      }

      // Citations, not the model's prose. A summary cannot be audited; a cited
      // passage with a URL can.
      const collected: RetrievedDocument[] = [];
      const seen = new Set<string>();

      for (const block of blocks) {
        if (block.type !== "text" || !block.citations) continue;
        for (const citation of block.citations) {
          if (!citation.url || !citation.cited_text) continue;
          const key = `${citation.url}::${citation.cited_text.slice(0, 80)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const publishedAt = parsePublishedDate(
            pageAges.get(citation.url) ?? undefined,
          );
          if (!publishedAt) continue;

          collected.push({
            id: `web-${hash(key)}`,
            origin: "open",
            sourceId: hostOf(citation.url),
            title: citation.title ?? titles.get(citation.url) ?? citation.url,
            url: citation.url,
            publishedAt,
            excerpt: citation.cited_text.trim(),
            retrievedAt,
          });
        }
      }

      const { kept, excluded } = enforceCutoff(collected, query.asOf);
      return {
        documents: kept.slice(0, query.maxResults ?? 12),
        queriesIssued,
        excludedByCutoff: excluded,
      };
    },
  };
}

function buildPrompt(query: RetrievalQuery): string {
  return `Search the public web and report what you find on the following, citing every claim.

TOPIC:
${query.question}

Constraints:
- Do NOT rely on anything published after ${query.asOf}. Prefer primary sources, official publications, and peer-reviewed or reputable institutional research.
- Quote the specific passages you rely on. Your citations are the output that matters; prose around them is discarded.
- Report figures for scale, structure, and dependency where they exist.
- Do NOT report vulnerabilities, exploitation techniques, or operational security details of any real system. If sources contain them, ignore them and say so.`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown-source";
  }
}

/** Small stable hash, so the same citation gets the same id across runs. */
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
