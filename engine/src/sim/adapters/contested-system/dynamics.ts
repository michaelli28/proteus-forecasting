/**
 * The contested system, advanced one tick.
 *
 * Order is deliberate and load-bearing:
 *
 *   defender acts → holdings decay → actors acquire → actors deliberate and
 *   possibly act → third parties react → telemetry is emitted
 *
 * The defender acts FIRST and only on holdings acquired in previous ticks.
 * Evicting access in the same tick it was gained would make detection look
 * instantaneous and drive dwell time to zero — and dwell time is the measure the
 * whole activation question turns on.
 *
 * Third parties react LAST, so their response lands on what actually happened
 * rather than on what an actor was considering. Their reaction feeds the NEXT
 * tick's valuation, which is the honest lag: an actor prices the retaliation it
 * expects, then finds out.
 */

import type { Rng } from "../../rng.js";
import { channelStrength, isConsequential, isDefenseActive } from "./config.js";
import type {
  ActorConfig,
  ContestedSystemConfig,
  EscalationRung,
} from "./config.js";
import { deliberate, signalKey, HOLDING_ATTRITION_BASE } from "./decision.js";
import type { Deliberation, Holding } from "./decision.js";
import { frameFor } from "../../../actors/posture.js";
import type { DecisionFrame } from "../../../actors/posture.js";
import { reportedHarm } from "./oracle.js";
import type { ObservableTick } from "./observable.js";

/** One executed move and what it cost the system. */
export interface Activation {
  readonly tick: number;
  readonly actorId: string;
  readonly assetId: string;
  readonly rungId: string;
  readonly durationHours: number;
  readonly harm: number;
  readonly peakUnitsAffected: number;
  /** False when the consequence estimate was not robust — a measurement gap. */
  readonly established: boolean;
  /** Ticks between gaining the access and spending it. */
  readonly dwellTicks: number;
  /** Whether third parties could attribute it, given proxy shielding. */
  readonly attributed: boolean;
}

export interface ActorState {
  readonly actorId: string;
  holdings: Holding[];
  /** Assets consumed by a consequential act. */
  spentAssetIds: Set<string>;
  /** `assetId|rungId` pairs already used to signal. Signalling does not spend. */
  signalledPairs: Set<string>;
  /** Cost absorbed from third-party response, normalized to [0,1]. */
  sustainedCost: number;
  holdingsLost: number;
  holdingsAcquired: number;
  frame: DecisionFrame;
}

export interface ContestedSystemState {
  readonly actors: ActorState[];
  readonly activations: Activation[];
  /** Deliberations from the tick just stepped. Replaced each tick. */
  deliberations: Deliberation[];
  /** Telemetry accumulated so far — the only history a detector may read. */
  readonly observables: ObservableTick[];
  covered: Set<string>;
  cumulativeDefenseCost: number;
}

export interface TickOutcome {
  readonly acquisitions: number;
  readonly evictions: number;
  readonly activations: readonly Activation[];
  readonly deliberations: readonly Deliberation[];
  readonly defenseCost: number;
  readonly heldCount: number;
  // ── telemetry channels ──
  readonly anomalyEvents: number;
  readonly configChangeEvents: number;
  readonly failedAuthEvents: number;
  readonly serviceComplaints: number;
}

/** Poisson draw by Knuth's method. Rates here are small, so the loop is short. */
function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = rng.next();
  while (product > limit && k < 1000) {
    k++;
    product *= rng.next();
  }
  return k;
}

/** Assets a partial-coverage mitigation has actually reached. */
export function selectCoverage(
  config: ContestedSystemConfig,
  rng: Rng,
): Set<string> {
  const defense = config.defense;
  if (!defense || defense.coverage <= 0) return new Set();
  const count = Math.round(defense.coverage * config.register.length);
  return new Set(
    rng.sample(
      config.register.map((a) => a.id),
      count,
    ),
  );
}

/** Holdings at t=0 — the prior only privileged reporting can set. */
export function seedHoldings(
  config: ContestedSystemConfig,
  actor: ActorConfig,
  rng: Rng,
): Holding[] {
  const drawn = Math.round(
    rng.clampedNormal(
      actor.initialHoldingsMean,
      actor.initialHoldingsSd,
      0,
      config.register.length,
    ),
  );
  return rng
    .sample(config.register, drawn)
    .map((asset) => ({ assetId: asset.id, acquiredTick: 0, value: 1 }));
}

