import Link from "next/link";
import { notFound } from "next/navigation";
import RunViewer from "../../../components/run/RunViewer";
import { TRACES, shortId, traceById } from "../../../lib/traces";

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
    title: `PROTEUS — run ${shortId(hash)}`,
    description:
      "One simulation run, tick by tick: belief distribution, adoption cascade, and the telemetry a defender would have received.",
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-[13px] text-ink">
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
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Link
        href="/runs"
        className="font-mono text-[11px] uppercase tracking-wider text-slate underline decoration-line-strong underline-offset-2 hover:text-ink"
      >
        ← all runs
      </Link>

      <h1 className="mt-4 font-mono text-2xl font-semibold text-ink">
        run {shortId(trace.runId)}
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-slate">
        One member of a forecast ensemble. Same seed, same run — the id is the
        hash of everything that produced it.
      </p>

      <p className="mt-5 max-w-prose border-l-2 border-line-strong pl-3 text-[12px] leading-relaxed text-muted">
        {trace.caveat}
      </p>

      {/* ── what this run is ── */}
      <section className="mt-10 rounded border border-line bg-sunken px-5 py-4">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted">
          The world
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="agents" value={String(world.agents)} />
          <Fact label="clusters" value={String(world.clusters)} />
          <Fact label="narratives" value={String(world.narratives)} />
          <Fact label="ticks" value={String(world.ticks)} />
          <Fact
            label="adoption at"
            value={world.adoptionThreshold.toFixed(2)}
          />
        </div>

        <h2 className="mt-6 font-mono text-[10px] uppercase tracking-wider text-muted">
          The adversary
        </h2>
        {campaign ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Fact
                label="window"
                value={`t${campaign.startTick}–${campaign.endTick}`}
              />
              <Fact label="assets" value={String(campaign.injectionNodes)} />
              <Fact
                label="pushing toward"
                value={campaign.targetPosition.toFixed(2)}
              />
              <Fact
                label="amplification"
                value={`${campaign.amplification.toFixed(1)}×`}
              />
              <Fact
                label="coordinated"
                value={campaign.coordinated ? "yes — hub targeted" : "no"}
              />
            </div>
            {spec && (
              <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-slate">
                Drawn from risk tolerance{" "}
                <span className="font-mono text-ink">
                  {spec.riskTolerance.toFixed(0)}
                </span>{" "}
                and escalation propensity{" "}
                <span className="font-mono text-ink">
                  {spec.escalationPropensity.toFixed(0)}
                </span>
                . Risk sets reach and how extreme a position it pushes;
                escalation sets how hard and how early. {spec.rationale}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[13px] text-slate">
            None — this is a control run. Any movement below is the population
            drifting on its own.
          </p>
        )}
      </section>

      <div className="mt-10">
        <RunViewer trace={trace} />
      </div>

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Provenance
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact label="run id" value={trace.runId} />
          <Fact label="seed" value={trace.seed || "—"} />
          <Fact label="kernel" value={trace.kernelVersion} />
          <Fact label="corpus snapshot" value={trace.corpusSnapshotId} />
        </div>
        <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-muted">
          Re-running this seed reproduces this run byte for byte. That is what
          the id is for.
        </p>
      </section>
    </main>
  );
}
