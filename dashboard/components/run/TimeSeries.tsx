"use client";

import type { RunTrace } from "../../lib/traces";

const W = 640;
const H = 130;
const PAD = { top: 12, right: 14, bottom: 20, left: 40 };

export interface Series {
  readonly label: string;
  readonly color: string;
  readonly values: readonly number[];
  /** Drawn as a dashed reference rather than a measured series. */
  readonly reference?: boolean;
}

/**
 * One or more per-tick series, with the campaign window shaded behind them.
 *
 * The shading is the point. Every question anyone asks of these curves is
 * "did the adversary cause that", and a chart that shows the effect without the
 * cause makes the reader take the answer on trust.
 */
export default function TimeSeries({
  trace,
  series,
  tick,
  yMin = 0,
  yMax = 1,
  yFormat = (v: number) => v.toFixed(2),
  title,
}: {
  trace: RunTrace;
  series: readonly Series[];
  /** Current scrub position, marked with a playhead. */
  tick: number;
  yMin?: number;
  yMax?: number;
  yFormat?: (v: number) => string;
  title: string;
}) {
  const total = trace.world.ticks;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xOf = (t: number) => PAD.left + (t / Math.max(1, total - 1)) * plotW;
  const yOf = (v: number) =>
    PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const path = (values: readonly number[]) =>
    values
      .map(
        (v, t) =>
          `${t === 0 ? "M" : "L"}${xOf(t).toFixed(2)},${yOf(v).toFixed(2)}`,
      )
      .join(" ");

  const campaign = trace.campaign;

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {title}
        </span>
        {series.map((s) => (
          <span
            key={s.label}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-text-secondary"
          >
            <span
              className="inline-block h-[2px] w-3"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={title}
      >
        {campaign && (
          <>
            <rect
              x={xOf(campaign.startTick)}
              y={PAD.top}
              width={xOf(campaign.endTick) - xOf(campaign.startTick)}
              height={plotH}
              fill="#d55181"
              opacity={0.09}
            />
            <line
              x1={xOf(campaign.startTick)}
              x2={xOf(campaign.startTick)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#d55181"
              opacity={0.5}
              strokeWidth={1}
            />
          </>
        )}

        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="currentColor"
          className="text-text-muted"
          opacity={0.4}
        />

        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.6}
            strokeDasharray={s.reference ? "3 2" : undefined}
            opacity={s.reference ? 0.6 : 1}
          />
        ))}

        {/* playhead — ties every chart to the scrubber */}
        <line
          x1={xOf(tick)}
          x2={xOf(tick)}
          y1={PAD.top - 3}
          y2={PAD.top + plotH + 3}
          stroke="currentColor"
          className="text-text-primary"
          strokeWidth={1}
          opacity={0.8}
        />

        <text
          x={PAD.left - 6}
          y={PAD.top + 8}
          textAnchor="end"
          className="fill-text-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {yFormat(yMax)}
        </text>
        <text
          x={PAD.left - 6}
          y={PAD.top + plotH}
          textAnchor="end"
          className="fill-text-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {yFormat(yMin)}
        </text>

        {campaign && (
          <text
            x={xOf(campaign.startTick) + 3}
            y={H - 8}
            className="fill-text-muted"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            campaign {campaign.startTick}–{campaign.endTick}
          </text>
        )}
        <text
          x={PAD.left}
          y={H - 8}
          className="fill-text-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          t0
        </text>
        <text
          x={PAD.left + plotW}
          y={H - 8}
          textAnchor="end"
          className="fill-text-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          t{total - 1}
        </text>
      </svg>
    </figure>
  );
}
