"use client";

/**
 * The bench.
 *
 * Four reviewers, each applying a different structured analytic technique to
 * the same worlds. The panel is composed of TECHNIQUES rather than personas
 * because a panel of invented characters produces correlated opinions dressed as
 * independent ones, while competing-hypotheses, a devil's advocate and a
 * premortem fail in genuinely different directions.
 *
 * Where they disagree is shown, not smoothed. A bench that converged politely
 * would have measured nothing, and each judge is asked for the dissent it
 * expects from the others.
 */

import type { AgentRecord, JudgementEntry } from "../../lib/run-state";
import { Card, Pill } from "../site/ui";

const TECHNIQUE_COPY: Record<string, { name: string; does: string }> = {
  analysis_of_competing_hypotheses: {
    name: "Competing hypotheses",
    does: "scores the evidence against every world, counting what tells them apart more than what fits them all",
  },
  key_assumptions_check: {
    name: "Key assumptions",
    does: "spells out what the conclusion rests on, and what would break each assumption",
  },
  devils_advocate: {
    name: "Devil's advocate",
    does: "argues the leading world is the wrong one to plan against",
  },
  premortem: {
    name: "Premortem",
    does: "assumes a defender planned against this and was badly surprised, then explains how",
  },
  red_team: {
    name: "Red team",
    does: "takes the attacker's side and says which world makes the defender look too good",
  },
};

export function JudgesBench({
  judgements,
  agentFor,
  onOpenAgent,
}: {
  judgements: JudgementEntry[];
  agentFor: (label: string) => AgentRecord | undefined;
  onOpenAgent: (label: string, title: string, subtitle: string) => void;
}) {
  if (judgements.length === 0) return null;

  const rankings = judgements.filter((entry) => entry.ranking.length > 0);
  const topPicks = new Set(rankings.map((entry) => entry.ranking[0]));

  return (
    <div>
      <h3 className="text-[15px]">What the reviewers made of it</h3>
      <p className="mt-1.5 max-w-[72ch] text-[13px] leading-relaxed text-slate">
        Each reviewer applies one technique to the same worlds, and says how
        likely a world is separately from how sure it is — so &ldquo;plan
        against this one, and I am not confident&rdquo; stays sayable.
        {rankings.length > 1 && (
          <>
            {" "}
            {topPicks.size === 1
              ? "All of them put the same world first."
              : `They put ${topPicks.size} different worlds first — that disagreement is itself the result.`}
          </>
        )}
      </p>

      <div className="mt-4 space-y-3">
        {judgements.map((entry) => {
          const copy = TECHNIQUE_COPY[entry.technique];
          const agent = agentFor(entry.judgeId);
          return (
            <Card key={entry.judgeId}>
              <button
                type="button"
                disabled={!agent}
                onClick={() =>
                  onOpenAgent(
                    entry.judgeId,
                    copy?.name ?? entry.technique,
                    copy?.does ?? "",
                  )
                }
                className="w-full rounded-lg text-left disabled:cursor-default"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-semibold text-navy">
                    {copy?.name ?? entry.technique}
                  </span>
                  {entry.confidence === "low" && (
                    <Pill tone="warn">low confidence</Pill>
                  )}
                  {entry.ranking.length > 0 && (
                    <span className="text-[12px] text-muted">
                      plan against {entry.ranking[0]}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
                  {entry.verdict}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate">
                  {entry.reasoning}
                </p>
              </button>

              {entry.dissent && (
                <p className="mt-2 border-l-2 border-line pl-3 text-[12.5px] leading-relaxed text-slate">
                  What it expects the others to get wrong: {entry.dissent}
                </p>
              )}

              {copy && (
                <p className="mt-2 text-[11.5px] leading-snug text-muted">
                  This technique {copy.does}.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
