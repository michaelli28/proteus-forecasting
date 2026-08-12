/**
 * Domain-neutral configuration for a contested system.
 *
 * This is the cyber-water model with the water taken out. That adapter proved
 * the shape works — an adversary choosing WHICH asset, at WHAT rung of an
 * escalation ladder, held for HOW LONG, against a defender buying mitigations
 * with measurable ROI — but every noun in it was hydraulic. Here the nouns are
 * supplied by the scenario, so the same kernel ranks vulnerabilities in a power
 * grid, a port, a payment system, an election apparatus, or a hospital network
 * without a line of new dynamics code.
 *
 * SCOPE BOUNDARY, enforced structurally and inherited deliberately. An actor
 * chooses an ASSET, a RUNG, and a DURATION. There is no field in this file for a
 * technique, an exploit, a protocol, a credential, a payload, a command
 * sequence, a vendor, a firmware version, a network address, or a real
 * organisation — so no code path can emit an attack procedure, because there is
 * none in it to emit. Asset ids are opaque scenario-local labels. A scenario
 * that needs a real facility named should name it in the evaluator's own
 * classified environment, not here.
 *
 * What the model DOES carry is what a defender can act on: which asset matters,
 * who would move against it and why, when they would spend the advantage, and
 * what it costs to change that decision.
 */

import type { ConsequenceOracle } from "./oracle.js";
import type { DoctrineProfile } from "../../../actors/doctrine.js";

/**
 * One rung of the scenario's escalation ladder.
 *
 * The ladder is DATA, not a constant, and that single change is most of what
 * generalizes this engine. Cyber-water hardcoded five hydraulic instrument bands
 * because every run was a water run. A scenario about port logistics has a
 * different ladder with different visibility and different reversibility, and
 * hardcoding either one would have forced a fork of the dynamics.
 *
 * Rungs are ordinal: index in the scenario's array IS severity order, so the
 * kernel never has to be told which of two rungs is worse.
 */
export interface EscalationRung {
  readonly id: string;
  /** What the effect IS, in consequence terms — never how it is achieved. */
  readonly statement: string;
  /**
   * How likely the act is to be attributed to whoever ordered it, in [0,1].
   * Not the same as being noticed: an outage everyone sees may still be
   * unattributable, and that gap is exactly what a deniability-seeking actor buys.
   */
  readonly attributability: number;
  /** How visible the EFFECT is to the public and to third parties, in [0,1]. */
  readonly visibility: number;
  /** How much of the harm falls on noncombatants, in [0,1]. */
  readonly civilianHarmShare: number;
  /** Hours of effect at this rung, before defensive shortening. */
  readonly durationHours: number;
  /** Whether the effect can be undone by the defender without external help. */
  readonly reversible: boolean;
  /**
   * Legal and reputational price of being the actor that did this, in [0,1].
   * Distinct from attributability — a norm-violating act is costly to an actor
   * that cares about legitimacy even when deniable, because it knows it did it.
   */
  readonly legitimacyCost: number;
}

/** The floor rung every ladder carries: doing nothing observable. */
export const NULL_RUNG: EscalationRung = {
  id: "none",
  statement: "no action taken",
  attributability: 0,
  visibility: 0,
  civilianHarmShare: 0,
  durationHours: 0,
  reversible: true,
  legitimacyCost: 0,
};

/**
 * One thing in the system that can be affected.
 *
 * `effectKind` is the scenario's own vocabulary for what happens to this asset —
 * "flow_stopped", "schedule_corrupted", "settlement_delayed". It is a consequence
 * label the oracle can price, not an action a person could take.
 */
export interface AssetRef {
  readonly id: string;
  /** Scenario-local class, e.g. "generation", "berth", "clearing_node". */
  readonly assetClass: string;
  /** Grouping used for dependency and coverage, e.g. a zone or region. */
  readonly zone: string;
  /** The consequence label this asset admits. One per asset. */
  readonly effectKind: string;
  /** Population or throughput served, for normalizing harm across scenarios. */
  readonly servedUnits: number;
}

/**
 * A mitigation the defender can buy.
 *
 * Kinds are scenario-declared rather than a fixed enum, because "manual
 * fallback" is meaningful for a utility and meaningless for an election
 * apparatus. What is fixed is the four-part shape every mitigation has, which is
 * what makes ROI comparable across arms and across domains.
 */
export interface DefenseOption {
  readonly kind: string;
  readonly label: string;
  /** Plain-language account of what this buys, for the product. */
  readonly statement: string;
  readonly startTick: number;
  /** Strength in [0,1]. */
  readonly intensity: number;
  /** Cost per tick while active, in the scenario's budget units. */
  readonly costPerTick: number;
  /** Share of the asset register reached, in [0,1]. */
  readonly coverage: number;
  /** Which channels this mitigation acts on. Empty means it does nothing. */
  readonly effects: readonly DefenseEffect[];
}

