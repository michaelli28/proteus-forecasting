"use client";

/**
 * Where to stand, for a reader who has not read anything else.
 *
 * The controls below this offer nine actors, three scenarios and five
 * mitigations, which is 1,400-odd combinations and no indication which of them
 * say anything. Most say very little; a run where the actor declines quietly for
 * a hundred and eighty days is a correct result and a terrible first impression.
 * So each button here is a question with a configuration attached, and the
 * sentence under it is what the run will show.
 *
 * That sentence is not written here. It comes off the engine's manifest, from
 * `engine/src/scenario/presets.ts`, where a test runs every one of these across
 * six seeds and fails if the claim stops holding — which is the only reason a
 * curated demo is safe to point at a stranger.
 */

import { MANIFEST } from "../../lib/live";
import type { ScenarioPreset } from "../../lib/live";

export function Presets({
  activeId,
  running,
  onPick,
}: {
  activeId: string | null;
  running: boolean;
  onPick: (preset: ScenarioPreset) => void;
}) {
  const active = MANIFEST.presets.find((preset) => preset.id === activeId);

  return (
    <section>
      <h2 className="text-[15px]">Start from a question</h2>
      <p className="mt-1.5 max-w-[74ch] text-[13px] leading-relaxed text-slate">
        Each one sets the controls below to a setup that answers it. You can
        change anything afterwards — this is a place to start, not a fixed tour.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {MANIFEST.presets.map((preset) => {
          const selected = preset.id === activeId;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              disabled={running}
              onClick={() => onPick(preset)}
              className={`rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span
                className={`block text-[13.5px] font-semibold leading-snug ${
                  selected ? "text-accent-strong" : "text-navy"
                }`}
              >
                {preset.question}
              </span>
              <span className="mt-1.5 block text-[12px] leading-snug text-muted">
                {describe(preset)}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-4 rounded-xl border border-line bg-sunken p-5">
          <p className="max-w-[76ch] text-[13.5px] leading-relaxed text-ink">
            {active.finding}
          </p>
          <div className="mt-3.5 border-t border-line pt-3.5">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              What to watch for
            </span>
            <p className="mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-slate">
              {active.watchFor}
            </p>
          </div>
          {active.needsDeliberation && (
            <p className="mt-3 text-[12.5px] leading-snug text-warn">
              This one only makes its point when the councils actually meet, so
              that option stays on below.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The configuration in one line, so a reader can see it before they run it.
 *
 * Uses the labels the rest of the page uses rather than the ids the engine
 * takes: a line reading "russia,china" beside a control that says "Russian
 * Federation" reads as two different things being configured.
 */
function describe(preset: ScenarioPreset): string {
  const label = (id: string): string =>
    MANIFEST.actors.find((actor) => actor.id === id)?.label ?? id;
  const pack = MANIFEST.packs.find((entry) => entry.id === preset.pack);
  const defense = pack?.defenses.find(
    (entry) => entry.kind === preset.defense,
  )?.label;

  return [
    preset.actors.map(label).join(" and "),
    `against ${preset.pack.replace(/-/g, " ")}`,
    defense ? `with ${defense}` : null,
    preset.respondents.length > 0
      ? `${preset.respondents.map(label).join(", ")} watching`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
