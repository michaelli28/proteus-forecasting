import { ArmComparison } from "../../components/live/ArmComparison";
import { LiveRun } from "../../components/live/LiveRun";
import { MANIFEST } from "../../lib/live";
import { Eyebrow, Page } from "../../components/site/ui";

export const metadata = {
  title: "Watch a run — Proteus",
  description:
    "Run an adversary against a contested system and watch every decision as it is made.",
};

export default function LivePage() {
  return (
    <Page>
      <Eyebrow>Live</Eyebrow>
      <h1 className="max-w-[24ch] text-[34px] leading-[1.1]">
        Watch an adversary decide
      </h1>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-relaxed text-slate">
        Pick a system and pick who is coming after it. The model replays the
        situation several times over, and at the steps that mattered it seats
        that actor&rsquo;s own institutional gates — the offices that would
        really have to sign off — as separate agents, and makes them judge the
        same option set. You can open any one of them and read exactly what it
        was asked and what it said, down to the raw text.
      </p>
      <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-slate">
        The arithmetic underneath is unchanged and still reproduces from its
        seed. The councils never overrule it, which is what makes the places
        they disagree with it worth reading.
      </p>

      <LiveRun />

      <ArmComparison />

      <section className="mt-16 border-t border-line pt-8">
        <h2 className="text-[17px]">Where the actor profiles come from</h2>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          {MANIFEST.profileMethod}
        </p>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          Reviewed {MANIFEST.profilesReviewedAt}. Each profile carries the
          source behind every number, and the panel beside a running actor shows
          how many of its parameters rest on thin evidence. Profiles are data,
          not code — an evaluator with better sourcing replaces the file and
          reruns.
        </p>
      </section>
    </Page>
  );
}
