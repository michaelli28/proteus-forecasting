/**
 * Building and loading the solved consequence table.
 *
 * This module lives outside src/sim/ and src/pipeline/ on purpose: it spawns a
 * subprocess and touches the filesystem, and both guarded trees are checked for
 * exactly that kind of non-determinism. The boundary is clean because the thing
 * it produces is inert data — once the table exists, the kernel is pure again.
 *
 * EPANET is the oracle for the consequence stage, and it is worth being precise
 * about what that buys: the numbers here are REPRODUCIBLE, and a panel can rerun
 * the solver themselves. They are not VALIDATED. Nobody has attacked a real
 * water system to check whether the model's person-hours match reality, and if
 * the solver is used as both predictor and answer key, measured skill on this
 * stage is 1.0 by construction. Downstream reporting must say "verifiable", not
 * "accurate".
 */

import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  COMPONENT_KINDS,
  PERTURBATION_KINDS,
} from "../sim/adapters/cyber-water/config.js";
import type { ComponentRef } from "../sim/adapters/cyber-water/config.js";
import type { ConsequenceTable } from "../sim/adapters/cyber-water/consequence.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** engine/ — src/consequence/ is two levels down. */
const ENGINE_ROOT = resolve(HERE, "..", "..");

export const DEFAULT_TABLE_PATH = resolve(
  ENGINE_ROOT,
  ".cache",
  "consequence-table.json",
);
const DEFAULT_PYTHON = resolve(ENGINE_ROOT, ".venv", "bin", "python");

// Loose: the cache keeps what the solver adds beyond these fields (per-setting
// points, the demand-driven baseline, the band edges) so a cell can be audited.
const CellSchema = z
  .object({
    deltaPersonHoursLow: z.number(),
    deltaPersonHoursHigh: z.number(),
    peakPeopleBelow: z.number(),
    band: z.string(),
    bandAgreed: z.boolean(),
    converged: z.boolean(),
    servedPopulation: z.number(),
  })
  .loose();

const ComponentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(COMPONENT_KINDS),
  zone: z.string(),
  perturbation: z.enum(PERTURBATION_KINDS),
});

const ArchetypeSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  servedPopulation: z.number().positive(),
  junctions: z.number().positive(),
  components: z.array(ComponentSchema).min(1),
});

const TableResponseSchema = z
  .object({
    ok: z.literal(true),
    sweepM: z.array(z.number()).min(2),
    durationsHours: z.array(z.number()).min(1),
    startHour: z.number(),
    solver: z.string(),
    archetypes: z.array(ArchetypeSchema).min(1),
    entries: z.record(z.string(), CellSchema),
  })
  .loose();

export type ArchetypeDescriptor = z.infer<typeof ArchetypeSchema>;

/** The solver's validated reply. It is what the cache file stores. */
export type TableReply = z.infer<typeof TableResponseSchema>;

export interface ConsequenceBundle {
  readonly solver: string;
  readonly sweepM: readonly number[];
  readonly durationsHours: readonly number[];
  readonly archetypes: readonly ArchetypeDescriptor[];
  readonly tables: Readonly<Record<string, ConsequenceTable>>;
}

export interface BuildSpec {
  /**
   * required_pressure sweep, in metres. At least two DISTINCT values.
   *
   * The type cannot express "at least two distinct", so the solver re-checks it
   * and throws. A tuple of length >= 2 would still admit [20, 20], which
   * satisfies arity while defeating the entire purpose of sweeping.
   */
  readonly sweepM: readonly number[];
  readonly durationsHours: readonly number[];
  readonly startHour?: number;
  readonly bandEdgesPersonHours?: readonly number[];
  readonly archetypes?: readonly string[];
  readonly pythonPath?: string;
  /** Forwarded to stderr so a long solve shows progress. */
  readonly onProgress?: (line: string) => void;
}

function runBridge(
  request: unknown,
  pythonPath: string,
  onProgress?: (line: string) => void,
): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonPath, ["-m", "python.consequence.bridge"], {
      cwd: ENGINE_ROOT,
      // matplotlib is pulled in by wntr and writes a font cache on import;
      // without a writable dir it warns on every single invocation.
      env: {
        ...process.env,
        MPLCONFIGDIR: resolve(ENGINE_ROOT, ".cache", "mpl"),
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (onProgress) {
        for (const line of String(chunk).split("\n")) {
          if (line.trim()) onProgress(line.trim());
        }
      }
    });

    child.on("error", (error) =>
      reject(
        new Error(
          `could not start the consequence solver at ${pythonPath}: ${error.message}`,
        ),
      ),
    );

    child.on("close", (code) => {
      if (!stdout.trim()) {
        reject(
          new Error(
            `consequence solver exited ${code} with no output. stderr:\n${stderr}`,
          ),
        );
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `consequence solver returned unparseable output: ${(error as Error).message}`,
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify(request));
  });
}

