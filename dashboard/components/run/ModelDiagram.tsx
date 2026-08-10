import { ROLE_COLOR } from "../../lib/traces";

const W = 700;
const H = 300;

function Box({
  x,
  y,
  w,
  h,
  color,
  dashed,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  dashed?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={3}
      fill={color}
      fillOpacity={0.08}
      stroke={color}
      strokeWidth={1}
      strokeDasharray={dashed ? "3 2" : undefined}
    />
  );
}

function Label({
  x,
  y,
  children,
  size = 11,
  anchor = "start",
  className = "fill-text-primary",
  mono = true,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: "start" | "middle" | "end";
  className?: string;
  mono?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      className={className}
      fontFamily={mono ? "var(--font-mono)" : "var(--font-sans)"}
    >
      {children}
    </text>
  );
}

function Arrow({
  from,
  to,
  color,
  dashed,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
  dashed?: boolean;
}) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2 - 5}
        y2={y2}
        stroke={color}
        strokeWidth={1.2}
        strokeDasharray={dashed ? "3 2" : undefined}
        opacity={0.85}
      />
      <polygon
        points={`${x2},${y2} ${x2 - 6},${y2 - 3} ${x2 - 6},${y2 + 3}`}
        fill={color}
        opacity={0.85}
      />
    </g>
  );
}

/**
 * How one agent's belief moves, and which of the two streams each result joins.
 *
 * Drawn rather than described because the single most misread thing about this
 * model is that the adversary does not persuade the population directly — it
 * operates a small set of assets, and everything else is ordinary peer
 * influence that the assets have to pass through a confidence bound to reach.
 */
export default function ModelDiagram() {
  const inX = 14;
  const inW = 176;
  const midX = 260;
  const midW = 150;
  const outX = 486;
  const outW = 200;

  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[560px]"
          role="img"
          aria-label="Diagram: peer influence gated by a confidence bound, media diet, and adversary injection into owned assets combine into one belief update, which emits ground truth on one stream and platform telemetry on the other."
        >
          {/* ── inputs ── */}
          <Label x={inX} y={16} size={10} className="fill-text-muted">
            WHAT MOVES A BELIEF
          </Label>

          <Box x={inX} y={26} w={inW} h={54} color={ROLE_COLOR.truth} />
          <Label x={inX + 10} y={45}>
            Peers
          </Label>
          <Label x={inX + 10} y={60} size={9.5} className="fill-text-secondary">
            only those within ε of you
          </Label>
          <Label x={inX + 10} y={72} size={9.5} className="fill-text-muted">
            — the confidence bound
          </Label>

          <Box x={inX} y={92} w={inW} h={42} color="#9b8cf0" />
          <Label x={inX + 10} y={111}>
            Media diet
          </Label>
          <Label
            x={inX + 10}
            y={125}
            size={9.5}
            className="fill-text-secondary"
          >
            weighted by trust in outlet
          </Label>

          <Box x={inX} y={146} w={inW} h={62} color={ROLE_COLOR.adversary} />
          <Label x={inX + 10} y={165}>
            Adversary injection
          </Label>
          <Label
            x={inX + 10}
            y={179}
            size={9.5}
            className="fill-text-secondary"
          >
            reaches its OWN assets only
          </Label>
          <Label x={inX + 10} y={192} size={9.5} className="fill-text-muted">
            amplified, but still filtered
          </Label>
          <Label x={inX + 10} y={203} size={9.5} className="fill-text-muted">
            by every neighbour&apos;s ε
          </Label>

          <Arrow
            from={[inX + inW, 53]}
            to={[midX, 120]}
            color={ROLE_COLOR.truth}
          />
          <Arrow from={[inX + inW, 113]} to={[midX, 133]} color="#9b8cf0" />
          <Arrow
            from={[inX + inW, 177]}
            to={[midX, 146]}
            color={ROLE_COLOR.adversary}
          />

          {/* ── the update ── */}
          <Box x={midX} y={98} w={midW} h={70} color="currentColor" />
          <Label x={midX + midW / 2} y={122} anchor="middle">
            belief(t+1)
          </Label>
          <Label
            x={midX + midW / 2}
            y={139}
            anchor="middle"
            size={9.5}
            className="fill-text-secondary"
          >
            all agents update
          </Label>
          <Label
            x={midX + midW / 2}
            y={152}
            anchor="middle"
            size={9.5}
            className="fill-text-secondary"
          >
            simultaneously
          </Label>

          <Arrow
            from={[midX + midW, 118]}
            to={[outX, 62]}
            color={ROLE_COLOR.truth}
          />
          <Arrow
            from={[midX + midW, 148]}
            to={[outX, 208]}
            color={ROLE_COLOR.telemetry}
          />

          {/* ── outputs ── */}
          <Label x={outX} y={16} size={10} className="fill-text-muted">
            TWO SEPARATE STREAMS
          </Label>

          <Box x={outX} y={26} w={outW} h={86} color={ROLE_COLOR.truth} />
          <Label x={outX + 10} y={45}>
            truth
          </Label>
          <Label
            x={outX + 10}
            y={60}
            size={9.5}
            className="fill-text-secondary"
          >
            every belief, the distribution,
          </Label>
          <Label
            x={outX + 10}
            y={72}
            size={9.5}
            className="fill-text-secondary"
          >
            adoption, who converted
          </Label>
          <Label x={outX + 10} y={90} size={9.5} className="fill-text-muted">
            scores the forecast.
          </Label>
          <Label x={outX + 10} y={102} size={9.5} className="fill-text-muted">
            NO defender sees this.
          </Label>

          <Box
            x={outX}
            y={168}
            w={outW}
            h={86}
            color={ROLE_COLOR.telemetry}
            dashed
          />
          <Label x={outX + 10} y={187}>
            telemetry
          </Label>
          <Label
            x={outX + 10}
            y={202}
            size={9.5}
            className="fill-text-secondary"
          >
            how much activity, how many
          </Label>
          <Label
            x={outX + 10}
            y={214}
            size={9.5}
            className="fill-text-secondary"
          >
            accounts, whose degree, which
          </Label>
          <Label
            x={outX + 10}
            y={226}
            size={9.5}
            className="fill-text-secondary"
          >
            clusters — never a belief
          </Label>
          <Label x={outX + 10} y={244} size={9.5} className="fill-text-muted">
            the detector&apos;s ONLY input.
          </Label>

          {/* the boundary */}
          <line
            x1={outX - 22}
            y1={132}
            x2={W - 8}
            y2={132}
            stroke="currentColor"
            className="text-text-muted"
            strokeDasharray="2 3"
            opacity={0.5}
          />
          <Label
            x={W - 8}
            y={146}
            anchor="end"
            size={9}
            className="fill-text-muted"
          >
            nothing crosses this line
          </Label>

          {/* the rule, stated once */}
          <Label x={inX} y={H - 34} size={9.5} className="fill-text-muted">
            If a defender could not compute it from platform telemetry,
          </Label>
          <Label x={inX} y={H - 21} size={9.5} className="fill-text-muted">
            it does not go in the bottom-right box. That is why detection
          </Label>
          <Label x={inX} y={H - 8} size={9.5} className="fill-text-muted">
            precision here is a measured number rather than a claim.
          </Label>
        </svg>
      </div>
    </figure>
  );
}
