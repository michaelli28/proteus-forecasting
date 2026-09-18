/**
 * SPIKE: do the published mitigation rankings survive 200 shared seeds?
 *
 * `dashboard/data/arm-comparisons.json` ranks each pack's mitigations by the
 * median harm over six seeds. This first reproduces those six-seed arrays
 * exactly, then replays every arm on 200 seeds shared across arms (common
 * random numbers) and reports, per mitigation against no mitigation: seeds won /
 * tied / lost, the paired mean harm difference with a 95% seed-bootstrap
 * interval, and the ranking by mean and by median.
 *
 *   node --import tsx scripts/mitigation-rerun.ts [seeds] [out.json]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { compareArms } from "../src/scenario/compare-arms.js";
import { stratifiedBootstrap } from "../src/metrics/bootstrap.js";
import { Rng } from "../src/sim/rng.js";
import type { ArmComparison } from "../src/scenario/compare-arms.js";

const SEEDS = Number(process.argv[2] ?? 200);
const OUT = process.argv[3];

const published = JSON.parse(
  readFileSync(
    new URL("../../dashboard/data/arm-comparisons.json", import.meta.url),
    "utf8",
  ),
) as ArmComparison[];

const mean = (xs: readonly number[]) =>
  xs.reduce((s, x) => s + x, 0) / xs.length;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const fmt = (x: number) =>
  Math.abs(x) >= 1e6
    ? `${(x / 1e6).toFixed(2)}M`
    : Math.abs(x) >= 1e3
      ? `${(x / 1e3).toFixed(1)}k`
      : x.toFixed(0);

/** Two-sided exact sign test on wins vs losses, ties dropped. */
function signTest(wins: number, losses: number): number {
  const n = wins + losses;
  if (n === 0) return 1;
  const k = Math.min(wins, losses);
  let tail = 0;
  let c = 1; // C(n, 0)
  for (let i = 0; i <= k; i++) {
    tail += c;
    c = (c * (n - i)) / (i + 1);
  }
  return Math.min(1, (2 * tail) / 2 ** n);
}

