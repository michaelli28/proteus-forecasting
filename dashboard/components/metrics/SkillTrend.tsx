import { ARM_COLOR, signed } from "../../lib/metrics";
import type { BenchmarkSnapshot } from "../../lib/metrics";

interface SkillTrendProps {
  snapshots: BenchmarkSnapshot[];
}

/**
 * Skill by scenario, one bar per recorded batch. Bars right of zero beat a
 * coin-flip baseline; bars left do worse. Sign is carried by position against
 * the zero line, not colour — colour is already spoken for by scenario identity,
 * and a bar crossing zero is the whole point of the misspecified control.
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
      <p className="text-[12.5px] text-muted">
        No scored scenarios in any snapshot.
      </p>
    );
  }

  const bound = Math.max(0.1, ...values.map(Math.abs));
  const zero = 50;

  return (
    <div>
      <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
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
              <div className="flex items-center gap-2 text-[12px] text-slate">
                {ARM_COLOR[arm] && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ARM_COLOR[arm] }}
                  />
                )}
                <span className="truncate">{arm}</span>
              </div>
              <div className="space-y-1">
                {entries.map((entry) => (
                  <div key={entry.label} className="relative h-4">
                    <div
                      className="absolute inset-y-0 w-px bg-line-strong"
                      style={{ left: `${zero}%` }}
                    />
                    {entry.score === null ? (
                      <span className="absolute left-0 top-0 text-[11px] leading-4 text-muted">
                        declined every question
                      </span>
                    ) : (
                      <>
                        <div
                          className="absolute inset-y-0 rounded-[4px]"
                          style={{
                            backgroundColor:
                              ARM_COLOR[arm] ?? "var(--color-muted)",
                            left:
                              entry.score >= 0
                                ? `${zero}%`
                                : `${zero - (Math.abs(entry.score) / (2 * bound)) * 100}%`,
                            width: `${(Math.abs(entry.score) / (2 * bound)) * 100}%`,
                          }}
                        />
                        <span
                          className="absolute top-0 text-[11px] leading-4 text-slate tnum"
                          style={
                            entry.score >= 0
                              ? {
                                  left: `calc(${zero + (entry.score / (2 * bound)) * 100}% + 6px)`,
                                }
                              : {
                                  right: `calc(${100 - zero - (entry.score / (2 * bound)) * 100}% + 6px)`,
                                }
                          }
                        >
                          {signed(entry.score, 2)}
                          {snapshots.length > 1 && (
                            <span className="ml-1.5 text-muted">
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
      <p className="mt-3 max-w-[68ch] text-[12.5px] leading-relaxed text-muted">
        Zero is a plain coin-flip. Bars to the right did better than that; to
        the left, worse.
      </p>
    </div>
  );
}
