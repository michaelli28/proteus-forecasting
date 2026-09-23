import { describe, it, expect } from "vitest";
import { stratifiedBootstrap } from "../../src/metrics/bootstrap.js";
import { winTieLoss } from "../../src/metrics/paired.js";
import {
  labTable,
  median,
  resolveReference,
  sigmaPairingKey,
} from "../../src/restoration/lab-table.js";
import type {
  Reference,
  StormOutcome,
} from "../../src/restoration/lab-table.js";
import { Rng } from "../../src/sim/rng.js";
import {
  DEFAULT_CONFIG,
  RESTORATION_RULES,
  drawStorm,
} from "../../src/sim/adapters/restoration/index.js";
import type {
  RestorationConfig,
  RestorationRule,
  Storm,
} from "../../src/sim/adapters/restoration/index.js";

/** Costs in table order: most-customers-now, critical, nearest, upstream, horn-order, horn-order (hindsight). */
function costs(
  ...values: [number, number, number, number, number, number]
): Record<RestorationRule, number> {
  return Object.fromEntries(
    RESTORATION_RULES.map((rule, i) => [rule, values[i]!]),
  ) as Record<RestorationRule, number>;
}

const exact = (customerTicks: number): Reference => ({
  kind: "exact",
  source: "milp",
  customerTicks,
});
const floor = (customerTicks: number): Reference => ({
  kind: "floor",
  source: "lp",
  customerTicks,
});

describe("resolving a storm's reference", () => {
  it("with one crew, is Horn's exact cost", () => {
    expect(
      resolveReference({
        crews: 1,
        ruleCosts: costs(110, 120, 150, 100, 105, 100),
        horn: 100,
      }),
    ).toEqual({ kind: "exact", source: "horn", customerTicks: 100 });
  });

  it("with one crew, treats a rule cheaper than Horn as a bug, never a result", () => {
    expect(() =>
      resolveReference({
        crews: 1,
        ruleCosts: costs(110, 120, 150, 99, 105, 100),
        horn: 100,
      }),
    ).toThrow(/upstream-first costs 99.*below Horn's 100/);
    expect(() =>
      resolveReference({ crews: 1, ruleCosts: costs(1, 1, 1, 1, 1, 1) }),
    ).toThrow(/Horn/);
  });

  it("with a proven MILP, is the MILP's schedule when no rule beats it", () => {
    expect(
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, 120, 150, 100, 105, 100),
        milp: { proven: true, customerTicks: 100 },
        lpFloor: 97.5,
      }),
    ).toEqual({ kind: "exact", source: "milp", customerTicks: 100 });
  });

  it("with a proven MILP, is the cheapest rule's schedule when one beats HiGHS's incumbent", () => {
    // Inside HiGHS's 1e-4 gap a rule can come in under the incumbent; both are
    // feasible, so the cheaper one is the best known schedule. Ties: table order.
    expect(
      resolveReference({
        crews: 3,
        ruleCosts: costs(10_100, 10_200, 10_500, 9999, 9999, 9999),
        milp: { proven: true, customerTicks: 10_000 },
        lpFloor: 9990,
      }),
    ).toEqual({
      kind: "exact",
      source: "rule",
      rule: "upstream-first",
      customerTicks: 9999,
    });
  });

  it("without a proof, falls back to the LP floor, whether the MILP timed out or never ran", () => {
    const ruleCosts = costs(110, 120, 150, 100, 105, 100);
    expect(
      resolveReference({
        crews: 2,
        ruleCosts,
        milp: { proven: false, customerTicks: 104 },
        lpFloor: 97.5,
      }),
    ).toEqual(floor(97.5));
    expect(
      resolveReference({
        crews: 2,
        ruleCosts,
        milp: { proven: false, customerTicks: null },
        lpFloor: 97.5,
      }),
    ).toEqual(floor(97.5));
    expect(resolveReference({ crews: 4, ruleCosts, lpFloor: 97.5 })).toEqual(
      floor(97.5),
    );
    expect(() =>
      resolveReference({
        crews: 2,
        ruleCosts,
        milp: { proven: false, customerTicks: 104 },
      }),
    ).toThrow(/no LP floor/);
  });

  it("treats any schedule below the LP floor as a bug, beyond float noise", () => {
    // 100 is 0.5 below a floor of 100.5: no schedule can cost less than the floor.
    expect(() =>
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, 120, 150, 100, 105, 101),
        lpFloor: 100.5,
      }),
    ).toThrow(/upstream-first costs 100.*below the LP floor 100\.5/);
    expect(() =>
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, 120, 150, 130, 105, 101),
        milp: { proven: true, customerTicks: 100 },
        lpFloor: 100.5,
      }),
    ).toThrow(/MILP costs 100.*below the LP floor 100\.5/);
    // 5e-5 above a whole-number cost of 100 is float noise (within 1e-6 × 100):
    // accepted, and the floor comes down to the schedule, so no gap is negative.
    expect(
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, 120, 150, 100, 105, 101),
        lpFloor: 100.00005,
      }),
    ).toEqual(floor(100));
  });

  it("refuses a cost that is not a finite number >= 0, and a crew count below 1", () => {
    expect(() =>
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, Number.NaN, 150, 100, 105, 101),
        lpFloor: 90,
      }),
    ).toThrow(/critical-first.*NaN/);
    expect(() =>
      resolveReference({
        crews: 2,
        ruleCosts: costs(110, 120, 150, 100, 105, 101),
        lpFloor: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/LP floor.*Infinity/);
    expect(() =>
      resolveReference({
        crews: 0,
        ruleCosts: costs(1, 1, 1, 1, 1, 1),
        horn: 1,
      }),
    ).toThrow(/crews/);
  });
});

