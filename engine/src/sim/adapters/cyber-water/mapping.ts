/**
 * RunSpec → CyberWaterConfig.
 *
 * The domain adapter's interpretation of the two adversary knobs, kept in one
 * documented place so "what does riskTolerance=70 actually mean here" has an
 * answer a reviewer can check rather than one buried in a prompt.
 *
 *   riskTolerance        → how much attribution exposure the actor accepts:
 *                          inversely its risk sensitivity, and how much access
 *                          it is assumed to be sitting on already.
 *   escalationPropensity → how hard and how early it pushes: how fast the
 *                          political payoff drifts up, how aggressively it
 *                          acquires further access, and how soon it will
 *                          consider spending any of it.
 *
 * Ranges are pre-registered here rather than fitted to a scored run. Deriving
 * them from the runs being scored would be fitting the question to its answer.
 */

import { DEFAULT_CONFIG, DEFAULT_ADVERSARY } from "./config.js";
import type { CyberWaterConfig } from "./config.js";

export interface RunParameters {
  readonly riskTolerance: number;
  readonly escalationPropensity: number;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, t));
}

/**
 * Documented bounds of the mapping, exported so tests assert against them.
 *
 * escalationPropensity drives payoffBase — the appetite to act NOW — rather than
 * the payoff DRIFT. That is deliberate and was a corrected mistake: the spend
 * rule is optimal stopping against a rising payoff, so mapping escalation to a
 * steeper drift makes the actor MORE patient (wait for the peak), which is
 * backwards. A high current appetite is what makes an escalation-prone actor
 * spend early. The drift is small and fixed so it never dominates the appetite.
 */
export const MAPPING_BOUNDS = {
  /** Inverted: a risk-tolerant actor is a risk-INsensitive one. */
  riskSensitivity: [0.85, 0.15],
  initialAccessMean: [0.8, 4.5],
  acquisitionHazard: [0.004, 0.03],
  payoffBase: [0.15, 0.7],
  earliestActivationTick: [45, 5],
} as const;

/** Fixed, small: rising tension is real but must not swamp current appetite. */
export const FIXED_PAYOFF_DRIFT = 0.002;

/**
 * Adversary parameters for one ensemble member.
 *
 * `base` is threaded through so a test can drive a small world without this
 * function knowing anything about test worlds.
 */
export function adversaryFromRunSpec(
  parameters: RunParameters,
  base = DEFAULT_ADVERSARY,
): CyberWaterConfig["adversary"] {
  const risk = parameters.riskTolerance / 100;
  const escalation = parameters.escalationPropensity / 100;

  const [sensHigh, sensLow] = MAPPING_BOUNDS.riskSensitivity;
  const [accessMin, accessMax] = MAPPING_BOUNDS.initialAccessMean;
  const [hazardMin, hazardMax] = MAPPING_BOUNDS.acquisitionHazard;
  const [payoffMin, payoffMax] = MAPPING_BOUNDS.payoffBase;
  const [earliestLate, earliestEarly] = MAPPING_BOUNDS.earliestActivationTick;

  return {
    ...base,
    riskSensitivity: lerp(sensHigh, sensLow, risk),
    initialAccessMean: lerp(accessMin, accessMax, risk),
    acquisitionHazard: lerp(hazardMin, hazardMax, escalation),
    payoffBase: lerp(payoffMin, payoffMax, escalation),
    payoffDrift: FIXED_PAYOFF_DRIFT,
    earliestActivationTick: Math.round(
      lerp(earliestLate, earliestEarly, escalation),
    ),
  };
}

export interface ConfigInputs {
  readonly register: CyberWaterConfig["register"];
  readonly servedPopulation: number;
  readonly consequence: CyberWaterConfig["consequence"];
  readonly ticks?: number;
  readonly archetypeId?: string;
  readonly defense?: CyberWaterConfig["defense"];
  readonly backgroundAnomalyRate?: number;
}

/**
 * Full config for one ensemble member.
 *
 * The adversary cannot hold more components than the register contains, so the
 * access prior is clamped to it here — this is the only place that knows how
 * large the register is.
 */
export function configFromRunSpec(
  parameters: RunParameters,
  inputs: ConfigInputs,
): CyberWaterConfig {
  const adversary = adversaryFromRunSpec(parameters);
  return {
    ticks: inputs.ticks ?? DEFAULT_CONFIG.ticks,
    archetypeId: inputs.archetypeId ?? inputs.consequence.archetypeId,
    register: inputs.register,
    servedPopulation: inputs.servedPopulation,
    consequence: inputs.consequence,
    adversary: {
      ...adversary,
      initialAccessMean: Math.min(
        adversary.initialAccessMean,
        inputs.register.length,
      ),
    },
    defense: inputs.defense ?? null,
    backgroundAnomalyRate:
      inputs.backgroundAnomalyRate ?? DEFAULT_CONFIG.backgroundAnomalyRate,
  };
}
