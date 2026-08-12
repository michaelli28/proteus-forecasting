/**
 * Actor doctrine — the decision propensities that make two adversaries facing an
 * identical opportunity choose differently.
 *
 * WHY THIS EXISTS. The cyber-water adversary had two knobs, riskTolerance and
 * escalationPropensity, swept over a grid. That is enough to explore an attack
 * surface and not enough to answer the question a government evaluator actually
 * asks: *which* adversary, and what would change its mind. Two actors with the
 * same capability and the same target choose differently because they weigh
 * exposure, allied opinion, own losses, and time differently — and those weights
 * are documented in open doctrine and the peer-reviewed strategic-culture
 * literature, not inferred from vibes.
 *
 * WHAT THIS IS NOT, structurally. A parameter here describes a REGIME, an
 * INSTITUTION, or a DOCTRINE. There is no field for an ethnicity, a religion, or
 * a population's character, so no code path can emit one — the same structural
 * refusal the cyber-water config uses to guarantee it cannot emit an attack
 * procedure. Claims of the form "culture X does not value life" are not modelled
 * here because they are not analysis; the modellable thing is an institution's
 * demonstrated tolerance for cost, and that is `ownCostTolerance` below.
 *
 * Every value carries the source that justifies it. A number an evaluator cannot
 * trace to a document is a number they are right to reject.
 */

/**
 * Propensities on a common [0,1] scale, so a scenario can compare actors without
 * each parameter carrying its own private units.
 */
export const DOCTRINE_PARAMETERS = [
  /** Willingness to absorb own losses — personnel, materiel, economic pain, sanctions — to reach an objective. */
  "ownCostTolerance",
  /** Restraint regarding harm to the other side's noncombatants, as evidenced by declaratory policy, targeting practice, and observed conduct. */
  "counterpartHarmRestraint",
  /** Preference that its hand not be provably visible. */
  "attributionAversion",
  /** Propensity to act through surrogates rather than organic forces. */
  "proxyPreference",
  /** Confidence that it can escalate and then stop where it chooses. */
  "escalationControlBelief",
  /** Patience. High actors hold an advantage unspent for years. */
  "timeHorizon",
  /** Concentration of go/no-go authority. High means a small circle: faster, fewer vetoes, higher variance. */
  "decisionCentralization",
  /** Prospect-theory shift: additional risk accepted when the actor perceives itself already losing. */
  "lossFrameRiskAcceptance",
  /** Weight on law, alliance approval, and reputational legitimacy as a real constraint. */
  "legitimacyWeight",
  /** Whether the actor wants the act seen. Coercion needs an audience; sabotage does not. */
  "signalingPreference",
  /** Retaliation style. 0.5 is roughly tit-for-tat, above that deliberately disproportionate. */
  "reciprocityProportion",
] as const;

export type DoctrineParameter = (typeof DOCTRINE_PARAMETERS)[number];

/** How much weight the cited material actually carries. */
export const EVIDENCE_CONFIDENCE = ["high", "medium", "low"] as const;
export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE)[number];

/**
 * One parameter, with the reason it holds that value.
 *
 * `basis` is not decoration. It is the field an evaluator reads first, and a
 * profile whose bases are vague is a profile whose numbers are guesses wearing a
 * decimal point.
 */
export interface DoctrineValue {
  readonly value: number;
  readonly confidence: EvidenceConfidence;
  /** The doctrine document, assessment, or literature that supports this value. */
  readonly basis: string;
}

export type DoctrineVector = Readonly<Record<DoctrineParameter, DoctrineValue>>;

/**
 * A commitment the actor does not price.
 *
 * Redlines are the reason a purely economic model mispredicts: raising the cost
 * of crossing one does not deter, because the actor is not running the trade. In
 * the kernel they filter the choice set before valuation rather than adding a
 * penalty term, which is the whole behavioural difference.
 */
export interface Redline {
  readonly id: string;
  /** What the actor treats as non-negotiable, in institutional terms. */
  readonly statement: string;
  /** What the model does when a move touches it. */
  readonly effect: RedlineEffect;
  /**
   * The mechanical form of the commitment.
   *
   * Without this a redline is prose the kernel cannot act on, and a constraint
   * that changes no behaviour is documentation pretending to be a model. The
   * attributes it can bound are deliberately the domain-free ones every
   * escalation ladder already declares, so a redline written once applies in
   * every scenario rather than being rewritten per domain.
   */
  readonly constraint?: RedlineConstraint;
  readonly basis: string;
  readonly confidence: EvidenceConfidence;
}

