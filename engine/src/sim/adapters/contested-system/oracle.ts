/**
 * The consequence oracle — what an effect on an asset actually costs.
 *
 * Cyber-water answered this with EPANET: a real hydraulic solver, run thousands
 * of times, producing person-hours below pressure. That is the strongest version
 * of this stage and it does not generalize for free, because most domains have
 * no equivalent solver sitting on a shelf. The temptation is to paper over that
 * with a plausible-looking formula and present the output in the same table as
 * the solved numbers.
 *
 * This module exists to make that impossible. Every estimate carries the class
 * of evidence that produced it, the class travels with the number into the
 * ranking and out to the product, and a run that mixes classes says so. A
 * defender reading "this asset is your worst chokepoint" is entitled to know
 * whether that came from a physics solver, from their own data, or from a
 * structured guess — those are three different claims and only one of them is
 * reproducible from a seed.
 *
 * `lookup` is synchronous by contract. The kernel's `step` is synchronous and
 * seeded; a solver call inside a tick would break both properties, so solved
 * oracles pre-compute a table and read from it, exactly as cyber-water does.
 */

/**
 * How much the number is worth.
 *
 * Ordered weakest to strongest deliberately — code that compares classes to find
 * the floor of a mixed run reads in the natural direction.
 */
export const CONSEQUENCE_EVIDENCE_CLASSES = [
  /**
   * An analytic stand-in derived from declared asset properties. A structured
   * guess: reproducible, internally consistent, and NOT evidence about the world.
   */
  "parametric",
  /** Values the evaluator supplied from their own data. As good as their data. */
  "supplied",
  /**
   * A domain solver ran and its output was recorded. Reproducible and
   * verifiable. Still not VALIDATED — see the note in `describeOracle`.
   */
  "solved",
] as const;
export type ConsequenceEvidenceClass =
  (typeof CONSEQUENCE_EVIDENCE_CLASSES)[number];

/**
 * One priced effect.
 *
 * The low/high pair is not decoration. Cyber-water learned that a single
 * headline number hides whether the result survived the solver's own sensitivity
 * sweep, and a chokepoint that only exists at the pessimistic assumption is a
 * different finding from one that holds throughout. `established` is the flag
 * that distinguishes them, and the ranking layer reports it rather than
 * flattening it away.
 */
export interface ConsequenceEstimate {
  /** Lowest attributable harm across the oracle's sensitivity range. */
  readonly harmLow: number;
  readonly harmHigh: number;
  /** Peak simultaneous units affected — a different question from total harm. */
  readonly peakUnitsAffected: number;
  /** True when the estimate is robust across the sensitivity range. */
  readonly established: boolean;
  /** False when the underlying solve did not converge. Not the same as zero harm. */
  readonly converged: boolean;
  readonly evidenceClass: ConsequenceEvidenceClass;
}

export interface ConsequenceOracle {
  readonly id: string;
  /** The solver or method, recorded in every product. */
  readonly method: string;
  readonly evidenceClass: ConsequenceEvidenceClass;
  /** What harm is measured in, e.g. "person-hours below service threshold". */
  readonly harmUnit: string;
  /** Total units the modelled system serves, for cross-scenario normalization. */
  readonly servedUnits: number;
  /**
   * Price one effect. Must be synchronous, deterministic, and total — an
   * unknown combination throws rather than returning zero, because a silent
   * zero is indistinguishable from a genuinely harmless asset and would show up
   * in a ranking as "safe".
   */
  lookup(
    assetId: string,
    effectKind: string,
    durationHours: number,
  ): ConsequenceEstimate;
}

export class OracleError extends Error {}

/** Reported harm floors at the low end: the defensible number, not the scary one. */
export function reportedHarm(estimate: ConsequenceEstimate): number {
  return Math.max(0, estimate.harmLow);
}

/**
 * The weakest evidence class present.
 *
 * A run whose oracle is solved but whose scenario supplied one parametric asset
 * is a parametric run for reporting purposes. Taking the floor rather than the
 * mode is the conservative reading and the only one that cannot mislead.
 */
