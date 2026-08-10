/**
 * The escalation funnel: one tick of contact, assessment and escalation.
 *
 * Two claims in this file carry most of the model's weight, and both are stated
 * here rather than buried so a reviewer can attack them directly:
 *
 *  1. SELECTION HAPPENS TWICE. The adversary picks who to CONTACT from what a
 *     public profile shows — findability and implied access. It only learns
 *     vulnerability after someone answers, and that is what drives escalation.
 *     Collapsing the two would let it select on financial stress it could not
 *     yet have seen, and would overstate the yield of every campaign.
 *
 *  2. TAKING MONEY SUPPRESSES REPORTING. A target who has accepted payment is
 *     complicit, and the chance they walk into a security office collapses.
 *     If this is right, the window in which a workforce can defend itself by
 *     noticing closes before the damage is done — which is the finding the
 *     whole demo exists to test, so it is a swept parameter, not a constant.
 *
 * Neither is measured against real data. Both are ASSUMPTIONS with a stated
 * direction, and the demo cases sweep them.
 */

import type { Rng } from "../../rng.js";
import { STAGE_INDEX } from "./config.js";
import type { RecruitmentConfig } from "./config.js";
import { targetPriority } from "./workforce.js";
import type { Workforce } from "./workforce.js";

/** Mutable per-person funnel position. */
export interface TargetState {
  /** Index into FUNNEL_STAGES. 0 = untouched. */
  stage: number;
  /** True once the person has left the funnel for good. */
  closed: boolean;
  /** Set when they reported the approach — a defender-visible exit. */
  reported: boolean;
  /** Tick they were first contacted, or -1. */
  contactedAt: number;
  /**
   * Tick of the most recent approach — first contact, or an escalation ask.
   *
   * Reporting is a reaction to something new arriving, so the hazard is scoped
   * to a window after this rather than applied every tick forever.
   */
  lastApproachAt: number;
  /** Tick they reached tasking, or -1. */
  taskedAt: number;
  /** Cumulative payments received, in thousands. */
  paidK: number;
}

export interface FunnelOutcome {
  /** Approaches attempted this tick. */
  readonly contactsAttempted: number;
  /** Approaches that produced a reply — platform-visible as an accepted connection. */
  readonly accepted: number;
  /** Reports filed with security this tick. */
  readonly reported: number;
  /** Advances from one rung to the next this tick. */
  readonly advanced: number;
  /** People reaching tasking this tick. */
  readonly newlyTasked: number;
  /** Ids contacted this tick, for concentration measures. */
  readonly contactedIds: readonly number[];
  /** Payments disbursed this tick, in thousands. */
  readonly paidK: number;
  /** Defensive budget spent this tick. */
  readonly defenseCost: number;
}

/** Guard a colleague's report buys, and the ceiling word-of-mouth can reach. */
const AWARENESS_PER_REPORT = 0.015;
const MAX_ORG_AWARENESS = 0.35;
/** Awareness fades; last quarter's warning email is not this quarter's vigilance. */
const AWARENESS_DECAY = 0.97;

const EMPTY_OUTCOME: FunnelOutcome = {
  contactsAttempted: 0,
  accepted: 0,
  reported: 0,
  advanced: 0,
  newlyTasked: 0,
  contactedIds: [],
  paidK: 0,
  defenseCost: 0,
};

export function initialTargets(workforce: Workforce): TargetState[] {
  return workforce.people.map(() => ({
    stage: 0,
    closed: false,
    reported: false,
    contactedAt: -1,
    lastApproachAt: -1,
    taskedAt: -1,
    paidK: 0,
  }));
}

function campaignActive(config: RecruitmentConfig, tick: number): boolean {
  const c = config.campaign;
  return c !== null && tick >= c.startTick && tick <= c.endTick;
}

function defenseActive(config: RecruitmentConfig, tick: number): boolean {
  const d = config.defense;
  return d !== null && d.kind !== "none" && tick >= d.startTick;
}

