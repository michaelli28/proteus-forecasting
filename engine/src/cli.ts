import { Command } from "commander";
import {
  DEFAULT_FORECAST_OPTIONS,
  formatRunSummary,
  parseRange,
  runForecast,
} from "./forecast.js";
import { formatProduct } from "./pipeline/product.js";
import {
  INFLUENCE_OPS_MEASURES,
  isInfluenceOpsMeasure,
} from "./pipeline/influence-ops-binding.js";
import "dotenv/config";

const forecast = new Command("forecast")
  .description(
    "Forecast one question against the synthetic influence-ops world",
  )
  .argument("<question>", "The intelligence question to answer")
  .option(
    "-m, --measure <name>",
    `Target quantity: ${INFLUENCE_OPS_MEASURES.join(" | ")}`,
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
    if (!isInfluenceOpsMeasure(opts.measure)) {
      console.error(
        `Unknown measure "${opts.measure}". Expected one of: ${INFLUENCE_OPS_MEASURES.join(", ")}`,
      );
      process.exit(1);
    }

    const outcome = await runForecast({
      question,
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

const program = new Command()
  .name("proteus")
  .description(
    "Calibrated forecasting against a simulated world, with an abstention gate",
  );

program.addCommand(forecast);

program.parse();