/** Move attributes any scenario's ladder exposes, so a bound on them is portable. */
export const CONSTRAINED_ATTRIBUTES = [
  "civilianHarmShare",
  "legitimacyCost",
  "visibility",
  "attributability",
] as const;
export type ConstrainedAttribute = (typeof CONSTRAINED_ATTRIBUTES)[number];

export interface RedlineConstraint {
  readonly attribute: ConstrainedAttribute;
  /** Moves whose attribute exceeds this are removed from the choice set. */
  readonly maxAcceptable: number;
}

export const REDLINE_EFFECTS = [
  /** The actor will not choose moves that violate its own commitment. Removes them from the choice set. */
  "self_prohibits",
  /** A move against this by someone else triggers response regardless of cost. Drives retaliation, not selection. */
  "compels_response",
] as const;
export type RedlineEffect = (typeof REDLINE_EFFECTS)[number];

export const ACTOR_KINDS = [
  "state",
  "state_proxy",
  "criminal_enterprise",
  "ideological_nonstate",
  "activist_collective",
  "insider",
] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

// ─── the dossier: who this institution is, beyond its eleven numbers ───

/**
 * One claim with the document behind it.
 *
 * The whole dossier below is built from this single shape rather than from bare
 * strings, because the failure mode it prevents is the one that would discredit
 * the project fastest: rich narrative prose about an adversary that no evaluator
 * can trace to a source. A parameter already cannot be unsourced; after this,
 * neither can a sentence about how an actor thinks.
 */
export interface SourcedClaim {
  readonly statement: string;
  readonly basis: string;
  readonly confidence: EvidenceConfidence;
}

/**
 * The single least defensible thing in this profile, named by its researcher.
 *
 * Separate from `uncertainty`, which surveys everywhere the literature is thin.
 * This names ONE place and argues why it is the worst — and a reviewer with an
 * hour reads this and nothing else. It is kept as two fields rather than prose
 * so the section it indicts can be shown beside the section itself instead of
 * buried in a paragraph at the bottom of the page.
 *
 * `section` is a path into this profile — "worldview.adversaryModel",
 * "procedure.steps[5]" — because a weakness that does not say what it is a
 * weakness IN is a disclaimer, and disclaimers are how a document looks candid
 * without telling anyone anything.
 */
export interface WeakestClaim {
  /** Dotted path to the field this indicts, e.g. "worldview.adversaryModel". */
  readonly section: string;
  /** Why that field is the least defensible part of the profile. */
  readonly finding: string;
}

/**
 * One gate a proposal passes through before anything executes.
 *
 * `office` names an institutional role — a directorate, a legal review, a
 * council seat. It never names an individual: a model that hangs its prediction
 * on a named person is describing a biography, and it stops being true the day
 * that person is replaced.
 */
export interface ProcedureStep {
  readonly order: number;
  /** What happens at this stage, e.g. "target development", "legal review". */
  readonly stage: string;
  /** The institutional role that owns the stage. */
  readonly office: string;
  /** What this stage can stop, and on what grounds. */
  readonly gate: string;
  readonly basis: string;
  readonly confidence: EvidenceConfidence;
}

/**
 * How a decision actually gets made inside the institution.
 *
 * `decisionCentralization` compresses all of this into one number the kernel can
 * multiply. That number is what the model runs on; this is what makes it
 * arguable. An evaluator who disagrees with 0.85 needs to see the authority
 * chain it was read off, not just the decimal.
 */
export interface DecisionProcedure {
  /** Where go/no-go authority sits, in institutional terms. */
  readonly authority: SourcedClaim;
  /** The path from proposal to execution, in order. */
  readonly steps: readonly ProcedureStep[];
  /** How long the cycle runs, and what compresses or stalls it. */
  readonly tempo: SourcedClaim;
  /** Conditions the institution requires before it will authorise action. */
  readonly preconditions: readonly SourcedClaim[];
  /** How the institution learns from a failure — or demonstrably does not. */
  readonly afterAction?: SourcedClaim;
}

/**
 * The institution's declared ends and its picture of the world.
 *
 * DELIBERATELY ABSENT, and this is the same structural refusal the header
 * describes: there is no field for a religion, an ethnicity, or the character of
 * a population, so no dossier can render one and no prompt built from a dossier
 * can smuggle one in. `declaredIdeology` is the narrow, checkable thing an
 * institution publishes about itself — a party programme, a founding charter, a
 * declared strategic concept — and it is a property of the ORGANISATION, sourced
 * to a document that organisation issued.
 */
