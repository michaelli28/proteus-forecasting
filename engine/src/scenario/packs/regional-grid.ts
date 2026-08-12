/**
 * Worked pack: a regional electricity distribution system under pressure.
 *
 * Synthetic throughout. The asset ids are opaque scenario-local labels, the
 * topology is a generic radial-with-tie arrangement of the kind any distribution
 * textbook describes, and no element corresponds to a real utility, substation,
 * or control centre. That is not a disclaimer bolted on — it is what the spec
 * format permits, because there is no field in it for a real identifier.
 *
 * The pack exists to demonstrate that the engine generalizes. The water domain
 * had an EPANET twin that priced consequences from physics; this one does not,
 * so its oracle is PARAMETRIC and every number it produces is labelled a
 * structured guess. An evaluator who wants grid consequences with the same
 * standing as the water numbers supplies a power-flow solver behind the same
 * table interface, and nothing else changes.
 */

import type { SituationSpec } from "../spec.js";

export const REGIONAL_GRID: SituationSpec = {
  id: "regional-grid",
  statement:
    "A regional electricity distribution system serving a mixed urban and rural area, contested over a 180-day window.",
  provenance:
    "Synthetic. Generic radial distribution topology with a tie point; no real utility, substation, or control system is represented.",
  ticks: 180,
  tickUnit: "day",

  // Distinct customers, not the sum of the asset rows below — the urban
  // substations, the tie, and the control system all serve the same people.
  servedUnits: 76400,

  assets: [
    {
      id: "SUB-URBAN-A",
      assetClass: "distribution_substation",
      zone: "urban-core",
      effectKind: "supply_interrupted",
      servedUnits: 42000,
      parametric: {
        unitsDependent: 42000,
        immediateLossShare: 0.85,
        bufferHours: 0,
        recoveryTailHours: 4,
        redundancy: 0.35,
      },
    },
    {
      id: "SUB-URBAN-B",
      assetClass: "distribution_substation",
      zone: "urban-core",
      effectKind: "supply_interrupted",
      servedUnits: 28000,
      parametric: {
        unitsDependent: 28000,
        immediateLossShare: 0.8,
        bufferHours: 0,
        recoveryTailHours: 4,
        redundancy: 0.45,
      },
    },
    {
      id: "TIE-REGIONAL",
      assetClass: "transfer_point",
      zone: "interconnect",
      effectKind: "transfer_blocked",
      servedUnits: 70000,
      // The tie is what makes the substations survivable. Losing it does not
      // black anyone out on its own, which is exactly why it is easy to
      // under-rate and worth modelling separately.
      parametric: {
        unitsDependent: 70000,
        immediateLossShare: 0.12,
        bufferHours: 2,
        recoveryTailHours: 8,
        redundancy: 0.1,
      },
    },
    {
      id: "FEEDER-RURAL-N",
      assetClass: "feeder",
      zone: "rural-north",
      effectKind: "supply_interrupted",
      servedUnits: 6400,
      parametric: {
        unitsDependent: 6400,
        immediateLossShare: 0.95,
        bufferHours: 0,
        recoveryTailHours: 12,
        redundancy: 0.05,
      },
    },
    {
      id: "SCADA-HIST",
      assetClass: "operations_data",
      zone: "control",
      effectKind: "visibility_degraded",
      servedUnits: 70000,
      // Degrading the operator's own picture harms nobody directly and makes
      // every other event longer. A ranking that only counts direct harm will
      // score this asset near zero, which is the mistake worth surfacing.
      parametric: {
        unitsDependent: 70000,
        immediateLossShare: 0.04,
        bufferHours: 1,
        recoveryTailHours: 24,
        redundancy: 0.2,
      },
    },
  ],

  /**
   * The ladder, ascending.
   *
   * Note the shape the water domain also showed: the top rung's physical effect
   * is no worse than the one below it. What makes it worse is that nobody is
   * told, so duration is set by when someone notices rather than by when an
   * alarm fires. That is a consequence property, not a technique.
   */
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
      statement: "presence made evident without operational effect",
      attributability: 0.35,
      visibility: 0.3,
      civilianHarmShare: 0,
      durationHours: 0,
      reversible: true,
      legitimacyCost: 0.1,
    },
    {
      id: "operator_lockout",
      statement: "operators lose remote control while automation continues",
      attributability: 0.5,
      visibility: 0.45,
      civilianHarmShare: 0.3,
      durationHours: 6,
      reversible: true,
      legitimacyCost: 0.35,
    },
    {
      id: "supply_interruption",
      statement: "supply interrupted to served customers",
      attributability: 0.65,
      visibility: 0.9,
      civilianHarmShare: 0.75,
      durationHours: 12,
      reversible: true,
      legitimacyCost: 0.6,
    },
    {
      id: "interruption_without_alarm",
      statement:
        "supply interrupted while operator alarms report normal conditions",
      attributability: 0.7,
      visibility: 0.85,
      civilianHarmShare: 0.85,
      durationHours: 48,
      reversible: false,
      legitimacyCost: 0.85,
    },
  ],

  /**
   * Candidate mitigations, all at the same coverage.
   *
   * Coverage is held equal across arms on purpose: varying coverage and kind
   * together makes every ROI difference uninterpretable, because a cheap control
   * at 90% and an expensive one at 30% differ in two ways at once.
   */
  defenses: [
    {
      kind: "segmentation",
      label: "control-network segmentation",
      statement:
        "Separates the operations network so reaching one asset does not reach the next.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 18,
      coverage: 0.6,
      effects: [{ channel: "access_denial", strength: 0.9 }],
    },
    {
      kind: "credential-rotation",
      label: "credential rotation",
      statement:
        "Retires standing access on a schedule, so access held quietly goes stale.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 8,
      coverage: 0.6,
      effects: [{ channel: "holding_attrition", strength: 0.85 }],
    },
    {
      kind: "anomaly-detection",
      label: "operations anomaly detection",
      statement:
        "Raises the chance activity is noticed and traced, which deters actors that need deniability.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 12,
      coverage: 0.6,
      effects: [
        { channel: "holding_attrition", strength: 0.5 },
        { channel: "attribution_pressure", strength: 0.9 },
      ],
    },
    {
      kind: "manual-fallback",
      label: "staffed manual operation",
      statement:
        "Crews run the system by hand, ending the event without removing the intruder.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 6,
      coverage: 0.6,
      effects: [{ channel: "consequence_limiting", strength: 0.8 }],
    },
  ],

  oracle: {
    kind: "parametric",
    harmUnit: "customer-hours without supply",
    uncertainty: 0.5,
  },

  backgroundAnomalyRate: 1.6,
};
