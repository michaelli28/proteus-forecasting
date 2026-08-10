import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ArtifactStore } from "../../src/artifact/store.js";
import { runEnsemble, runSeed } from "../../src/pipeline/ensemble.js";
import { mapWithConcurrency } from "../../src/util/concurrency.js";
import { resolveOutcome } from "../../src/evidence/partition.js";
import { STUB_BANDS, TOY_QUANTITY, toyBinding, toySpec } from "./harness.js";
import type { EnsembleRequest } from "../../src/pipeline/ensemble.js";
import type { ToyConfig, ToyState } from "./harness.js";

let root: string;
let store: ArtifactStore;

const SPECS = [
  toySpec("r1", 5, 10),
  toySpec("r2", 45, 40),
  toySpec("r3", 95, 80),
];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-ensemble-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function request(
  overrides: Partial<EnsembleRequest<ToyConfig, ToyState>> = {},
): EnsembleRequest<ToyConfig, ToyState> {
  return {
    binding: toyBinding,
    specs: SPECS,
    bands: STUB_BANDS,
    quantity: TOY_QUANTITY,
    store,
    corpusSnapshotId: "corpus-test",
    seedNamespace: "root/ensemble",
    concurrency: 2,
    ...overrides,
  };
}

describe("mapWithConcurrency", () => {
  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      3,
      async (item) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        return item;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("returns results in input order regardless of completion order", async () => {
    const out = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("rejects a non-positive limit", async () => {
    await expect(mapWithConcurrency([1], 0, async (x) => x)).rejects.toThrow(
      RangeError,
    );
  });
});

describe("runEnsemble", () => {
  it("runs every spec and keeps summaries in spec order", async () => {
    const result = await runEnsemble(request());
    expect(result.planned).toBe(3);
    expect(result.summaries.map((s) => s.specId)).toEqual(["r1", "r2", "r3"]);
    expect(result.failures).toEqual([]);
    expect(result.completionRatio).toBe(1);
  });

  it("assigns each run the band resolveOutcome would assign", async () => {
    const result = await runEnsemble(request());
    for (const summary of result.summaries) {
      expect(summary.bandId).toBe(
        resolveOutcome(STUB_BANDS, summary.quantity).bandId,
      );
    }
  });

  it("seals a verifiable artifact per run", async () => {
    const result = await runEnsemble(request());
    for (const summary of result.summaries) {
      const check = await store.verify(summary.runId);
      expect(check.ok).toBe(true);
      expect(summary.artifactHash).toBe(check.expected);
    }
  });

  it("reproduces identical artifact hashes for the same seed namespace", async () => {
    const first = await runEnsemble(request());
    const second = await runEnsemble(request());
    expect(second.summaries.map((s) => s.artifactHash)).toEqual(
      first.summaries.map((s) => s.artifactHash),
    );
    expect(second.summaries.map((s) => s.quantity)).toEqual(
      first.summaries.map((s) => s.quantity),
    );
  });

  it("produces distinct artifacts under a different seed namespace", async () => {
    const first = await runEnsemble(request());
    const rerun = await runEnsemble(request({ seedNamespace: "root/rerun-1" }));
    expect(rerun.summaries.map((s) => s.runId)).not.toEqual(
      first.summaries.map((s) => s.runId),
    );
  });

  it("records a failed member without aborting the rest", async () => {
    const brittle = {
      ...toyBinding,
      configFor: (
        spec: Parameters<typeof toyBinding.configFor>[0],
        quantity: Parameters<typeof toyBinding.configFor>[1],
      ) => {
        if (spec.id === "r2") throw new Error("config rejected");
        return toyBinding.configFor(spec, quantity);
      },
    };
    const result = await runEnsemble(request({ binding: brittle }));
    expect(result.summaries.map((s) => s.specId)).toEqual(["r1", "r3"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.specId).toBe("r2");
    expect(result.failures[0]!.message).toMatch(/config rejected/);
    expect(result.completionRatio).toBeCloseTo(2 / 3, 10);
  });

  it("pins the seed into the run identity so a rerun cannot overwrite an artifact", async () => {
    const first = await runEnsemble(request());
    const rerun = await runEnsemble(request({ seedNamespace: "root/rerun-1" }));
    const ids = new Set([
      ...first.summaries.map((s) => s.runId),
      ...rerun.summaries.map((s) => s.runId),
    ]);
    expect(ids.size).toBe(6);
  });

  it("rejects an empty spec list rather than returning an empty ensemble", async () => {
    await expect(runEnsemble(request({ specs: [] }))).rejects.toThrow(
      RangeError,
    );
  });
});

describe("runSeed", () => {
  it("is stable and namespace-scoped", () => {
    expect(runSeed("root/ensemble", "r1")).toBe(runSeed("root/ensemble", "r1"));
    expect(runSeed("root/ensemble", "r1")).not.toBe(
      runSeed("root/rerun-1", "r1"),
    );
  });
});
