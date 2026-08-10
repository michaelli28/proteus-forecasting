/**
 * Content-addressed run artifacts.
 *
 * Replaces "one git branch per worker" with the same guarantee in less machinery:
 * a run's identity is the hash of what produced it, and its artifact hash is the
 * hash of everything it emitted. Deliberately domain-free — it stores opaque
 * JSON, exactly as scoring/ operates on opaque score matrices.
 */

import {
  mkdir,
  writeFile,
  readFile,
  readdir,
  appendFile,
  rm,
  stat,
} from "fs/promises";
import { join } from "path";
import {
  canonicalize,
  hashCanonical,
  hashBytes,
  hashManifest,
} from "./canonical.js";

/** Everything that determines a run's output. Same identity ⇒ same artifact. */
export interface RunIdentity {
  /** Domain-specific run configuration, canonicalized. */
  readonly config: unknown;
  /** Pinned corpus snapshot — a run may only retrieve from this. */
  readonly corpusSnapshotId: string;
  /** Bumped whenever kernel semantics change, invalidating old comparisons. */
  readonly kernelVersion: string;
}

export interface ArtifactManifest {
  readonly runId: string;
  readonly artifactHash: string;
  /** Relative path → sha256 of file bytes. Excludes the manifest itself. */
  readonly files: Readonly<Record<string, string>>;
}

const MANIFEST_FILE = "manifest.json";
const IDENTITY_FILE = "identity.json";
const EVENTS_FILE = "events.jsonl";

/** Events buffered before hitting disk. Bounds memory on long runs. */
const EVENT_FLUSH_THRESHOLD = 512;

/** Writes one run's files, then seals it with a manifest. */
export class RunWriter {
  private readonly buffer: string[] = [];
  private readonly extraFiles = new Set<string>();
  private closed = false;

  constructor(
    readonly runId: string,
    private readonly dir: string,
  ) {}

  /** Append one event to the log. Canonicalized so the log is byte-stable. */
  async appendEvent(event: unknown): Promise<void> {
    this.assertOpen();
    this.buffer.push(canonicalize(event));
    if (this.buffer.length >= EVENT_FLUSH_THRESHOLD) await this.flush();
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const chunk = this.buffer.join("\n") + "\n";
    this.buffer.length = 0;
    await appendFile(join(this.dir, EVENTS_FILE), chunk, "utf-8");
  }

  /** Write an additional artifact file (product, metrics, restricted view). */
  async writeFile(name: string, value: unknown): Promise<void> {
    this.assertOpen();
    if (name === MANIFEST_FILE) throw new Error(`${MANIFEST_FILE} is reserved`);
    await writeFile(join(this.dir, name), canonicalize(value), "utf-8");
    this.extraFiles.add(name);
  }

  /** Flush, hash every file, and seal. Returns the manifest. */
  async close(): Promise<ArtifactManifest> {
    this.assertOpen();
    await this.flush();
    this.closed = true;

    const names = [IDENTITY_FILE, EVENTS_FILE, ...this.extraFiles].sort();
    const files: Record<string, string> = {};
    for (const name of names) {
      const path = join(this.dir, name);
      const exists = await stat(path)
        .then(() => true)
        .catch(() => false);
      if (!exists) continue;
      files[name] = hashBytes(await readFile(path));
    }

    const manifest: ArtifactManifest = {
      runId: this.runId,
      artifactHash: hashManifest(files),
      files,
    };
    await writeFile(
      join(this.dir, MANIFEST_FILE),
      canonicalize(manifest),
      "utf-8",
    );
    return manifest;
  }

  private assertOpen(): void {
    if (this.closed) throw new Error(`run ${this.runId} is already closed`);
  }
}

export class ArtifactStore {
  constructor(private readonly rootDir: string) {}

  /** Run identity — the hash of everything that determines the output. */
  computeRunId(identity: RunIdentity): string {
    return hashCanonical(identity);
  }

  /**
   * Open a run for writing. Its directory is named by its identity hash.
   *
   * Any event log left by a previous run of this identity is DISCARDED, not
   * continued. Re-running an identity is how reproducibility gets checked, and
   * appending to the previous log would make the second run's artifact hash
   * differ from the first for a reason that has nothing to do with the
   * simulation — a determinism failure that is not one.
   */
  async create(identity: RunIdentity): Promise<RunWriter> {
    const runId = this.computeRunId(identity);
    const dir = join(this.rootDir, runId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, IDENTITY_FILE), canonicalize(identity), "utf-8");
    // Removed rather than blanked: a run that emits no events has no event log,
    // and an empty file would put one in the manifest.
    await rm(join(dir, EVENTS_FILE), { force: true });
    return new RunWriter(runId, dir);
  }

  async readManifest(runId: string): Promise<ArtifactManifest> {
    const raw = await readFile(
      join(this.rootDir, runId, MANIFEST_FILE),
      "utf-8",
    );
    return JSON.parse(raw) as ArtifactManifest;
  }

  async readIdentity(runId: string): Promise<RunIdentity> {
    const raw = await readFile(
      join(this.rootDir, runId, IDENTITY_FILE),
      "utf-8",
    );
    return JSON.parse(raw) as RunIdentity;
  }

  /** Parsed event log. */
  async readEvents(runId: string): Promise<unknown[]> {
    const raw = await readFile(join(this.rootDir, runId, EVENTS_FILE), "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as unknown);
  }

  /**
   * Re-hash every file and compare against the sealed manifest.
   * Detects both tampering and a run that changed under a fixed seed.
   */
  async verify(
    runId: string,
  ): Promise<{ ok: boolean; expected: string; actual: string }> {
    const manifest = await this.readManifest(runId);
    const files: Record<string, string> = {};
    for (const name of Object.keys(manifest.files)) {
      files[name] = hashBytes(await readFile(join(this.rootDir, runId, name)));
    }
    const actual = hashManifest(files);
    return {
      ok: actual === manifest.artifactHash,
      expected: manifest.artifactHash,
      actual,
    };
  }

  async list(): Promise<string[]> {
    const entries = await readdir(this.rootDir).catch(() => [] as string[]);
    return entries.sort();
  }

  async exists(runId: string): Promise<boolean> {
    return stat(join(this.rootDir, runId, MANIFEST_FILE))
      .then(() => true)
      .catch(() => false);
  }
}

export { MANIFEST_FILE, IDENTITY_FILE, EVENTS_FILE };
