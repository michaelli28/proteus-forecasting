/**
 * Did the mitigation work?
 *
 * The run above cannot answer that, and one of the presets exists to show why:
 * harm here is driven by when access happens to land, and that varies enough
 * between worlds to swamp most mitigations. So the engine replays every arm of
 * every scenario across the same 200 worlds, and this renders what it measured.
 *
 * Average harm ranks the rows, but it never travels alone: each row also shows
 * how many worlds the defense won, left unchanged and lost, and how far its
 * average is from no defense. Neighbours the worlds cannot separate are named.
 */

import { ARM_COMPARISONS, clearlyHelps, unresolvedRuns } from "../../lib/arms";
import type { ArmComparison as Comparison, ArmOutcome } from "../../lib/arms";
import { formatNumber } from "../../lib/live";
import { MagnitudeCell } from "../site/ui";

export function ArmComparison() {
  const defenses = ARM_COMPARISONS.flatMap((comparison) => comparison.defended);
  const helps = ARM_COMPARISONS.flatMap(clearlyHelps).length;
  const everywhere = defenses.filter(
    (arm) => arm.lostToBaseline === 0 && arm.tiedBaseline === 0,
  ).length;
  const worlds = ARM_COMPARISONS[0]?.seeds.length ?? 0;

  return (
    <section className="mt-16 border-t border-line pt-8">
      <h2 className="text-[17px]">Did the defense work?</h2>
      <p className="mt-3 max-w-[76ch] text-[13.5px] leading-relaxed text-slate">
        One run cannot tell you. Harm here depends on whether an actor gains
        access at a moment when acting pays off, and that swings enough between
        worlds to outweigh most defenses. So every defense below was replayed
        across the same {worlds} worlds, against the actor that does the most
        damage to that system on average with no defense. {helps} of{" "}
        {defenses.length} lower average harm by more than chance;{" "}
        {everywhere === 0
          ? "none is better in every world."
          : `${everywhere} ${everywhere === 1 ? "is" : "are"} better in every world.`}
      </p>

      <div className="mt-8 space-y-10">
        {ARM_COMPARISONS.map((comparison) => (
          <PackTable key={comparison.pack} comparison={comparison} />
        ))}
      </div>

      <p className="mt-8 max-w-[76ch] text-[12.5px] leading-relaxed text-muted">
        Ranges are 95% intervals from resampling the {worlds} worlds. Cost is
        the defense&rsquo;s own price per {ARM_COMPARISONS[0]?.tickUnit}, in the
        units the scenario declares; harm is in the units that scenario declares
        for harm. They are different units and no ratio between them is offered
        here, because dividing one by the other would produce a return figure
        that looks like money and is not.
      </p>
    </section>
  );
}

function PackTable({ comparison }: { comparison: Comparison }) {
  const worlds = comparison.seeds.length;
  const ceiling = Math.max(
    comparison.baseline.mean,
    ...comparison.defended.map((arm) => arm.mean),
  );
  const ties = unresolvedRuns(comparison);

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
        <table className="w-full min-w-[52rem] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-4 font-semibold">Defense</th>
              <th className="py-2 pr-4 text-right font-semibold">
                Average harm
              </th>
              <th className="py-2 pr-4 font-semibold">
                Across {worlds} worlds
              </th>
              <th className="py-2 pr-4 text-right font-semibold">
                Change vs no defense
              </th>
              <th className="py-2 pr-4 text-right font-semibold">
                Cost / {comparison.tickUnit}
              </th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="no defense"
              arm={comparison.baseline}
              ceiling={ceiling}
              baseline
            />
            {comparison.defended.map((arm) => (
              <Row
                key={arm.defense ?? "none"}
                label={arm.label}
                arm={arm}
                ceiling={ceiling}
              />
            ))}
          </tbody>
        </table>
      </div>

      {ties.length > 0 && (
        <p className="mt-2 text-[12.5px] text-muted">
          {worlds} worlds cannot tell apart:{" "}
          {ties.map((run) => listOf(run.map((arm) => arm.label))).join("; ")}.
        </p>
      )}
    </div>
  );
}

function listOf(items: string[]): string {
  return items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function Row({
  label,
  arm,
  ceiling,
  baseline = false,
}: {
  label: string;
  arm: ArmOutcome;
  ceiling: number;
  baseline?: boolean;
}) {
  const change = arm.changeVsBaseline;

  return (
    <tr className="border-b border-line align-baseline last:border-0">
      <td className="py-2.5 pr-4">
        <span className={baseline ? "text-slate" : "text-ink"}>{label}</span>
      </td>
      <td className="py-2.5 pr-4">
        <MagnitudeCell
          fraction={ceiling > 0 ? arm.mean / ceiling : 0}
          tone={baseline ? "warn" : "accent"}
        >
          {formatNumber(arm.mean)}
        </MagnitudeCell>
      </td>
      <td className="tnum py-2.5 pr-4 text-[12.5px] text-muted">
        {baseline ? (
          `${formatNumber(arm.best)} to ${formatNumber(arm.worst)}`
        ) : (
          <>
            better in {arm.beatBaseline}, no change in {arm.tiedBaseline},
            worse in {arm.lostToBaseline}
          </>
        )}
      </td>
      <td className="tnum py-2.5 pr-4 text-right text-[12.5px] text-slate">
        {change
          ? `${formatNumber(change.estimate)} (${formatNumber(change.lower)} to ${formatNumber(change.upper)})`
          : "—"}
      </td>
      <td className="tnum py-2.5 pr-4 text-right text-[12.5px] text-slate">
        {baseline ? "—" : arm.costPerTick}
      </td>
    </tr>
  );
}
