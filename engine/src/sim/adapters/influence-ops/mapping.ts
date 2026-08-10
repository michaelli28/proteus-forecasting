/**
 * RunSpec → InfluenceOpsConfig.
 *
 * The domain adapter's interpretation of the two adversary knobs. Kept in one
 * documented place so "what does riskTolerance=70 actually mean" has an answer
 * a reviewer can check, rather than being buried in a prompt.
 *
 *   riskTolerance        → how much exposure the actor accepts: reach of the
 *                          campaign, and how extreme a position it pushes.
 *   escalationPropensity → how hard and how early it pushes: amplification,
 *                          coordination, and campaign timing.
 *
 * Ranges were chosen from the measured parameter sweep so the ensemble spans
 * outcomes from barely-detectable to substantial without saturating.
 */

import { DEFAULT_CONFIG } from "./config.js";
import type { CampaignConfig, InfluenceOpsConfig } from "./config.js";

export interface RunParameters {
  readonly riskTolerance: number;
  readonly escalationPropensity: number;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, t));
}

/** Documented bounds of the mapping, exported so tests assert against them. */
export const MAPPING_BOUNDS = {
  injectionNodes: [20, 160],
  targetPosition: [0.6, 1.0],
  amplification: [0.5, 8],
  startTick: [40, 10],
  coordinationThreshold: 50,
} as const;

export function campaignFromRunSpec(
  parameters: RunParameters,
  ticks: number,
  narrativeId = 0,
): CampaignConfig {
  const risk = parameters.riskTolerance / 100;
  const escalation = parameters.escalationPropensity / 100;

  const [nodeMin, nodeMax] = MAPPING_BOUNDS.injectionNodes;
  const [posMin, posMax] = MAPPING_BOUNDS.targetPosition;
  const [ampMin, ampMax] = MAPPING_BOUNDS.amplification;
  const [startLate, startEarly] = MAPPING_BOUNDS.startTick;

  const endTick = Math.max(1, ticks - 10);

  return {
    narrativeId,
    // A more escalation-prone actor moves sooner. Clamped below endTick: the
    // bounds above were measured on the 120-tick reference world, where they
    // always fit, and on a shorter world an unclamped start would sit past the
    // campaign's own end and fail validation instead of just running briefly.
    startTick: Math.min(
      Math.round(lerp(startLate, startEarly, escalation)),
      Math.max(0, endTick - 1),
    ),
    endTick,
    injectionNodes: Math.round(lerp(nodeMin, nodeMax, risk)),
    targetPosition: lerp(posMin, posMax, risk),
    injectionRate: 0.3,
    amplification: lerp(ampMin, ampMax, escalation),
    coordinated:
      parameters.escalationPropensity >= MAPPING_BOUNDS.coordinationThreshold,
  };
}

/**
 * Full config for one ensemble member.
 *
 * The adversary cannot field more assets than the world contains, so the node
 * count is fitted to the population here — this is the only place that knows
 * how big the population is. On the reference world every clamp is a no-op, so
 * the measured parameter sweep still describes it exactly.
 */
export function configFromRunSpec(
  parameters: RunParameters,
  base: InfluenceOpsConfig = DEFAULT_CONFIG,
): InfluenceOpsConfig {
  const campaign = campaignFromRunSpec(parameters, base.ticks);
  return {
    ...base,
    campaign: {
      ...campaign,
      injectionNodes: Math.min(campaign.injectionNodes, base.population.agents),
    },
    defense: base.defense,
  };
}
