/**
 * The targeted-recruitment domain, driven through the real kernel.
 *
 * Several of these assertions exist because the first version of this model got
 * them wrong and only a probe caught it — a reporting hazard that compounded to
 * 62%, a campaign that contacted every person alive, statistically identical
 * employers that made concentration undetectable, and a detector scoring
 * absolute levels that had no operating point. Each now has a test.
 */

import { describe, it, expect } from "vitest";
import { runSimulation } from "../../../src/sim/kernel.js";
import { Rng } from "../../../src/sim/rng.js";
import {
  recruitmentAdapter,
  DEFAULT_CONFIG,
  REFERENCE_CAMPAIGN,
  FUNNEL_STAGES,
  STAGE_INDEX,
  buildWorkforce,
  buildTargetOrder,
  targetPriority,
  detectionTick,
  deviationScore,
  validateConfig,
  census,
  initialTargets,
} from "../../../src/sim/adapters/recruitment/index.js";
import type {
  RecruitmentConfig,
  ObservableTick,
} from "../../../src/sim/adapters/recruitment/index.js";

const attacked: RecruitmentConfig = {
  ...DEFAULT_CONFIG,
  campaign: REFERENCE_CAMPAIGN,
};

function truthOf(events: readonly { kind: string; data: unknown }[]) {
  return events
    .filter((e) => e.kind === "truth")
    .map((e) => e.data as Record<string, number | number[]>);
}

function telemetryOf(
  events: readonly {
    tick: number;
    kind: string;
    data: Record<string, unknown>;
  }[],
): ObservableTick[] {
  return events
    .filter((e) => e.kind === "telemetry")
    .map((e) => ({
      tick: e.tick,
      connectionRequests: e.data.connectionRequests as number,
      accepted: e.data.accepted as number,
      reportsFiled: e.data.reportsFiled as number,
      activeAccounts: e.data.activeAccounts as number,
      employerConcentration: e.data.employerConcentration as number,
      youngAccountShare: e.data.youngAccountShare as number,
    }));
}

describe("determinism", () => {
  it("reproduces an identical event log from the same seed", async () => {
    const a = await runSimulation(recruitmentAdapter, attacked, "same");
    const b = await runSimulation(recruitmentAdapter, attacked, "same");
    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));
  });

  it("produces a different log from a different seed", async () => {
    const a = await runSimulation(recruitmentAdapter, attacked, "one");
    const b = await runSimulation(recruitmentAdapter, attacked, "two");
    expect(JSON.stringify(b.events)).not.toBe(JSON.stringify(a.events));
  });
});

