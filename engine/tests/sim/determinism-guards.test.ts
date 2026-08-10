import { describe, it, expect } from "vitest";
import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { fileURLToPath } from "url";

/**
 * Static guards on the deterministic core.
 *
 * A single `Math.random()` or `Date.now()` here silently destroys
 * reproducibility, and no behavioural test would catch it — the run still works,
 * it just stops being the same run twice. So we check the source directly.
 *
 * src/pipeline/ is covered as well as src/sim/: the orchestrator picks seeds,
 * builds run identities and assembles artifacts, so a wall-clock read there
 * would break "same seed, same artifact hash" exactly as surely as one inside
 * the kernel.
 */

const GUARDED_DIRS = ["../../src/sim", "../../src/pipeline"].map((path) =>
  fileURLToPath(new URL(path, import.meta.url)),
);

/** Non-determinism sources, with what to use instead. */
const BANNED = [
  {
    pattern: /\bMath\s*\.\s*random\s*\(/,
    name: "Math.random()",
    use: "Rng from sim/rng.ts",
  },
  {
    pattern: /\bDate\s*\.\s*now\s*\(/,
    name: "Date.now()",
    use: "simulation ticks",
  },
  {
    pattern: /\bnew\s+Date\s*\(\s*\)/,
    name: "new Date()",
    use: "simulation ticks",
  },
  {
    pattern: /\bperformance\s*\.\s*now\s*\(/,
    name: "performance.now()",
    use: "simulation ticks",
  },
  {
    pattern: /\bcrypto\s*\.\s*randomUUID\s*\(/,
    name: "crypto.randomUUID()",
    use: "a seeded id",
  },
] as const;

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

/** Strip comments so a mention in prose does not trip the guard. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe.each(GUARDED_DIRS)("determinism guards on %s", (dir) => {
  it("has source files to check", async () => {
    // Guards that scan an empty directory pass vacuously and prove nothing.
    expect((await collectSourceFiles(dir)).length).toBeGreaterThan(0);
  });

  for (const { pattern, name, use } of BANNED) {
    it(`does not use ${name}`, async () => {
      const offenders: string[] = [];
      for (const path of await collectSourceFiles(dir)) {
        const code = stripComments(await readFile(path, "utf-8"));
        if (pattern.test(code)) offenders.push(relative(dir, path));
      }
      expect(
        offenders,
        `${name} is banned here — use ${use}. Found in: ${offenders.join(", ")}`,
      ).toEqual([]);
    });
  }
});
