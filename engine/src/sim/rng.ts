/**
 * Deterministic PRNG for the simulation kernel.
 *
 * The kernel's load-bearing property is that a pinned seed reproduces a
 * byte-identical event log. `Math.random()` is therefore banned everywhere under
 * `sim/` — enforced by tests/sim/determinism.test.ts, because a single stray call
 * silently destroys reproducibility and nothing else would catch it.
 */

/** Number of 32-bit words of state sfc32 carries. */
const STATE_WORDS = 4;

/** cyrb128 — expands a string seed into 4 well-mixed uint32 words. */
function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/**
 * Seeded random source. Construct with a string seed; derive independent
 * sub-streams with `fork`.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  readonly seed: string;

  constructor(seed: string) {
    this.seed = seed;
    const [a, b, c, d] = cyrb128(seed);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  /**
   * Independent sub-stream for a named subsystem.
   *
   * Without this, adding one draw to the network builder would shift every
   * subsequent campaign draw and silently change unrelated results — which reads
   * as "the intervention worked" when nothing happened.
   */
  fork(label: string): Rng {
    return new Rng(`${this.seed}::${label}`);
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new RangeError("maxExclusive must be > 0");
    return Math.floor(this.next() * maxExclusive);
  }

  /** True with probability p. */
  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Standard normal via Box-Muller.
   *
   * Deliberately discards the second variate rather than caching it: a cached
   * spare makes the stream's output depend on call parity, so inserting one
   * unrelated draw upstream would flip every later value.
   */
  normal(mean = 0, stddev = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return (
      mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    );
  }

  /** Normal clamped to [min, max]. */
  clampedNormal(
    mean: number,
    stddev: number,
    min: number,
    max: number,
  ): number {
    return Math.min(max, Math.max(min, this.normal(mean, stddev)));
  }

  /** Uniform choice from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0)
      throw new RangeError("cannot pick from empty array");
    return items[this.int(items.length)]!;
  }

  /** Index sampled from non-negative weights. */
  weightedIndex(weights: readonly number[]): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) throw new RangeError("weights must sum to > 0");
    let remaining = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      remaining -= weights[i]!;
      if (remaining < 0) return i;
    }
    return weights.length - 1;
  }

  /** Fisher-Yates shuffle returning a new array; the input is not mutated. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** `count` distinct items, or all of them if count exceeds the array length. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.min(count, items.length));
  }

  /** Internal state, for asserting two streams are positionally identical. */
  snapshot(): readonly number[] {
    return [this.a, this.b, this.c, this.d];
  }
}

export { STATE_WORDS };