export interface Worldview {
  /** What the institution states it is trying to achieve. */
  readonly declaredEnds: readonly SourcedClaim[];
  /** How it describes its own role and standing. */
  readonly selfImage: SourcedClaim;
  /** Who and what it names as the threat to itself. */
  readonly threatModel: readonly SourcedClaim[];
  /** What it believes the other side will and will not do. */
  readonly adversaryModel: SourcedClaim;
  /** A programme, charter or strategic concept the organisation itself issued. */
  readonly declaredIdeology?: SourcedClaim;
}

/**
 * A decision the institution actually made.
 *
 * `bearsOn` is the load-bearing field. It links an episode to the parameters it
 * is evidence for, which turns the dossier from an anecdote collection into
 * something falsifiable: a reader can ask whether four cited episodes really
 * support 0.85, and disagree with a specific number for a specific reason.
 */
export interface HistoricalDecision {
  /** ISO date, or a year when the record is only that precise. */
  readonly date: string;
  readonly episode: string;
  /** What it chose, in the model's own vocabulary — acted, held, refused. */
  readonly choice: string;
  /** Parameters this episode is evidence about. */
  readonly bearsOn: readonly DoctrineParameter[];
  /** What the episode demonstrates about how this institution decides. */
  readonly lesson: string;
  readonly basis: string;
  readonly confidence: EvidenceConfidence;
}

/**
 * A named actor an evaluator can drop into any scenario.
 *
 * `rationalityPrecision` is deliberately outside the [0,1] block: it is a softmax
 * inverse temperature over the choice set, not a propensity, and folding it into
 * the same scale would be a unit lie that no reader could catch. High values mean
 * disciplined and consistent targeting; low values mean fragmented and
 * improvisational, which is the honest description of a franchised criminal
 * ecosystem and produces the wide behavioural spread such an ecosystem actually
 * shows.
 */
export interface DoctrineProfile {
  readonly id: string;
  readonly label: string;
  readonly kind: ActorKind;
  /** One paragraph an analyst would recognise, describing the institution's decision style. */
  readonly summary: string;
  readonly doctrine: DoctrineVector;
  /** Softmax inverse temperature over the choice set. Roughly 1 (near-uniform) to 12 (near-argmax). */
  readonly rationalityPrecision: number;
  readonly redlines: readonly Redline[];
  /** Where the open literature is thin, contested, or diverges from declared policy. */
  readonly uncertainty: string;
  /** Full citations, so every number above is traceable. */
  readonly sources: readonly string[];
  /** Set when declared doctrine and observed behaviour disagree — itself a finding. */
  readonly declaredVsObserved?: string;
  /**
   * The dossier. Optional because a profile with sourced numbers and no
   * narrative is still usable by the kernel, and half-written prose asserted as
   * research is worse than an absent section a reader can see is absent.
   */
  readonly procedure?: DecisionProcedure;
  readonly worldview?: Worldview;
  readonly history?: readonly HistoricalDecision[];
  /** The one place the researcher says this profile is least defensible. */
  readonly weakestClaim?: WeakestClaim;
}

export class DoctrineError extends Error {}

/**
 * Rejects a profile that would silently produce nonsense.
 *
 * Fails closed rather than clamping: a parameter outside [0,1] means whoever
 * wrote the profile misunderstood the scale, and silently repairing it would
 * carry that misunderstanding into the ranking a defender acts on.
 */
export function validateProfile(profile: DoctrineProfile): void {
  if (!profile.id) throw new DoctrineError("profile id is required");

  for (const parameter of DOCTRINE_PARAMETERS) {
    const entry = profile.doctrine[parameter];
    if (!entry) {
      throw new DoctrineError(`${profile.id}: missing parameter ${parameter}`);
    }
    if (!Number.isFinite(entry.value) || entry.value < 0 || entry.value > 1) {
      throw new DoctrineError(
        `${profile.id}.${parameter}: value must be in [0,1], got ${entry.value}`,
      );
    }
    if (!entry.basis.trim()) {
      throw new DoctrineError(
        `${profile.id}.${parameter}: basis is required — an unsourced parameter is a guess`,
      );
    }
  }

  if (
    !Number.isFinite(profile.rationalityPrecision) ||
    profile.rationalityPrecision <= 0
  ) {
    throw new DoctrineError(
      `${profile.id}: rationalityPrecision must be finite and > 0`,
    );
  }

  const redlineIds = new Set(profile.redlines.map((r) => r.id));
  if (redlineIds.size !== profile.redlines.length) {
    throw new DoctrineError(`${profile.id}: redline ids must be unique`);
  }

  if (profile.sources.length === 0) {
    throw new DoctrineError(
      `${profile.id}: at least one source is required — see the header on why`,
    );
  }

  validateDossier(profile);
}

