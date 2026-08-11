"use client";

import { ROLE_COLOR, percent } from "../../lib/traces";
import type { RunTrace, TraceTick } from "../../lib/traces";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/40 py-1.5 last:border-b-0">
      <span className="font-mono text-[11px] text-muted">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-ink">
        {value}
      </span>
    </div>
  );
}

function Pane({
  title,
  subtitle,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 border-l-2 pl-2" style={{ borderColor: color }}>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink">
          {title}
        </div>
        <div className="mt-0.5 max-w-[34ch] text-[11px] leading-snug text-muted">
          {subtitle}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * What is true beside what a defender could observe, at the same tick.
 *
 * Rendered as two panes with a hard divider rather than one table, because the
 * separation is the system's central claim: everything on the right is
 * computable from platform telemetry, and nothing on the right mentions belief.
 * A merged table would read as one dataset and quietly retract that.
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
      <Pane
        title="What is true"
        subtitle="Ground truth from the simulator. No defender can observe any of it."
        color={ROLE_COLOR.truth}
      >
        <div className="pr-0 sm:pr-6">
          <Row label="adoption rate" value={percent(truth.adoptionRate)} />
          <Row label="mean belief" value={truth.meanBelief.toFixed(4)} />
          <Row label="variance" value={truth.variance.toFixed(4)} />
          <Row label="bimodality" value={truth.bimodality.toFixed(4)} />
          <Row
            label="cluster separation"
            value={truth.clusterSeparation.toFixed(4)}
          />
          <Row label="injections this tick" value={String(truth.injections)} />
          <Row
            label="adopted / abandoned"
            value={`+${truth.adoptions} / −${truth.abandonments}`}
          />
        </div>
      </Pane>

      <div
        className="relative shrink-0 sm:w-px sm:bg-border-green-bright"
        aria-hidden="true"
      >
        <span className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap bg-surface px-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          the detector cannot cross this line
        </span>
      </div>

      <Pane
        title="What a defender sees"
        subtitle="Platform telemetry only. This is the entire input to the detection signal."
        color={ROLE_COLOR.telemetry}
      >
        <div className="pl-0 sm:pl-6">
          <Row
            label="interaction volume"
            value={telemetry.volume.toLocaleString()}
          />
          <Row
            label="active accounts"
            value={String(telemetry.activeAccounts)}
          />
          <Row
            label="active degree ratio"
            value={telemetry.activeDegreeRatio.toFixed(4)}
          />
          <Row
            label="cluster activity"
            value={shares.map((s) => s.toFixed(2)).join("  ")}
          />
          <Row
            label="run burstiness"
            value={trace.detection.burstiness.toFixed(3)}
          />
          <Row
            label="hub concentration"
            value={trace.detection.hubConcentration.toFixed(3)}
          />
          <Row
            label="detector score"
            value={trace.detection.compositeScore.toFixed(3)}
          />
        </div>
      </Pane>
    </div>
  );
}
