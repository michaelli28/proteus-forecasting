import { ARM_COLOR, ARM_PURPOSE, percent, signed } from "../../lib/metrics";
import type { ArmSnapshot } from "../../lib/metrics";

interface ArmTableProps {
  arms: ArmSnapshot[];
}

const HEAD =
  "px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-text-muted";
const CELL =
  "px-3 py-3 font-mono text-[12px] text-text-secondary whitespace-nowrap";

/**
 * Arms are never pooled, so there is no total row and no average.
 *
 * Each arm answers a different question; a mean across them would be a number
 * describing nothing, and it is the first thing a reader would quote.
 */
export default function ArmTable({ arms }: ArmTableProps) {
  const bandCounts = new Set(arms.map((a) => a.bands));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border-green">
        <table className="w-full border-collapse">
          <thead className="bg-primary-dark/20">
            <tr>
              <th className={HEAD}>Arm</th>
              <th className={HEAD}>Bands</th>
              <th className={HEAD}>Abstained</th>
              <th className={HEAD}>Brier</th>
              <th className={HEAD}>Skill vs base rate</th>
              <th className={HEAD}>ECE</th>
              <th className={HEAD}>Coverage@1</th>
            </tr>
          </thead>
          <tbody>
            {arms.map((arm) => (
              <tr
                key={arm.arm}
                className="border-t border-border-green/40 align-top"
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {ARM_COLOR[arm.arm] && (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: ARM_COLOR[arm.arm] }}
                      />
                    )}
                    <span className="font-mono text-[12px] text-text-primary">
                      {arm.arm}
                    </span>
                  </div>
                  <div className="mt-1 max-w-[26ch] text-[11px] leading-snug text-text-muted">
                    {ARM_PURPOSE[arm.arm]}
                  </div>
                </td>
                <td className={CELL}>{arm.bands}</td>
                <td className={CELL}>
                  {arm.abstained}/{arm.questions}
                  <span className="ml-1.5 text-text-muted">
                    {percent(arm.abstentionRate)}
                  </span>
                </td>
                {arm.score ? (
                  <>
                    <td className={CELL}>{arm.score.brier.toFixed(4)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-text-primary">
                      {signed(arm.score.brierSkillVsBaseRate)}
                    </td>
                    <td className={CELL}>
                      {arm.score.expectedCalibrationError.toFixed(4)}
                    </td>
                    <td className={CELL}>
                      {arm.ensemble ? arm.ensemble.coverageAt1.toFixed(3) : "—"}
                    </td>
                  </>
                ) : (
                  <td className={CELL} colSpan={4}>
                    abstained on every question — nothing to score
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bandCounts.size > 1 && (
        <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-text-muted">
          Brier does not compare across rows with different band counts:
          spreading probability over more bands scores lower for reasons of
          arithmetic, not skill. Skill vs base rate is the column to read down.
        </p>
      )}
    </div>
  );
}
