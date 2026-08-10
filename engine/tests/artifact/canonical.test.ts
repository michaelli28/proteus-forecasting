import { describe, it, expect } from "vitest";
import {
  canonicalize,
  hashCanonical,
  hashBytes,
  hashManifest,
  shortHash,
} from "../../src/artifact/canonical.js";

describe("canonicalize", () => {
  it("sorts object keys", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("is insensitive to key insertion order", () => {
    // The whole reason this module exists: JSON.stringify is not.
    const built = { seed: "s", corpus: "c", ticks: 100 };
    const rebuilt = { ticks: 100, corpus: "c", seed: "s" };
    expect(canonicalize(built)).toBe(canonicalize(rebuilt));
    expect(JSON.stringify(built)).not.toBe(JSON.stringify(rebuilt));
  });

  it("sorts keys at every depth", () => {
    const a = { outer: { z: 1, a: { y: 2, b: 3 } } };
    const b = { outer: { a: { b: 3, y: 2 }, z: 1 } };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });

  it("normalizes -0 to 0", () => {
    expect(canonicalize(-0)).toBe("0");
    expect(canonicalize({ v: -0 })).toBe(canonicalize({ v: 0 }));
  });

  it("omits undefined object values", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("encodes undefined array elements as null", () => {
    expect(canonicalize([1, undefined, 3])).toBe("[1,null,3]");
  });

  it("handles null, booleans and strings", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize("hi")).toBe('"hi"');
  });

  it("escapes strings correctly", () => {
    expect(canonicalize({ 'a"b': "c\nd" })).toBe('{"a\\"b":"c\\nd"}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalize(NaN)).toThrow(TypeError);
    expect(() => canonicalize(Infinity)).toThrow(TypeError);
    expect(() => canonicalize({ v: -Infinity })).toThrow(TypeError);
  });

  it("rejects bigint and functions", () => {
    expect(() => canonicalize(10n)).toThrow(TypeError);
    expect(() => canonicalize(() => 1)).toThrow(TypeError);
  });

  it("produces parseable JSON", () => {
    const value = { b: [1, { d: 4, c: 3 }], a: "x" };
    expect(JSON.parse(canonicalize(value))).toEqual(value);
  });
});

describe("hashCanonical", () => {
  it("is stable across key order", () => {
    expect(hashCanonical({ a: 1, b: 2 })).toBe(hashCanonical({ b: 2, a: 1 }));
  });

  it("differs when a value differs", () => {
    expect(hashCanonical({ seed: 1 })).not.toBe(hashCanonical({ seed: 2 }));
  });

  it("returns 64 hex characters", () => {
    expect(hashCanonical({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("distinguishes an absent key from an explicit null", () => {
    expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 1, b: null }));
  });
});

describe("hashManifest", () => {
  it("is order-independent", () => {
    const a = { "events.jsonl": "aa", "identity.json": "bb" };
    const b = { "identity.json": "bb", "events.jsonl": "aa" };
    expect(hashManifest(a)).toBe(hashManifest(b));
  });

  it("changes when any file hash changes", () => {
    expect(hashManifest({ "a.json": "x" })).not.toBe(
      hashManifest({ "a.json": "y" }),
    );
  });

  it("changes when a file is added", () => {
    expect(hashManifest({ "a.json": "x" })).not.toBe(
      hashManifest({ "a.json": "x", "b.json": "y" }),
    );
  });
});

describe("hashBytes / shortHash", () => {
  it("hashes raw bytes consistently", () => {
    expect(hashBytes("abc")).toBe(hashBytes(Buffer.from("abc")));
  });

  it("shortens to 16 characters", () => {
    expect(shortHash(hashCanonical({ a: 1 }))).toHaveLength(16);
  });
});
