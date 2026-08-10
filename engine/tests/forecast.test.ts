/**
 * The `forecast` command's logic, driven without a process or a network.
 *
 * Small worlds and short horizons: this exercises the real influence-ops
 * binding, so the point is that the wiring reaches a product, not that the
 * simulation is interesting.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { formatRunSummary, parseRange, runForecast } from "../src/forecast.js";
import type { ForecastOptions } from "../src/forecast.js";

let root: string;

const base = (): ForecastOptions => ({
  question: "Where does adoption land at the resolution tick?",
  measure: "adoptionRate",
  resolveAtTick: 9,
  bands: 3,
  runs: 3,
  seed: "cli-test",
  asOf: "2026-03-01",
  storeDir: root,
  offline: true,
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-cli-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("parseRange", () => {
  it("reads a two-number range", () => {
    expect(parseRange("0.35,0.65")).toEqual([0.35, 0.65]);
    expect(parseRange(" 0.1 , 0.9 ")).toEqual([0.1, 0.9]);
  });

  it("is absent when the flag is", () => {
    expect(parseRange()).toBeUndefined();
    expect(parseRange("")).toBeUndefined();
  });

  it("refuses a malformed range rather than repairing it", () => {
    expect(() => parseRange("0.35")).toThrow(/two numbers/);
    expect(() => parseRange("a,b")).toThrow(/two numbers/);
    expect(() => parseRange("0.35,0.4,0.5")).toThrow(/two numbers/);
    expect(() => parseRange("0.65,0.35")).toThrow(/lower bound/);
    expect(() => parseRange("0.5,0.5")).toThrow(/lower bound/);
  });
});

describe("runForecast", () => {
  it("produces a product with no model in the loop", async () => {
    const outcome = await runForecast(base());

    expect(outcome.result.product.question).toBe(base().question);
    expect(outcome.result.framingSource).toBe("fallback");
    expect(outcome.result.llmCalls).toBe(0);
    expect(outcome.result.costUsd).toBe(0);
    expect(outcome.result.bandCount).toBe(3);
  });

  it("writes its artifacts where it says it did", async () => {
    const outcome = await runForecast(base());
    expect(await readdir(outcome.storeDir)).not.toHaveLength(0);
  });

  it("reproduces itself from the same seed", async () => {
    const first = await runForecast(base());
    const second = await runForecast(base());

    expect(second.result.questionId).toBe(first.result.questionId);
    expect(second.result.probabilities).toEqual(first.result.probabilities);
    expect(second.result.product.bluf).toBe(first.result.product.bluf);
    expect(second.corpusSnapshotId).toBe(first.corpusSnapshotId);
  });

  it("changes its answer when the seed changes", async () => {
    const first = await runForecast(base());
    const second = await runForecast({ ...base(), seed: "cli-test-2" });
    expect(second.result.questionId).not.toBe(first.result.questionId);
  });

  it("never cites a document published after the cutoff", async () => {
    const outcome = await runForecast(base());
    for (const claim of outcome.result.product.claims) {
      for (const ref of claim.support) {
        expect(ref.publishedAt <= base().asOf).toBe(true);
      }
    }
  });
});

describe("formatRunSummary", () => {
  it("leads with the synthetic-world warning, before any number", async () => {
    const outcome = await runForecast(base());
    const text = formatRunSummary(outcome);

    expect(text.split("\n")[0]).toMatch(/SYNTHETIC WORLD/);
    expect(text).toMatch(/No real account, platform or person/);
  });

  it("says when the framer was unavailable rather than implying a model framed it", async () => {
    const outcome = await runForecast(base());
    const text = formatRunSummary(outcome);

    expect(text).toMatch(/framer unavailable/);
    expect(text).toContain(outcome.storeDir);
    expect(text).toMatch(/3\/3 runs completed/);
  });
});
