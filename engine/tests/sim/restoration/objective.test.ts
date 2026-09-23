import { describe, it, expect } from "vitest";
import {
  ancestors,
  restorationTicks,
  customerTicks,
  listSchedule,
  scheduleBy,
  scheduleFromStarts,
} from "../../../src/sim/adapters/restoration/objective.js";
import type { RepairProblem } from "../../../src/sim/adapters/restoration/objective.js";

// Segment 0 at the substation; 1 below 0; 2 below 1; 3 on its own.
const chainAndOne: RepairProblem = {
  parent: [-1, 0, 1, -1],
  customers: [10, 5, 20, 7],
  ticks: [2, 3, 1, 4],
};

describe("the restoration objective", () => {
  it("lists each segment's broken ancestors, itself first", () => {
    expect(ancestors(chainAndOne)).toEqual([[0], [1, 0], [2, 1, 0], [3]]);
  });

  it("restores customers only when their whole upstream path is fixed", () => {
    // Downstream finished first: segment 2 done at tick 1, but 0 is not done until 8.
    const completion = [8, 4, 1, 12];
    expect(restorationTicks(chainAndOne, completion)).toEqual([8, 8, 8, 12]);
  });

  it("scores customers times the tick they come back", () => {
    const completion = [2, 5, 6, 10];
    // 10*2 + 5*5 + 20*6 + 7*10
    expect(customerTicks(chainAndOne, completion)).toBe(235);
    // Segments 1 and 2 finish before 0, so their customers wait for tick 8.
    // 10*8 + 5*8 + 20*8 + 7*12, not 10*8 + 5*4 + 20*1 + 7*12 = 204.
    expect(customerTicks(chainAndOne, [8, 4, 1, 12])).toBe(364);
  });

  it("hands jobs to the earliest-free crew, lowest index on a tie", () => {
    const schedule = listSchedule(chainAndOne, [0, 3, 1, 2], 2);
    expect(schedule.crew).toEqual([0, 0, 1, 1]);
    expect(schedule.start).toEqual([0, 2, 4, 0]);
    expect(schedule.completion).toEqual([2, 5, 5, 4]);
  });

  it("one crew is just the order, back to back", () => {
    const schedule = listSchedule(chainAndOne, [3, 0, 1, 2], 1);
    expect(schedule.completion).toEqual([6, 9, 10, 4]);
  });

  // A segment left off the list would keep completion 0: its customers would look
  // restored at tick 0 and the rule that dropped it would look cheaper.
  it("refuses an order that is not every segment exactly once", () => {
    expect(() => listSchedule(chainAndOne, [0, 3, 1], 2)).toThrow(
      /segment 2 is missing/,
    );
    expect(() => listSchedule(chainAndOne, [0, 3, 1, 1], 2)).toThrow(
      /segment 1 appears twice/,
    );
    expect(() => listSchedule(chainAndOne, [0, 3, 1, 2, 4], 2)).toThrow(
      /4 is not a segment/,
    );
    expect(() => listSchedule(chainAndOne, [0, 3, 1, 1.5], 2)).toThrow(
      /1.5 is not a segment/,
    );
    expect(() => listSchedule(chainAndOne, [], 1)).toThrow(
      /segment 0 is missing/,
    );
  });

  it("asks for a segment whenever a crew frees up, lowest crew first, and never idles it", () => {
    // Same jobs as the list test above: crew 0 frees at 2, crew 1 at 4, crew 0 at 5.
    const order = [0, 3, 1, 2];
    const calls: { crew: number; started: boolean[] }[] = [];
    const schedule = scheduleBy(chainAndOne, 2, (crew, started) => {
      calls.push({ crew, started: [...started] });
      return order[calls.length - 1]!;
    });
    expect(calls).toEqual([
      { crew: 0, started: [false, false, false, false] },
      { crew: 1, started: [true, false, false, false] },
      { crew: 0, started: [true, false, false, true] },
      { crew: 1, started: [true, true, false, true] },
    ]);
    expect(schedule).toEqual({
      start: [0, 2, 4, 0],
      completion: [2, 5, 5, 4],
      crew: [0, 0, 1, 1],
    });
  });

  it("refuses a pick that is already started or not a segment", () => {
    expect(() => scheduleBy(chainAndOne, 2, () => 0)).toThrow(
      /segment 0 is already started/,
    );
    for (const bad of [4, -1, 1.5, Number.NaN]) {
      expect(() => scheduleBy(chainAndOne, 1, () => bad)).toThrow(
        new RegExp(`${bad} is not a segment of 0..3`),
      );
    }
  });

  it("refuses completion ticks that do not match the segments one for one", () => {
    // Too short would score NaN; too long would silently score only the first four.
    expect(() => restorationTicks(chainAndOne, [8, 4, 1])).toThrow(
      /4 segments.*got 3/,
    );
    expect(() => customerTicks(chainAndOne, [8, 4, 1])).toThrow(
      /4 segments.*got 3/,
    );
    expect(() => customerTicks(chainAndOne, [2, 5, 6, 10, 99])).toThrow(
      /4 segments.*got 5/,
    );
  });

  it("assigns crews to a valid set of starts and rejects too many at once", () => {
    const ok = scheduleFromStarts(chainAndOne, [0, 2, 5, 0], 2);
    expect(ok.completion).toEqual([2, 5, 6, 4]);
    expect(ok.crew).toEqual([0, 0, 0, 1]);
    // Three repairs under way at tick 0 with two crews.
    expect(() => scheduleFromStarts(chainAndOne, [0, 0, 0, 5], 2)).toThrow(
      /more than 2/,
    );
    expect(() => scheduleFromStarts(chainAndOne, [0, 1.5, 4, 6], 2)).toThrow(
      /whole tick/,
    );
    expect(() => scheduleFromStarts(chainAndOne, [0, 2, 5], 2)).toThrow(
      /4 segments/,
    );
  });
});
