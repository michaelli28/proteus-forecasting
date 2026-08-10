/**
 * Corpus primitives.
 *
 * Facts are structured rather than free text so contradictions can be detected
 * mechanically and scored against a labelled gold set. A conflict between two
 * prose paragraphs is a judgement call; a conflict between two FactAssertions
 * over the same subject is a comparison.
 */

/** How two sources can disagree. Only the last is irreconcilable. */
export const CONFLICT_KINDS = [
  "different_measurement",
  "different_date",
  "different_definition",
  "genuine_dispute",
] as const;
export type ConflictKind = (typeof CONFLICT_KINDS)[number];

export interface Source {
  readonly id: string;
  readonly name: string;
  /** Prior reliability in [0,1]. Feeds evidence weighting, never a hard filter. */
  readonly credibility: number;
  /** Distinguishes different_measurement from genuine_dispute. */
  readonly measurementMethod?: string;
}

/**
 * One structured fact asserted by a document.
 *
 * `asOfDate` is when the fact was true; `publishedAt` on the document is when it
 * was said. Conflating them is exactly the different_date conflict this models.
 */
export interface FactAssertion {
  readonly subject: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly asOfDate: string;
  /** Definitional frame, e.g. "urban population only". */
  readonly definition?: string;
}

export interface Document {
  readonly id: string;
  readonly sourceId: string;
  /** ISO date. The only field the as-of leakage guard reads. */
  readonly publishedAt: string;
  readonly title: string;
  readonly body: string;
  readonly facts: readonly FactAssertion[];
}

export interface CorpusData {
  readonly documents: readonly Document[];
  readonly sources: readonly Source[];
}

/** A conflict the synthetic generator deliberately planted, for scoring. */
export interface SeededConflict {
  readonly subject: string;
  readonly kind: ConflictKind;
  readonly documentIds: readonly [string, string];
  /** Correct reconciled value, or null when the conflict is a genuine dispute. */
  readonly reconciledValue: number | string | null;
}
