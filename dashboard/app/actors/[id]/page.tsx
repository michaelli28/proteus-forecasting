/**
 * One actor, in full.
 *
 * The organising claim: a number is only worth as much as the reader's ability
 * to argue with it. So every parameter sits beside the reasoning that set it AND
 * beside the decisions that institution actually made which bear on it — a
 * reader who doubts 0.85 gets the episodes it was read off and can say which one
 * they think was misread.
 *
 * Order is by usefulness to a defender, not by how the data happens to be
 * stored: what the actor refuses to trade first, then how a decision reaches
 * authorisation, then what it has done before, then the numbers.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DOCTRINE_PARAMETERS,
  DOSSIERS,
  KIND_LABEL,
  PARAMETER_COPY,
  citationCount,
  dossierFor,
  episodesFor,
  redlineReach,
  sourceGroupsFor,
} from "../../../lib/dossier";
import type { Dossier, DoctrineParameter } from "../../../lib/dossier";
import {
  Basis,
  Claim,
  DossierSection,
  Inline,
  ParameterBar,
  Prose,
} from "../../../components/actors/dossier-parts";
import { Card, Eyebrow, Page, Pill } from "../../../components/site/ui";

export function generateStaticParams() {
  return DOSSIERS.profiles.map((profile) => ({ id: profile.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dossier = dossierFor(id);
  return {
    title: dossier ? `${dossier.label} — Proteus` : "Actor — Proteus",
    description: dossier?.summary.slice(0, 160),
  };
}

export default async function ActorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dossier = dossierFor(id);
  if (!dossier) notFound();

  return (
    <Page>
      <Link
        href="/actors"
        className="text-[12.5px] text-muted hover:text-accent-strong"
      >
        ← every actor
      </Link>

      <Eyebrow>{KIND_LABEL[dossier.kind] ?? dossier.kind}</Eyebrow>
      <h1 className="max-w-[24ch] text-[34px] leading-[1.1]">
        {dossier.label}
      </h1>
      <p className="mt-5 max-w-[76ch] text-[14.5px] leading-relaxed text-ink">
        {dossier.summary}
      </p>

      <Redlines dossier={dossier} />
      <Procedure dossier={dossier} />
      <History dossier={dossier} />
      <Parameters dossier={dossier} />
      <Worldview dossier={dossier} />
      <Weaknesses dossier={dossier} />
      <Sources dossier={dossier} />
    </Page>
  );
}

/**
 * What it will not trade.
 *
 * First, because it is the one thing on this page that changes what a defender
 * should do: raising the price of crossing a red line does not deter, since the
 * actor is not running the trade. The distinction between a commitment the
 * kernel enforces and one that is only prose is stated on the row, so inert text
 * is never presented as though it bound the model.
 */
