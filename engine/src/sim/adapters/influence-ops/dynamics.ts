/**
 * Belief dynamics: bounded-confidence peer influence plus media, with the
 * adversary campaign and the defensive intervention applied as treatments.
 *
 * Bounded confidence (Hegselmann-Krause / Deffuant family) is chosen because it
 * produces polarization endogenously — clusters form because agents stop
 * listening to people too far from them, not because the model was told to
 * polarize. A model that assumes its own conclusion cannot test an intervention.
 */

import type { Rng } from "../../rng.js";
import { ADOPTION_THRESHOLD, BELIEF_MAX, BELIEF_MIN } from "./config.js";
import type { InfluenceOpsConfig } from "./config.js";
import { clamp01 } from "./network.js";
import type { Population } from "./network.js";

/** Minimum belief movement counted as an observable transmission. */
const TRANSMISSION_EPSILON = 1e-4;

export interface TickOutcome {
  /** Peer interactions that actually moved a belief — platform-visible activity. */
  readonly transmissions: number;
  /** Agents crossing the adoption threshold upward this tick. */
  readonly adoptions: number;
  /** Agents crossing back down. */
  readonly abandonments: number;
  /** Agents whose belief moved this tick — the platform-visible active set. */
  readonly activeNodes: readonly number[];
  /** Injection events applied this tick. Ground truth, never observable. */
  readonly injections: number;
  /** Defensive budget spent this tick. */
  readonly defenseCost: number;
}

function campaignActive(config: InfluenceOpsConfig, tick: number): boolean {
  const c = config.campaign;
  return c !== null && tick >= c.startTick && tick <= c.endTick;
}

function defenseActive(config: InfluenceOpsConfig, tick: number): boolean {
  const d = config.defense;
  return d !== null && d.kind !== "none" && tick >= d.startTick;
}

/**
 * Advance every belief one tick.
 *
 * Updates are simultaneous — new beliefs are computed from the old snapshot and
 * written afterwards. Updating in place would let an agent processed early
 * influence one processed later within the same tick, making the result depend
 * on agent id ordering.
 */
