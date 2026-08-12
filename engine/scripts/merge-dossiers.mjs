/**
 * Fold researched dossiers into the profile library.
 *
 * The research is authored one actor per file under `data/dossiers/` so a
 * reviewer can argue with one actor without opening a quarter-megabyte document,
 * and merged here into the single library the engine loads. Merge is by id and
 * touches only the three dossier sections — a merge that could overwrite a
 * doctrine parameter would let narrative research silently move a number that
 * the whole system's defensibility rests on.
 *
 * Run: node scripts/merge-dossiers.mjs
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBRARY = resolve(HERE, "../data/doctrine-profiles.json");
const DOSSIER_DIR = resolve(HERE, "../data/dossiers");

const SECTIONS = ["procedure", "worldview", "history", "weakestClaim"];

/**
 * `office` is a NAME, not a description.
 *
 * The research routinely returns the whole authority chain in this field —
 * "Politburo Standing Committee, working through the Party's central commissions
 * — Central National Security Commission (created at the Third Plenum…)". That
 * is good research in the wrong slot: the field becomes a seat's label on screen
 * and in a prompt header, and a two-hundred-word label is unreadable in both.
 *
 * So the head is kept as the name and the remainder is moved into `basis`
 * rather than deleted. Nothing researched is lost; it is filed where a reader
 * expecting a citation will look for it.
 */
function normalizeOffice(step) {
  const original = step.office.trim();
  if (original.length <= 64) return step;

  // Split at the first structural break: an em-dash aside, a semicolon, or a
  // subordinate clause. These are where the name ends and the detail begins.
  const breakAt = original.search(/\s+—\s+|;\s+|,\s+(?:working|plus|and the|with)\b/);
  let name = breakAt > 0 ? original.slice(0, breakAt) : original;
  if (name.length > 64) {
    const comma = name.indexOf(", ");
    if (comma > 0) name = name.slice(0, comma);
  }
  // A cut inside a parenthetical leaves a dangling "(", which reads as a typo
  // rather than as a name. Drop the opened-but-unclosed aside.
  const opens = (name.match(/\(/g) ?? []).length;
  const closes = (name.match(/\)/g) ?? []).length;
  if (opens > closes) name = name.slice(0, name.lastIndexOf("("));

  name = name.replace(/[,;(\s]+$/, "").trim();
  if (!name) return step;

  const remainder = original.slice(name.length).replace(/^[\s,;—-]+/, "").trim();
  return {
    ...step,
    office: name,
    basis: remainder ? `${step.basis} Authority chain as researched: ${remainder}` : step.basis,
  };
}

const library = JSON.parse(await readFile(LIBRARY, "utf8"));
const byId = new Map(library.profiles.map((profile) => [profile.id, profile]));

const files = (await readdir(DOSSIER_DIR)).filter((name) =>
  name.endsWith(".json"),
);

let merged = 0;
const skipped = [];

for (const file of files.sort()) {
  const raw = await readFile(join(DOSSIER_DIR, file), "utf8");
  let dossier;
  try {
    dossier = JSON.parse(raw);
  } catch (error) {
    skipped.push(`${file}: not valid JSON — ${error.message}`);
    continue;
  }

  const profile = byId.get(dossier.id);
  if (!profile) {
    skipped.push(`${file}: no profile with id "${dossier.id}"`);
    continue;
  }

  const added = [];
  for (const section of SECTIONS) {
    if (dossier[section] === undefined) continue;
    profile[section] =
      section === "procedure"
        ? { ...dossier.procedure, steps: dossier.procedure.steps.map(normalizeOffice) }
        : dossier[section];
    added.push(section);
  }

  if (added.length === 0) {
    skipped.push(`${file}: carried none of ${SECTIONS.join(", ")}`);
    continue;
  }

  merged++;
  const steps = profile.procedure?.steps?.length ?? 0;
  const episodes = profile.history?.length ?? 0;
  console.log(
    `${dossier.id}: ${added.join(" + ")} (${steps} gates, ${episodes} episodes)`,
  );
}

await writeFile(LIBRARY, `${JSON.stringify(library, null, 2)}\n`);

console.log(`\nmerged ${merged}/${files.length} dossiers into ${LIBRARY}`);
if (skipped.length > 0) {
  console.log("skipped:");
  for (const reason of skipped) console.log(`  ${reason}`);
  process.exitCode = 1;
}
