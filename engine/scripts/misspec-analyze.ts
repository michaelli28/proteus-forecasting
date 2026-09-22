/**
 * SPIKE: score the misspecification check from saved misspec-data.ts output.
 *
 *   tune   <doseDir>                     — dev-seed grid: channels × t0, bandwidth, blind threshold
 *   report <doseDir> <armsDir> <prereg>  — the pre-registered tables, as text and JSON
 *
 * Every number here is a local run on the synthetic oracle.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Rng } from "../src/sim/rng.js";
import {
  abcWeights,
  effectiveSampleSize,
  mahalanobisTo,
  minPCombined,
  pooledMahalanobis,
  rankPValue,
  weightedBandForecast,
} from "../src/metrics/rank-check.js";
import { uniformPartition } from "../src/evidence/partition.js";

type Member = {
  riskTolerance: number;
  escalationPropensity: number;
  features: number[][];
  outcome: number;
};
type QuestionData = {
  id: string;
  arm: string;
  looks: number[];
  channels: string[];
  truths: Record<string, Member>;
  draws: Member[];
  pipeline?: {
    abstained: boolean;
    probabilities: number[] | null;
    bands: [number, number][];
  };
};
type Prereg = {
  channels: string[];
  primaryT0: number;
  anyLooks: number[];
  bandwidth: number;
  blindThreshold: number;
};

const ALPHA = 0.05;
const DELTAS = [0, 3, 6, 12, 24, 30];
const POWER_DELTAS = [6, 12, 24, 30];
const RESOLVE_AT = 119;
const BANDS = uniformPartition({ min: 0.35, max: 0.65 }, 4, () => "");

function load(dir: string): QuestionData[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as QuestionData);
}

/** The benchmark's band rule: half-open bands, the last one closed at the top. */
function bandOf(value: number): number | null {
  for (let i = 0; i < BANDS.length; i++) {
    const b = BANDS[i]!;
    const last = i === BANDS.length - 1;
    if (value >= b.lower && (last ? value <= b.upper : value < b.upper))
      return i;
  }
  return null;
}

function vectors(
  q: QuestionData,
  truth: Member,
  look: number,
  channels: readonly string[],
): number[][] {
  const li = q.looks.indexOf(look);
  if (li < 0) throw new Error(`look ${look} not recorded`);
  const ci = channels.map((c) => q.channels.indexOf(c));
  return [truth, ...q.draws].map((m) => ci.map((c) => m.features[li]![c]!));
}

function pAt(
  q: QuestionData,
  truth: Member,
  look: number,
  channels: readonly string[],
): number {
  return rankPValue(pooledMahalanobis(vectors(q, truth, look, channels)), 0);
}

function pAny(
  q: QuestionData,
  truth: Member,
  looks: readonly number[],
  channels: readonly string[],
): number {
  return minPCombined(
    looks.map((t) => pooledMahalanobis(vectors(q, truth, t, channels))),
    0,
  );
}

function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const rate = (k: number, n: number) => {
  const [lo, hi] = wilson(k, n);
  return `${k}/${n} [${pct(lo)},${pct(hi)}]`;
};

/** One-vs-rest Brier for one question: Σ_k (p_k − o_k)² / B, as the benchmark scores. */
function brier(probabilities: readonly number[], outcomeBand: number): number {
  return (
    probabilities.reduce(
      (s, p, k) => s + (p - (k === outcomeBand ? 1 : 0)) ** 2,
      0,
    ) / probabilities.length
  );
}

/** Brier of always saying 1/B, the benchmark's "base rate" reference. */
const REFERENCE_BRIER = (1 / BANDS.length) * (1 - 1 / BANDS.length);

/** The pre-registered telemetry-weighted forecast (same draws, kernel, smoothing). */
function weightedProbabilities(
  q: QuestionData,
  truth: Member,
  prereg: Prereg,
): number[] {
  const bands = q.draws.map((d) => bandOf(d.outcome));
  const d2 = mahalanobisTo(
    vectors(q, truth, prereg.primaryT0, prereg.channels),
    0,
  ).slice(1);
  return weightedBandForecast(bands, abcWeights(d2, prereg.bandwidth), 4);
}

