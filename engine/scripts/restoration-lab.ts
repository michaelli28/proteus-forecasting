/**
 * The repair-order lab, exactly as pre-registered in docs/RESTORATION-LAB-PREREG.md:
 * every rule through the real kernel on shared storms, per cell and crew count;
 * the reference from Horn (1 crew) or HiGHS (2–4 crews); the paired tables.
 *
 * Markdown to stdout, progress to stderr, everything to
 * .cache/restoration-lab/results-<storms>.json, so a smoke run never overwrites
 * the 200-storm file. The storm count is for smoke runs only: the results doc
 * uses the pre-registered 200.
 *
 *   RESTORATION_LAB_COMMIT=$(git rev-parse HEAD) node --import tsx scripts/restoration-lab.ts [storms]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSimulation } from "../src/sim/kernel.js";
import {
  DEFAULT_CONFIG,
  RESTORATION_RULES,
  TICK_HOURS,
  customerTicks,
  hornOrder,
  listSchedule,
  problemOf,
  restorationAdapter,
  restorationTicks,
} from "../src/sim/adapters/restoration/index.js";
import type {
  RepairProblem,
  RestorationConfig,
  RestorationRule,
  Schedule,
  Storm,
} from "../src/sim/adapters/restoration/index.js";
import {
  TIME_LIMIT_SECONDS,
  solveLpFloor,
  solveOptimum,
} from "../src/restoration/solver.js";
import type { OptimumResult } from "../src/restoration/solver.js";
import {
  labTable,
  median,
  resolveReference,
  sigmaPairingKey,
} from "../src/restoration/lab-table.js";
import type {
  LabTable,
  Reference,
  StormOutcome,
} from "../src/restoration/lab-table.js";

const CELLS = [
  { id: "primary", k: [6, 12], sigma: 0.6, exact: true },
  { id: "equal-times", k: [6, 12], sigma: 0, exact: true },
  { id: "wide-spread", k: [6, 12], sigma: 1.0, exact: true },
  { id: "twenty-breaks", k: [20, 20], sigma: 0.6, exact: false },
  { id: "fifty-breaks", k: [50, 50], sigma: 0.6, exact: false },
] as const;
type Cell = (typeof CELLS)[number];

const CREWS = [1, 2, 3, 4] as const;
const PREREGISTERED_STORMS = 200;
const STORMS = Number(process.argv[2] ?? PREREGISTERED_STORMS);
/** Pre-registration §8: the first primary storm with k = 6, at 2 crews. */
const HAND_CHECK = { cell: "primary", k: 6, crews: 2 } as const;

const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(
  ENGINE_ROOT,
  ".cache",
  "restoration-lab",
  `results-${STORMS}.json`,
);

const RULE_LABELS: Record<RestorationRule, string> = {
  "most-customers-now": "Most customers first",
  "critical-first": "Critical facilities first",
  "nearest-first": "Nearest first (travel not modelled)",
  "upstream-first": "Upstream first",
  "horn-order": "Horn-order",
  "horn-order-hindsight": "Horn-order (hindsight)",
};
const BEST_POSSIBLE = "Best possible (hindsight: knows the true repair times)";

if (!Number.isInteger(STORMS) || STORMS < 1 || STORMS > PREREGISTERED_STORMS) {
  throw new RangeError(
    `storms must be an integer in 1..${PREREGISTERED_STORMS}; got ${process.argv[2]}`,
  );
}

const log = (line: string) => process.stderr.write(`${line}\n`);
const seedOf = (i: number) => `restoration-lab/storm-${i}`;

interface StormRun {
  readonly storm: Storm;
  readonly problem: RepairProblem;
  readonly schedules: Readonly<Record<RestorationRule, Schedule>>;
  readonly costs: Readonly<Record<RestorationRule, number>>;
}

interface Summary {
  readonly median: number;
  readonly max: number;
}

function summary(values: readonly number[]): Summary | null {
  if (values.length === 0) return null;
  return { median: median(values), max: Math.max(...values) };
}

function configFor(
  cell: Cell,
  crews: number,
  rule: RestorationRule,
): RestorationConfig {
  const [min, max] = cell.k;
  return {
    ...DEFAULT_CONFIG,
    damagedSegments: { min, max },
    repair: { ...DEFAULT_CONFIG.repair, sigma: cell.sigma },
    horizonTicks: max * DEFAULT_CONFIG.repair.maxTicks + 1,
    crews,
    rule,
  };
}

