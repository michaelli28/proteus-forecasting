"use client";

/**
 * Every council the run held, grouped by the world that held it.
 *
 * What this replaced printed every one of them open, which on a six-world run
 * is three dozen full cards — a table of officials, a verdict and a calculation
 * line each — and a reader hunting the few that parted from the calculation had
 * to scroll the ones that did not. Nothing about the shape of the page said
 * where the findings were.
 *
 * So it collapses now: a world says how many councils it held and how many
 * parted, a council says its step, actor and call, and opening one gives back
 * the whole card unchanged. The same data, behind one click each.
 *
 * While the stream is live the council currently deliberating opens itself, so
 * the page still shows work happening. The moment the reader clicks anything
 * that following stops — a panel that yanks itself elsewhere mid-sentence is
 * worse than one that never moved.
 */

import { useEffect, useMemo, useState } from "react";
import type { AgentRecord, Council } from "../../lib/run-state";
import { Pill } from "../site/ui";
import {
  CouncilDetail,
  RECOMMENDATION_COPY,
  recommendationClass,
} from "./CouncilDetail";

interface World {
  id: string;
  councils: Council[];
  parted: number;
}

export function Councils({
  councils,
  running,
  agentFor,
  onOpenAgent,
}: {
  councils: Council[];
  running: boolean;
  agentFor: (label: string) => AgentRecord | undefined;
  onOpenAgent: (label: string, title: string, subtitle: string) => void;
}) {
  const [openWorld, setOpenWorld] = useState<string | null>(null);
  const [openCouncil, setOpenCouncil] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [partedOnly, setPartedOnly] = useState(false);

  const parted = councils.filter(
    (council) => council.verdict && !council.verdict.agreed,
  ).length;

  const worlds = useMemo(() => groupByWorld(councils), [councils]);

  // The council with seats still answering, which is the one worth watching.
  const live = running
    ? councils.find((council) => !council.verdict)?.councilId
    : undefined;
  const liveWorld = councils.find(
    (council) => council.councilId === live,
  )?.branchId;

  useEffect(() => {
    if (!following || !live) return;
    setOpenCouncil(live);
    if (liveWorld) setOpenWorld(liveWorld);
  }, [following, live, liveWorld]);

  if (councils.length === 0) return null;

  const stopFollowing = () => setFollowing(false);
  const shown = partedOnly
    ? worlds
        .map((world) => ({
          ...world,
          councils: world.councils.filter(
            (council) => council.verdict && !council.verdict.agreed,
          ),
        }))
        .filter((world) => world.councils.length > 0)
    : worlds;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-[15px]">
          Where each actor&rsquo;s own officials weighed the same choice
        </h3>
        {/* Offered only when it can change what is on screen: with nothing to
            filter down to, or nothing filtered out, the control is decoration. */}
        {parted > 0 && parted < councils.length && (
          <button
            type="button"
            aria-pressed={partedOnly}
            onClick={() => {
              stopFollowing();
              setPartedOnly(!partedOnly);
            }}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              partedOnly
                ? "border-warn bg-warn-soft text-warn"
                : "border-line bg-surface text-slate hover:border-line-strong"
            }`}
          >
            {partedOnly
              ? `showing the ${parted} that disagreed — show all ${councils.length}`
              : `show only the ${parted} that disagreed with the calculation`}
          </button>
        )}
      </div>

      <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-slate">
        At each step below, the officials inside that actor who would have to
        sign off were asked to judge the same options. They only advise — the
        calculation is what the run actually did — so the{" "}
        {parted > 0
          ? `${parted} ${parted === 1 ? "council" : "councils"} that disagreed with the calculation ${parted === 1 ? "is" : "are"} the finding`
          : "places where they agree are a check on it"}
        .
      </p>

      <div className="mt-4 space-y-2">
        {shown.map((world) =>
          // A single-world run has nothing to group by, and a heading that reads
          // "run · 6 councils" above the only six there are is a click for free.
          shown.length === 1 && worlds.length === 1 ? (
            <div
              key={world.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <CouncilRows
                world={world}
                openCouncil={openCouncil}
                onOpen={(id) => {
                  stopFollowing();
                  setOpenCouncil(id);
                }}
                agentFor={agentFor}
                onOpenAgent={onOpenAgent}
              />
            </div>
          ) : (
            <div
              key={world.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <button
                type="button"
                aria-expanded={openWorld === world.id}
                onClick={() => {
                  stopFollowing();
                  setOpenWorld(openWorld === world.id ? null : world.id);
                }}
                className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-sunken"
              >
                <span className="tnum text-[13px] font-semibold text-navy">
                  {world.id}
                </span>
                <span className="text-[13px] text-ink">
                  {world.councils.length}{" "}
                  {world.councils.length === 1 ? "council" : "councils"}
                </span>
                {world.parted > 0 && !partedOnly && (
                  <span className="text-[12.5px] text-warn">
                    {world.parted} disagreed with the calculation
                  </span>
                )}
                <span className="ml-auto text-[12px] text-muted">
                  {openWorld === world.id ? "hide" : "open"}
                </span>
              </button>

              {openWorld === world.id && (
                <div className="border-t border-line">
                  <CouncilRows
                    world={world}
                    openCouncil={openCouncil}
                    onOpen={(id) => {
                      stopFollowing();
                      setOpenCouncil(id);
                    }}
                    agentFor={agentFor}
                    onOpenAgent={onOpenAgent}
                  />
                </div>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** The councils of one world, one line each until opened. */
function CouncilRows({
  world,
  openCouncil,
  onOpen,
  agentFor,
  onOpenAgent,
}: {
  world: World;
  openCouncil: string | null;
  onOpen: (id: string | null) => void;
  agentFor: (label: string) => AgentRecord | undefined;
  onOpenAgent: (label: string, title: string, subtitle: string) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {world.councils.map((council) => {
        const isOpen = openCouncil === council.councilId;
        const verdict = council.verdict;
        const dissented = Boolean(verdict && !verdict.agreed);
        const split = tableCopy(council);
        return (
          <li key={council.councilId}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onOpen(isOpen ? null : council.councilId)}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-2.5 text-left hover:bg-sunken"
            >
              <span className="tnum text-[12px] text-muted">
                step {council.tick}
              </span>
              <span className="min-w-0 truncate text-[12.5px] font-semibold text-navy">
                {council.actorLabel}
              </span>
              {verdict ? (
                <>
                  <span
                    className={`text-[12.5px] font-semibold ${recommendationClass(
                      verdict.decision,
                    )}`}
                  >
                    {RECOMMENDATION_COPY[verdict.decision] ?? verdict.decision}
                  </span>
                  {split && (
                    <span className="text-[12px] text-muted">{split}</span>
                  )}
                </>
              ) : (
                <span className="text-[12px] text-muted">
                  {council.opinions.length} of {council.seats.length} officials
                  answered
                </span>
              )}
              {dissented && (
                <Pill tone="warn">disagreed with the calculation</Pill>
              )}
              <Chevron open={isOpen} />
            </button>

            {isOpen && (
              <div className="border-t border-line bg-sunken px-5 py-4">
                <CouncilDetail
                  council={council}
                  agentFor={agentFor}
                  onOpenAgent={onOpenAgent}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The only disclosure affordance on the row, and the one thing on it that has
 * to appear on every row — so it carries no information beyond its own state,
 * and says that by pointing somewhere different when the row is open.
 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 12"
      className={`ml-auto h-2.5 w-2 shrink-0 self-center text-muted transition-transform ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 1.5 6.5 6 2 10.5" />
    </svg>
  );
}

