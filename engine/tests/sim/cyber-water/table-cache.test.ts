import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadConsequenceTables,
  writeConsequenceTables,
  type TableReply,
} from "../../../src/consequence/table.js";

const KEY = "tiny|PLC-PUMP-1|pump_stop|6";

const REPLY: TableReply = {
  ok: true,
  sweepM: [14, 28],
  durationsHours: [6],
  startHour: 6,
  solver: "fixture",
  archetypes: [
    {
      id: "tiny",
      description: "two junctions",
      servedPopulation: 100,
      junctions: 2,
      components: [
        {
          id: "PLC-PUMP-1",
          kind: "pump",
          zone: "z",
          perturbation: "pump_stop",
        },
      ],
    },
  ],
  entries: {
    [KEY]: {
      deltaPersonHoursLow: 12,
      deltaPersonHoursHigh: 30,
      peakPeopleBelow: 40,
      band: "0-500",
      bandAgreed: true,
      converged: true,
      servedPopulation: 100,
    },
  },
};

describe("the consequence table cache", () => {
  // The CLI once wrote the parsed bundle, which the loader rejects, so a
  // freshly built table could not be read back by anything.
  it("loads back exactly what the build writes", async () => {
    const path = join(
      await mkdtemp(join(tmpdir(), "consequence-")),
      "table.json",
    );
    await writeConsequenceTables(REPLY, path);

    const bundle = await loadConsequenceTables(path);

    expect(bundle.solver).toBe("fixture");
    expect(bundle.tables["tiny"]?.cells[KEY]?.deltaPersonHoursLow).toBe(12);
  });
});
