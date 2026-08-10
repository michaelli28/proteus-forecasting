/**
 * Synthetic corpus generator with deliberately planted conflicts.
 *
 * The point is the gold set: because we plant every conflict, contradiction
 * precision/recall and reconciliation accuracy become measured numbers instead
 * of eyeballed ones. Nothing here is real-world content — the vocabulary is
 * closed and describes the simulated information environment only.
 */

import { Rng } from "../sim/rng.js";
import { CorpusSnapshot } from "./snapshot.js";
import { CONFLICT_KINDS } from "./types.js";
import type {
  ConflictKind,
  Document,
  FactAssertion,
  SeededConflict,
  Source,
} from "./types.js";

const MEASUREMENT_METHODS = [
  "panel_survey",
  "platform_telemetry",
  "sampled_crawl",
] as const;

const SUBJECT_TEMPLATES = [
  "narrative.{i}.reach_pct",
  "cluster.{i}.polarization_index",
  "platform.{i}.amplification_ratio",
  "segment.{i}.trust_score",
] as const;

/** Canonical definitional frame per subject; conflicts deviate from it. */
const CANONICAL_DEFINITION = "whole_population";
const ALTERNATE_DEFINITION = "active_users_only";

const DAY_MS = 86_400_000;

export interface SyntheticCorpusOptions {
  readonly seed: string;
  readonly documentCount: number;
  readonly sourceCount: number;
  /** ISO date of the earliest publication. */
  readonly startDate: string;
  /** ISO date of the latest publication. */
  readonly endDate: string;
  /** Conflicts planted per ConflictKind. Four kinds ⇒ 4× this many total. */
  readonly conflictsPerKind: number;
}

export interface SyntheticCorpus {
  readonly snapshot: CorpusSnapshot;
  /** The gold set: every conflict planted, with its correct reconciliation. */
  readonly seededConflicts: readonly SeededConflict[];
}

function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function subjectFor(index: number): string {
  const template = SUBJECT_TEMPLATES[index % SUBJECT_TEMPLATES.length]!;
  return template.replace(
    "{i}",
    String(Math.floor(index / SUBJECT_TEMPLATES.length) + 1),
  );
}

function bodyFor(
  subject: string,
  value: number,
  definition: string,
  asOfDate: string,
): string {
  return (
    `Measurement of ${subject.split(".").join(" ")} recorded at ${value.toFixed(2)} ` +
    `for scope ${definition} as of ${asOfDate}. Observed within the simulated ` +
    `information environment.`
  );
}

/** Deterministic synthetic corpus. Same options ⇒ identical snapshot id. */
export function generateSyntheticCorpus(
  options: SyntheticCorpusOptions,
): SyntheticCorpus {
  const rng = new Rng(options.seed);
  const sourceRng = rng.fork("sources");
  const docRng = rng.fork("documents");
  const conflictRng = rng.fork("conflicts");

  const start = Date.parse(options.startDate);
  const end = Date.parse(options.endDate);
  if (Number.isNaN(start) || Number.isNaN(end))
    throw new TypeError("invalid date range");
  if (end < start) throw new RangeError("endDate precedes startDate");
  const spanDays = Math.max(1, Math.floor((end - start) / DAY_MS));

  // genuine_dispute needs two distinct sources sharing a measurement method.
  // With methods cycling over sources that requires at least four; fewer would
  // silently degrade to one source disputing itself.
  if (
    options.conflictsPerKind > 0 &&
    options.sourceCount < MEASUREMENT_METHODS.length + 1
  ) {
    throw new RangeError(
      `sourceCount must be >= ${MEASUREMENT_METHODS.length + 1} to plant conflicts`,
    );
  }

  const sources: Source[] = Array.from(
    { length: options.sourceCount },
    (_, i) => ({
      id: `src-${String(i + 1).padStart(3, "0")}`,
      name: `Synthetic Source ${i + 1}`,
      credibility: Number(sourceRng.uniform(0.35, 0.95).toFixed(3)),
      measurementMethod: MEASUREMENT_METHODS[i % MEASUREMENT_METHODS.length]!,
    }),
  );

  const documents: Document[] = [];
  let docCounter = 0;

  function nextDocId(): string {
    docCounter++;
    return `doc-${String(docCounter).padStart(4, "0")}`;
  }

  function addDocument(
    sourceId: string,
    publishedEpoch: number,
    facts: FactAssertion[],
    titleSuffix: string,
  ): Document {
    const subject = facts[0]?.subject ?? "unknown";
    const doc: Document = {
      id: nextDocId(),
      sourceId,
      publishedAt: isoDay(publishedEpoch),
      title: `${subject} ${titleSuffix}`,
      body: facts
        .map((f) =>
          bodyFor(
            f.subject,
            typeof f.value === "number" ? f.value : 0,
            f.definition ?? CANONICAL_DEFINITION,
            f.asOfDate,
          ),
        )
        .join(" "),
      facts,
    };
    documents.push(doc);
    return doc;
  }

  // ── Background documents ──
  for (let i = 0; i < options.documentCount; i++) {
    const source = sources[docRng.int(sources.length)]!;
    const publishedEpoch = start + docRng.int(spanDays) * DAY_MS;
    const subject = subjectFor(docRng.int(SUBJECT_TEMPLATES.length * 3));
    addDocument(
      source.id,
      publishedEpoch,
      [
        {
          subject,
          value: Number(docRng.uniform(0, 100).toFixed(2)),
          unit: "pct",
          asOfDate: isoDay(publishedEpoch),
          definition: CANONICAL_DEFINITION,
        },
      ],
      "observation",
    );
  }

  // ── Planted conflicts ──
  const seededConflicts: SeededConflict[] = [];

  for (const kind of CONFLICT_KINDS) {
    for (let n = 0; n < options.conflictsPerKind; n++) {
      const subject = `disputed.${kind}.${n + 1}.value`;
      const baseEpoch =
        start + conflictRng.int(Math.max(1, spanDays - 10)) * DAY_MS;
      const valueA = Number(conflictRng.uniform(10, 45).toFixed(2));
      const valueB = Number(conflictRng.uniform(55, 90).toFixed(2));

      const pair = pickConflictingSources(sources, kind, conflictRng);
      const [srcA, srcB] = pair;

      const { factA, factB, reconciledValue } = buildConflict(
        kind,
        subject,
        valueA,
        valueB,
        baseEpoch,
        srcA,
        srcB,
      );

      const docA = addDocument(
        srcA.id,
        baseEpoch,
        [factA],
        `report A (${kind})`,
      );
      const docB = addDocument(
        srcB.id,
        baseEpoch,
        [factB],
        `report B (${kind})`,
      );

      seededConflicts.push({
        subject,
        kind,
        documentIds: [docA.id, docB.id],
        reconciledValue,
      });
    }
  }

  return {
    snapshot: new CorpusSnapshot({ documents, sources }),
    seededConflicts,
  };
}

