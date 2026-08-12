/**
 * The worked scenario packs.
 *
 * Three domains that share zero dynamics code: a physical utility whose harm
 * lands on people immediately, an economic system whose harm accumulates in a
 * queue after the outage ends, and a government service whose worst outcome is
 * not an outage at all but quietly wrong answers. If one engine ranks
 * vulnerabilities sensibly across all three, the generalization claim has
 * something behind it; if it does not, the packs are where that shows up.
 *
 * All three carry PARAMETRIC oracles. None has a domain solver behind it, and
 * every number they produce is labelled a structured guess for that reason —
 * the water domain remains the only one with a physics twin. An evaluator who
 * wants any of these at that standing supplies the solver.
 */

import { REGIONAL_GRID } from "./regional-grid.js";
import { PORT_THROUGHPUT } from "./port-throughput.js";
import { BENEFITS_DELIVERY } from "./benefits-delivery.js";
import type { SituationSpec } from "../spec.js";

export { REGIONAL_GRID, PORT_THROUGHPUT, BENEFITS_DELIVERY };

export const SCENARIO_PACKS: Readonly<Record<string, SituationSpec>> = {
  "regional-grid": REGIONAL_GRID,
  "port-throughput": PORT_THROUGHPUT,
  "benefits-delivery": BENEFITS_DELIVERY,
};

export const PACK_IDS = Object.keys(SCENARIO_PACKS);

export function getPack(id: string): SituationSpec {
  const pack = SCENARIO_PACKS[id];
  if (!pack) {
    throw new Error(`no scenario pack "${id}"; have ${PACK_IDS.join(", ")}`);
  }
  return pack;
}
