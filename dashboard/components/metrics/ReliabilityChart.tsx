"use client";

import { useState } from "react";
import { ARM_COLOR, percent } from "../../lib/metrics";
import type { ArmSnapshot } from "../../lib/metrics";

const W = 460;
const H = 400;
const PAD = { top: 16, right: 16, bottom: 44, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const TICKS = [0, 0.25, 0.5, 0.75, 1];

interface Hover {
  arm: string;
  forecast: number;
  observed: number;
  count: number;
  x: number;
  y: number;
}

interface ReliabilityChartProps {
  arms: ArmSnapshot[];
}

const x = (v: number) => PAD.left + v * PLOT_W;
const y = (v: number) => PAD.top + (1 - v) * PLOT_H;

/** Marker radius carries bin occupancy — a one-forecast bin and a sixty-forecast
 *  bin are otherwise the same dot, and the difference is what decides whether a
 *  deviation is a finding or a sample-size accident. */
const radius = (count: number) =>
  Math.max(4, Math.min(11, 3 + Math.sqrt(count)));

export default function ReliabilityChart({ arms }: ReliabilityChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);
  const plotted = arms.filter((arm) => arm.calibration.length > 0);

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full max-w-[520px]"
          role="img"
          aria-label="Stated probability against how often it actually happened, one line per scenario"
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={PAD.top}
                x2={x(t)}
                y2={PAD.top + PLOT_H}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + PLOT_W}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={x(t)}
                y={PAD.top + PLOT_H + 18}
                textAnchor="middle"
                className="fill-muted"
                style={{ fontSize: 10 }}
              >
                {percent(t)}
              </text>
              <text
                x={PAD.left - 10}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-muted"
                style={{ fontSize: 10 }}
              >
                {percent(t)}
              </text>
            </g>
          ))}

          {/* Perfect calibration — a recessive reference, not a series. */}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
            stroke="var(--color-line-strong)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={x(0.82)}
            y={y(0.82) - 8}
            className="fill-muted"
            style={{ fontSize: 10 }}
            transform={`rotate(-45 ${x(0.82)} ${y(0.82)})`}
          >
            perfectly honest
          </text>

          {plotted.map((arm) => {
            const color = ARM_COLOR[arm.arm] ?? "var(--color-muted)";
            const path = arm.calibration
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"} ${x(p.forecast)} ${y(p.observed)}`,
              )
              .join(" ");
            return (
              <g key={arm.arm}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.65}
                />
                {arm.calibration.map((p) => (
                  <circle
                    key={`${arm.arm}-${p.forecast}`}
                    cx={x(p.forecast)}
                    cy={y(p.observed)}
                    r={radius(p.count)}
                    fill={color}
                    stroke="var(--color-surface)"
                    strokeWidth={2}
                    onMouseEnter={() =>
                      setHover({
                        arm: arm.arm,
                        forecast: p.forecast,
                        observed: p.observed,
                        count: p.count,
                        x: x(p.forecast),
                        y: y(p.observed),
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            );
          })}

          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-slate"
            style={{ fontSize: 11 }}
          >
            what it said the odds were
          </text>
          <text
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
            className="fill-slate"
            style={{ fontSize: 11 }}
          >
            how often it actually happened
          </text>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] leading-relaxed text-ink shadow-md"
            style={{
              left: `${(hover.x / W) * 100}%`,
              top: `${(hover.y / H) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <div className="font-medium text-slate">{hover.arm}</div>
            <div className="tnum">
              said {percent(hover.forecast)} → happened{" "}
              {percent(hover.observed)}
            </div>
            <div className="text-muted">
              {hover.count} forecast{hover.count === 1 ? "" : "s"} here
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {plotted.map((arm) => (
          <span
            key={arm.arm}
            className="flex items-center gap-1.5 text-[12px] text-slate"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ARM_COLOR[arm.arm] }}
            />
            {arm.arm}
          </span>
        ))}
      </div>

      <p className="mt-3 max-w-[68ch] text-[12.5px] leading-relaxed text-muted">
        On the dashed line, things it called 30% likely happened 30% of the
        time. Bigger dots are backed by more forecasts; the small ones swing a
        long way on very little evidence.
      </p>
    </div>
  );
}
