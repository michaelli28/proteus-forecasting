import ArmTable from "../../components/metrics/ArmTable";
import OperatingCurve from "../../components/metrics/OperatingCurve";
import ReliabilityChart from "../../components/metrics/ReliabilityChart";
import SkillTrend from "../../components/metrics/SkillTrend";
import { LATEST, SNAPSHOTS, percent } from "../../lib/metrics";

export const metadata = {
  title: "PROTEUS — calibration metrics",
  description:
    "Synthetic-oracle calibration, abstention behaviour and cost for the PROTEUS forecasting pipeline.",
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-mono text-[13px] uppercase tracking-wider text-text-primary">
        {title}
      </h2>
      <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-secondary">
        {subtitle}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] text-text-primary">
        {value}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const snapshot = LATEST;
  const { cost } = snapshot;

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-2xl font-semibold text-text-primary">
        PROTEUS — calibration metrics
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-text-secondary">
        How honestly the forecasting pipeline reports its own uncertainty,
        measured against a simulated world where the true answer is known.
      </p>

      {/* The claim most likely to be dropped in transit, so it sits above the numbers. */}
      <div className="mt-6 rounded-lg border border-border-green-bright bg-primary-dark/20 px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Regime — {snapshot.regime.replace(/_/g, " ")}
        </div>
        <p className="mt-2 max-w-prose whitespace-pre-line text-[13px] leading-relaxed text-text-primary">
          {snapshot.caveat}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Target quantity" value={snapshot.quantity} />
        <Fact
          label="Batch"
          value={`${snapshot.questionsPerArm} questions × ${snapshot.arms.length} arms`}
        />
        <Fact label="Ensemble" value={`${snapshot.ensembleSize} runs`} />
        <Fact
          label="Simulations"
          value={snapshot.simulationRuns.toLocaleString()}
        />
        <Fact
          label="Gate — minSeparation"
          value={String(snapshot.thresholds.minSeparation)}
        />
      </div>

      <Section
        title="Per arm"
        subtitle="Each arm asks a different question of the pipeline, so they are scored separately and never pooled."
      >
        <ArmTable arms={snapshot.arms} />
      </Section>

      <Section
        title="Calibration"
        subtitle="Does a stated probability mean what it says? Points on the diagonal are honest."
      >
        <ReliabilityChart arms={snapshot.arms} />
      </Section>

      <Section
        title="Abstention — what refusing costs"
        subtitle="The gate can decline to answer. Raising its threshold refuses more questions; the question is whether the ones it refuses were the ones worth refusing."
      >
        <OperatingCurve
          points={snapshot.operatingCurve}
          adopted={snapshot.thresholds.minSeparation}
        />
      </Section>

      <Section
        title="Skill across runs"
        subtitle="Brier skill against the base rate, per arm, for every batch recorded so far."
      >
        <SkillTrend snapshots={SNAPSHOTS} />
      </Section>

      <Section
        title="Cost"
        subtitle="What a batch of this size costs to produce."
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Fact
            label="Questions answered"
            value={String(cost.questionsAnswered)}
          />
          <Fact label="Model calls" value={String(cost.llmCalls)} />
          <Fact
            label="Spend"
            value={cost.modelInLoop ? `$${cost.costUsd.toFixed(2)}` : "—"}
          />
          <Fact
            label="Per answer"
            value={
              cost.costPerAnswerUsd === null
                ? "not priced"
                : `$${cost.costPerAnswerUsd.toFixed(4)}`
            }
          />
        </div>
        {!cost.modelInLoop && (
          <p className="mt-4 max-w-prose text-[12px] leading-relaxed text-text-muted">
            No model ran in this batch — the framing fell back to a uniform
            partition and the forecast came from the simulation ensemble alone.
            That is the configuration the system currently ships in, so there is
            no cost per answer to report. It is unpriced, not free.
          </p>
        )}
      </Section>

      <footer className="mt-14 border-t border-border-green/40 pt-5 font-mono text-[11px] text-text-muted">
        Snapshot {snapshot.label} · generated {snapshot.generatedAt} ·{" "}
        {percent(
          snapshot.arms.reduce((sum, a) => sum + a.abstained, 0) /
            snapshot.arms.reduce((sum, a) => sum + a.questions, 0),
        )}{" "}
        of all questions abstained
      </footer>
    </main>
  );
}