/** Per seed, across cells with the same k range: the first cell's storm minus its repair ticks. */
const sigmaPaired = new Map<string, { cell: string; key: string }>();

/**
 * Every rule on storm i through the kernel. The storm must be byte-identical
 * across rules and crew counts (common random numbers), and identical but for
 * repair ticks across the k 6–12 cells (§5): otherwise throw.
 */
async function runStorm(
  cell: Cell,
  crews: number,
  i: number,
  stormJson: Map<number, string>,
): Promise<StormRun> {
  const schedules = {} as Record<RestorationRule, Schedule>;
  const costs = {} as Record<RestorationRule, number>;
  let storm: Storm | null = null;
  for (const rule of RESTORATION_RULES) {
    const { finalState } = await runSimulation(
      restorationAdapter,
      configFor(cell, crews, rule),
      seedOf(i),
      { observeEvery: 0 },
    );
    const json = JSON.stringify(finalState.storm);
    const first = stormJson.get(i);
    if (first === undefined) {
      stormJson.set(i, json);
      const pair = `k ${cell.k.join("–")}/${seedOf(i)}`;
      const key = sigmaPairingKey(finalState.storm);
      const paired = sigmaPaired.get(pair);
      if (paired === undefined) sigmaPaired.set(pair, { cell: cell.id, key });
      else if (key !== paired.key) {
        throw new Error(
          `${cell.id}: ${seedOf(i)} drew a different feeder, customers, critical or broken buses than in ${paired.cell}; only repair ticks may differ across σ`,
        );
      }
    } else if (json !== first) {
      throw new Error(
        `${cell.id}: ${seedOf(i)} drew a different storm under ${rule} at ${crews} crews`,
      );
    }
    storm = finalState.storm;
    schedules[rule] = finalState.schedule;
    costs[rule] = customerTicks(
      problemOf(finalState.storm),
      finalState.schedule.completion,
    );
  }
  return { storm: storm!, problem: problemOf(storm!), schedules, costs };
}

/** A storm's outcome plus everything its reference is resolved from, so the file alone re-derives every number. */
interface RecordedOutcome extends StormOutcome {
  readonly problem: RepairProblem;
  /** null where no MILP ran: 1 crew, and the k = 20 and k = 50 cells. */
  readonly milp: {
    readonly proven: boolean;
    readonly customerTicks: number | null;
  } | null;
  /** null with 1 crew, where Horn on `problem` is the reference. */
  readonly lpFloor: number | null;
}

interface CrewResult {
  readonly crews: number;
  readonly table: LabTable;
  /** Storms HiGHS proved; null where no MILP ran. */
  readonly provenCount: number | null;
  readonly solverSeconds: {
    readonly milp: Summary | null;
    readonly lp: Summary | null;
  };
  readonly outcomes: readonly RecordedOutcome[];
}

const solvers = new Set<string>();

async function runCrews(
  cell: Cell,
  crews: number,
  stormJson: Map<number, string>,
): Promise<{
  result: CrewResult;
  runs: StormRun[];
  optimum: OptimumResult[] | null;
}> {
  log(
    `[lab] ${cell.id} crews=${crews}: ${STORMS} storms × ${RESTORATION_RULES.length} rules`,
  );
  const runs: StormRun[] = [];
  for (let i = 0; i < STORMS; i++) {
    runs.push(await runStorm(cell, crews, i, stormJson));
  }

  let optimum: OptimumResult[] | null = null;
  let floor: number[] | null = null;
  let lpSeconds: number[] = [];
  if (crews > 1) {
    const problems = runs.map((r) => r.problem);
    const lp = await solveLpFloor(problems, crews, { onProgress: log });
    solvers.add(lp.solver);
    floor = lp.results.map((r) => r.customerTicks);
    lpSeconds = lp.results.map((r) => r.seconds);
    if (cell.exact) {
      const milp = await solveOptimum(problems, crews, { onProgress: log });
      solvers.add(milp.solver);
      optimum = [...milp.results];
    }
  }

  const outcomes = runs.map((run, i): RecordedOutcome => {
    const milp = optimum
      ? {
          proven: optimum[i]!.proven,
          customerTicks: optimum[i]!.customerTicks,
        }
      : null;
    const lpFloor = floor ? floor[i]! : null;
    return {
      customerTicks: run.costs,
      reference: resolveReference({
        crews,
        ruleCosts: run.costs,
        ...(crews === 1
          ? {
              horn: customerTicks(
                run.problem,
                listSchedule(run.problem, hornOrder(run.problem), 1).completion,
              ),
            }
          : {}),
        ...(milp ? { milp } : {}),
        ...(lpFloor !== null ? { lpFloor } : {}),
      }),
      problem: run.problem,
      milp,
      lpFloor,
    };
  });

  return {
    result: {
      crews,
      table: labTable(outcomes, `restoration-lab/${cell.id}/${crews}`),
      provenCount: optimum ? optimum.filter((r) => r.proven).length : null,
      solverSeconds: {
        milp: optimum ? summary(optimum.map((r) => r.seconds)) : null,
        lp: summary(lpSeconds),
      },
      outcomes,
    },
    runs,
    optimum,
  };
}