export function initState(
  config: ContestedSystemConfig,
  rng: Rng,
): ContestedSystemState {
  return {
    actors: config.actors.map((actor) => ({
      actorId: actor.profile.id,
      holdings: seedHoldings(
        config,
        actor,
        rng.fork(`holdings/${actor.profile.id}`),
      ),
      spentAssetIds: new Set<string>(),
      signalledPairs: new Set<string>(),
      sustainedCost: 0,
      holdingsLost: 0,
      holdingsAcquired: 0,
      frame: "gain" as DecisionFrame,
    })),
    activations: [],
    deliberations: [],
    observables: [],
    covered: selectCoverage(config, rng.fork("coverage")),
    cumulativeDefenseCost: 0,
  };
}

export function stepSystem(
  config: ContestedSystemConfig,
  state: ContestedSystemState,
  tick: number,
  rng: Rng,
): TickOutcome {
  const defenseActive = isDefenseActive(config, tick);
  const ladderById = new Map(config.ladder.map((r) => [r.id, r]));

  let evictions = 0;
  let acquisitions = 0;
  const activations: Activation[] = [];
  const deliberations: Deliberation[] = [];

  for (const actorConfig of config.actors) {
    const actorState = state.actors.find(
      (a) => a.actorId === actorConfig.profile.id,
    );
    if (!actorState) continue;

    // ── defender acts, on previously held access only ──
    if (defenseActive) {
      const attrition = channelStrength(config.defense, "holding_attrition");
      for (let i = actorState.holdings.length - 1; i >= 0; i--) {
        const holding = actorState.holdings[i]!;
        if (holding.acquiredTick >= tick) continue;
        if (!state.covered.has(holding.assetId)) continue;
        if (rng.bernoulli(attrition * HOLDING_ATTRITION_BASE)) {
          actorState.holdings.splice(i, 1);
          actorState.holdingsLost++;
          evictions++;
        }
      }
    }

    // ── decay ──
    for (const holding of actorState.holdings) {
      holding.value = Math.max(
        0,
        holding.value * (1 - actorConfig.holdingValueDecay),
      );
    }

    // ── acquisition ──
    const denial = defenseActive
      ? channelStrength(config.defense, "access_denial")
      : 0;
    const heldIds = new Set(actorState.holdings.map((h) => h.assetId));
    const reachable = config.register.filter((a) => !heldIds.has(a.id));
    if (reachable.length > 0) {
      const hazard = actorConfig.acquisitionHazard * (1 - denial);
      if (rng.bernoulli(hazard)) {
        const target = rng.pick(reachable);
        actorState.holdings.push({
          assetId: target.id,
          acquiredTick: tick,
          value: 1,
        });
        actorState.holdingsAcquired++;
        acquisitions++;
      }
    }

    // ── frame, then deliberation ──
    const totalHoldings =
      actorState.holdings.length + actorState.holdingsLost || 1;
    actorState.frame = frameFor(actorConfig.profile, {
      sustainedCost: Math.min(1, actorState.sustainedCost),
      attritionRate: actorState.holdingsLost / totalHoldings,
      redlineCrossed: false,
    });

    const deliberation = deliberate({
      config,
      actor: actorConfig,
      holdings: actorState.holdings,
      spentAssetIds: actorState.spentAssetIds,
      signalledPairs: actorState.signalledPairs,
      frame: actorState.frame,
      tick,
      rng,
    });
    deliberations.push(deliberation);

    if (deliberation.decision === "act" && deliberation.chosen) {
      const activation = executeMove(
        config,
        actorConfig,
        actorState,
        deliberation,
        ladderById,
        tick,
      );
      if (activation) {
        activations.push(activation);
        state.activations.push(activation);
        // Only a consequential act burns the access. Signalling costs exposure.
        if (activation.durationHours > 0) {
          actorState.spentAssetIds.add(activation.assetId);
        } else {
          actorState.signalledPairs.add(
            signalKey(activation.assetId, activation.rungId),
          );
        }
      }
    }
  }

  // ── third parties react to what actually happened ──
  applyRespondentPressure(config, state, activations);

  // ── telemetry ──
  const outcome = emitTelemetry(config, state, activations, acquisitions, rng);
  state.observables.push({ tick, ...outcome });

  state.deliberations = deliberations;
  const defenseCost = defenseActive ? config.defense!.costPerTick : 0;
  state.cumulativeDefenseCost += defenseCost;

  return {
    acquisitions,
    evictions,
    activations,
    deliberations,
    defenseCost,
    heldCount: state.actors.reduce((sum, a) => sum + a.holdings.length, 0),
    ...outcome,
  };
}

