/**
 * Where real evidence enters the system.
 *
 * Everything Proteus has forecast until now came from a closed synthetic
 * corpus, which is what makes its calibration numbers honest — the world is
 * known, so the scoring is exact. It is also why none of those numbers is
 * evidence of real-world skill, and the system says so in the first line of
 * every run.
 *
 * This module opens the seam without pretending the seam is closed. A connector
 * returns documents with PROVENANCE attached and a publication date the as-of
 * guard can enforce, and every connector declares its own class:
 *
 *   open      — retrieved from the public internet, citable, verifiable
 *   supplied  — provided by the evaluator from their own holdings
 *   synthetic — generated; the existing closed-world path
 *
 * The class travels with each document and out to the product, because "we found
 * this in a published report" and "the sponsor told us" and "we made it up to
 * test the pipeline" are three different claims and must never pool into one.
 *
 * WHAT THIS DOES NOT DO, stated plainly because the gap matters. Retrieved
 * documents are usable for GROUNDING — shaping a scenario, sizing a system,
 * informing an assumption. They do NOT yet feed the contradiction-detection and
 * abstention machinery, which requires each document to carry structured
 * `FactAssertion`s with canonicalized subjects and a declared measurement
 * method. Real prose has neither. Wiring retrieval into that path without a
 * fact-extraction stage would make every value disagreement classify as a
 * genuine dispute, drive the unresolved rate past the abstention threshold, and
 * cause the system to abstain on nearly everything — a failure that looks like
 * caution and is actually a plumbing bug. That stage is specified below and NOT
 * IMPLEMENTED.
 */

export const EVIDENCE_ORIGINS = ["open", "supplied", "synthetic"] as const;
export type EvidenceOrigin = (typeof EVIDENCE_ORIGINS)[number];

/** One retrieved document, with enough provenance to be checked later. */
export interface RetrievedDocument {
  readonly id: string;
  readonly origin: EvidenceOrigin;
  /** Publisher or holding system. Feeds source credibility. */
  readonly sourceId: string;
  readonly title: string;
  /** Resolvable location, when there is one. Absent for supplied material. */
  readonly url?: string;
  /** ISO date. Required — undated evidence cannot pass the as-of guard. */
  readonly publishedAt: string;
  /** The passage actually relied on, not a summary of it. */
  readonly excerpt: string;
  /** When the retrieval happened, so a stale result is visible as stale. */
  readonly retrievedAt: string;
}

export interface RetrievalQuery {
  readonly question: string;
  /** Nothing published after this may be returned. */
  readonly asOf: string;
  readonly maxResults?: number;
}

export interface RetrievalResult {
  readonly documents: readonly RetrievedDocument[];
  /** Queries actually issued, for the record. */
  readonly queriesIssued: readonly string[];
  /** Documents dropped for being published after the cutoff. */
  readonly excludedByCutoff: number;
}

export interface RetrievalConnector {
  readonly id: string;
  readonly origin: EvidenceOrigin;
  /** Shown beside anything this connector sourced. */
  readonly description: string;
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}

export class RetrievalError extends Error {}

/**
 * Drop anything published after the cutoff.
 *
 * Applied by the connector rather than trusted from the provider: a search API
 * has no idea what an information cutoff is, and a single post-cutoff document
 * silently invalidates the score of every forecast that cited it.
 */
export function enforceCutoff(
  documents: readonly RetrievedDocument[],
  asOf: string,
): { kept: RetrievedDocument[]; excluded: number } {
  const cutoff = Date.parse(asOf);
  if (Number.isNaN(cutoff)) {
    throw new RetrievalError(`as-of date is not parseable: ${asOf}`);
  }
  const kept: RetrievedDocument[] = [];
  let excluded = 0;
  for (const document of documents) {
    const published = Date.parse(document.publishedAt);
    // An undated document is excluded, not admitted. Admitting it would let
    // post-cutoff material in through the one gap the guard cannot see.
    if (Number.isNaN(published) || published > cutoff) {
      excluded++;
      continue;
    }
    kept.push(document);
  }
  return { kept, excluded };
}