// Four storms by hand, reference 100 + 40 + 60 + 200 = 400. Storm 3's is an LP
// floor: its ties do not count (pre-registration §6).
const HAND: StormOutcome[] = [
  { customerTicks: costs(110, 120, 150, 100, 105, 100), reference: exact(100) },
  { customerTicks: costs(40, 44, 60, 50, 40, 40), reference: exact(40) },
  { customerTicks: costs(66, 60, 90, 70, 63, 60), reference: floor(60) },
  { customerTicks: costs(220, 210, 300, 240, 200, 200), reference: exact(200) },
];

describe("the paired table on four hand storms", () => {
  const table = labTable(HAND, "hand");
  const row = (rule: RestorationRule) =>
    table.rows.find((r) => r.rule === rule)!;

  it("counts the storms and their kinds of reference", () => {
    expect(table.storms).toBe(4);
    expect(table.exactReferences).toBe(3);
    expect(table.floorReferences).toBe(1);
    expect(table.rows.map((r) => r.rule)).toEqual([...RESTORATION_RULES]);
  });

  it("reports mean customer-hours as mean customer-ticks × 0.25", () => {
    // 400 / 4 = 100 ticks; 436 / 4 = 109; 434 / 4 = 108.5; 600 / 4 = 150; 460 / 4 = 115; 408 / 4 = 102.
    expect(table.referenceMeanCustomerHours).toBe(25);
    expect(RESTORATION_RULES.map((r) => row(r).meanCustomerHours)).toEqual([
      27.25, 27.125, 37.5, 28.75, 25.5, 25,
    ]);
  });

  it("estimates extra customer-hours as 100 × (Σ rule − Σ reference) ÷ Σ reference", () => {
    // (436 − 400) / 400 = 9%; 34 / 400 = 8.5%; 200 / 400 = 50%; 60 / 400 = 15%; 8 / 400 = 2%; 0.
    expect(RESTORATION_RULES.map((r) => row(r).extraPercent!.estimate)).toEqual(
      [9, 8.5, 50, 15, 2, 0],
    );
    for (const r of table.rows) {
      expect(r.extraPercent!.lower).toBeLessThanOrEqual(
        r.extraPercent!.estimate,
      );
      expect(r.extraPercent!.upper).toBeGreaterThanOrEqual(
        r.extraPercent!.estimate,
      );
      expect(r.extraPercent!.resamples).toBe(2000);
    }
  });

  it("counts ties only against an exact reference", () => {
    // Critical-first and Horn-order (hindsight) equal storm 3's floor of 60: not a tie.
    expect(RESTORATION_RULES.map((r) => row(r).tiesWithReference)).toEqual([
      1, 0, 0, 1, 2, 3,
    ]);
  });

  it("splits every rule against most customers first, storm by storm", () => {
    const most = HAND.map((o) => o.customerTicks["most-customers-now"]);
    for (const rule of RESTORATION_RULES) {
      expect(row(rule).vsMostCustomersNow).toEqual(
        winTieLoss(
          HAND.map((o) => o.customerTicks[rule]),
          most,
        ),
      );
    }
    // By hand: 120 > 110, 44 > 40, 60 < 66, 210 < 220.
    expect(row("critical-first").vsMostCustomersNow).toEqual({
      better: 2,
      tied: 0,
      worse: 2,
    });
    // 105 < 110, 40 = 40, 63 < 66, 200 < 220.
    expect(row("horn-order").vsMostCustomersNow).toEqual({
      better: 3,
      tied: 1,
      worse: 0,
    });
  });

  it("takes the median per-storm gap, averaging the middle two of four", () => {
    // Most customers: 10, 0, 10, 10 → 10. Critical: 20, 10, 0, 5 → 7.5.
    // Upstream: 0, 25, 16.67, 20 → 18.33. Horn-order: 5, 0, 5, 0 → 2.5.
    expect(row("most-customers-now").medianStormGapPercent).toBe(10);
    expect(row("critical-first").medianStormGapPercent).toBe(7.5);
    expect(row("nearest-first").medianStormGapPercent).toBe(50);
    expect(row("upstream-first").medianStormGapPercent).toBeCloseTo(
      ((100 * 10) / 60 + 20) / 2,
      12,
    );
    expect(row("horn-order").medianStormGapPercent).toBe(2.5);
    expect(row("horn-order-hindsight").medianStormGapPercent).toBe(0);
  });

  it("splits every pair of rules, with all ties on the diagonal", () => {
    for (const a of RESTORATION_RULES) {
      expect(table.pairwise[a][a]).toEqual({ better: 0, tied: 4, worse: 0 });
      for (const b of RESTORATION_RULES) {
        expect(table.pairwise[a][b]).toEqual(
          winTieLoss(
            HAND.map((o) => o.customerTicks[a]),
            HAND.map((o) => o.customerTicks[b]),
          ),
        );
      }
    }
    // Nearest first loses every storm to upstream first: 150 > 100, 60 > 50, 90 > 70, 300 > 240.
    expect(table.pairwise["nearest-first"]["upstream-first"]).toEqual({
      better: 0,
      tied: 0,
      worse: 4,
    });
  });
});

