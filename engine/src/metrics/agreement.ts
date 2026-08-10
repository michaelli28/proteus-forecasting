/**
 * Inter-rater agreement: Cohen's kappa and Krippendorff's alpha.
 *
 * Both correct for chance agreement, which raw percent-agreement does not. On a
 * question set where one answer dominates, two raters who always say that answer
 * agree 90% of the time and have demonstrated nothing.
 *
 * Krippendorff's alpha is the more general instrument — any number of raters,
 * tolerant of missing ratings — which matters because human analysts will not
 * all rate every item.
 */

/** One unit's ratings. `null` marks a rating that was not given. */
export type Ratings = readonly (string | number | null)[];

export interface AgreementReport {
  readonly value: number;
  readonly observedDisagreement: number;
  readonly expectedDisagreement: number;
  readonly unitsUsed: number;
}

/**
 * Cohen's kappa for exactly two raters over paired nominal ratings.
 * 1 is perfect, 0 is chance, negative is worse than chance.
 */
export function cohensKappa(
  raterA: readonly (string | number)[],
  raterB: readonly (string | number)[],
): number {
  if (raterA.length !== raterB.length)
    throw new RangeError("raters differ in length");
  if (raterA.length === 0) throw new RangeError("no items to compare");

  const n = raterA.length;
  let agreements = 0;
  const marginalA = new Map<string, number>();
  const marginalB = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const a = String(raterA[i]);
    const b = String(raterB[i]);
    if (a === b) agreements++;
    marginalA.set(a, (marginalA.get(a) ?? 0) + 1);
    marginalB.set(b, (marginalB.get(b) ?? 0) + 1);
  }

  const observed = agreements / n;
  let expected = 0;
  for (const [category, countA] of marginalA) {
    expected += (countA / n) * ((marginalB.get(category) ?? 0) / n);
  }

  // Both raters used one category exclusively and agreed: chance-corrected
  // agreement is undefined, and 1 is the only defensible reading.
  if (expected === 1) return observed === 1 ? 1 : 0;
  return (observed - expected) / (1 - expected);
}

/**
 * Krippendorff's alpha for nominal data, any number of raters.
 *
 * Built from the coincidence matrix rather than a rater-by-rater comparison,
 * which is what lets it tolerate missing ratings: units rated fewer than twice
 * contribute nothing instead of being imputed.
 */
export function krippendorffAlphaNominal(
  units: readonly Ratings[],
): AgreementReport {
  const coincidence = new Map<string, Map<string, number>>();
  const categoryTotals = new Map<string, number>();
  let totalPairs = 0;
  let unitsUsed = 0;

  const bump = (a: string, b: string, weight: number) => {
    const row = coincidence.get(a) ?? new Map<string, number>();
    row.set(b, (row.get(b) ?? 0) + weight);
    coincidence.set(a, row);
  };

  for (const unit of units) {
    const present = unit
      .filter((r): r is string | number => r !== null)
      .map(String);
    const m = present.length;
    if (m < 2) continue;
    unitsUsed++;

    for (let i = 0; i < m; i++) {
      categoryTotals.set(
        present[i]!,
        (categoryTotals.get(present[i]!) ?? 0) + 1,
      );
      totalPairs++;
      for (let j = 0; j < m; j++) {
        if (i === j) continue;
        bump(present[i]!, present[j]!, 1 / (m - 1));
      }
    }
  }

  if (unitsUsed === 0 || totalPairs < 2) {
    throw new RangeError("not enough multiply-rated units for alpha");
  }

  let observedDisagreement = 0;
  for (const [a, row] of coincidence) {
    for (const [b, count] of row) {
      if (a !== b) observedDisagreement += count;
    }
  }
  observedDisagreement /= totalPairs;

  let expectedDisagreement = 0;
  for (const [a, countA] of categoryTotals) {
    for (const [b, countB] of categoryTotals) {
      if (a !== b) expectedDisagreement += countA * countB;
    }
  }
  expectedDisagreement /= totalPairs * (totalPairs - 1);

  return {
    value:
      expectedDisagreement === 0
        ? observedDisagreement === 0
          ? 1
          : 0
        : 1 - observedDisagreement / expectedDisagreement,
    observedDisagreement,
    expectedDisagreement,
    unitsUsed,
  };
}

/** Conventional thresholds. Reported so a number is not read as a verdict. */
export const AGREEMENT_BANDS = [
  { min: 0.8, label: "reliable" },
  { min: 0.667, label: "tentative" },
  { min: 0, label: "unreliable" },
] as const;

export function agreementLabel(value: number): string {
  return (
    AGREEMENT_BANDS.find((band) => value >= band.min)?.label ?? "unreliable"
  );
}
