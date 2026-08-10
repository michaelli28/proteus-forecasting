/**
 * Immutable, content-addressed corpus snapshots.
 *
 * A run pins a snapshot id into its RunIdentity, so "same seed, same answer" is
 * only meaningful alongside "same corpus". Without pinning, a corpus that grew
 * between two runs would look like model non-determinism.
 */

import { hashCanonical } from "../artifact/canonical.js";
import type { CorpusData, Document, Source } from "./types.js";

export class CorpusSnapshot {
  readonly id: string;
  private readonly docsById: ReadonlyMap<string, Document>;
  private readonly sourcesById: ReadonlyMap<string, Source>;
  readonly documents: readonly Document[];
  readonly sources: readonly Source[];

  constructor(data: CorpusData) {
    // Sort before hashing so ingestion order cannot change the snapshot id.
    this.documents = [...data.documents].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    this.sources = [...data.sources].sort((a, b) => a.id.localeCompare(b.id));
    this.id = hashCanonical({
      documents: this.documents,
      sources: this.sources,
    });
    this.docsById = new Map(this.documents.map((d) => [d.id, d]));
    this.sourcesById = new Map(this.sources.map((s) => [s.id, s]));
  }

  getDocument(id: string): Document | undefined {
    return this.docsById.get(id);
  }

  getSource(id: string): Source | undefined {
    return this.sourcesById.get(id);
  }

  get size(): number {
    return this.documents.length;
  }

  /** Documents referencing a source that is not in the snapshot. */
  danglingSourceRefs(): string[] {
    return this.documents
      .filter((d) => !this.sourcesById.has(d.sourceId))
      .map((d) => d.id);
  }
}
