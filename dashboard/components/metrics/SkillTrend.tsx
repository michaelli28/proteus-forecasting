import { ARM_COLOR, signed } from "../../lib/metrics";
import type { BenchmarkSnapshot } from "../../lib/metrics";

interface SkillTrendProps {
  snapshots: BenchmarkSnapshot[];
}

/**
 * Skill by arm, one bar per recorded batch.
 *
 * One form that degrades: with a single snapshot it is a bar chart, with several
 * it is a comparison across batches. The alternative — drawing a trend line
 * through one point — would be inventing the very thing being measured.
 *
 * Sign is carried by position against the zero line, not by colour: colour is
 * already spoken for by arm identity, and a bar that crosses zero is the whole
 * point of the misspecified control.
 */
export default function SkillTrend({ snapshots }: SkillTrendProps) {
  const arms = snapshots[snapshots.length - 1]!.arms.map((a) => a.arm);

  const values = snapshots.flatMap((s) =>
    s.arms
      .map((a) => a.score?.brierSkillVsBaseRate)
      .filter((v): v is number => v !== undefined),
  );
  if (values.length === 0) {
    return (
      <p className="text-[12px] text-text-muted">
        No scored arms in any snapshot.
      </p>
    );
  }

  const bound = Math.max(0.1, ...values.map(Math.abs));
  // Zero sits proportionally, so a bar's length is comparable in both directions.
  const zero = (bound / (2 * bound)) * 100;

  return (
    <div>
      <div className="space-y-3">
        {arms.map((arm) => {
          const entries = snapshots.map((s) => ({
            label: s.label,
            score:
              s.arms.find((a) => a.arm === arm)?.score?.brierSkillVsBaseRate ??
              null,
          }));

          return (
            <div
              key={arm}
              className="grid grid-cols-[9rem_1fr] items-center gap-3"
            >
              <div className="flex items-center gap-2 font-mono text-[11px] text-text-secondary">
                {ARM_COLOR[arm] && (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ARM_COLOR[arm] }}
                  />
                )}
                <span className="truncate">{arm}</span>
              </div>

              <div className="space-y-1">
                {entries.map((entry) => (
                  <div key={entry.label} className="relative h-4">
                    <div
                      className="absolute inset-y-0 w-px bg-[rgba(255,252,218,0.25)]"
                      style={{ left: `${zero}%` }}
                    />
                    {entry.score === null ? (
                      <span className="absolute left-0 top-0 font-mono text-[10px] leading-4 text-text-muted">
                        abstained on every question
                      </span>
                    ) : (
                      <>
                        <div
                          className="absolute inset-y-0 rounded-[4px]"
                          style={{
                            backgroundColor:
                              ARM_COLOR[arm] ?? "rgba(255,252,218,0.35)",
                            left:
                              entry.score >= 0
                                ? `${zero}%`
                                : `${zero - (Math.abs(entry.score) / (2 * bound)) * 100}%`,
                            width: `${(Math.abs(entry.score) / (2 * bound)) * 100}%`,
                          }}
                        />
                        <span
                          className="absolute top-0 font-mono text-[10px] leading-4 text-text-secondary"
                          style={
                            entry.score >= 0
                              ? {
                                  left: `calc(${zero + (entry.score / (2 * bound)) * 100}% + 6px)`,
                                }
                              : {
                                  // Bar runs left from zero, so the label goes
                                  // left of its LEFT edge — hence minus.
                                  right: `calc(${100 - zero - (entry.score / (2 * bound)) * 100}% + 6px)`,
                                }
                          }
                        >
                          {signed(entry.score, 3)}
                          {snapshots.length > 1 && (
                            <span className="ml-1.5 text-text-muted">
                              {entry.label}
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-text-muted">
        {snapshots.length === 1
          ? "One batch recorded. A trend needs at least two, so this reads as a comparison across arms rather than over time — run the benchmark at another batch size to add a bar to each row."
          : `${snapshots.length} batches recorded, oldest first in each row.`}{" "}
        Zero is the base rate: bars to the right beat it, bars to the left do
        worse. The misspecified arm is supposed to be on the left.
      </p>
    </div>
  );
}