/**
 * The contract a government-supplied feed implements. NOT IMPLEMENTED.
 *
 * Written out rather than left vague because the point of a proposal is to be
 * precise about the interface it needs. A sponsor supplying data implements
 * exactly this and nothing else changes: no engine code, no scenario format, no
 * scoring path. The connector runs inside the sponsor's environment and returns
 * documents; Proteus never reaches into a system it does not own.
 *
 * What the implementer must guarantee, and why each one matters:
 *
 *   1. `publishedAt` is the date the ASSERTION was made, not the date the record
 *      was exported. An export date passes the as-of guard while carrying
 *      information from after the cutoff, which is the exact leak the guard
 *      exists to stop.
 *   2. `excerpt` is the passage relied upon, verbatim. Summaries cannot be
 *      audited against a source, and an unauditable citation is not a citation.
 *   3. `sourceId` is stable across retrievals, so credibility can be tracked per
 *      source rather than per document.
 *   4. Classification handling is the sponsor's, not ours. This interface
 *      carries no classification field ON PURPOSE: a connector that returns
 *      material Proteus is not cleared to hold has already failed, and adding a
 *      marking field would imply this side is competent to enforce it.
 *
 * The reference implementation lives with whoever holds the data.
 */
export interface PrivateFeedConnector extends RetrievalConnector {
  readonly origin: "supplied";
  /** Names the holding system, for the provenance line in the product. */
  readonly holdingSystem: string;
}

/**
 * A connector over documents the evaluator has already assembled.
 *
 * The zero-integration path: an evaluator drops a JSON file of documents beside
 * the engine and everything downstream treats them as supplied evidence with
 * full provenance. Useful before any live connector exists, and useful forever
 * for reproducing a specific analysis against a frozen document set.
 */
export function createSuppliedConnector(
  id: string,
  holdingSystem: string,
  documents: readonly RetrievedDocument[],
): PrivateFeedConnector {
  return {
    id,
    origin: "supplied",
    holdingSystem,
    description: `Documents supplied by the evaluator from ${holdingSystem}. Accuracy is inherited from that source and asserted nowhere else.`,
    async retrieve(query) {
      const { kept, excluded } = enforceCutoff(documents, query.asOf);
      const terms = tokenize(query.question);
      const scored = kept
        .map((document) => {
          // Whole-token matching, not substring: "port" must not match
          // "report", and a query's stopwords must not match every document.
          const haystack = new Set(
            tokenize(`${document.title} ${document.excerpt}`),
          );
          const hits = terms.filter((term) => haystack.has(term)).length;
          return { document, hits };
        })
        .filter((entry) => entry.hits > 0)
        // Stable tiebreak by id: a retrieval that reorders between runs makes
        // two otherwise identical analyses irreproducible.
        .sort(
          (a, b) =>
            b.hits - a.hits || a.document.id.localeCompare(b.document.id),
        );

      return {
        documents: scored
          .slice(0, query.maxResults ?? 12)
          .map((entry) => entry.document),
        queriesIssued: [query.question],
        excludedByCutoff: excluded,
      };
    },
  };
}

/**
 * Content words only.
 *
 * Short tokens are dropped because they are almost entirely function words, and
 * a query whose stopwords match every document returns the whole corpus ranked
 * by how chatty each entry is.
 */
const MIN_TERM_LENGTH = 4;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_TERM_LENGTH);
}

/** The sentence that must appear beside anything a connector sourced. */
export function describeOrigin(connector: RetrievalConnector): string {
  switch (connector.origin) {
    case "open":
      return `Sourced from the public internet via ${connector.id}. Every claim carries a resolvable citation and a publication date, and nothing published after the information cutoff was admitted.`;
    case "supplied":
      return `Sourced from evaluator-supplied holdings via ${connector.id}. Proteus asserts nothing about this material beyond what the supplying system asserted.`;
    case "synthetic":
      return `Generated by the closed-world corpus. NOT evidence about the real world — this path measures how honestly the pipeline propagates its own uncertainty, and nothing else.`;
  }
}
