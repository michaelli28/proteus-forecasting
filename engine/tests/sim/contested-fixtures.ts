/**
 * Fixture doctrine profiles for the contested-system tests.
 *
 * These are NOT the researched library. Every `basis` says so, loudly, because a
 * fixture that reads like a real profile is the sort of thing that ends up in a
 * briefing slide. They exist to exercise the mechanics: one patient,
 * deniability-seeking actor with a hard commitment, one impatient opportunist
 * with none, and a third party that reacts.
 *
 * They are also the clearest statement of what the doctrine layer is FOR. The
 * two adversaries face an identical system with identical capability, and the
 * tests assert they behave differently — if that assertion ever fails, the
 * doctrine parameters have stopped doing anything and the whole layer is
 * decoration.
 */

import { createLibrary } from "../../src/actors/library.js";
import type { DoctrineLibrary } from "../../src/actors/library.js";
import type {
  DoctrineParameter,
  DoctrineProfile,
  DoctrineVector,
} from "../../src/actors/doctrine.js";

const FIXTURE_BASIS = "FIXTURE — not researched, not for citation";

function vec(values: Record<DoctrineParameter, number>): DoctrineVector {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = { value, confidence: "low", basis: FIXTURE_BASIS };
  }
  return out as DoctrineVector;
}

export const PATIENT_STATE: DoctrineProfile = {
  id: "fixture-patient-state",
  label: "Patient state actor (fixture)",
  kind: "state",
  summary:
    "Deniability-seeking, long horizon, disciplined targeting, holds a hard commitment against mass civilian harm.",
  doctrine: vec({
    ownCostTolerance: 0.45,
    counterpartHarmRestraint: 0.6,
    attributionAversion: 0.85,
    proxyPreference: 0.55,
    escalationControlBelief: 0.6,
    timeHorizon: 0.9,
    decisionCentralization: 0.75,
    lossFrameRiskAcceptance: 0.5,
    legitimacyWeight: 0.5,
    signalingPreference: 0.15,
    reciprocityProportion: 0.5,
  }),
  rationalityPrecision: 8,
  redlines: [
    {
      id: "no-mass-casualty",
      statement:
        "will not take actions expected to place most of the harm on noncombatants",
      effect: "self_prohibits",
      constraint: { attribute: "civilianHarmShare", maxAcceptable: 0.8 },
      basis: FIXTURE_BASIS,
      confidence: "low",
    },
  ],
  uncertainty: "fixture",
  sources: [FIXTURE_BASIS],
};

export const OPPORTUNIST: DoctrineProfile = {
  id: "fixture-opportunist",
  label: "Criminal affiliate network (fixture)",
  kind: "criminal_enterprise",
  summary:
    "Revenue-driven, fragmented decision structure, impatient, indifferent to legitimacy, no commitments.",
  doctrine: vec({
    ownCostTolerance: 0.3,
    counterpartHarmRestraint: 0.15,
    attributionAversion: 0.6,
    proxyPreference: 0.2,
    escalationControlBelief: 0.3,
    timeHorizon: 0.15,
    decisionCentralization: 0.2,
    lossFrameRiskAcceptance: 0.7,
    legitimacyWeight: 0.05,
    signalingPreference: 0.4,
    reciprocityProportion: 0.3,
  }),
  rationalityPrecision: 3,
  redlines: [],
  uncertainty: "fixture",
  sources: [FIXTURE_BASIS],
};

/**
 * The opportunist, patient.
 *
 * Identical in every parameter except `timeHorizon`. This is the controlled
 * experiment the hold/spend mechanic needs: comparing two actors that differ in
 * many ways cannot show that patience specifically is what changes the timing,
 * because any of the other differences could be doing the work.
 */
export const PATIENT_OPPORTUNIST: DoctrineProfile = {
  ...OPPORTUNIST,
  id: "fixture-patient-opportunist",
  label: "Patient opportunist (fixture)",
  summary:
    "The opportunist fixture with one parameter changed: a long time horizon.",
  doctrine: {
    ...OPPORTUNIST.doctrine,
    timeHorizon: {
      value: 0.9,
      confidence: "low",
      basis: FIXTURE_BASIS,
    },
  },
};

export const ALLY_BLOC: DoctrineProfile = {
  id: "fixture-ally-bloc",
  label: "Allied bloc (fixture)",
  kind: "state",
  summary:
    "Responds to attributable attacks on partners; weighs legitimacy heavily.",
  doctrine: vec({
    ownCostTolerance: 0.4,
    counterpartHarmRestraint: 0.8,
    attributionAversion: 0.3,
    proxyPreference: 0.1,
    escalationControlBelief: 0.5,
    timeHorizon: 0.6,
    decisionCentralization: 0.3,
    lossFrameRiskAcceptance: 0.3,
    legitimacyWeight: 0.9,
    signalingPreference: 0.7,
    reciprocityProportion: 0.55,
  }),
  rationalityPrecision: 6,
  redlines: [],
  uncertainty: "fixture",
  sources: [FIXTURE_BASIS],
};

export function fixtureLibrary(): DoctrineLibrary {
  return createLibrary(
    [PATIENT_STATE, OPPORTUNIST, PATIENT_OPPORTUNIST, ALLY_BLOC],
    { reviewedAt: "fixture", method: "fixture" },
  );
}

/** Actor casting used by most tests. Reachable rungs deliberately identical. */
export const ALL_RUNGS = [
  "presence_revealed",
  "operator_lockout",
  "supply_interruption",
  "interruption_without_alarm",
] as const;

export function actorSpec(profileId: string, overrides = {}) {
  return {
    profileId,
    initialHoldingsMean: 2,
    initialHoldingsSd: 1,
    acquisitionHazard: 0.012,
    holdingValueDecay: 0.001,
    payoffBase: 0.25,
    payoffDrift: 0.0035,
    earliestActivationTick: 10,
    reachableRungs: [...ALL_RUNGS],
    ...overrides,
  };
}
