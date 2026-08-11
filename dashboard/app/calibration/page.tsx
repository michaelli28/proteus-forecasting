import ArmTable from "../../components/metrics/ArmTable";
import OperatingCurve from "../../components/metrics/OperatingCurve";
import ReliabilityChart from "../../components/metrics/ReliabilityChart";
import SkillTrend from "../../components/metrics/SkillTrend";
import { LATEST, SNAPSHOTS, percent } from "../../lib/metrics";
import { Page, Section, Figure, Card } from "../../components/site/ui";
import { Reveal } from "../../components/site/motion";
import Footer from "../../components/site/Footer";

export const metadata = {
  title: "Forecast quality — Proteus",
  description:
    "How honest the forecasts are: whether stated confidence matches what actually happens, and whether the system admits when it cannot answer.",
};

export default function CalibrationPage() {
  const snapshot = LATEST;
  const { cost } = snapshot;
  const abstainRate =
    snapshot.arms.reduce((sum, a) => sum + a.abstained, 0) /
    snapshot.arms.reduce((sum, a) => sum + a.questions, 0);

  return (
    <>
      <Page>
        <Reveal as="section" className="pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Trustworthiness
          </div>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08]">
            How honest are the forecasts?
          </h1>
          <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-slate">
            A forecast is only useful if its confidence can be trusted. We test
            the system against a simulated world where the true answer is
            already known, and check two things: when it says something is
            likely, does it actually happen that often — and when the evidence
            is too thin, does it admit it rather than guess.
          </p>
        </Reveal>

        <Reveal as="section" className="mt-10">
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 sm:grid-cols-4">
            <Figure
              value={snapshot.simulationRuns.toLocaleString("en-US")}
              label="Simulations run"
            />
            <Figure
              value={`${snapshot.questionsPerArm} × ${snapshot.arms.length}`}
              label="Questions × scenarios"
            />
            <Figure
              value={`${snapshot.ensembleSize}`}
              label="Forecasts per question"
            />
            <Figure
              value={percent(abstainRate)}
              label="Declined as unanswerable"
              tone="accent"
            />
          </div>
        </Reveal>

        <Section
          eyebrow="The core test"
          title="When it says 30%, does it happen 30%?"
          lede="Each dot is a batch of forecasts. On the dashed line, the stated odds matched reality exactly. Below the line means overconfident; above means the opposite."
        >
          <Card>
            <ReliabilityChart arms={snapshot.arms} />
          </Card>
        </Section>

        <Section
          eyebrow="Scenario by scenario"
          title="Harder questions, measured separately"
          lede="Each scenario gives the system a different amount of evidence. They are scored on their own — never averaged together, because a hard question and an easy one answer different things."
        >
          <ArmTable arms={snapshot.arms} />
        </Section>

        <Section
          eyebrow="Knowing when to stay quiet"
          title="It declines the questions it cannot answer"
          lede="The system can refuse a question when the evidence is too thin. The goal is to catch the genuinely unanswerable ones without wrongly skipping ones it could have gotten right."
        >
          <Card>
            <OperatingCurve
              points={snapshot.operatingCurve}
              adopted={snapshot.thresholds.minSeparation}
            />
          </Card>
        </Section>

        <Section
          eyebrow="Track record"
          title="Better than a coin flip, where it should be"
          lede="Skill for each scenario, against a plain baseline. The deliberately-broken scenario is expected to score below zero — proof the measurement catches failure, not just success."
        >
          <SkillTrend snapshots={SNAPSHOTS} />
        </Section>

        <Section eyebrow="Cost" title="What a batch of this size costs">
          <div className="grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface p-6 sm:grid-cols-4">
            <Figure
              value={String(cost.questionsAnswered)}
              label="Questions answered"
            />
            <Figure value={String(cost.llmCalls)} label="Model calls" />
            <Figure
              value={cost.modelInLoop ? `$${cost.costUsd.toFixed(2)}` : "—"}
              label="Total spend"
            />
            <Figure
              value={
                cost.costPerAnswerUsd === null
                  ? "not priced"
                  : `$${cost.costPerAnswerUsd.toFixed(4)}`
              }
              label="Per answer"
            />
          </div>
          {!cost.modelInLoop && (
            <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-muted">
              No AI model ran in this batch — the forecast came from the
              simulation ensemble alone, which is how the system currently
              ships. So there is no per-answer price to report. It is unpriced,
              not free.
            </p>
          )}
        </Section>

        <footer className="mt-16 border-t border-line pt-5 text-[12px] text-muted">
          Snapshot {snapshot.label} · generated {snapshot.generatedAt} ·{" "}
          {percent(abstainRate)} of all questions declined as unanswerable
        </footer>
      </Page>
      <Footer />
    </>
  );
}