function forecasts(q: QuestionData, truth: Member, prereg: Prereg) {
  const truthBand = bandOf(truth.outcome);
  if (truthBand === null) return null;
  const bands = q.draws.map((d) => bandOf(d.outcome));
  const d2 = mahalanobisTo(
    vectors(q, truth, prereg.primaryT0, prereg.channels),
    0,
  ).slice(1);
  const weights = abcWeights(d2, prereg.bandwidth);
  const resolvedWeights = weights.filter((_, i) => bands[i] !== null);
  const ess = effectiveSampleSize(resolvedWeights);
  // Control (added after the pre-registered run): the unweighted shares under
  // the same ESS-scaled smoothing. Weighted minus this is what the telemetry
  // itself contributes; the rest is smoothing pulling toward uniform.
  const resolved = bands.filter((b): b is number => b !== null);
  const shrink = [0, 1, 2, 3].map(
    (k) =>
      (ess * (resolved.filter((b) => b === k).length / resolved.length) + 1) /
      (ess + 4),
  );
  return {
    unweighted: brier(
      weightedBandForecast(bands, new Array(bands.length).fill(1), 4),
      truthBand,
    ),
    weighted: brier(weightedBandForecast(bands, weights, 4), truthBand),
    shrinkOnly: brier(shrink, truthBand),
    ess,
  };
}

