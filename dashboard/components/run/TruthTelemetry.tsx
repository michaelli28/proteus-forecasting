"use client";

import { ROLE_COLOR, percent } from "../../lib/traces";
import type { RunTrace, TraceTick } from "../../lib/traces";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1.5 last:border-b-0">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-[12.5px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Pane({
  title,
  dot,
  children,
}: {
  title: string;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dot }}
          />
          <div className="text-[13px] font-semibold text-navy">{title}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * What really happened, beside what a defender could observe — at the same day.
 *
 * Two panes with a hard divider rather than one table, because the separation is
 * the whole point: everything on the right can be worked out from public
 * activity, and nothing on the right mentions what people actually believe. A
 * merged table would read as one dataset and quietly erase that line.
 */
export default function TruthTelemetry({
  trace,
  tick,
}: {
  trace: RunTrace;
  tick: TraceTick;
}) {
  const { truth, telemetry } = tick;
  const shares = telemetry.clusterActivityShare;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-0">
      <Pane title="What really happened" dot={ROLE_COLOR.truth}>
        <div className="pr-0 sm:pr-6">
          <Row
            label="Share who believe it"
            value={percent(truth.adoptionRate)}
          />
          <Row label="Average agreement" value={truth.meanBelief.toFixed(2)} />
          <Row label="Spread of opinion" value={truth.variance.toFixed(2)} />
          <Row
            label="Split into two camps"
            value={truth.bimodality.toFixed(2)}
          />
          <Row
            label="Gap between groups"
            value={truth.clusterSeparation.toFixed(2)}
          />
          <Row
            label="Posts by fake accounts today"
            value={String(truth.injections)}
          />
          <Row
            label="Started / stopped believing"
            value={`+${truth.adoptions} / −${truth.abandonments}`}
          />
        </div>
      </Pane>

      <div
        className="relative shrink-0 sm:w-px sm:bg-line-strong"
        aria-hidden="true"
      >
        <span className="hidden whitespace-nowrap rounded bg-surface px-2 text-[9px] uppercase tracking-[0.16em] text-muted sm:absolute sm:left-1/2 sm:top-1/2 sm:block sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rotate-90">
          a defender can&rsquo;t see past this line
        </span>
      </div>

      <Pane title="What a defender could see" dot={ROLE_COLOR.telemetry}>
        <div className="pl-0 sm:pl-6">
          <Row
            label="Activity volume"
            value={telemetry.volume.toLocaleString()}
          />
          <Row
            label="Accounts active"
            value={String(telemetry.activeAccounts)}
          />
          <Row
            label="How connected those accounts are"
            value={telemetry.activeDegreeRatio.toFixed(2)}
          />
          <Row
            label="Activity by group"
            value={shares.map((s) => s.toFixed(2)).join("  ")}
          />
          <Row
            label="How much comes in sudden bursts"
            value={trace.detection.burstiness.toFixed(2)}
          />
          <Row
            label="How much runs through big accounts"
            value={trace.detection.hubConcentration.toFixed(2)}
          />
          <Row
            label="Overall warning score"
            value={percent(trace.detection.compositeScore)}
          />
        </div>
      </Pane>
    </div>
  );
}
