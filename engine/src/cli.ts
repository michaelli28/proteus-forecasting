import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { ArtifactStore } from "./artifact/store.js";
import { buildRunTrace } from "./pipeline/trace.js";
import type { RunTrace, TraceFile } from "./pipeline/trace.js";
import {
  DEFAULT_FORECAST_OPTIONS,
  DOMAIN_MEASURES,
  FORECAST_DOMAINS,
  formatRunSummary,
  isForecastDomain,
  parseRange,
  runForecast,
} from "./forecast.js";
import { formatProduct } from "./pipeline/product.js";
import { INFLUENCE_OPS_MEASURES } from "./pipeline/influence-ops-binding.js";
import { RECRUITMENT_MEASURES } from "./pipeline/recruitment-binding.js";
import {
  DEFAULT_TABLE_PATH,
  buildConsequenceTables,
  writeConsequenceTables,
} from "./consequence/table.js";
import { formatSweep, runVulnerabilitySweep } from "./vulnerability.js";
import "dotenv/config";

const forecast = new Command("forecast")
  .description(
    "Forecast one question against the synthetic influence-ops world",
  )
  .argument("<question>", "The intelligence question to answer")
  .option(
    "-d, --domain <name>",
    `World to forecast against: ${FORECAST_DOMAINS.join(" | ")}`,
    "influence-ops",
  )
  .option(
    "-m, --measure <name>",
    `Target quantity. influence-ops: ${INFLUENCE_OPS_MEASURES.join(" | ")}. recruitment: ${RECRUITMENT_MEASURES.join(" | ")}`,
    DEFAULT_FORECAST_OPTIONS.measure,
  )
  .option("-t, --tick <n>", "Tick the outcome resolves at", "119")
  .option(
    "-r, --range <lo,hi>",
    "Outcome range the bands tile; omit for the measure's definitional range",
  )
  .option("-b, --bands <n>", "Number of outcome bands", "4")
  .option("-n, --runs <n>", "Ensemble size", "16")
  .option(
    "-s, --seed <seed>",
    "Root seed; the same seed reproduces the run",
    "proteus",
  )
  .option(
    "--as-of <date>",
    "Information cutoff (YYYY-MM-DD)",
    DEFAULT_FORECAST_OPTIONS.asOf,
  )
  .option(
    "--store <dir>",
    "Artifact directory",
    DEFAULT_FORECAST_OPTIONS.storeDir,
  )
  .option("--offline", "Never call a model; use the uniform-partition fallback")
  .option("--json", "Emit the analytic product as JSON");