describe("the control arm", () => {
  it("contacts nobody and compromises nobody without a campaign", async () => {
    const r = await runSimulation(recruitmentAdapter, DEFAULT_CONFIG, "ctl");
    const last = truthOf(r.events).at(-1)!;
    expect(last.contacted).toBe(0);
    expect(last.tasked).toBe(0);
    expect(last.taskedCleared).toBe(0);
  });

  it("still shows legitimate traffic, so the campaign is not the only signal", async () => {
    // Without background traffic a campaign begins from silence and is trivially
    // detectable; detection lag was always zero before this existed.
    const r = await runSimulation(recruitmentAdapter, DEFAULT_CONFIG, "ctl");
    const telemetry = telemetryOf(r.events as never);
    const total = telemetry.reduce((s, t) => s + t.connectionRequests, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe("the funnel", () => {
  it("moves people up the ladder one rung at a time", async () => {
    const r = await runSimulation(recruitmentAdapter, attacked, "funnel");
    const truth = truthOf(r.events);
    for (const tick of truth) {
      const stages = tick.stageHistogram as number[];
      expect(stages).toHaveLength(FUNNEL_STAGES.length);
      expect(stages.reduce((a, b) => a + b, 0)).toBe(
        DEFAULT_CONFIG.workforce.people,
      );
    }
  });

  it("never un-contacts anyone — cumulative counts only rise", async () => {
    const r = await runSimulation(recruitmentAdapter, attacked, "funnel");
    const truth = truthOf(r.events);
    for (let i = 1; i < truth.length; i++) {
      expect(truth[i]!.contacted as number).toBeGreaterThanOrEqual(
        truth[i - 1]!.contacted as number,
      );
      expect(truth[i]!.tasked as number).toBeGreaterThanOrEqual(
        truth[i - 1]!.tasked as number,
      );
    }
  });

  it("leaves a majority of the workforce never contacted", async () => {
    // A campaign that reaches everyone makes selectivity meaningless and the
    // first stage stops being a choice the adversary made.
    const r = await runSimulation(recruitmentAdapter, attacked, "funnel");
    const last = truthOf(r.events).at(-1)!;
    expect(last.contacted as number).toBeLessThan(
      DEFAULT_CONFIG.workforce.people,
    );
  });

  it("keeps the reporting rate plausible rather than compounding to certainty", async () => {
    // A per-tick hazard applied forever reaches ~94% over a 140-tick campaign.
    // Scoped to a window after each approach, it stays in single-to-low-double
    // digits. The exact value is an ASSUMPTION; the order of magnitude is the test.
    const r = await runSimulation(recruitmentAdapter, attacked, "report");
    const last = truthOf(r.events).at(-1)!;
    expect(last.reportRate as number).toBeGreaterThan(0);
    expect(last.reportRate as number).toBeLessThan(0.25);
  });

  it("converts more people when the adversary pushes harder", async () => {
    const timid = await runSimulation(
      recruitmentAdapter,
      {
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, escalationRate: 0.01 },
      },
      "cmp",
    );
    const hard = await runSimulation(
      recruitmentAdapter,
      {
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, escalationRate: 0.12 },
      },
      "cmp",
    );
    expect(truthOf(hard.events).at(-1)!.tasked as number).toBeGreaterThan(
      truthOf(timid.events).at(-1)!.tasked as number,
    );
  });
});

describe("selection happens twice", () => {
  it("orders contacts by what a public profile shows, never by vulnerability", () => {
    // Vulnerability is learned by talking to someone. Selecting on it would let
    // the adversary read financial stress off a profile page it cannot see, and
    // would overstate the yield of every campaign.
    const rng = new Rng("sel");
    const workforce = buildWorkforce(DEFAULT_CONFIG, rng.fork("w"));
    const order = buildTargetOrder(workforce, 1, rng.fork("o"));

    const first = order.slice(0, 100).map((id) => workforce.people[id]!);
    const rest = order.slice(-100).map((id) => workforce.people[id]!);

    const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Priority is strictly higher at the front...
    expect(meanOf(first.map(targetPriority))).toBeGreaterThan(
      meanOf(rest.map(targetPriority)),
    );
    // ...while vulnerability is not sorted at all.
    const frontVuln = meanOf(first.map((p) => p.vulnerability));
    const backVuln = meanOf(rest.map((p) => p.vulnerability));
    expect(Math.abs(frontVuln - backVuln)).toBeLessThan(0.08);
  });

  it("gives employers different sensitivity so concentration can appear", () => {
    // Statistically identical employers make employer concentration constant at
    // 1/n whatever the adversary does, which deletes the one signal the German
    // service actually reported.
    const workforce = buildWorkforce(DEFAULT_CONFIG, new Rng("orgs"));
    const s = workforce.organizationSensitivity;
    expect(Math.max(...s)).toBeGreaterThan(Math.min(...s) * 1.5);
  });
});

describe("truth and telemetry stay apart", () => {
  it("NEVER leaks funnel state into the telemetry stream", async () => {
    const r = await runSimulation(recruitmentAdapter, attacked, "leak");
    const telemetry = r.events.filter((e) => e.kind === "telemetry");
    expect(telemetry.length).toBeGreaterThan(0);

    const forbidden = [
      "tasked",
      "taskedCleared",
      "contacted",
      "contactedCleared",
      "compromisedAccess",
      "paidK",
      "stageHistogram",
      "clearedConversionRate",
      "reported",
      "advanced",
      "newlyTasked",
    ];
    for (const event of telemetry) {
      for (const key of forbidden) {
        expect(event.data).not.toHaveProperty(key);
      }
    }
  });

  it("keeps the ground-truth stream free of platform counters", async () => {
    const r = await runSimulation(recruitmentAdapter, attacked, "leak");
    for (const event of r.events.filter((e) => e.kind === "truth")) {
      expect(event.data).not.toHaveProperty("connectionRequests");
      expect(event.data).not.toHaveProperty("employerConcentration");
      expect(event.data).not.toHaveProperty("youngAccountShare");
    }
  });
});

describe("detection", () => {
  const detect = async (
    campaign: RecruitmentConfig["campaign"],
    seed: string,
    threshold = 0.5,
  ) => {
    const r = await runSimulation(
      recruitmentAdapter,
      { ...DEFAULT_CONFIG, campaign },
      seed,
    );
    return {
      tick: detectionTick(telemetryOf(r.events as never), threshold),
      truth: truthOf(r.events),
    };
  };

  it("does not fire on legitimate traffic alone", async () => {
    for (const seed of ["c1", "c2", "c3", "c4"]) {
      const r = await runSimulation(recruitmentAdapter, DEFAULT_CONFIG, seed);
      expect(detectionTick(telemetryOf(r.events as never), 0.5)).toBeNull();
    }
  });

  it("catches a loud campaign, and catches it early", async () => {
    for (const seed of ["d1", "d2", "d3", "d4"]) {
      const { tick } = await detect(
        { ...REFERENCE_CAMPAIGN, accounts: 10, accountAgeDays: 20 },
        seed,
      );
      expect(tick).not.toBeNull();
      expect(tick!).toBeLessThan(REFERENCE_CAMPAIGN.startTick + 30);
    }
  });

  it("MEASURES the blind spot rather than asserting there is none", async () => {
    // A patient campaign on aged accounts stays under the threshold. This is
    // the model's headline finding and it must not be quietly tuned away: the
    // campaigns that evade detection are the ones that compromise people.
    let evaded = 0;
    let exposure = 0;
    for (const seed of ["p1", "p2", "p3", "p4"]) {
      const { tick, truth } = await detect(
        {
          ...REFERENCE_CAMPAIGN,
          accounts: 2,
          escalationRate: 0.05,
          selectivity: 0.9,
          paymentK: 6,
          accountAgeDays: 900,
          coordinated: false,
        },
        seed,
      );
      if (tick === null) {
        evaded++;
        exposure += truth.at(-1)!.taskedCleared as number;
      }
    }
    expect(evaded).toBeGreaterThan(0);
    expect(exposure).toBeGreaterThan(0);
  });

  it("cannot see a campaign that began before it had a baseline", async () => {
    const { tick } = await detect(
      { ...REFERENCE_CAMPAIGN, startTick: 2, accounts: 3, accountAgeDays: 900 },
      "pre",
    );
    expect(tick).toBeNull();
  });

  it("scores deviation from a baseline, not absolute level", () => {
    const flat = (n: number, v: number): ObservableTick[] =>
      Array.from({ length: n }, (_, tick) => ({
        tick,
        connectionRequests: v,
        accepted: 0,
        reportsFiled: 0,
        activeAccounts: v,
        employerConcentration: 0.3,
        youngAccountShare: 0.05,
      }));

    // Identical to its own baseline ⇒ nothing to report, however high the level.
    expect(deviationScore(flat(20, 500), flat(15, 500))).toBe(0);
    // A departure scores, even from a low level.
    const spike = flat(15, 500).map((t) => ({
      ...t,
      employerConcentration: 0.9,
      youngAccountShare: 0.4,
    }));
    expect(deviationScore(flat(20, 500), spike)).toBeGreaterThan(0.4);
  });
});

describe("defensive interventions", () => {
  it("platform takedown reduces how many people are approached at all", async () => {
    const base = await runSimulation(recruitmentAdapter, attacked, "def");
    const defended = await runSimulation(
      recruitmentAdapter,
      {
        ...attacked,
        defense: {
          kind: "platform_takedown",
          startTick: 25,
          intensity: 0.7,
          coverage: 0.6,
          costPerTick: 1,
        },
      },
      "def",
    );
    expect(truthOf(defended.events).at(-1)!.contacted as number).toBeLessThan(
      truthOf(base.events).at(-1)!.contacted as number,
    );
  });

  it("targeted monitoring removes people already being worked", async () => {
    const base = await runSimulation(recruitmentAdapter, attacked, "mon");
    const defended = await runSimulation(
      recruitmentAdapter,
      {
        ...attacked,
        defense: {
          kind: "targeted_monitoring",
          startTick: 25,
          intensity: 0.8,
          coverage: 0.5,
          costPerTick: 3,
        },
      },
      "mon",
    );
    expect(truthOf(defended.events).at(-1)!.tasked as number).toBeLessThan(
      truthOf(base.events).at(-1)!.tasked as number,
    );
  });
});

describe("census", () => {
  it("counts nobody as contacted before anything happens", () => {
    const workforce = buildWorkforce(DEFAULT_CONFIG, new Rng("c"));
    const snapshot = census(workforce, initialTargets(workforce));
    expect(snapshot.contacted).toBe(0);
    expect(snapshot.byStage[STAGE_INDEX.untouched]).toBe(
      DEFAULT_CONFIG.workforce.people,
    );
  });
});

describe("validateConfig", () => {
  it("rejects a world that would be degenerate rather than running it", () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, ticks: 0 })).toThrow(
      /ticks/,
    );
    expect(() =>
      validateConfig({
        ...DEFAULT_CONFIG,
        workforce: { ...DEFAULT_CONFIG.workforce, clearedFraction: 1.5 },
      }),
    ).toThrow(/clearedFraction/);
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, complicitySuppression: -1 }),
    ).toThrow(/complicitySuppression/);
    expect(() =>
      validateConfig({
        ...attacked,
        campaign: { ...REFERENCE_CAMPAIGN, endTick: 1, startTick: 50 },
      }),
    ).toThrow(/endTick/);
  });
});