export function weakestClass(
  classes: readonly ConsequenceEvidenceClass[],
): ConsequenceEvidenceClass {
  let weakest: ConsequenceEvidenceClass = "solved";
  for (const candidate of classes) {
    if (
      CONSEQUENCE_EVIDENCE_CLASSES.indexOf(candidate) <
      CONSEQUENCE_EVIDENCE_CLASSES.indexOf(weakest)
    ) {
      weakest = candidate;
    }
  }
  return weakest;
}

/** The sentence that must appear beside any ranking this oracle produced. */
export function describeOracle(oracle: ConsequenceOracle): string {
  switch (oracle.evidenceClass) {
    case "solved":
      return `Consequences solved by ${oracle.method}. VERIFIABLE, not VALIDATED: the solver is both the predictor and the answer key here, so measured skill on this stage is 1.0 by construction. Ranking order is a claim about the model, not about any real system.`;
    case "supplied":
      return `Consequences supplied by the evaluator (${oracle.method}). The ranking inherits the accuracy of that data and asserts nothing beyond it.`;
    case "parametric":
      return `Consequences estimated by ${oracle.method}, an analytic stand-in with no domain solver behind it. These are STRUCTURED GUESSES: internally consistent and reproducible from the seed, but not evidence about the world. Use the ranking to decide where to look, never as a magnitude to plan against.`;
  }
}

// ─── table-backed ───

export interface ConsequenceTableCell {
  readonly harmLow: number;
  readonly harmHigh: number;
  readonly peakUnitsAffected: number;
  readonly established: boolean;
  readonly converged: boolean;
}

export interface ConsequenceTableData {
  readonly id: string;
  readonly method: string;
  readonly harmUnit: string;
  readonly servedUnits: number;
  /** Durations the table was solved at, ascending. */
  readonly durationsHours: readonly number[];
  /** Keyed `assetId|effectKind|duration`. */
  readonly cells: Readonly<Record<string, ConsequenceTableCell>>;
  readonly evidenceClass?: ConsequenceEvidenceClass;
}

export function cellKey(
  assetId: string,
  effectKind: string,
  durationHours: number,
): string {
  return `${assetId}|${effectKind}|${formatDuration(durationHours)}`;
}

/** Matches the `%g`-style formatting the Python bridge uses for its keys. */
function formatDuration(hours: number): string {
  return Number(hours.toPrecision(6)).toString();
}

/**
 * Round a requested duration DOWN onto the solved grid.
 *
 * Down, never nearest: rounding up would credit the actor with more effect than
 * the solver established, and a ranking that flatters the attack is the one
 * failure mode a defender cannot detect from the output.
 */
export function snapDuration(
  durationsHours: readonly number[],
  requested: number,
): number {
  const ascending = [...durationsHours].sort((a, b) => a - b);
  let snapped = ascending[0] ?? 0;
  for (const candidate of ascending) {
    if (candidate <= requested) snapped = candidate;
  }
  return requested < snapped ? (ascending[0] ?? 0) : snapped;
}

/**
 * An oracle reading a pre-solved table.
 *
 * This is the path a real domain solver plugs into: run the solver offline,
 * emit this shape, and the kernel gets reproducible consequences without ever
 * calling out mid-tick.
 */
export function createTableOracle(
  data: ConsequenceTableData,
): ConsequenceOracle {
  const evidenceClass = data.evidenceClass ?? "solved";
  return {
    id: data.id,
    method: data.method,
    evidenceClass,
    harmUnit: data.harmUnit,
    servedUnits: data.servedUnits,
    lookup(assetId, effectKind, durationHours) {
      if (durationHours <= 0) return ZERO_ESTIMATE(evidenceClass);
      const snapped = snapDuration(data.durationsHours, durationHours);
      const key = cellKey(assetId, effectKind, snapped);
      const cell = data.cells[key];
      if (!cell) {
        throw new OracleError(
          `no solved cell for ${key} — an absent cell and a zero-harm cell are different findings, so this throws rather than reporting the asset as safe`,
        );
      }
      return { ...cell, evidenceClass };
    },
  };
}

