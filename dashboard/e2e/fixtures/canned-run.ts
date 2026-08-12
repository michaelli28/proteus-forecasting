/**
 * A canned run stream, for exercising the councils view without an engine.
 *
 * A real deep run costs minutes and real model money, so the suite would never
 * run one — which is exactly why the councils view went unchecked long enough
 * to grow into a wall of three dozen open cards. These are the same events the
 * engine emits, delivered instantly and for free.
 */

import { expect, type Page } from "@playwright/test";

interface Seat {
  id: string;
  office: string;
  stage: string;
  gate: string;
}

export const SEATS: Seat[] = [
  { id: "s1", office: "The central apparatus", stage: "staffing", gate: "a" },
  { id: "s2", office: "The Security Council", stage: "staffing", gate: "b" },
  { id: "s3", office: "The presidency", stage: "decision", gate: "c" },
];

/** One council's events: opened, every seat, then the chair. */
function council(
  branchId: string,
  tick: number,
  agreed: boolean,
  divided: boolean,
  seq: () => number,
): string[] {
  const councilId = `${branchId}-t${tick}-russia`;
  // A divided table has its last seat holding out against the other two.
  const seatCall = (index: number): string =>
    divided && index === SEATS.length - 1 ? "hold" : "act";
  const events: object[] = [
    {
      type: "council_opened",
      councilId,
      branchId,
      tick,
      actorId: "russia",
      actorLabel: "Russian Federation",
      trigger: "the model authorised a move at this step",
      seatSource: "documented",
      seats: SEATS,
    },
    ...SEATS.map((seat, index) => ({
      type: "seat_opinion",
      councilId,
      seatId: seat.id,
      agentLabel: `seat:${councilId}:${seat.id}`,
      office: seat.office,
      recommendation: seatCall(index),
      moveRef: null,
      reasoning: `${seat.office} reasoning for ${councilId}`,
      decisiveFactor: "demonstrative signalling at zero civilian cost",
      confidence: "medium",
    })),
    {
      type: "council_verdict",
      councilId,
      agentLabel: `chair:${councilId}`,
      branchId,
      tick,
      actorId: "russia",
      decision: "act",
      moveRef: null,
      reasoning: `CHAIR-REASONING-${councilId}`,
      dissent: divided ? `The presidency wanted to wait.` : "",
      confidence: "high",
      kernelDecision: agreed ? "act" : "hold",
      kernelMoveRef: null,
      agreed,
      split: divided
        ? { act: SEATS.length - 1, hold: 1, refuse: 0 }
        : { act: SEATS.length, hold: 0, refuse: 0 },
    },
  ];
  return events.map((event) => frame(event, seq()));
}

function frame(event: object, seq: number): string {
  return `event: run\ndata: ${JSON.stringify({
    ...event,
    seq,
    channel: "truth",
    elapsedMs: seq * 10,
  })}\n\n`;
}

/** Two worlds, three councils each, two of which part from the arithmetic. */
export function cannedRun(): string {
  let n = 0;
  const seq = () => ++n;
  const parts: string[] = [
    frame(
      {
        type: "run_started",
        runId: "stub-run-0001",
        scenarioId: "regional-grid",
        statement: "A stubbed situation, for testing the councils view.",
        ticks: 180,
        tickUnit: "day",
        seed: "stub",
        actors: [{ id: "russia", label: "Russian Federation", kind: "state" }],
        assets: [{ id: "a1", assetClass: "substation", zone: "z1" }],
        ladder: [{ id: "r1", statement: "a rung" }],
        oracle: {
          method: "stub",
          evidenceClass: "(b) local e2e against stubs",
          harmUnit: "customer-hours",
        },
        caveat: "Stubbed stream — no engine ran.",
      },
      seq(),
    ),
  ];

  for (const [index, branchId] of ["w1", "w2"].entries()) {
    parts.push(
      frame(
        {
          type: "branch_opened",
          branchId,
          seed: `stub:${branchId}`,
          premise: "a draw",
          index,
          total: 2,
        },
        seq(),
      ),
      frame(
        {
          type: "tick",
          tick: 10,
          branchId,
          heldCount: 1,
          cumulativeHarm: 100,
          cumulativeDefenseCost: 0,
        },
        seq(),
      ),
      frame(
        {
          type: "branch_finished",
          branchId,
          activations: 2,
          totalHarm: 100,
          decisionPoints: 3,
        },
        seq(),
      ),
    );
  }

  // Each world parts from the arithmetic once. Parting and dividing are
  // separate facts, so the fixture varies them separately: w1's step 22 does
  // both, w2's step 55 parts from a table that was unanimous, and w1's step 33
  // divides without parting.
  parts.push(
    ...council("w1", 11, true, false, seq),
    ...council("w1", 22, false, true, seq),
    ...council("w1", 33, true, true, seq),
    ...council("w2", 44, true, false, seq),
    ...council("w2", 55, false, false, seq),
    ...council("w2", 66, true, false, seq),
  );

  parts.push(
    frame(
      {
        type: "run_finished",
        runId: "stub-run-0001",
        ticks: 180,
        activations: 4,
        totalHarm: 200,
        harmUnit: "customer-hours",
        evidenceClass: "(b) local e2e against stubs",
      },
      seq(),
    ),
    `event: done\ndata: {"ok":true}\n\n`,
  );

  return parts.join("");
}

export async function runStubbed(page: Page): Promise<void> {
  await page.route("**/api/live**", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
      body: cannedRun(),
    }),
  );

  await page.goto("/live", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^run it( for real)?$/i }).click();

  await expect(
    page.getByRole("heading", { name: /where the institutions/i }),
    "the councils section never rendered",
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/reproduces exactly/i)).toBeVisible({
    timeout: 20_000,
  });
}