function bootstrapMean(
  values: readonly number[],
  seed: string,
): [number, number] {
  const rng = new Rng(seed);
  const means: number[] = [];
  for (let b = 0; b < 2000; b++) {
    let s = 0;
    for (let i = 0; i < values.length; i++)
      s += values[Math.floor(rng.next() * values.length)]!;
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[49]!, means[1949]!];
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? NaN : xs.reduce((s, x) => s + x, 0) / xs.length;

// ─── tune ───

function tune(doseDir: string) {
  const qs = load(doseDir);
  const looks = qs[0]!.looks.filter((t) => t > 9);
  const channelSets: Record<string, string[]> = {
    all4: ["burstiness", "surgeRatio", "hubConcentration", "clusterSynchrony"],
    "burst+surge": ["burstiness", "surgeRatio"],
  };
  const out: string[] = [
    `TUNE on ${qs.length} dev questions, N = ${qs[0]!.draws.length} draws, α = ${ALPHA}`,
    `power averaged over δ ∈ {${POWER_DELTAS.join(",")}}; δ=0 is the false-alarm arm`,
    "",
  ];
  const grid: { set: string; t0: number; meanPower: number; fa: number }[] = [];
  for (const [name, chans] of Object.entries(channelSets)) {
    out.push(`channels ${name}`);
    for (const t0 of looks) {
      const alarms = DELTAS.map(
        (d) =>
          qs.filter((q) => pAt(q, q.truths[`delta-${d}`]!, t0, chans) <= ALPHA)
            .length,
      );
      const meanPower =
        mean(POWER_DELTAS.map((d) => alarms[DELTAS.indexOf(d)]!)) / qs.length;
      grid.push({ set: name, t0, meanPower, fa: alarms[0]! / qs.length });
      out.push(
        `  t0=${String(t0).padEnd(4)} ` +
          DELTAS.map((d, i) => `δ${d}:${alarms[i]}`.padEnd(8)).join("") +
          `mean power ${pct(meanPower)}`,
      );
    }
    const anyLooks = [20, 40, 60, 80];
    const anyAlarms = DELTAS.map(
      (d) =>
        qs.filter(
          (q) => pAny(q, q.truths[`delta-${d}`]!, anyLooks, chans) <= ALPHA,
        ).length,
    );
    out.push(
      `  any-look {${anyLooks.join(",")}} ` +
        DELTAS.map((d, i) => `δ${d}:${anyAlarms[i]}`.padEnd(8)).join(""),
    );
  }

  out.push(
    "",
    "ABC bandwidth on δ=0 (well-specified): mean Brier, weighted vs unweighted, same draws",
  );
  const best = [...grid].sort(
    (a, b) =>
      b.meanPower - a.meanPower ||
      a.t0 - b.t0 ||
      channelSets[a.set]!.length - channelSets[b.set]!.length,
  )[0]!;
  for (const h of [0.5, 1, 2, 4, 8]) {
    const pre: Prereg = {
      channels: channelSets[best.set]!,
      primaryT0: best.t0,
      anyLooks: [],
      bandwidth: h,
      blindThreshold: 0,
    };
    const rows = qs
      .map((q) => forecasts(q, q.truths["delta-0"]!, pre))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    out.push(
      `  h=${String(h).padEnd(4)} weighted ${mean(rows.map((r) => r.weighted)).toFixed(4)}  unweighted ${mean(rows.map((r) => r.unweighted)).toFixed(4)}  median ESS ${rows
        .map((r) => r.ess)
        .sort((a, b) => a - b)
        [Math.floor(rows.length / 2)]!.toFixed(1)}  (n=${rows.length})`,
    );
  }

  out.push(
    "",
    "blind-spot thresholds: pipeline-forecast Brier vs δ=0, and unresolved truths",
  );
  for (const key of [
    "delta-0",
    "blind-0.5",
    "blind-0.55",
    "blind-0.65",
    "blind-0.7",
  ]) {
    const scored = qs
      .map((q) => {
        const band = bandOf(q.truths[key]!.outcome);
        return band === null || !q.pipeline?.probabilities
          ? null
          : brier(q.pipeline.probabilities, band);
      })
      .filter((b): b is number => b !== null);
    out.push(
      `  ${key.padEnd(11)} Brier ${mean(scored).toFixed(4)}  skill ${(1 - mean(scored) / REFERENCE_BRIER).toFixed(3)}  unresolved ${qs.length - scored.length}/${qs.length}`,
    );
  }
  out.push(
    "",
    `selection rule → channels ${best.set}, primary t0 ${best.t0} (mean power ${pct(best.meanPower)})`,
  );
  process.stdout.write(out.join("\n") + "\n");
}

// ─── report ───

function report(doseDir: string, armsDir: string, preregPath: string) {
  const pre = JSON.parse(readFileSync(preregPath, "utf8")) as Prereg;
  const dose = load(doseDir);
  const arms = load(armsDir);
  const N = dose[0]!.draws.length;
  const out: string[] = [
    `REPORT — pre-registered: channels [${pre.channels.join(", ")}], primary t0 ${pre.primaryT0} (${RESOLVE_AT - pre.primaryT0} ticks before resolution), any-look {${pre.anyLooks.join(",")}}, h ${pre.bandwidth}, blind threshold ${pre.blindThreshold}`,
    `${dose.length} dose questions, ${arms.length} well-specified questions, N = ${N} draws, α = ${ALPHA}`,
    "",
    "1. Dose–response (same root seeds; δ = 30 is the benchmark's misspecified arm)",
    "   δ     old gate   check @t0            any-look             control t0=9   pipeline Brier  skill    ΔBrier vs δ0  unresolved",
  ];
  const json: Record<string, unknown> = { prereg: pre, N };
  const doseRows = [];
  const brier0 = new Map<string, number>();
  for (const d of DELTAS) {
    const key = `delta-${d}`;
    const primary = dose.map((q) =>
      pAt(q, q.truths[key]!, pre.primaryT0, pre.channels),
    );
    const any = dose.map((q) =>
      pAny(q, q.truths[key]!, pre.anyLooks, pre.channels),
    );
    const control = dose.map((q) => pAt(q, q.truths[key]!, 9, pre.channels));
    const gate = dose.filter((q) => q.pipeline?.abstained).length;
    const scored = dose
      .map((q) => {
        const band = bandOf(q.truths[key]!.outcome);
        return band === null || !q.pipeline?.probabilities
          ? null
          : { id: q.id, b: brier(q.pipeline.probabilities, band) };
      })
      .filter((x): x is { id: string; b: number } => x !== null);
    if (d === 0) scored.forEach((s) => brier0.set(s.id, s.b));
    const paired = scored
      .filter((s) => brier0.has(s.id))
      .map((s) => s.b - brier0.get(s.id)!);
    const k = primary.filter((p) => p <= ALPHA).length;
    const kAny = any.filter((p) => p <= ALPHA).length;
    const kCtl = control.filter((p) => p <= ALPHA).length;
    const b = mean(scored.map((s) => s.b));
    doseRows.push({
      delta: d,
      gate,
      alarms: k,
      anyAlarms: kAny,
      controlAlarms: kCtl,
      n: dose.length,
      brier: b,
      skill: 1 - b / REFERENCE_BRIER,
      deltaBrier: mean(paired),
      unresolved: dose.length - scored.length,
      pValues: primary,
    });
    out.push(
      `   ${String(d).padEnd(5)} ${`${gate}/${dose.length}`.padEnd(10)} ${rate(k, dose.length).padEnd(20)} ${rate(kAny, dose.length).padEnd(20)} ${`${kCtl}/${dose.length}`.padEnd(14)} ${b.toFixed(4).padEnd(15)} ${(1 - b / REFERENCE_BRIER).toFixed(3).padEnd(8)} ${(d === 0 ? "—" : (mean(paired) >= 0 ? "+" : "") + mean(paired).toFixed(4)).padEnd(13)} ${dose.length - scored.length}`,
    );
  }
  json.dose = doseRows;
  const top = doseRows.find((r) => r.delta === 30)!;
  const mcnemar = Math.min(1, 2 * 0.5 ** top.alarms);
  out.push(
    "",
    `   Paired headline at δ=30: old gate ${top.gate}/${top.n} → check ${top.alarms}/${top.n} on the same questions (exact McNemar p = ${mcnemar.toExponential(2)}).`,
  );

  out.push(
    "",
    `2. Blind spot — truth counts adoption at ${pre.blindThreshold} instead of 0.6; parameters and seed as δ=0`,
  );
  const blindKey = `blind-${pre.blindThreshold}`;
  const blindP = dose.map((q) =>
    pAt(q, q.truths[blindKey]!, pre.primaryT0, pre.channels),
  );
  const zeroP = doseRows[0]!.pValues;
  const identical = blindP.every((p, i) => p === zeroP[i]);
  const blindScored = dose
    .map((q) => {
      const band = bandOf(q.truths[blindKey]!.outcome);
      return band === null || !q.pipeline?.probabilities
        ? null
        : { id: q.id, b: brier(q.pipeline.probabilities, band) };
    })
    .filter((x): x is { id: string; b: number } => x !== null);
  const blindB = mean(blindScored.map((s) => s.b));
  const blindPaired = blindScored
    .filter((s) => brier0.has(s.id))
    .map((s) => s.b - brier0.get(s.id)!);
  const kBlind = blindP.filter((p) => p <= ALPHA).length;
  out.push(
    `   check alarms ${rate(kBlind, dose.length)}; p-values identical to δ=0 on every question: ${identical}`,
    `   pipeline Brier ${blindB.toFixed(4)} (skill ${(1 - blindB / REFERENCE_BRIER).toFixed(3)}), ΔBrier vs δ0 +${mean(blindPaired).toFixed(4)}, unresolved ${dose.length - blindScored.length}/${dose.length}`,
  );
  json.blind = {
    threshold: pre.blindThreshold,
    alarms: kBlind,
    n: dose.length,
    identicalToDelta0: identical,
    brier: blindB,
    skill: 1 - blindB / REFERENCE_BRIER,
    deltaBrier: mean(blindPaired),
    unresolved: dose.length - blindScored.length,
  };

  out.push(
    "",
    `3. Rank histogram at primary t0 — well-specified arms (p-values in tenths; uniform expected)`,
  );
  const histo: Record<string, number[]> = {};
  const byArm: Record<string, number[]> = { "δ=0 (dose seeds)": zeroP };
  for (const arm of ["narrow", "medium", "wide-control"]) {
    byArm[arm] = arms
      .filter((q) => q.arm === arm)
      .map((q) => pAt(q, q.truths.truth!, pre.primaryT0, pre.channels));
  }
  const pooled = Object.values(byArm).flat();
  byArm["all well-specified"] = pooled;
  for (const [name, ps] of Object.entries(byArm)) {
    const counts = new Array(10).fill(0);
    for (const p of ps) counts[Math.min(9, Math.ceil(p * 10) - 1)]++;
    const expected = ps.length / 10;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    const alarms = ps.filter((p) => p <= ALPHA).length;
    histo[name] = counts;
    out.push(
      `   ${name.padEnd(20)} ${counts.map((c) => String(c).padStart(3)).join(" ")}   χ²=${chi2.toFixed(1)} (df 9, 5% critical 16.9)   alarms ${rate(alarms, ps.length)}`,
    );
  }
  json.histogram = histo;
  json.falseAlarms = {
    alarms: pooled.filter((p) => p <= ALPHA).length,
    n: pooled.length,
    // The rank argument's bound for N draws: ⌊α(N+1)⌋/(N+1).
    bound: Math.floor(ALPHA * (N + 1)) / (N + 1),
  };

  out.push(
    "",
    `4. Reweighting by early telemetry (h = ${pre.bandwidth}), weighted vs unweighted on the SAME ${N} draws`,
  );
  const abcRows: Record<string, unknown> = {};
  const abcSets: [string, QuestionData[], string][] = [
    ["narrow", arms.filter((q) => q.arm === "narrow"), "truth"],
    ["medium", arms.filter((q) => q.arm === "medium"), "truth"],
    ["wide-control", arms.filter((q) => q.arm === "wide-control"), "truth"],
    ["δ=0", dose, "delta-0"],
    ["δ=12", dose, "delta-12"],
    ["δ=30 (misspecified)", dose, "delta-30"],
  ];
  for (const [name, qs, key] of abcSets) {
    const rows = qs
      .map((q) => forecasts(q, q.truths[key]!, pre))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const diffs = rows.map((r) => r.weighted - r.unweighted);
    const [lo, hi] = bootstrapMean(diffs, `abc/${name}`);
    const ess = rows.map((r) => r.ess).sort((a, b) => a - b);
    const vsShrink = rows.map((r) => r.weighted - r.shrinkOnly);
    const [slo, shi] = bootstrapMean(vsShrink, `abc-shrink/${name}`);
    abcRows[name] = {
      n: rows.length,
      weighted: mean(rows.map((r) => r.weighted)),
      unweighted: mean(rows.map((r) => r.unweighted)),
      diff: mean(diffs),
      ci: [lo, hi],
      shrinkOnly: mean(rows.map((r) => r.shrinkOnly)),
      diffVsShrink: mean(vsShrink),
      ciVsShrink: [slo, shi],
      essMedian: ess[Math.floor(ess.length / 2)],
      essMin: ess[0],
    };
    out.push(
      `   ${name.padEnd(20)} n=${String(rows.length).padEnd(3)} weighted ${mean(rows.map((r) => r.weighted)).toFixed(4)}  unweighted ${mean(rows.map((r) => r.unweighted)).toFixed(4)}  Δ ${mean(diffs) >= 0 ? "+" : ""}${mean(diffs).toFixed(4)} [${lo.toFixed(4)}, ${hi.toFixed(4)}]  ESS median ${ess[Math.floor(ess.length / 2)]!.toFixed(1)}, min ${ess[0]!.toFixed(1)}`,
      `   ${"".padEnd(20)}       shrink-only control ${mean(rows.map((r) => r.shrinkOnly)).toFixed(4)}  weighted − control ${mean(vsShrink) >= 0 ? "+" : ""}${mean(vsShrink).toFixed(4)} [${slo.toFixed(4)}, ${shi.toFixed(4)}]`,
    );
  }
  out.push(
    `   (flat 1/4 forecast: Brier ${REFERENCE_BRIER.toFixed(4)}. "shrink-only control" and "weighted − control" were added after the pre-registered run.)`,
  );
  json.abc = abcRows;

  // ─── Exploratory, NOT pre-registered: added after review of the report ───
  out.push(
    "",
    "5. EXPLORATORY (not pre-registered). Power and ΔBrier by prior box, primary t0",
  );
  const byBox = new Map<string, QuestionData[]>();
  for (const q of dose) {
    const p = (
      q as unknown as {
        prior: { riskRange: number[]; escalationRange: number[] };
      }
    ).prior;
    const key = `(${(p.riskRange[0]! + p.riskRange[1]!) / 2},${(p.escalationRange[0]! + p.escalationRange[1]!) / 2})`;
    byBox.set(key, [...(byBox.get(key) ?? []), q]);
  }
  const boxRows: Record<string, unknown> = {};
  for (const [box, qs] of byBox) {
    const cells = DELTAS.map((d) => {
      const key = `delta-${d}`;
      const k = qs.filter(
        (q) => pAt(q, q.truths[key]!, pre.primaryT0, pre.channels) <= ALPHA,
      ).length;
      const paired = qs
        .map((q) => {
          const band = bandOf(q.truths[key]!.outcome);
          return band === null ||
            !q.pipeline?.probabilities ||
            !brier0.has(q.id)
            ? null
            : brier(q.pipeline.probabilities, band) - brier0.get(q.id)!;
        })
        .filter((x): x is number => x !== null);
      return { delta: d, alarms: k, n: qs.length, deltaBrier: mean(paired) };
    });
    boxRows[box] = cells;
    out.push(
      `   box ${box.padEnd(9)} ` +
        cells
          .map((c) =>
            `δ${c.delta}:${c.alarms}/${c.n}${c.delta === 0 ? "" : ` (${c.deltaBrier >= 0 ? "+" : ""}${c.deltaBrier.toFixed(3)})`}`.padEnd(
              19,
            ),
          )
          .join(""),
    );
  }
  json.byBox = boxRows;

  const untouched = (q: QuestionData) => Number(q.id.split("-").pop()) > 20;
  const fresh = dose.filter(untouched);
  const freshAlarms = (key: string) =>
    fresh.filter(
      (q) => pAt(q, q.truths[key]!, pre.primaryT0, pre.channels) <= ALPHA,
    ).length;
  const rightFresh = [
    ...fresh.map((q) =>
      pAt(q, q.truths["delta-0"]!, pre.primaryT0, pre.channels),
    ),
    ...arms
      .filter((q) => !(q.arm === "narrow" && !untouched(q)))
      .map((q) => pAt(q, q.truths.truth!, pre.primaryT0, pre.channels)),
  ];
  const rightFreshAlarms = rightFresh.filter((p) => p <= ALPHA).length;
  out.push(
    "",
    "6. EXPLORATORY. Questions the Day-1 pilot never touched (misspecified and narrow 21–80)",
    `   δ=30: old gate 0/${fresh.length} → check ${rate(freshAlarms("delta-30"), fresh.length)}`,
    `   right prior: false alarms ${rate(rightFreshAlarms, rightFresh.length)}`,
  );
  json.untouched = {
    delta30: freshAlarms("delta-30"),
    n: fresh.length,
    rightPriorAlarms: rightFreshAlarms,
    rightPriorN: rightFresh.length,
  };

  process.stdout.write(out.join("\n") + "\n");
  return json;
}

// ─── abstain (Days 5–6, not pre-registered) ───

/**
 * Risk–coverage for four abstention rules on the dose questions at every δ,
 * each scored with the shipped forecast. Abstaining is priced by what a user
 * who gets no answer falls back to — the flat 1/4 forecast — so its cost on a
 * question is Brier(flat) − Brier(forecast): positive means the forecast was
 * better and abstaining lost accuracy, negative means abstaining avoided harm.
 */
function abstain(doseDir: string, preregPath: string) {
  const pre = JSON.parse(readFileSync(preregPath, "utf8")) as Prereg;
  const dose = load(doseDir);
  type Case = {
    delta: number;
    maxP: number;
    weightedMaxP: number;
    alarm: boolean;
    gate: boolean;
    brier: number;
  };
  const cases: Case[] = [];
  let unresolved = 0;
  for (const q of dose) {
    const probabilities = q.pipeline!.probabilities!;
    for (const delta of DELTAS) {
      const truth = q.truths[`delta-${delta}`]!;
      const band = bandOf(truth.outcome);
      if (band === null) {
        unresolved++;
        continue;
      }
      cases.push({
        delta,
        maxP: Math.max(...probabilities),
        weightedMaxP: Math.max(...weightedProbabilities(q, truth, pre)),
        alarm: pAt(q, truth, pre.primaryT0, pre.channels) <= ALPHA,
        gate: q.pipeline!.abstained,
        brier: brier(probabilities, band),
      });
    }
  }

  const describe = (name: string, abstains: (c: Case) => boolean) => {
    const cells = [
      ["all δ", cases],
      ["δ=0", cases.filter((c) => c.delta === 0)],
      ["δ=12", cases.filter((c) => c.delta === 12)],
      ["δ=24", cases.filter((c) => c.delta === 24)],
      ["δ=30", cases.filter((c) => c.delta === 30)],
    ] as const;
    return (
      `   ${name.padEnd(26)}` +
      cells
        .map(([, cs]) => {
          const off = cs.filter(abstains);
          const on = cs.filter((c) => !abstains(c));
          const risk = mean(on.map((c) => c.brier));
          const cost =
            off.reduce((s, c) => s + (REFERENCE_BRIER - c.brier), 0) /
            cs.length;
          return `${pct(on.length / cs.length).padStart(5)} ${(Number.isNaN(risk) ? "—" : risk.toFixed(4)).padStart(7)} ${(cost >= 0 ? "+" : "") + cost.toFixed(4)}`.padEnd(
            24,
          );
        })
        .join("")
    );
  };

  const taus = [...new Set(cases.map((c) => c.maxP))].sort((a, b) => a - b);
  const out = [
    `ABSTENTION (not pre-registered): ${cases.length} resolved question×δ cases from ${dose.length} dose questions (${unresolved} unresolved dropped), shipped forecast, check at t0=${pre.primaryT0}`,
    "   Columns per slice: answered share, mean Brier on answered, cost of abstaining per question",
    "   (cost = mean over ALL cases of [flat 0.1875 − forecast Brier] on the abstained ones; negative = abstaining helped)",
    "",
    `   ${"rule".padEnd(26)}${"all δ (equal mix)".padEnd(24)}${"δ=0 (model right)".padEnd(24)}${"δ=12".padEnd(24)}${"δ=24".padEnd(24)}${"δ=30".padEnd(24)}`,
    describe("old gate", (c) => c.gate),
    describe("never abstain", () => false),
    ...taus
      .filter((_, i) => i % Math.max(1, Math.floor(taus.length / 6)) === 0)
      .slice(1)
      .map((tau) => describe(`Chow τ=${tau.toFixed(3)}`, (c) => c.maxP < tau)),
    describe("check alarm", (c) => c.alarm),
    describe(`check or Chow τ=0.600`, (c) => c.alarm || c.maxP < 0.6),
    describe(`check or Chow τ=0.686`, (c) => c.alarm || c.maxP < 0.686),
    "   post-hoc, found by review: Chow on the forecast reweighted by the same t0 telemetry (h from the pre-registration)",
    describe(`weighted Chow τ=0.500`, (c) => c.weightedMaxP < 0.5),
    describe(`weighted Chow τ=0.550`, (c) => c.weightedMaxP < 0.55),
  ];
  const maxPs = [
    ...new Set(dose.map((q) => Math.max(...q.pipeline!.probabilities!))),
  ];
  out.push(
    "",
    `   The shipped forecast does not use the early telemetry the check reads, so Chow's rule on it abstains on the same`,
    `   questions at every δ. That is true by construction, not a finding about confidence-based abstention: Chow on the`,
    `   telemetry-weighted forecast (post-hoc rows, τ picked after seeing the data) does about as well as the check.`,
    `   What the check has that those rows lack is a false-alarm rate fixed in advance by the rank argument.`,
    `   ${maxPs.length} distinct shipped max-p̂ values across ${dose.length} questions.`,
  );
  process.stdout.write(out.join("\n") + "\n");
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "tune") tune(rest[0]!);
else if (mode === "report") {
  const json = report(rest[0]!, rest[1]!, rest[2]!);
  if (rest[3]) writeFileSync(rest[3], JSON.stringify(json, null, 2) + "\n");
} else if (mode === "abstain") abstain(rest[0]!, rest[1]!);
else
  throw new Error(
    "usage: misspec-analyze.ts tune <doseDir> | report <doseDir> <armsDir> <prereg.json> [out.json] | abstain <doseDir> <prereg.json>",
  );
