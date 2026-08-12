"use client";

/**
 * The worlds, and the roads not taken inside them.
 *
 * Two levels, because there are two questions. Across worlds: did the same
 * situation, replayed, come out the same way — and if it did not, the spread is
 * the finding rather than a nuisance. Inside one world: at the steps where an
 * actor's posture changed, what was the whole option set it was choosing from,
 * priced term by term.
 *
 * The rejected options are the actionable half. An actor that came within a hair
 * of a different asset is telling a defender where the next dollar goes, and
 * that is invisible in any view that reports only what happened.
 */

import { useState } from "react";
import { DECISION_LABEL, formatNumber } from "../../lib/live";
import type { Branch, KeptDeliberation } from "../../lib/run-state";
import { Card, Pill } from "../site/ui";

export function Worlds({
  branches,
  order,
  harmUnit,
  tickUnit,
  totalTicks,
}: {
  branches: Record<string, Branch>;
  order: string[];
  harmUnit: string;
  tickUnit: string;
  totalTicks: number;
}) {
  const [open, setOpen] = useState<string | null>(order[0] ?? null);
  if (order.length === 0) return null;

  const worlds = order.map((id) => branches[id]).filter(Boolean) as Branch[];
  const maxHarm = Math.max(1, ...worlds.map((world) => harmOf(world)));

  return (
    <div>
      <h3 className="text-[15px]">
        {worlds.length === 1
          ? "The world it ran"
          : `${worlds.length} worlds, same situation`}
      </h3>
      {worlds.length > 1 && (
        <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-slate">
          Identical setup, replayed under a different draw of who gains access
          when and which option a boundedly-rational actor picks. Where they
          diverge is where a plan built on any single run would have been wrong.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {worlds.map((world) => {
          const isOpen = open === world.id;
          const harm = harmOf(world);
          return (
            <div
              key={world.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : world.id)}
                aria-expanded={isOpen}
                className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1.5 px-5 py-4 text-left hover:bg-sunken"
              >
                <span className="tnum text-[13px] font-semibold text-navy">
                  {world.id}
                </span>
                <span className="text-[13px] text-ink">
                  {actsOf(world)} {actsOf(world) === 1 ? "act" : "acts"}
                </span>
                <span className="text-[13px] text-slate">
                  {formatNumber(harm)} {harmUnit}
                </span>
                {world.finished && (
                  <span className="text-[12.5px] text-muted">
                    {world.finished.decisionPoints} steps worth deliberating
                  </span>
                )}
                <span className="ml-auto text-[12px] text-muted">
                  {isOpen ? "hide" : "open"}
                </span>
                <div className="w-full pt-1">
                  <Sparkline
                    world={world}
                    totalTicks={totalTicks}
                    max={maxHarm}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-line px-5 py-4">
                  <p className="text-[12.5px] leading-snug text-muted">
                    seed <span className="tnum">{world.seed}</span> ·{" "}
                    {world.deliberationsSeen.toLocaleString()} decisions taken,{" "}
                    {world.deliberations.length} of them a change worth showing
                  </p>
                  <Timeline world={world} tickUnit={tickUnit} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function harmOf(world: Branch): number {
  return world.finished?.totalHarm ?? world.ticks.at(-1)?.harm ?? 0;
}

function actsOf(world: Branch): number {
  return world.finished?.activations ?? world.activations.length;
}

/**
 * Harm over the window, with the acts marked.
 *
 * Drawn rather than charted: a run is a line and a handful of moments, and a
 * charting library would add a dependency to render eleven points.
 */
function Sparkline({
  world,
  totalTicks,
  max,
}: {
  world: Branch;
  totalTicks: number;
  max: number;
}) {
  const width = 100;
  const height = 12;
  const points = world.ticks;
  if (points.length === 0) {
    return <div className="h-3" aria-hidden />;
  }

  const path = points
    .map((point, index) => {
      const x = (point.tick / Math.max(1, totalTicks - 1)) * width;
      const y = height - (point.harm / max) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-3 w-full"
      role="img"
      aria-label={`harm over the window in world ${world.id}`}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {world.activations.map((activation) => (
        <circle
          key={activation.seq}
          cx={(activation.tick / Math.max(1, totalTicks - 1)) * width}
          cy={height - 1}
          r={0.9}
          fill="var(--color-warn)"
        />
      ))}
    </svg>
  );
}

/** The steps where something changed, newest last, each openable. */
function Timeline({ world, tickUnit }: { world: Branch; tickUnit: string }) {
  const [open, setOpen] = useState<number | null>(null);

  if (world.deliberations.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-muted">
        Nothing has changed posture in this world yet.
      </p>
    );
  }

  return (
    <ol className="mt-3 space-y-1.5">
      {world.deliberations.map((entry) => {
        const isOpen = open === entry.seq;
        const acted = entry.decision === "act";
        return (
          <li key={entry.seq}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : entry.seq)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg px-2 py-1.5 text-left hover:bg-sunken"
            >
              <span className="tnum text-[12px] text-muted">
                {tickUnit} {entry.tick}
              </span>
              <span className="text-[12.5px] font-semibold text-navy">
                {entry.actorLabel}
              </span>
              {acted && <Pill tone="warn">acted</Pill>}
              {entry.frame === "loss" && (
                <Pill tone="accent">now sees itself losing</Pill>
              )}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate">
                {entry.rationale}
              </span>
              <span className="text-[11.5px] text-muted">
                {entry.consideredCount} weighed
              </span>
            </button>

            {isOpen && <OptionTable entry={entry} />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The full option set at one step.
 *
 * Every column is a term the model actually multiplied, so a reader can see not
 * just that an option lost but which cost beat it. The chosen row is marked; the
 * options a commitment removed are listed beneath, because a move that was never
 * scored is a different fact from one that scored badly.
 */
function OptionTable({ entry }: { entry: KeptDeliberation }) {
  const options = [...entry.considered].sort((a, b) => b.total - a.total);
  const chosenRef = entry.chosen
    ? `${entry.chosen.assetId}|${entry.chosen.rungId}`
    : null;

  return (
    <div className="mb-2 ml-2 mt-1 rounded-lg border border-line bg-sunken px-4 py-3">
      <p className="text-[12.5px] leading-relaxed text-slate">
        {DECISION_LABEL[entry.decision] ?? entry.decision} · waiting was worth{" "}
        <span className="tnum">{entry.holdValue.toFixed(4)}</span> ·{" "}
        {entry.disposition}
      </p>

      {options.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-1.5 pr-3 font-medium">option</th>
                <th className="pb-1.5 pr-3 text-right font-medium">worth</th>
                <th className="pb-1.5 pr-3 text-right font-medium">gain</th>
                <th className="pb-1.5 pr-3 text-right font-medium">
                  being seen
                </th>
                <th className="pb-1.5 pr-3 text-right font-medium">
                  law &amp; allies
                </th>
                <th className="pb-1.5 pr-3 text-right font-medium">
                  civilians
                </th>
                <th className="pb-1.5 text-right font-medium">retaliation</th>
              </tr>
            </thead>
            <tbody>
              {options.map((move, index) => {
                const ref = `${move.assetId}|${move.rungId}`;
                const chosen = ref === chosenRef;
                return (
                  <tr
                    key={`${ref}-${index}`}
                    className={`border-t border-line ${chosen ? "bg-warn-soft" : ""}`}
                  >
                    <td className="py-1.5 pr-3 text-ink">
                      {chosen && (
                        <span className="mr-1.5 text-warn" aria-label="chosen">
                          →
                        </span>
                      )}
                      {move.assetId} · {move.rungId.replace(/_/g, " ")}
                    </td>
                    <Cell value={move.total} emphasis />
                    <Cell value={move.payoff} />
                    <Cell value={move.attributionCost} negative />
                    <Cell value={move.legitimacyCost} negative />
                    <Cell value={move.civilianHarmCost} negative />
                    <Cell value={move.retaliationCost} negative last />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] text-muted">
          Nothing was scoreable at this step.
        </p>
      )}

      {entry.blocked.length > 0 && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Removed before scoring by its own commitments
          </div>
          <ul className="mt-1.5 space-y-1">
            {entry.blocked.slice(0, 4).map((blocked, index) => (
              <li
                key={`${blocked.assetId}-${blocked.rungId}-${index}`}
                className="text-[12px] leading-snug text-slate"
              >
                <span className="text-ink">
                  {blocked.assetId} · {blocked.rungId.replace(/_/g, " ")}
                </span>{" "}
                — {blocked.redlineStatement}
              </li>
            ))}
            {entry.blocked.length > 4 && (
              <li className="text-[12px] text-muted">
                and {entry.blocked.length - 4} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Cell({
  value,
  negative,
  emphasis,
  last,
}: {
  value: number;
  negative?: boolean;
  emphasis?: boolean;
  last?: boolean;
}) {
  const quiet = Math.abs(value) < 0.0005;
  return (
    <td
      className={`tnum py-1.5 text-right ${last ? "" : "pr-3"} ${
        quiet
          ? "text-muted"
          : emphasis
            ? value > 0
              ? "font-semibold text-warn"
              : "font-semibold text-slate"
            : negative
              ? "text-slate"
              : "text-ink"
      }`}
    >
      {quiet ? "—" : `${negative ? "−" : ""}${Math.abs(value).toFixed(3)}`}
    </td>
  );
}
