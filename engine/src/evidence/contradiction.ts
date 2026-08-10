/**
 * Source contradiction detection, classification and reconciliation.
 *
 * The rule that matters: where a conflict cannot be reconciled, the disagreement
 * propagates into confidence rather than being silently resolved by picking the
 * nicer-looking number. Quietly choosing a side is how a system reports high
 * confidence on a fact its own sources dispute.
 */

import type { CorpusSnapshot } from "../corpus/snapshot.js";
import type {
  ConflictKind,
  Document,
  FactAssertion,
  Source,
} from "../corpus/types.js";

export interface ConflictParty {
  readonly documentId: string;
  readonly sourceId: string;
  readonly value: number | string;
  readonly asOfDate: string;
  readonly definition?: string;
  readonly unit?: string;
  readonly credibility: number;
  readonly measurementMethod?: string;
}

export interface DetectedConflict {
  readonly subject: string;
  readonly kind: ConflictKind;
  readonly parties: readonly [ConflictParty, ConflictParty];
  /** Null when the conflict is a genuine dispute, which is never auto-resolved. */
  readonly reconciledValue: number | string | null;
  readonly rationale: string;
}

export interface ContradictionReport {
  readonly conflicts: readonly DetectedConflict[];
  readonly unresolved: readonly DetectedConflict[];
  /** Share of detected conflicts that could not be reconciled, in [0,1]. */
  readonly unresolvedRate: number;
}

function partyOf(
  doc: Document,
  fact: FactAssertion,
  source: Source | undefined,
): ConflictParty {
  return {
    documentId: doc.id,
    sourceId: doc.sourceId,
    value: fact.value,
    asOfDate: fact.asOfDate,
    definition: fact.definition,
    unit: fact.unit,
    credibility: source?.credibility ?? 0,
    measurementMethod: source?.measurementMethod,
  };
}

/**
 * Classify a disagreement.
 *
 * Order matters: each reconcilable explanation is ruled out before the next is
 * considered, and only a conflict surviving all of them is a genuine dispute.
 * Reversing the order would let a definitional mismatch masquerade as a dispute
 * and depress confidence for no reason.
 */
export function classifyConflict(
  a: ConflictParty,
  b: ConflictParty,
): ConflictKind {
  if (a.definition !== b.definition) return "different_definition";
  if (a.asOfDate !== b.asOfDate) return "different_date";
  if (a.measurementMethod !== b.measurementMethod)
    return "different_measurement";
  return "genuine_dispute";
}

/** Apply the reconciliation rule for a classified conflict. */
export function reconcileConflict(
  kind: ConflictKind,
  a: ConflictParty,
  b: ConflictParty,
  canonicalDefinition?: string,
): { value: number | string | null; rationale: string } {
  switch (kind) {
    case "different_date": {
      const later = Date.parse(a.asOfDate) >= Date.parse(b.asOfDate) ? a : b;
      return {
        value: later.value,
        rationale: `Both readings stand; the later observation (${later.asOfDate}) supersedes.`,
      };
    }

    case "different_definition": {
      if (canonicalDefinition === undefined) {
        return {
          value: null,
          rationale:
            "Scopes differ and no canonical definition was supplied to map onto.",
        };
      }
      const canonical = [a, b].find(
        (p) => p.definition === canonicalDefinition,
      );
      return canonical
        ? {
            value: canonical.value,
            rationale: `Both correct under their own scope; reported on the canonical scope "${canonicalDefinition}".`,
          }
        : {
            value: null,
            rationale: `Neither reading uses the canonical scope "${canonicalDefinition}".`,
          };
    }

    case "different_measurement": {
      const better = a.credibility >= b.credibility ? a : b;
      return {
        value: better.value,
        rationale: `Different instruments; the more reliable source (${better.sourceId}, credibility ${better.credibility.toFixed(2)}) is reported.`,
      };
    }

    case "genuine_dispute":
      return {
        value: null,
        rationale:
          "Same date, scope, unit and instrument, different answers. Not reconcilable — the disagreement propagates into confidence.",
      };
  }
}

/**
 * Find every pairwise contradiction in a corpus.
 *
 * Compares fact assertions sharing a subject. Only unequal values are conflicts;
 * agreement across sources is corroboration and raises confidence elsewhere.
 */
export function detectContradictions(
  snapshot: CorpusSnapshot,
  documents: readonly Document[] = snapshot.documents,
  canonicalDefinition?: string,
): ContradictionReport {
  const bySubject = new Map<string, { doc: Document; fact: FactAssertion }[]>();

  for (const doc of documents) {
    for (const fact of doc.facts) {
      const entries = bySubject.get(fact.subject) ?? [];
      entries.push({ doc, fact });
      bySubject.set(fact.subject, entries);
    }
  }

  const conflicts: DetectedConflict[] = [];

  for (const [subject, entries] of [...bySubject.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const left = entries[i]!;
        const right = entries[j]!;
        if (left.fact.value === right.fact.value) continue;

        const a = partyOf(
          left.doc,
          left.fact,
          snapshot.getSource(left.doc.sourceId),
        );
        const b = partyOf(
          right.doc,
          right.fact,
          snapshot.getSource(right.doc.sourceId),
        );
        const kind = classifyConflict(a, b);
        const { value, rationale } = reconcileConflict(
          kind,
          a,
          b,
          canonicalDefinition,
        );

        conflicts.push({
          subject,
          kind,
          parties: [a, b],
          reconciledValue: value,
          rationale,
        });
      }
    }
  }

  const unresolved = conflicts.filter((c) => c.reconciledValue === null);
  return {
    conflicts,
    unresolved,
    unresolvedRate:
      conflicts.length === 0 ? 0 : unresolved.length / conflicts.length,
  };
}

/**
 * Confidence penalty from unresolved disagreement.
 *
 * Extends the existing z-score disagreement math from judges to sources: spread
 * among sources reporting the same subject is exactly the spread among judges
 * scoring the same project, and it means the same thing.
 */
export function disagreementPenalty(report: ContradictionReport): number {
  return Math.min(1, report.unresolvedRate);
}
