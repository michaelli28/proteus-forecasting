/**
 * Merge the two research stages into the loadable doctrine library.
 *
 * Stage 1/2 produced the parameter vector and its sourcing, then challenged it.
 * Stage 3 structured the redlines and folded the challenge corrections into the
 * prose. This joins them and writes engine/data/doctrine-profiles.json.
 *
 * ONE MANUAL OVERRIDE, and it is here rather than in the data because it should
 * be visible to whoever regenerates this. The challenge agent "corrected" the US
 * rationalityPrecision from 8.0 to 0.8, reasoning that a value outside [0,1] in
 * an object of unit-scaled values was an integration defect. That reasoning is
 * sound in general and wrong here: rationalityPrecision is deliberately a
 * softmax inverse temperature on a 1-12 scale, documented as such, and rescaling
 * it to 0.8 would model the United States as behaving almost at random. Every
 * other actor came back on the correct scale. The original value is restored.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [doctrineJournal, redlineJournal, outPath] = process.argv.slice(2);
if (!doctrineJournal || !redlineJournal || !outPath) {
  console.error(
    "usage: node build-doctrine-library.mjs <doctrine.jsonl> <redlines.jsonl> <out.json>",
  );
  process.exit(1);
}

const META = {
  us: { label: "United States", kind: "state" },
  russia: { label: "Russian Federation", kind: "state" },
  china: { label: "People's Republic of China", kind: "state" },
  iran: { label: "Islamic Republic of Iran", kind: "state" },
  dprk: { label: "Democratic People's Republic of Korea", kind: "state" },
  "criminal-syndicate": {
    label: "Profit-motivated criminal syndicate",
    kind: "criminal_enterprise",
  },
  "ideological-nonstate": {
    label: "Ideologically-motivated violent non-state actor",
    kind: "ideological_nonstate",
  },
  "state-proxy": {
    label: "State-aligned proxy network",
    kind: "state_proxy",
  },
  hacktivist: {
    label: "Ideological disruption collective",
    kind: "activist_collective",
  },
};

/** See the header. Restores the scale the challenge pass flattened. */
const RATIONALITY_OVERRIDE = { us: 8 };

/**
 * Redlines whose constraint contradicts their own statement, stripped to prose.
 *
 * `principal-liberty-preservation` bound `attributability <= 0.2` while its own
 * text says "Attribution to the BRAND is the opposite of constrained… only
 * legal-identity attribution is refused". In this engine `attributability` means
 * attribution of the act to whoever ordered it — exactly the thing the statement
 * says is NOT refused — so the constraint inverted its intent and blocked every
 * move on every ladder, making the archetype completely inert.
 *
 * The commitment is real; the engine simply has no attribute that expresses
 * "identifies principals as legal persons", and inventing one to fit a single
 * profile would be worse than carrying the commitment as prose. The syndicate's
 * aversion to personal exposure is already carried numerically by
 * `attributionAversion`, so nothing is lost but the false constraint.
 */
const STRIP_CONSTRAINT = new Set(["principal-liberty-preservation"]);

const SCALED = [
  "ownCostTolerance",
  "counterpartHarmRestraint",
  "attributionAversion",
  "proxyPreference",
  "escalationControlBelief",
  "timeHorizon",
  "decisionCentralization",
  "lossFrameRiskAcceptance",
  "legitimacyWeight",
  "signalingPreference",
  "reciprocityProportion",
];

const CONSTRAINED = [
  "civilianHarmShare",
  "legitimacyCost",
  "visibility",
  "attributability",
];

function readResults(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.type === "result" && record.result)
    .map((record) => record.result);
}

function parseEmbedded(raw, label) {
  if (!raw) return null;
  let text = String(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const open = Math.min(
    ...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0),
  );
  const closeBrace = text.lastIndexOf("}");
  const closeBracket = text.lastIndexOf("]");
  const close = Math.max(closeBrace, closeBracket);
  if (Number.isFinite(open) && close > open) text = text.slice(open, close + 1);
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`  ! ${label}: did not parse — ${error.message}`);
    return null;
  }
}

const doctrineByActor = new Map();
for (const result of readResults(doctrineJournal)) {
  const id = result.actorId;
  if (!id) continue;
  const entry = doctrineByActor.get(id) ?? {};
  if (result.doctrineJson) entry.profile = result;
  if (result.revisedDoctrineJson) entry.challenge = result;
  doctrineByActor.set(id, entry);
}

