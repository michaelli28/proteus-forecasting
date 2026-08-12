/**
 * The council — language-model agents deliberating inside a run.
 *
 * WHY THIS EXISTS. The kernel decides by arithmetic: it scores every move an
 * actor could make and picks one. That is reproducible, auditable, and fast
 * enough that a 180-day run finishes in a tenth of a second — which is exactly
 * right for a benchmark and tells a watcher nothing about *reasoning*, because
 * there was none to watch. The arithmetic knows that a move scored -0.04. It
 * does not know that the institution would have refused it in a legal review
 * that never reaches the principal.
 *
 * So a council convenes at the moments that matter. Its seats are the actor's
 * OWN institutional gates, read from the dossier's `procedure.steps` — not
 * generic personas. That distinction is the whole design: a panel of invented
 * characters produces correlated opinions dressed as independent ones, while a
 * legal-review seat and a target-development seat fail in genuinely different
 * directions because the institution built them to.
 *
 * ADVISORY BY DEFAULT, and this matters more than it looks. The council does not
 * overwrite the kernel's choice. It renders its own, and where the two disagree
 * that disagreement is published as a finding. A run therefore stays reproducible
 * from its seed — the benchmark keeps meaning what it says — and the reader gets
 * the more interesting artefact anyway: the arithmetic said hold, the council
 * said act, and here is the seat that broke the tie.
 *
 * WHAT A SEAT CAN SAY. A seat chooses among options the kernel already
 * enumerated and prices them in institutional terms. It has no channel through
 * which to emit an operational procedure, because it is never asked how to do
 * anything — the same structural refusal the rest of the engine uses, applied to
 * a prompt instead of a schema.
 */

import { z } from "zod";
import { completeStructured } from "../llm/structured.js";
import { doctrineValues } from "./doctrine.js";
import type { DoctrineProfile, ProcedureStep } from "./doctrine.js";
import type { LlmClient } from "../llm/client.js";

/**
 * Council framing.
 *
 * Deliberately parallel to `agents/scope.ts` but not the same text: that
 * preamble tells an adjudicator it is forecasting a numeric variable, which is
 * true there and false here. This one states what is literally true of a seat —
 * it is choosing among enumerated options in a policy model — and it states the
 * one hard limit, which is that no seat is ever asked how anything is done.
 */
export const COUNCIL_PREAMBLE = `CONTEXT — read before answering.

You are one seat on a deliberating body inside a closed policy simulation. A model has
already enumerated the complete option set and priced each option; your task is to judge
which option this institution would authorise, and why, in institutional terms — authority,
mandate, cost, precedent, and what the institution has done before.

You are never asked how any option would be carried out, and an answer containing
operational or technical means is out of scope and will be discarded. The options are
abstract labels in a model's escalation ladder, not plans. Reason about authorisation and
consequence only.`;

export const SEAT_RECOMMENDATIONS = ["act", "hold", "refuse"] as const;
export type SeatRecommendation = (typeof SEAT_RECOMMENDATIONS)[number];

export const SEAT_CONFIDENCE = ["low", "moderate", "high"] as const;

/**
 * One seat at the table.
 *
 * `office` is an institutional role and never a person — the dossier schema
 * enforces that upstream, and it is restated here because this is where the
 * value becomes a system prompt and the failure would become invisible.
 */
export interface CouncilSeat {
  readonly id: string;
  readonly office: string;
  readonly stage: string;
  /** What this seat is empowered to stop, and on what grounds. */
  readonly gate: string;
  /** Where the seat's authority claim comes from. "fallback" when undocumented. */
  readonly basis: string;
}

/**
 * An option reference as a seat returns it.
 *
 * Seats read the option list where each entry is printed as `[ASSET|rung]`, and
 * they copy the brackets back about half the time — measured, not guessed. That
 * is a prompt-formatting artefact, not a wrong answer, and rejecting it would
 * burn a repair round to get the same content back. Normalising here also makes
 * an empty string mean the same thing as null, which is what a model that
 * declined to pick an option is trying to say.
 */
const MoveRefSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (typeof value !== "string") return null;
    const cleaned = value
      .trim()
      .replace(/^\[|\]$/g, "")
      .trim();
    return cleaned.length > 0 && cleaned.toLowerCase() !== "null"
      ? cleaned
      : null;
  });

export const SeatOpinionSchema = z.object({
  recommendation: z.enum(SEAT_RECOMMENDATIONS),
  /** `assetId|rungId` of the preferred option, or null for hold/refuse. */
  moveRef: MoveRefSchema,
  reasoning: z.string().min(1),
  /** The single consideration that decided it, in this seat's own terms. */
  decisiveFactor: z.string().min(1),
  confidence: z.enum(SEAT_CONFIDENCE),
});
export type SeatOpinion = z.infer<typeof SeatOpinionSchema>;

export const ChairVerdictSchema = z.object({
  decision: z.enum(SEAT_RECOMMENDATIONS),
  moveRef: MoveRefSchema,
  reasoning: z.string().min(1),
  /**
   * Which seat disagreed and what it said. Empty when the table was unanimous.
   *
   * Defaulted rather than required: a chair reporting a unanimous table
   * routinely omits the key altogether, and failing the whole verdict over an
   * absent empty string throws away the deliberation that produced it.
   */
  dissent: z.string().default(""),
  confidence: z.enum(SEAT_CONFIDENCE),
});
export type ChairVerdict = z.infer<typeof ChairVerdictSchema>;

/** One seat's contribution, with the identity needed to render it. */
export interface SeatDeliberation {
  readonly seat: CouncilSeat;
  readonly opinion: SeatOpinion;
}

export interface CouncilVerdict {
  readonly actorId: string;
  readonly tick: number;
  readonly seats: readonly SeatDeliberation[];
  readonly chair: ChairVerdict;
  /** The kernel's own choice, for comparison. `hold`/`refuse` when it did not act. */
  readonly kernelDecision: string;
  readonly kernelMoveRef: string | null;
  /** True when council and kernel reached the same call. The interesting field. */
  readonly agreed: boolean;
  /** How the seats split, for a reader who wants the shape not the prose. */
  readonly split: Readonly<Record<SeatRecommendation, number>>;
  /** Which seats the table was built from. */
  readonly seatSource: "documented" | "fallback";
}

/**
 * The gates a proposal passes when the dossier does not document them.
 *
 * Every institution capable of the actions this model represents runs some
 * version of these four functions. They are stated as a FALLBACK and labelled as
 * one everywhere they surface, because presenting a generic table as though it
 * were this actor's documented authority chain is precisely the kind of quiet
 * fabrication the dossier schema exists to prevent.
 */
const FALLBACK_SEATS: readonly CouncilSeat[] = [
  {
    id: "operations",
    office: "operations",
    stage: "feasibility",
    gate: "can stop a proposal it judges beyond current reach or badly timed",
    basis: "fallback — this actor's procedure is not documented in the dossier",
  },
  {
    id: "legitimacy",
    office: "legal and political review",
    stage: "authorisation",
    gate: "can stop a proposal on legal exposure, alliance cost, or a standing commitment",
    basis: "fallback — this actor's procedure is not documented in the dossier",
  },
  {
    id: "exposure",
    office: "intelligence assessment",
    stage: "exposure estimate",
    gate: "can stop a proposal whose attribution risk it judges unacceptable",
    basis: "fallback — this actor's procedure is not documented in the dossier",
  },
  {
    id: "principal",
    office: "decision authority",
    stage: "go / no-go",
    gate: "holds the final authorisation and can overrule any objection",
    basis: "fallback — this actor's procedure is not documented in the dossier",
  },
];

/**
 * Build the table from the actor's own documented gates when they exist.
 *
 * A step whose `office` is documented becomes a seat that speaks with that
 * office's authority. Where the dossier is silent the fallback table is used and
 * flagged, so a reader always knows whether they are looking at this
 * institution's authority chain or at a stand-in for one.
 */
