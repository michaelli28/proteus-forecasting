/**
 * The multi-crew references (time-indexed MILP, LP floor) from HiGHS over the
 * python/restoration JSON bridge. Lives outside src/sim and src/pipeline because
 * it spawns a subprocess. Every schedule HiGHS returns is re-checked here —
 * feasibility and cost — so a formulation bug cannot pass as an optimum.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  customerTicks,
  listSchedule,
  scheduleFromStarts,
} from "../sim/adapters/restoration/objective.js";
import type {
  RepairProblem,
  Schedule,
} from "../sim/adapters/restoration/objective.js";

const HERE = dirname(fileURLToPath(import.meta.url));
/** engine/ — src/restoration/ is two levels down. */
const ENGINE_ROOT = resolve(HERE, "..", "..");

export const DEFAULT_PYTHON = resolve(ENGINE_ROOT, ".venv", "bin", "python");
/** Pre-registration §4: 60 s per storm. */
const DEFAULT_TIME_LIMIT_SECONDS = 60;

export const SOLVER_STATUSES = [
  "optimal",
  "time_limit",
  "infeasible",
  "error",
] as const;
export type SolverStatus = (typeof SOLVER_STATUSES)[number];

const ResultSchema = z.object({
  status: z.enum(SOLVER_STATUSES),
  objective: z.number().nullable(),
  starts: z.array(z.number().int()).nullable(),
  seconds: z.number(),
});
const ResponseSchema = z.object({
  ok: z.literal(true),
  solver: z.string(),
  results: z.array(ResultSchema),
});
const FailureSchema = z.object({ ok: z.literal(false), error: z.string() });
type SolverResult = z.infer<typeof ResultSchema>;

export interface SolveOptions {
  readonly timeLimitSeconds?: number;
  readonly pythonPath?: string;
  /** The bridge's progress lines, as they arrive. */
  readonly onProgress?: (line: string) => void;
}

export interface OptimumResult {
  /** HiGHS proved it within its 1e-4 gap. A time-limited incumbent never is. */
  readonly proven: boolean;
  readonly status: SolverStatus;
  /** The re-listed schedule's customer-ticks, a whole number; null when HiGHS found no schedule. */
  readonly customerTicks: number | null;
  readonly schedule: Schedule | null;
  readonly seconds: number;
}

export interface FloorResult {
  /** No schedule costs less. Fractional: it is an LP bound. */
  readonly customerTicks: number;
  readonly seconds: number;
}

export interface Solved<R> {
  readonly solver: string;
  readonly results: readonly R[];
}

function runBridge(
  request: unknown,
  pythonPath: string,
  onProgress?: (line: string) => void,
): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonPath, ["-m", "python.restoration.bridge"], {
      cwd: ENGINE_ROOT,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (onProgress) {
        for (const line of chunk.split("\n")) {
          if (line.trim()) onProgress(line.trim());
        }
      }
    });

    child.on("error", (error) =>
      reject(
        new Error(
          `could not start the restoration solver at ${pythonPath}: ${error.message}`,
        ),
      ),
    );
    // A bridge that dies before reading its request breaks the pipe; without a
    // listener that crashes Node. The close handler below reports the failure.
    child.stdin.on("error", () => undefined);

    child.on("close", (code) => {
      if (!stdout.trim()) {
        reject(
          new Error(
            `restoration solver at ${pythonPath} exited ${code} with no output. stderr:\n${stderr}`,
          ),
        );
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reject(
          new Error(
            `restoration solver at ${pythonPath} returned unparseable output: ${message}`,
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify(request));
  });
}

function responseOf(
  problems: readonly RepairProblem[],
  raw: unknown,
): z.infer<typeof ResponseSchema> {
  const failure = FailureSchema.safeParse(raw);
  if (failure.success) {
    throw new Error(
      `restoration solver reported failure: ${failure.data.error}`,
    );
  }
  const response = ResponseSchema.parse(raw);
  if (response.results.length !== problems.length) {
    throw new Error(
      `asked for ${problems.length} problems, got ${response.results.length} results`,
    );
  }
  return response;
}

/** Prefix the problem's index so a failure deep in a 200-storm batch says which storm. */
function forProblem<T>(index: number, check: () => T): T {
  try {
    return check();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`problem ${index}: ${message}`, { cause: error });
  }
}