/** Split the solver's flat entry map into one table per archetype. */
function bundleFrom(parsed: TableReply): ConsequenceBundle {
  const tables: Record<string, ConsequenceTable> = {};

  for (const archetype of parsed.archetypes) {
    const prefix = `${archetype.id}|`;
    const cells: Record<string, ConsequenceTable["cells"][string]> = {};
    for (const [key, cell] of Object.entries(parsed.entries)) {
      if (!key.startsWith(prefix)) continue;
      cells[key] = {
        deltaPersonHoursLow: cell.deltaPersonHoursLow,
        deltaPersonHoursHigh: cell.deltaPersonHoursHigh,
        peakPeopleBelow: cell.peakPeopleBelow,
        band: cell.band,
        bandAgreed: cell.bandAgreed,
        converged: cell.converged,
      };
    }
    if (Object.keys(cells).length === 0) {
      throw new Error(
        `consequence table describes archetype ${archetype.id} but contains no cells for it`,
      );
    }
    tables[archetype.id] = {
      archetypeId: archetype.id,
      servedPopulation: archetype.servedPopulation,
      sweepM: parsed.sweepM,
      durationsHours: parsed.durationsHours,
      solver: parsed.solver,
      cells,
    };
  }

  return {
    solver: parsed.solver,
    sweepM: parsed.sweepM,
    durationsHours: parsed.durationsHours,
    archetypes: parsed.archetypes,
    tables,
  };
}

/** Check the solver's reply; everything it adds beyond the schema is kept. */
export function parseReply(raw: unknown): TableReply {
  const asRecord = raw as { ok?: unknown; error?: unknown };
  if (asRecord?.ok !== true) {
    throw new Error(
      `consequence solver reported failure: ${String(asRecord?.error ?? "unknown error")}`,
    );
  }
  return TableResponseSchema.parse(raw);
}

/** Solve the whole grid and return the solver's reply, to cache with `writeConsequenceTables`. */
export async function solveConsequenceTables(
  spec: BuildSpec,
): Promise<TableReply> {
  const distinct = new Set(spec.sweepM);
  if (distinct.size < 2) {
    throw new Error(
      `required_pressure sweep needs at least two distinct values; got [${spec.sweepM.join(", ")}]`,
    );
  }

  const raw = await runBridge(
    {
      command: "table",
      sweepM: spec.sweepM,
      durationsHours: spec.durationsHours,
      startHour: spec.startHour ?? 6,
      bandEdgesPersonHours: spec.bandEdgesPersonHours ?? [],
      archetypes: spec.archetypes ?? null,
    },
    spec.pythonPath ?? DEFAULT_PYTHON,
    spec.onProgress,
  );

  const reply = parseReply(raw);
  bundleFrom(reply); // a reply the loader would reject never overwrites a good cache
  return reply;
}

export async function writeConsequenceTables(
  reply: TableReply,
  path: string = DEFAULT_TABLE_PATH,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(reply, null, 2), "utf-8");
}

/**
 * Load a previously solved table.
 *
 * Deliberately has no "solve it if missing" fallback. A run that silently
 * shells out to EPANET for ten minutes because a cache file was absent is a run
 * whose provenance nobody can reconstruct later.
 */
export async function loadConsequenceTables(
  path: string = DEFAULT_TABLE_PATH,
): Promise<ConsequenceBundle> {
  let contents: string;
  try {
    contents = await readFile(path, "utf-8");
  } catch {
    throw new Error(
      `no consequence table at ${path} — build one first with 'npm run consequence:build'`,
    );
  }
  return bundleFrom(parseReply(JSON.parse(contents)));
}

/** The register for one archetype, as the adapter's config wants it. */
export function registerFor(
  bundle: ConsequenceBundle,
  archetypeId: string,
): readonly ComponentRef[] {
  const archetype = bundle.archetypes.find((a) => a.id === archetypeId);
  if (!archetype) {
    throw new Error(
      `archetype ${archetypeId} is not in the table; have ${bundle.archetypes.map((a) => a.id).join(", ")}`,
    );
  }
  return archetype.components;
}
