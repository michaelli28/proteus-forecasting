/**
 * As-of retrieval — the leakage guard.
 *
 * A model that "predicts" an event it has read about is doing retrodiction, and
 * it scores spectacularly while being worthless. The guard is enforced in code,
 * never by instructing a prompt, in three layers:
 *
 *   1. retrieve()/getDocument() cannot return a document published after asOf
 *   2. tests assert a post-asOf document is unreachable through every accessor
 *   3. assertNoLeakage() throws if a finished product cites a post-asOf document
 *
 * Layer 3 exists because layer 1 only guards the paths it owns. Evidence that
 * arrives some other way still has to pass before a product ships.
 */

import type { CorpusSnapshot } from "./snapshot.js";
import type { Document, Source } from "./types.js";

/** Thrown when evidence postdates the run's information cutoff. */
export class LeakageError extends Error {
  constructor(
    readonly asOf: string,
    readonly offenders: readonly { id: string; publishedAt: string }[],
  ) {
    const detail = offenders.map((o) => `${o.id}@${o.publishedAt}`).join(", ");
    super(`evidence postdates as-of ${asOf}: ${detail}`);
    this.name = "LeakageError";
  }
}

/** Anything carrying a publication date can be leakage-checked. */
export interface DatedRef {
  readonly id: string;
  readonly publishedAt: string;
}

function toEpoch(iso: string, context: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t))
    throw new TypeError(`invalid ISO date in ${context}: ${iso}`);
  return t;
}

const TOKEN_PATTERN = /[a-z0-9]+/g;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_PATTERN) ?? [];
}

export class AsOfCorpus {
  readonly asOf: string;
  private readonly cutoff: number;
  private readonly visible: readonly Document[];

  constructor(
    private readonly snapshot: CorpusSnapshot,
    asOf: string,
  ) {
    this.asOf = asOf;
    this.cutoff = toEpoch(asOf, "asOf");
    this.visible = snapshot.documents.filter(
      (d) => toEpoch(d.publishedAt, `document ${d.id}`) <= this.cutoff,
    );
  }

  /** Snapshot id, for pinning into a RunIdentity. */
  get snapshotId(): string {
    return this.snapshot.id;
  }

  /** How many documents the cutoff hides. Useful for backtest sanity checks. */
  get hiddenCount(): number {
    return this.snapshot.size - this.visible.length;
  }

  get visibleCount(): number {
    return this.visible.length;
  }

  /** Every visible document, in stable id order. */
  all(): readonly Document[] {
    return this.visible;
  }

  /**
   * Source records.
   *
   * Safe to expose in full: a source carries credibility and a measurement
   * method, never a publication date, so nothing here can reveal a document the
   * cutoff hides. Consumers that need to look up who published a visible
   * document use this; the documents themselves stay behind the filter.
   */
  get sources(): readonly Source[] {
    return this.snapshot.sources;
  }

  /**
   * Term-overlap retrieval. Deliberately simple and deterministic — the Phase-1
   * corpus is synthetic and small, and an embedding model would add a second
   * source of run-to-run variance for no measurable gain.
   */
  retrieve(query: string, limit = 10): Document[] {
    const terms = new Set(tokenize(query));
    if (terms.size === 0) return [];

    const scored = this.visible
      .map((doc) => {
        const tokens = tokenize(`${doc.title} ${doc.body}`);
        let score = 0;
        for (const token of tokens) if (terms.has(token)) score++;
        return { doc, score: score / Math.max(tokens.length, 1) };
      })
      .filter((entry) => entry.score > 0);

    // Stable tiebreak by id: score ordering alone is not a total order.
    scored.sort(
      (a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id),
    );
    return scored.slice(0, limit).map((entry) => entry.doc);
  }

  /** Returns undefined for a document that postdates the cutoff, as if absent. */
  getDocument(id: string): Document | undefined {
    const doc = this.snapshot.getDocument(id);
    if (!doc) return undefined;
    return toEpoch(doc.publishedAt, `document ${id}`) <= this.cutoff
      ? doc
      : undefined;
  }

  /** True when the document exists and is visible at this cutoff. */
  isVisible(id: string): boolean {
    return this.getDocument(id) !== undefined;
  }

  /** Offending refs, empty when clean. Use when you want to report, not throw. */
  findLeakage(refs: readonly DatedRef[]): DatedRef[] {
    return refs.filter(
      (r) => toEpoch(r.publishedAt, `ref ${r.id}`) > this.cutoff,
    );
  }

  /**
   * Layer 3. Call before any product ships.
   * Throws rather than warns: a leaked citation invalidates the forecast score,
   * so continuing produces a number that looks fine and means nothing.
   */
  assertNoLeakage(refs: readonly DatedRef[]): void {
    const offenders = this.findLeakage(refs);
    if (offenders.length > 0) {
      throw new LeakageError(
        this.asOf,
        offenders.map((o) => ({ id: o.id, publishedAt: o.publishedAt })),
      );
    }
  }
}
