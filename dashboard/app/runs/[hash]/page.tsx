import Link from "next/link";
import { notFound } from "next/navigation";
import RunViewer from "../../../components/run/RunViewer";
import { TRACES, shortId, traceById } from "../../../lib/traces";
import { Page } from "../../../components/site/ui";
import Footer from "../../../components/site/Footer";

export function generateStaticParams() {
  return TRACES.map((trace) => ({ hash: trace.runId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  return {
    title: `Run ${shortId(hash)} — Proteus`,
    description:
      "One simulation run, day by day: how the false claim spread, and what a defender watching from outside could have seen.",
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </div>
      <div className="mt-1 truncate text-[13.5px] text-ink tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const trace = traceById(hash);
  if (!trace) notFound();

  const { world, campaign, spec } = trace;

  return (
    <>
      <Page>
        <Link
          href="/runs"
          className="text-[12px] font-semibold text-accent-strong hover:underline"
        >
          ← All runs
        </Link>

        <h1 className="mt-4 text-[clamp(1.6rem,3vw,2.2rem)] leading-tight">
          Run {shortId(trace.runId)}
        </h1>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-slate">
          One simulated run of a disinformation campaign spreading through a
          fictitious population. Nothing here is a real account, platform, or
          person. Press play to watch it unfold.
        </p>

        {/* ── the setup ── */}
        <section className="mt-8 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-[13px] font-semibold text-navy">The setup</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <Fact label="People" value={world.agents.toLocaleString("en-US")} />
            <Fact label="Social groups" value={String(world.clusters)} />
            <Fact label="Competing messages" value={String(world.narratives)} />
            <Fact label="Days simulated" value={String(world.ticks)} />
            <Fact
              label="Counts as believing at"
              value={world.adoptionThreshold.toFixed(2)}
            />
          </div>

          <h2 className="mt-6 text-[13px] font-semibold text-navy">
            The attacker
          </h2>
          {campaign ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                <Fact
                  label="Attack window"
                  value={`day ${campaign.startTick}–${campaign.endTick}`}
                />
                <Fact
                  label="Fake accounts"
                  value={String(campaign.injectionNodes)}
                />
                <Fact
                  label="Opinion it pushes"
                  value={campaign.targetPosition.toFixed(2)}
                />
                <Fact
                  label="Reach boost"
                  value={`${campaign.amplification.toFixed(1)}×`}
                />
                <Fact
                  label="Coordinated"
                  value={
                    campaign.coordinated ? "yes — hits key accounts" : "no"
                  }
                />
              </div>
              {spec && (
                <p className="mt-4 max-w-[68ch] text-[13px] leading-relaxed text-slate">
                  This attacker accepts{" "}
                  <span className="font-semibold text-ink">
                    {spec.riskTolerance.toFixed(0)}
                  </span>{" "}
                  out of 100 on risk and pushes at{" "}
                  <span className="font-semibold text-ink">
                    {spec.escalationPropensity.toFixed(0)}
                  </span>{" "}
                  out of 100 on aggression. Higher risk means more reach and a
                  more extreme target; higher aggression means it pushes harder
                  and earlier.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13.5px] text-slate">
              None — this is a control run with no attacker. Any movement below
              is the population drifting on its own.
            </p>
          )}
        </section>

        <div className="mt-10">
          <RunViewer trace={trace} />
        </div>

        <section className="mt-12 border-t border-line pt-6">
          <h2 className="text-[13px] font-semibold text-navy">
            Reproducibility
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Run ID" value={trace.runId} />
            <Fact label="Random seed" value={trace.seed || "—"} />
            <Fact label="Engine version" value={trace.kernelVersion} />
            <Fact label="Evidence snapshot" value={trace.corpusSnapshotId} />
          </div>
          <p className="mt-4 max-w-[68ch] text-[13px] leading-relaxed text-muted">
            Re-running this seed reproduces this run exactly, down to the last
            number. That is what the ID is for — anyone can check the result.
          </p>
        </section>
      </Page>
      <Footer />
    </>
  );
}