/**
 * The dossier holds to the same rule as the parameters: no unsourced claims.
 *
 * Narrative is where an unsourced assertion is hardest to spot, because prose
 * reads as authoritative in a way a bare decimal does not. So every claim is
 * checked the same way, and a section that cannot cite itself fails the load
 * rather than reaching a reader who has no way to tell.
 */
function validateDossier(profile: DoctrineProfile): void {
  const check = (claim: SourcedClaim, where: string): void => {
    if (!claim.statement.trim()) {
      throw new DoctrineError(`${profile.id}.${where}: statement is required`);
    }
    if (!claim.basis.trim()) {
      throw new DoctrineError(
        `${profile.id}.${where}: basis is required — an unsourced claim about how an actor thinks is a guess in prose`,
      );
    }
  };

  const procedure = profile.procedure;
  if (procedure) {
    check(procedure.authority, "procedure.authority");
    check(procedure.tempo, "procedure.tempo");
    if (procedure.afterAction) {
      check(procedure.afterAction, "procedure.afterAction");
    }
    procedure.preconditions.forEach((claim, index) =>
      check(claim, `procedure.preconditions[${index}]`),
    );
    if (procedure.steps.length === 0) {
      throw new DoctrineError(
        `${profile.id}.procedure: at least one step is required, or omit the section`,
      );
    }
    for (const step of procedure.steps) {
      if (!step.basis.trim()) {
        throw new DoctrineError(
          `${profile.id}.procedure.steps[${step.order}]: basis is required`,
        );
      }
    }
  }

  const worldview = profile.worldview;
  if (worldview) {
    check(worldview.selfImage, "worldview.selfImage");
    check(worldview.adversaryModel, "worldview.adversaryModel");
    if (worldview.declaredIdeology) {
      check(worldview.declaredIdeology, "worldview.declaredIdeology");
    }
    worldview.declaredEnds.forEach((claim, index) =>
      check(claim, `worldview.declaredEnds[${index}]`),
    );
    worldview.threatModel.forEach((claim, index) =>
      check(claim, `worldview.threatModel[${index}]`),
    );
  }

  const weakest = profile.weakestClaim;
  if (weakest) {
    if (!weakest.section.trim() || !weakest.finding.trim()) {
      throw new DoctrineError(
        `${profile.id}.weakestClaim: both section and finding are required — a weakness that names no section is a disclaimer`,
      );
    }
  }

  for (const episode of profile.history ?? []) {
    if (!episode.basis.trim()) {
      throw new DoctrineError(
        `${profile.id}.history "${episode.episode}": basis is required`,
      );
    }
    for (const parameter of episode.bearsOn) {
      if (!DOCTRINE_PARAMETERS.includes(parameter)) {
        throw new DoctrineError(
          `${profile.id}.history "${episode.episode}": bearsOn names unknown parameter ${parameter}`,
        );
      }
    }
  }
}

/**
 * The episodes offered as evidence for one parameter, newest first.
 *
 * This is what makes a number arguable rather than merely stated: a reader who
 * doubts `ownCostTolerance: 0.85` gets the decisions it was read off, and can
 * say which one they think was misread.
 */
