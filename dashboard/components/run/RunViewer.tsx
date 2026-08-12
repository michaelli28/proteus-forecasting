"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BeliefDistribution from "./BeliefDistribution";
import TimeSeries from "./TimeSeries";
import TruthTelemetry from "./TruthTelemetry";
import { ROLE_COLOR, campaignActiveAt, percent } from "../../lib/traces";
import type { RunTrace } from "../../lib/traces";

/** Ticks advanced per second while playing. Slow enough to read the histogram. */
const TICKS_PER_SECOND = 24;

/** Longest gap between frames that counts as elapsed time. */
const MAX_FRAME_MS = 100;

export default function RunViewer({ trace }: { trace: RunTrace }) {
  const last = trace.ticks.length - 1;
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let previous = performance.now();
    let carry = 0;

    const advance = (now: number) => {
      if (cancelled) return;
      // Clamped because rAF stops in a background tab: without this, coming back
      // to the page delivers one frame worth seconds of elapsed time and playback
      // teleports to the last tick instead of resuming where it was.
      const elapsed = Math.min(now - previous, MAX_FRAME_MS);
      carry += (elapsed / 1000) * TICKS_PER_SECOND;
      previous = now;
      if (carry >= 1) {
        const step = Math.floor(carry);
        carry -= step;
        setTick((current) => {
          if (current + step >= last) {
            setPlaying(false);
            return last;
          }
          return current + step;
        });
      }
      frame.current = requestAnimationFrame(advance);
    };

    frame.current = requestAnimationFrame(advance);
    return () => {
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, last]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      // Replaying from the end should start over rather than sit still.
      if (!p && tick >= last) setTick(0);
      return !p;
    });
  }, [tick, last]);

  const current = trace.ticks[tick]!;
  const active = campaignActiveAt(trace, tick);

  const adoption = trace.ticks.map((t) => t.truth.adoptionRate);
  const meanBelief = trace.ticks.map((t) => t.truth.meanBelief);
  const bimodality = trace.ticks.map((t) => t.truth.bimodality);
  const volume = trace.ticks.map((t) => t.telemetry.volume);
  const adoptions = trace.ticks.map((t) => t.truth.adoptions);
  const abandonments = trace.ticks.map((t) => t.truth.abandonments);
  const maxVolume = Math.max(1, ...volume);
  const maxCascade = Math.max(1, ...adoptions, ...abandonments);

  return (
    <div className="flex flex-col gap-8">
      {/* ── transport ── */}
      <div className="rounded-xl border border-line bg-sunken px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg border border-line-strong px-3 py-1 text-[12px] font-semibold text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {playing ? "Pause" : tick >= last ? "Replay" : "Play"}
          </button>

          <label className="flex min-w-[14rem] flex-1 items-center gap-3">
            <span className="sr-only">Day</span>
            <input
              type="range"
              min={0}
              max={last}
              value={tick}
              onChange={(e) => {
                setPlaying(false);
                setTick(Number(e.target.value));
              }}
              className="w-full accent-accent"
            />
          </label>

          <span className="text-[12.5px] tabular-nums text-ink">
            day {tick} / {last}
          </span>

          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              color: active ? ROLE_COLOR.adversary : "var(--color-muted)",
              backgroundColor: active
                ? "var(--color-warn-soft)"
                : "transparent",
            }}
          >
            {active ? "fake accounts active" : "quiet"}
          </span>
        </div>
      </div>

      {/* ── the hero: the population itself ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[18px] leading-tight">
            The population, day {tick}
          </h2>
          <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-slate">
            Each bar is how many people agree with the false claim to that
            degree. Watch the ends fill and two humps form — the population
            splitting into camps on its own, because people mostly listen to
            others already close to their view. The model was never told to
            polarize.
          </p>
        </div>
        <BeliefDistribution trace={trace} tick={current} />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-slate">
          <span>
            average agreement{" "}
            <span className="tabular-nums font-semibold text-ink">
              {current.truth.meanBelief.toFixed(2)}
            </span>
          </span>
          <span>
            split into camps{" "}
            <span className="tabular-nums font-semibold text-ink">
              {current.truth.bimodality.toFixed(2)}
            </span>
          </span>
          <span>
            believe it{" "}
            <span className="tabular-nums font-semibold text-ink">
              {percent(current.truth.adoptionRate)}
            </span>
          </span>
          <span>
            gap between groups{" "}
            <span className="tabular-nums font-semibold text-ink">
              {current.truth.clusterSeparation.toFixed(2)}
            </span>
          </span>
        </div>
      </section>

      {/* ── the boundary ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[18px] leading-tight">
            What really happened vs. what a defender could see
          </h2>
          <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-slate">
            The same day, shown twice. The left is the true state of the
            population; the right is only the public activity a defender could
            monitor. The warning system reads the right side only — which is
            what makes &ldquo;how well would we have caught this?&rdquo; a real,
            measurable number rather than a claim.
          </p>
        </div>
        <TruthTelemetry trace={trace} tick={current} />
      </section>

      {/* ── over time ── */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-[18px] leading-tight">Over the whole run</h2>
          <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-slate">
            The shaded band is the attack window. The vertical line marks the
            day you&rsquo;re scrubbed to.
          </p>
        </div>

        <TimeSeries
          trace={trace}
          tick={tick}
          title="What really happened — belief and agreement"
          series={[
            {
              label: "share who believe it",
              color: ROLE_COLOR.truth,
              values: adoption,
            },
            {
              label: "average agreement",
              color: ROLE_COLOR.threshold,
              values: meanBelief,
            },
            {
              label: "split into camps",
              color: "#8a6d1f",
              values: bimodality,
              reference: true,
            },
          ]}
        />

        <TimeSeries
          trace={trace}
          tick={tick}
          title="What really happened — people changing their minds each day"
          yMax={maxCascade}
          yFormat={(v) => String(Math.round(v))}
          series={[
            {
              label: "started believing",
              color: ROLE_COLOR.truth,
              values: adoptions,
            },
            {
              label: "stopped believing",
              color: ROLE_COLOR.adversary,
              values: abandonments,
            },
          ]}
        />

        <TimeSeries
          trace={trace}
          tick={tick}
          title="What a defender could see — activity volume"
          yMax={maxVolume}
          yFormat={(v) =>
            v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
          }
          series={[
            {
              label: "activity volume",
              color: ROLE_COLOR.telemetry,
              values: volume,
            },
          ]}
        />
      </section>
    </div>
  );
}
