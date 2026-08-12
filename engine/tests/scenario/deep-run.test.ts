/**
 * Where a deep run decides to stop and think.
 *
 * This selection is the whole cost model: convening on every step of every world
 * would be thousands of model calls for a run whose interesting moments number
 * in the dozens. It is also the whole honesty model — a bounded search reported
 * as an exhaustive one is the same defect as an unsourced number.
 */

import { describe, expect, it } from "vitest";
import { capPerBranch, decisionPoints } from "../../src/scenario/deep-run.js";
import type { CapturedDeliberation } from "../../src/scenario/run.js";

function step(
  tick: number,
  overrides: Record<string, unknown> = {},
): CapturedDeliberation {
  return {
    tick,
    payload: {
      actorId: "russia",
      actorLabel: "Russian Federation",
      frame: "gain",
      decision: "no_positive_move",
      holdValue: 0,
      considered: [{ assetId: "A", rungId: "r", total: -1 }],
      blocked: [],
      chosen: null,
      ...overrides,
    },
  };
}

describe("decisionPoints", () => {
  it("stops where the institution acted", () => {
    const points = decisionPoints("w1", [
      step(1),
      step(2, { decision: "act", chosen: { assetId: "A", rungId: "r" } }),
    ]);
    expect(points.map((point) => point.tick)).toContain(2);
    expect(points.find((point) => point.tick === 2)?.trigger).toMatch(
      /authorised a move/,
    );
  });

  it("stops where the institution began treating its position as losing", () => {
    const points = decisionPoints("w1", [
      step(1, { frame: "gain" }),
      step(2, { frame: "loss" }),
    ]);
    expect(points.find((point) => point.tick === 2)?.trigger).toMatch(
      /treating its position as losing/,
    );
  });

  it("stops where its own commitments emptied the table", () => {
    const points = decisionPoints("w1", [
      step(1, {
        decision: "all_moves_blocked",
        blocked: [{ assetId: "A", rungId: "r", redlineStatement: "no" }],
      }),
    ]);
    expect(points[0]?.trigger).toMatch(/emptied the table/);
  });

  it("stops where waiting and acting were within a hair of each other", () => {
    const points = decisionPoints("w1", [
      step(1, {
        decision: "hold",
        holdValue: 1,
        considered: [{ assetId: "A", rungId: "r", total: 0.99 }],
      }),
    ]);
    expect(points[0]?.trigger).toMatch(/within a hair/);
  });

  it("does not stop on a quiet step", () => {
    expect(decisionPoints("w1", [step(1), step(2), step(3)]).length).toBe(1);
  });

  it("still convenes once for an actor that never acts at all", () => {
    // The case that most looks like the model is idle. An institution that held
    // capability for the whole window and judged every use of it not worth
    // making is exactly the thing a defender wants explained.
    const points = decisionPoints("w1", [
      step(1, { considered: [{ assetId: "A", rungId: "r", total: -5 }] }),
      step(2, { considered: [{ assetId: "A", rungId: "r", total: -0.1 }] }),
      step(3, { considered: [{ assetId: "A", rungId: "r", total: -3 }] }),
    ]);
    expect(points.length).toBe(1);
    expect(points[0]?.tick).toBe(2);
    expect(points[0]?.trigger).toMatch(/never acted/);
  });

  it("keeps worlds separate", () => {
    const acted = { decision: "act", chosen: { assetId: "A", rungId: "r" } };
    expect(decisionPoints("w2", [step(5, acted)])[0]?.branchId).toBe("w2");
  });
});

describe("capPerBranch", () => {
  const point = (
    branchId: string,
    tick: number,
    rank: number,
    actorId = "russia",
  ) => ({
    branchId,
    tick,
    actorId,
    trigger: "t",
    rank,
    payload: {} as never,
  });

  it("gives every actor a step before any actor gets a second", () => {
    // The case this exists for: one actor authorises move after move while the
    // other declines for the whole window. Ranked strictly, the busy actor
    // takes every slot and the one that declined — the comparison the run was
    // set up to make — convenes nothing and reads as though it were idle.
    const { kept } = capPerBranch(
      [
        point("w1", 10, 0, "russia"),
        point("w1", 11, 0, "russia"),
        point("w1", 12, 0, "russia"),
        point("w1", 99, 4, "china"),
      ],
      2,
    );
    expect(kept.map((entry) => entry.actorId).sort()).toEqual([
      "china",
      "russia",
    ]);
  });

  it("still prefers the better-ranked step within one actor", () => {
    const { kept } = capPerBranch(
      [
        point("w1", 10, 3, "russia"),
        point("w1", 11, 0, "russia"),
        point("w1", 99, 4, "china"),
      ],
      2,
    );
    expect(kept.map((entry) => entry.tick)).toEqual([11, 99]);
  });

  it("cannot seat more actors than the cap allows, and says how many it dropped", () => {
    const { kept, dropped } = capPerBranch(
      [
        point("w1", 1, 0, "russia"),
        point("w1", 2, 1, "china"),
        point("w1", 3, 2, "iran"),
      ],
      2,
    );
    expect(kept).toHaveLength(2);
    expect(dropped).toBe(1);
    expect(kept.map((entry) => entry.actorId)).toEqual(["russia", "china"]);
  });

  it("keeps the most interesting steps and reports what it dropped", () => {
    const { kept, dropped } = capPerBranch(
      [
        point("w1", 10, 3),
        point("w1", 20, 0),
        point("w1", 30, 1),
        point("w2", 40, 2),
      ],
      2,
    );
    expect(dropped).toBe(1);
    expect(
      kept.filter((entry) => entry.branchId === "w1").map((e) => e.tick),
    ).toEqual([20, 30]);
    expect(kept.some((entry) => entry.branchId === "w2")).toBe(true);
  });

  it("caps each world independently, so one busy world cannot starve another", () => {
    const { kept } = capPerBranch(
      [
        point("w1", 1, 0),
        point("w1", 2, 0),
        point("w1", 3, 0),
        point("w2", 4, 0),
      ],
      1,
    );
    expect(kept.map((entry) => entry.branchId).sort()).toEqual(["w1", "w2"]);
  });

  it("returns the kept steps in run order, not in the order it ranked them", () => {
    const { kept } = capPerBranch(
      [point("w1", 90, 0), point("w1", 10, 1), point("w1", 50, 2)],
      3,
    );
    expect(kept.map((entry) => entry.tick)).toEqual([10, 50, 90]);
  });
});