/**
 * The channels a mitigation can act through.
 *
 * Closed set on purpose: these are the only four places the dynamics can be
 * moved, so a scenario author cannot invent a defense that works by magic. A
 * mitigation that does not map onto one of these is a mitigation whose mechanism
 * has not been thought through yet.
 */
export const DEFENSE_CHANNELS = [
  /** Lowers the rate at which an actor gains new holdings. */
  "access_denial",
  /** Raises the per-tick hazard that an existing holding is lost. */
  "holding_attrition",
  /** Raises the attributability of any act, deterring exposure-averse actors. */
  "attribution_pressure",
  /** Shortens the duration of an effect once it starts. Does not evict. */
  "consequence_limiting",
] as const;
export type DefenseChannel = (typeof DEFENSE_CHANNELS)[number];

export interface DefenseEffect {
  readonly channel: DefenseChannel;
  /** Share of this mitigation's intensity applied to the channel, in [0,1]. */
  readonly strength: number;
}

/**
 * An actor that may move against the system.
 *
 * `initialHoldings` is the parameter that only privileged reporting can set, and
 * it is named here so the confidence cap downstream can point at it by name
 * rather than at a general disclaimer.
 */
export interface ActorConfig {
  readonly profile: DoctrineProfile;
  /** Expected assets already held at t=0. The number only classified reporting has. */
  readonly initialHoldingsMean: number;
  readonly initialHoldingsSd: number;
  /** Per-tick hazard of gaining access to one further asset. */
  readonly acquisitionHazard: number;
  /** Per-tick decay of an unexercised holding's value. */
  readonly holdingValueDecay: number;
  /** Objective payoff at t=0 and its per-tick drift — the exogenous index. */
  readonly payoffBase: number;
  readonly payoffDrift: number;
  /** Ticks before this actor will consider spending anything. */
  readonly earliestActivationTick: number;
  /** Rungs this actor's capability puts within reach. Ids from the ladder. */
  readonly reachableRungs: readonly string[];
}

/**
 * A third party that reacts to what it observes.
 *
 * Respondents are why this is not a two-player game. An actor deciding whether
 * to move is pricing the reaction of allies, adversaries, and its own public,
 * and an engine with no third parties silently sets all of those to zero — which
 * makes every actor look more aggressive than it is. Respondents do not hold
 * assets and do not attack; they impose cost, which is the thing that changes
 * the initiator's arithmetic.
 */
export interface RespondentConfig {
  readonly profile: DoctrineProfile;
  /** Relationship to the defender: does this party punish or reward an attack on it. */
  readonly alignment: RespondentAlignment;
  /**
   * Attributability at which this party will act on what it believes, in [0,1].
   * Below it, the party may suspect and still not move — the deniability gap
   * that makes proxy action worth its lower effectiveness.
   */
  readonly attributionThreshold: number;
  /** Cost this party can impose per tick once it responds, in scenario units. */
  readonly responseCapacity: number;
}

export const RESPONDENT_ALIGNMENTS = [
  /** Punishes an attacker of the defended system. */
  "defender_aligned",
  /** Punishes the defender; an attack on the defender lowers this party's cost. */
  "adversary_aligned",
  /** Punishes norm violation by anyone, weighted by visibility. */
  "nonaligned",
] as const;
export type RespondentAlignment = (typeof RESPONDENT_ALIGNMENTS)[number];

export interface ContestedSystemConfig {
  readonly scenarioId: string;
  /** One line an analyst would recognise. Shown above every product. */
  readonly statement: string;
  readonly ticks: number;
  /** What one tick represents, e.g. "day". Labels only; the kernel is unitless. */
  readonly tickUnit: string;
  readonly register: readonly AssetRef[];
  /** Ascending severity. Index is the ordinal; `none` is prepended if absent. */
  readonly ladder: readonly EscalationRung[];
  readonly oracle: ConsequenceOracle;
  readonly actors: readonly ActorConfig[];
  readonly respondents: readonly RespondentConfig[];
  readonly defense: DefenseOption | null;
  /** Baseline per-tick rate of benign anomalies — the detector's noise floor. */
  readonly backgroundAnomalyRate: number;
  /** Total units served by the whole system, for normalizing across scenarios. */
  readonly servedUnits: number;
}

export function rungSeverity(
  ladder: readonly EscalationRung[],
  rungId: string,
): number {
  const index = ladder.findIndex((rung) => rung.id === rungId);
  return index < 0 ? 0 : index;
}

/** A rung that produces physical or economic effect, as opposed to signalling. */
export function isConsequential(rung: EscalationRung): boolean {
  return rung.durationHours > 0;
}

