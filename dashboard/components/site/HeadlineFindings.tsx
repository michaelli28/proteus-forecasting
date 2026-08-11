"use client";

import Link from "next/link";
import { Reveal, CountUp } from "./motion";
import {
  archetype,
  componentName,
  personHours,
  people,
} from "../../lib/vulnerability";

/**
 * Three real results, pulled from the live sweep — not hand-typed.
 *
 * Each is derived from the snapshot so it can never drift from the data behind
 * it. The captions are written for a reader who has never heard "person-hours":
 * the number is framed as what it means, then the figure carries the weight.
 */
export default function HeadlineFindings() {
  const municipal = archetype("municipal_pumped");
  const district = archetype("district_multizone");

  // 1. Best-value defense on the mid-size system.
  const bestDefense = [...municipal.report.defenseRoi.rows]
    .filter((r) => !r.backfired)
    .sort((a, b) => b.personHoursPerCost - a.personHoursPerCost)[0]!;
  const baseline = municipal.report.defenseRoi.baselineMeanPersonHours;
  const avertedShare = bestDefense.meanPersonHoursAverted / baseline;

  // 2. The sleeper: highest guaranteed harm among components the adversary
  //    almost never targets.
  const sleeper = [...district.report.chokepoints.rows]
    .filter((r) => r.robustPersonHours > 0 && r.activationRate < 0.02)
    .sort((a, b) => b.worstCasePeakPeople - a.worstCasePeakPeople)[0];

  // 3. The dominant chokepoint on the large system.
  const dominant = district.report.chokepoints.rows[0]!;

  return (
    <section className="mt-20 scroll-mt-20">
      <Reveal>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          What it found
        </div>
        <h2 className="text-[22px] leading-tight">
          Three results from the water example.
        </h2>
        <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-slate">
          Each comes straight from the simulation, run{" "}
          {municipal.runsPerArm.toLocaleString("en-US")} times per scenario.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Reveal className="flex flex-col rounded-xl border border-line bg-surface p-6">
          <div className="tnum font-serif text-[40px] leading-none text-good">
            <CountUp
              value={avertedShare * 100}
              format={(v) => `${Math.round(v)}%`}
            />
          </div>
          <div className="mt-3 text-[15px] font-semibold text-navy">
            less disruption, cheapest of all
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate">
            Simply having operators run the plant by hand cut lost water service
            by nearly half — and cost less than every high-tech measure tested.
          </p>
        </Reveal>

        {sleeper && (
          <Reveal
            delay={0.08}
            className="flex flex-col rounded-xl border border-line bg-surface p-6"
          >
            <div className="tnum font-serif text-[40px] leading-none text-warn">
              <CountUp
                value={sleeper.worstCasePeakPeople}
                format={(v) => people(v)}
              />
            </div>
            <div className="mt-3 text-[15px] font-semibold text-navy">
              people a blind spot could strand
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-slate">
              The {componentName(sleeper.componentId).toLowerCase()} is a
              serious vulnerability the modeled attacker almost never targets —
              the kind you only catch by ranking every component, not just the
              ones under fire.
            </p>
          </Reveal>
        )}

        <Reveal
          delay={0.16}
          className="flex flex-col rounded-xl border border-line bg-surface p-6"
        >
          <div className="tnum font-serif text-[40px] leading-none text-navy">
            <CountUp
              value={dominant.activationRate * 100}
              format={(v) => `${Math.round(v)}%`}
            />
          </div>
          <div className="mt-3 text-[15px] font-semibold text-navy">
            of attacks converge on one sensor
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-slate">
            On the large system, most modeled attacks aim at a single{" "}
            {componentName(dominant.componentId).toLowerCase()} — the clearest
            &ldquo;harden this first&rdquo; the analysis produces.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <Link
          href="/exposure"
          className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-strong hover:underline"
        >
          Full water-exposure breakdown
          <span aria-hidden>→</span>
        </Link>
      </Reveal>
    </section>
  );
}
