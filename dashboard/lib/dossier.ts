/**
 * The actor dossiers the engine publishes.
 *
 * Hand-mirrored from `engine/src/actors/doctrine.ts`, the same arrangement the
 * manifest and trace types already use — the dashboard cannot import from the
 * engine, so the contract is duplicated and kept honest by the load check below.
 *
 * SERVER ONLY. The file is a quarter of a megabyte of sourced prose; importing
 * it from a client component would ship all of it to the browser to render a
 * page that is mostly text the server could have rendered.
 */

import dossiers from "../data/actor-dossiers.json";

export type Confidence = "high" | "medium" | "low";

export const DOCTRINE_PARAMETERS = [
  "ownCostTolerance",
  "counterpartHarmRestraint",
  "attributionAversion",
  "proxyPreference",
  "escalationControlBelief",
  "timeHorizon",
  "decisionCentralization",
  "lossFrameRiskAcceptance",
  "legitimacyWeight",
  "signalingPreference",
  "reciprocityProportion",
] as const;
export type DoctrineParameter = (typeof DOCTRINE_PARAMETERS)[number];

/** Plain-language name for each parameter, and what a high value means. */
export const PARAMETER_COPY: Record<
  DoctrineParameter,
  { label: string; high: string }
> = {
  ownCostTolerance: {
    label: "What it will spend to win",
    high: "absorbs heavy losses of its own and keeps going",
  },
  counterpartHarmRestraint: {
    label: "Restraint toward the other side's civilians",
    high: "holds back from harming people who are not part of the fight",
  },
  attributionAversion: {
    label: "Wanting not to be caught",
    high: "will not act unless it can plausibly deny it",
  },
  proxyPreference: {
    label: "Acting through someone else",
    high: "works through surrogates rather than its own hands",
  },
  escalationControlBelief: {
    label: "Belief it can stop where it chooses",
    high: "confident it can push hard and still pull back",
  },
  timeHorizon: {
    label: "Patience",
    high: "will sit on an advantage for years before using it",
  },
  decisionCentralization: {
    label: "How few people decide",
    high: "a small closed circle decides, with nobody able to veto",
  },
  lossFrameRiskAcceptance: {
    label: "Recklessness when losing",
    high: "takes gambles it would refuse when it feels ahead",
  },
  legitimacyWeight: {
    label: "Caring what allies and courts think",
    high: "treats legal and alliance cost as a real constraint",
  },
  signalingPreference: {
    label: "Wanting the act seen",
    high: "the point is the message, so it wants an audience",
  },
  reciprocityProportion: {
    label: "How it hits back",
    high: "matches what was done to it, roughly in kind",
  },
};

export interface SourcedClaim {
  statement: string;
  basis: string;
  confidence: Confidence;
}

export interface DoctrineValue {
  value: number;
  confidence: Confidence;
  basis: string;
}

export interface Redline {
  id: string;
  statement: string;
  effect: "self_prohibits" | "compels_response";
  constraint?: { attribute: string; maxAcceptable: number };
  basis: string;
  confidence: Confidence;
}

export interface ProcedureStep {
  order: number;
  stage: string;
  office: string;
  gate: string;
  basis: string;
  confidence: Confidence;
}

export interface DecisionProcedure {
  authority: SourcedClaim;
  steps: ProcedureStep[];
  tempo: SourcedClaim;
  preconditions: SourcedClaim[];
  afterAction?: SourcedClaim;
}

export interface Worldview {
  declaredEnds: SourcedClaim[];
  selfImage: SourcedClaim;
  threatModel: SourcedClaim[];
  adversaryModel: SourcedClaim;
  declaredIdeology?: SourcedClaim;
}

export interface HistoricalDecision {
  date: string;
  episode: string;
  choice: string;
  bearsOn: DoctrineParameter[];
  lesson: string;
  basis: string;
  confidence: Confidence;
}

/** The one place this profile's researcher says it is least defensible. */
export interface WeakestClaim {
  /** The field it indicts, e.g. "worldview.adversaryModel". */
  section: string;
  finding: string;
}

