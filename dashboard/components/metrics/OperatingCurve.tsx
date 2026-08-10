"use client";

import { useRef, useState } from "react";
import { percent } from "../../lib/metrics";
import type { OperatingPoint } from "../../lib/metrics";

const W = 620;
const H = 340;
const PAD = { top: 18, right: 96, bottom: 46, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const FALSE_COLOR = "#d95926";
const TRUE_COLOR = "#3987e5";

const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

interface OperatingCurveProps {
  points: OperatingPoint[];
  adopted: number;
}

export default function OperatingCurve({
  points,
  adopted,
}: OperatingCurveProps) {
  const [index, setIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0) {
    return (
      <p className="text-[12px] text-text-muted">
        No operating curve in this snapshot — regenerate it with a minSeparation
        sweep.
      </p>
    );
  }

  const maxX = Math.max(...points.map((p) => p.minSeparation), 1);
  const x = (v: number) => PAD.left + (v / maxX) * PLOT_W;
  const y = (v: number) => PAD.top + (1 - v) * PLOT_H;

  const line = (pick: (p: OperatingPoint) => number) =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${x(p.minSeparation)} ${y(pick(p))}`,
      )
      .join(" ");

  function onMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * W;
    const value = ((localX - PAD.left) / PLOT_W) * maxX;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (
        Math.abs(points[i]!.minSeparation - value) <
        Math.abs(points[nearest]!.minSeparation - value)
      ) {
        nearest = i;
      }
    }
    setIndex(nearest);
  }

  const active = index === null ? null : points[index]!;
  // The two series converge on 100%, so they cannot both be labelled at the
  // line end, and the rising one cannot be labelled where it is flat at zero.
  // Label the flat series at the right edge and the rising one mid-climb.
  const last = points[points.length - 1]!;
  const mid = points.reduce((best, p) =>
    Math.abs(p.minSeparation - maxX / 2) <
    Math.abs(best.minSeparation - maxX / 2)
      ? p
      : best,
  );

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[440px]"
          onMouseMove={onMove}
          onMouseLeave={() => setIndex(null)}
          role="img"
          aria-label="Abstention rates as the minimum separation threshold rises"
        >
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + PLOT_W}
                y2={y(t)}
                stroke="rgba(255,252,218,0.07)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 3}
                textAnchor="end"
                className="fill-text-muted"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
              >
                {percent(t)}
              </text>
            </g>
          ))}

          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text
              key={t}
              x={x(t)}
              y={PAD.top + PLOT_H + 18}
              textAnchor="middle"
              className="fill-text-muted"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {t}
            </text>
          ))}

          {/* Where the gate actually sits. */}
          <line
            x1={x(adopted)}
            y1={PAD.top}
            x2={x(adopted)}
            y2={PAD.top + PLOT_H}
            stroke="rgba(255,252,218,0.45)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={x(adopted) + 6}
            y={PAD.top + 11}
            className="fill-text-secondary"
            style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          >
            shipped {adopted}
          </text>

          <path
            d={line((p) => p.trueAbstentionRate)}
            fill="none"
            stroke={TRUE_COLOR}
            strokeWidth={2}
          />
          <path
            d={line((p) => p.falseAbstentionRate)}
            fill="none"
            stroke={FALSE_COLOR}
            strokeWidth={2}
          />

          {active && (
            <g>
              <line
                x1={x(active.minSeparation)}
                y1={PAD.top}
                x2={x(active.minSeparation)}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,252,218,0.25)"
                strokeWidth={1}
              />
              <circle
                cx={x(active.minSeparation)}
                cy={y(active.trueAbstentionRate)}
                r={5}
                fill={TRUE_COLOR}
                stroke="#001a0d"
                strokeWidth={2}
              />
              <circle
                cx={x(active.minSeparation)}
                cy={y(active.falseAbstentionRate)}
                r={5}
                fill={FALSE_COLOR}
                stroke="#001a0d"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Flat series labelled at the right edge, rising series mid-climb. */}
          <text
            x={x(last.minSeparation) + 8}
            y={y(last.trueAbstentionRate) - 9}
            style={{
              fontSize: 11,
              fill: TRUE_COLOR,
              fontFamily: "var(--font-mono)",
            }}
          >
            caught
          </text>
          <text
            x={x(mid.minSeparation) + 8}
            y={y(mid.falseAbstentionRate) + 18}
            style={{
              fontSize: 11,
              fill: FALSE_COLOR,
              fontFamily: "var(--font-mono)",
            }}
          >
            refused
          </text>

          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-text-secondary"
            style={{ fontSize: 11 }}
          >
            minSeparation threshold
          </text>
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded border border-border-green bg-bg-dark/95 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary shadow-lg"
            style={{
              left: `${(x(active.minSeparation) / W) * 100}%`,
              top: "4%",
              transform: "translate(-50%, 0)",
            }}
          >
            <div className="text-text-secondary">
              threshold {active.minSeparation}
            </div>
            <div style={{ color: TRUE_COLOR }}>
              caught {percent(active.trueAbstentionRate)} of unanswerable
            </div>
            <div style={{ color: FALSE_COLOR }}>
              refused {percent(active.falseAbstentionRate)} of answerable
            </div>
            {active.undecidable > 0 && (
              <div className="text-text-muted">
                {active.undecidable} question(s) this setting could not run
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: TRUE_COLOR }}
          />
          caught — unanswerable questions refused
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: FALSE_COLOR }}
          />
          refused — answerable questions refused
        </span>
      </div>

      <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-text-muted">
        The blue line never moves: everything unanswerable is already caught by
        a different gate condition, at every setting including zero. So raising
        this threshold buys nothing and costs the orange line.
      </p>
    </div>
  );
}
