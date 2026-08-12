/**
 * The doctrine profile library.
 *
 * Profiles are DATA, loaded from `engine/data/doctrine-profiles.json` and
 * validated on the way in, rather than TypeScript literals. Three reasons, in
 * order of how much they matter:
 *
 * 1. An evaluator with better sourcing — or with access this project does not
 *    have — must be able to correct a parameter without touching code or
 *    rebuilding anything. The profiles are the most contestable part of the
 *    system and they should be the easiest part to argue with.
 * 2. A profile carries citations, and citations rot. Data can be re-reviewed and
 *    re-dated on its own cycle.
 * 3. Compiling the numbers in would let them drift from the sources that justify
 *    them with nothing to catch it.
 *
 * The schema refuses a profile whose parameters lack a stated basis, so the file
 * cannot quietly accumulate unsourced numbers — see `validateProfile`.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import {
  ACTOR_KINDS,
  CONSTRAINED_ATTRIBUTES,
  DOCTRINE_PARAMETERS,
  EVIDENCE_CONFIDENCE,
  REDLINE_EFFECTS,
  validateProfile,
} from "./doctrine.js";
import type { DoctrineProfile, DoctrineVector } from "./doctrine.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PROFILE_PATH = resolve(
  HERE,
  "../../data/doctrine-profiles.json",
);

const DoctrineValueSchema = z.object({
  value: z.number().min(0).max(1),
  confidence: z.enum(EVIDENCE_CONFIDENCE),
  basis: z.string().min(1),
});

const DoctrineVectorSchema = z.object(
  Object.fromEntries(
    DOCTRINE_PARAMETERS.map((parameter) => [parameter, DoctrineValueSchema]),
  ) as Record<(typeof DOCTRINE_PARAMETERS)[number], typeof DoctrineValueSchema>,
);

const RedlineSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  effect: z.enum(REDLINE_EFFECTS),
  constraint: z
    .object({
      attribute: z.enum(CONSTRAINED_ATTRIBUTES),
      maxAcceptable: z.number().min(0).max(1),
    })
    .optional(),
  basis: z.string().min(1),
  confidence: z.enum(EVIDENCE_CONFIDENCE),
});

const SourcedClaimSchema = z.object({
  statement: z.string().min(1),
  basis: z.string().min(1),
  confidence: z.enum(EVIDENCE_CONFIDENCE),
});

const ProcedureSchema = z.object({
  authority: SourcedClaimSchema,
  steps: z
    .array(
      z.object({
        order: z.number().int().nonnegative(),
        stage: z.string().min(1),
        office: z.string().min(1),
        gate: z.string().min(1),
        basis: z.string().min(1),
        confidence: z.enum(EVIDENCE_CONFIDENCE),
      }),
    )
    .min(1),
  tempo: SourcedClaimSchema,
  preconditions: z.array(SourcedClaimSchema),
  afterAction: SourcedClaimSchema.optional(),
});

const WorldviewSchema = z.object({
  declaredEnds: z.array(SourcedClaimSchema),
  selfImage: SourcedClaimSchema,
  threatModel: z.array(SourcedClaimSchema),
  adversaryModel: SourcedClaimSchema,
  declaredIdeology: SourcedClaimSchema.optional(),
});

const HistorySchema = z.array(
  z.object({
    date: z.string().min(1),
    episode: z.string().min(1),
    choice: z.string().min(1),
    bearsOn: z.array(z.enum(DOCTRINE_PARAMETERS)),
    lesson: z.string().min(1),
    basis: z.string().min(1),
    confidence: z.enum(EVIDENCE_CONFIDENCE),
  }),
);

const ProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(ACTOR_KINDS),
  summary: z.string().min(1),
  doctrine: DoctrineVectorSchema,
  rationalityPrecision: z.number().positive(),
  redlines: z.array(RedlineSchema),
  uncertainty: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
  declaredVsObserved: z.string().optional(),
  procedure: ProcedureSchema.optional(),
  worldview: WorldviewSchema.optional(),
  history: HistorySchema.optional(),
});

const LibrarySchema = z.object({
  /**
   * Bumped when the parameter set changes, so stale files fail loudly.
   *
   * 2 added the dossier — procedure, worldview and decision history. The
   * sections are optional, so a v2 file carrying none of them is valid; the
   * version says the READER understands them, not that the file uses them.
   */
  schemaVersion: z.literal(2),
  /** When the sourcing was last reviewed. Profiles age; this says how much. */
  reviewedAt: z.string().min(1),
  method: z.string().min(1),
  profiles: z.array(ProfileSchema).min(1),
});

export type DoctrineLibraryFile = z.infer<typeof LibrarySchema>;

export interface DoctrineLibrary {
  readonly reviewedAt: string;
  readonly method: string;
  readonly profiles: readonly DoctrineProfile[];
  get(id: string): DoctrineProfile;
  has(id: string): boolean;
  byKind(kind: string): readonly DoctrineProfile[];
}

export class ProfileNotFoundError extends Error {}

/**
 * Load and validate the library.
 *
 * Zod checks the shape, then `validateProfile` checks the semantics — the second
 * pass is what catches an unsourced parameter or an out-of-range value that
 * happens to be well-formed JSON. Both throw. A profile library that loads
 * partially is worse than one that fails, because the missing actor would
 * silently drop out of an ensemble and narrow the reported attack surface.
 */
export async function loadDoctrineLibrary(
  path: string = DEFAULT_PROFILE_PATH,
): Promise<DoctrineLibrary> {
  const raw = await readFile(path, "utf8");
  const parsed = LibrarySchema.parse(JSON.parse(raw));

  const profiles: DoctrineProfile[] = parsed.profiles.map((entry) => ({
    ...entry,
    doctrine: entry.doctrine as DoctrineVector,
  }));
  for (const profile of profiles) validateProfile(profile);

  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    reviewedAt: parsed.reviewedAt,
    method: parsed.method,
    profiles,
    has: (id) => byId.has(id),
    byKind: (kind) => profiles.filter((profile) => profile.kind === kind),
    get(id) {
      const profile = byId.get(id);
      if (!profile) {
        throw new ProfileNotFoundError(
          `no doctrine profile "${id}"; have ${[...byId.keys()].join(", ")}`,
        );
      }
      return profile;
    },
  };
}

/** In-memory library, for tests and for evaluator-supplied profiles. */
export function createLibrary(
  profiles: readonly DoctrineProfile[],
  meta: { reviewedAt: string; method: string },
): DoctrineLibrary {
  for (const profile of profiles) validateProfile(profile);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return {
    reviewedAt: meta.reviewedAt,
    method: meta.method,
    profiles,
    has: (id) => byId.has(id),
    byKind: (kind) => profiles.filter((profile) => profile.kind === kind),
    get(id) {
      const profile = byId.get(id);
      if (!profile) {
        throw new ProfileNotFoundError(`no doctrine profile "${id}"`);
      }
      return profile;
    },
  };
}
