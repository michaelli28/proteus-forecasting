/**
 * Every actor the engine can place in a scenario.
 *
 * The index states how much of each dossier is actually written, because the
 * useful thing to know before opening one is whether it holds documented
 * research or is still eleven numbers with citations. Uniform completeness is
 * what a reader would otherwise assume, and for this library it is not true.
 */

import Link from "next/link";
import {
  DOSSIERS,
  KIND_LABEL,
  citationCount,
  dossierDepth,
} from "../../lib/dossier";
import { Card, Eyebrow, Page, Pill } from "../../components/site/ui";

export const metadata = {
  title: "Actors — Proteus",
  description:
    "Every attacker profile the engine can place in a scenario: how it decides, what it refuses, and what it has actually done.",
};

const KIND_ORDER = [
  "state",
  "state_proxy",
  "ideological_nonstate",
  "criminal_enterprise",
  "activist_collective",
  "insider",
];

export default function ActorsPage() {
  const profiles = [...DOSSIERS.profiles].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.label.localeCompare(b.label),
  );

  return (
    <Page>
      <Eyebrow>Actors</Eyebrow>
      <h1 className="max-w-[26ch] text-[34px] leading-[1.1]">
        Who the calculation can put across the table
      </h1>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-relaxed text-slate">
        Two attackers with the same access and the same target choose
        differently, because they weigh the risk of being blamed for it, allied
        opinion, their own losses and time differently. Each profile below
        states those weights, the red lines the institution holds to, and where
        every number came from — so the ones you disagree with are the ones you
        can replace.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {profiles.map((dossier) => {
          const depth = dossierDepth(dossier);
          const documented = [
            depth.procedure ? "how it decides" : null,
            depth.worldview ? "what it says it wants" : null,
            depth.history > 0 ? `${depth.history} decisions on record` : null,
          ].filter(Boolean);

          return (
            <Link
              key={dossier.id}
              href={`/actors/${dossier.id}`}
              className="group block focus:outline-none"
            >
              <Card className="h-full transition-colors group-hover:border-line-strong group-focus-visible:border-accent">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-navy">
                    {dossier.label}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {KIND_LABEL[dossier.kind] ?? dossier.kind}
                  </span>
                </div>

                <p className="mt-2.5 line-clamp-4 text-[13px] leading-relaxed text-slate">
                  {dossier.summary}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-[11.5px] text-muted">
                  <span>{citationCount(dossier)} sources</span>
                  <span>
                    {dossier.redlines.length}{" "}
                    {dossier.redlines.length === 1 ? "red line" : "red lines"}
                  </span>
                  {documented.length > 0 ? (
                    <span>{documented.join(" · ")}</span>
                  ) : (
                    <span>numbers only — no profile written yet</span>
                  )}
                  {depth.lowConfidence > 0 && (
                    <Pill tone="warn">
                      {depth.lowConfidence} thin{" "}
                      {depth.lowConfidence === 1 ? "number" : "numbers"}
                    </Pill>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <section className="mt-16 border-t border-line pt-8">
        <h2 className="text-[17px]">Where these come from</h2>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          {DOSSIERS.method}
        </p>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          Reviewed {DOSSIERS.reviewedAt}. There is nowhere to record an
          ethnicity, a religion, or the character of a population, so no page
          can show one and none can reach the council of officials a run puts in
          the room — the block is built into the data, not a matter of editing.
        </p>
      </section>
    </Page>
  );
}