const lines: string[] = [];
const json: unknown[] = [];
for (const pub of published) {
  const reproduced = await compareArms({
    pack: pub.pack,
    actorId: pub.actorId,
    actorLabel: pub.actorLabel,
    seeds: pub.seeds,
  });
  const same =
    JSON.stringify(reproduced.baseline.harm) ===
      JSON.stringify(pub.baseline.harm) &&
    pub.defended.every(
      (d) =>
        JSON.stringify(
          reproduced.defended.find((r) => r.label === d.label)?.harm,
        ) === JSON.stringify(d.harm),
    );

  const seeds = Array.from({ length: SEEDS }, (_, i) => `crn-${i}`);
  const rerun = await compareArms({
    pack: pub.pack,
    actorId: pub.actorId,
    actorLabel: pub.actorLabel,
    seeds,
  });
  const base = rerun.baseline.harm;

  lines.push(
    "",
    `${pub.pack} vs ${pub.actorLabel} (${pub.actorId}) — harm in ${pub.harmUnit}; six-seed arrays reproduced exactly: ${same}`,
    `   no mitigation: mean ${fmt(mean(base))}, median ${fmt(rerun.baseline.median)}, zero-harm seeds ${base.filter((h) => h === 0).length}/${SEEDS}`,
    `   mitigation                                   published (6 seeds)      re-run (${SEEDS} seeds): won/tied/lost   sign-test p   mean Δ harm [95% CI]            median`,
  );
  const rows = pub.defended.map((d, publishedRank) => {
    const arm = rerun.defended.find((r) => r.label === d.label)!;
    const diffs = arm.harm.map((h, i) => h - base[i]!);
    const wins = diffs.filter((x) => x < 0).length;
    const ties = diffs.filter((x) => x === 0).length;
    const losses = diffs.filter((x) => x > 0).length;
    const ci = stratifiedBootstrap(
      diffs.map((value) => ({ value })),
      {
        stratumOf: () => "seeds",
        statistic: (s) => mean(s.map((x) => x.value)),
        seed: `mitigation/${pub.pack}/${d.label}`,
      },
    )!;
    return {
      label: d.label,
      publishedRank: publishedRank + 1,
      publishedMedian: d.median,
      publishedBeat: d.beatBaseline,
      wins,
      ties,
      losses,
      signP: signTest(wins, losses),
      meanDiff: ci.estimate,
      ci: [ci.lower, ci.upper],
      mean: mean(arm.harm),
      median: arm.median,
    };
  });
  const byMean = [...rows].sort((a, b) => a.mean - b.mean).map((r) => r.label);
  const byMedian = [...rows]
    .sort((a, b) => a.median - b.median)
    .map((r) => r.label);
  for (const r of rows) {
    lines.push(
      `   ${`${r.publishedRank}. ${r.label}`.padEnd(45)}median ${fmt(r.publishedMedian).padEnd(8)} beat ${r.publishedBeat}/6   ${`${r.wins}/${r.ties}/${r.losses}`.padEnd(34)}${r.signP.toExponential(1).padEnd(14)}${`${fmt(r.meanDiff)} [${fmt(r.ci[0]!)}, ${fmt(r.ci[1]!)}]`.padEnd(32)}${fmt(r.median)}`,
    );
  }
  const publishedOrder = rows.map((r) => r.label);
  lines.push(
    `   rank by mean over ${SEEDS}:   ${byMean.map((l) => publishedOrder.indexOf(l) + 1).join(" > ")}   (published order = 1 > 2 > 3 > 4)`,
    `   rank by median over ${SEEDS}: ${byMedian.map((l) => publishedOrder.indexOf(l) + 1).join(" > ")}`,
  );

  // Rankings compare mitigations with each other, so the intervals that
  // matter are head-to-head on the same seeds, and how often each would come
  // out on top if the seeds were drawn again.
  const harmOf = (label: string) =>
    rerun.defended.find((r) => r.label === label)!.harm;
  const rank = (label: string) => publishedOrder.indexOf(label) + 1;
  const median = (xs: readonly number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  const rng = new Rng(`mitigation/${pub.pack}/p-best`);
  const bestByMean = new Map<string, number>();
  const bestByMedian = new Map<string, number>();
  const RESAMPLES = 2000;
  for (let b = 0; b < RESAMPLES; b++) {
    const idx = Array.from({ length: SEEDS }, () =>
      Math.floor(rng.next() * SEEDS),
    );
    const stat = (f: (xs: number[]) => number) =>
      publishedOrder
        .map((l) => ({ l, v: f(idx.map((i) => harmOf(l)[i]!)) }))
        .sort((a, c) => a.v - c.v)[0]!.l;
    const m = stat(mean);
    const d = stat(median);
    bestByMean.set(m, (bestByMean.get(m) ?? 0) + 1);
    bestByMedian.set(d, (bestByMedian.get(d) ?? 0) + 1);
  }
  const share = (tally: Map<string, number>) =>
    publishedOrder
      .map((l) => `#${rank(l)} ${pct((tally.get(l) ?? 0) / RESAMPLES)}`)
      .join(", ");
  lines.push(
    `   share of seed-resamples ranking each first — by mean: ${share(bestByMean)}; by median: ${share(bestByMedian)}`,
  );
  const pairs = byMean.slice(0, -1).map((a, i) => [a, byMean[i + 1]!] as const);
  for (const [a, b] of pairs) {
    const diffs = harmOf(a).map((h, i) => h - harmOf(b)[i]!);
    const ci = stratifiedBootstrap(
      diffs.map((value) => ({ value })),
      {
        stratumOf: () => "seeds",
        statistic: (s) => mean(s.map((x) => x.value)),
        seed: `mitigation/${pub.pack}/${a}/${b}`,
      },
    )!;
    const separated = ci.upper < 0 || ci.lower > 0;
    lines.push(
      `   #${rank(a)} vs #${rank(b)} head to head: mean Δ ${fmt(ci.estimate)} [${fmt(ci.lower)}, ${fmt(ci.upper)}] — ${separated ? "separated" : "NOT separated"}; seeds #${rank(a)} better/tied/worse ${diffs.filter((x) => x < 0).length}/${diffs.filter((x) => x === 0).length}/${diffs.filter((x) => x > 0).length}`,
    );
  }
  json.push({
    pack: pub.pack,
    actorId: pub.actorId,
    reproduced: same,
    seeds: SEEDS,
    baselineMean: mean(base),
    rows,
    byMean,
    byMedian,
  });
}

process.stdout.write(
  `Mitigation rankings: published (median of 6 seeds) vs ${SEEDS} shared seeds. Local runs, synthetic packs.\n` +
    lines.join("\n") +
    "\n",
);
if (OUT) writeFileSync(OUT, JSON.stringify(json, null, 2) + "\n");
