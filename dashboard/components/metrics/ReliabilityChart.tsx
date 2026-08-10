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

/**
 * Marker radius carries bin occupancy.
 *
 * A bin holding one forecast and a bin holding sixty are the same dot otherwise,
 * and the difference is exactly what decides whether a deviation from the
 * diagonal is a calibration finding or a sample-size accident.
 */
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
          className="w-full max-w-[520px] h-auto"
          role="img"
          aria-label="Reliability diagram: stated probability against observed frequency, one series per benchmark arm"
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={PAD.top}
                x2={x(t)}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,252,218,0.07)"
                strokeWidth={1}
              />
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + PLOT_W}
                y2={y(t)}
                stroke="rgba(255,252,218,0.07)"
                strokeWidth={1}
              />
              <text
                x={x(t)}
                y={PAD.top + PLOT_H + 18}
                textAnchor="middle"
                className="fill-text-muted"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              >
                {t}
              </text>
              <text
                x={PAD.left - 10}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-text-muted"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              >
                {t}
              </text>
            </g>
          ))}

          {/* Perfect calibration. Recessive: it is a reference, not a series. */}
          <line
            x1={x(0)}
            y1={y(0)}
            x2={x(1)}
            y2={y(1)}
            stroke="rgba(255,252,218,0.28)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {plotted.map((arm) => {
            const color = ARM_COLOR[arm.arm] ?? "rgba(255,252,218,0.4)";
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
                  opacity={0.55}
                />
                {arm.calibration.map((p) => (
                  <circle
                    key={`${arm.arm}-${p.forecast}`}
                    cx={x(p.forecast)}
                    cy={y(p.observed)}
                    r={radius(p.count)}
                    fill={color}
                    stroke="#001a0d"
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
            className="fill-text-secondary"
            style={{ fontSize: 11 }}
          >
            stated probability
          </text>
          <text
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
            className="fill-text-secondary"
            style={{ fontSize: 11 }}
          >
            observed frequency
          </text>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded border border-border-green bg-bg-dark/95 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary shadow-lg"
            style={{
              left: `${(hover.x / W) * 100}%`,
              top: `${(hover.y / H) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <div className="text-text-secondary">{hover.arm}</div>
            <div>
              said {percent(hover.forecast)} → happened{" "}
              {percent(hover.observed)}
            </div>
            <div className="text-text-muted">
              {hover.count} forecast{hover.count === 1 ? "" : "s"} in this bin
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {plotted.map((arm) => (
          <span
            key={arm.arm}
            className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: ARM_COLOR[arm.arm] }}
            />
            {arm.arm}
          </span>
        ))}
      </div>

      <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-text-muted">
        On the dashed line, things said to be 30% likely happened 30% of the
        time. Marker size is how many forecasts landed in that bin — the small
        ones move a long way on very little evidence, which is why the worst
        single bin (MCE) is not a calibration finding here.
      </p>
    </div>
  );
}
