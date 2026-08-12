"use client";

import { ROLE_COLOR } from "../../lib/traces";
import type { RunTrace, TraceTick } from "../../lib/traces";

const W = 640;
const H = 220;
const PAD = { top: 14, right: 14, bottom: 34, left: 40 };

/**
 * The population's belief distribution at one tick.
 *
 * The summary measures say a population is bimodal; only this shows it
 * splitting. Two reference lines carry the meaning the bars alone cannot: where
 * "adopted" begins, and where the adversary is pushing.
 *
 * The y-axis is fixed across every tick on purpose. Rescaling per tick makes a
 * distribution that is collapsing look identical to one that is spreading, and
 * scrubbing would show motion that is not in the data.
 */
export default function BeliefDistribution({
  trace,
  tick,
}: {
  trace: RunTrace;
  tick: TraceTick;
}) {
  const bins = tick.truth.beliefHistogram;
  const binCount = bins.length;

  // Fixed to the tallest bar the run ever reaches, so bar heights are
  // comparable between ticks.
  const yMax = Math.max(
    1,
    ...trace.ticks.flatMap((t) => t.truth.beliefHistogram),
  );

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const barW = plotW / binCount;

  const xOf = (value01: number) => PAD.left + value01 * plotW;
  const yOf = (count: number) => PAD.top + plotH - (count / yMax) * plotH;

  const threshold = trace.world.adoptionThreshold;
  const target = trace.campaign?.targetPosition ?? null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`How strongly people agree with the false claim on day ${tick.tick}. Average agreement ${tick.truth.meanBelief.toFixed(3)}, ${(tick.truth.adoptionRate * 100).toFixed(1)} percent believe it.`}
      >
        {/* adopted region — everything at or above the threshold */}
        <rect
          x={xOf(threshold)}
          y={PAD.top}
          width={plotW - (xOf(threshold) - PAD.left)}
          height={plotH}
          fill={ROLE_COLOR.threshold}
          opacity={0.07}
        />

        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={xOf(g)}
            x2={xOf(g)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="currentColor"
            className="text-muted"
            opacity={0.15}
          />
        ))}

        {bins.map((count, i) => {
          const x = xOf(i / binCount);
          const y = yOf(count);
          const adopted = i / binCount >= threshold;
          return (
            <rect
              key={i}
              x={x + 0.5}
              y={y}
              width={Math.max(0.5, barW - 1)}
              height={PAD.top + plotH - y}
              fill={adopted ? ROLE_COLOR.threshold : ROLE_COLOR.truth}
              opacity={count === 0 ? 0 : 0.85}
            />
          );
        })}

        {/* adoption threshold */}
        <line
          x1={xOf(threshold)}
          x2={xOf(threshold)}
          y1={PAD.top - 4}
          y2={PAD.top + plotH}
          stroke={ROLE_COLOR.threshold}
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
        <text
          x={xOf(threshold) + 4}
          y={PAD.top + 8}
          className="fill-slate"
          fontSize={9}
        >
          believe it →
        </text>

        {/* where the adversary is pushing */}
        {target !== null && (
          <>
            <line
              x1={xOf(target)}
              x2={xOf(target)}
              y1={PAD.top - 4}
              y2={PAD.top + plotH}
              stroke={ROLE_COLOR.adversary}
              strokeWidth={1.5}
            />
            <text
              x={xOf(target) + 4}
              y={PAD.top + 22}
              className="fill-slate"
              fontSize={9}
            >
              where the attack pushes
            </text>
          </>
        )}

        {/* population mean */}
        <polygon
          points={`${xOf(tick.truth.meanBelief)},${PAD.top + plotH + 2} ${xOf(tick.truth.meanBelief) - 4},${PAD.top + plotH + 9} ${xOf(tick.truth.meanBelief) + 4},${PAD.top + plotH + 9}`}
          fill="currentColor"
          className="text-ink"
        />

        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="currentColor"
          className="text-muted"
          opacity={0.4}
        />

        {[0, 0.5, 1].map((g) => (
          <text
            key={g}
            x={xOf(g)}
            y={H - 16}
            textAnchor="middle"
            className="fill-muted"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            {g.toFixed(1)}
          </text>
        ))}
        <text
          x={PAD.left + plotW / 2}
          y={H - 4}
          textAnchor="middle"
          className="fill-muted"
          fontSize={9}
        >
          how strongly people agree with the false claim →
        </text>

        <text
          x={PAD.left - 6}
          y={PAD.top + 8}
          textAnchor="end"
          className="fill-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {yMax}
        </text>
        <text
          x={PAD.left - 6}
          y={PAD.top + plotH}
          textAnchor="end"
          className="fill-muted"
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          0
        </text>
      </svg>
      <figcaption className="mt-1 text-[11px] text-muted">
        The height scale stays fixed as you move through the days, so the shape
        is comparable day to day.
      </figcaption>
    </figure>
  );
}
