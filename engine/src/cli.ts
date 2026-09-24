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
  loadConsequenceTables,
  solveConsequenceTables,
  writeConsequenceTables,
} from "./consequence/table.js";
import { formatSweep, runVulnerabilitySweep } from "./vulnerability.js";
import { PACK_IDS, runSimulate } from "./simulate.js";
import { SCENARIO_PRESETS, getPreset } from "./scenario/presets.js";
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
    "Solve the water-system consequence table with WNTR/EPANET and cache it",
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
      const reply = await solveConsequenceTables({
        sweepM,
        durationsHours: String(opts.durations).split(",").map(Number),
        startHour: Number(opts.startHour),
        bandEdgesPersonHours: String(opts.bands).split(",").map(Number),
        onProgress: (line) => process.stderr.write(`${line}\n`),
      });
      await writeConsequenceTables(reply, opts.out);
      // Read it back, so a cache nothing can load fails here and not later.
      const bundle = await loadConsequenceTables(opts.out);
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

const simulate = new Command("simulate")
  .description(
    "Run one contested-system scenario and stream every decision as it is made",
  )
  .option(
    "--preset <id>",
    `Curated configuration: ${SCENARIO_PRESETS.map((p) => p.id).join(", ")}. Fills in pack, actors, mitigation and seed; anything you also pass wins.`,
  )
  .option(
    "--presets",
    "List the curated configurations, with the question each one answers, and exit",
  )
  .option(
    "-p, --pack <id>",
    `Scenario pack: ${PACK_IDS.join(", ")}`,
    "regional-grid",
  )
  .option(
    "-a, --actors <ids>",
    "Comma-separated doctrine profile ids to place in the scenario",
    "russia",
  )
  .option(
    "-r, --respondents <ids>",
    "Comma-separated profile ids that react to attributable acts",
    "",
  )
  .option(
    "-s, --seed <seed>",
    "Root seed; the same seed reproduces the run exactly",
    "proteus",
  )
  .option("-d, --defense <kind>", "Mitigation to run this arm with", "")
  .option(
    "--delay <ms>",
    "Wall-clock pause per tick, for watching. Does not affect results.",
    "0",
  )
  .option(
    "--stream",
    "Emit newline-delimited JSON instead of the terminal view",
  )
  .option("--profiles <path>", "Doctrine profile library to load")
  .option(
    "--deep",
    "Replay many worlds, convene the actors' own institutional gates as model agents, and adjudicate. Costs money and minutes.",
  )
  .option("--branches <n>", "Worlds to replay in deep mode", "6")
  .option(
    "--councils <n>",
    "Cap on councils per world; what it drops is reported, never silent",
    "6",
  )
  .option("--concurrency <n>", "Councils deliberating at once", "3")
  .option("--judges <n>", "Adjudicators over the ensemble, 0 to skip", "5")
  .option("--model <id>", "Model backing the councils and judges")
  .action(async (opts) => {
    try {
      if (opts.presets) {
        for (const entry of SCENARIO_PRESETS) {
          console.log(`\n${entry.id}`);
          console.log(`  ${entry.question}`);
          console.log(
            `  --pack ${entry.pack} --actors ${entry.actors.join(",")}` +
              (entry.respondents.length
                ? ` --respondents ${entry.respondents.join(",")}`
                : "") +
              (entry.defense ? ` --defense ${entry.defense}` : "") +
              ` --seed ${entry.seed}` +
              (entry.needsDeliberation ? " --deep" : ""),
          );
        }
        return;
      }

      // A preset fills in only what the caller left alone, so `--preset X
      // --actors china` is a preset with one substitution rather than a silent
      // conflict — and the run stays inspectable, which is the point of it.
      const preset = opts.preset ? getPreset(opts.preset) : null;
      const typed = (name: string): boolean =>
        simulate.getOptionValueSource(name) === "cli";
      const pick = <T>(name: string, mine: T, theirs: T | undefined): T =>
        preset && !typed(name) && theirs !== undefined ? theirs : mine;

      // Never turned on for you: --deep spends real money, so a preset that
      // needs councils says so and waits to be asked.
      if (preset?.needsDeliberation && !opts.deep) {
        console.error(
          `${preset.id} makes its point with councils convened — add --deep to see it.`,
        );
      }

      const result = await runSimulate({
        pack: pick("pack", opts.pack, preset?.pack),
        actors: pick(
          "actors",
          splitIds(opts.actors),
          preset?.actors as string[],
        ),
        respondents: pick(
          "respondents",
          splitIds(opts.respondents),
          preset?.respondents as string[],
        ),
        seed: pick("seed", opts.seed, preset?.seed),
        defense: pick("defense", opts.defense || null, preset?.defense),
        tickDelayMs: Number(opts.delay),
        stream: Boolean(opts.stream),
        profilePath: opts.profiles,
        deep: Boolean(opts.deep),
        branches: Number(opts.branches),
        maxCouncilsPerBranch: Number(opts.councils),
        councilConcurrency: Number(opts.concurrency),
        judges: Number(opts.judges),
        model: opts.model,
      });
      if (opts.stream) return;
      if (result.deep) {
        console.error(
          `run ${result.runId.slice(0, 12)} · ${result.deep.branches} worlds · ` +
            `${result.deep.councils} councils (${result.deep.disagreements} disagreed with the arithmetic) · ` +
            `${result.deep.judgements} adjudicators · ${result.deep.modelCalls} model calls · ` +
            (result.deep.modelCalls === 0
              ? "no model backend configured"
              : result.deep.costUsd > 0
                ? `$${result.deep.costUsd.toFixed(2)}`
                : "cost not priced for this model"),
        );
        return;
      }
      console.error(
        `run ${result.runId.slice(0, 12)} · ${result.activations} acts · ${Math.round(result.totalHarm).toLocaleString()} ${result.harmUnit}`,
      );
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  });

function splitIds(raw: string): string[] {
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

const compile = new Command("compile")
  .description(
    "Compile a plain-language description of a situation into a runnable scenario",
  )
  .argument("<request>", "The situation, in your own words")
  .option("--out <file>", "Where to write the compiled spec", "./scenario.json")
  .option("--as-of <date>", "Information cutoff for retrieval", "2026-08-01")
  .option("--retrieve", "Ground the scenario in live public-web sources")
  .option("--profiles <path>", "Doctrine profile library to read")
  .action(async (request: string, opts) => {
    try {
      const [
        { compileScenario },
        { loadDoctrineLibrary },
        { createAnthropicClient },
      ] = await Promise.all([
        import("./scenario/compile.js"),
        import("./actors/library.js"),
        import("./llm/anthropic.js"),
      ]);

      const library = await loadDoctrineLibrary(opts.profiles);
      const client = createAnthropicClient();

      let evidence;
      if (opts.retrieve) {
        const { createWebConnector } = await import("./retrieval/web.js");
        const connector = createWebConnector();
        process.stderr.write("retrieving public sources…\n");
        const result = await connector.retrieve({
          question: request,
          asOf: opts.asOf,
          maxResults: 10,
        });
        process.stderr.write(
          `  ${result.documents.length} cited passages from ${result.queriesIssued.length} searches` +
            (result.excludedByCutoff > 0
              ? `; ${result.excludedByCutoff} excluded as undated or post-cutoff\n`
              : "\n"),
        );
        evidence = result.documents.map((document) => ({
          sourceId: document.sourceId,
          documentId: document.id,
          publishedAt: document.publishedAt,
          credibility: 0.7,
          excerpt: document.excerpt,
        }));
      }

      process.stderr.write("compiling…\n");
      const result = await compileScenario({
        client,
        library,
        request,
        evidence,
        onRetry: (attempt, reason) =>
          process.stderr.write(
            `  repair ${attempt}: ${reason.slice(0, 120)}\n`,
          ),
      });

      const out = resolve(process.cwd(), opts.out);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(result.compiled, null, 2));

      const { situation, suggestedActors, assumptions, limitations } =
        result.compiled;
      console.error(`\n${situation.statement}`);
      console.error(
        `  ${situation.assets.length} assets · ${situation.ladder.length - 1} escalation rungs · ${situation.defenses.length} candidate mitigations`,
      );
      console.error(`\nwho would contest this:`);
      for (const actor of suggestedActors) {
        console.error(`  ${actor.profileId} — ${actor.reasoning}`);
      }
      if (assumptions.length > 0) {
        console.error(`\nassumed, because the request did not say:`);
        for (const line of assumptions) console.error(`  · ${line}`);
      }
      if (limitations.length > 0) {
        console.error(`\nnot modelled:`);
        for (const line of limitations) console.error(`  · ${line}`);
      }
      if (result.repairs.length > 0) {
        console.error(`\nrepaired during compilation:`);
        for (const line of result.repairs) console.error(`  · ${line}`);
      }
      console.error(`\nwrote ${out}`);
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  });

const manifest = new Command("manifest")
  .description(
    "Publish the scenario and actor catalogue the dashboard renders its controls from",
  )
  .option(
    "--out <file>",
    "Where to write it",
    "../dashboard/data/scenario-manifest.json",
  )
  .option(
    "--dossiers <file>",
    "Where to write the full sourced profiles the dossier pages read",
    "../dashboard/data/actor-dossiers.json",
  )
  .option(
    "--comparisons <file>",
    "Where to write the measured mitigation comparison each pack's page reads",
    "../dashboard/data/arm-comparisons.json",
  )
  .option("--profiles <path>", "Doctrine profile library to read")
  .action(async (opts) => {
    try {
      const { buildManifest, buildDossiers, buildComparisons } =
        await import("./scenario/manifest.js");
      const built = await buildManifest(opts.profiles);
      const out = resolve(process.cwd(), opts.out);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, JSON.stringify(built, null, 2));

      const dossiers = await buildDossiers(opts.profiles);
      const dossierOut = resolve(process.cwd(), opts.dossiers);
      await mkdir(dirname(dossierOut), { recursive: true });
      await writeFile(dossierOut, JSON.stringify(dossiers, null, 2));

      const documented = dossiers.profiles.filter(
        (profile) => profile.procedure || profile.worldview || profile.history,
      ).length;
      // Replays every arm of every pack, so it is the slow half of this
      // command. Reported separately rather than folded into a single line, so
      // a wait of half a minute has something on screen explaining itself.
      console.error("measuring mitigations across six seeds per pack…");
      const comparisons = await buildComparisons(opts.profiles);
      const comparisonOut = resolve(process.cwd(), opts.comparisons);
      await mkdir(dirname(comparisonOut), { recursive: true });
      await writeFile(comparisonOut, JSON.stringify(comparisons, null, 2));

      const inert = dossiers.constraintReach.filter(
        (reach) => reach.reachedIn.length === 0,
      ).length;
      const unreliable = comparisons.flatMap((entry) =>
        entry.defended.filter((arm) => arm.beatBaseline < entry.seeds.length),
      ).length;
      console.log(
        `${built.packs.length} packs, ${built.actors.length} actors, ${built.presets.length} presets → ${out}\n` +
          `${dossiers.profiles.length} dossiers (${documented} carrying procedure, worldview or decision record) → ${dossierOut}\n` +
          `${dossiers.constraintReach.length} enforceable commitments, ${inert} of which no shipped scenario can trip\n` +
          `${comparisons.length} mitigation comparisons → ${comparisonOut}\n` +
          `${unreliable} mitigations do not beat the undefended arm on every seed`,
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
program.addCommand(simulate);
program.addCommand(manifest);
program.addCommand(compile);

program.parse();
