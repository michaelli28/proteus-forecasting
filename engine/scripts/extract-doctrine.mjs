/**
 * Turn the doctrine-research workflow journal into the profile library.
 *
 * Reads both stages: the researcher's profile and the adversarial challenge that
 * followed it. The CHALLENGED vector wins wherever the two disagree — that pass
 * verified pin-cites against primary documents and corrected values whose stated
 * basis did not support them, so preferring the original would discard the most
 * expensive review in the pipeline.
 *
 * Redlines arrive as markdown and are NOT converted here. A redline only affects
 * the simulation through its machine-readable `constraint`, and guessing that
 * bound from prose would fabricate the one field an evaluator is most entitled
 * to see justified. They are carried through as prose for a structuring pass.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [journalPath, outPath] = process.argv.slice(2);
if (!journalPath || !outPath) {
  console.error("usage: node extract-doctrine.mjs <journal.jsonl> <out.json>");
  process.exit(1);
}

const records = readFileSync(journalPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((record) => record.type === "result" && record.result);

const byActor = new Map();
for (const record of records) {
  const result = record.result;
  const id = result.actorId;
  if (!id) continue;
  const entry = byActor.get(id) ?? {};
  if (result.doctrineJson) entry.profile = result;
  if (result.revisedDoctrineJson) entry.challenge = result;
  byActor.set(id, entry);
}

/** The research emitted 12 names; 11 are [0,1] propensities, one is not. */
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

function parseVector(raw, label) {
  if (!raw) return null;
  let text = String(raw).trim();
  // Models fence JSON even when told not to.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  const brace = text.indexOf("{");
  const close = text.lastIndexOf("}");
  if (brace >= 0 && close > brace) text = text.slice(brace, close + 1);
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`  ! ${label}: doctrine JSON did not parse — ${error.message}`);
    return null;
  }
}

const out = [];
const problems = [];

for (const [actorId, entry] of byActor) {
  const vector =
    parseVector(entry.challenge?.revisedDoctrineJson, `${actorId}/challenged`) ??
    parseVector(entry.profile?.doctrineJson, `${actorId}/original`);

  if (!vector) {
    problems.push(`${actorId}: no parseable doctrine vector`);
    continue;
  }

  const doctrine = {};
  const missing = [];
  for (const name of SCALED) {
    const cell = vector[name];
    if (!cell || typeof cell.value !== "number") {
      missing.push(name);
      continue;
    }
    doctrine[name] = {
      value: Math.min(1, Math.max(0, cell.value)),
      confidence: ["high", "medium", "low"].includes(cell.confidence)
        ? cell.confidence
        : "low",
      basis: String(cell.basis ?? "").slice(0, 400) || "NOT STATED",
    };
  }
  if (missing.length) problems.push(`${actorId}: missing ${missing.join(", ")}`);

  const precision = vector.rationalityPrecision?.value;
  out.push({
    id: actorId,
    doctrine,
    rationalityPrecision:
      typeof precision === "number" && precision > 0 ? precision : 6,
    rationalityBasis: vector.rationalityPrecision?.basis ?? "NOT STATED",
    verdict: entry.challenge?.verdict ?? "UNREVIEWED",
    essentialismRisk: entry.challenge?.essentialismRisk ?? "",
    corrections: entry.challenge?.corrections ?? "",
    redlinesMarkdown: entry.profile?.redlines ?? "",
    sourcing: entry.profile?.sourcing ?? "",
    uncertainty: entry.profile?.uncertainty ?? "",
  });
}

writeFileSync(outPath, JSON.stringify({ actors: out }, null, 2));

console.log(`extracted ${out.length} actors → ${outPath}`);
for (const actor of out) {
  const flagged = /NONE FOUND/i.test(actor.essentialismRisk) ? "clean" : "FLAGGED";
  console.log(
    `  ${actor.id.padEnd(22)} ${actor.verdict.padEnd(18)} essentialism:${flagged}  params:${Object.keys(actor.doctrine).length}/11  rp=${actor.rationalityPrecision}`,
  );
}
if (problems.length) {
  console.log("\nPROBLEMS:");
  for (const problem of problems) console.log(`  ! ${problem}`);
}
