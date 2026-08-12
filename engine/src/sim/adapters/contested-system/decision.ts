/**
 * How an actor decides, and the record of it deciding.
 *
 * Two things happen here and they are inseparable on purpose. The first is the
 * valuation: every move an actor could make this tick is scored as a sum of
 * named terms — what it gains, what exposure costs it, what its allies think,
 * who retaliates. The second is that the scoring is RECORDED, term by term,
 * including the moves that lost and the moves a redline removed before scoring.
 *
 * That record is the product. A simulation that reports only what an adversary
 * did tells a defender almost nothing they can act on; a simulation that reports
 * what the adversary weighed, what it nearly did instead, and which term made
 * the difference tells them where to push. Every rationale string this module
 * emits is generated from the arithmetic that actually ran — it is a reading of
 * the numbers, not a narration written alongside them, so it cannot drift from
 * what the model did. Nothing here calls a language model.
 */

import type { Rng } from "../../rng.js";
import {
  channelStrength,
  isConsequential,
  isDefenseActive,
  rungSeverity,
} from "./config.js";
import type {
  ActorConfig,
  AssetRef,
  ContestedSystemConfig,
  EscalationRung,
  RespondentConfig,
} from "./config.js";
import { reportedHarm } from "./oracle.js";
import { decisionWeights, describeWeights } from "../../../actors/posture.js";
import type {
  DecisionFrame,
  DecisionWeights,
} from "../../../actors/posture.js";
import type { Redline } from "../../../actors/doctrine.js";

/** One holding: access to an asset, acquired at a tick, decaying while unspent. */
export interface Holding {
  readonly assetId: string;
  readonly acquiredTick: number;
  value: number;
}

/**
 * The value of one move, decomposed.
 *
 * Kept as separate fields rather than a single total because the decomposition
 * is the explanation. A defender who learns that retaliation cost was what held
 * an actor back knows something operationally different from one who learns the
 * move simply scored low.
 */
export interface ValueTerms {
  readonly payoff: number;
  readonly attributionCost: number;
  readonly legitimacyCost: number;
  readonly civilianHarmCost: number;
  readonly retaliationCost: number;
  readonly signalingGain: number;
  readonly total: number;
}

export interface ScoredMove {
  readonly assetId: string;
  readonly rungId: string;
  readonly terms: ValueTerms;
  /** Normalized harm this move would cause, in [0,1] of the system's total. */
  readonly normalizedHarm: number;
  /** Whether the consequence estimate is robust. False is a measurement gap. */
  readonly established: boolean;
}

/** A move an actor refused to consider, and the commitment that removed it. */
export interface BlockedMove {
  readonly assetId: string;
  readonly rungId: string;
  readonly redlineId: string;
  readonly redlineStatement: string;
}

