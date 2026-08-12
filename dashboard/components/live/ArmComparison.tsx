/**
 * Did the mitigation work?
 *
 * The run above cannot answer that, and one of the presets exists to show why:
 * harm here is driven by when access happens to land, and that varies enough
 * between worlds to swamp most mitigations. Having made that point, the page
 * owed a reader the way to actually find out — so the engine replays every arm
 * of every scenario across the same six seeds the presets are checked against,
 * and this renders what it measured.
 *
 * Deliberately not a single "harm avoided" figure. Averaging would reproduce the
 * error the preset was built to expose: a mean hides that the same mitigation
 * helps in four worlds and hurts in two, and a defender buying on the mean is
 * buying a coin flip they were told was a discount.
 */

import { ARM_COMPARISONS, reliable } from "../../lib/arms";
import type { ArmComparison as Comparison } from "../../lib/arms";
import { formatNumber } from "../../lib/live";
import { MagnitudeCell, Pill } from "../site/ui";

export function ArmComparison() {
  const everywhereReliable = ARM_COMPARISONS.flatMap(reliable).length;
  const total = ARM_COMPARISONS.flatMap(
    (comparison) => comparison.defended,
  ).length;

  return (
    <section className="mt-16 border-t border-line pt-8">
      <h2 className="text-[17px]">Did the mitigation work?</h2>
      <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
        One run cannot tell you. Harm here is driven by when an actor happens to
        gain access relative to when acting pays, and that varies enough between
        worlds to swamp most mitigations. So every measure below was replayed
        across the same six worlds, against the actor that does the most damage
        to that system undefended. Only {everywhereReliable} of {total} came out
        ahead in all six.
      </p>

      <div className="mt-8 space-y-10">
        {ARM_COMPARISONS.map((comparison) => (
          <PackTable key={comparison.pack} comparison={comparison} />
        ))}
      </div>

      <p className="mt-8 max-w-[76ch] text-[12.5px] leading-relaxed text-muted">
        Cost is the measure&rsquo;s own price per {ARM_COMPARISONS[0]?.tickUnit}
        , in the units the scenario declares; harm is in the units its oracle
        declares. They are different units and no ratio between them is offered
        here, because dividing one by the other would produce a return figure
        that looks like money and is not.
      </p>
    </section>
  );
}

function PackTable({ comparison }: { comparison: Comparison }) {
  const seeds = comparison.seeds.length;
  const ceiling = Math.max(
    comparison.baseline.median,
    ...comparison.defended.map((arm) => arm.median),
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[14px] font-semibold text-navy">
          {comparison.pack.replace(/-/g, " ")}
        </h3>
        <span className="text-[12.5px] text-muted">
          against {comparison.actorLabel} · {comparison.harmUnit}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-4 font-semibold">Measure</th>
              <th className="py-2 pr-4 text-right font-semibold">
                Median harm
              </th>
              <th className="py-2 pr-4 font-semibold">Across six worlds</th>
              <th className="py-2 pr-4 text-right font-semibold">
                Cost / {comparison.tickUnit}
              </th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="no mitigation"
              arm={comparison.baseline}
              seeds={seeds}
              ceiling={ceiling}
              baseline
            />
            {comparison.defended.map((arm) => (
              <Row
                key={arm.defense ?? "none"}
                label={arm.label}
                arm={arm}
                seeds={seeds}
                ceiling={ceiling}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  label,
  arm,
  seeds,
  ceiling,
  baseline = false,
}: {
  label: string;
  arm: {
    median: number;
    best: number;
    worst: number;
    beatBaseline: number;
    costPerTick: number;
  };
  seeds: number;
  ceiling: number;
  baseline?: boolean;
}) {
  const always = !baseline && arm.beatBaseline === seeds;

  return (
    <tr className="border-b border-line align-baseline last:border-0">
      <td className="py-2.5 pr-4">
        <span className={baseline ? "text-slate" : "text-ink"}>{label}</span>
      </td>
      <td className="py-2.5 pr-4">
        <MagnitudeCell
          fraction={ceiling > 0 ? arm.median / ceiling : 0}
          tone={baseline ? "warn" : "accent"}
        >
          {formatNumber(arm.median)}
        </MagnitudeCell>
      </td>
      <td className="py-2.5 pr-4">
        {baseline ? (
          <span className="tnum text-[12.5px] text-muted">
            {formatNumber(arm.best)} to {formatNumber(arm.worst)}
          </span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tnum text-[12.5px] text-muted">
              {formatNumber(arm.best)} to {formatNumber(arm.worst)}
            </span>
            {/* Only the measure that never lost gets a mark. A badge on every
                row would stop telling a reader which rows differ. */}
            {always ? (
              <Pill tone="good">better in all {seeds}</Pill>
            ) : (
              <span className="text-[12px] text-warn">
                worse in {seeds - arm.beatBaseline} of {seeds}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="tnum py-2.5 pr-4 text-right text-[12.5px] text-slate">
        {baseline ? "—" : arm.costPerTick}
      </td>
    </tr>
  );
}
