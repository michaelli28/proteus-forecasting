/**
 * Canonical JSON serialization and content hashing.
 *
 * Run identity and artifact hashes are derived from these bytes, so the encoding
 * must be stable across processes and key-insertion order. `JSON.stringify` is
 * not: it preserves insertion order, so two structurally identical configs built
 * by different code paths would hash differently.
 */

import { createHash } from "node:crypto";

/** Non-finite numbers indicate a kernel bug and must never reach an artifact. */
function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `non-finite number in canonical JSON: ${String(value)}`,
    );
  }
}

/**
 * Deterministic JSON: object keys sorted, no whitespace, `-0` normalized to `0`,
 * `undefined` object values omitted, `undefined` array elements encoded as null.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  const kind = typeof value;

  if (kind === "number") {
    const n = value as number;
    assertFinite(n);
    return JSON.stringify(n === 0 ? 0 : n);
  }

  if (kind === "string" || kind === "boolean") return JSON.stringify(value);

  if (kind === "bigint") {
    throw new TypeError("bigint is not representable in canonical JSON");
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? "null" : canonicalize(v))).join(",")}]`;
  }

  if (kind === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalize(v)}`);
    }
    return `{${parts.join(",")}}`;
  }

  throw new TypeError(`cannot canonicalize value of type ${kind}`);
}

/** sha256 of the canonical encoding, hex. */
export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

/** sha256 of raw bytes, hex. */
export function hashBytes(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Short hash for directory names and logs. Not for integrity checks. */
export function shortHash(fullHash: string): string {
  return fullHash.slice(0, 16);
}

/**
 * Hash of a file manifest: sorted `path -> contentHash` pairs.
 * Order-independent, so an artifact written by a different traversal still
 * hashes the same.
 */
export function hashManifest(
  manifest: Readonly<Record<string, string>>,
): string {
  return hashCanonical(manifest);
}
