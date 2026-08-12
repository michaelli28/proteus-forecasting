"use client";

import { useRef, useState } from "react";
import { percent } from "../../lib/metrics";
import type { OperatingPoint } from "../../lib/metrics";

const W = 620;
const H = 340;
const PAD = { top: 18, right: 96, bottom: 46, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const REFUSED_COLOR = "#b4532a"; // answerable questions wrongly refused (bad)
const CAUGHT_COLOR = "#2563a8"; // unanswerable questions correctly caught (good)

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
      <p className="text-[12.5px] text-muted">
        No caution settings were recorded in this snapshot.
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
      )
        nearest = i;
    }
    setIndex(nearest);
  }

  const active = index === null ? null : points[index]!;
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
          aria-label="How often the system stays silent as its caution setting rises"
        >
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={y(t)}
                x2={PAD.left + PLOT_W}
                y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
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

          {/* Where the shipped setting sits. */}
          <line
            x1={x(adopted)}
            y1={PAD.top}
            x2={x(adopted)}
            y2={PAD.top + PLOT_H}
            stroke="var(--color-line-strong)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={x(adopted) + 6}
            y={PAD.top + 11}
            className="fill-slate"
            style={{ fontSize: 10 }}
          >
            the setting we ship
          </text>

          <path
            d={line((p) => p.trueAbstentionRate)}
            fill="none"
            stroke={CAUGHT_COLOR}
            strokeWidth={2.5}
          />
          <path
            d={line((p) => p.falseAbstentionRate)}
            fill="none"
            stroke={REFUSED_COLOR}
            strokeWidth={2.5}
          />

          {active && (
            <g>
              <line
                x1={x(active.minSeparation)}
                y1={PAD.top}
                x2={x(active.minSeparation)}
                y2={PAD.top + PLOT_H}
                stroke="var(--color-line-strong)"
                strokeWidth={1}
              />
              <circle
                cx={x(active.minSeparation)}
                cy={y(active.trueAbstentionRate)}
                r={5}
                fill={CAUGHT_COLOR}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
              <circle
                cx={x(active.minSeparation)}
                cy={y(active.falseAbstentionRate)}
                r={5}
                fill={REFUSED_COLOR}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          )}

          <text
            x={x(last.minSeparation) + 8}
            y={y(last.trueAbstentionRate) - 9}
            style={{ fontSize: 11, fill: CAUGHT_COLOR }}
          >
            caught
          </text>
          <text
            x={x(mid.minSeparation) + 8}
            y={y(mid.falseAbstentionRate) + 18}
            style={{ fontSize: 11, fill: REFUSED_COLOR }}
          >
            wrongly skipped
          </text>

          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-slate"
            style={{ fontSize: 11 }}
          >
            how cautious the system is set to be →
          </text>
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] leading-relaxed text-ink shadow-md"
            style={{
              left: `${(x(active.minSeparation) / W) * 100}%`,
              top: "4%",
              transform: "translate(-50%, 0)",
            }}
          >
            <div style={{ color: CAUGHT_COLOR }}>
              caught {percent(active.trueAbstentionRate)} it couldn&rsquo;t
              answer
            </div>
            <div style={{ color: REFUSED_COLOR }}>
              wrongly skipped {percent(active.falseAbstentionRate)} it could
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 max-w-[68ch] text-[12.5px] leading-relaxed text-muted">
        The blue line barely moves: the system already catches what it
        can&rsquo;t answer at every setting. So turning up the caution buys
        almost nothing and only costs good answers — which is why we ship it
        low.
      </p>
    </div>
  );
}
