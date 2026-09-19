/**
 * What happens when the forecaster's starting assumption is wrong.
 *
 * The refusal rule cannot see that failure: it looks at how the forecasts
 * spread, and a wrong assumption produces confident, tidy forecasts. This
 * renders the separate check the engine runs on early activity data, with its
 * two measured blind spots next to its hits. Every number is read from
 * `data/misspec-check.json`; nothing is recomputed here.
 */

import { MISSPEC } from "../../lib/misspec";
import { signed } from "../../lib/metrics";
import { MagnitudeCell } from "../site/ui";

const HEAD =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted";
const CELL = "px-4 py-3 text-[13px] text-slate whitespace-nowrap tnum";

export default function WhereItFails() {
  const { dose, blind, byBox, falseAlarms, prereg } = MISSPEC;
  const right = dose.find((row) => row.delta === 0)!;
  const worstBox = Object.entries(byBox)
    .map(([box, cells]) => ({ box, top: cells.find((c) => c.delta === 30)! }))
    .sort((a, b) => a.top.alarms / a.top.n - b.top.alarms / b.top.n)[0]!;
  const otherBoxes = Object.values(byBox)
    .map((cells) => cells.find((c) => c.delta === 30)!)
    .filter((cell) => cell !== worstBox.top);
  const maxUnresolved = Math.max(...dose.map((row) => row.unresolved));
  const [risk, escalation] = worstBox.box.slice(1, -1).split(",");

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[30rem] border-collapse">
          <thead className="bg-sunken/50">
            <tr>
              <th className={HEAD}>Starting assumption off by</th>
              <th className={HEAD}>
                Check flagged, after {prereg.primaryT0} of 120 steps
              </th>
              <th className={HEAD}>Forecast vs a coin flip</th>
            </tr>
          </thead>
          <tbody>
            {dose.map((row) => (
              <tr key={row.delta} className="border-t border-line/70">
                <td className={CELL}>
                  {row.delta === 0 ? "not off" : `${row.delta} points`}
                </td>
                <td className="px-4 py-1.5">
                  <MagnitudeCell
                    fraction={row.alarms / row.n}
                    tone={row.delta === 0 ? "warn" : "accent"}
                  >
                    {row.alarms} of {row.n}
                  </MagnitudeCell>
                </td>
                <td
                  className={`${CELL} font-semibold ${row.skill >= 0 ? "text-good" : "text-warn"}`}
                >
                  {signed(row.skill, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-slate">
        <li>
          <span className="font-semibold text-ink">False alarms.</span> When the
          starting assumption is right, it flags {falseAlarms.alarms} of{" "}
          {falseAlarms.n} questions. The math promises at most{" "}
          {(falseAlarms.bound * 100).toFixed(1)}% on average over the
          assumption&rsquo;s range, not for every single question.
        </li>
        <li>
          <span className="font-semibold text-ink">
            Blind spot: a mistake the activity data cannot show.
          </span>{" "}
          If the real world counts adoption at {blind.threshold} instead of 0.6,
          the activity data is identical, so the check flags {blind.alarms} of{" "}
          {blind.n}, the same as when nothing is wrong. The forecast still falls
          from {signed(right.skill, 2)} to {signed(blind.skill, 2)} against a
          coin flip.
        </li>
        <li>
          <span className="font-semibold text-ink">
            Blind spot: one of the four scenarios.
          </span>{" "}
          In the scenario centred on risk tolerance {risk} and escalation{" "}
          {escalation} (both out of 100) it flagged {worstBox.top.alarms} of{" "}
          {worstBox.top.n} at the largest error, against{" "}
          {otherBoxes.map((c) => `${c.alarms} of ${c.n}`).join(", ")} in the
          other three.
        </li>
      </ul>

      <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-muted">
        Scores leave out questions whose answer fell outside every range (up to{" "}
        {maxUnresolved} of {right.n}). Simulated world only. The check&rsquo;s
        settings were fixed before these questions were scored.
      </p>
    </div>
  );
}