export function episodesFor(
  profile: DoctrineProfile,
  parameter: DoctrineParameter,
): readonly HistoricalDecision[] {
  return [...(profile.history ?? [])]
    .filter((episode) => episode.bearsOn.includes(parameter))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Bare values, for the arithmetic in the kernel. */
export function doctrineValues(
  profile: DoctrineProfile,
): Readonly<Record<DoctrineParameter, number>> {
  const out = {} as Record<DoctrineParameter, number>;
  for (const parameter of DOCTRINE_PARAMETERS) {
    out[parameter] = profile.doctrine[parameter].value;
  }
  return out;
}

/**
 * The weakest links in a profile, worst first.
 *
 * Surfaced in the run product so a reader sees which conclusions rest on thin
 * sourcing before they act on the ranking, rather than after.
 */
export function lowConfidenceParameters(
  profile: DoctrineProfile,
): readonly DoctrineParameter[] {
  return DOCTRINE_PARAMETERS.filter(
    (parameter) => profile.doctrine[parameter].confidence === "low",
  );
}

/** A researcher's heading in the source list, with the citations under it. */
export interface SourceGroup {
  /** Empty for citations filed before any heading. */
  readonly label: string;
  readonly citations: readonly string[];
}

/**
 * A source list that lost its opening emphasis markers somewhere upstream.
 *
 * Every profile's `sources` is a flat array carrying two different things: the
 * researcher's section headings ("Peer-reviewed literature") and the citations
 * under them. The headings arrived with their closing `**` and no opening one,
 * so they render as citations with a stray delimiter — and they are counted as
 * citations, which inflates all nine source counts by twenty-eight between them.
 *
 * Repaired on read rather than in the file: the fix is unambiguous (a heading
 * has no date, no URL and one orphan delimiter) and rewriting research data to
 * suit a renderer is the wrong direction for a correction to travel.
 */
function isGroupLabel(source: string): boolean {
  const text = source.trim();
  return (
    text.endsWith("**") &&
    (text.match(/\*/g) ?? []).length === 2 &&
    !text.includes("http") &&
    !/\d{4}/.test(text)
  );
}

/** Orphaned emphasis delimiters, left by the same upstream loss. */
function cleanEmphasis(source: string): string {
  const balanced = (source.match(/\*/g) ?? []).length % 2 === 0;
  return (balanced ? source : source.replace(/\*/g, "")).trim();
}

/** The source list as its author structured it: headings, then what sits under each. */
export function groupedSources(
  profile: DoctrineProfile,
): readonly SourceGroup[] {
  const groups: SourceGroup[] = [];
  let current: { label: string; citations: string[] } = {
    label: "",
    citations: [],
  };

  for (const source of profile.sources) {
    if (isGroupLabel(source)) {
      if (current.citations.length > 0) groups.push(current);
      current = {
        label: source.trim().replace(/\*+$/, "").trim(),
        citations: [],
      };
      continue;
    }
    current.citations.push(cleanEmphasis(source));
  }
  if (current.citations.length > 0) groups.push(current);

  return groups;
}

/** Citations only. What "43 sources" ought to have meant all along. */
export function citationCount(profile: DoctrineProfile): number {
  return profile.sources.filter((source) => !isGroupLabel(source)).length;
}

/** Whether one enforceable commitment can actually remove a move, and where. */
export interface ConstraintReach {
  readonly redlineId: string;
  readonly attribute: ConstrainedAttribute;
  readonly maxAcceptable: number;
  /** Scenarios containing at least one move this commitment would remove. */
  readonly reachedIn: readonly string[];
}

/**
 * Which of an actor's commitments the shipped scenarios can actually trip.
 *
 * A redline with a constraint is enforced by the kernel — and that is not the
 * same as saying it ever fires. Every constrained redline in the library today
 * sits above the highest value any shipped ladder reaches, so the choice set is
 * never narrowed by one, and a screen showing "enforced" beside it tells a
 * reader something true in a way that leaves them believing something false.
 *
 * Reporting the gap is the honest move, and it is also the interesting one: the
 * commitment the arithmetic cannot see is exactly the commitment an actor's own
 * decision authority still refuses on. That disagreement is the product.
 */
export function constraintReach(
  profile: DoctrineProfile,
  ladders: readonly {
    readonly packId: string;
    readonly maxima: Readonly<Record<ConstrainedAttribute, number>>;
  }[],
): readonly ConstraintReach[] {
  return profile.redlines
    .filter((redline) => redline.constraint !== undefined)
    .map((redline) => {
      const constraint = redline.constraint!;
      return {
        redlineId: redline.id,
        attribute: constraint.attribute,
        maxAcceptable: constraint.maxAcceptable,
        reachedIn: ladders
          .filter(
            (ladder) =>
              ladder.maxima[constraint.attribute] > constraint.maxAcceptable,
          )
          .map((ladder) => ladder.packId),
      };
    });
}

/**
 * Distance between two actors in doctrine space, normalized to [0,1].
 *
 * Used to answer "who else behaves like this" and to check that a scenario's
 * actor set is actually diverse — a panel of three actors that differ by 0.04 is
 * one actor with three names, and the ensemble spread would be an illusion.
 */
export function doctrineDistance(
  a: DoctrineProfile,
  b: DoctrineProfile,
): number {
  let sum = 0;
  for (const parameter of DOCTRINE_PARAMETERS) {
    const delta = a.doctrine[parameter].value - b.doctrine[parameter].value;
    sum += delta * delta;
  }
  return Math.sqrt(sum / DOCTRINE_PARAMETERS.length);
}