/**
 * How the table divided — and nothing at all when it did not.
 *
 * A run where every council was unanimous would otherwise print "all 7
 * officials agreed" down the whole list, a column of identical text that tells a
 * reader nothing about which row to open. The divided tables are the ones worth
 * finding, so they are the only ones that say anything here.
 */
function tableCopy(council: Council): string {
  const verdict = council.verdict;
  if (!verdict) return "";
  const seats = council.opinions.length;
  const agreeing = verdict.split[verdict.decision] ?? 0;
  if (seats === 0 || agreeing >= seats) return "";
  return `${agreeing} of ${seats} officials agreed`;
}

/**
 * Councils in the order their world first appeared.
 *
 * Grouping by world rather than by arrival because that is the axis the run
 * actually varies along — the same actor at the same step in w1 and w4 is the
 * comparison worth making, and interleaved arrival order buries it.
 */
function groupByWorld(councils: Council[]): World[] {
  const worlds: World[] = [];
  const index = new Map<string, World>();
  for (const council of councils) {
    let world = index.get(council.branchId);
    if (!world) {
      world = { id: council.branchId, councils: [], parted: 0 };
      index.set(council.branchId, world);
      worlds.push(world);
    }
    world.councils.push(council);
    if (council.verdict && !council.verdict.agreed) world.parted += 1;
  }
  return worlds;
}