/**
 * HiGHS may leave a crew idle when that costs nothing; pre-registration §2 does
 * not. Its repairs are handed out again in its start order (ties: lowest index)
 * to whichever crew frees up first (§9.3). For feasible starts this moves no
 * repair later, so a cost rise is a bug, never a result.
 */
export function relistInStartOrder(
  problem: RepairProblem,
  raw: { readonly start: readonly number[]; readonly customerTicks: number },
  crews: number,
): { readonly schedule: Schedule; readonly customerTicks: number } {
  const order = raw.start
    .map((_, j) => j)
    .sort((a, b) => raw.start[a]! - raw.start[b]! || a - b);
  const schedule = listSchedule(problem, order, crews);
  const cost = customerTicks(problem, schedule.completion);
  if (cost > raw.customerTicks) {
    throw new Error(
      `re-listing raised the cost from ${raw.customerTicks} to ${cost}`,
    );
  }
  return { schedule, customerTicks: cost };
}

function checkedOptimum(
  problem: RepairProblem,
  result: SolverResult,
  crews: number,
): OptimumResult {
  const proven = result.status === "optimal";
  const { status, seconds, starts, objective } = result;
  if (starts === null) {
    if (proven)
      throw new Error("solver reported optimal but returned no schedule");
    return { proven, status, customerTicks: null, schedule: null, seconds };
  }
  const raw = scheduleFromStarts(problem, starts, crews);
  const rawCost = customerTicks(problem, raw.completion);
  if (
    objective === null ||
    Math.abs(rawCost - objective) > 1e-6 * Math.max(1, Math.abs(objective))
  ) {
    throw new Error(
      `solver objective ${objective} disagrees with the recomputed ${rawCost}`,
    );
  }
  const relisted = relistInStartOrder(
    problem,
    { start: starts, customerTicks: rawCost },
    crews,
  );
  return { proven, status, ...relisted, seconds };
}

export function parseOptimum(
  problems: readonly RepairProblem[],
  crews: number,
  raw: unknown,
): Solved<OptimumResult> {
  const response = responseOf(problems, raw);
  return {
    solver: response.solver,
    results: response.results.map((result, i) =>
      forProblem(i, () => checkedOptimum(problems[i]!, result, crews)),
    ),
  };
}

export function parseFloor(
  problems: readonly RepairProblem[],
  raw: unknown,
): Solved<FloorResult> {
  const response = responseOf(problems, raw);
  return {
    solver: response.solver,
    results: response.results.map((result, i) =>
      forProblem(i, () => {
        if (result.status !== "optimal" || result.objective === null) {
          throw new Error(
            `the LP floor did not solve (status ${result.status})`,
          );
        }
        return { customerTicks: result.objective, seconds: result.seconds };
      }),
    ),
  };
}

function request(
  mode: "milp" | "lp",
  problems: readonly RepairProblem[],
  crews: number,
  options: SolveOptions,
): unknown {
  return {
    command: "solve",
    mode,
    crews,
    timeLimitSeconds: options.timeLimitSeconds ?? DEFAULT_TIME_LIMIT_SECONDS,
    problems,
  };
}

/** The MILP per problem, one bridge call for the batch. Minutes for 200 storms. */
export async function solveOptimum(
  problems: readonly RepairProblem[],
  crews: number,
  options: SolveOptions = {},
): Promise<Solved<OptimumResult>> {
  const raw = await runBridge(
    request("milp", problems, crews, options),
    options.pythonPath ?? DEFAULT_PYTHON,
    options.onProgress,
  );
  return parseOptimum(problems, crews, raw);
}

export async function solveLpFloor(
  problems: readonly RepairProblem[],
  crews: number,
  options: SolveOptions = {},
): Promise<Solved<FloorResult>> {
  const raw = await runBridge(
    request("lp", problems, crews, options),
    options.pythonPath ?? DEFAULT_PYTHON,
    options.onProgress,
  );
  return parseFloor(problems, raw);
}
