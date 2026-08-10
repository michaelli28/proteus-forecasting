import Link from "next/link";
import ModelDiagram from "../../components/run/ModelDiagram";
import { TRACES, percent, shortId } from "../../lib/traces";

export const metadata = {
  title: "PROTEUS — simulation runs",
  description:
    "Every published simulation run, tick by tick: the belief distribution, the campaign that moved it, and what a defender could have seen.",
};

export default function RunsPage() {
  const caveat = TRACES[0]!.caveat;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-2xl font-semibold text-text-primary">
        Simulation runs
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-text-secondary">
        Each run is one member of a forecast ensemble: a synthetic population,
        an adversary campaign drawn from two parameters, and 120 ticks of what
        happened. Open one to scrub through it.
      </p>

      <p className="mt-5 max-w-prose border-l-2 border-border-green-bright pl-3 text-[12px] leading-relaxed text-text-muted">
        {caveat}
      </p>

      <section className="mt-12">
        <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
          How the model works
        </h2>
        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
          Read this once and every chart on the run pages will make sense.
        </p>
        <div className="mt-5 rounded border border-border-green bg-primary-dark/20 p-4">
          <ModelDiagram />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
          Published runs
        </h2>
        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
          The adversary knobs differ per run; that spread is what the ensemble
          forecast is made of.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border-green-bright text-left">
                {[
                  "run",
                  "risk",
                  "escalation",
                  "campaign",
                  "final adoption",
                  "bimodality",
                  "detector",
                ].map((h) => (
                  <th
                    key={h}
                    className="py-2 pr-4 font-mono text-[10px] font-medium uppercase tracking-wider text-text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRACES.map((trace) => {
                const final = trace.ticks[trace.ticks.length - 1]!.truth;
                return (
                  <tr
                    key={trace.runId}
                    className="border-b border-border-green"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/runs/${trace.runId}`}
                        className="font-mono text-[12px] text-text-primary underline decoration-border-green-bright underline-offset-2 hover:decoration-text-primary"
                      >
                        {shortId(trace.runId)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {trace.spec ? trace.spec.riskTolerance.toFixed(0) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {trace.spec
                        ? trace.spec.escalationPropensity.toFixed(0)
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {trace.campaign
                        ? `${trace.campaign.startTick}–${trace.campaign.endTick}`
                        : "control"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-primary">
                      {percent(final.adoptionRate)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {final.bimodality.toFixed(3)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-text-secondary">
                      {trace.detection.compositeScore.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