function scheduleView(problem: RepairProblem, schedule: Schedule) {
  const restored = restorationTicks(problem, schedule.completion);
  const ticks = customerTicks(problem, schedule.completion);
  return {
    segments: schedule.start.map((start, j) => ({
      segment: j,
      crew: schedule.crew[j]!,
      start,
      finish: schedule.completion[j]!,
      restoredAt: restored[j]!,
    })),
    customerTicks: ticks,
    customerHours: ticks * TICK_HOURS,
  };
}
type ScheduleView = ReturnType<typeof scheduleView>;

interface HandCheck {
  readonly seed: string;
  readonly cell: string;
  readonly crews: number;
  readonly storm: {
    readonly style: string;
    readonly feederParent: readonly number[];
    readonly customersAtBus: readonly number[];
    readonly segments: readonly {
      segment: number;
      bus: number;
      parent: number;
      ticks: number;
      customers: number;
    }[];
  };
  readonly mostCustomersNow: ScheduleView;
  readonly reference: Reference;
  /** Whether HiGHS proved the reference, or which rule's schedule became it. */
  readonly provenance: string;
  /** The reference's schedule; null when it is the LP floor, which has none. */
  readonly referenceSchedule: ScheduleView | null;
}

function handCheckOf(
  runs: readonly StormRun[],
  outcomes: readonly StormOutcome[],
  optimum: readonly OptimumResult[] | null,
): HandCheck | null {
  const i = runs.findIndex((r) => r.storm.segments.length === HAND_CHECK.k);
  if (i === -1) return null;
  const { storm, problem, schedules } = runs[i]!;
  const reference = outcomes[i]!.reference;
  let referenceSchedule: Schedule | null;
  let provenance: string;
  if (reference.kind === "floor") {
    referenceSchedule = null;
    provenance = `HiGHS did not prove this storm, so its reference is the LP floor, ${reference.customerTicks.toFixed(2)} customer-ticks, which has no schedule.`;
  } else if (reference.source === "milp") {
    referenceSchedule = optimum![i]!.schedule;
    provenance =
      "HiGHS proved this storm within its 1e-4 gap; its schedule, handed out again in its start order (pre-registration §9.3), is the reference.";
  } else if (reference.source === "rule") {
    referenceSchedule = schedules[reference.rule];
    provenance = `HiGHS proved this storm within its 1e-4 gap, but ${RULE_LABELS[reference.rule]}'s schedule costs less than HiGHS's, so it is the reference.`;
  } else {
    throw new Error(
      `the hand check runs at ${HAND_CHECK.crews} crews; Horn is the reference only at 1`,
    );
  }
  return {
    seed: seedOf(i),
    cell: HAND_CHECK.cell,
    crews: HAND_CHECK.crews,
    storm: {
      style: storm.style,
      feederParent: storm.feederParent,
      customersAtBus: storm.customersAtBus,
      segments: storm.segments.map((s, j) => ({
        segment: j,
        bus: s.bus,
        parent: s.parent,
        ticks: s.ticks,
        customers: s.customers,
      })),
    },
    mostCustomersNow: scheduleView(problem, schedules["most-customers-now"]),
    reference,
    provenance,
    referenceSchedule: referenceSchedule
      ? scheduleView(problem, referenceSchedule)
      : null,
  };
}

// ── Markdown ──────────────────────────────────────────────────────────────

