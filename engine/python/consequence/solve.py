"""
The consequence twin: EPANET 2.2 via WNTR, swept over required_pressure.

Two disciplines are enforced here rather than documented and hoped for.

**The sweep is mandatory.** WNTR's pressure-dependent-demand default for
`required_pressure` is 0.07 m, and its own documentation warns that leaving it
there makes a PDD run "very similar to a DD simulation". A headline outage
number produced at one unstated q is substantially an artefact of a config
value, so `solve_sweep` refuses fewer than two sweep points and reports the band
the outcome occupies ACROSS the sweep. If the sweep straddles a band edge the
result is INSUFFICIENT_EVIDENCE, not a number.

**Every result is a delta against its own baseline.** The same network, same
seed of demand pattern, same q, with the perturbation removed. Absolute
person-hours below threshold are dominated by whichever junctions sit near the
threshold anyway; only the difference is attributable to the attack.
"""

from __future__ import annotations

import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

import wntr

from .archetypes import Archetype
from .perturbation import Perturbation, apply as apply_perturbation

#: Reported when the sweep does not agree on a band.
INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

#: Hours after the attack window still counted toward its consequence. Service
#: does not return the instant control does — tanks have to refill and the
#: system has to re-pressurise — so a tail is part of the event, not padding.
RECOVERY_TAIL_HOURS = 12.0


@dataclass(frozen=True)
class PointResult:
    """Metrics at one required_pressure."""

    required_pressure_m: float
    person_hours_below: float
    peak_nodes_below: int
    peak_people_below: int
    #: same run with the perturbation removed
    baseline_person_hours_below: float
    baseline_peak_people_below: int
    #: the attributable effect — what this module actually claims
    delta_person_hours: float
    delta_peak_people: int
    converged: bool
    note: str = ""


@dataclass(frozen=True)
class SweepResult:
    archetype: str
    perturbation: dict
    served_population: int
    points: list[PointResult]
    #: min/max of delta_person_hours across the sweep
    delta_person_hours_low: float
    delta_person_hours_high: float
    #: band id when the whole sweep agrees, else INSUFFICIENT_EVIDENCE
    band: str
    band_agreed: bool
    demand_driven_baseline_person_hours: float


def _junction_columns(archetype: Archetype) -> list[str]:
    """
    Demand nodes only.

    The models carry zero-demand helper junctions (pump suction/discharge) that
    exist to give a pump somewhere to attach. They serve nobody, so counting
    their pressure would inflate node counts with places no customer stands.
    """
    return sorted(archetype.population)


def _run(
    wn: wntr.network.WaterNetworkModel, workdir: Path, tag: str
):
    sim = wntr.sim.EpanetSimulator(wn)
    return sim.run_sim(file_prefix=str(workdir / tag))


def _metrics(
    results, archetype: Archetype, junctions: list[str], threshold_m: float,
    timestep_hours: float, window: tuple[float, float] | None = None,
) -> tuple[float, int, int]:
    """
    (person_hours_below, peak_nodes_below, peak_people_below).

    `window` restricts measurement to (start_hour, end_hour) of simulated time.
    It is not an optimisation. The archetypes cycle their pumps on tank level,
    so an attack shifts the cycle's PHASE, and hours later the attacked and
    baseline runs are pumping out of step through no ongoing fault of the
    attack. Differencing over the whole run therefore mixes the event with that
    phase noise, and the noise is signed — it produced deltas implying an attack
    IMPROVES service. Measuring over the event and its recovery tail keeps the
    difference attributable to the thing being measured.
    """
    pressure = results.node["pressure"][junctions]
    population = archetype.population

    if window is not None:
        start_s, end_s = window[0] * 3600, window[1] * 3600
        pressure = pressure[(pressure.index >= start_s) & (pressure.index <= end_s)]

    below = pressure < threshold_m

    # Person-hours: each reporting interval contributes its own length. The
    # first row is the initial condition at t=0 and represents no elapsed time,
    # so it is excluded — including it would credit the attack with an hour it
    # did not have.
    per_step_people = below.iloc[1:].apply(
        lambda row: sum(population[j] for j in junctions if row[j]), axis=1
    )
    person_hours = float(per_step_people.sum() * timestep_hours)

    nodes_below = below.sum(axis=1)
    peak_nodes = int(nodes_below.max()) if len(nodes_below) else 0

    people_below = below.apply(
        lambda row: sum(population[j] for j in junctions if row[j]), axis=1
    )
    peak_people = int(people_below.max()) if len(people_below) else 0

    return person_hours, peak_nodes, peak_people