/**
 * Contact order: priority-weighted, blended toward random by `selectivity`.
 *
 * Computed once at campaign start rather than per tick. An adversary works a
 * target list; re-ranking every tick would let it opportunistically re-sort
 * around outcomes it has not observed, which is a capability the public cases
 * give no reason to grant it.
 */
export function buildTargetOrder(
  workforce: Workforce,
  selectivity: number,
  rng: Rng,
): number[] {
  const scored = workforce.people.map((person) => ({
    id: person.id,
    score:
      selectivity * targetPriority(person) +
      (1 - selectivity) * rng.uniform(0, 1),
  }));
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  return scored.map((s) => s.id);
}

export interface StepInput {
  readonly workforce: Workforce;
  readonly targets: TargetState[];
  readonly order: readonly number[];
  /** How far down the target list the campaign has already worked. */
  readonly cursor: number;
  /** Per-organisation awareness, raised by reports inside that organisation. */
  readonly awareness: number[];
  readonly coveredByDefense: ReadonlySet<number>;
  readonly config: RecruitmentConfig;
  readonly tick: number;
  readonly rng: Rng;
}

/**
 * Advance the funnel one tick. Mutates `targets`, `awareness`; returns the cursor.
 */
export function stepFunnel(input: StepInput): {
  outcome: FunnelOutcome;
  cursor: number;
} {
  const { workforce, targets, order, awareness, config, tick, rng } = input;
  const campaign = config.campaign;

  const isCampaignActive = campaignActive(config, tick);
  const isDefenseActive = defenseActive(config, tick);
  const defense = config.defense;

  const takedownActive =
    isDefenseActive && defense!.kind === "platform_takedown";
  const trainingActive =
    isDefenseActive && defense!.kind === "awareness_training";
  const monitoringActive =
    isDefenseActive && defense!.kind === "targeted_monitoring";

  const defenseCost = isDefenseActive ? defense!.costPerTick : 0;

  for (let org = 0; org < awareness.length; org++) {
    awareness[org] = (awareness[org] ?? 0) * AWARENESS_DECAY;
  }

  if (!isCampaignActive || campaign === null) {
    return { outcome: { ...EMPTY_OUTCOME, defenseCost }, cursor: input.cursor };
  }

  // ── Contact ──
  // Takedown removes reach directly: fewer accounts in service means fewer
  // approaches, which is the only thing platform action can actually do.
  const reach = takedownActive ? 1 - defense!.intensity * defense!.coverage : 1;
  const budget = Math.round(
    campaign.accounts * campaign.contactsPerAccountPerTick * reach,
  );

  let cursor = input.cursor;
  const contactedIds: number[] = [];
  for (let n = 0; n < budget && cursor < order.length; n++) {
    const id = order[cursor++]!;
    const target = targets[id]!;
    if (target.closed || target.stage > 0) continue;
    target.stage = STAGE_INDEX.contacted;
    target.contactedAt = tick;
    target.lastApproachAt = tick;
    contactedIds.push(id);
  }

  // ── Assess, escalate, and exit ──
  let accepted = 0;
  let reported = 0;
  let advanced = 0;
  let newlyTasked = 0;
  let paidK = 0;

  // Indexed rather than for-of: a target's id IS its index, and the person
  // record is needed on every iteration.
  for (let id = 0; id < targets.length; id++) {
    const target = targets[id]!;
    if (target.closed || target.stage === 0) continue;

    const person = workforce.people[id]!;
    const covered = input.coveredByDefense.has(id);

    // ── Reporting hazard ──
    // Scoped to the window after a NEW approach. Outside it the message is old
    // news and nobody walks it down the hall; inside it, the chance is
    // suppressed once money has changed hands.
    const trained = trainingActive && covered ? defense!.intensity : 0;
    const monitored =
      monitoringActive && covered ? defense!.intensity * person.exposure : 0;
    const orgAwareness = awareness[person.organization] ?? 0;

    const inReportWindow =
      target.lastApproachAt >= 0 &&
      tick - target.lastApproachAt < config.reportWindowTicks;

    const complicity = target.paidK > 0 ? 1 - config.complicitySuppression : 1;
    const reportChance = inReportWindow
      ? (config.baseReportRate + trained * 0.25 + orgAwareness * 0.1) *
        complicity *
        // A more vulnerable person is likelier to keep it to themselves.
        (1 - 0.6 * person.vulnerability)
      : 0;

    if (reportChance > 0 && rng.bernoulli(Math.min(0.9, reportChance))) {
      target.closed = true;
      target.reported = true;
      reported++;
      // One report raises the guard of colleagues at the same employer — the
      // only way a workforce defends itself without being told to. Capped hard
      // and decayed in the caller: an uncapped cumulative bump saturates after
      // a few dozen reports and drives the reporting rate to absurdity, which
      // is exactly what the first version of this did.
      awareness[person.organization] = Math.min(
        MAX_ORG_AWARENESS,
        orgAwareness + AWARENESS_PER_REPORT,
      );
      continue;
    }

    // Monitoring catches escalation rather than contact: it removes a target
    // from the funnel once they are already being worked, and that removal is
    // visible to the defender as an investigation rather than as a report.
    if (monitored > 0 && target.stage >= STAGE_INDEX.cultivated) {
      if (rng.bernoulli(monitored * 0.15)) {
        target.closed = true;
        continue;
      }
    }

    // ── Advance one rung ──
    // Vulnerability is what the adversary learned by talking to them, so it
    // only enters here — never in the contact ordering.
    const payment = Math.min(1, campaign.paymentK / 10);
    const pressure =
      campaign.escalationRate *
      (0.35 + 0.65 * person.vulnerability) *
      (target.stage >= STAGE_INDEX.engaged ? 0.6 + 0.4 * payment : 1);

    if (rng.bernoulli(Math.min(0.95, Math.max(0, pressure)))) {
      if (target.stage === STAGE_INDEX.contacted) accepted++;
      target.stage++;
      advanced++;
      // Each rung is a fresh ask, so it reopens the reporting window.
      target.lastApproachAt = tick;
      if (target.stage >= STAGE_INDEX.cultivated) {
        target.paidK += campaign.paymentK;
        paidK += campaign.paymentK;
      }
      if (target.stage === STAGE_INDEX.tasked) {
        target.taskedAt = tick;
        target.closed = true;
        newlyTasked++;
      }
    } else if (
      // Most approaches simply go nowhere. Without an attrition path the funnel
      // converts everyone eventually and the forecast becomes trivial.
      target.stage === STAGE_INDEX.contacted &&
      rng.bernoulli(0.08)
    ) {
      target.closed = true;
    }
  }

  return {
    outcome: {
      contactsAttempted: contactedIds.length,
      accepted,
      reported,
      advanced,
      newlyTasked,
      contactedIds,
      paidK,
      defenseCost,
    },
    cursor,
  };
}

/** People reached by the defensive intervention. */
export function selectDefenseCoverage(
  workforce: Workforce,
  config: RecruitmentConfig,
  rng: Rng,
): Set<number> {
  const defense = config.defense;
  if (!defense || defense.kind === "none" || defense.coverage <= 0) {
    return new Set();
  }
  const count = Math.round(defense.coverage * workforce.people.length);
  // Targeted monitoring goes to the most exposed rather than a random slice —
  // that is what makes it "targeted", and it is why it costs less for the same
  // effect than blanket coverage would.
  if (defense.kind === "targeted_monitoring") {
    const byExposure = [...workforce.people]
      .sort((a, b) => b.exposure - a.exposure || a.id - b.id)
      .slice(0, count)
      .map((p) => p.id);
    return new Set(byExposure);
  }
  return new Set(
    rng.sample(
      workforce.people.map((p) => p.id),
      count,
    ),
  );
}
