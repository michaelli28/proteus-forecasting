"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  VULNERABILITY,
  ARCHETYPE_NAME,
  componentName,
  instrumentName,
  defenseName,
  DEFENSE_INFO,
  personHours,
  personHoursLong,
  people,
  percent,
} from "../../lib/vulnerability";
import type {
  ArchetypeResult,
  ChokepointRow,
  DefenseRoiRow,
} from "../../lib/vulnerability";
import { Pill } from "../site/ui";

/**
 * The water-exposure explorer.
 *
 * One system at a time. Switching systems cross-fades the three rankings so the
 * page never jumps. Every table is the engine's ranking, retitled and reworded
 * for a reader who has never seen a person-hour — the numbers are untouched.
 */
export default function ExposureExplorer() {
  const systems = VULNERABILITY.archetypes;
  const [selectedId, setSelectedId] = useState(
    systems.find((s) => s.archetypeId === "district_multizone")?.archetypeId ??
      systems[0]!.archetypeId,
  );
  const active = systems.find((s) => s.archetypeId === selectedId)!;

  return (
    <div>
      <SystemSelector
        systems={systems}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Chokepoints result={active} />
          <AttackPaths result={active} />
          <Defenses result={active} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SystemSelector({
  systems,
  selectedId,
  onSelect,
}: {
  systems: ArchetypeResult[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Choose a water system"
      className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-sunken/60 p-1"
    >
      {systems.map((system) => {
        const active = system.archetypeId === selectedId;
        return (
          <button
            key={system.archetypeId}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(system.archetypeId)}
            className={`relative rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors ${
              active ? "text-white" : "text-slate hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId="system-pill"
                className="absolute inset-0 rounded-lg bg-navy"
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
            <span className="relative">
              {ARCHETYPE_NAME[system.archetypeId] ?? system.archetypeId}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── section scaffolding ───

function Block({
  n,
  title,
  lede,
  children,
}: {
  n: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-2.5">
        <span className="tnum font-serif text-[15px] font-medium text-accent">
          {n}
        </span>
        <h2 className="text-[20px] leading-tight">{title}</h2>
      </div>
      <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-slate">
        {lede}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Bar({
  fraction,
  tone,
}: {
  fraction: number;
  tone: "warn" | "accent" | "good";
}) {
  const color = {
    warn: "var(--color-warn-soft)",
    accent: "var(--color-accent-soft)",
    good: "var(--color-good-soft)",
  }[tone];
  const width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <div
        className="u-grow h-full rounded-full"
        style={{ width, background: color }}
      />
    </div>
  );
}

// ─── 1. biggest exposures ───

function chokepointStatus(row: ChokepointRow): {
  label: string;
  tone: "warn" | "accent" | "neutral" | "good";
} | null {
  if (row.robustPersonHours > 0 && row.activationRate < 0.02) {
    return { label: "Overlooked risk", tone: "warn" };
  }
  if (row.sweepSensitive) {
    return { label: "Depends on assumptions", tone: "neutral" };
  }
  if (row.unresolved) return { label: "Not measurable", tone: "neutral" };
  return null;
}

function Chokepoints({ result }: { result: ArchetypeResult }) {
  const rows = result.report.chokepoints.rows;
  const maxPeople = Math.max(1, ...rows.map((r) => r.worstCasePeakPeople));

  return (
    <Block
      n="1"
      title="Biggest exposures"
      lede="Every control component, ranked by the damage an attacker could do by taking it over — whether or not the simulated attacker chose to target it. That is the point: the worst weak spots are not always the ones under attack."
    >
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line bg-sunken/50 text-left">
              <Th>Component</Th>
              <Th className="text-right">People at risk</Th>
              <Th className="text-right">Lost-service hours</Th>
              <Th className="text-right">Attacker targets it</Th>
              <Th>{""}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = chokepointStatus(row);
              const dead = row.robustPersonHours <= 0 && !row.sweepSensitive;
              return (
                <tr
                  key={row.componentId}
                  className="border-b border-line/70 last:border-0"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${dead ? "text-muted" : "text-ink"}`}
                    >
                      {componentName(row.componentId)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="tnum font-semibold text-ink">
                      {row.worstCasePeakPeople > 0
                        ? people(row.worstCasePeakPeople)
                        : "—"}
                    </div>
                    {row.worstCasePeakPeople > 0 && (
                      <div className="mt-1">
                        <Bar
                          fraction={row.worstCasePeakPeople / maxPeople}
                          tone={status?.tone === "warn" ? "warn" : "accent"}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-slate">
                    {row.robustPersonHours > 0 ? (
                      <>
                        {personHours(row.robustPersonHours)}
                        <span className="text-muted">
                          &ndash;{personHours(row.pessimisticPersonHours)}
                        </span>
                      </>
                    ) : row.pessimisticPersonHours > 0 ? (
                      <span className="text-muted">
                        up to {personHours(row.pessimisticPersonHours)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-slate">
                    {percent(row.activationRate)}
                  </td>
                  <td className="px-4 py-3">
                    {status && <Pill tone={status.tone}>{status.label}</Pill>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Caption>
        <strong className="font-semibold text-ink">Lost-service hours</strong>{" "}
        add up every hour each person is left without safe water pressure — 100
        people for 5 hours is 500. The range spans a cautious estimate to a
        pessimistic one. &ldquo;Overlooked risk&rdquo; marks a real danger the
        attacker rarely picks because an even bigger target is available.
      </Caption>
    </Block>
  );
}

// ─── 2. how the attacker moves ───

function AttackPaths({ result }: { result: ArchetypeResult }) {
  const rows = result.report.attackPaths.rows.slice(0, 8);
  if (rows.length === 0) {
    return (
      <Block
        n="2"
        title="How the attacker moves"
        lede="Where the simulated attacker actually used its access, and what each move cost the public."
      >
        <Empty>
          On this system the attacker never found a move worth making — the
          storage and layout absorb the disruptions it could cause. That
          resilience is itself the finding.
        </Empty>
      </Block>
    );
  }
  const maxExpected = Math.max(1, ...rows.map((r) => r.expectedPersonHours));

  return (
    <Block
      n="2"
      title="How the attacker moves"
      lede="Where the simulated attacker actually used its access, split by what kind of interference it caused — because locking operators out and quietly sabotaging controls are very different events."
    >
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-b border-line bg-sunken/50 text-left">
              <Th>Target</Th>
              <Th>What it does</Th>
              <Th className="text-right">How often</Th>
              <Th className="text-right">Typical damage</Th>
              <Th className="text-right">Days it waited</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.componentId}-${row.band}`}
                className="border-b border-line/70 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-ink">
                  {componentName(row.componentId)}
                </td>
                <td className="px-4 py-3 text-slate">
                  {instrumentName(row.band)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="tnum text-ink">{percent(row.frequency)}</div>
                  <div className="mt-1">
                    <Bar
                      fraction={row.expectedPersonHours / maxExpected}
                      tone="accent"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-right tnum text-slate">
                  {row.meanPersonHours > 0
                    ? `${personHours(row.meanPersonHours)} hrs`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right tnum text-slate">
                  {Math.round(row.meanDwellTicks)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Caption>
        &ldquo;Days it waited&rdquo; is how long the attacker sat on its access
        before acting — a patient attacker holding a foothold for the right
        moment, which is exactly the behaviour that is hard to catch.
      </Caption>
    </Block>
  );
}

// ─── 3. defenses worth the money ───

function Defenses({ result }: { result: ArchetypeResult }) {
  const rows = result.report.defenseRoi.rows;
  const baseline = result.report.defenseRoi.baselineMeanPersonHours;
  const maxValue = Math.max(
    1,
    ...rows.map((r) => Math.abs(r.personHoursPerCost)),
  );

  return (
    <Block
      n="3"
      title="Defenses worth the money"
      lede="Each defense is tested against the exact same attacks, changing one thing at a time, so the protection it buys is measured — not assumed. Ranked by value for money."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <DefenseCard
            key={row.label}
            row={row}
            baseline={baseline}
            maxValue={maxValue}
          />
        ))}
      </div>
      <Caption>
        Prevention is measured against a baseline of {personHoursLong(baseline)}{" "}
        lost-service hours with no defense in place. A defense that
        &ldquo;backfires&rdquo; made things worse — tighter monitoring can push
        an attacker to act sooner rather than lose its foothold, and the
        analysis shows that instead of hiding it.
      </Caption>
    </Block>
  );
}

function DefenseCard({
  row,
  baseline,
  maxValue,
}: {
  row: DefenseRoiRow;
  baseline: number;
  maxValue: number;
}) {
  const info = DEFENSE_INFO[row.kind];
  const avertedShare = baseline > 0 ? row.meanPersonHoursAverted / baseline : 0;
  const delayDays = Math.round(row.activationDelayTicks);

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-semibold text-navy">
          {defenseName(row.kind)}
        </h3>
        {row.backfired ? (
          <Pill tone="warn">Backfired</Pill>
        ) : avertedShare >= 0.4 ? (
          <Pill tone="good">Strong value</Pill>
        ) : null}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate">
        {info?.what}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        <Metric
          value={
            row.backfired
              ? `+${personHours(-row.meanPersonHoursAverted)}`
              : `${Math.round(Math.max(0, avertedShare) * 100)}%`
          }
          label={row.backfired ? "more damage" : "less disruption"}
          tone={row.backfired ? "warn" : "good"}
        />
        <Metric
          value={`$${row.meanCost.toLocaleString("en-US")}`}
          label="cost"
        />
        <Metric
          value={delayDays >= 0 ? `+${delayDays}d` : `${delayDays}d`}
          label="delay to attack"
          tone={delayDays < 0 ? "warn" : "ink"}
        />
      </div>

      {!row.backfired && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11.5px] text-muted">
            <span className="tnum">
              {Math.round(row.personHoursPerCost)} hrs saved / $
            </span>
          </div>
          <div className="mt-1.5">
            <Bar fraction={row.personHoursPerCost / maxValue} tone="good" />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  value,
  label,
  tone = "ink",
}: {
  value: string;
  label: string;
  tone?: "ink" | "good" | "warn";
}) {
  const color = { ink: "text-navy", good: "text-good", warn: "text-warn" }[
    tone
  ];
  return (
    <div>
      <div className={`tnum text-[19px] font-semibold leading-none ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-[11.5px] leading-tight text-muted">{label}</div>
    </div>
  );
}

// ─── small shared bits ───

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-[74ch] text-[12.5px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-sunken/30 px-5 py-6 text-[14px] leading-relaxed text-slate">
      {children}
    </div>
  );
}
