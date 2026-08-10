/**
 * Synthetic population and network construction.
 *
 * Clustered with sparse bridges, because that topology is what makes echo
 * chambers and cross-cluster cascades possible at all. A well-mixed random graph
 * washes out exactly the dynamics this simulation exists to study.
 */

import type { Rng } from "../../rng.js";
import { BELIEF_MIN, BELIEF_MAX } from "./config.js";
import type { InfluenceOpsConfig } from "./config.js";

export interface Agent {
  readonly id: number;
  readonly cluster: number;
  /** Belief position per narrative, each in [0,1]. */
  belief: number[];
  /** Bounded-confidence threshold: peers further than this do not persuade. */
  readonly epsilon: number;
  readonly susceptibility: number;
  /** Trust weight per media outlet, summing to 1 when outlets exist. */
  readonly mediaTrust: number[];
}

export interface MediaOutlet {
  readonly id: number;
  /** Editorial position per narrative. */
  readonly position: number[];
}

export interface Population {
  readonly agents: Agent[];
  /** Neighbour ids per agent. Undirected: both endpoints list each other. */
  readonly neighbors: number[][];
  readonly media: MediaOutlet[];
}

/** Decay length of media-outlet trust with belief distance. Smaller = more siloed. */
const MEDIA_HOMOPHILY_TAU = 0.25;

function clamp01(value: number): number {
  return Math.min(BELIEF_MAX, Math.max(BELIEF_MIN, value));
}

/**
 * Cluster-polarized initial beliefs: each cluster starts near its own centre.
 * Uniform-random initialization would make later polarization an artefact of the
 * dynamics rather than something the campaign has to work with.
 */
function initialBelief(
  cluster: number,
  clusters: number,
  narrative: number,
  rng: Rng,
): number {
  const centre = clusters === 1 ? 0.5 : cluster / (clusters - 1);
  // Only the first narrative is cluster-aligned; the rest start diffuse, so the
  // campaign's target axis is not the only thing moving.
  const base = narrative === 0 ? centre : 0.5;
  return clamp01(rng.normal(base, 0.12));
}

export function buildPopulation(
  config: InfluenceOpsConfig,
  rng: Rng,
): Population {
  const { population, network, media, narratives } = config;
  const agentRng = rng.fork("agents");
  const edgeRng = rng.fork("edges");
  const mediaRng = rng.fork("media");

  const outlets: MediaOutlet[] = Array.from(
    { length: media.outlets },
    (_, id) => ({
      id,
      // Spread across the axis rather than placed at random: a real media
      // ecosystem spans the spectrum, and random placement leaves some seeds
      // with no outlet near a whole cluster.
      position: Array.from({ length: narratives }, (_, n) =>
        clamp01(
          (media.outlets === 1 ? 0.5 : id / (media.outlets - 1)) +
            mediaRng.normal(0, n === 0 ? 0.05 : 0.2),
        ),
      ),
    }),
  );

  const agents: Agent[] = Array.from({ length: population.agents }, (_, id) => {
    const cluster = id % population.clusters;
    const belief = Array.from({ length: narratives }, (_, n) =>
      initialBelief(cluster, population.clusters, n, agentRng),
    );

    // Homophilous media diet: agents mostly consume outlets aligned with their
    // own position. Uniform trust across all outlets pulls every agent toward
    // the same global average, homogenising the population within a few ticks
    // and swamping any campaign — measured on the first build, then fixed.
    const rawTrust = outlets.map((outlet) =>
      Math.exp(
        -Math.abs(outlet.position[0]! - belief[0]!) / MEDIA_HOMOPHILY_TAU,
      ),
    );
    const trustTotal = rawTrust.reduce((sum, t) => sum + t, 0);
    return {
      id,
      cluster,
      belief,
      epsilon: Math.max(
        0.02,
        agentRng.normal(population.epsilonMean, population.epsilonSd),
      ),
      susceptibility: Math.min(
        1,
        Math.max(
          0,
          agentRng.normal(
            population.susceptibilityMean,
            population.susceptibilitySd,
          ),
        ),
      ),
      mediaTrust: trustTotal > 0 ? rawTrust.map((t) => t / trustTotal) : [],
    };
  });

  const neighbors: number[][] = agents.map(() => []);
  const seen = new Set<string>();

  function connect(a: number, b: number): void {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    neighbors[a]!.push(b);
    neighbors[b]!.push(a);
  }

  // Intra-cluster: dense and homophilous.
  const byCluster: number[][] = Array.from(
    { length: population.clusters },
    () => [],
  );
  for (const agent of agents) byCluster[agent.cluster]!.push(agent.id);

  for (const members of byCluster) {
    if (members.length < 2) continue;
    const targetEdges = Math.floor(
      (members.length * network.intraClusterDegree) / 2,
    );
    for (let e = 0; e < targetEdges; e++) {
      connect(
        members[edgeRng.int(members.length)]!,
        members[edgeRng.int(members.length)]!,
      );
    }
  }

  // Inter-cluster bridges: few, and the reason cascades can escape a cluster.
  for (let e = 0; e < network.interClusterEdges; e++) {
    const a = edgeRng.int(agents.length);
    const b = edgeRng.int(agents.length);
    if (agents[a]!.cluster !== agents[b]!.cluster) connect(a, b);
  }

  // Stable neighbour order keeps the belief update deterministic.
  for (const list of neighbors) list.sort((x, y) => x - y);

  return { agents, neighbors, media: outlets };
}

/** Mean degree, for asserting the graph is connected enough to transmit. */
export function meanDegree(population: Population): number {
  if (population.neighbors.length === 0) return 0;
  const total = population.neighbors.reduce(
    (sum, list) => sum + list.length,
    0,
  );
  return total / population.neighbors.length;
}

/** Count of edges whose endpoints sit in different clusters. */
export function bridgeCount(population: Population): number {
  let count = 0;
  for (let a = 0; a < population.neighbors.length; a++) {
    for (const b of population.neighbors[a]!) {
      if (
        b > a &&
        population.agents[a]!.cluster !== population.agents[b]!.cluster
      )
        count++;
    }
  }
  return count;
}

export { clamp01 };