// ─── parametric ───

/**
 * Declared properties an analytic estimate can be built from.
 *
 * Every field is something an evaluator can state about an asset without a
 * solver, and nothing here is a measurement. That is the point and also the
 * limitation, which `describeOracle` says out loud.
 */
export interface ParametricAsset {
  readonly assetId: string;
  readonly effectKind: string;
  /** Units losing service when this asset is affected. */
  readonly unitsDependent: number;
  /**
   * Share of dependent units that lose service immediately, in [0,1]. Assets
   * with buffers, reserves, or slack degrade rather than fail.
   */
  readonly immediateLossShare: number;
  /** Hours of buffer before loss begins. Reserves, stockpiles, backup capacity. */
  readonly bufferHours: number;
  /** Hours of degraded service after the effect ends. Recovery is not instant. */
  readonly recoveryTailHours: number;
  /**
   * Redundancy in [0,1]: share of load another asset can absorb. 1 means the
   * asset does not matter, which is a claim worth stating explicitly.
   */
  readonly redundancy: number;
}

export interface ParametricOracleOptions {
  readonly id: string;
  readonly harmUnit: string;
  readonly servedUnits: number;
  readonly assets: readonly ParametricAsset[];
  /**
   * Fractional uncertainty applied symmetrically to produce the low/high band.
   * Defaults wide, because a parametric estimate that reports a narrow band is
   * claiming a precision its method does not have.
   */
  readonly uncertainty?: number;
}

const DEFAULT_PARAMETRIC_UNCERTAINTY = 0.5;

/**
 * A transparent analytic stand-in for domains with no solver.
 *
 * The formula is deliberately simple enough to state in one line of prose — harm
 * is dependent units times the share that actually lose service, integrated over
 * the effective hours after buffers and including the recovery tail — so a
 * reader can disagree with it specifically rather than distrusting it vaguely. A
 * more elaborate formula would not be more accurate, it would only be harder to
 * argue with, and `established` is false on every cell precisely because no
 * sensitivity analysis stands behind any of it.
 */
export function createParametricOracle(
  options: ParametricOracleOptions,
): ConsequenceOracle {
  const uncertainty = options.uncertainty ?? DEFAULT_PARAMETRIC_UNCERTAINTY;
  const byKey = new Map(
    options.assets.map((asset) => [
      `${asset.assetId}|${asset.effectKind}`,
      asset,
    ]),
  );

  return {
    id: options.id,
    method: "declared-dependency parametric model",
    evidenceClass: "parametric",
    harmUnit: options.harmUnit,
    servedUnits: options.servedUnits,
    lookup(assetId, effectKind, durationHours) {
      if (durationHours <= 0) return ZERO_ESTIMATE("parametric");
      const asset = byKey.get(`${assetId}|${effectKind}`);
      if (!asset) {
        throw new OracleError(
          `no parametric properties declared for ${assetId}|${effectKind} — declare it or remove the asset; a missing asset must not price as harmless`,
        );
      }

      const effectiveHours =
        Math.max(0, durationHours - asset.bufferHours) +
        asset.recoveryTailHours;
      const affected =
        asset.unitsDependent *
        asset.immediateLossShare *
        (1 - asset.redundancy);
      const central = affected * effectiveHours;

      return {
        harmLow: Math.max(0, central * (1 - uncertainty)),
        harmHigh: central * (1 + uncertainty),
        peakUnitsAffected: effectiveHours > 0 ? affected : 0,
        // Never established: no sensitivity analysis stands behind a formula.
        established: false,
        converged: true,
        evidenceClass: "parametric",
      };
    },
  };
}

function ZERO_ESTIMATE(
  evidenceClass: ConsequenceEvidenceClass,
): ConsequenceEstimate {
  return {
    harmLow: 0,
    harmHigh: 0,
    peakUnitsAffected: 0,
    established: false,
    converged: true,
    evidenceClass,
  };
}
