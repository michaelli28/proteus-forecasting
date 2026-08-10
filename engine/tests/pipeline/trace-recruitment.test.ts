/**
 * The trace projector, pointed at the domain it does not speak.
 *
 * Separate file from `trace.test.ts` because both adapters export `DEFAULT_CONFIG`
 * and `REFERENCE_CAMPAIGN`, and that file already binds those names to
 * influence-ops.
 *
 * Driven through a real recruitment simulation rather than a hand-built event
 * log: the whole risk here is that the two adapters' truth vocabularies drift
 * apart, and a fixture written from this file's own assumptions cannot detect
 * that.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runSimulation } from "../../src/sim/kernel.js";
import {
  recruitmentAdapter,
  DEFAULT_CONFIG,
} from "../../src/sim/adapters/recruitment/index.js";
import type { RecruitmentConfig } from "../../src/sim/adapters/recruitment/index.js";
import { buildRunTrace, TraceError } from "../../src/pipeline/trace.js";

const config: RecruitmentConfig = {
  ...DEFAULT_CONFIG,
  ticks: 20,
  workforce: { ...DEFAULT_CONFIG.workforce, people: 120, organizations: 3 },
};

const identity = {
  config,
  corpusSnapshotId: "corpus-abc",
  kernelVersion: "recruitment@1",
};

let events: readonly unknown[];

beforeAll(async () => {
  const result = await runSimulation(recruitmentAdapter, config, "trace-rec");
  events = result.events;
});

describe("buildRunTrace on a foreign domain", () => {
  it("refuses a recruitment run rather than projecting it as zeros", () => {
    expect(() => buildRunTrace("run-r1", identity, events)).toThrow(TraceError);
  });

  it("names the domain it found and the one it speaks", () => {
    expect(() => buildRunTrace("run-r2", identity, events)).toThrow(
      /recruitment@1.*influence-ops/s,
    );
  });

  /**
   * The reason the guard cannot simply trust `kernelVersion`: `str()` coerces a
   * missing one to "", and an unstamped run is exactly the case where guessing
   * costs the most.
   */
  it("fails closed on a run with no kernelVersion stamp", () => {
    expect(() =>
      buildRunTrace(
        "run-r3",
        { ...identity, kernelVersion: undefined },
        events,
      ),
    ).toThrow(TraceError);
  });

  /**
   * Domain is checked before the event log is inspected. An empty recruitment
   * run is a domain this projector cannot read, not a truncated log — and
   * "truncated log" would send the reader looking for a storage bug.
   */
  it("reports the domain, not a truncated log, when both are true", () => {
    expect(() => buildRunTrace("run-r4", identity, [])).toThrow(
      /recruitment@1/,
    );
  });
});
