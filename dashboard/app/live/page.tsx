import { ArmComparison } from "../../components/live/ArmComparison";
import { LiveRun } from "../../components/live/LiveRun";
import { MANIFEST } from "../../lib/live";
import { Eyebrow, Page } from "../../components/site/ui";

export const metadata = {
  title: "Watch a run — Proteus",
  description:
    "Run an attacker against a system it wants to disrupt and watch every decision as it is made.",
};

export default function LivePage() {
  return (
    <Page>
      <Eyebrow>Live</Eyebrow>
      <h1 className="max-w-[24ch] text-[34px] leading-[1.1]">
        Watch an attacker decide
      </h1>
      <p className="mt-4 max-w-[72ch] text-[15px] leading-relaxed text-slate">
        Pick a system and pick who is coming after it. The calculation replays
        the situation several times over. At the steps that mattered, it puts
        that actor&rsquo;s own officials in the room — the ones who would really
        have to sign off — as separate agents, and asks each of them to judge
        the same set of choices. You can open any one of them and read exactly
        what it was asked and what it said, word for word.
      </p>
      <p className="mt-3 max-w-[72ch] text-[15px] leading-relaxed text-slate">
        The calculation underneath — the fixed scoring the simulation runs, with
        no AI in it — is unchanged, and still gives the same answer from the
        same seed. The councils never overrule it, which is what makes the
        places they disagree with it worth reading.
      </p>

      <LiveRun />

      <ArmComparison />

      <section className="mt-16 border-t border-line pt-8">
        <h2 className="text-[17px]">Where the actor profiles come from</h2>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          {MANIFEST.profileMethod}
        </p>
        <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
          Reviewed {MANIFEST.profilesReviewedAt}. Each profile shows where every
          number came from, and the panel beside a running actor shows how many
          of those numbers rest on thin evidence. Profiles are data, not code —
          an evaluator with better sources replaces the file and runs it again.
        </p>
      </section>
    </Page>
  );
}
