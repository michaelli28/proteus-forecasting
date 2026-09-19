/**
 * The misspecification check's pre-registered results, as the engine's
 * `scripts/misspec-analyze.ts report` wrote them. Mirrors that JSON; nothing
 * here recomputes a number.
 */

import raw from "../data/misspec-check.json";

export interface DoseRow {
  delta: number;
  /** Questions the old refusal rule declined. */
  gate: number;
  /** Questions the check flagged at the pre-registered look. */
  alarms: number;
  n: number;
  /** Skill of the shipped forecast against a flat guess, on resolved questions. */
  skill: number;
  unresolved: number;
}

export interface BoxCell {
  delta: number;
  alarms: number;
  n: number;
}

export interface MisspecCheck {
  prereg: { primaryT0: number; channels: string[]; blindThreshold: number };
  N: number;
  dose: DoseRow[];
  blind: {
    threshold: number;
    alarms: number;
    n: number;
    identicalToDelta0: boolean;
    brier: number;
    /** The shipped forecast's skill against a flat guess when this truth holds. */
    skill: number;
    deltaBrier: number;
    unresolved: number;
  };
  histogram: Record<string, number[]>;
  /** Right-assumption questions flagged, and the rank argument's bound. */
  falseAlarms: { alarms: number; n: number; bound: number };
  byBox: Record<string, BoxCell[]>;
}

export const MISSPEC = raw as unknown as MisspecCheck;