export interface Dossier {
  id: string;
  label: string;
  kind: string;
  summary: string;
  doctrine: Record<DoctrineParameter, DoctrineValue>;
  rationalityPrecision: number;
  redlines: Redline[];
  uncertainty: string;
  sources: string[];
  declaredVsObserved?: string;
  procedure?: DecisionProcedure;
  worldview?: Worldview;
  history?: HistoricalDecision[];
  weakestClaim?: WeakestClaim;
}

/** Whether an enforceable commitment can bite in any shipped scenario. */
export interface ConstraintReach {
  profileId: string;
  redlineId: string;
  attribute: string;
  maxAcceptable: number;
  /** Packs holding at least one move this commitment would remove. */
  reachedIn: string[];
}

/** One heading from a profile's source list, with the citations under it. */
export interface SourceGroup {
  profileId: string;
  /** Empty for citations filed before any heading. */
  label: string;
  citations: string[];
}

export interface DossierFile {
  generatedNote: string;
  reviewedAt: string;
  method: string;
  profiles: Dossier[];
  constraintReach: ConstraintReach[];
  sourceGroups: SourceGroup[];
}

function load(): DossierFile {
  const data = dossiers as unknown as DossierFile;
  if (!data.profiles?.length) {
    throw new Error(
      "actor-dossiers.json is empty — run `npm run manifest` in engine/",
    );
  }
  return data;
}

export const DOSSIERS = load();

export function dossierFor(id: string): Dossier | undefined {
  return DOSSIERS.profiles.find((profile) => profile.id === id);
}

/**
 * What the model does with one commitment, stated exactly.
 *
 * Three states, not two. A commitment with no threshold changes nothing and
 * says so; one whose threshold some scenario reaches genuinely narrows the
 * choice set; and one whose threshold no shipped ladder gets near is enforced
 * and inert — which is true of every constrained redline in the library today.
 * Collapsing that third case into "enforced" is how a page tells a reader
 * something accurate and leaves them believing something false.
 */
export function redlineReach(
  dossier: Dossier,
  redlineId: string,
): ConstraintReach | undefined {
  return DOSSIERS.constraintReach.find(
    (reach) => reach.profileId === dossier.id && reach.redlineId === redlineId,
  );
}

/**
 * The citations, under the headings their author filed them beneath.
 *
 * The raw `sources` array mixes both, so counting it counted the headings —
 * every actor page overstated its own sourcing by three or four. The engine
 * publishes the repaired reading; this just selects one profile's.
 */
export function sourceGroupsFor(dossier: Dossier): SourceGroup[] {
  return DOSSIERS.sourceGroups.filter(
    (group) => group.profileId === dossier.id,
  );
}

export function citationCount(dossier: Dossier): number {
  return sourceGroupsFor(dossier).reduce(
    (total, group) => total + group.citations.length,
    0,
  );
}

/** Episodes offered as evidence for one parameter, newest first. */
export function episodesFor(
  dossier: Dossier,
  parameter: DoctrineParameter,
): HistoricalDecision[] {
  return [...(dossier.history ?? [])]
    .filter((episode) => episode.bearsOn.includes(parameter))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const KIND_LABEL: Record<string, string> = {
  state: "state",
  state_proxy: "state-directed proxy",
  criminal_enterprise: "criminal enterprise",
  ideological_nonstate: "ideological non-state group",
  activist_collective: "activist collective",
  insider: "insider",
};

/**
 * How much of this actor's dossier is actually written.
 *
 * Rendered on the index so a reader picking an actor knows, before they click,
 * whether they are about to read documented research or a profile that is still
 * eleven numbers. An absent section shown as absent is worth more than a page
 * that looks uniformly complete.
 */
export function dossierDepth(dossier: Dossier): {
  procedure: boolean;
  worldview: boolean;
  history: number;
  lowConfidence: number;
} {
  return {
    procedure: Boolean(dossier.procedure?.steps.length),
    worldview: Boolean(dossier.worldview),
    history: dossier.history?.length ?? 0,
    lowConfidence: DOCTRINE_PARAMETERS.filter(
      (parameter) => dossier.doctrine[parameter]?.confidence === "low",
    ).length,
  };
}