describe("a rule cheaper than HiGHS's incumbent", () => {
  it("becomes the reference, so its gap is 0 and never negative", () => {
    const ruleCosts = costs(10_100, 10_200, 10_500, 9999, 9999, 9999);
    const reference = resolveReference({
      crews: 2,
      ruleCosts,
      milp: { proven: true, customerTicks: 10_000 },
      lpFloor: 9990,
    });
    const table = labTable([{ customerTicks: ruleCosts, reference }], "cheap");
    const upstream = table.rows.find((r) => r.rule === "upstream-first")!;
    expect(upstream.extraPercent!.estimate).toBe(0);
    expect(upstream.medianStormGapPercent).toBe(0);
    expect(upstream.tiesWithReference).toBe(1);
    for (const r of table.rows) {
      expect(r.extraPercent!.lower).toBeGreaterThanOrEqual(0);
      expect(r.medianStormGapPercent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("storms whose broken lines serve no customers", () => {
  const zero = (): StormOutcome => ({
    customerTicks: costs(0, 0, 0, 0, 0, 0),
    reference: resolveReference({
      crews: 1,
      ruleCosts: costs(0, 0, 0, 0, 0, 0),
      horn: 0,
    }),
  });

  it("count 0 ÷ 0 as a gap of 0, and report no share when every reference is 0", () => {
    const table = labTable([zero(), zero(), zero()], "zero");
    const json = JSON.stringify(table);
    expect(json).not.toMatch(/NaN|Infinity/);
    expect(table.referenceMeanCustomerHours).toBe(0);
    for (const r of table.rows) {
      expect(r.extraPercent).toBeNull();
      expect(r.meanCustomerHours).toBe(0);
      expect(r.medianStormGapPercent).toBe(0);
      expect(r.tiesWithReference).toBe(3);
    }
    // The only nulls are the six shares that cannot exist.
    expect(json.match(/null/g)).toHaveLength(RESTORATION_RULES.length);
  });

  it("count 0 ÷ 0 as 0 beside ordinary storms, whose share still exists", () => {
    // Most customers: 10%, 0 ÷ 0, 20% → median 10.
    const table = labTable(
      [
        {
          customerTicks: costs(110, 100, 100, 100, 100, 100),
          reference: exact(100),
        },
        zero(),
        { customerTicks: costs(60, 50, 50, 50, 50, 50), reference: exact(50) },
      ],
      "mixed",
    );
    const most = table.rows.find((r) => r.rule === "most-customers-now")!;
    expect(most.medianStormGapPercent).toBe(10);
    // 100 × (170 − 150) / 150
    expect(most.extraPercent!.estimate).toBeCloseTo(40 / 3, 12);
    expect(JSON.stringify(table)).not.toMatch(/NaN|Infinity|null/);
  });

  it("treats a rule cost on a zero reference, or below its reference, as a bug", () => {
    expect(() =>
      labTable(
        [{ customerTicks: costs(5, 0, 0, 0, 0, 0), reference: exact(0) }],
        "x",
      ),
    ).toThrow(/most-customers-now costs 5.*reference 0/);
    expect(() =>
      labTable(
        [
          {
            customerTicks: costs(99, 100, 100, 100, 100, 100),
            reference: exact(100),
          },
        ],
        "x",
      ),
    ).toThrow(/most-customers-now costs 99.*below its reference 100/);
    expect(() => labTable([], "x")).toThrow(/no storms/);
  });
});

describe("the bootstrap seed", () => {
  // Thirty storms with uneven gaps, so percentile ends differ between seeds.
  const outcomes: StormOutcome[] = Array.from({ length: 30 }, (_, i) => {
    const ref = 100 + 37 * i;
    const extra = (i * 13) % 17;
    return {
      customerTicks: costs(
        ref + extra,
        ref + 2 * extra,
        ref + 3,
        ref,
        ref,
        ref,
      ),
      reference: exact(ref),
    };
  });

  it("is `${seed}/${rule}`, so the same inputs give the same table", () => {
    const seed = "restoration-lab/primary/2";
    const table = labTable(outcomes, seed);
    expect(labTable(outcomes, seed)).toEqual(table);
    const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
    for (const rule of RESTORATION_RULES) {
      const expected = stratifiedBootstrap(outcomes, {
        stratumOf: () => "storms",
        statistic: (sample) => {
          const ref = sum(sample.map((o) => o.reference.customerTicks));
          const r = sum(sample.map((o) => o.customerTicks[rule]));
          return ref === 0 ? null : (100 * (r - ref)) / ref;
        },
        seed: `${seed}/${rule}`,
      });
      expect(table.rows.find((r) => r.rule === rule)!.extraPercent).toEqual(
        expected,
      );
    }
    const other = labTable(outcomes, "restoration-lab/primary/3");
    expect(other.rows[0]!.extraPercent).not.toEqual(
      table.rows[0]!.extraPercent,
    );
  });
});

describe("median", () => {
  it("takes the middle value, or the mean of the middle two, and leaves its input alone", () => {
    const values = [5, 1, 3];
    expect(median(values)).toBe(3);
    expect(values).toEqual([5, 1, 3]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });
});

describe("the σ pairing key (pre-registration §5)", () => {
  const withSigma = (sigma: number): RestorationConfig => ({
    ...DEFAULT_CONFIG,
    repair: { ...DEFAULT_CONFIG.repair, sigma },
  });

  it("is the same for one seed at every σ, though the repair ticks differ", () => {
    let ticksDiffer = 0;
    for (let i = 0; i < 20; i++) {
      const seed = `sigma-pairing-${i}`;
      const [flat, primary, wide] = [0, 0.6, 1.0].map((sigma) =>
        drawStorm(withSigma(sigma), new Rng(seed)),
      );
      expect(sigmaPairingKey(flat!)).toBe(sigmaPairingKey(primary!));
      expect(sigmaPairingKey(wide!)).toBe(sigmaPairingKey(primary!));
      if (JSON.stringify(flat) !== JSON.stringify(wide)) ticksDiffer++;
    }
    expect(ticksDiffer).toBeGreaterThan(15);
  });

  it("changes with the feeder, the customers, the critical buses or the broken buses", () => {
    const storm = drawStorm(DEFAULT_CONFIG, new Rng("sigma-pairing-changes"));
    const key = sigmaPairingKey(storm);
    const [first, ...rest] = storm.segments;
    const variants: Storm[] = [
      {
        ...storm,
        feederParent: storm.feederParent.map((p, v) =>
          v === storm.feederParent.length - 1 ? (p === 0 ? 1 : 0) : p,
        ),
      },
      { ...storm, customersAtBus: storm.customersAtBus.map((c) => c + 1) },
      { ...storm, criticalBuses: storm.criticalBuses.map((b) => b + 1) },
      { ...storm, segments: [{ ...first!, bus: first!.bus + 1 }, ...rest] },
    ];
    for (const variant of variants) {
      expect(sigmaPairingKey(variant)).not.toBe(key);
    }
    // Only the repair ticks changed: still paired.
    expect(
      sigmaPairingKey({
        ...storm,
        segments: storm.segments.map((s) => ({ ...s, ticks: s.ticks + 1 })),
      }),
    ).toBe(key);
  });
});
