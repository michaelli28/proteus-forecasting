/**
 * Outcome partitions.
 *
 * Hypotheses are bands over a measurable quantity rather than free-text
 * propositions. Three things follow structurally instead of being asserted by a
 * model that was asked nicely:
 *
 *   - mutual exclusivity — bands cannot overlap
 *   - collective exhaustiveness — bands must tile the range
 *   - resolution — the realized value falls in exactly one band
 *
 * Without this, "are these hypotheses really mutually exclusive?" is a judgement
 * call on every question, and forecast probabilities stop summing to 1.
 */

export interface OutcomeBand {
  readonly id: string;
  readonly statement: string;
  /** Inclusive lower bound. */
  readonly lower: number;
  /** Exclusive upper bound, except for the final band which is inclusive. */
  readonly upper: number;
}

export interface TargetQuantity {
  readonly name: string;
  readonly description: string;
  readonly min: number;
  readonly max: number;
  /** Simulation tick at which the quantity is read. */
  readonly resolveAtTick: number;
}

export class PartitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartitionError";
  }
}

/**
 * Verify the bands tile [min, max] exactly: sorted, contiguous, no gaps, no
 * overlaps, covering both endpoints.
 */
export function assertPartition(
  bands: readonly OutcomeBand[],
  quantity: Pick<TargetQuantity, "min" | "max">,
): void {
  if (bands.length < 2) {
    throw new PartitionError("a partition needs at least two bands");
  }

  const ids = new Set(bands.map((b) => b.id));
  if (ids.size !== bands.length)
    throw new PartitionError("band ids must be unique");

  for (const band of bands) {
    if (!Number.isFinite(band.lower) || !Number.isFinite(band.upper)) {
      throw new PartitionError(`band ${band.id} has a non-finite bound`);
    }
    if (band.upper <= band.lower) {
      throw new PartitionError(`band ${band.id} has upper <= lower`);
    }
  }

  const sorted = [...bands].sort((a, b) => a.lower - b.lower);

  if (sorted[0]!.lower !== quantity.min) {
    throw new PartitionError(
      `partition starts at ${sorted[0]!.lower}, expected ${quantity.min}`,
    );
  }
  if (sorted[sorted.length - 1]!.upper !== quantity.max) {
    throw new PartitionError(
      `partition ends at ${sorted[sorted.length - 1]!.upper}, expected ${quantity.max}`,
    );
  }

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.lower < previous.upper) {
      throw new PartitionError(
        `bands ${previous.id} and ${current.id} overlap — hypotheses would not be mutually exclusive`,
      );
    }
    if (current.lower > previous.upper) {
      throw new PartitionError(
        `gap between ${previous.id} and ${current.id} — outcomes in (${previous.upper}, ${current.lower}) are unforecastable`,
      );
    }
  }
}

/** The band containing a realized value, or null if outside the range. */
export function bandFor(
  bands: readonly OutcomeBand[],
  value: number,
): OutcomeBand | null {
  const sorted = [...bands].sort((a, b) => a.lower - b.lower);
  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i]!;
    const isLast = i === sorted.length - 1;
    // The final band closes at the top so max itself resolves.
    if (
      value >= band.lower &&
      (isLast ? value <= band.upper : value < band.upper)
    ) {
      return band;
    }
  }
  return null;
}

/**
 * Resolve a realized value into a one-hot outcome vector aligned to `bands`.
 * This is the ground truth a Brier score is computed against.
 */
export function resolveOutcome(
  bands: readonly OutcomeBand[],
  value: number,
): { bandId: string; oneHot: number[] } {
  const sorted = [...bands].sort((a, b) => a.lower - b.lower);
  const hit = bandFor(sorted, value);
  if (!hit) {
    throw new PartitionError(`value ${value} falls outside the partition`);
  }
  return {
    bandId: hit.id,
    oneHot: sorted.map((b) => (b.id === hit.id ? 1 : 0)),
  };
}

/** Evenly divide a range into `count` bands. The default framing offer. */
export function uniformPartition(
  quantity: Pick<TargetQuantity, "min" | "max">,
  count: number,
  label: (lower: number, upper: number, index: number) => string,
): OutcomeBand[] {
  if (count < 2) throw new PartitionError("count must be >= 2");
  const width = (quantity.max - quantity.min) / count;
  return Array.from({ length: count }, (_, i) => {
    const lower = quantity.min + i * width;
    const upper =
      i === count - 1 ? quantity.max : quantity.min + (i + 1) * width;
    return { id: `h${i + 1}`, statement: label(lower, upper, i), lower, upper };
  });
}
