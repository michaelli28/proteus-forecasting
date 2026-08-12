"""
JSON bridge: the only way TypeScript talks to the solver.

Reads one request object on stdin, writes one response object on stdout, logs
progress to stderr. No arguments, no files, no network — the surface is a single
pipe so the TypeScript side cannot smuggle a topology in.

Commands:
  {"command": "describe"}
      -> archetypes and their component registers, so the adversary model does
         not maintain a second copy of the component list.

  {"command": "table", "sweepM": [...], "durationsHours": [...],
   "startHour": 6.0, "bandEdgesPersonHours": [...], "archetypes": [...]}
      -> the full consequence table: one entry per
         (archetype, component, kind, duration) cell.

The table is the deterministic map g the ensemble pushes particles through.
Precomputing it is what lets the simulation kernel stay synchronous and seeded:
a tick looks up a cell, it never shells out.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict

from .archetypes import ARCHETYPES, get
from .perturbation import KIND_FOR_COMPONENT, Perturbation
from .solve import solve_sweep


def _describe() -> dict:
    return {
        "archetypes": [
            {
                "id": a.id,
                "description": a.description,
                "servedPopulation": a.served,
                "junctions": len(a.population),
                "components": [
                    {
                        "id": c.id,
                        "kind": c.kind,
                        "zone": c.zone,
                        "perturbation": KIND_FOR_COMPONENT[c.kind],
                    }
                    for c in a.components
                ],
            }
            for a in ARCHETYPES.values()
        ]
    }


def _cell_key(archetype: str, component: str, kind: str, duration: float) -> str:
    return f"{archetype}|{component}|{kind}|{duration:g}"


def _table(request: dict) -> dict:
    sweep = [float(q) for q in request["sweepM"]]
    durations = [float(d) for d in request["durationsHours"]]
    start_hour = float(request.get("startHour", 6.0))
    band_edges = [float(e) for e in request.get("bandEdgesPersonHours", [])]
    wanted = request.get("archetypes") or sorted(ARCHETYPES)

    if not durations:
        raise ValueError("durationsHours must be non-empty")

    entries: dict[str, dict] = {}
    total = sum(len(get(a).components) * len(durations) for a in wanted)
    done = 0

    for archetype_id in wanted:
        archetype = get(archetype_id)

        # The no-attack cell. Its delta is zero by construction, and it is
        # present so the lookup never has to special-case "the adversary did
        # nothing" — an absent key and a zero-effect key are different bugs.
        entries[_cell_key(archetype_id, "-", "none", 0)] = {
            "deltaPersonHoursLow": 0.0,
            "deltaPersonHoursHigh": 0.0,
            "peakPeopleBelow": 0,
            "band": "c1" if band_edges else "",
            "bandAgreed": True,
            "converged": True,
            "servedPopulation": archetype.served,
        }

        for component in archetype.components:
            kind = KIND_FOR_COMPONENT[component.kind]
            for duration in durations:
                perturbation = Perturbation(
                    kind=kind,
                    component=component.id,
                    start_hour=start_hour,
                    duration_hours=duration,
                )
                result = solve_sweep(archetype, perturbation, sweep, band_edges or None)
                entries[_cell_key(archetype_id, component.id, kind, duration)] = {
                    "deltaPersonHoursLow": result.delta_person_hours_low,
                    "deltaPersonHoursHigh": result.delta_person_hours_high,
                    "peakPeopleBelow": max(
                        (p.delta_peak_people for p in result.points if p.converged),
                        default=0,
                    ),
                    "band": result.band,
                    "bandAgreed": result.band_agreed,
                    "converged": all(p.converged for p in result.points),
                    "servedPopulation": result.served_population,
                    "demandDrivenBaselinePersonHours": (
                        result.demand_driven_baseline_person_hours
                    ),
                    "points": [asdict(p) for p in result.points],
                }
                done += 1
                print(
                    f"[consequence] {done}/{total} {archetype_id} {component.id} "
                    f"{kind} {duration:g}h",
                    file=sys.stderr,
                )

    return {
        "sweepM": sweep,
        "durationsHours": durations,
        "startHour": start_hour,
        "bandEdgesPersonHours": band_edges,
        "solver": "wntr/EPANET-2.2",
        # The register travels with the table so the TypeScript side needs one
        # subprocess call, not two, and cannot end up holding a component list
        # that disagrees with the cells it indexes.
        **_describe(),
        "entries": entries,
    }


def main() -> int:
    try:
        request = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        json.dump({"ok": False, "error": f"malformed request: {exc}"}, sys.stdout)
        return 2

    command = request.get("command")
    try:
        if command == "describe":
            payload = _describe()
        elif command == "table":
            payload = _table(request)
        else:
            raise ValueError(f"unknown command {command!r}")
    except Exception as exc:
        json.dump({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, sys.stdout)
        return 1

    json.dump({"ok": True, **payload}, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
