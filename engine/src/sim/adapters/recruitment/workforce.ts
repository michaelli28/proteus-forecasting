/**
 * The synthetic workforce.
 *
 * Deliberately NOT a graph. Belief diffusion needs a network because influence
 * travels along edges; a recruitment approach is a direct message from the
 * adversary to one person, so an edge list here would be decoration. What
 * matters instead is who is findable, who is worth paying for, and who is
 * under enough pressure to answer.
 *
 * Every attribute is an opaque number. There are no names, titles, employers or
 * profile fields — see config.ts for why that is structural rather than a
 * stylistic choice.
 */

import type { Rng } from "../../rng.js";
import type { RecruitmentConfig } from "./config.js";

export interface Person {
  readonly id: number;
  /** Employing organisation. Concentration across these is a detection signal. */
  readonly organization: number;
  readonly cleared: boolean;
  /**
   * Value of what this person can reach, in [0,1].
   *
   * Correlated with clearance but not identical to it: an uncleared person in
   * the right seat can still hold something worth buying, and the documented
   * cases include exactly that.
   */
  readonly access: number;
  /** How findable the person is from outside: publications, title, conferences. */
  readonly exposure: number;
  /** Financial stress and job dissatisfaction, combined, in [0,1]. */
  readonly vulnerability: number;
}

export interface Workforce {
  readonly people: Person[];
  /** Person ids per organisation, for concentration measures. */
  readonly byOrganization: number[][];
  readonly clearedIds: readonly number[];
  /** Per-organisation sensitivity multiplier, highest first. */
  readonly organizationSensitivity: readonly number[];
}

/**
 * How much more attractive the most sensitive employer is than the least.
 *
 * Organisations are NOT interchangeable, and making them so was a real defect:
 * with statistically identical employers a selective adversary spreads evenly
 * across them, employer concentration stays at 1/n whatever it does, and the
 * single signal the German service actually reported publicly — approaches
 * clustering on particular ministries and agencies — cannot appear at all.
 *
 * A defence programme office and a civilian back office do not carry the same
 * density of clearances or the same access, and an adversary paying for access
 * concentrates where the access is.
 */
const SENSITIVITY_RANGE = [0.45, 1.0] as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Draw a bounded attribute.
 *
 * Normal then clamped rather than a beta: the tail is the whole point — a small
 * number of very vulnerable, very exposed people carry most of the risk — and a
 * clamped normal keeps that tail legible in the config as a mean and a spread
 * an analyst can argue with.
 */
function attribute(rng: Rng, mean: number, sd: number): number {
  return rng.clampedNormal(mean, sd, 0, 1);
}

export function buildWorkforce(config: RecruitmentConfig, rng: Rng): Workforce {
  const { people: count, organizations, clearedFraction } = config.workforce;

  const people: Person[] = [];
  const byOrganization: number[][] = Array.from(
    { length: organizations },
    () => [],
  );
  const clearedIds: number[] = [];

  // Fixed spread rather than drawn: the point is that employers differ, and a
  // random draw would occasionally hand out six near-identical ones and quietly
  // remove the concentration signal from that run.
  const [sensMin, sensMax] = SENSITIVITY_RANGE;
  const organizationSensitivity = Array.from(
    { length: organizations },
    (_, i) =>
      organizations === 1
        ? sensMax
        : sensMax - ((sensMax - sensMin) * i) / (organizations - 1),
  );

  for (let id = 0; id < count; id++) {
    const organization = id % organizations;
    const sensitivity = organizationSensitivity[organization]!;

    // A more sensitive employer holds a denser population of clearances.
    const cleared =
      rng.uniform(0, 1) < clamp01(clearedFraction * sensitivity * 1.6);
    const exposure = attribute(
      rng,
      config.workforce.exposureMean,
      config.workforce.exposureSd,
    );
    const vulnerability = attribute(
      rng,
      config.workforce.vulnerabilityMean,
      config.workforce.vulnerabilitySd,
    );
    // Clearance lifts access without determining it, so the adversary cannot
    // simply read value off a clearance flag it can never actually observe.
    // Scaled by employer sensitivity — the same badge is worth more in some
    // buildings than others, which is what makes concentration rational.
    const access = clamp01(
      ((cleared ? 0.45 : 0.15) + rng.uniform(0, 1) * 0.55 * exposure) *
        sensitivity,
    );

    people.push({ id, organization, cleared, access, exposure, vulnerability });
    byOrganization[organization]!.push(id);
    if (cleared) clearedIds.push(id);
  }

  return { people, byOrganization, clearedIds, organizationSensitivity };
}

/**
 * How attractive a person looks to the adversary, in [0,1].
 *
 * Built only from what an outsider could infer from a public profile — how
 * findable someone is and what their role implies they can reach. Vulnerability
 * enters at ASSESSMENT, after contact, because financial stress is not on a
 * profile page; folding it in here would let the adversary select on something
 * it has not yet learned.
 */
export function targetPriority(person: Person): number {
  return 0.6 * person.exposure + 0.4 * person.access;
}

/** Mean of a numeric series, 0 when empty. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Share of contacts falling in the single most-targeted organisation.
 *
 * 1/organizations when spread evenly, 1 when every approach lands in one place.
 * A genuine recruiter works across employers; an adversary hunting one
 * programme does not, and this is the cheapest way a platform could notice.
 */
export function employerConcentration(
  contactsPerOrganization: readonly number[],
): number {
  const total = contactsPerOrganization.reduce((sum, c) => sum + c, 0);
  if (total === 0) return 0;
  return Math.max(...contactsPerOrganization) / total;
}