export function seatsFor(profile: DoctrineProfile): {
  seats: readonly CouncilSeat[];
  source: "documented" | "fallback";
} {
  const steps = profile.procedure?.steps ?? [];
  if (steps.length === 0) return { seats: FALLBACK_SEATS, source: "fallback" };

  const ordered = [...steps].sort((a, b) => a.order - b.order);
  return {
    seats: ordered.map((step: ProcedureStep) => ({
      id: `${step.order}-${slug(step.office)}`,
      office: step.office,
      stage: step.stage,
      gate: step.gate,
      basis: step.basis,
    })),
    source: "documented",
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

// ─── what a seat is told ───

/** The option set, rendered so a seat reads the same numbers the kernel used. */
export interface CouncilOption {
  readonly ref: string;
  readonly assetId: string;
  readonly rungStatement: string;
  readonly total: number;
  readonly payoff: number;
  readonly attributionCost: number;
  readonly legitimacyCost: number;
  readonly civilianHarmCost: number;
  readonly retaliationCost: number;
}

export interface CouncilInput {
  readonly profile: DoctrineProfile;
  readonly tick: number;
  readonly tickUnit: string;
  readonly situation: string;
  /** Every option the kernel scored, best first. Truncated by the caller. */
  readonly options: readonly CouncilOption[];
  /** Options a red line removed before scoring, with the commitment that did it. */
  readonly blocked: readonly { ref: string; redlineStatement: string }[];
  /** Value of waiting, which is what "hold" is worth against the best option. */
  readonly holdValue: number;
  /** Whether the actor currently frames its position as losing. */
  readonly frame: "gain" | "loss";
  /** What has already happened in this run, in one paragraph. */
  readonly runSoFar: string;
}

/**
 * The seat's system prompt.
 *
 * Carries the actor's doctrine, its declared ends and its own record — the
 * dossier is not decoration here, it is the material the seat reasons from, and
 * an actor whose dossier is thin produces a visibly thinner deliberation. That
 * is the honest outcome: the council cannot be better sourced than the profile.
 */
export function buildSeatSystemPrompt(
  profile: DoctrineProfile,
  seat: CouncilSeat,
): string {
  const d = doctrineValues(profile);
  const worldview = profile.worldview;

  const ends = worldview?.declaredEnds
    .map((claim) => `  - ${claim.statement}`)
    .join("\n");
  const threats = worldview?.threatModel
    .map((claim) => `  - ${claim.statement}`)
    .join("\n");

  const record = (profile.history ?? [])
    .slice(0, 8)
    .map(
      (entry) =>
        `  - ${entry.date} ${entry.episode} → ${entry.choice}. ${entry.lesson}`,
    )
    .join("\n");

  const commitments = profile.redlines
    .map((redline) => `  - ${redline.statement}`)
    .join("\n");

  return `${COUNCIL_PREAMBLE}

---

You hold the ${seat.office} seat for ${profile.label} in this model.

YOUR STAGE: ${seat.stage}
WHAT YOU CAN STOP: ${seat.gate}

You speak only for this seat. Do not adopt the whole institution's view, and do not
soften your objection because you expect another seat to raise it — the value of this
table is that the seats disagree.

THE INSTITUTION YOU SERVE
${profile.summary}

HOW IT WEIGHS THINGS (0-1; the model's own parameters)
  tolerance for its own losses: ${d.ownCostTolerance}
  restraint toward the other side's noncombatants: ${d.counterpartHarmRestraint}
  preference not to be provably seen: ${d.attributionAversion}
  preference to act through surrogates: ${d.proxyPreference}
  belief it can escalate and stop where it chooses: ${d.escalationControlBelief}
  patience: ${d.timeHorizon}
  concentration of authority: ${d.decisionCentralization}
  extra risk accepted when it sees itself losing: ${d.lossFrameRiskAcceptance}
  weight on law and alliance approval: ${d.legitimacyWeight}
  preference that the act be seen: ${d.signalingPreference}

COMMITMENTS IT DOES NOT PRICE
${commitments || "  (none recorded)"}
${
  ends
    ? `
WHAT IT SAYS IT IS TRYING TO ACHIEVE
${ends}`
    : ""
}${
    threats
      ? `
WHAT IT NAMES AS THE THREAT TO ITSELF
${threats}`
      : ""
  }${
    worldview?.adversaryModel
      ? `
WHAT IT BELIEVES THE OTHER SIDE WILL DO
  ${worldview.adversaryModel.statement}`
      : ""
  }${
    record
      ? `
WHAT IT HAS ACTUALLY DONE BEFORE
${record}`
      : ""
  }

Judge the option set you are given from this seat. Cite the institution's own record or
its stated commitments where they bear on your judgement. If nothing in your remit
objects, say so plainly rather than inventing an objection.`;
}

export function buildSeatPrompt(input: CouncilInput): string {
  const options = input.options
    .map(
      (option, index) =>
        `  ${index + 1}. [${option.ref}] ${option.assetId} — "${option.rungStatement}"\n` +
        `       model's net value ${option.total.toFixed(4)} ` +
        `(gain ${option.payoff.toFixed(4)}; exposure ${option.attributionCost.toFixed(4)}; ` +
        `legal/alliance ${option.legitimacyCost.toFixed(4)}; ` +
        `civilian harm ${option.civilianHarmCost.toFixed(4)}; ` +
        `retaliation ${option.retaliationCost.toFixed(4)})`,
    )
    .join("\n");

  const blocked =
    input.blocked.length > 0
      ? input.blocked
          .map(
            (entry) =>
              `  - [${entry.ref}] removed by: ${entry.redlineStatement}`,
          )
          .join("\n")
      : "  (none)";

  return `SITUATION
${input.situation}

WHERE THE RUN STANDS (${input.tickUnit} ${input.tick})
${input.runSoFar}

THE INSTITUTION CURRENTLY FRAMES ITS POSITION AS: ${
    input.frame === "loss"
      ? "losing — it is under sustained pressure"
      : "holding an advantage"
  }

OPTIONS ON THE TABLE (the complete set; the model priced each)
${options || "  (nothing available this step)"}

OPTIONS ITS OWN COMMITMENTS ALREADY REMOVED
${blocked}

VALUE OF WAITING ONE MORE ${input.tickUnit.toUpperCase()}: ${input.holdValue.toFixed(4)}
  (the same option is worth this much if taken later instead of now)

From your seat, report:
- recommendation: "act" (authorise one option now), "hold" (wait), or "refuse" (this
  institution will not authorise any of these, and say which commitment forbids it)
- moveRef: the bracketed reference of the option you would authorise, or null
- reasoning: 2-4 sentences in institutional terms, citing this institution's record or
  commitments where they apply
- decisiveFactor: the single consideration that settled it, in a short phrase
- confidence: "low" | "moderate" | "high"

Output ONLY valid JSON: {"recommendation":"...","moveRef":null,"reasoning":"...","decisiveFactor":"...","confidence":"..."}`;
}

// ─── convening ───

export interface ConveneOptions {
  /**
   * A client per speaker, labelled.
   *
   * A factory rather than one client because the label is what ties a raw
   * prompt and completion on the stream back to the seat that produced it. One
   * client shared by the whole table makes every seat's reasoning arrive under
   * the same name, and a viewer can then see that five agents thought something
   * but not which agent thought what — which is most of the value.
   */
  readonly clientFor: (label: string) => LlmClient;
  readonly input: CouncilInput;
  readonly kernelDecision: string;
  readonly kernelMoveRef: string | null;
  /** Called before each seat speaks, so a viewer sees the table fill in. */
  readonly onSeatOpened?: (seat: CouncilSeat) => void;
  readonly onSeatClosed?: (deliberation: SeatDeliberation) => void;
  readonly onRetry?: (label: string, attempt: number, reason: string) => void;
}

/**
 * Run one council.
 *
 * Seats deliberate CONCURRENTLY and independently. Sequencing them would let a
 * later seat read an earlier one's conclusion, which is how a panel of
 * independent gates quietly becomes one opinion repeated — the failure the whole
 * seat design exists to avoid. The chair reads all of them afterwards, which is
 * what a chair is for.
 */
export async function convene(
  options: ConveneOptions,
): Promise<CouncilVerdict> {
  const { clientFor, input, kernelDecision, kernelMoveRef } = options;
  const { seats, source } = seatsFor(input.profile);

  const deliberations = await Promise.all(
    seats.map(async (seat): Promise<SeatDeliberation> => {
      options.onSeatOpened?.(seat);
      const { value } = await completeStructured(
        clientFor(`seat:${seat.id}`),
        {
          system: buildSeatSystemPrompt(input.profile, seat),
          prompt: buildSeatPrompt(input),
          maxTurns: 1,
        },
        {
          schema: SeatOpinionSchema,
          onRetry: (attempt, reason) =>
            options.onRetry?.(`seat:${seat.id}`, attempt, reason),
        },
      );
      const deliberation = { seat, opinion: value };
      options.onSeatClosed?.(deliberation);
      return deliberation;
    }),
  );

  const chair = await runChair(
    clientFor("chair"),
    input,
    deliberations,
    options.onRetry,
  );

  const split = { act: 0, hold: 0, refuse: 0 };
  for (const entry of deliberations) split[entry.opinion.recommendation]++;

  return {
    actorId: input.profile.id,
    tick: input.tick,
    seats: deliberations,
    chair,
    kernelDecision,
    kernelMoveRef,
    agreed: agrees(chair, kernelDecision, kernelMoveRef),
    split,
    seatSource: source,
  };
}

/**
 * Whether the council landed where the arithmetic did.
 *
 * Compares the CALL, not the exact option: a council that would act on a
 * different asset than the kernel picked still agrees that this is a moment to
 * act, and collapsing those two disagreements into one would hide the more
 * important of them.
 */
function agrees(
  chair: ChairVerdict,
  kernelDecision: string,
  kernelMoveRef: string | null,
): boolean {
  const kernelActed = kernelDecision === "act";
  if (chair.decision === "act") {
    return (
      kernelActed && (chair.moveRef === null || chair.moveRef === kernelMoveRef)
    );
  }
  return !kernelActed;
}

async function runChair(
  client: LlmClient,
  input: CouncilInput,
  deliberations: readonly SeatDeliberation[],
  onRetry?: (label: string, attempt: number, reason: string) => void,
): Promise<ChairVerdict> {
  const authority = input.profile.procedure?.authority;
  const d = doctrineValues(input.profile);

  const table = deliberations
    .map(
      (entry) =>
        `  ${entry.seat.office} (${entry.seat.stage}) → ${entry.opinion.recommendation}` +
        `${entry.opinion.moveRef ? ` [${entry.opinion.moveRef}]` : ""}, ` +
        `confidence ${entry.opinion.confidence}\n` +
        `      decisive: ${entry.opinion.decisiveFactor}\n` +
        `      ${entry.opinion.reasoning}`,
    )
    .join("\n");

  const system = `${COUNCIL_PREAMBLE}

---

You hold final authority for ${input.profile.label} in this model.
${authority ? `\nWHERE THAT AUTHORITY SITS\n  ${authority.statement}\n` : ""}
This institution concentrates decision authority at ${d.decisionCentralization} on a 0-1
scale, where 1 is a small closed circle that can act without a veto. Weigh the seats
accordingly: a highly centralised authority may overrule an objecting gate, and a
dispersed one usually cannot.

Reach the call this institution would actually reach — not the one you would prefer, and
not an average of the seats. Record the strongest objection you are overruling.`;

  const prompt = `THE TABLE

${table}

VALUE OF WAITING: ${input.holdValue.toFixed(4)}

Report the institution's decision.
- decision: "act" | "hold" | "refuse"
- moveRef: the option reference authorised, or null
- reasoning: 2-4 sentences. Name which seat you followed and which you overruled.
- dissent: the strongest surviving objection, verbatim in substance. Empty string if the
  table was unanimous.
- confidence: "low" | "moderate" | "high"

Output ONLY valid JSON: {"decision":"...","moveRef":null,"reasoning":"...","dissent":"","confidence":"..."}`;

  const { value } = await completeStructured(
    client,
    { system, prompt, maxTurns: 1 },
    {
      schema: ChairVerdictSchema,
      onRetry: (attempt, reason) => onRetry?.("chair", attempt, reason),
    },
  );
  return value;
}

/** Stable reference for one option, used in prompts and in the stream. */
export function moveRef(assetId: string, rungId: string): string {
  return `${assetId}|${rungId}`;
}
