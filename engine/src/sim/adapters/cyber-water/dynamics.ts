/**
 * Adversary decision dynamics, and the defensive arm applied as a treatment.
 *
 * The adversary is modelled as an optimal-stopping problem over access it
 * already holds, not as an intrusion. That choice is the whole point: the
 * question a defender cannot currently answer is not "can they get in" — CISA
 * AA26-097A already established they are in — but "when do they spend it, and
 * what does it cost me to make that decision come out differently".
 *
 * Holding has option value because the political payoff drifts upward. Spending
 * has attribution risk that scales with instrument severity. Defenses move both
 * terms, and NOT always in the defender's favour: raising detection pressure
 * shortens expected hold time, which can pull activation forward. That
 * use-it-or-lose-it effect is a real property of the model, and the ranking
 * layer reports it rather than hiding it.
 */

import type { Rng } from "../../rng.js";
import {
  INSTRUMENT_BANDS,
  instrumentSeverity,
  isDefenseActive,
} from "./config.js";
import type {
  ComponentRef,
  CyberWaterConfig,
  DefenseConfig,
  InstrumentBand,
} from "./config.js";
import {
  isKinetic,
  lookupConsequence,
  reportedPersonHours,
} from "./consequence.js";

/** Per-tick probability that one held access is rotated out, at full strength. */
const ROTATION_BASE = 0.05;
/** Per-tick probability that one held access is discovered, at full strength. */
const DISCOVERY_BASE = 0.02;

export interface HeldAccess {
  readonly componentId: string;
  readonly acquiredTick: number;
  /** Decays while unexercised — stale access stops working. */
  value: number;
}

export interface Activation {
  readonly tick: number;
  readonly componentId: string;
  readonly band: InstrumentBand;
  readonly durationHours: number;
  readonly personHours: number;
  readonly peakPeopleBelow: number;
  /** False when the pressure sweep did not agree on sign and band. */
  readonly established: boolean;
  readonly dwellTicks: number;
}