const redlineByActor = new Map();
for (const result of readResults(redlineJournal)) {
  if (result.actorId && result.redlinesJson !== undefined) {
    redlineByActor.set(result.actorId, result);
  }
}

const profiles = [];
const problems = [];

for (const [id, meta] of Object.entries(META)) {
  const doctrineEntry = doctrineByActor.get(id);
  const redlineEntry = redlineByActor.get(id);
  if (!doctrineEntry || !redlineEntry) {
    problems.push(`${id}: missing a research stage`);
    continue;
  }

  const vector =
    parseEmbedded(doctrineEntry.challenge?.revisedDoctrineJson, `${id}/challenged`) ??
    parseEmbedded(doctrineEntry.profile?.doctrineJson, `${id}/original`);
  if (!vector) {
    problems.push(`${id}: no parseable doctrine vector`);
    continue;
  }

  const doctrine = {};
  let incomplete = false;
  for (const name of SCALED) {
    const cell = vector[name];
    if (!cell || typeof cell.value !== "number") {
      problems.push(`${id}: missing parameter ${name}`);
      incomplete = true;
      continue;
    }
    doctrine[name] = {
      value: Math.min(1, Math.max(0, cell.value)),
      confidence: ["high", "medium", "low"].includes(cell.confidence)
        ? cell.confidence
        : "low",
      basis: String(cell.basis ?? "").trim() || "NOT STATED BY THE RESEARCHER",
    };
  }
  if (incomplete) continue;

  const rawRedlines = parseEmbedded(redlineEntry.redlinesJson, `${id}/redlines`);
  const redlines = [];
  for (const entry of Array.isArray(rawRedlines) ? rawRedlines : []) {
    if (!entry?.id || !entry?.statement) continue;
    const constraint =
      entry.constraint &&
      !STRIP_CONSTRAINT.has(String(entry.id)) &&
      CONSTRAINED.includes(entry.constraint.attribute) &&
      typeof entry.constraint.maxAcceptable === "number"
        ? {
            attribute: entry.constraint.attribute,
            maxAcceptable: Math.min(
              1,
              Math.max(0, entry.constraint.maxAcceptable),
            ),
          }
        : undefined;
    redlines.push({
      id: String(entry.id),
      statement: String(entry.statement),
      effect:
        entry.effect === "compels_response" ? "compels_response" : "self_prohibits",
      ...(constraint ? { constraint } : {}),
      basis: String(entry.basis ?? "").trim() || "NOT STATED",
      confidence: ["high", "medium", "low"].includes(entry.confidence)
        ? entry.confidence
        : "low",
    });
  }

  const precisionCell = vector.rationalityPrecision;
  const rationalityPrecision =
    RATIONALITY_OVERRIDE[id] ??
    (typeof precisionCell?.value === "number" && precisionCell.value > 0
      ? precisionCell.value
      : 6);

  const sources = String(doctrineEntry.profile?.sourcing ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter((line) => line.length > 12);

  profiles.push({
    id,
    label: meta.label,
    kind: meta.kind,
    summary: String(redlineEntry.summary ?? "").trim() || meta.label,
    doctrine,
    rationalityPrecision,
    redlines,
    uncertainty:
      String(redlineEntry.uncertainty ?? "").trim() ||
      "No uncertainty statement was produced for this profile.",
    sources: sources.length > 0 ? sources : ["SOURCING NOT CAPTURED"],
    ...(String(redlineEntry.declaredVsObserved ?? "").trim()
      ? { declaredVsObserved: String(redlineEntry.declaredVsObserved).trim() }
      : {}),
  });
}

const library = {
  schemaVersion: 1,
  reviewedAt: "2026-08-11",
  method:
    "Open-source research per actor against 12 declared decision parameters, then an independent adversarial pass that verified citations against primary documents, audited for essentialism, and corrected values whose stated basis did not support them. Redlines were then structured into machine-readable constraints by a third pass. Coverage: 9/9 actors at every stage. These are DECISION PROPENSITIES of regimes and institutions, never claims about peoples, ethnicities, or religions.",
  profiles,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(library, null, 2));

console.log(`wrote ${profiles.length} profiles → ${outPath}`);
for (const profile of profiles) {
  const binding = profile.redlines.filter((r) => r.constraint).length;
  console.log(
    `  ${profile.id.padEnd(22)} rp=${String(profile.rationalityPrecision).padEnd(5)} redlines=${profile.redlines.length} (${binding} binding)  sources=${profile.sources.length}`,
  );
}
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const problem of problems) console.log(`  ! ${problem}`);
  process.exitCode = 1;
}