export function stepBeliefs(
  population: Population,
  config: InfluenceOpsConfig,
  tick: number,
  rng: Rng,
  injectionNodes: ReadonlySet<number>,
  coveredByDefense: ReadonlySet<number>,
): TickOutcome {
  const { agents, neighbors, media } = population;
  const narrativeCount = config.narratives;
  const campaign = config.campaign;
  const defense = config.defense;

  const previous = agents.map((a) => [...a.belief]);
  const next = previous.map((b) => [...b]);

  let transmissions = 0;
  let injections = 0;

  const isCampaignActive = campaignActive(config, tick);
  const isDefenseActive = defenseActive(config, tick);
  const frictionActive = isDefenseActive && defense!.kind === "friction";
  const counterActive =
    isDefenseActive && defense!.kind === "counter_messaging";
  const platformActive =
    isDefenseActive && defense!.kind === "platform_intervention";

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]!;
    const mine = previous[i]!;

    const covered = coveredByDefense.has(i);
    const rate =
      frictionActive && covered
        ? config.influenceRate * (1 - defense!.intensity)
        : config.influenceRate;

    for (let n = 0; n < narrativeCount; n++) {
      let delta = 0;

      const targetedNarrative = campaign !== null && n === campaign.narrativeId;

      // ── Peer influence, gated by bounded confidence ──
      // Amplified assets carry extra weight in the average — algorithmic boost
      // makes their content land harder, but it cannot buy them past a
      // neighbour's confidence bound. Content too far from you is still ignored.
      let engaged = 0;
      let pull = 0;
      let weight = 0;
      for (const j of neighbors[i]!) {
        const theirs = previous[j]![n]!;
        if (Math.abs(theirs - mine[n]!) < agent.epsilon) {
          // Only assets the platform actually reached lose their boost. Gating
          // on platformActive alone lets a 5%-coverage takedown silently
          // neutralise the whole campaign.
          const boosted =
            isCampaignActive &&
            targetedNarrative &&
            injectionNodes.has(j) &&
            !(platformActive && coveredByDefense.has(j));
          const w = boosted ? 1 + campaign!.amplification : 1;
          pull += w * (theirs - mine[n]!);
          weight += w;
          engaged++;
        }
      }
      if (engaged > 0 && weight > 0) {
        const move = rate * agent.susceptibility * (pull / weight);
        delta += move;
        if (Math.abs(move) > TRANSMISSION_EPSILON) transmissions += engaged;
      }

      // ── Media diet ──
      for (let m = 0; m < media.length; m++) {
        const trust = agent.mediaTrust[m] ?? 0;
        delta +=
          config.media.weight * trust * (media[m]!.position[n]! - mine[n]!);
      }

      // ── Adversary injection ──
      // Assets converge on the campaign's target position and hold it. They are
      // sock puppets, so susceptibility does not apply — they are not persuaded,
      // they are operated.
      const targeted = targetedNarrative;
      const suppressed = platformActive && covered;
      if (
        isCampaignActive &&
        targeted &&
        injectionNodes.has(i) &&
        !suppressed
      ) {
        const jitter = campaign!.coordinated ? 1 : rng.uniform(0.3, 1.7);
        delta +=
          campaign!.injectionRate *
          (campaign!.targetPosition - mine[n]!) *
          jitter;
        injections++;
      }

      // ── Counter-messaging ──
      if (counterActive && targeted && covered) {
        delta +=
          defense!.intensity *
          agent.susceptibility *
          (BELIEF_MIN - mine[n]!) *
          0.5;
      }

      next[i]![n] = clamp01(mine[n]! + delta);
    }
  }

  let adoptions = 0;
  let abandonments = 0;
  const activeNodes: number[] = [];
  const targetNarrative = campaign?.narrativeId ?? 0;
  for (let i = 0; i < agents.length; i++) {
    const before = previous[i]![targetNarrative]!;
    const after = next[i]![targetNarrative]!;
    if (before < ADOPTION_THRESHOLD && after >= ADOPTION_THRESHOLD) adoptions++;
    if (before >= ADOPTION_THRESHOLD && after < ADOPTION_THRESHOLD)
      abandonments++;

    let moved = false;
    for (let n = 0; n < narrativeCount && !moved; n++) {
      if (Math.abs(next[i]![n]! - previous[i]![n]!) > TRANSMISSION_EPSILON)
        moved = true;
    }
    if (moved) activeNodes.push(i);

    agents[i]!.belief = next[i]!;
  }

  const defenseCost = isDefenseActive ? defense!.costPerTick : 0;

  return {
    transmissions,
    adoptions,
    abandonments,
    activeNodes,
    injections,
    defenseCost,
  };
}

/** Injection seed nodes. Coordinated campaigns concentrate on high-degree hubs. */
export function selectInjectionNodes(
  population: Population,
  config: InfluenceOpsConfig,
  rng: Rng,
): Set<number> {
  const campaign = config.campaign;
  if (!campaign || campaign.injectionNodes <= 0) return new Set();

  const ids = population.agents.map((a) => a.id);
  if (campaign.coordinated) {
    // Hub targeting is more effective and leaves a sharper degree signature —
    // the trade-off the detection half of the simulation is built to find.
    const byDegree = [...ids].sort(
      (a, b) =>
        population.neighbors[b]!.length - population.neighbors[a]!.length ||
        a - b,
    );
    return new Set(byDegree.slice(0, campaign.injectionNodes));
  }
  return new Set(rng.sample(ids, campaign.injectionNodes));
}

/** Agents reached by the defensive intervention. */
export function selectDefenseCoverage(
  population: Population,
  config: InfluenceOpsConfig,
  rng: Rng,
): Set<number> {
  const defense = config.defense;
  if (!defense || defense.kind === "none" || defense.coverage <= 0)
    return new Set();
  const count = Math.round(defense.coverage * population.agents.length);
  return new Set(
    rng.sample(
      population.agents.map((a) => a.id),
      count,
    ),
  );
}