export interface TickOutcome {
  readonly acquisitions: number;
  readonly evictions: number;
  readonly activation: Activation | null;
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

function coverageFactor(defense: DefenseConfig | null, kind: string): number {
  if (!defense || defense.kind !== kind) return 0;
  return defense.intensity * defense.coverage;
}

/** Components a segmentation programme has actually reached. */
export function selectDefenseCoverage(
  register: readonly ComponentRef[],
  config: CyberWaterConfig,
  rng: Rng,
): Set<string> {
  const defense = config.defense;
  if (!defense || defense.kind === "none" || defense.coverage <= 0) {
    return new Set();
  }
  const count = Math.round(defense.coverage * register.length);
  return new Set(
    rng
      .sample(
        register.map((c) => c.id),
        count,
      )
      .map((id) => id),
  );
}

/** Access held at t=0 — the prior only classified reporting can set. */
export function seedAccess(
  register: readonly ComponentRef[],
  config: CyberWaterConfig,
  rng: Rng,
): HeldAccess[] {
  const { initialAccessMean, initialAccessSd } = config.adversary;
  const drawn = Math.round(
    rng.clampedNormal(initialAccessMean, initialAccessSd, 0, register.length),
  );
  return rng.sample(register, drawn).map((component) => ({
    componentId: component.id,
    acquiredTick: 0,
    value: 1,
  }));
}

/**
 * Expected duration of an activation on this band, after defensive shortening.
 *
 * Manual fallback is the only defense that acts here, and it acts on the thing
 * that matters most: an operator running the plant by hand ends the hydraulic
 * event without evicting the adversary. It shortens consequence, it does not
 * remove access — so it shows up as cheap harm reduction and zero eviction,
 * which is exactly the trade a ranking should make visible.
 */
export function effectiveDurationHours(
  config: CyberWaterConfig,
  band: InstrumentBand,
  tick: number,
): number {
  const base = config.adversary.durationHoursByBand[band];
  if (base <= 0) return 0;
  if (!isDefenseActive(config, tick)) return base;
  const relief = coverageFactor(config.defense, "manual_fallback");
  return base * (1 - relief);
}

/** Attribution risk of spending access at this band, in [0,1]. */
function attributionRisk(
  config: CyberWaterConfig,
  band: InstrumentBand,
  tick: number,
): number {
  const severity = instrumentSeverity(band) / (INSTRUMENT_BANDS.length - 1);
  const detection = isDefenseActive(config, tick)
    ? coverageFactor(config.defense, "anomaly_detection")
    : 0;
  return Math.min(1, severity * (0.5 + 0.5 * detection));
}

/**
 * Value of activating one held access at one band, in normalized harm units.
 *
 * Harm is divided by (population × 24h) so it is comparable across archetypes
 * of different size — otherwise the district always outranks the rural system
 * for reasons that have nothing to do with how exposed either one is.
 */
function activationValue(
  config: CyberWaterConfig,
  component: ComponentRef,
  band: InstrumentBand,
  payoff: number,
  tick: number,
): number {
  if (!isKinetic(band)) {
    // Exposure buys signalling value only, and cheaply.
    return (
      payoff * 0.02 -
      config.adversary.riskSensitivity * attributionRisk(config, band, tick)
    );
  }
  const hours = effectiveDurationHours(config, band, tick);
  const { cell } = lookupConsequence(
    config.consequence,
    component.id,
    component.perturbation,
    hours,
  );
  const normalized =
    reportedPersonHours(cell) /
    Math.max(1, config.consequence.servedPopulation * 24);
  return (
    payoff * normalized -
    config.adversary.riskSensitivity * attributionRisk(config, band, tick)
  );
}

export interface ActivationChoice {
  readonly component: ComponentRef;
  readonly band: InstrumentBand;
  readonly value: number;
}

/** Every (component, band) the adversary could spend right now, with its value. */
export function enumerateChoices(
  config: CyberWaterConfig,
  held: readonly HeldAccess[],
  payoff: number,
  tick: number,
): ActivationChoice[] {
  const byId = new Map(config.register.map((c) => [c.id, c]));
  const choices: ActivationChoice[] = [];

  for (const access of held) {
    const component = byId.get(access.componentId);
    if (!component) continue;
    for (const band of INSTRUMENT_BANDS) {
      if (band === "none") continue;
      const value =
        activationValue(config, component, band, payoff, tick) * access.value;
      choices.push({ component, band, value });
    }
  }
  return choices;
}

/** The single highest-value choice. Retained for tests and the hold/spend gate. */
export function bestActivation(
  config: CyberWaterConfig,
  held: readonly HeldAccess[],
  payoff: number,
  tick: number,
): ActivationChoice | null {
  let best: ActivationChoice | null = null;
  for (const choice of enumerateChoices(config, held, payoff, tick)) {
    if (!best || choice.value > best.value) best = choice;
  }
  return best;
}

/**
 * Quantal-response selection over the available choices.
 *
 * A hard argmax makes the adversary pick the single globally-best move every
 * time, which collapses an ensemble to one component and makes any chokepoint
 * ranking degenerate — the model would report the mode of a distribution as if
 * it were the whole distribution. Real adversaries are boundedly rational: they
 * usually pick a strong move and occasionally pick a weaker one, and it is that
 * spread the defender needs, because it is where the actual attack surface is.
 *
 * `rationality` is the softmax inverse-temperature. High values approach the
 * argmax; low values approach uniform. It is a property of the adversary, not a
 * knob to tune until the output looks varied, so it lives in the run spec's
 * mapping and is documented there.
 */
export function selectActivation(
  choices: readonly ActivationChoice[],
  rationality: number,
  rng: Rng,
): ActivationChoice | null {
  if (choices.length === 0) return null;

  // Subtract the max before exponentiating so a large value cannot overflow to
  // Infinity and turn the whole distribution into a single NaN.
  const maxValue = Math.max(...choices.map((c) => c.value));
  const weights = choices.map((c) =>
    Math.exp(rationality * (c.value - maxValue)),
  );
  return choices[rng.weightedIndex(weights)] ?? null;
}

/**
 * Advance the adversary and the defender one tick.
 *
 * Order matters and is deliberate: the defender acts on access acquired in
 * PREVIOUS ticks, never on access acquired this tick. Evicting an access in
 * the same tick it was gained would make detection look instantaneous and drive
 * dwell time to zero — the metric the whole activation question is about.
 */
export function stepAdversary(
  config: CyberWaterConfig,
  held: HeldAccess[],
  covered: ReadonlySet<string>,
  activations: readonly Activation[],
  tick: number,
  rng: Rng,
): TickOutcome {
  const defenseActive = isDefenseActive(config, tick);
  const defense = config.defense;

  // ── defender acts first, on previously held access ──
  let evictions = 0;
  if (defenseActive) {
    const rotation = coverageFactor(defense, "credential_rotation");
    const discovery = coverageFactor(defense, "anomaly_detection");
    for (let i = held.length - 1; i >= 0; i--) {
      const access = held[i]!;
      if (access.acquiredTick >= tick) continue;
      const reached = covered.has(access.componentId);
      const hazard = reached
        ? rotation * ROTATION_BASE + discovery * DISCOVERY_BASE
        : 0;
      if (hazard > 0 && rng.bernoulli(hazard)) {
        held.splice(i, 1);
        evictions++;
      }
    }
  }

  // ── access decay ──
  for (const access of held) {
    access.value = Math.max(
      0,
      access.value * (1 - config.adversary.accessValueDecay),
    );
  }

  // ── acquisition ──
  let acquisitions = 0;
  const segmentation = defenseActive
    ? coverageFactor(defense, "network_segmentation")
    : 0;
  const heldIds = new Set(held.map((a) => a.componentId));
  const reachable = config.register.filter((c) => !heldIds.has(c.id));
  if (reachable.length > 0) {
    const hazard = config.adversary.acquisitionHazard * (1 - segmentation);
    if (rng.bernoulli(hazard)) {
      const target = rng.pick(reachable);
      held.push({ componentId: target.id, acquiredTick: tick, value: 1 });
      acquisitions++;
    }
  }

  // ── decision ──
  const payoff =
    config.adversary.payoffBase + config.adversary.payoffDrift * tick;
  let activation: Activation | null = null;

  const alreadySpent = new Set(activations.map((a) => a.componentId));
  const spendable = held.filter((a) => !alreadySpent.has(a.componentId));

  if (tick >= config.adversary.earliestActivationTick && spendable.length > 0) {
    const choices = enumerateChoices(config, spendable, payoff, tick);
    const best = choices.reduce<ActivationChoice | null>(
      (top, c) => (!top || c.value > top.value ? c : top),
      null,
    );

    if (best && best.value > 0) {
      // The timing decision — spend now or hold — is made on the BEST move's
      // option value: waiting is only worth it if the best thing available
      // would itself be worth more later. The payoff drifts up, but the access
      // may be evicted or decay before it can be spent.
      const survival =
        1 -
        (defenseActive && covered.has(best.component.id)
          ? coverageFactor(defense, "credential_rotation") * ROTATION_BASE +
            coverageFactor(defense, "anomaly_detection") * DISCOVERY_BASE
          : 0);
      const nextPayoff = payoff + config.adversary.payoffDrift;
      const holdValue =
        best.value *
        (nextPayoff / Math.max(1e-9, payoff)) *
        survival *
        (1 - config.adversary.accessValueDecay);

      // WHICH move executes, given it decided to act, is quantal-response over
      // the positive-value choices — boundedly rational, not argmax, so the
      // ensemble explores the real attack surface instead of one mode.
      const actable = choices.filter((c) => c.value > 0);
      const choice =
        selectActivation(actable, config.adversary.rationality, rng) ?? best;

      if (best.value >= holdValue) {
        const access = spendable.find(
          (a) => a.componentId === choice.component.id,
        )!;
        const hours = effectiveDurationHours(config, choice.band, tick);
        const { cell } = lookupConsequence(
          config.consequence,
          choice.component.id,
          choice.component.perturbation,
          isKinetic(choice.band) ? hours : 0,
        );
        activation = {
          tick,
          componentId: choice.component.id,
          band: choice.band,
          durationHours: isKinetic(choice.band) ? hours : 0,
          personHours: isKinetic(choice.band) ? reportedPersonHours(cell) : 0,
          peakPeopleBelow: isKinetic(choice.band) ? cell.peakPeopleBelow : 0,
          established: isKinetic(choice.band)
            ? cell.converged && cell.bandAgreed && cell.deltaPersonHoursLow > 0
            : false,
          dwellTicks: tick - access.acquiredTick,
        };
      }
    }
  }

  // ── telemetry ──
  // Everything below is what a defender's own instrumentation could record.
  // Nothing here reveals which components are held or what the adversary plans.
  const presencePressure = held.length * 0.35;
  const anomalyEvents =
    poisson(rng, config.backgroundAnomalyRate + presencePressure) +
    (activation ? poisson(rng, 6) : 0);
  const configChangeEvents =
    activation && isKinetic(activation.band)
      ? poisson(rng, 2 + instrumentSeverity(activation.band))
      : poisson(rng, 0.2);
  const failedAuthEvents = poisson(rng, 0.8 + acquisitions * 3);

  // Complaints track the hydraulic event while it is still running, and are
  // suppressed when alarms are — that is the instrument's whole purpose.
  const activeEvent = [
    ...activations,
    ...(activation ? [activation] : []),
  ].find(
    (a) => tick >= a.tick && tick < a.tick + Math.ceil(a.durationHours / 24),
  );
  const suppressed =
    activeEvent?.band === "setpoint_with_alarm_suppression" ? 0.25 : 1;
  const serviceComplaints = activeEvent
    ? poisson(rng, (activeEvent.peakPeopleBelow / 500) * suppressed)
    : poisson(rng, 0.1);

  return {
    acquisitions,
    evictions,
    activation,
    defenseCost: defenseActive ? defense!.costPerTick : 0,
    heldCount: held.length,
    anomalyEvents,
    configChangeEvents,
    failedAuthEvents,
    serviceComplaints,
  };
}
