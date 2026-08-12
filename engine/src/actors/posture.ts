/**
 * Doctrine → decision weights.
 *
 * This module is the join between what an actor IS and what an actor DOES, and
 * it is deliberately the only place that translation happens. Scattering it
 * across the adapters would let two domains disagree about what
 * `attributionAversion` means, and the first symptom would be a ranking that
 * changes when you switch scenarios for reasons nobody can locate.
 *
 * Every weight below is a linear function of one or two doctrine parameters. The
 * linearity is a choice, not laziness: an evaluator has to be able to answer
 * "why did this actor do that" by reading a number off a table, and a learned or
 * heavily-interacted mapping would move the explanation somewhere they cannot
 * audit. Where evidence eventually justifies a nonlinearity, it should arrive
 * with the measurement that motivated it.
 *
 * Nothing here is domain-specific. A weight says how much this actor dislikes
 * being seen; what "being seen" means is the scenario's problem.
 */

import { doctrineValues } from "./doctrine.js";
import type { DoctrineProfile } from "./doctrine.js";

/**
 * How the actor currently frames its situation.
 *
 * Prospect theory's central finding is that the same actor takes risks in the
 * domain of losses that it refuses in the domain of gains, so a model with one
 * fixed risk attitude per actor mispredicts exactly the cases a defender cares
 * about — a regime under real pressure. The frame is state, not doctrine: it
 * changes during a run.
 */
export const DECISION_FRAMES = ["gain", "loss"] as const;
export type DecisionFrame = (typeof DECISION_FRAMES)[number];

/**
 * The multipliers the kernel actually arithmetic with.
 *
 * Each is a cost or gain coefficient on a term of the move-value sum. They are
 * unitless: the terms they multiply are all normalized to comparable scales by
 * the scenario before they arrive here.
 */
export interface DecisionWeights {
  /** Coefficient on the gain from the move's consequence. */
  readonly payoffWeight: number;
  /** Coefficient on the probability the move is provably traced back. */
  readonly attributionCost: number;
  /** Coefficient on the legal/alliance/reputational price of the move. */
  readonly legitimacyCost: number;
  /** Coefficient on harm falling on the other side's noncombatants. */
  readonly counterpartHarmCost: number;
  /** Coefficient on the expected retaliation the move invites. */
  readonly retaliationCost: number;
  /** Coefficient on the coercive value of being seen doing it. */
  readonly signalingGain: number;
  /** Per-tick discount on holding an advantage unspent. High patience ⇒ near 0. */
  readonly holdDiscount: number;
  /** Softmax inverse temperature over the choice set. */
  readonly rationality: number;
  /** Multiplier on how disproportionate this actor's own retaliation is. */
  readonly reciprocity: number;
  /** Share of the move's exposure a proxy absorbs, in [0,1]. */
  readonly proxyShielding: number;
}

/**
 * Impatience, per tick, and it must stay small.
 *
 * This discount competes directly against the payoff's own per-tick drift, which
 * is a fraction of a percent. Setting the floor above that drift makes even a
 * maximally patient actor discount the future faster than the future improves,
 * so holding is never worth it and the hold/spend decision silently stops
 * existing — every actor becomes an immediate spender and the timing question
 * the model is built to answer disappears without any error.
 *
 * The floor is therefore ZERO: perfect patience must mean no impatience penalty
 * at all, leaving option value governed only by decay and attrition.
 */
const MAX_HOLD_DISCOUNT = 0.03;
const MIN_HOLD_DISCOUNT = 0;

/**
 * Translate a profile into the weights the kernel uses, under a given frame.
 *
 * The loss frame does not simply raise every risk appetite. It raises tolerance
 * for the actor's OWN exposure — attribution, retaliation, legitimacy — while
 * leaving restraint toward noncombatants where doctrine put it. Collapsing those
 * into one "gets bolder" scalar is the modelling error that produces the lazy
 * prediction that a cornered actor does anything at all, which is both wrong and
 * the sort of wrong a government reader will catch.
 */
