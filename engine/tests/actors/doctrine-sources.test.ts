/**
 * The source list, and the commitment that never fires.
 *
 * Two repairs to how a profile reports itself, both of which were shipping a
 * number a reader would have been right to trust and wrong to believe: source
 * counts that included the researcher's own section headings, and an "enforced"
 * label on commitments no shipped scenario can reach.
 */

import { describe, expect, it } from "vitest";
import { loadDoctrineLibrary } from "../../src/actors/library.js";
import {
  citationCount,
  constraintReach,
  groupedSources,
} from "../../src/actors/doctrine.js";
import type { DoctrineProfile } from "../../src/actors/doctrine.js";

function withSources(sources: string[]): DoctrineProfile {
  return { sources } as unknown as DoctrineProfile;
}

describe("groupedSources", () => {
  it("files citations under the heading above them", () => {
    const groups = groupedSources(
      withSources([
        "Primary doctrine**",
        "Decree No. 991, 19 Nov 2024. https://example.gov/a",
        "Peer-reviewed literature**",
        "Author, Journal 21(3), 2025.",
      ]),
    );
    expect(groups.map((group) => group.label)).toEqual([
      "Primary doctrine",
      "Peer-reviewed literature",
    ]);
    expect(groups[0]!.citations).toHaveLength(1);
    expect(groups[1]!.citations).toHaveLength(1);
  });

  it("keeps citations that appear before any heading", () => {
    const groups = groupedSources(
      withSources(["Author, 2020.", "Peer-reviewed**", "Other, 2021."]),
    );
    expect(groups[0]!.label).toBe("");
    expect(groups[0]!.citations).toEqual(["Author, 2020."]);
  });

  it("strips an orphaned delimiter a citation lost its opener for", () => {
    const groups = groupedSources(
      withSources(["National Security Strategy*, The White House, 2025."]),
    );
    expect(groups[0]!.citations[0]).toBe(
      "National Security Strategy, The White House, 2025.",
    );
  });

  it("leaves balanced emphasis alone — it renders", () => {
    const kept = "Kofman, *Escalation Management*, CNA, 2020.";
    expect(groupedSources(withSources([kept]))[0]!.citations[0]).toBe(kept);
  });

  it("does not mistake a dated citation for a heading", () => {
    const dated = "Some Assessment, Apr 2020**";
    expect(citationCount(withSources([dated]))).toBe(1);
  });

  it("counts every real citation in the shipped library and no heading", async () => {
    const library = await loadDoctrineLibrary();
    for (const profile of library.profiles) {
      const groups = groupedSources(profile);
      const filed = groups.reduce(
        (total, group) => total + group.citations.length,
        0,
      );
      expect(filed, `${profile.id} citations`).toBe(citationCount(profile));
      expect(citationCount(profile), `${profile.id} count`).toBeLessThan(
        profile.sources.length,
      );
      // Balanced emphasis is left alone because the page renders it. What must
      // never survive is an ORPHAN delimiter, which renders as a literal
      // asterisk in the middle of a citation.
      for (const group of groups) {
        for (const citation of group.citations) {
          const delimiters = (citation.match(/\*/g) ?? []).length;
          expect(
            delimiters % 2,
            `${profile.id}: ${citation.slice(0, 60)}`,
          ).toBe(0);
        }
      }
    }
  });
});

describe("constraintReach", () => {
  const profile = {
    redlines: [
      {
        id: "bounded",
        constraint: { attribute: "attributability", maxAcceptable: 0.5 },
      },
      { id: "prose-only" },
    ],
  } as unknown as DoctrineProfile;

  const ladders = [
    { packId: "loud", maxima: { attributability: 0.7 } },
    { packId: "quiet", maxima: { attributability: 0.4 } },
  ] as Parameters<typeof constraintReach>[1];

  it("reports only the scenarios that can trip a commitment", () => {
    const reach = constraintReach(profile, ladders);
    expect(reach).toHaveLength(1);
    expect(reach[0]!.reachedIn).toEqual(["loud"]);
  });

  it("says nothing about a commitment the kernel cannot enforce", () => {
    expect(
      constraintReach(profile, ladders).map((entry) => entry.redlineId),
    ).not.toContain("prose-only");
  });

  it("finds every shipped commitment inert — which is why the page says so", async () => {
    const library = await loadDoctrineLibrary();
    const { SCENARIO_PACKS } =
      await import("../../src/scenario/packs/index.js");
    const shipped = Object.entries(SCENARIO_PACKS).map(([packId, pack]) => ({
      packId,
      maxima: {
        civilianHarmShare: Math.max(
          ...pack.ladder.map((rung) => rung.civilianHarmShare),
        ),
        legitimacyCost: Math.max(
          ...pack.ladder.map((rung) => rung.legitimacyCost),
        ),
        visibility: Math.max(...pack.ladder.map((rung) => rung.visibility)),
        attributability: Math.max(
          ...pack.ladder.map((rung) => rung.attributability),
        ),
      },
    }));

    const all = library.profiles.flatMap((entry) =>
      constraintReach(entry, shipped),
    );
    expect(
      all.length,
      "enforceable commitments in the library",
    ).toBeGreaterThan(0);
    // If this ever fails, a ladder grew teeth and the actor pages should stop
    // saying the commitment never removes a move.
    for (const reach of all) {
      expect(reach.reachedIn, `${reach.redlineId}`).toEqual([]);
    }
  });
});
