import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
  ArtifactStore,
  type RunIdentity,
  EVENTS_FILE,
} from "../../src/artifact/store.js";

let root: string;
let store: ArtifactStore;

const identity: RunIdentity = {
  config: { ticks: 100, agents: 500, campaign: { start: 20, intensity: 0.3 } },
  corpusSnapshotId: "corpus-abc123",
  kernelVersion: "influence-ops@1",
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "proteus-artifacts-"));
  store = new ArtifactStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("run identity", () => {
  it("is stable for the same identity", () => {
    expect(store.computeRunId(identity)).toBe(store.computeRunId(identity));
  });

  it("ignores key order inside the config", () => {
    const reordered: RunIdentity = {
      kernelVersion: identity.kernelVersion,
      corpusSnapshotId: identity.corpusSnapshotId,
      config: {
        agents: 500,
        campaign: { intensity: 0.3, start: 20 },
        ticks: 100,
      },
    };
    expect(store.computeRunId(reordered)).toBe(store.computeRunId(identity));
  });

  it("changes when the seed or any config value changes", () => {
    const changed = {
      ...identity,
      config: { ...(identity.config as object), ticks: 101 },
    };
    expect(store.computeRunId(changed)).not.toBe(store.computeRunId(identity));
  });

  it("changes when the corpus snapshot changes", () => {
    // A run against a different corpus is a different run, even at the same seed.
    expect(
      store.computeRunId({ ...identity, corpusSnapshotId: "other" }),
    ).not.toBe(store.computeRunId(identity));
  });

  it("changes when the kernel version changes", () => {
    expect(
      store.computeRunId({ ...identity, kernelVersion: "influence-ops@2" }),
    ).not.toBe(store.computeRunId(identity));
  });
});

describe("write and read back", () => {
  it("round-trips identity, events and extra files", async () => {
    const writer = await store.create(identity);
    await writer.appendEvent({ tick: 0, meanBelief: 0.5 });
    await writer.appendEvent({ tick: 1, meanBelief: 0.52 });
    await writer.writeFile("product.json", {
      likelihood: "likely",
      confidence: "moderate",
    });
    const manifest = await writer.close();

    expect(await store.readIdentity(manifest.runId)).toEqual(identity);
    expect(await store.readEvents(manifest.runId)).toEqual([
      { tick: 0, meanBelief: 0.5 },
      { tick: 1, meanBelief: 0.52 },
    ]);
    expect(manifest.files).toHaveProperty("product.json");
    expect(await store.exists(manifest.runId)).toBe(true);
  });

  it("flushes correctly past the buffer threshold", async () => {
    const writer = await store.create(identity);
    for (let tick = 0; tick < 1500; tick++) await writer.appendEvent({ tick });
    await writer.close();
    const events = (await store.readEvents(store.computeRunId(identity))) as {
      tick: number;
    }[];
    expect(events).toHaveLength(1500);
    expect(events[0]).toEqual({ tick: 0 });
    expect(events[1499]).toEqual({ tick: 1499 });
  });

  it("handles a run that emits no events", async () => {
    const writer = await store.create(identity);
    const manifest = await writer.close();
    expect(manifest.files).not.toHaveProperty(EVENTS_FILE);
    expect(manifest.artifactHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lists written runs", async () => {
    const writer = await store.create(identity);
    await writer.close();
    expect(await store.list()).toEqual([store.computeRunId(identity)]);
  });

  it("reports a missing run as absent", async () => {
    expect(await store.exists("deadbeef")).toBe(false);
  });
});

describe("artifact hashing", () => {
  it("is identical for two runs that emitted identical content", async () => {
    const first = await store.create(identity);
    await first.appendEvent({ tick: 0, v: 1 });
    const a = await first.close();

    const otherRoot = await mkdtemp(join(tmpdir(), "proteus-artifacts-b-"));
    try {
      const otherStore = new ArtifactStore(otherRoot);
      const second = await otherStore.create(identity);
      await second.appendEvent({ tick: 0, v: 1 });
      const b = await second.close();

      // This is the determinism guarantee, expressed as a hash comparison.
      expect(b.artifactHash).toBe(a.artifactHash);
      expect(b.runId).toBe(a.runId);
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
  });

  it("differs when the event log differs", async () => {
    const first = await store.create(identity);
    await first.appendEvent({ tick: 0, v: 1 });
    const a = await first.close();

    const otherRoot = await mkdtemp(join(tmpdir(), "proteus-artifacts-c-"));
    try {
      const second = await new ArtifactStore(otherRoot).create(identity);
      await second.appendEvent({ tick: 0, v: 2 });
      const b = await second.close();
      expect(b.artifactHash).not.toBe(a.artifactHash);
    } finally {
      await rm(otherRoot, { recursive: true, force: true });
    }
  });
});

describe("verify", () => {
  it("passes on an untouched artifact", async () => {
    const writer = await store.create(identity);
    await writer.appendEvent({ tick: 0 });
    const manifest = await writer.close();
    expect(await store.verify(manifest.runId)).toMatchObject({ ok: true });
  });

  it("detects a tampered event log", async () => {
    const writer = await store.create(identity);
    await writer.appendEvent({ tick: 0, meanBelief: 0.5 });
    const manifest = await writer.close();

    const eventsPath = join(root, manifest.runId, EVENTS_FILE);
    const original = await readFile(eventsPath, "utf-8");
    await writeFile(eventsPath, original.replace("0.5", "0.9"), "utf-8");

    const result = await store.verify(manifest.runId);
    expect(result.ok).toBe(false);
    expect(result.actual).not.toBe(result.expected);
  });
});

describe("writer lifecycle", () => {
  it("rejects writes after close", async () => {
    const writer = await store.create(identity);
    await writer.close();
    await expect(writer.appendEvent({ tick: 1 })).rejects.toThrow(
      /already closed/,
    );
    await expect(writer.writeFile("x.json", {})).rejects.toThrow(
      /already closed/,
    );
  });

  it("rejects a second close", async () => {
    const writer = await store.create(identity);
    await writer.close();
    await expect(writer.close()).rejects.toThrow(/already closed/);
  });

  it("reserves the manifest filename", async () => {
    const writer = await store.create(identity);
    await expect(writer.writeFile("manifest.json", {})).rejects.toThrow(
      /reserved/,
    );
  });
});
