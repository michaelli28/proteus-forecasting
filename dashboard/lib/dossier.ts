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
}

export interface DossierFile {
  generatedNote: string;
  reviewedAt: string;
  method: string;
  profiles: Dossier[];
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
