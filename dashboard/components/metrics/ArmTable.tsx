import { ARM_COLOR, ARM_PURPOSE, percent, signed } from "../../lib/metrics";
import type { ArmSnapshot } from "../../lib/metrics";

interface ArmTableProps {
  arms: ArmSnapshot[];
}

const HEAD =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted";
const CELL = "px-4 py-3 text-[13px] text-slate whitespace-nowrap tnum";

/**
 * One row per scenario, plain-language columns.
 *
 * Arms are never pooled — each asks a different question, so there is no total
 * row and no average; a mean across them would describe nothing and would be the
 * first thing a reader quoted.
 */
export default function ArmTable({ arms }: ArmTableProps) {
  // Scrolls, never clips: overflow-hidden silently cut the right-hand columns
  // off on a narrow screen with no way to reach them.
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse">
        <thead className="bg-sunken/50">
          <tr>
            <th className={HEAD}>Scenario</th>
            <th className={HEAD}>Declined to answer</th>
            <th className={HEAD}>Better than a coin flip</th>
            <th className={HEAD}>Confidence matched reality</th>
          </tr>
        </thead>
        <tbody>
          {arms.map((arm) => (
            <tr key={arm.arm} className="border-t border-line/70 align-top">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {ARM_COLOR[arm.arm] && (
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ARM_COLOR[arm.arm] }}
                    />
                  )}
                  <span className="text-[13px] font-semibold text-ink">
                    {arm.arm}
                  </span>
                </div>
                <div className="mt-1 max-w-[30ch] text-[12px] leading-snug text-muted">
                  {ARM_PURPOSE[arm.arm]}
                </div>
              </td>
              <td className={CELL}>
                {arm.abstained}/{arm.questions}
                <span className="ml-1.5 text-muted">
                  {percent(arm.abstentionRate)}
                </span>
              </td>
              {arm.score ? (
                <>
                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold tnum">
                    <span
                      className={
                        arm.score.brierSkillVsBaseRate >= 0
                          ? "text-good"
                          : "text-warn"
                      }
                    >
                      {signed(arm.score.brierSkillVsBaseRate, 2)}
                    </span>
                  </td>
                  <td className={CELL}>
                    ±{(arm.score.expectedCalibrationError * 100).toFixed(1)} pts
                    off
                  </td>
                </>
              ) : (
                <td className="px-4 py-3 text-[13px] text-muted" colSpan={2}>
                  declined every question — nothing to score
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