const pct = (x: number) => `${x.toFixed(1)}%`;
const hours = (x: number) => x.toFixed(1);
const split = (w: { better: number; tied: number; worse: number }) =>
  `${w.better}/${w.tied}/${w.worse}`;
const row = (cells: readonly (string | number)[]) => `| ${cells.join(" | ")} |`;
const divider = (n: number) => row(new Array<string>(n).fill("---"));

function crewTable(result: CrewResult): string[] {
  const { table, crews, provenCount, solverSeconds } = result;
  const anyFloor = table.floorReferences > 0;
  const allFloor = table.exactReferences === 0;
  const header = [
    "Rule",
    "Mean customer-hours",
    anyFloor
      ? "Extra over best possible, at most [95% CI]"
      : "Extra over best possible [95% CI]",
    "Ties with best possible",
    "vs most customers first (better/tie/worse)",
    anyFloor ? "Median storm gap (at most)" : "Median storm gap",
  ];
  const referenceLabel = allFloor
    ? "LP floor"
    : anyFloor
      ? `${BEST_POSSIBLE}, or the LP floor on ${table.floorReferences} storms`
      : BEST_POSSIBLE;
  const lines = [
    `### ${crews} crew${crews === 1 ? "" : "s"}`,
    "",
    row(header),
    divider(header.length),
    row([
      referenceLabel,
      hours(table.referenceMeanCustomerHours),
      "—",
      "—",
      "—",
      "—",
    ]),
  ];
  for (const r of table.rows) {
    const extra = r.extraPercent
      ? `${pct(r.extraPercent.estimate)} [${pct(r.extraPercent.lower)}, ${pct(r.extraPercent.upper)}]`
      : "—";
    lines.push(
      row([
        RULE_LABELS[r.rule],
        hours(r.meanCustomerHours),
        extra,
        r.tiesWithReference === null
          ? "—"
          : `${r.tiesWithReference}/${table.exactReferences}`,
        r.rule === "most-customers-now" ? "—" : split(r.vsMostCustomersNow),
        pct(r.medianStormGapPercent),
      ]),
    );
  }
  lines.push(
    "",
    "Better / tie / worse count storms against most customers first; better means fewer customer-hours.",
    "",
  );
  if (crews === 1) {
    lines.push(
      "Reference: Horn's algorithm on the true repair times, exact for one crew.",
    );
  } else if (provenCount !== null) {
    const ruleRefs = result.outcomes.filter(
      (o) => o.reference.kind === "exact" && o.reference.source === "rule",
    ).length;
    lines.push(
      `HiGHS proved ${provenCount} of ${table.storms} storms within its 1e-4 gap (${TIME_LIMIT_SECONDS} s limit each); ${table.floorReferences} use the LP floor.` +
        (ruleRefs > 0
          ? ` On ${ruleRefs}, a rule's schedule came in under HiGHS's and is the reference.`
          : ""),
    );
  } else {
    lines.push(
      "Reference: the LP floor. No schedule costs less, so each gap is at most what is shown.",
    );
  }
  if (solverSeconds.milp || solverSeconds.lp) {
    const time = (name: string, s: Summary | null) =>
      s
        ? `${name} median ${s.median.toFixed(2)} s, max ${s.max.toFixed(2)} s`
        : null;
    lines.push(
      `Solver time per storm (not a result): ${[time("MILP", solverSeconds.milp), time("LP floor", solverSeconds.lp)].filter(Boolean).join("; ")}.`,
    );
  }
  lines.push("");
  return lines;
}

function pairwiseTable(result: CrewResult): string[] {
  const header = [
    "Rule (row) vs rule (column)",
    ...RESTORATION_RULES.map((_, n) => `${n + 1}`),
  ];
  return [
    `### ${result.crews} crew${result.crews === 1 ? "" : "s"}`,
    "",
    row(header),
    divider(header.length),
    ...RESTORATION_RULES.map((a, n) =>
      row([
        `${n + 1}. ${RULE_LABELS[a]}`,
        ...RESTORATION_RULES.map((b) => split(result.table.pairwise[a][b])),
      ]),
    ),
    "",
  ];
}

