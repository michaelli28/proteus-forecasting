/**
 * The council's non-model logic.
 *
 * Everything tested here is what decides WHO deliberates and WHETHER an answer
 * is usable — the parts that must hold regardless of what any model says. The
 * model's judgement itself is not under test and could not be: it is the thing
 * being observed.
 */

import { describe, expect, it } from "vitest";
import {
  ChairVerdictSchema,
  SeatOpinionSchema,
  seatsFor,
} from "../../src/actors/council.js";
import type { DoctrineProfile } from "../../src/actors/doctrine.js";
import { DOCTRINE_PARAMETERS } from "../../src/actors/doctrine.js";

function profile(overrides: Partial<DoctrineProfile> = {}): DoctrineProfile {
  const doctrine = Object.fromEntries(
    DOCTRINE_PARAMETERS.map((parameter) => [
      parameter,
      { value: 0.5, confidence: "medium" as const, basis: "test fixture" },
    ]),
  ) as DoctrineProfile["doctrine"];

  return {
    id: "fixture",
    label: "Fixture Actor",
    kind: "state",
    summary: "A fixture.",
    doctrine,
    rationalityPrecision: 5,
    redlines: [],
    uncertainty: "none stated",
    sources: ["fixture"],
    ...overrides,
  };
}

describe("seatsFor", () => {
  it("uses the actor's documented gates, in their stated order", () => {
    const { seats, source } = seatsFor(
      profile({
        procedure: {
          authority: {
            statement: "the presidency",
            basis: "fixture",
            confidence: "high",
          },
          tempo: { statement: "weeks", basis: "fixture", confidence: "medium" },
          preconditions: [],
          steps: [
            {
              order: 2,
              stage: "authorisation",
              office: "the presidency",
              gate: "final go/no-go",
              basis: "fixture",
              confidence: "high",
            },
            {
              order: 0,
              stage: "proposal",
              office: "operational directorate",
              gate: "can decline to propose",
              basis: "fixture",
              confidence: "medium",
            },
          ],
        },
      }),
    );

    expect(source).toBe("documented");
    expect(seats.map((seat) => seat.office)).toEqual([
      "operational directorate",
      "the presidency",
    ]);
  });

  it("falls back to a generic table, and says that it did", () => {
    const { seats, source } = seatsFor(profile());
    expect(source).toBe("fallback");
    expect(seats.length).toBeGreaterThan(1);
    // The label is what a reader sees; it must not claim documentation it lacks.
    for (const seat of seats) expect(seat.basis).toMatch(/fallback/);
  });

  it("gives every seat a distinct id, so opinions cannot collide", () => {
    const { seats } = seatsFor(
      profile({
        procedure: {
          authority: { statement: "a", basis: "b", confidence: "low" },
          tempo: { statement: "a", basis: "b", confidence: "low" },
          preconditions: [],
          steps: [0, 1, 2].map((order) => ({
            order,
            stage: "review",
            // Same office name at three stages: a real pattern, and the case
            // where an id derived from the name alone would collapse them.
            office: "legal review",
            gate: "can stop it",
            basis: "fixture",
            confidence: "medium" as const,
          })),
        },
      }),
    );
    expect(new Set(seats.map((seat) => seat.id)).size).toBe(seats.length);
  });
});

describe("what a seat is allowed to return", () => {
  it("accepts the bracketed option reference models copy from the prompt", () => {
    const parsed = SeatOpinionSchema.parse({
      recommendation: "act",
      moveRef: "[SUB-URBAN-B|presence_revealed]",
      reasoning: "because",
      decisiveFactor: "signalling value",
      confidence: "high",
    });
    expect(parsed.moveRef).toBe("SUB-URBAN-B|presence_revealed");
  });

  it("treats an omitted, empty or 'null' reference as no option chosen", () => {
    for (const moveRef of [undefined, null, "", "  ", "null"]) {
      const parsed = SeatOpinionSchema.parse({
        recommendation: "refuse",
        moveRef,
        reasoning: "because",
        decisiveFactor: "a standing commitment",
        confidence: "moderate",
      });
      expect(parsed.moveRef).toBeNull();
    }
  });

  it("does not fail a chair's verdict just because the table was unanimous", () => {
    // A chair reporting no disagreement routinely omits `dissent` entirely.
    // Rejecting that would throw away the deliberation that produced it.
    const parsed = ChairVerdictSchema.parse({
      decision: "hold",
      reasoning: "nobody objected",
      confidence: "high",
    });
    expect(parsed.dissent).toBe("");
    expect(parsed.moveRef).toBeNull();
  });

  it("still rejects an answer that is missing its reasoning", () => {
    expect(() =>
      SeatOpinionSchema.parse({
        recommendation: "act",
        moveRef: null,
        decisiveFactor: "x",
        confidence: "high",
      }),
    ).toThrow();
  });
});
