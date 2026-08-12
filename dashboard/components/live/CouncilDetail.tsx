"use client";

/**
 * One council, opened.
 *
 * This is the inside of a row in `Councils` — the seats, what each of them
 * recommended, and what the chair did with the table. The row above it owns the
 * identifying line and the warning mark, so nothing here repeats them.
 *
 * The card is built around the thing worth looking at, which is not the answer
 * but the split: institutional gates reaching different calls, and a chair
 * having to overrule one of them.
 *
 * Every seat is a button because the whole promise of the page is that you can
 * open any one of them and read exactly what it was asked and what it said.
 */

import type { AgentRecord, Council } from "../../lib/run-state";

export const RECOMMENDATION_COPY: Record<string, string> = {
  act: "authorise",
  hold: "wait",
  refuse: "refuse",
};

/** The colour a recommendation earns. Waiting is the quiet, ordinary case. */
export function recommendationClass(recommendation: string): string {
  if (recommendation === "act") return "text-warn";
  if (recommendation === "refuse") return "text-accent-strong";
  return "text-slate";
}

export function CouncilDetail({
  council,
  agentFor,
  onOpenAgent,
}: {
  council: Council;
  agentFor: (label: string) => AgentRecord | undefined;
  onOpenAgent: (label: string, title: string, subtitle: string) => void;
}) {
  const verdict = council.verdict;
  const pending = council.seats.length - council.opinions.length;

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-slate">
        Convened because {council.trigger}.
      </p>

      {council.seatSource === "fallback" && (
        <p className="mt-2 text-[12px] leading-snug text-muted">
          This actor&rsquo;s real decision procedure is not documented, so the
          table is a generic four-gate stand-in rather than its own authority
          chain.
        </p>
      )}

      <div className="mt-3 space-y-1.5">
        {council.seats.map((seat) => {
          const opinion = council.opinions.find(
            (entry) => entry.seatId === seat.id,
          );
          if (!opinion) {
            return (
              <div
                key={seat.id}
                className="flex items-baseline gap-2 px-2 py-1.5 text-[12.5px] text-muted"
              >
                <span className="flex-1">{seat.office}</span>
                <span>deliberating…</span>
              </div>
            );
          }

          const agent = agentFor(opinion.agentLabel);
          return (
            <button
              key={seat.id}
              type="button"
              disabled={!agent}
              onClick={() =>
                onOpenAgent(
                  opinion.agentLabel,
                  `${opinion.office} — ${council.actorLabel}`,
                  `${seat.stage} · ${seat.gate}`,
                )
              }
              className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                {opinion.office}
              </span>
              <span
                className={`text-[12.5px] font-semibold ${recommendationClass(
                  opinion.recommendation,
                )}`}
              >
                {RECOMMENDATION_COPY[opinion.recommendation] ??
                  opinion.recommendation}
              </span>
              <span className="hidden min-w-0 flex-1 truncate text-right text-[12px] text-muted sm:block">
                {opinion.decisiveFactor}
              </span>
            </button>
          );
        })}
        {pending > 0 && council.opinions.length === 0 && (
          <div className="px-2 py-1.5 text-[12.5px] text-muted">
            the table is being seated…
          </div>
        )}
      </div>

      {verdict && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            disabled={!agentFor(verdict.agentLabel)}
            onClick={() =>
              onOpenAgent(
                verdict.agentLabel,
                `Final authority — ${council.actorLabel}`,
                `read the whole table and reached "${verdict.decision}"`,
              )
            }
            className="w-full rounded-lg text-left transition-colors hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                it decided to
              </span>
              <span className="text-[13.5px] font-semibold text-navy">
                {RECOMMENDATION_COPY[verdict.decision] ?? verdict.decision}
              </span>
              <span className="text-[12px] text-muted">
                seats split {verdict.split.act ?? 0} authorise ·{" "}
                {verdict.split.hold ?? 0} wait · {verdict.split.refuse ?? 0}{" "}
                refuse
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink">
              {verdict.reasoning}
            </p>
          </button>

          {verdict.dissent && (
            <p className="mt-2 border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-slate">
              Overruled: {verdict.dissent}
            </p>
          )}

          <p
            className={`mt-3 text-[12.5px] leading-relaxed ${
              verdict.agreed ? "text-muted" : "text-warn"
            }`}
          >
            {verdict.agreed
              ? `The model's arithmetic reached the same call.`
              : `The model's arithmetic reached "${verdict.kernelDecision}" instead. The arithmetic is what the run executed — this table is advisory, and the gap between them is the finding.`}
          </p>
        </div>
      )}
    </div>
  );
}