def solve_point(
    archetype: Archetype,
    perturbation: Perturbation,
    required_pressure_m: float,
    workdir: Path,
) -> PointResult:
    window_end = (
        perturbation.start_hour + perturbation.duration_hours + RECOVERY_TAIL_HOURS
    )

    def build(with_attack: bool) -> wntr.network.WaterNetworkModel:
        wn = archetype.build()
        wn.options.hydraulic.demand_model = "PDD"
        wn.options.hydraulic.required_pressure = required_pressure_m
        wn.options.hydraulic.minimum_pressure = 0.0
        # A long perturbation must not run past the end of the simulation, or
        # its tail is silently truncated and long attacks score as short ones.
        wn.options.time.duration = max(
            wn.options.time.duration, int((window_end + 6) * 3600)
        )
        if with_attack:
            apply_perturbation(wn, archetype, perturbation)
        return wn

    junctions = _junction_columns(archetype)
    timestep_hours = 900 / 3600
    window = (
        perturbation.start_hour,
        perturbation.start_hour + perturbation.duration_hours + RECOVERY_TAIL_HOURS,
    )

    try:
        attacked = _run(build(True), workdir, f"atk_{required_pressure_m:.3f}")
        baseline = _run(build(False), workdir, f"base_{required_pressure_m:.3f}")
    except Exception as exc:  # EPANET convergence or model error
        return PointResult(
            required_pressure_m=required_pressure_m,
            person_hours_below=0.0,
            peak_nodes_below=0,
            peak_people_below=0,
            baseline_person_hours_below=0.0,
            baseline_peak_people_below=0,
            delta_person_hours=0.0,
            delta_peak_people=0,
            converged=False,
            note=f"{type(exc).__name__}: {exc}",
        )

    a_hours, a_nodes, a_people = _metrics(
        attacked, archetype, junctions, required_pressure_m, timestep_hours, window
    )
    b_hours, _, b_people = _metrics(
        baseline, archetype, junctions, required_pressure_m, timestep_hours, window
    )

    return PointResult(
        required_pressure_m=required_pressure_m,
        person_hours_below=a_hours,
        peak_nodes_below=a_nodes,
        peak_people_below=a_people,
        baseline_person_hours_below=b_hours,
        baseline_peak_people_below=b_people,
        delta_person_hours=a_hours - b_hours,
        delta_peak_people=a_people - b_people,
        converged=True,
    )


def _demand_driven_baseline(
    archetype: Archetype, perturbation: Perturbation, workdir: Path
) -> float:
    """
    The same attack under demand-driven demands.

    Reported beside every sweep because DD is what a reader assumes they are
    being shown unless told otherwise, and the gap between DD and PDD is the
    honest measure of how much the pressure model is doing the work.
    """
    wn = archetype.build()
    wn.options.hydraulic.demand_model = "DD"
    apply_perturbation(wn, archetype, perturbation)
    junctions = _junction_columns(archetype)
    try:
        results = _run(wn, workdir, "dd")
    except Exception:
        return float("nan")
    # DD never curtails demand, so "below threshold" is read at a fixed 20 m
    # purely as a pressure statistic, over the same window as the PDD points.
    window = (
        perturbation.start_hour,
        perturbation.start_hour + perturbation.duration_hours + RECOVERY_TAIL_HOURS,
    )
    hours, _, _ = _metrics(results, archetype, junctions, 20.0, 900 / 3600, window)
    return hours


def solve_sweep(
    archetype: Archetype,
    perturbation: Perturbation,
    required_pressure_sweep_m: list[float],
    band_edges: list[float] | None = None,
) -> SweepResult:
    if len(required_pressure_sweep_m) < 2:
        raise ValueError(
            "required_pressure sweep needs at least two DISTINCT points — a "
            "single-q run reports a config artefact as a finding"
        )
    if len(set(required_pressure_sweep_m)) < 2:
        raise ValueError(
            f"sweep {required_pressure_sweep_m} has no span; repeating a value "
            "satisfies arity but not the discipline the sweep exists for"
        )

    perturbation.validate(archetype)

    with tempfile.TemporaryDirectory(prefix="proteus-wntr-") as tmp:
        workdir = Path(tmp)
        points = [
            solve_point(archetype, perturbation, q, workdir)
            for q in sorted(required_pressure_sweep_m)
        ]
        dd_baseline = _demand_driven_baseline(archetype, perturbation, workdir)

    converged = [p for p in points if p.converged]
    deltas = [p.delta_person_hours for p in converged] or [0.0]
    low, high = min(deltas), max(deltas)

    band = INSUFFICIENT_EVIDENCE
    agreed = False
    if band_edges and converged:
        low_band = _band_of(low, band_edges)
        high_band = _band_of(high, band_edges)
        agreed = low_band == high_band
        band = low_band if agreed else INSUFFICIENT_EVIDENCE

    return SweepResult(
        archetype=archetype.id,
        perturbation=asdict(perturbation),
        served_population=archetype.served,
        points=points,
        delta_person_hours_low=low,
        delta_person_hours_high=high,
        band=band,
        band_agreed=agreed,
        demand_driven_baseline_person_hours=dd_baseline,
    )


def _band_of(value: float, edges: list[float]) -> str:
    """Band id for a value given ascending interior edges."""
    for i, edge in enumerate(edges):
        if value < edge:
            return f"c{i + 1}"
    return f"c{len(edges) + 1}"