/** Mitigation strength on one channel, zero when the defense does not act there. */
export function channelStrength(
  defense: DefenseOption | null,
  channel: DefenseChannel,
): number {
  if (!defense) return 0;
  const effect = defense.effects.find((e) => e.channel === channel);
  if (!effect) return 0;
  return defense.intensity * defense.coverage * effect.strength;
}

export function isDefenseActive(
  config: ContestedSystemConfig,
  tick: number,
): boolean {
  return config.defense !== null && tick >= config.defense.startTick;
}

export class ScenarioError extends RangeError {}

/**
 * Rejects a scenario that would silently produce a degenerate or dishonest world.
 *
 * Fails closed everywhere. A generated scenario is the most likely source of a
 * quietly broken run — the compiler that writes them is a language model — so
 * this is the layer that has to be strict, and every message says what is wrong
 * rather than that something is.
 */
export function validateScenario(config: ContestedSystemConfig): void {
  if (config.ticks <= 0) throw new ScenarioError("ticks must be > 0");

  if (config.register.length === 0) {
    throw new ScenarioError(
      "register is empty — an actor with nothing to affect makes every run identical",
    );
  }
  const assetIds = new Set(config.register.map((a) => a.id));
  if (assetIds.size !== config.register.length) {
    throw new ScenarioError("asset ids must be unique");
  }
  for (const asset of config.register) {
    if (asset.servedUnits < 0) {
      throw new ScenarioError(`${asset.id}: servedUnits must be >= 0`);
    }
  }

  if (config.ladder.length < 2) {
    throw new ScenarioError(
      "ladder needs at least two rungs — a scenario with one option is not a decision",
    );
  }
  const rungIds = new Set(config.ladder.map((r) => r.id));
  if (rungIds.size !== config.ladder.length) {
    throw new ScenarioError("rung ids must be unique");
  }
  for (const rung of config.ladder) {
    assertUnit(rung.attributability, `rung ${rung.id}.attributability`);
    assertUnit(rung.visibility, `rung ${rung.id}.visibility`);
    assertUnit(rung.civilianHarmShare, `rung ${rung.id}.civilianHarmShare`);
    assertUnit(rung.legitimacyCost, `rung ${rung.id}.legitimacyCost`);
    if (!Number.isFinite(rung.durationHours) || rung.durationHours < 0) {
      throw new ScenarioError(`rung ${rung.id}.durationHours must be >= 0`);
    }
  }

  if (config.actors.length === 0) {
    throw new ScenarioError("a contested system needs at least one actor");
  }
  for (const actor of config.actors) {
    const id = actor.profile.id;
    if (actor.initialHoldingsMean < 0) {
      throw new ScenarioError(`${id}: initialHoldingsMean must be >= 0`);
    }
    if (actor.initialHoldingsSd < 0) {
      throw new ScenarioError(`${id}: initialHoldingsSd must be >= 0`);
    }
    assertUnit(actor.acquisitionHazard, `${id}.acquisitionHazard`);
    if (actor.earliestActivationTick < 0) {
      throw new ScenarioError(`${id}: earliestActivationTick must be >= 0`);
    }
    if (actor.reachableRungs.length === 0) {
      throw new ScenarioError(
        `${id}: reachableRungs is empty — an actor that can do nothing should be omitted, not included as a no-op`,
      );
    }
    for (const rungId of actor.reachableRungs) {
      if (!rungIds.has(rungId)) {
        throw new ScenarioError(
          `${id}: reachableRungs names "${rungId}", which is not on the ladder`,
        );
      }
    }
  }

  for (const respondent of config.respondents) {
    assertUnit(
      respondent.attributionThreshold,
      `${respondent.profile.id}.attributionThreshold`,
    );
    if (respondent.responseCapacity < 0) {
      throw new ScenarioError(
        `${respondent.profile.id}: responseCapacity must be >= 0`,
      );
    }
  }

  const defense = config.defense;
  if (defense) {
    assertUnit(defense.intensity, "defense.intensity");
    assertUnit(defense.coverage, "defense.coverage");
    if (defense.costPerTick < 0) {
      throw new ScenarioError("defense.costPerTick must be >= 0");
    }
    if (defense.startTick < 0) {
      throw new ScenarioError("defense.startTick must be >= 0");
    }
    if (defense.effects.length === 0) {
      throw new ScenarioError(
        `defense "${defense.kind}" declares no effects — a mitigation with no channel cannot be measured, and an unmeasurable arm in an ROI table is worse than an absent one`,
      );
    }
    for (const effect of defense.effects) {
      assertUnit(effect.strength, `defense effect ${effect.channel}.strength`);
    }
  }

  if (config.backgroundAnomalyRate < 0) {
    throw new ScenarioError("backgroundAnomalyRate must be >= 0");
  }
}

function assertUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ScenarioError(`${name} must be in [0,1], got ${value}`);
  }
}