forecast.action(async (question: string, opts) => {
  try {
    if (!isForecastDomain(opts.domain)) {
      console.error(
        `Unknown domain "${opts.domain}". Expected one of: ${FORECAST_DOMAINS.join(", ")}`,
      );
      process.exit(1);
    }
    if (!DOMAIN_MEASURES[opts.domain].includes(opts.measure)) {
      console.error(
        `"${opts.measure}" is not a ${opts.domain} measure. Expected one of: ${DOMAIN_MEASURES[opts.domain].join(", ")}`,
      );
      process.exit(1);
    }

    const outcome = await runForecast({
      question,
      domain: opts.domain,
      measure: opts.measure,
      resolveAtTick: Number(opts.tick),
      range: parseRange(opts.range),
      bands: Number(opts.bands),
      runs: Number(opts.runs),
      seed: opts.seed,
      asOf: opts.asOf,
      storeDir: opts.store,
      offline: Boolean(opts.offline),
    });

    if (opts.json) {
      console.log(JSON.stringify(outcome.result.product, null, 2));
      return;
    }

    console.log(formatRunSummary(outcome));
    console.log("");
    console.log(formatProduct(outcome.result.product));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

/**
 * Publish run traces for the dashboard.
 *
 * A separate command rather than a flag on `forecast` because the interesting
 * runs are usually ones that already exist — an ensemble member whose outcome
 * was surprising is worth looking at after the fact, not only while it runs.
 */
const trace = new Command("trace")
  .description("Publish one or more run traces as dashboard-ready JSON")
  .argument(
    "[runId]",
    "Run id or a unique prefix of one. Omit with --all to take every run",
  )
  .option(
    "--store <dir>",
    "Artifact directory",
    DEFAULT_FORECAST_OPTIONS.storeDir,
  )
  .option("--out <file>", "Where to write the trace file", "./run-traces.json")
  .option("--all", "Trace every run in the store")
  .option("--limit <n>", "Cap on runs traced with --all", "24")
  .option("--list", "List the runs available in the store and exit");

trace.action(async (runId: string | undefined, opts) => {
  try {
    const storeDir = resolve(opts.store);
    const store = new ArtifactStore(storeDir);
    const available = await store.list();

    if (available.length === 0) {
      console.error(
        `No runs in ${storeDir}. Produce some first:\n  proteus forecast "<question>" --offline`,
      );
      process.exit(1);
    }

    if (opts.list) {
      console.log(`${available.length} run(s) in ${storeDir}\n`);
      for (const id of available) console.log(`  ${id.slice(0, 16)}  ${id}`);
      return;
    }

    const selected = opts.all
      ? available.slice(0, Number(opts.limit))
      : [resolveRunId(available, runId)];

    const traces: RunTrace[] = [];
    for (const id of selected) {
      traces.push(
        buildRunTrace(
          id,
          await store.readIdentity(id),
          await store.readEvents(id),
        ),
      );
    }

    const file: TraceFile = { traces };
    const outPath = resolve(opts.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(file, null, 2), "utf-8");

    console.log(`Wrote ${traces.length} trace(s) to ${outPath}`);
    for (const t of traces) {
      const last = t.ticks.at(-1)!.truth;
      console.log(
        `  ${t.runId.slice(0, 12)}  ${t.ticks.length} ticks  ` +
          `adoption ${last.adoptionRate.toFixed(3)}  ` +
          `bimodality ${last.bimodality.toFixed(3)}  ` +
          `detector ${t.detection.compositeScore.toFixed(3)}  ` +
          `${t.campaign ? `campaign ${t.campaign.startTick}-${t.campaign.endTick}` : "control (no campaign)"}`,
      );
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

/**
 * Resolve a run id from a prefix.
 *
 * Ambiguity is an error rather than a first match: the hashes are the audit
 * trail, and quietly tracing a different run than the one asked for is the kind
 * of mistake nobody would catch by looking at the output.
 */
function resolveRunId(available: readonly string[], prefix?: string): string {
  if (!prefix) {
    throw new Error(
      "Give a run id (or a prefix), or pass --all. `--list` shows what is available.",
    );
  }
  const matches = available.filter((id) => id.startsWith(prefix));
  if (matches.length === 0) {
    throw new Error(`No run in the store starts with "${prefix}"`);
  }
  if (matches.length > 1) {
    throw new Error(
      `"${prefix}" matches ${matches.length} runs. Use more characters:\n` +
        matches.map((id) => `  ${id.slice(0, 16)}`).join("\n"),
    );
  }
  return matches[0]!;
}

const consequence = new Command("consequence")
  .description(
    "Solve the water-system consequence table with WNTR/EPANET (minutes, not seconds)",
  )
  .option(
    "--sweep <m,...>",
    "required_pressure sweep in metres; at least two DISTINCT values",
    "14.0,21.1,28.0",
  )
  .option("--durations <h,...>", "Attack durations in hours", "6,12,24,48")
  .option("--start-hour <h>", "Hour of day the attack window opens", "6")
  .option(
    "--bands <p,...>",
    "Interior band edges in person-hours",
    "500,5000,25000",
  )
  .option("--out <path>", "Where to write the table", DEFAULT_TABLE_PATH)
  .action(async (opts) => {
    try {
      const sweepM = String(opts.sweep).split(",").map(Number);
      const bundle = await buildConsequenceTables({
        sweepM,
        durationsHours: String(opts.durations).split(",").map(Number),
        startHour: Number(opts.startHour),
        bandEdgesPersonHours: String(opts.bands).split(",").map(Number),
        onProgress: (line) => process.stderr.write(`${line}\n`),
      });
      await writeConsequenceTables(bundle, opts.out);
      console.log(
        `Solved ${Object.keys(bundle.tables).length} archetypes with ${bundle.solver} → ${opts.out}`,
      );
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  });

const vulnerability = new Command("vulnerability")
  .description(
    "Rank chokepoints, attack paths and defense ROI against a synthetic water archetype",
  )
  .option("-a, --archetype <id>", "Archetype to sweep", "municipal_pumped")
  .option("-n, --seeds <n>", "Seeds per arm; runs = seeds × 9 postures", "24")
  .option("-t, --ticks <n>", "Days simulated", "180")
  .option(
    "-s, --seed <seed>",
    "Root seed; the same seed reproduces the sweep",
    "proteus",
  )
  .option("--table <path>", "Consequence table to read", DEFAULT_TABLE_PATH)
  .option("--json", "Emit the report as JSON")
  .action(async (opts) => {
    try {
      const result = await runVulnerabilitySweep({
        archetypeId: opts.archetype,
        seedCount: Number(opts.seeds),
        ticks: Number(opts.ticks),
        rootSeed: opts.seed,
        tablePath: opts.table,
      });
      console.log(
        opts.json
          ? JSON.stringify(result.report, null, 2)
          : formatSweep(result),
      );
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  });

const program = new Command()
  .name("proteus")
  .description(
    "Calibrated forecasting against a simulated world, with an abstention gate",
  );

program.addCommand(forecast);
program.addCommand(trace);
program.addCommand(consequence);
program.addCommand(vulnerability);

program.parse();
