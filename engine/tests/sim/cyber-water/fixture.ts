/**
 * A tiny hand-built consequence table for unit tests.
 *
 * Deliberately NOT produced by EPANET: the solver is exercised by its own
 * Python tests, and coupling every TypeScript unit test to a subprocess would
 * make them slow and flaky. What these tests check is the kernel and the
 * ranking logic, which only need a table shaped like a real one.
 */

import type {
  ComponentRef,
  ConsequenceTable,
} from "../../../src/sim/adapters/cyber-water/index.js";
import { cellKey } from "../../../src/sim/adapters/cyber-water/index.js";

export const TEST_ARCHETYPE = "test_net";
export const TEST_SERVED = 1000;

export const TEST_REGISTER: readonly ComponentRef[] = [
  { id: "PUMP-1", kind: "pump", zone: "a", perturbation: "pump_stop" },
  {
    id: "TANK-1",
    kind: "tank_level",
    zone: "a",
    perturbation: "level_spoof_high",
  },
  { id: "VALVE-1", kind: "valve", zone: "b", perturbation: "valve_close" },
];

const DURATIONS = [6, 24, 48];

/**
 * TANK-1 is the robust chokepoint; PUMP-1 does nothing; VALVE-1 is
 * sweep-sensitive (zero guaranteed, positive pessimistic). One cell per
 * (component, its perturbation, duration), plus the no-op cell.
 */
function buildCells(): ConsequenceTable["cells"] {
  const cells: Record<string, ConsequenceTable["cells"][string]> = {};

  cells[cellKey(TEST_ARCHETYPE, "-", "none", 0)] = {
    deltaPersonHoursLow: 0,
    deltaPersonHoursHigh: 0,
    peakPeopleBelow: 0,
    band: "c1",
    bandAgreed: true,
    converged: true,
  };

  for (const hours of DURATIONS) {
    cells[cellKey(TEST_ARCHETYPE, "TANK-1", "level_spoof_high", hours)] = {
      deltaPersonHoursLow: 1000 * hours,
      deltaPersonHoursHigh: 1500 * hours,
      peakPeopleBelow: 800,
      band: "c4",
      bandAgreed: true,
      converged: true,
    };
    cells[cellKey(TEST_ARCHETYPE, "PUMP-1", "pump_stop", hours)] = {
      deltaPersonHoursLow: -50,
      deltaPersonHoursHigh: 0,
      peakPeopleBelow: 0,
      band: "c1",
      bandAgreed: true,
      converged: true,
    };
    cells[cellKey(TEST_ARCHETYPE, "VALVE-1", "valve_close", hours)] = {
      deltaPersonHoursLow: 0,
      deltaPersonHoursHigh: 200 * hours,
      peakPeopleBelow: 120,
      band: "c2",
      bandAgreed: false,
      converged: true,
    };
  }

  return cells;
}

export const TEST_TABLE: ConsequenceTable = {
  archetypeId: TEST_ARCHETYPE,
  servedPopulation: TEST_SERVED,
  sweepM: [14, 21, 28],
  durationsHours: DURATIONS,
  solver: "test-fixture",
  cells: buildCells(),
};
