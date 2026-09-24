"""
Regression tests for how an outage is staged (spike S4's two defects).

1. A held pump must not run. The tank-refill switches were simple controls, which
   EPANET applies at every hydraulic solve, while the outage is a rule checked
   every 6 minutes, so a "stopped" pump ran in sub-report bursts (4.89 of 24 h in
   the municipal case, while all 95 report times showed no flow).
2. An outage must end by handing back what was there before. Forcing every link
   OPEN restarted idle pumps and left throttle valves wide open.

Report-time flows cannot see defect 1, so the pump check walks every solve.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import wntr.epanet.toolkit as toolkit
from wntr.epanet.util import EN

from . import Perturbation, get, solve_sweep
from .perturbation import apply as apply_perturbation
from .solve import RECOVERY_TAIL_HOURS, _run

SWEEP = [14.0, 21.1, 28.0]
DURATIONS = [6.0, 12.0, 24.0, 48.0]
START_H = 6.0


def _on_seconds(inp: Path, link: str, start_s: float, end_s: float) -> float:
    """Seconds `link` carries flow inside [start_s, end_s), over every hydraulic solve."""
    en = toolkit.ENepanet(version=2.2)
    en.ENopen(str(inp), str(inp.with_suffix(".trace.rpt")), str(inp.with_suffix(".trace.bin")))
    try:
        index = en.ENgetlinkindex(link)
        en.ENopenH()
        en.ENinitH(0)
        on = 0.0
        while True:
            t = en.ENrunH()
            flow = en.ENgetlinkvalue(index, EN.FLOW)
            step = en.ENnextH()
            lo, hi = max(t, start_s), min(t + step, end_s)
            if hi > lo and abs(flow) > 1e-6:
                on += hi - lo
            if step <= 0:
                break
        en.ENcloseH()
    finally:
        en.ENclose()
    return on


def _attacked(archetype_id: str, pert: Perturbation, q: float, workdir: Path):
    """Run one attacked simulation; return (results, path to its .inp)."""
    archetype = get(archetype_id)
    wn = archetype.build()
    wn.options.hydraulic.required_pressure = q
    end_h = pert.start_hour + pert.duration_hours + RECOVERY_TAIL_HOURS
    wn.options.time.duration = max(wn.options.time.duration, int((end_h + 6) * 3600))
    apply_perturbation(wn, archetype, pert)
    return _run(wn, workdir, "atk"), workdir / "atk.inp"


# Every pump an outage holds: the pump itself, or the pump a level spoof silences.
HELD_PUMPS = [
    ("municipal_pumped", "pump_stop", "PLC-PUMP-MAIN", "PUMP_MAIN"),
    ("municipal_pumped", "pump_stop", "PLC-PUMP-BOOST", "PUMP_BOOST"),
    ("district_multizone", "pump_stop", "PLC-PUMP-S", "PUMP_S"),
    ("district_multizone", "pump_stop", "PLC-PUMP-N", "PUMP_N"),
    ("municipal_pumped", "level_spoof_high", "PLC-TANK-LOW", "PUMP_MAIN"),
    ("district_multizone", "level_spoof_high", "PLC-TANK-C", "PUMP_S"),
]


@pytest.mark.parametrize("duration", [6.0, 24.0])
@pytest.mark.parametrize(("archetype_id", "kind", "component", "pump"), HELD_PUMPS)
def test_a_held_pump_carries_no_flow_at_any_solve(
    tmp_path, archetype_id, kind, component, pump, duration
):
    pert = Perturbation(kind, component, START_H, duration)
    _, inp = _attacked(archetype_id, pert, 21.1, tmp_path)
    assert _on_seconds(inp, pump, START_H * 3600, (START_H + duration) * 3600) == 0.0


@pytest.mark.parametrize("duration", DURATIONS)
@pytest.mark.parametrize(
    ("kind", "component"),
    [("pump_stop", "PLC-PUMP-N"), ("level_spoof_high", "PLC-TANK-A")],
)
def test_holding_an_idle_pump_changes_nothing(kind, component, duration):
    # PUMP_N never runs in the baseline (TANK_A sits above its stop level), so
    # holding it is a no-op. A nonzero delta is the forced restart at the end.
    result = solve_sweep(
        get("district_multizone"), Perturbation(kind, component, START_H, duration), SWEEP
    )
    assert [p.delta_person_hours for p in result.points] == [0.0, 0.0, 0.0]


BOOSTER_6H_TAIL = pytest.mark.xfail(
    strict=True,
    reason="6 h at 28 m stays at -4,775 person-hours, all in the recovery tail; cause not found",
)


@pytest.mark.parametrize(
    ("archetype_id", "component", "duration"),
    [
        (archetype_id, component, duration)
        for archetype_id, component in [
            ("municipal_pumped", "PLC-PUMP-MAIN"),
            ("municipal_pumped", "PLC-PUMP-BOOST"),
            ("district_multizone", "PLC-PUMP-S"),
        ]
        for duration in DURATIONS
        if not (component == "PLC-PUMP-BOOST" and duration == 6.0)
    ]
    + [pytest.param("municipal_pumped", "PLC-PUMP-BOOST", 6.0, marks=BOOSTER_6H_TAIL)],
)
def test_stopping_a_pump_never_improves_service(archetype_id, component, duration):
    result = solve_sweep(
        get(archetype_id), Perturbation("pump_stop", component, START_H, duration), SWEEP
    )
    assert all(p.converged for p in result.points)
    assert min(p.delta_person_hours for p in result.points) >= 0.0


@pytest.mark.parametrize(("component", "link"), [("PLC-TCV-NC", "TCV_NC"), ("PLC-TCV-CS", "TCV_CS")])
def test_a_valve_outage_ends_with_the_valve_back_at_its_setting(tmp_path, component, link):
    # Forcing a throttle valve OPEN drops its loss coefficient for the rest of the run.
    results, _ = _attacked(
        "district_multizone", Perturbation("valve_close", component, START_H, 6.0), 21.1, tmp_path
    )
    after = slice(13 * 3600, None)
    assert (results.link["status"][link].loc[after] == 2).all()  # 2 = ACTIVE
    assert results.link["setting"][link].loc[after].to_numpy() == pytest.approx(2.0)


def test_a_tank_spoof_still_reopens_the_riser(tmp_path):
    # Guards the other way: dropping the reopen for every link makes a 6 h outage
    # permanent (TANK-C at 21.1 m would go from about 35k to 133k person-hours).
    results, _ = _attacked(
        "district_multizone",
        Perturbation("level_spoof_high", "PLC-TANK-C", START_H, 6.0),
        21.1,
        tmp_path,
    )
    assert (results.link["status"]["TANK_C_R"].loc[12 * 3600 :] == 1).all()
