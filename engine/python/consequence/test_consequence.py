"""
Tests for the water-system consequence twin.

Run with the project venv:  .venv/bin/python -m pytest python/consequence/
These exercise real EPANET, so they are slower than the TypeScript units; the
kernel-side logic is tested separately against a fixture table.
"""

from __future__ import annotations

import pytest

from . import ARCHETYPES, INSUFFICIENT_EVIDENCE, Perturbation, get, solve_sweep
from .archetypes import Component


def test_all_archetypes_build_and_have_registers():
    for archetype in ARCHETYPES.values():
        wn = archetype.build()
        assert len(wn.junction_name_list) >= len(archetype.population)
        assert archetype.served > 0
        assert len(archetype.components) >= 1


def test_component_ids_are_opaque_no_vendor_or_location():
    # The scope boundary: a register id must not smuggle a real vendor, product
    # or place name. This is a coarse guard, not a proof, but it fails loudly if
    # someone renames a component to something identifying.
    banned = ("unitronics", "schneider", "siemens", "aliquippa", "plymouth")
    for archetype in ARCHETYPES.values():
        for component in archetype.components:
            lowered = component.id.lower()
            assert not any(term in lowered for term in banned)


def test_sweep_rejects_fewer_than_two_points():
    archetype = get("rural_gravity")
    pert = Perturbation("level_spoof_high", "PLC-TANK-A", 6.0, 24.0)
    with pytest.raises(ValueError, match="at least two"):
        solve_sweep(archetype, pert, [20.0])


def test_sweep_rejects_a_zero_span_sweep():
    archetype = get("rural_gravity")
    pert = Perturbation("level_spoof_high", "PLC-TANK-A", 6.0, 24.0)
    with pytest.raises(ValueError, match="no span"):
        solve_sweep(archetype, pert, [20.0, 20.0])


def test_perturbation_must_match_component_kind():
    archetype = get("municipal_pumped")
    # A pump cannot be level-spoofed.
    pert = Perturbation("level_spoof_high", "PLC-PUMP-MAIN", 6.0, 24.0)
    with pytest.raises(ValueError, match="not expressible"):
        pert.validate(archetype)


def test_unknown_component_is_rejected():
    archetype = get("municipal_pumped")
    pert = Perturbation("pump_stop", "PLC-GHOST", 6.0, 24.0)
    with pytest.raises(ValueError, match="not in"):
        pert.validate(archetype)


def test_tank_spoof_strands_more_people_the_longer_it_runs():
    archetype = get("municipal_pumped")
    sweep = [14.0, 21.0, 28.0]
    short = solve_sweep(
        archetype,
        Perturbation("level_spoof_high", "PLC-TANK-LOW", 6.0, 6.0),
        sweep,
    )
    long = solve_sweep(
        archetype,
        Perturbation("level_spoof_high", "PLC-TANK-LOW", 6.0, 48.0),
        sweep,
    )
    # Consequence is monotone in duration for a robust chokepoint.
    assert long.delta_person_hours_low >= short.delta_person_hours_low
    assert all(p.converged for p in long.points)


def test_no_attack_baseline_has_zero_delta():
    archetype = get("municipal_pumped")
    result = solve_sweep(
        archetype,
        Perturbation("none", "-", 0.0, 0.0),
        [14.0, 21.0, 28.0],
    )
    for point in result.points:
        assert point.delta_person_hours == pytest.approx(0.0, abs=1e-6)


def test_straddling_sweep_reports_insufficient_evidence():
    archetype = get("municipal_pumped")
    # Band edges chosen so a positive-but-uncertain delta lands across a
    # boundary; the pump's short attack is the sweep-sensitive case.
    result = solve_sweep(
        archetype,
        Perturbation("pump_stop", "PLC-PUMP-BOOST", 6.0, 6.0),
        [14.0, 21.0, 28.0],
        band_edges=[100.0, 1000.0, 10000.0],
    )
    # Either it agrees on a band or it abstains — never a silent midpoint.
    assert result.band == INSUFFICIENT_EVIDENCE or result.band_agreed
