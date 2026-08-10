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
      <div className="rounded border border-border-green bg-primary-dark/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={toggle}
            className="rounded border border-border-green-bright px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-text-primary hover:bg-primary-dark/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-primary]"
          >
            {playing ? "Pause" : tick >= last ? "Replay" : "Play"}
          </button>

          <label className="flex min-w-[14rem] flex-1 items-center gap-3">
            <span className="sr-only">Tick</span>
            <input
              type="range"
              min={0}
              max={last}
              value={tick}
              onChange={(e) => {
                setPlaying(false);
                setTick(Number(e.target.value));
              }}
              className="w-full accent-[--color-primary]"
            />
          </label>

          <span className="font-mono text-[12px] tabular-nums text-text-primary">
            tick {String(tick).padStart(3, " ")} / {last}
          </span>

          <span
            className="rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              color: active ? ROLE_COLOR.adversary : "var(--color-text-muted)",
              border: `1px solid ${active ? ROLE_COLOR.adversary : "transparent"}`,
            }}
          >
            {active ? "campaign injecting" : "no injection"}
          </span>
        </div>
      </div>

      {/* ── the hero: the population itself ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
            The population at tick {tick}
          </h2>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
            Each bar is the number of agents holding a belief in that range.
            Watch the ends empty and interior humps form — that is bounded
            confidence doing its work, not an instruction the model was given.
          </p>
        </div>
        <BeliefDistribution trace={trace} tick={current} />
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-text-secondary">
          <span>
            mean{" "}
            <span className="tabular-nums text-text-primary">
              {current.truth.meanBelief.toFixed(3)}
            </span>
          </span>
          <span>
            bimodality{" "}
            <span className="tabular-nums text-text-primary">
              {current.truth.bimodality.toFixed(3)}
            </span>
          </span>
          <span>
            adopted{" "}
            <span className="tabular-nums text-text-primary">
              {percent(current.truth.adoptionRate)}
            </span>
          </span>
          <span>
            cluster gap{" "}
            <span className="tabular-nums text-text-primary">
              {current.truth.clusterSeparation.toFixed(3)}
            </span>
          </span>
        </div>
      </section>

      {/* ── the boundary ── */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
            Truth versus telemetry
          </h2>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
            The same tick, twice. The left column is what the simulator knows;
            the right is everything a platform could observe. Detection
            precision is measurable here precisely because the detector only
            ever reads the right column.
          </p>
        </div>
        <TruthTelemetry trace={trace} tick={current} />
      </section>

      {/* ── over time ── */}
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
            Over the whole run
          </h2>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
            The shaded band is the campaign window. The vertical line is where
            you are scrubbed to.
          </p>
        </div>

        <TimeSeries
          trace={trace}
          tick={tick}
          title="Ground truth — belief and adoption"
          series={[
            {
              label: "adoption rate",
              color: ROLE_COLOR.truth,
              values: adoption,
            },
            {
              label: "mean belief",
              color: ROLE_COLOR.threshold,
              values: meanBelief,
            },
            {
              label: "bimodality",
              color: "#9b8cf0",
              values: bimodality,
              reference: true,
            },
          ]}
        />

        <TimeSeries
          trace={trace}
          tick={tick}
          title="Ground truth — cascade, agents crossing the threshold each tick"
          yMax={maxCascade}
          yFormat={(v) => String(Math.round(v))}
          series={[
            { label: "adopted", color: ROLE_COLOR.truth, values: adoptions },
            {
              label: "abandoned",
              color: ROLE_COLOR.adversary,
              values: abandonments,
            },
          ]}
        />

        <TimeSeries
          trace={trace}
          tick={tick}
          title="Telemetry — what the defender actually receives"
          yMax={maxVolume}
          yFormat={(v) =>
            v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
          }
          series={[
            {
              label: "interaction volume",
              color: ROLE_COLOR.telemetry,
              values: volume,
            },
          ]}
        />
      </section>
    </div>
  );
}