/**
 * different_measurement needs two methods; genuine_dispute needs one, otherwise
 * the method difference alone would explain the gap and it is not a dispute.
 */
function pickConflictingSources(
  sources: readonly Source[],
  kind: ConflictKind,
  rng: Rng,
): [Source, Source] {
  const wantSameMethod = kind === "genuine_dispute";
  const first = sources[rng.int(sources.length)]!;
  const candidates = sources.filter((s) =>
    s.id === first.id
      ? false
      : wantSameMethod
        ? s.measurementMethod === first.measurementMethod
        : s.measurementMethod !== first.measurementMethod,
  );
  const second =
    candidates.length > 0 ? candidates[rng.int(candidates.length)]! : first;
  return [first, second];
}

function buildConflict(
  kind: ConflictKind,
  subject: string,
  valueA: number,
  valueB: number,
  baseEpoch: number,
  srcA: Source,
  srcB: Source,
): {
  factA: FactAssertion;
  factB: FactAssertion;
  reconciledValue: number | null;
} {
  const baseDate = isoDay(baseEpoch);

  switch (kind) {
    case "different_measurement":
      // Same date, same definition, different instruments — the more credible
      // source's reading is the reconciliation.
      return {
        factA: {
          subject,
          value: valueA,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        factB: {
          subject,
          value: valueB,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        reconciledValue: srcA.credibility >= srcB.credibility ? valueA : valueB,
      };

    case "different_date": {
      // Both correct, measured a week apart — the later reading wins.
      const laterDate = isoDay(baseEpoch + 7 * DAY_MS);
      return {
        factA: {
          subject,
          value: valueA,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        factB: {
          subject,
          value: valueB,
          unit: "pct",
          asOfDate: laterDate,
          definition: CANONICAL_DEFINITION,
        },
        reconciledValue: valueB,
      };
    }

    case "different_definition":
      // Both correct under their own scope — reconcile to the canonical one.
      return {
        factA: {
          subject,
          value: valueA,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        factB: {
          subject,
          value: valueB,
          unit: "pct",
          asOfDate: baseDate,
          definition: ALTERNATE_DEFINITION,
        },
        reconciledValue: valueA,
      };

    case "genuine_dispute":
      // Same date, scope, unit and instrument, different answers. Irreconcilable
      // by construction — this must propagate into confidence, never be picked.
      return {
        factA: {
          subject,
          value: valueA,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        factB: {
          subject,
          value: valueB,
          unit: "pct",
          asOfDate: baseDate,
          definition: CANONICAL_DEFINITION,
        },
        reconciledValue: null,
      };
  }
}

export { CANONICAL_DEFINITION, ALTERNATE_DEFINITION, MEASUREMENT_METHODS };
