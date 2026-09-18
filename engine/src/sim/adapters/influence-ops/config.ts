/**
 * Closed-world influence-operations configuration.
 *
 * SCOPE BOUNDARY, enforced structurally: narratives are opaque identifiers with
 * numeric positions. There is no text field anywhere in this model, so no code
 * path can emit persuasive content — there is no content in it to emit. The
 * population is synthetic; nothing here touches a real platform or person.
 */

/** Belief axis bounds. Positions and beliefs are both in this range. */
export const BELIEF_MIN = 0;
export const BELIEF_MAX = 1;

/** Belief above this counts as having adopted a narrative, for cascade counting. */
export const ADOPTION_THRESHOLD = 0.6;

export const DEFENSE_KINDS = [
  "none",
  "counter_messaging",
  "friction",
  "platform_intervention",
] as const;
export type DefenseKind = (typeof DEFENSE_KINDS)[number];

export interface PopulationConfig {
  readonly agents: number;
  readonly clusters: number;
  /** Mean bounded-confidence threshold: how different a peer can be and still persuade. */
  readonly epsilonMean: number;
  readonly epsilonSd: number;
  readonly susceptibilityMean: number;
  readonly susceptibilitySd: number;
}

export interface NetworkConfig {
  /** Mean intra-cluster degree — the dense, homophilous part of the graph. */
  readonly intraClusterDegree: number;
  /** Count of cross-cluster bridges. Low values produce echo chambers. */
  readonly interClusterEdges: number;
}

export interface MediaConfig {
  readonly outlets: number;
  /** Weight of media relative to peers in the belief update. */
  readonly weight: number;
}

/** The adversary treatment. `null` is the control arm. */
export interface CampaignConfig {
  readonly narrativeId: number;
  readonly startTick: number;
  readonly endTick: number;
  /** Seed nodes receiving direct injection — the adversary's assets. */
  readonly injectionNodes: number;
  /** Belief position the campaign pushes toward, in [0,1]. */
  readonly targetPosition: number;
  /** How fast injected assets converge on the target position, per tick. */
  readonly injectionRate: number;
  /**
   * Multiplier on how strongly injected assets pull their neighbours.
   *
   * This models algorithmic boost — the content reaches further and lands
   * harder. It deliberately does NOT move the injector's own belief faster:
   * doing that makes assets outrun their neighbours' confidence bound and get
   * filtered out, so the campaign silently accomplishes nothing.
   */
  readonly amplification: number;
  /** Coordinated injection is burstier and leaves a stronger detection signature. */
  readonly coordinated: boolean;
}

/** The defensive arm. Each carries a cost so interventions can be compared. */
export interface DefenseConfig {
  readonly kind: DefenseKind;
  readonly startTick: number;
  /** Strength in [0,1]. */
  readonly intensity: number;
  /** Cost per tick while active, in abstract budget units. */
  readonly costPerTick: number;
  /** Share of the population reached, in [0,1]. */
  readonly coverage: number;
}

export interface InfluenceOpsConfig {
  readonly ticks: number;
  readonly narratives: number;
  readonly population: PopulationConfig;
  readonly network: NetworkConfig;
  readonly media: MediaConfig;
  /** Peer influence rate per tick. */
  readonly influenceRate: number;
  readonly campaign: CampaignConfig | null;
  readonly defense: DefenseConfig | null;
  /**
   * Belief at which an agent counts as adopting; ADOPTION_THRESHOLD when
   * absent. It only changes what is counted, never how beliefs move, so
   * telemetry cannot see it. Left absent by default so existing run
   * identities hash exactly as before.
   */
  readonly adoptionThreshold?: number;
}

export const DEFAULT_CONFIG: InfluenceOpsConfig = {
  ticks: 120,
  narratives: 3,
  population: {
    agents: 400,
    clusters: 4,
    epsilonMean: 0.25,
    epsilonSd: 0.08,
    susceptibilityMean: 0.5,
    susceptibilitySd: 0.15,
  },
  network: { intraClusterDegree: 8, interClusterEdges: 12 },
  media: { outlets: 3, weight: 0.05 },
  influenceRate: 0.12,
  campaign: null,
  defense: null,
};

/**
 * Reference campaign used by tests and benchmarks.
 *
 * Chosen from a measured parameter sweep to sit well short of saturation: it
 * moves mean belief by roughly +0.05 and adoption by +0.08, leaving real
 * uncertainty for a forecaster to be right or wrong about. A saturated campaign
 * would make every forecast trivially correct.
 */
export const REFERENCE_CAMPAIGN: CampaignConfig = {
  narrativeId: 0,
  startTick: 20,
  endTick: 110,
  injectionNodes: 80,
  targetPosition: 0.85,
  injectionRate: 0.3,
  amplification: 3,
  coordinated: true,
};

/** Rejects configurations that would silently produce a degenerate world. */
export function validateConfig(config: InfluenceOpsConfig): void {
  const { population, network, media, campaign } = config;

  if (config.ticks <= 0) throw new RangeError("ticks must be > 0");
  if (config.narratives <= 0) throw new RangeError("narratives must be > 0");
  if (population.agents < population.clusters) {
    throw new RangeError("agents must be >= clusters");
  }
  if (population.clusters <= 0) throw new RangeError("clusters must be > 0");
  if (network.intraClusterDegree < 1)
    throw new RangeError("intraClusterDegree must be >= 1");
  if (media.outlets < 0) throw new RangeError("outlets must be >= 0");
  const threshold = config.adoptionThreshold;
  if (threshold !== undefined && !(threshold > 0 && threshold < 1)) {
    throw new RangeError(`adoptionThreshold must be in (0,1): ${threshold}`);
  }

  if (campaign) {
    if (campaign.narrativeId < 0 || campaign.narrativeId >= config.narratives) {
      throw new RangeError(
        `campaign.narrativeId out of range: ${campaign.narrativeId}`,
      );
    }
    if (campaign.endTick < campaign.startTick) {
      throw new RangeError("campaign.endTick precedes startTick");
    }
    if (campaign.injectionNodes > population.agents) {
      throw new RangeError("injectionNodes exceeds population");
    }
    if (campaign.targetPosition < 0 || campaign.targetPosition > 1) {
      throw new RangeError("campaign.targetPosition must be in [0,1]");
    }
    if (campaign.amplification < 0)
      throw new RangeError("amplification must be >= 0");
  }
}