export const DECISION_KINDS = [
  "no_holdings",
  "not_yet_active",
  "all_moves_blocked",
  "no_positive_move",
  "hold",
  "act",
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/**
 * One actor's full deliberation for one tick.
 *
 * This is what the live viewer renders and what the trace persists. It is
 * ground truth about the actor's reasoning, so it travels in the truth channel
 * and no defender-side detector may read it — the same separation that keeps
 * detection precision a measured number rather than a tautology.
 */
export interface Deliberation {
  readonly tick: number;
  readonly actorId: string;
  readonly actorLabel: string;
  readonly frame: DecisionFrame;
  /** Every scored move, best first. Truncated for transport by the caller. */
  readonly considered: readonly ScoredMove[];
  readonly blocked: readonly BlockedMove[];
  readonly best: ScoredMove | null;
  /** Value of waiting one more tick, against which `best` is compared. */
  readonly holdValue: number;
  readonly decision: DecisionKind;
  /** What executed. Null unless `decision` is "act". */
  readonly chosen: ScoredMove | null;
  /** Generated from the terms above. Never model-written. */
  readonly rationale: string;
  /** The actor's character, in the same terms as the arithmetic. */
  readonly disposition: string;
}

/**
 * Cost this move invites from third parties.
 *
 * This is the multi-actor term. An actor deciding whether to move is pricing
 * who else reacts and how hard, and an engine with no third parties silently
 * sets that to zero — which makes every actor look more aggressive than it is.
 *
 * The attribution threshold is what makes proxy action rational: a respondent
 * that cannot attribute below its threshold does not respond at all, so an actor
 * buying deniability is buying the removal of this entire term, not a discount
 * on it.
 */
export function expectedRetaliation(
  rung: EscalationRung,
  respondents: readonly RespondentConfig[],
  proxyShielding: number,
): number {
  const effectiveAttribution = rung.attributability * (1 - proxyShielding);
  let total = 0;

  for (const respondent of respondents) {
    if (effectiveAttribution < respondent.attributionThreshold) continue;

    const reciprocity = respondent.profile.doctrine.reciprocityProportion.value;
    switch (respondent.alignment) {
      case "defender_aligned":
        total += respondent.responseCapacity * reciprocity;
        break;
      case "nonaligned":
        // Reacts to norm violation as the public sees it, not to the target.
        total +=
          respondent.responseCapacity * reciprocity * rung.visibility * 0.5;
        break;
      case "adversary_aligned":
        // Does not punish; the absence of a term, not a negative one.
        break;
    }
  }
  return total;
}

/** Redline that removes this move from the choice set, if any. */
export function blockingRedline(
  redlines: readonly Redline[],
  rung: EscalationRung,
): Redline | null {
  for (const redline of redlines) {
    if (redline.effect !== "self_prohibits") continue;
    const constraint = redline.constraint;
    if (!constraint) continue;
    if (rung[constraint.attribute] > constraint.maxAcceptable) return redline;
  }
  return null;
}

export interface ValuationContext {
  readonly config: ContestedSystemConfig;
  readonly actor: ActorConfig;
  readonly weights: DecisionWeights;
  readonly payoff: number;
  readonly tick: number;
}

/**
 * Score one move.
 *
 * Signalling enters as a GAIN rather than as a reduced attribution cost, because
 * the two are different claims: an actor that wants the act seen gets value from
 * visibility even when the act is also attributable, and modelling it as a
 * discount on exposure would make a coercive signal indistinguishable from a
 * covert one that got lucky.
 */
export function scoreMove(
  context: ValuationContext,
  asset: AssetRef,
  rung: EscalationRung,
  holdingValue: number,
): ScoredMove {
  const { config, weights, payoff, tick } = context;

  const hours = effectiveDurationHours(config, rung, tick);
  const estimate = isConsequential(rung)
    ? config.oracle.lookup(asset.id, asset.effectKind, hours)
    : null;

  const harm = estimate ? reportedHarm(estimate) : 0;
  // Normalizing by system size keeps a large scenario from outranking a small
  // one for reasons that have nothing to do with how exposed either is.
  const normalizedHarm =
    harm / Math.max(1, config.oracle.servedUnits * MAX_NORMALIZING_HOURS);

  // A signalling rung buys posture, not effect, and buys it cheaply.
  const gain = isConsequential(rung)
    ? payoff * normalizedHarm
    : payoff * SIGNALLING_PAYOFF_SHARE;

  const detectionPressure = isDefenseActive(config, tick)
    ? channelStrength(config.defense, "attribution_pressure")
    : 0;

  // Reluctance is a weighted AVERAGE over what this actor cares about, not a
  // sum. Summing means an actor that weighs four concerns is automatically more
  // deterred than one that weighs a single concern equally hard, purely because
  // the model enumerated four categories — the deterrence would be an artefact
  // of the taxonomy rather than of the doctrine. Normalizing keeps the RELATIVE
  // weighting, which is where the doctrine signal actually lives, and keeps the
  // aggregate commensurate with the payoff it is subtracted from.
  const costScale =
    1 /
    Math.max(
      1,
      weights.attributionCost +
        weights.legitimacyCost +
        weights.counterpartHarmCost +
        weights.retaliationCost,
    );

  const attributionCost =
    weights.attributionCost *
    rung.attributability *
    (1 - weights.proxyShielding) *
    (0.5 + 0.5 * detectionPressure) *
    costScale;

  const legitimacyCost =
    weights.legitimacyCost * rung.legitimacyCost * costScale;
  const civilianHarmCost =
    weights.counterpartHarmCost *
    rung.civilianHarmShare *
    normalizedHarm *
    costScale;
  const retaliationCost =
    weights.retaliationCost *
    expectedRetaliation(rung, config.respondents, weights.proxyShielding) *
    RETALIATION_SCALE *
    costScale;
  const signalingGain = weights.signalingGain * rung.visibility * payoff * 0.1;

  const total =
    (gain * weights.payoffWeight +
      signalingGain -
      attributionCost -
      legitimacyCost -
      civilianHarmCost -
      retaliationCost) *
    holdingValue;

  return {
    assetId: asset.id,
    rungId: rung.id,
    normalizedHarm,
    established: estimate?.established ?? false,
    terms: {
      payoff: gain * weights.payoffWeight,
      attributionCost,
      legitimacyCost,
      civilianHarmCost,
      retaliationCost,
      signalingGain,
      total,
    },
  };
}

/** Hours the scenario's tick unit spans, used only to normalize harm. */
const MAX_NORMALIZING_HOURS = 24;
/** What a purely signalling rung is worth relative to a consequential one. */
const SIGNALLING_PAYOFF_SHARE = 0.02;
/** Puts respondent capacity on the same scale as normalized harm. */
const RETALIATION_SCALE = 0.01;

/** Duration after any consequence-limiting mitigation has acted. */
export function effectiveDurationHours(
  config: ContestedSystemConfig,
  rung: EscalationRung,
  tick: number,
): number {
  if (rung.durationHours <= 0) return 0;
  if (!isDefenseActive(config, tick)) return rung.durationHours;
  const relief = channelStrength(config.defense, "consequence_limiting");
  return rung.durationHours * (1 - relief);
}

/**
 * Quantal-response selection.
 *
 * A hard argmax collapses an ensemble onto one asset and makes any chokepoint
 * ranking degenerate — the model would report the mode of a distribution as if
 * it were the whole distribution. Real actors are boundedly rational: usually a
 * strong move, occasionally a weaker one, and it is that spread a defender needs
 * because it is where the actual exposure is. The temperature comes from the
 * actor's doctrine and decision structure, so it must not be raised to sharpen
 * the output.
 */
export function selectMove(
  moves: readonly ScoredMove[],
  rationality: number,
  rng: Rng,
): ScoredMove | null {
  if (moves.length === 0) return null;
  // Subtract the max before exponentiating so a large value cannot overflow to
  // Infinity and turn the whole distribution into a single NaN.
  const max = Math.max(...moves.map((m) => m.terms.total));
  const weights = moves.map((m) =>
    Math.exp(rationality * (m.terms.total - max)),
  );
  return moves[rng.weightedIndex(weights)] ?? null;
}

/**
 * Turn the arithmetic into a sentence.
 *
 * Reads the terms that actually ran, so it cannot claim a reason the model did
 * not use. The dominant cost is found by magnitude rather than asserted, which
 * is why a run occasionally explains itself in a way its author did not expect —
 * that is the model disagreeing with its author, and it is worth seeing.
 */
export function explainDecision(
  decision: DecisionKind,
  best: ScoredMove | null,
  holdValue: number,
  blocked: readonly BlockedMove[],
  ladder: readonly EscalationRung[],
): string {
  switch (decision) {
    case "no_holdings":
      return "holds no access to anything in this system, so has nothing to spend";
    case "not_yet_active":
      return "is not yet willing to act this early in the window";
    case "all_moves_blocked": {
      const first = blocked[0];
      return first
        ? `every available move crosses its own commitment — ${first.redlineStatement}`
        : "every available move was ruled out by its own commitments";
    }
    case "no_positive_move":
      return "sees nothing worth doing: every move costs it more than it gains";
    case "hold": {
      if (!best) return "waits";
      const margin = holdValue - best.terms.total;
      return `waits — the same move is worth ${formatDelta(margin)} more later, and nothing forces its hand now`;
    }
    case "act": {
      if (!best) return "acts";
      const rung = ladder.find((r) => r.id === best.rungId);
      const dominant = dominantCost(best.terms);
      const priced = dominant
        ? `, having priced in ${dominant}`
        : ", facing almost no countervailing cost";
      return `spends its access on ${best.assetId} at "${rung?.statement ?? best.rungId}"${priced}`;
    }
  }
}

function dominantCost(terms: ValueTerms): string | null {
  const costs: { label: string; magnitude: number }[] = [
    { label: "the risk of being identified", magnitude: terms.attributionCost },
    { label: "the legal and alliance cost", magnitude: terms.legitimacyCost },
    { label: "the harm to civilians", magnitude: terms.civilianHarmCost },
    { label: "the retaliation it invites", magnitude: terms.retaliationCost },
  ];
  const top = costs.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
  return top.magnitude > Math.abs(terms.total) * 0.1 ? top.label : null;
}

function formatDelta(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude < 0.001) return "a negligible amount";
  return magnitude.toFixed(4);
}

