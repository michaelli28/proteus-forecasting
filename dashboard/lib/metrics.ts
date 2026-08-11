/**
 * The dashboard's view of a PROTEUS benchmark run.
 *
 * These types mirror `engine/src/pipeline/snapshot.ts` across a package boundary
 * the two cannot share. Everything numeric is computed there, where the metrics
 * code lives — nothing in this folder recomputes a score, because a reliability
 * curve derived twice is two implementations of calibration that will disagree.
 */

import raw from "../data/benchmark-snapshot.json";

export type ArmAnswerability = "answerable" | "unanswerable" | "excluded";

export interface CalibrationPoint {
  forecast: number;
  observed: number;
  count: number;
}

export interface ScoreSnapshot {
  n: number;
  questions: number;
  brier: number;
  brierSkillVsBaseRate: number;
  ignoranceBits: number;
  expectedCalibrationError: number;
  maximumCalibrationError: number;
  reliability: number;
  resolution: number;
  uncertainty: number;
  sharpness: number;
  isHedging: boolean;
  emptiestOccupiedBin: number;
  occupiedBins: number;
}

export interface EnsembleSnapshot {
  coverageAt1: number;
  coverageAt2: number;
  tailRecall: number;
  surprises: number;
}

export interface ArmSnapshot {
  arm: string;
  answerability: ArmAnswerability;
  bands: number;
  questions: number;
  abstained: number;
  abstentionRate: number;
  unresolved: number;
  meanCompletionRatio: number;
  score: ScoreSnapshot | null;
  calibration: CalibrationPoint[];
  ensemble: EnsembleSnapshot | null;
}

export interface OperatingPoint {
  minSeparation: number;
  falseAbstentionRate: number;
  trueAbstentionRate: number;
  youdenJ: number;
  undecidable: number;
}

export interface CostSnapshot {
  llmCalls: number;
  costUsd: number;
  questionsAnswered: number;
  costPerAnswerUsd: number | null;
  modelInLoop: boolean;
}

export interface BenchmarkSnapshot {
  label: string;
  generatedAt: string;
  regime: string;
  quantity: string;
  bandCount: number;
  ensembleSize: number;
  questionsPerArm: number;
  simulationRuns: number;
  thresholds: {
    minDiagnosticEvidence: number;
    minSeparation: number;
    maxUnresolvedRate: number;
    minProvenanceCompleteness: number;
  };
  arms: ArmSnapshot[];
  operatingCurve: OperatingPoint[];
  cost: CostSnapshot;
  caveat: string;
}

export interface SnapshotFile {
  snapshots: BenchmarkSnapshot[];
}

/**
 * The one place the generated file is trusted.
 *
 * Checked rather than assumed: the producer is in another package on another
 * release cycle, and a dashboard that renders a half-understood file quietly is
 * worse than one that refuses to build.
 */
function load(): SnapshotFile {
  const file = raw as unknown as SnapshotFile;
  if (!Array.isArray(file?.snapshots) || file.snapshots.length === 0) {
    throw new Error(
      "benchmark-snapshot.json has no snapshots. Regenerate it with: " +
        "cd engine && npm run snapshot",
    );
  }
  for (const snapshot of file.snapshots) {
    if (!snapshot.caveat || !Array.isArray(snapshot.arms)) {
      throw new Error(
        `snapshot "${snapshot.label}" is missing its arms or its regime caveat`,
      );
    }
  }
  return file;
}

export const SNAPSHOTS: BenchmarkSnapshot[] = load().snapshots;

/** Newest last, so a trend reads left to right. */
export const LATEST: BenchmarkSnapshot = SNAPSHOTS[SNAPSHOTS.length - 1]!;

/**
 * Fixed hue per arm, assigned by identity and never cycled.
 *
 * Light-mode steps, chosen against this app's surface (near-white) for adequate
 * contrast and colour-blind separation. Changing one means re-checking that,
 * not picking a colour that looks nice next to the others.
 *
 * `indistinguishable` has no hue on purpose: it abstains on every question, so
 * it never becomes a plotted series and a colour would only imply otherwise.
 */
export const ARM_COLOR: Record<string, string> = {
  narrow: "#2563a8",
  medium: "#b4532a",
  "wide-control": "#2e7d57",
  tied: "#8a6d1f",
  misspecified: "#a13d68",
};

/** What each arm is for, in one PLAIN line — no gate jargon. */
export const ARM_PURPOSE: Record<string, string> = {
  narrow: "Strong evidence — the answer should be easy",
  medium: "Moderate evidence",
  "wide-control": "Weak evidence, but still answerable",
  tied: "A deliberate near-tie — a control case",
  indistinguishable: "Too fine to tell apart from noise — unanswerable",
  misspecified: "The true answer lies outside what the model considered",
};

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signed(value: number, digits = 4): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}