export function decisionWeights(
  profile: DoctrineProfile,
  frame: DecisionFrame = "gain",
): DecisionWeights {
  const d = doctrineValues(profile);

  // Under loss framing an actor discounts its own downside. 0 ⇒ no shift.
  const lossDiscount = frame === "loss" ? d.lossFrameRiskAcceptance : 0;
  const ownCostScale = 1 - 0.6 * lossDiscount;

  // Signalling and deniability pull against each other: an actor that wants the
  // act seen is, by construction, not trying to hide it. Netting them here keeps
  // the kernel from having to know they interact.
  const netExposureAversion = Math.max(
    0,
    d.attributionAversion - 0.5 * d.signalingPreference,
  );

  return {
    payoffWeight: 1,
    attributionCost: netExposureAversion * ownCostScale,
    legitimacyCost: d.legitimacyWeight * ownCostScale,
    // Restraint toward noncombatants is NOT discounted by the loss frame.
    counterpartHarmCost: d.counterpartHarmRestraint,
    retaliationCost: (1 - d.ownCostTolerance) * ownCostScale,
    signalingGain: d.signalingPreference,
    holdDiscount:
      MIN_HOLD_DISCOUNT +
      (1 - d.timeHorizon) * (MAX_HOLD_DISCOUNT - MIN_HOLD_DISCOUNT),
    rationality: effectiveRationality(profile),
    reciprocity: d.reciprocityProportion,
    proxyShielding: d.proxyPreference * PROXY_MAX_SHIELD,
  };
}

/**
 * A proxy never buys total deniability.
 *
 * Capping below 1 is the finding from the proxy-warfare literature that matters
 * for a defender: delegation lowers attributability, it does not remove it, and
 * a model that let it reach 1 would conclude no sponsor is ever deterrable.
 */
const PROXY_MAX_SHIELD = 0.75;

/**
 * Rationality, adjusted for how the decision is actually made.
 *
 * A dispersed decision structure produces less consistent targeting than a
 * centralized one even when both are equally capable, because more hands mean
 * more local objectives. This is where the criminal-affiliate ecosystem gets its
 * genuinely wide behavioural spread rather than being handed one by a tuning
 * knob — the spread is downstream of the structure, which is the claim.
 */
export function effectiveRationality(profile: DoctrineProfile): number {
  const d = doctrineValues(profile);
  const dispersionPenalty = 1 - 0.4 * (1 - d.decisionCentralization);
  return Math.max(0.5, profile.rationalityPrecision * dispersionPenalty);
}

/**
 * Whether an actor should be treated as operating in the domain of losses.
 *
 * Kept as an explicit function of scenario state rather than a config flag so
 * the frame can flip mid-run and the flip shows up in the deliberation record —
 * "this actor started behaving differently at tick 62, and here is why" is one
 * of the few things a simulation can tell a defender that a briefing cannot.
 */
export interface LossFrameSignals {
  /** Cumulative cost the actor has absorbed, normalized to [0,1]. */
  readonly sustainedCost: number;
  /** Share of its holdings lost to defensive action, in [0,1]. */
  readonly attritionRate: number;
  /** Whether one of its own redlines has been crossed by someone else. */
  readonly redlineCrossed: boolean;
}

/** Threshold above which accumulated pressure flips the frame. */
const LOSS_FRAME_THRESHOLD = 0.5;

export function frameFor(
  profile: DoctrineProfile,
  signals: LossFrameSignals,
): DecisionFrame {
  if (signals.redlineCrossed) return "loss";
  const d = doctrineValues(profile);
  // A patient actor absorbs more before it reframes; that is what patience is.
  const tolerance = 0.3 + 0.4 * d.timeHorizon;
  const pressure = 0.6 * signals.sustainedCost + 0.4 * signals.attritionRate;
  return pressure > LOSS_FRAME_THRESHOLD * (1 + tolerance) ? "loss" : "gain";
}

/**
 * Human-readable account of which weights dominate this actor.
 *
 * Feeds the deliberation stream so a viewer sees the actor's character in the
 * same terms the arithmetic uses, rather than a label asserted alongside numbers
 * that may not match it.
 */
export function describeWeights(weights: DecisionWeights): string {
  const drivers: { label: string; magnitude: number }[] = [
    { label: "avoiding attribution", magnitude: weights.attributionCost },
    { label: "legal and alliance cost", magnitude: weights.legitimacyCost },
    {
      label: "restraint toward civilians",
      magnitude: weights.counterpartHarmCost,
    },
    { label: "fear of retaliation", magnitude: weights.retaliationCost },
    { label: "wanting the act seen", magnitude: weights.signalingGain },
  ];
  const ranked = [...drivers]
    .sort((a, b) => b.magnitude - a.magnitude)
    .filter((entry) => entry.magnitude > 0.15)
    .slice(0, 2)
    .map((entry) => entry.label);

  if (ranked.length === 0) return "weighs almost nothing against the payoff";
  const patience =
    weights.holdDiscount < 0.02
      ? "; will hold an advantage for a long time"
      : weights.holdDiscount > 0.1
        ? "; spends advantages quickly"
        : "";
  return `driven most by ${ranked.join(" and ")}${patience}`;
}
