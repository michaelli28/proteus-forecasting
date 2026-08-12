/**
 * Worked pack: a government benefits and identity service.
 *
 * Synthetic. A generic eligibility-verification and disbursement pipeline of the
 * kind most benefits programmes run; no real agency, programme, or system is
 * represented.
 *
 * This is the pack that answers "where are our defences weak" rather than "where
 * is our infrastructure weak", and it is included because the two questions have
 * different answers. The assets here are not physical. What an actor can take
 * from a government service is not power or throughput but ELIGIBILITY — the
 * ability to decide who is entitled to what — and the most damaging move against
 * it is usually not denial of service. It is quietly making the answers wrong,
 * because a service that pays the wrong people while appearing healthy is one
 * nobody switches off, and the harm accrues for as long as it goes unnoticed.
 *
 * The ladder below is ordered to reflect that: the top rung is not the outage.
 */

import type { SituationSpec } from "../spec.js";

export const BENEFITS_DELIVERY: SituationSpec = {
  id: "benefits-delivery",
  statement:
    "A government service that decides who qualifies for benefits and pays them, under attack for 240 days.",
  provenance:
    "Synthetic. Generic eligibility, disbursement, and identity-proofing functions. No real agency, programme, or vendor is represented.",
  ticks: 240,
  tickUnit: "day",

  // Beneficiaries depending on the service.
  servedUnits: 1250000,

  assets: [
    {
      id: "ELIGIBILITY-RULES",
      assetClass: "decision_logic",
      zone: "adjudication",
      effectKind: "determinations_incorrect",
      servedUnits: 1250000,
      // Low immediate loss, very long tail: wrong determinations are found late
      // and unwound slowly. This is the asset a direct-harm ranking underrates.
      parametric: {
        unitsDependent: 1250000,
        immediateLossShare: 0.03,
        bufferHours: 24,
        recoveryTailHours: 720,
        redundancy: 0.15,
      },
    },
    {
      id: "DISBURSEMENT-QUEUE",
      assetClass: "payment_pipeline",
      zone: "treasury_interface",
      effectKind: "payments_delayed",
      servedUnits: 1250000,
      parametric: {
        unitsDependent: 1250000,
        immediateLossShare: 0.6,
        bufferHours: 12,
        recoveryTailHours: 48,
        redundancy: 0.25,
      },
    },
    {
      id: "IDENTITY-PROOFING",
      assetClass: "identity_service",
      zone: "intake",
      effectKind: "enrolment_blocked",
      servedUnits: 180000,
      parametric: {
        unitsDependent: 180000,
        immediateLossShare: 0.75,
        bufferHours: 6,
        recoveryTailHours: 72,
        redundancy: 0.2,
      },
    },
    {
      id: "CASE-RECORDS",
      assetClass: "beneficiary_data",
      zone: "records",
      effectKind: "records_exposed",
      servedUnits: 1250000,
      // Exposure harms without interrupting anything, and cannot be undone.
      parametric: {
        unitsDependent: 1250000,
        immediateLossShare: 0.02,
        bufferHours: 0,
        recoveryTailHours: 2160,
        redundancy: 0,
      },
    },
    {
      id: "APPEALS-INTAKE",
      assetClass: "redress_channel",
      zone: "adjudication",
      effectKind: "redress_unavailable",
      servedUnits: 95000,
      // The route people use when something else has already gone wrong, which
      // is precisely why taking it out compounds rather than adds.
      parametric: {
        unitsDependent: 95000,
        immediateLossShare: 0.85,
        bufferHours: 24,
        recoveryTailHours: 168,
        redundancy: 0.1,
      },
    },
  ],

  ladder: [
    {
      id: "none",
      statement: "no action taken",
      attributability: 0,
      visibility: 0,
      civilianHarmShare: 0,
      durationHours: 0,
      reversible: true,
      legitimacyCost: 0,
    },
    {
      id: "presence_revealed",
      statement:
        "makes itself visible inside the system without disrupting anything",
      attributability: 0.35,
      visibility: 0.3,
      civilianHarmShare: 0,
      durationHours: 0,
      reversible: true,
      legitimacyCost: 0.1,
    },
    {
      id: "service_interruption",
      statement: "the service becomes unavailable and everyone can see it",
      attributability: 0.6,
      visibility: 0.95,
      civilianHarmShare: 0.8,
      durationHours: 24,
      reversible: true,
      legitimacyCost: 0.55,
    },
    {
      id: "bulk_exposure",
      statement: "people's personal benefit records are leaked",
      attributability: 0.5,
      visibility: 0.8,
      civilianHarmShare: 0.9,
      durationHours: 72,
      reversible: false,
      legitimacyCost: 0.75,
    },
    {
      id: "silent_determination_drift",
      statement:
        "decisions about who gets paid quietly go wrong while the service still reports itself healthy",
      // Low visibility is exactly what makes this the top rung: nobody stops it,
      // so duration is set by when someone finally notices rather than by
      // recovery. Same shape as alarm suppression in the water domain.
      attributability: 0.3,
      visibility: 0.15,
      civilianHarmShare: 0.7,
      durationHours: 336,
      reversible: false,
      legitimacyCost: 0.9,
    },
  ],

  defenses: [
    {
      kind: "segmentation",
      label: "service split into separate parts",
      statement:
        "Keeps the decision-making, payment, and records systems apart, so breaking into one does not open the next.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 22,
      coverage: 0.6,
      effects: [{ channel: "access_denial", strength: 0.9 }],
    },
    {
      kind: "privileged-access-review",
      label: "regular review of who has admin access",
      statement:
        "Re-checks who is allowed to change the rules on who qualifies, so old access stops working.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 10,
      coverage: 0.6,
      effects: [{ channel: "holding_attrition", strength: 0.85 }],
    },
    {
      kind: "determination-sampling",
      label: "independent spot-checks of decisions",
      statement:
        "A separate reviewer re-checks a random sample of decisions against the published rules, so wrong answers show up in days instead of months.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 16,
      coverage: 0.6,
      // The only control aimed at the quiet failure. Whether that beats generic
      // access controls is the comparison, not the assumption.
      effects: [
        { channel: "consequence_limiting", strength: 0.85 },
        { channel: "attribution_pressure", strength: 0.4 },
      ],
    },
    {
      kind: "anomaly-detection",
      label: "alerts for unusual payments",
      statement:
        "Makes it more likely the activity is noticed and traced back to them, which puts off attackers who need to be able to deny it.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 12,
      coverage: 0.6,
      effects: [
        { channel: "holding_attrition", strength: 0.5 },
        { channel: "attribution_pressure", strength: 0.9 },
      ],
    },
  ],

  oracle: {
    kind: "parametric",
    harmUnit: "beneficiary-hours of incorrect or absent service",
    uncertainty: 0.5,
  },

  backgroundAnomalyRate: 1.9,
};