function Redlines({ dossier }: { dossier: Dossier }) {
  return (
    <DossierSection
      title="What it will not trade"
      lede="Commitments this institution does not price — raising the cost of crossing one does not deter, because it is not running the trade. Each row says what the model does with it, which is not always the same as what the institution would do."
      empty={
        dossier.redlines.length === 0
          ? "No commitment of this kind is recorded for this actor. Every move it can reach is priced on cost and benefit alone."
          : undefined
      }
    >
      <div className="space-y-3">
        {dossier.redlines.map((redline) => (
          <Card key={redline.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                {redline.effect === "self_prohibits"
                  ? "it refuses to do this"
                  : "this forces it to respond"}
              </span>
              <Enforcement dossier={dossier} redlineId={redline.id} />
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
              <Inline line={redline.statement} />
            </p>
            <Basis basis={redline.basis} confidence={redline.confidence} />
          </Card>
        ))}
      </div>
    </DossierSection>
  );
}

/**
 * What the model actually does with this commitment.
 *
 * The honest answer has three cases and the interesting one is the third: every
 * commitment in this library that the kernel CAN enforce sits above the highest
 * value any shipped ladder reaches, so none of them has ever removed a move. A
 * pill reading "enforced" beside such a commitment is accurate and misleading in
 * the same breath, which is worse than either.
 *
 * The gap is not a defect to hide. A council seated from this actor's own
 * procedure has refused moves on exactly the ground the arithmetic cannot see,
 * and that disagreement is the most interesting thing a run produces.
 */
function Enforcement({
  dossier,
  redlineId,
}: {
  dossier: Dossier;
  redlineId: string;
}) {
  const reach = redlineReach(dossier, redlineId);

  if (!reach) {
    return (
      <span className="text-[11.5px] text-muted">
        stated, but nothing in the model enforces it
      </span>
    );
  }

  if (reach.reachedIn.length > 0) {
    return (
      <Pill tone="accent">removes moves in {reach.reachedIn.join(", ")}</Pill>
    );
  }

  return (
    <span className="max-w-[46ch] text-right text-[11.5px] leading-snug text-muted">
      enforced at {reach.attribute} above {reach.maxAcceptable} — no move in any
      scenario here goes that far, so it never removes one
    </span>
  );
}

/** How a proposal reaches authorisation, and who can stop it on the way. */
function Procedure({ dossier }: { dossier: Dossier }) {
  const procedure = dossier.procedure;
  return (
    <DossierSection
      title="How a decision gets made"
      lede="The path from proposal to execution, and the offices that can stop it. When a run convenes this actor's council, these are the seats at the table."
      empty={
        !procedure
          ? "This actor's decision procedure has not been documented yet. A run still convenes a council for it, but from a generic four-gate table — operations, legal review, intelligence assessment, decision authority — and every screen that shows it says so."
          : undefined
      }
    >
      {procedure && (
        <>
          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Where authority sits
            </div>
            <Claim claim={procedure.authority} className="mt-2" />
          </Card>

          <ol className="mt-4 space-y-2">
            {[...procedure.steps]
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li
                  key={`${step.order}-${step.office}`}
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="tnum text-[12px] text-muted">
                      {step.order + 1}
                    </span>
                    <span className="text-[13px] font-semibold text-navy">
                      {step.office}
                    </span>
                    <span className="text-[12.5px] text-slate">
                      {step.stage}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
                    <Inline line={step.gate} />
                  </p>
                  <Basis basis={step.basis} confidence={step.confidence} />
                </li>
              ))}
          </ol>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                How fast it moves
              </div>
              <Claim claim={procedure.tempo} className="mt-2" />
            </Card>
            {procedure.afterAction && (
              <Card>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  What it does after a failure
                </div>
                <Claim claim={procedure.afterAction} className="mt-2" />
              </Card>
            )}
          </div>

          {procedure.preconditions.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                What has to be true before it will authorise anything
              </div>
              <div className="mt-3 space-y-3">
                {procedure.preconditions.map((claim, index) => (
                  <Claim key={index} claim={claim} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DossierSection>
  );
}

/** The record the model can be checked against. */
function History({ dossier }: { dossier: Dossier }) {
  const history = [...(dossier.history ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return (
    <DossierSection
      title="What it has actually done"
      lede="Dated decisions, each linked to the parameters it is evidence for. This is what makes the numbers below falsifiable rather than merely stated."
      empty={
        history.length === 0
          ? "No decision record has been compiled for this actor yet. Its parameters rest on the sourcing in each basis alone, with no episodes to check them against."
          : undefined
      }
    >
      <div className="space-y-3">
        {history.map((episode) => (
          <Card key={`${episode.date}-${episode.episode}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="tnum text-[12px] text-muted">
                {episode.date}
              </span>
              <span className="text-[13px] font-semibold text-navy">
                {episode.episode}
              </span>
              {episode.confidence === "low" && (
                <Pill tone="warn">thin evidence</Pill>
              )}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
              <span className="font-semibold">It {episode.choice}.</span>{" "}
              <Inline line={episode.lesson} />
            </p>
            {episode.bearsOn.length > 0 && (
              <p className="mt-2 text-[12px] text-muted">
                evidence for{" "}
                {episode.bearsOn
                  .map(
                    (parameter) =>
                      PARAMETER_COPY[parameter]?.label.toLowerCase() ??
                      parameter,
                  )
                  .join(" · ")}
              </p>
            )}
            <Basis basis={episode.basis} confidence={episode.confidence} />
          </Card>
        ))}
      </div>
    </DossierSection>
  );
}

/** The eleven numbers, each beside its reasoning and its evidence. */
function Parameters({ dossier }: { dossier: Dossier }) {
  return (
    <DossierSection
      title="The numbers the model runs on"
      lede="Every decision in a run is arithmetic over these eleven values. Each one carries the reasoning that set it, and the episodes above that bear on it."
    >
      <div className="space-y-3">
        {DOCTRINE_PARAMETERS.map((parameter) => (
          <ParameterRow
            key={parameter}
            dossier={dossier}
            parameter={parameter}
          />
        ))}
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-navy">
            How consistently it picks the best available move
          </span>
          <span className="tnum text-[15px] text-navy">
            {dossier.rationalityPrecision}
          </span>
        </div>
        <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-slate">
          On a scale where about 1 means it chooses almost at random among what
          it can reach and about 12 means it takes the highest-value option
          nearly every time. This is not a measure of competence — a fragmented
          criminal ecosystem scores low because many hands pursue local
          objectives, and that produces the wide, genuinely observed spread in
          what such an actor hits.
        </p>
      </Card>
    </DossierSection>
  );
}

function ParameterRow({
  dossier,
  parameter,
}: {
  dossier: Dossier;
  parameter: DoctrineParameter;
}) {
  const entry = dossier.doctrine[parameter];
  if (!entry) return null;
  const copy = PARAMETER_COPY[parameter];
  const episodes = episodesFor(dossier, parameter);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-[13.5px] font-semibold text-navy">
          {copy.label}
        </span>
        <div className="flex items-baseline gap-2">
          {entry.confidence === "low" && <Pill tone="warn">thin evidence</Pill>}
          <span className="tnum text-[15px] text-navy">
            {entry.value.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <ParameterBar value={entry.value} />
      </div>

      <p className="mt-2 text-[12.5px] leading-snug text-slate">
        High means: {copy.high}.
      </p>

      {episodes.length > 0 && (
        <p className="mt-2 text-[12px] leading-snug text-muted">
          read off {episodes.length}{" "}
          {episodes.length === 1 ? "episode" : "episodes"} above —{" "}
          {episodes.map((episode) => episode.episode).join("; ")}
        </p>
      )}

      <Basis
        basis={entry.basis}
        confidence={entry.confidence}
        label="why this number"
      />
    </Card>
  );
}

/** Declared ends, self-image, and who it names as the threat. */
function Worldview({ dossier }: { dossier: Dossier }) {
  const worldview = dossier.worldview;
  return (
    <DossierSection
      title="What it says it wants"
      lede="Drawn from what the institution itself published — programmes, charters, doctrine, strategy papers. What it states, not what anyone infers about it."
      empty={
        !worldview
          ? "No declared-ends research has been compiled for this actor yet. Its council reasons from the parameters and commitments alone."
          : undefined
      }
    >
      {worldview && (
        <div className="space-y-4">
          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              How it describes itself
            </div>
            <Claim claim={worldview.selfImage} className="mt-2" />
          </Card>

          {worldview.declaredEnds.length > 0 && (
            <Card>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                What it says it is trying to achieve
              </div>
              <div className="mt-3 space-y-3">
                {worldview.declaredEnds.map((claim, index) => (
                  <Claim key={index} claim={claim} />
                ))}
              </div>
            </Card>
          )}

          {worldview.threatModel.length > 0 && (
            <Card>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                What it names as the threat to itself
              </div>
              <div className="mt-3 space-y-3">
                {worldview.threatModel.map((claim, index) => (
                  <Claim key={index} claim={claim} />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              What it believes the other side will do
            </div>
            <Claim claim={worldview.adversaryModel} className="mt-2" />
          </Card>

          {worldview.declaredIdeology && (
            <Card>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                The programme it published
              </div>
              <Claim claim={worldview.declaredIdeology} className="mt-2" />
            </Card>
          )}
        </div>
      )}
    </DossierSection>
  );
}

/** Where this profile is thin, contested, or contradicts itself. */
function Weaknesses({ dossier }: { dossier: Dossier }) {
  const low = DOCTRINE_PARAMETERS.filter(
    (parameter) => dossier.doctrine[parameter]?.confidence === "low",
  );

  return (
    <DossierSection
      title="Where this profile is weak"
      lede="Written by the researcher who assembled it, and kept in full rather than summarised. A reader deciding whether to act on anything above is entitled to the argument against it at the same length as the argument for it."
    >
      <div className="space-y-4">
        {/* First, and visually apart from the survey below it: this names ONE
            field and argues it is the worst. A reviewer with an hour reads this
            and stops, so it cannot sit fourth in a list of caveats. */}
        {dossier.weakestClaim && (
          <div className="rounded-xl border border-warn bg-warn-soft p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-warn">
                Least defensible claim in this profile
              </span>
              <code className="tnum text-[12px] text-slate">
                {dossier.weakestClaim.section}
              </code>
            </div>
            <p className="mt-2.5 max-w-[76ch] text-[13.5px] leading-relaxed text-ink">
              {dossier.weakestClaim.finding}
            </p>
          </div>
        )}

        <Card>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
            What its author flagged
          </div>
          <div className="mt-3">
            <Prose source={dossier.uncertainty} />
          </div>
        </Card>

        {dossier.declaredVsObserved && (
          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Where what it says and what it does disagree
            </div>
            <div className="mt-3">
              <Prose source={dossier.declaredVsObserved} />
            </div>
          </Card>
        )}

        {low.length > 0 && (
          <Card>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Numbers resting on thin evidence
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink">
              {low
                .map((parameter) => PARAMETER_COPY[parameter].label)
                .join(" · ")}
            </p>
          </Card>
        )}
      </div>
    </DossierSection>
  );
}

/**
 * The citations, grouped the way the researcher filed them.
 *
 * Numbered continuously across groups rather than restarting, so "source 27" in
 * a review note means one thing on this page.
 */
function Sources({ dossier }: { dossier: Dossier }) {
  const groups = sourceGroupsFor(dossier);
  let number = 0;

  return (
    <DossierSection
      title={`Sources (${citationCount(dossier)})`}
      lede="Every number and claim above traces to one of these. A profile you disagree with is a file you can replace — the engine loads profiles as data, not code."
    >
      <div className="space-y-6">
        {groups.map((group, index) => (
          <div key={index}>
            {group.label && (
              <h3 className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </h3>
            )}
            <ol className="space-y-2">
              {group.citations.map((citation) => {
                number += 1;
                return (
                  <li
                    key={number}
                    className="flex gap-3 text-[12.5px] leading-relaxed text-slate"
                  >
                    <span className="tnum shrink-0 text-muted">{number}</span>
                    {/* Citations end in full URLs, which are single unbreakable
                        words wider than a phone. Without this the page scrolls
                        sideways. */}
                    <span className="min-w-0 break-words">
                      <Inline line={citation} />
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </DossierSection>
  );
}