function scheduleTable(title: string, view: ScheduleView): string[] {
  return [
    `**${title}** — ${view.customerTicks} customer-ticks = ${hours(view.customerHours)} customer-hours`,
    "",
    row(["Segment", "Crew", "Start", "Finish", "Customers back at"]),
    divider(5),
    ...view.segments.map((s) =>
      row([s.segment, s.crew, s.start, s.finish, s.restoredAt]),
    ),
    "",
  ];
}

function handCheckMarkdown(hand: HandCheck | null): string[] {
  const lines = ["## Hand check", ""];
  if (!hand) {
    return [
      ...lines,
      `No storm in the ${HAND_CHECK.cell} cell had k = ${HAND_CHECK.k} among the first ${STORMS}.`,
      "",
    ];
  }
  const { storm } = hand;
  lines.push(
    `${hand.seed}, ${hand.cell} cell, ${hand.crews} crews: ${storm.segments.length} broken segments on a ${storm.feederParent.length}-bus ${storm.style} feeder.`,
    "Bus 0 is the substation; segments and crews are numbered from 0; one tick is 15 minutes.",
    "",
    `Feeder parent of each bus: ${JSON.stringify(storm.feederParent)}`,
    "",
    `Customers at each bus: ${JSON.stringify(storm.customersAtBus)}`,
    "",
    row([
      "Segment",
      "Line into bus",
      "Broken segment upstream",
      "Repair ticks",
      "Customers behind it (up to the next break)",
    ]),
    divider(5),
    ...storm.segments.map((s) =>
      row([
        s.segment,
        s.bus,
        s.parent === -1 ? "—" : s.parent,
        s.ticks,
        s.customers,
      ]),
    ),
    "",
    ...scheduleTable(RULE_LABELS["most-customers-now"], hand.mostCustomersNow),
    `Reference: ${hand.provenance}`,
    "",
  );
  if (hand.referenceSchedule) {
    lines.push(...scheduleTable(BEST_POSSIBLE, hand.referenceSchedule));
  }
  return lines;
}

// ── Run ───────────────────────────────────────────────────────────────────

const started = performance.now();
const cells: {
  id: string;
  k: readonly number[];
  sigma: number;
  crews: CrewResult[];
}[] = [];
let handCheck: HandCheck | null = null;

for (const cell of CELLS) {
  const stormJson = new Map<number, string>();
  const crewResults: CrewResult[] = [];
  for (const crews of CREWS) {
    const { result, runs, optimum } = await runCrews(cell, crews, stormJson);
    crewResults.push(result);
    if (cell.id === HAND_CHECK.cell && crews === HAND_CHECK.crews) {
      handCheck = handCheckOf(runs, result.outcomes, optimum);
    }
  }
  cells.push({ id: cell.id, k: cell.k, sigma: cell.sigma, crews: crewResults });
}

if (solvers.size > 1) {
  throw new Error(`the solver changed mid-run: ${[...solvers].join(", ")}`);
}
const solver = [...solvers][0] ?? null;
const commit = process.env.RESTORATION_LAB_COMMIT ?? "unknown";

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      prereg: "docs/RESTORATION-LAB-PREREG.md",
      commit,
      storms: STORMS,
      solver,
      cells,
      handCheck,
    },
    null,
    2,
  ) + "\n",
);

const md: string[] = [
  "# Repair-order lab: tables",
  "",
  `${STORMS} storms per cell (seeds ${seedOf(0)} … ${seedOf(STORMS - 1)}), shared by every rule and crew count. Commit ${commit}. Solver: ${solver ?? "none"}.`,
  "Customer-hours: customers × hours without power, mean per storm. Every reference is hindsight: it knows the true repair times.",
  "",
];
for (const [c, cell] of CELLS.entries()) {
  md.push(
    `## ${cell.id}: k ${cell.k[0] === cell.k[1] ? cell.k[0] : `${cell.k[0]}–${cell.k[1]}`}, σ ${cell.sigma}`,
    "",
  );
  for (const result of cells[c]!.crews) md.push(...crewTable(result));
}
md.push(
  "## Primary cell, rule against rule",
  "",
  "Storms where the row rule costs fewer / the same / more customer-hours than the column rule.",
  "",
);
for (const result of cells[0]!.crews) md.push(...pairwiseTable(result));
md.push(...handCheckMarkdown(handCheck));
process.stdout.write(md.join("\n"));

log(
  `[lab] done in ${((performance.now() - started) / 1000).toFixed(0)} s; wrote ${relative(ENGINE_ROOT, OUT)}`,
);
