/**
 * Worked pack: a container terminal's throughput under pressure.
 *
 * Synthetic. Berths, cranes, and the gate system are generic terminal functions;
 * no real port, operator, or system is represented.
 *
 * This pack exists to test a specific claim about the engine: that changing the
 * DOMAIN does not require changing the model. The interesting difference from
 * the grid is not the vocabulary — it is that harm here is economic and
 * accumulates through a queue rather than landing instantly on a population.
 * A berth taken out for six hours costs little; the same berth for four days
 * costs disproportionately more, because the backlog outlives the outage. That
 * is expressed entirely through `recoveryTailHours` and buffers, with no new
 * dynamics code, which is the thing being demonstrated.
 */

import type { SituationSpec } from "../spec.js";

export const PORT_THROUGHPUT: SituationSpec = {
  id: "port-throughput",
  statement:
    "A container terminal's ability to move boxes, under attack for 120 days.",
  provenance:
    "Synthetic. Generic terminal functions — berths, yard cranes, gate and manifest systems. No real port or operator is represented.",
  ticks: 120,
  tickUnit: "day",

  // Containers per day of nominal throughput. The unit of the whole scenario.
  servedUnits: 9600,

  assets: [
    {
      id: "BERTH-DEEP-1",
      assetClass: "berth",
      zone: "waterside",
      effectKind: "berth_unavailable",
      servedUnits: 4200,
      parametric: {
        unitsDependent: 4200,
        immediateLossShare: 0.9,
        bufferHours: 0,
        // The backlog is the real cost, and it outlives the outage.
        recoveryTailHours: 36,
        redundancy: 0.3,
      },
    },
    {
      id: "BERTH-DEEP-2",
      assetClass: "berth",
      zone: "waterside",
      effectKind: "berth_unavailable",
      servedUnits: 3100,
      parametric: {
        unitsDependent: 3100,
        immediateLossShare: 0.9,
        bufferHours: 0,
        recoveryTailHours: 30,
        redundancy: 0.4,
      },
    },
    {
      id: "YARD-CRANE-GROUP",
      assetClass: "handling_equipment",
      zone: "yard",
      effectKind: "handling_degraded",
      servedUnits: 9600,
      parametric: {
        unitsDependent: 9600,
        immediateLossShare: 0.45,
        bufferHours: 4,
        recoveryTailHours: 18,
        redundancy: 0.35,
      },
    },
    {
      id: "GATE-SYSTEM",
      assetClass: "access_control",
      zone: "landside",
      effectKind: "gate_throughput_lost",
      servedUnits: 9600,
      parametric: {
        unitsDependent: 9600,
        immediateLossShare: 0.7,
        bufferHours: 2,
        recoveryTailHours: 12,
        redundancy: 0.15,
      },
    },
    {
      id: "MANIFEST-INDEX",
      assetClass: "operations_data",
      zone: "control",
      effectKind: "provenance_uncertain",
      servedUnits: 9600,
      // Corrupting what is in which box halts almost nothing immediately and
      // costs enormously to unwind. The recovery tail carries the whole harm,
      // which is the case a direct-effect model scores at nearly zero.
      parametric: {
        unitsDependent: 9600,
        immediateLossShare: 0.08,
        bufferHours: 6,
        recoveryTailHours: 240,
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
      attributability: 0.3,
      visibility: 0.25,
      civilianHarmShare: 0,
      durationHours: 0,
      reversible: true,
      legitimacyCost: 0.08,
    },
    {
      id: "handling_slowdown",
      statement:
        "cargo handling slows down, with no single system actually failing",
      attributability: 0.25,
      visibility: 0.3,
      civilianHarmShare: 0.1,
      durationHours: 12,
      reversible: true,
      legitimacyCost: 0.2,
    },
    {
      id: "system_denial",
      statement: "one of the systems the terminal runs on goes down",
      attributability: 0.6,
      visibility: 0.7,
      civilianHarmShare: 0.25,
      durationHours: 24,
      reversible: true,
      legitimacyCost: 0.5,
    },
    {
      id: "records_corruption",
      statement:
        "the terminal's records can no longer be trusted, so nobody can establish what is in each box or where it came from",
      attributability: 0.45,
      visibility: 0.5,
      civilianHarmShare: 0.35,
      durationHours: 72,
      // The one irreversible rung: you cannot un-doubt a manifest.
      reversible: false,
      legitimacyCost: 0.7,
    },
  ],

  defenses: [
    {
      kind: "segmentation",
      label: "operations network kept in separate zones",
      statement:
        "Splits the terminal's systems apart, so breaking into one does not open the next.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 20,
      coverage: 0.6,
      effects: [{ channel: "access_denial", strength: 0.9 }],
    },
    {
      kind: "credential-rotation",
      label: "regular password and key changes",
      statement:
        "Changes passwords and keys on a schedule, so access an attacker is quietly sitting on stops working.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 9,
      coverage: 0.6,
      effects: [{ channel: "holding_attrition", strength: 0.85 }],
    },
    {
      kind: "manifest-attestation",
      label: "separate backup record of every box",
      statement:
        "Keeps a second, separately-held record of what is in each box, so ruined records can be rebuilt from it instead of every container being reopened.",
      startTick: 0,
      intensity: 0.6,
      costPerTick: 14,
      coverage: 0.6,
      // Aimed squarely at the recovery tail, which is where this domain's harm
      // actually lives. Whether that beats generic controls is the question the
      // paired-arm comparison exists to answer rather than assume.
      effects: [{ channel: "consequence_limiting", strength: 0.9 }],
    },
    {
      kind: "anomaly-detection",
      label: "alerts for unusual activity",
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
    harmUnit: "container-hours of delayed throughput",
    uncertainty: 0.5,
  },

  backgroundAnomalyRate: 2.1,
};