/**
 * Build the deliberation record for one actor at one tick.
 *
 * Scoring every move rather than only the chosen one is the expensive choice and
 * the correct one: the rejected moves are what a defender can change. An actor
 * that came within a hair of hitting a different asset is telling the defender
 * where their next dollar goes.
 */
export interface DeliberateInput {
  readonly config: ContestedSystemConfig;
  readonly actor: ActorConfig;
  readonly holdings: readonly Holding[];
  /** Assets consumed by a consequential act. Gone for good. */
  readonly spentAssetIds: ReadonlySet<string>;
  /**
   * `assetId|rungId` pairs already used for a signalling act.
   *
   * Signalling and spending consume different things, and conflating them was a
   * real defect: treating "presence made evident" as spending the access made a
   * signalling-preferring actor burn its entire inventory on zero-harm moves
   * and arrive at the moment escalation finally paid with nothing left to
   * escalate with. Revealing presence costs exposure, not access.
   */
  readonly signalledPairs: ReadonlySet<string>;
  readonly frame: DecisionFrame;
  readonly tick: number;
  readonly rng: Rng;
}

/** Key for a signalling act already performed. */
export function signalKey(assetId: string, rungId: string): string {
  return `${assetId}|${rungId}`;
}

export function deliberate(input: DeliberateInput): Deliberation {
  const {
    config,
    actor,
    holdings,
    spentAssetIds,
    signalledPairs,
    frame,
    tick,
    rng,
  } = input;
  const profile = actor.profile;
  const weights = decisionWeights(profile, frame);
  const disposition = describeWeights(weights);

  const base = {
    tick,
    actorId: profile.id,
    actorLabel: profile.label,
    frame,
    disposition,
  };

  const spendable = holdings.filter((h) => !spentAssetIds.has(h.assetId));
  if (spendable.length === 0) {
    return {
      ...base,
      considered: [],
      blocked: [],
      best: null,
      holdValue: 0,
      decision: "no_holdings",
      chosen: null,
      rationale: explainDecision("no_holdings", null, 0, [], config.ladder),
    };
  }

  if (tick < actor.earliestActivationTick) {
    return {
      ...base,
      considered: [],
      blocked: [],
      best: null,
      holdValue: 0,
      decision: "not_yet_active",
      chosen: null,
      rationale: explainDecision("not_yet_active", null, 0, [], config.ladder),
    };
  }

  const payoff = actor.payoffBase + actor.payoffDrift * tick;
  const context: ValuationContext = { config, actor, weights, payoff, tick };
  const assetsById = new Map(config.register.map((a) => [a.id, a]));
  const reachable = new Set(actor.reachableRungs);

  const considered: ScoredMove[] = [];
  const blocked: BlockedMove[] = [];

  for (const holding of spendable) {
    const asset = assetsById.get(holding.assetId);
    if (!asset) continue;
    for (const rung of config.ladder) {
      if (rung.id === "none" || !reachable.has(rung.id)) continue;
      // A signal already sent from this asset says nothing new by being repeated.
      if (
        !isConsequential(rung) &&
        signalledPairs.has(signalKey(asset.id, rung.id))
      ) {
        continue;
      }

      const redline = blockingRedline(profile.redlines, rung);
      if (redline) {
        blocked.push({
          assetId: asset.id,
          rungId: rung.id,
          redlineId: redline.id,
          redlineStatement: redline.statement,
        });
        continue;
      }
      considered.push(scoreMove(context, asset, rung, holding.value));
    }
  }

  considered.sort((a, b) => b.terms.total - a.terms.total);
  const best = considered[0] ?? null;

  if (!best) {
    const decision: DecisionKind =
      blocked.length > 0 ? "all_moves_blocked" : "no_holdings";
    return {
      ...base,
      considered,
      blocked,
      best: null,
      holdValue: 0,
      decision,
      chosen: null,
      rationale: explainDecision(decision, null, 0, blocked, config.ladder),
    };
  }

  if (best.terms.total <= 0) {
    return {
      ...base,
      considered,
      blocked,
      best,
      holdValue: 0,
      decision: "no_positive_move",
      chosen: null,
      rationale: explainDecision(
        "no_positive_move",
        best,
        0,
        blocked,
        config.ladder,
      ),
    };
  }

  // The timing decision is made on the BEST move's option value: waiting is only
  // worth it if the best thing available would itself be worth more later. The
  // payoff drifts up, but the holding may be lost or decay before it can be spent.
  const holdValue = optionValue(context, best, weights);

  if (holdValue > best.terms.total) {
    return {
      ...base,
      considered,
      blocked,
      best,
      holdValue,
      decision: "hold",
      chosen: null,
      rationale: explainDecision(
        "hold",
        best,
        holdValue,
        blocked,
        config.ladder,
      ),
    };
  }

  // WHICH move executes, given it decided to act, is quantal-response over the
  // positive-value moves — boundedly rational, not argmax.
  const actable = considered.filter((m) => m.terms.total > 0);
  const chosen = selectMove(actable, weights.rationality, rng) ?? best;

  return {
    ...base,
    considered,
    blocked,
    best,
    holdValue,
    decision: "act",
    chosen,
    rationale: explainDecision(
      "act",
      chosen,
      holdValue,
      blocked,
      config.ladder,
    ),
  };
}

/** Value of the same move one tick later, after drift, decay, and attrition. */
function optionValue(
  context: ValuationContext,
  best: ScoredMove,
  weights: DecisionWeights,
): number {
  const { config, actor, payoff, tick } = context;
  const attrition = isDefenseActive(config, tick)
    ? channelStrength(config.defense, "holding_attrition")
    : 0;
  const survival = 1 - attrition * HOLDING_ATTRITION_BASE;
  const nextPayoff = payoff + actor.payoffDrift;

  return (
    best.terms.total *
    (nextPayoff / Math.max(1e-9, payoff)) *
    survival *
    (1 - actor.holdingValueDecay) *
    (1 - weights.holdDiscount)
  );
}

/** Per-tick probability a covered holding is lost at full mitigation strength. */
export const HOLDING_ATTRITION_BASE = 0.06;

/** Ordinal severity of what executed, for the ordered-categorical measure. */
export function chosenSeverity(
  deliberation: Deliberation,
  ladder: readonly EscalationRung[],
): number {
  if (!deliberation.chosen) return 0;
  return rungSeverity(ladder, deliberation.chosen.rungId);
}