function executeMove(
  config: ContestedSystemConfig,
  actorConfig: ActorConfig,
  actorState: ActorState,
  deliberation: Deliberation,
  ladderById: ReadonlyMap<string, EscalationRung>,
  tick: number,
): Activation | null {
  const chosen = deliberation.chosen!;
  const rung = ladderById.get(chosen.rungId);
  if (!rung) return null;

  const holding = actorState.holdings.find((h) => h.assetId === chosen.assetId);
  if (!holding) return null;

  const asset = config.register.find((a) => a.id === chosen.assetId);
  if (!asset) return null;

  const relief = isDefenseActive(config, tick)
    ? channelStrength(config.defense, "consequence_limiting")
    : 0;
  const hours = rung.durationHours * (1 - relief);

  const estimate = isConsequential(rung)
    ? config.oracle.lookup(asset.id, asset.effectKind, hours)
    : null;

  const proxyShielding =
    actorConfig.profile.doctrine.proxyPreference.value * 0.75;

  return {
    tick,
    actorId: actorConfig.profile.id,
    assetId: asset.id,
    rungId: rung.id,
    durationHours: isConsequential(rung) ? hours : 0,
    harm: estimate ? reportedHarm(estimate) : 0,
    peakUnitsAffected: estimate?.peakUnitsAffected ?? 0,
    established: estimate?.established ?? false,
    dwellTicks: tick - holding.acquiredTick,
    attributed: rung.attributability * (1 - proxyShielding) >= 0.5,
  };
}

/**
 * Third-party response, charged to the actor that drew it.
 *
 * Cost accumulates rather than resolving instantly, which is what eventually
 * flips an actor into the loss frame and changes how it values its own exposure.
 * That feedback loop — act, get punished, become more willing to act — is the
 * dynamic a static risk parameter cannot represent, and it is one of the few
 * places this model can surprise the person who configured it.
 */
function applyRespondentPressure(
  config: ContestedSystemConfig,
  state: ContestedSystemState,
  activations: readonly Activation[],
): void {
  for (const activation of activations) {
    if (!activation.attributed) continue;
    const actorState = state.actors.find(
      (a) => a.actorId === activation.actorId,
    );
    if (!actorState) continue;

    const rung = config.ladder.find((r) => r.id === activation.rungId);
    if (!rung) continue;

    let imposed = 0;
    for (const respondent of config.respondents) {
      if (rung.attributability < respondent.attributionThreshold) continue;
      if (respondent.alignment === "adversary_aligned") continue;
      const weight =
        respondent.alignment === "nonaligned" ? rung.visibility : 1;
      imposed +=
        respondent.responseCapacity *
        respondent.profile.doctrine.reciprocityProportion.value *
        weight;
    }
    actorState.sustainedCost += imposed * RESPONSE_COST_SCALE;
  }
}

/** Puts respondent capacity onto the [0,1] scale the loss frame reads. */
const RESPONSE_COST_SCALE = 0.02;

/**
 * What the defender's own instrumentation could record.
 *
 * Nothing here reveals which assets are held, who holds them, or what any actor
 * is considering. This is the detector's entire input, and keeping it genuinely
 * separate from the truth channel is what makes detection precision a measured
 * number instead of a tautology.
 */
function emitTelemetry(
  config: ContestedSystemConfig,
  state: ContestedSystemState,
  activations: readonly Activation[],
  acquisitions: number,
  rng: Rng,
): {
  anomalyEvents: number;
  configChangeEvents: number;
  failedAuthEvents: number;
  serviceComplaints: number;
} {
  const held = state.actors.reduce((sum, a) => sum + a.holdings.length, 0);
  const presencePressure = held * 0.35;

  const anomalyEvents =
    poisson(rng, config.backgroundAnomalyRate + presencePressure) +
    (activations.length > 0 ? poisson(rng, 6) : 0);

  const severitySum = activations.reduce((sum, activation) => {
    const index = config.ladder.findIndex((r) => r.id === activation.rungId);
    return sum + Math.max(0, index);
  }, 0);
  const configChangeEvents =
    activations.length > 0 ? poisson(rng, 2 + severitySum) : poisson(rng, 0.2);

  const failedAuthEvents = poisson(rng, 0.8 + acquisitions * 3);

  // Complaints track an effect while it is still running. A low-visibility rung
  // suppresses them, which is the whole reason such a rung is worth choosing.
  const tick = activations[0]?.tick ?? Number.NaN;
  const running = state.activations.filter((activation) => {
    const span = Math.ceil(activation.durationHours / 24);
    const now = Number.isNaN(tick) ? activation.tick : tick;
    return now >= activation.tick && now < activation.tick + span;
  });
  const complaintRate = running.reduce((sum, activation) => {
    const rung = config.ladder.find((r) => r.id === activation.rungId);
    const visibility = rung?.visibility ?? 1;
    return sum + (activation.peakUnitsAffected / 500) * visibility;
  }, 0);

  return {
    anomalyEvents,
    configChangeEvents,
    failedAuthEvents,
    serviceComplaints:
      complaintRate > 0 ? poisson(rng, complaintRate) : poisson(rng, 0.1),
  };
}
