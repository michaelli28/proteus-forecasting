/**
 * Closed-world targeted-recruitment configuration.
 *
 * Models the funnel documented in the public MSS/LinkedIn cases: an adversary
 * operating a small number of fake recruiter accounts against a professional
 * workforce, escalating responsive targets through paid "consulting" toward
 * tasking. See docs/CASE-MSS-LINKEDIN.md for the sourcing.
 *
 * SCOPE BOUNDARY, enforced structurally and for the same reason as the
 * influence-ops model: there is no text anywhere in this domain. No message
 * templates, no pretext copy, no profile text, no targeting rule that could be
 * pointed at a real person. A target is a tuple of opaque numeric attributes in
 * a synthetic workforce. The code therefore has no path that emits an approach,
 * because there is nothing in it to emit.
 *
 * The value here is entirely in the DEFENSIVE half: what a platform and a
 * security office can see while this is happening, and how much exposure
 * accumulates before they can see enough to act.
 */

/**
 * The escalation ladder, in order.
 *
 * Ordered because progress is monotonic — a target moves one rung at a time and
 * never skips. The public cases show the same shape: an approach, a reply, a
 * small paid report, then tasking for non-public material.
 */
export const FUNNEL_STAGES = [
  "untouched",
  "contacted",
  "engaged",
  "cultivated",
  "tasked",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Terminal states a target can leave the funnel through. */
export const EXIT_STATES = ["active", "declined", "reported"] as const;
export type ExitState = (typeof EXIT_STATES)[number];

export const STAGE_INDEX: Readonly<Record<FunnelStage, number>> = {
  untouched: 0,
  contacted: 1,
  engaged: 2,
  cultivated: 3,
  tasked: 4,
};

export const DEFENSE_KINDS = [
  "none",
  /** Workforce awareness: raises the chance an approach is recognised and reported. */
  "awareness_training",
  /** Platform action against recruiter accounts: removes reach. */
  "platform_takedown",
  /** Watching the most exposed roles: detects escalation, does not prevent contact. */
  "targeted_monitoring",
] as const;
export type DefenseKind = (typeof DEFENSE_KINDS)[number];

export interface WorkforceConfig {
  readonly people: number;
  /** Employing organisations. A legitimate recruiter spreads across many. */
  readonly organizations: number;
  /** Share holding a clearance — the population the adversary is paying for. */
  readonly clearedFraction: number;
  /**
   * Vulnerability: financial stress and job dissatisfaction, combined.
   *
   * The public cases turn on this and nothing else — $230,000 of debt in one,
   * "dissatisfaction with work or financial difficulties" as the stated
   * selection criterion in another. Mean and spread rather than a rate, because
   * what matters is the size of the tail.
   */
  readonly vulnerabilityMean: number;
  readonly vulnerabilitySd: number;
  /** How findable a person is: title, publication, conference presence. */
  readonly exposureMean: number;
  readonly exposureSd: number;
}

/** The adversary treatment. `null` is the control arm. */
export interface RecruitmentCampaignConfig {
  readonly startTick: number;
  readonly endTick: number;
  /** Fake recruiter accounts in service. */
  readonly accounts: number;
  /** Approaches attempted per account per tick. */
  readonly contactsPerAccountPerTick: number;
  /**
   * How well the adversary picks targets, in [0,1].
   *
   * 0 contacts uniformly at random; 1 contacts strictly the highest-value
   * cleared, most vulnerable, most exposed people first. High selectivity buys
   * a better yield and leaves a sharper employer-concentration signature — the
   * trade-off the detection half exists to find.
   */
  readonly selectivity: number;
  /** Per-tick pressure applied to advance a responsive target one rung. */
  readonly escalationRate: number;
  /**
   * Payment offered at the cultivated rung, in thousands.
   *
   * A ladder, not a lump: the documented payments start at $1–2k for an
   * unclassified "report" and only later reach five figures. Larger payments
   * convert better and are likelier to be noticed.
   */
  readonly paymentK: number;
  /** Recruiter account age in days at campaign start. Young accounts are a signal. */
  readonly accountAgeDays: number;
  /** Coordinated campaigns run their accounts on one cadence and burst harder. */
  readonly coordinated: boolean;
}

export interface RecruitmentDefenseConfig {
  readonly kind: DefenseKind;
  readonly startTick: number;
  /** Strength in [0,1]. */
  readonly intensity: number;
  /** Share of the workforce reached, in [0,1]. */
  readonly coverage: number;
  /** Cost per tick while active, in abstract budget units. */
  readonly costPerTick: number;
}

/**
 * Legitimate recruiter and networking traffic the platform also sees.
 *
 * Without this the adversary is the ONLY thing in the telemetry, a campaign
 * starting from a dead-silent baseline is trivially detectable, and detection
 * lag is always zero. A real platform is busy; the defender's problem is
 * separating one campaign from ordinary hiring, not noticing that anything
 * happened at all. Omitting it made every detection number meaningless.
 */
export interface BackgroundConfig {
  /** Mean legitimate connection requests per tick across the whole workforce. */
  readonly requestsPerTick: number;
  /** Tick-to-tick variability, as a fraction of the mean. */
  readonly volatility: number;
  /** Share of legitimate requests that get a reply. */
  readonly acceptRate: number;
  /** Mean age of legitimate sending accounts, in days. */
  readonly accountAgeDays: number;
  /** Legitimate approaches occasionally get reported too. */
  readonly reportRate: number;
}

export interface RecruitmentConfig {
  readonly ticks: number;
  readonly workforce: WorkforceConfig;
  readonly background: BackgroundConfig;
  /**
   * Chance a person reports a NEW approach, before training.
   *
   * A per-approach probability, not a per-tick one. Applied every tick to
   * everyone still in the funnel it compounds to near-certainty over a long
   * campaign — 2% a tick for 140 ticks is 94% — which is how the first version
   * of this model produced a 62% reporting rate.
   */
  readonly baseReportRate: number;
  /**
   * Ticks after an approach during which a person might still report it.
   *
   * People flag a strange message soon after it arrives or not at all. Outside
   * this window the approach is old news and the hazard is gone.
   */
  readonly reportWindowTicks: number;
  /**
   * How much taking money suppresses reporting.
   *
   * The single most consequential assumption in this model. Once a target has
   * accepted payment they are complicit, and the probability they walk into a
   * security office collapses. If it is right, the detection window closes
   * early and awareness training has to land BEFORE the first payment to matter
   * at all. Swept in the demo cases rather than asserted.
   */
  readonly complicitySuppression: number;
  readonly campaign: RecruitmentCampaignConfig | null;
  readonly defense: RecruitmentDefenseConfig | null;
}

/**
 * A mid-sized cleared workforce over ~26 weeks.
 *
 * Sized so the funnel produces double-digit tasking in the worst arms and
 * single digits in the best — enough separation for a forecast to be right or
 * wrong about, without saturating.
 */
export const DEFAULT_CONFIG: RecruitmentConfig = {
  ticks: 180,
  workforce: {
    people: 2000,
    organizations: 6,
    clearedFraction: 0.35,
    vulnerabilityMean: 0.3,
    vulnerabilitySd: 0.18,
    exposureMean: 0.45,
    exposureSd: 0.2,
  },
  background: {
    requestsPerTick: 26,
    volatility: 0.45,
    acceptRate: 0.22,
    accountAgeDays: 900,
    reportRate: 0.001,
  },
  baseReportRate: 0.02,
  reportWindowTicks: 4,
  complicitySuppression: 0.85,
  campaign: null,
  defense: null,
};

/**
 * Reference campaign, scaled from the public reporting.
 *
 * The German service described >10,000 contacts against one national workforce
 * over roughly nine months; the ratio of contacts to workforce here is set to
 * be of that order rather than to reproduce it, because the denominator in that
 * figure was never published. Treated as an ASSUMPTION throughout.
 */
export const REFERENCE_CAMPAIGN: RecruitmentCampaignConfig = {
  startTick: 20,
  endTick: 160,
  // 6 accounts × 1 approach × 140 ticks ≈ 840 approaches into a 2,000-person
  // workforce. Sized so a MAJORITY is never contacted: a campaign that reaches
  // everyone makes selectivity meaningless and the funnel's first stage stops
  // being a choice the adversary made.
  accounts: 6,
  contactsPerAccountPerTick: 1,
  selectivity: 0.7,
  escalationRate: 0.06,
  paymentK: 2,
  accountAgeDays: 45,
  coordinated: true,
};

export function validateConfig(config: RecruitmentConfig): void {
  const { workforce, campaign, defense } = config;

  if (config.ticks <= 0) throw new RangeError("ticks must be > 0");
  if (workforce.people <= 0) throw new RangeError("people must be > 0");
  if (workforce.organizations <= 0) {
    throw new RangeError("organizations must be > 0");
  }
  if (workforce.people < workforce.organizations) {
    throw new RangeError("people must be >= organizations");
  }
  if (workforce.clearedFraction < 0 || workforce.clearedFraction > 1) {
    throw new RangeError("clearedFraction must be in [0,1]");
  }
  if (config.baseReportRate < 0 || config.baseReportRate > 1) {
    throw new RangeError("baseReportRate must be in [0,1]");
  }
  if (config.complicitySuppression < 0 || config.complicitySuppression > 1) {
    throw new RangeError("complicitySuppression must be in [0,1]");
  }

  if (campaign) {
    if (campaign.endTick < campaign.startTick) {
      throw new RangeError("campaign.endTick precedes startTick");
    }
    if (campaign.accounts < 0) throw new RangeError("accounts must be >= 0");
    if (campaign.contactsPerAccountPerTick < 0) {
      throw new RangeError("contactsPerAccountPerTick must be >= 0");
    }
    if (campaign.selectivity < 0 || campaign.selectivity > 1) {
      throw new RangeError("selectivity must be in [0,1]");
    }
    if (campaign.escalationRate < 0 || campaign.escalationRate > 1) {
      throw new RangeError("escalationRate must be in [0,1]");
    }
    if (campaign.paymentK < 0) throw new RangeError("paymentK must be >= 0");
  }

  if (defense) {
    if (defense.intensity < 0 || defense.intensity > 1) {
      throw new RangeError("defense.intensity must be in [0,1]");
    }
    if (defense.coverage < 0 || defense.coverage > 1) {
      throw new RangeError("defense.coverage must be in [0,1]");
    }
  }
}
