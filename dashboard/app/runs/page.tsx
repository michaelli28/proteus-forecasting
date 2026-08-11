import Link from "next/link";
import { TRACES, percent, shortId } from "../../lib/traces";
import { Page } from "../../components/site/ui";
import { Reveal } from "../../components/site/motion";
import Footer from "../../components/site/Footer";

export const metadata = {
  title: "Runs — Proteus",
  description:
    "Individual simulation runs from the influence-operations example: what the adversary tried, how far the narrative spread, and how detectable it was.",
};

const HEAD =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted";

export default function RunsPage() {
  return (
    <>
      <Page>
        <Reveal as="section" className="pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Worked example · Influence operations
          </div>
          <h1 className="mt-3 max-w-[20ch] text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08]">
            Individual runs, opened up.
          </h1>
          <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-slate">
            A different worked example: a coordinated disinformation campaign
            spreading through a synthetic population. Each row is one simulated
            run with a different adversary. Open one to watch it unfold tick by
            tick — and to see the sharp line the system keeps between what
            really happened and what a defender watching from outside could
            actually see.
          </p>
          <p className="mt-4 max-w-[64ch] text-[14px] leading-relaxed text-muted">
            Every figure comes from a simulation of a fictitious population. No
            real account, platform, or person is involved.
          </p>
        </Reveal>

        <section className="mt-12">
          <h2 className="text-[18px] leading-tight">The runs</h2>
          <p className="mt-1.5 max-w-[64ch] text-[13.5px] leading-relaxed text-slate">
            Two dials set each adversary: how much risk it accepts, and how
            aggressively it pushes. That spread is what a combined forecast is
            built from.
          </p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead className="bg-sunken/50">
                <tr>
                  <th className={HEAD}>Run</th>
                  <th className={HEAD}>Risk</th>
                  <th className={HEAD}>Aggression</th>
                  <th className={HEAD}>Attack window</th>
                  <th className={HEAD}>Believed it</th>
                  <th className={HEAD}>How split</th>
                  <th className={HEAD}>Detectability</th>
                </tr>
              </thead>
              <tbody>
                {TRACES.map((trace) => {
                  const final = trace.ticks[trace.ticks.length - 1]!.truth;
                  return (
                    <tr key={trace.runId} className="border-t border-line/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/runs/${trace.runId}`}
                          className="font-semibold text-accent-strong underline decoration-line-strong underline-offset-2 hover:decoration-accent"
                        >
                          {shortId(trace.runId)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tnum text-slate">
                        {trace.spec ? trace.spec.riskTolerance.toFixed(0) : "—"}
                      </td>
                      <td className="px-4 py-3 tnum text-slate">
                        {trace.spec
                          ? trace.spec.escalationPropensity.toFixed(0)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tnum text-slate">
                        {trace.campaign
                          ? `day ${trace.campaign.startTick}–${trace.campaign.endTick}`
                          : "no attack (control)"}
                      </td>
                      <td className="px-4 py-3 tnum font-semibold text-ink">
                        {percent(final.adoptionRate)}
                      </td>
                      <td className="px-4 py-3 tnum text-slate">
                        {final.bimodality.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 tnum text-slate">
                        {percent(trace.detection.compositeScore)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-[70ch] text-[12.5px] leading-relaxed text-muted">
            <strong className="font-semibold text-ink">Believed it</strong> is
            the share of the population that ended up adopting the narrative.{" "}
            <strong className="font-semibold text-ink">How split</strong> is
            whether the population polarized into two camps (higher = more
            split).{" "}
            <strong className="font-semibold text-ink">Detectability</strong> is
            how strongly the campaign showed up in the activity a defender could
            monitor.
          </p>
        </section>
      </Page>
      <Footer />
    </>
  );
}
