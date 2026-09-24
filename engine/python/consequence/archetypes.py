"""
Synthetic water-system archetypes.

SCOPE BOUNDARY, enforced by construction: every network here is generated from
constants in this file. Nothing reads an .inp from disk, nothing accepts a
topology over the wire, and no archetype corresponds to a real utility. The
component register carries opaque ids ("PLC-PUMP-A"), never an asset name, a
vendor, a firmware version, or a location.

Archetypes are drawn to span the structural variation that matters for
consequence — gravity vs pumped, single vs multi-zone, tank buffering depth —
because those are what decide whether a given control perturbation reaches the
customer at all.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import wntr

# Litres per person per day, converted to m^3/s at the junction. A mid-range
# figure for US residential service; it scales person-hours linearly, so it is
# reported alongside every result rather than buried.
LITRES_PER_PERSON_DAY = 400.0
_M3S_PER_PERSON = LITRES_PER_PERSON_DAY / 1000.0 / 86400.0

# Roughness (Hazen-Williams C) for ductile iron in service.
PIPE_ROUGHNESS = 100.0


@dataclass(frozen=True)
class Component:
    """
    One controllable OT element, as the adversary model sees it.

    `element` is the hydraulic object the perturbation acts on. `kind` decides
    which perturbations are even expressible against it — a level sensor cannot
    be "stopped", a pump cannot be "spoofed low" into refilling.

    `linked_pump` is set on tank_level components whose reading drives a pump's
    on/off control. Spoofing that reading high stops the pump AND removes the
    tank's storage at the same time, which is why a level compromise is not the
    same event as stopping the pump directly.
    """

    id: str
    kind: str  # pump | valve | tank_level | booster
    element: str  # the WNTR element name it controls
    zone: str
    linked_pump: str | None = None


@dataclass(frozen=True)
class Archetype:
    id: str
    description: str
    build: Callable[[], wntr.network.WaterNetworkModel]
    components: tuple[Component, ...]
    #: junction name -> people served
    population: dict[str, int] = field(default_factory=dict)

    @property
    def served(self) -> int:
        return sum(self.population.values())


def _demand_for(people: int) -> float:
    return people * _M3S_PER_PERSON


def _level_control(
    wn: wntr.network.WaterNetworkModel,
    pump: str,
    tank: str,
    lo: float,
    hi: float,
) -> None:
    """
    Standard fill control: pump runs when the tank drops below `lo`, stops above `hi`.

    Without this the pumps run flat out forever, storage never discharges, and
    isolating a tank measures as harmless — which would report the level sensors
    as unimportant when they are the reason the pumps know what to do.

    These are low-priority RULES, not simple controls. EPANET applies a simple
    control at every hydraulic solve and uses rule priority only between rules,
    so as a control the fill switch overrode an outage rule between its 6-minute
    checks and a "stopped" pump kept running in bursts.
    """
    link = wn.get_link(pump)
    node = wn.get_node(tank)
    controls = wntr.network.controls

    for name, op, level, status in (
        (f"FILL_{pump}", "<", lo, wntr.network.LinkStatus.Open),
        (f"REST_{pump}", ">", hi, wntr.network.LinkStatus.Closed),
    ):
        wn.add_control(
            name,
            controls.Rule(
                controls.ValueCondition(node, "level", op, level),
                [controls.ControlAction(link, "status", status)],
                priority=controls.ControlPriority.low,
                name=name,
            ),
        )


def _base_options(wn: wntr.network.WaterNetworkModel, hours: int) -> None:
    wn.options.time.duration = hours * 3600
    wn.options.time.hydraulic_timestep = 900
    wn.options.time.report_timestep = 900
    wn.options.time.pattern_timestep = 3600
    wn.options.hydraulic.demand_model = "PDD"
    # required_pressure is deliberately NOT set here. solve.py sets it per sweep
    # point, and a default left in place is exactly the artefact the sweep exists
    # to expose.
    wn.options.hydraulic.minimum_pressure = 0.0
    wn.options.hydraulic.pressure_exponent = 0.5


# Diurnal demand multipliers, hourly. Morning and evening peaks are when a
# pressure deficit actually strands people, so a flat pattern would understate
# every consequence.
DIURNAL = [
    0.45, 0.35, 0.30, 0.30, 0.40, 0.70, 1.15, 1.45, 1.35, 1.15, 1.05, 1.00,
    1.00, 0.95, 0.95, 1.00, 1.15, 1.40, 1.50, 1.35, 1.10, 0.90, 0.70, 0.55,
]


# ─────────────────────────── rural gravity ───────────────────────────


_RURAL_POP = {
    "J1": 240, "J2": 310, "J3": 180, "J4": 260,
    "J5": 150, "J6": 220, "J7": 190, "J8": 130,
}


def _build_rural_gravity() -> wntr.network.WaterNetworkModel:
    wn = wntr.network.WaterNetworkModel()
    wn.add_pattern("diurnal", DIURNAL)

    wn.add_reservoir("SRC", base_head=95.0, coordinates=(0, 0))
    wn.add_tank(
        "TANK_A", elevation=70.0, init_level=4.5, min_level=0.6, max_level=7.0,
        diameter=11.0, coordinates=(300, 260),
    )

    elevations = {
        "J1": 30.0, "J2": 32.0, "J3": 36.0, "J4": 41.0,
        "J5": 47.0, "J6": 52.0, "J7": 58.0, "J8": 63.0,
    }
    for i, (name, elev) in enumerate(elevations.items()):
        wn.add_junction(
            name,
            base_demand=_demand_for(_RURAL_POP[name]),
            demand_pattern="diurnal",
            elevation=elev,
            coordinates=(120 * (i + 1), 40 * i),
        )

    # Gravity main from source through the town, with the tank floating on the
    # far end — the classic small-system layout where the tank is the only
    # buffer between a control failure and an empty pipe.
    wn.add_pipe("MAIN_1", "SRC", "J1", length=900.0, diameter=0.30, roughness=PIPE_ROUGHNESS)
    chain = ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8"]
    for i in range(len(chain) - 1):
        wn.add_pipe(
            f"MAIN_{i + 2}", chain[i], chain[i + 1],
            length=420.0, diameter=0.25 if i < 4 else 0.20, roughness=PIPE_ROUGHNESS,
        )
    wn.add_pipe("TANK_RISER", "J4", "TANK_A", length=180.0, diameter=0.25, roughness=PIPE_ROUGHNESS)

    # The single isolation valve an operator would use to section the main.
    wn.add_valve("PRV_A", "J5", "J6", diameter=0.20, valve_type="PRV", initial_setting=45.0)

    _base_options(wn, hours=48)
    return wn


RURAL_GRAVITY = Archetype(
    id="rural_gravity",
    description="Small gravity-fed system, one tank, single main, ~1,680 served",
    build=_build_rural_gravity,
    components=(
        Component("PLC-TANK-A", "tank_level", "TANK_A", "core"),
        Component("PLC-PRV-A", "valve", "PRV_A", "upper"),
    ),
    population=dict(_RURAL_POP),
)


# ───────────────────────── municipal pumped ──────────────────────────


_MUNI_POP = {
    "M1": 820, "M2": 940, "M3": 1100, "M4": 760, "M5": 690,
    "M6": 1250, "M7": 880, "M8": 610, "M9": 540, "M10": 720,
    "M11": 470, "M12": 390,
}


def _build_municipal_pumped() -> wntr.network.WaterNetworkModel:
    wn = wntr.network.WaterNetworkModel()
    wn.add_pattern("diurnal", DIURNAL)

    wn.add_reservoir("SRC", base_head=20.0, coordinates=(0, 0))
    wn.add_junction("PUMP_SUC", base_demand=0.0, elevation=18.0, coordinates=(40, 0))
    wn.add_junction("PUMP_DIS", base_demand=0.0, elevation=18.0, coordinates=(90, 0))

    wn.add_tank(
        "TANK_LOW", elevation=48.0, init_level=5.0, min_level=0.8, max_level=8.0,
        diameter=16.0, coordinates=(420, 180),
    )
    wn.add_tank(
        "TANK_HIGH", elevation=76.0, init_level=4.0, min_level=0.8, max_level=6.5,
        diameter=11.0, coordinates=(700, 420),
    )

    low_zone = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"]
    high_zone = ["M8", "M9", "M10", "M11", "M12"]
    elevations = {
        "M1": 22.0, "M2": 24.0, "M3": 26.0, "M4": 25.0, "M5": 28.0,
        "M6": 30.0, "M7": 27.0,
        "M8": 52.0, "M9": 55.0, "M10": 58.0, "M11": 61.0, "M12": 64.0,
    }
    for i, name in enumerate(low_zone + high_zone):
        wn.add_junction(
            name,
            base_demand=_demand_for(_MUNI_POP[name]),
            demand_pattern="diurnal",
            elevation=elevations[name],
            coordinates=(150 + 70 * i, 60 + 25 * (i % 5)),
        )

    wn.add_pipe("SUCTION", "SRC", "PUMP_SUC", length=60.0, diameter=0.45, roughness=PIPE_ROUGHNESS)
    wn.add_pump("PUMP_MAIN", "PUMP_SUC", "PUMP_DIS", pump_type="POWER", pump_parameter=95000.0)
    wn.add_pipe("DISCHARGE", "PUMP_DIS", "M1", length=200.0, diameter=0.40, roughness=PIPE_ROUGHNESS)

    for i in range(len(low_zone) - 1):
        wn.add_pipe(
            f"LOW_{i + 1}", low_zone[i], low_zone[i + 1],
            length=380.0, diameter=0.30, roughness=PIPE_ROUGHNESS,
        )
    wn.add_pipe("LOW_TANK", "M4", "TANK_LOW", length=220.0, diameter=0.35, roughness=PIPE_ROUGHNESS)

    # Booster into the high zone — the single point every upper-zone customer
    # depends on, and therefore the most consequential thing to compromise.
    wn.add_junction("BOOST_SUC", base_demand=0.0, elevation=30.0, coordinates=(560, 200))
    wn.add_pipe("BOOST_FEED", "M6", "BOOST_SUC", length=260.0, diameter=0.30, roughness=PIPE_ROUGHNESS)
    wn.add_pump("PUMP_BOOST", "BOOST_SUC", "M8", pump_type="POWER", pump_parameter=42000.0)

    for i in range(len(high_zone) - 1):
        wn.add_pipe(
            f"HIGH_{i + 1}", high_zone[i], high_zone[i + 1],
            length=340.0, diameter=0.25, roughness=PIPE_ROUGHNESS,
        )
    wn.add_pipe("HIGH_TANK", "M10", "TANK_HIGH", length=200.0, diameter=0.25, roughness=PIPE_ROUGHNESS)

    _level_control(wn, "PUMP_MAIN", "TANK_LOW", lo=4.0, hi=7.2)
    _level_control(wn, "PUMP_BOOST", "TANK_HIGH", lo=3.2, hi=5.8)

    _base_options(wn, hours=48)
    return wn


MUNICIPAL_PUMPED = Archetype(
    id="municipal_pumped",
    description="Two-zone pumped municipal system, booster to high zone, ~9,170 served",
    build=_build_municipal_pumped,
    components=(
        Component("PLC-PUMP-MAIN", "pump", "PUMP_MAIN", "low"),
        Component("PLC-PUMP-BOOST", "pump", "PUMP_BOOST", "high"),
        Component("PLC-TANK-LOW", "tank_level", "TANK_LOW", "low", linked_pump="PUMP_MAIN"),
        Component("PLC-TANK-HIGH", "tank_level", "TANK_HIGH", "high", linked_pump="PUMP_BOOST"),
    ),
    population=dict(_MUNI_POP),
)


# ──────────────────────── district multizone ─────────────────────────


_DIST_POP = {f"D{i}": 300 + (i * 137) % 900 for i in range(1, 19)}


def _build_district_multizone() -> wntr.network.WaterNetworkModel:
    wn = wntr.network.WaterNetworkModel()
    wn.add_pattern("diurnal", DIURNAL)

    wn.add_reservoir("SRC_N", base_head=22.0, coordinates=(0, 400))
    wn.add_reservoir("SRC_S", base_head=22.0, coordinates=(0, 0))

    for tag, coords, elev in (("N", (60, 400), 20.0), ("S", (60, 0), 20.0)):
        wn.add_junction(f"SUC_{tag}", base_demand=0.0, elevation=elev, coordinates=coords)
        wn.add_junction(
            f"DIS_{tag}", base_demand=0.0, elevation=elev,
            coordinates=(coords[0] + 50, coords[1]),
        )

    wn.add_pipe("SUCT_N", "SRC_N", "SUC_N", length=50.0, diameter=0.50, roughness=PIPE_ROUGHNESS)
    wn.add_pipe("SUCT_S", "SRC_S", "SUC_S", length=50.0, diameter=0.50, roughness=PIPE_ROUGHNESS)
    wn.add_pump("PUMP_N", "SUC_N", "DIS_N", pump_type="POWER", pump_parameter=110000.0)
    wn.add_pump("PUMP_S", "SUC_S", "DIS_S", pump_type="POWER", pump_parameter=110000.0)

    for tag, elev, coords, diameter in (
        ("A", 55.0, (500, 500), 15.0),
        ("B", 62.0, (900, 250), 13.0),
        ("C", 70.0, (500, 20), 12.0),
    ):
        wn.add_tank(
            f"TANK_{tag}", elevation=elev, init_level=4.2, min_level=0.7,
            max_level=7.5, diameter=diameter, coordinates=coords,
        )

    zones = {"north": [f"D{i}" for i in range(1, 7)],
             "central": [f"D{i}" for i in range(7, 13)],
             "south": [f"D{i}" for i in range(13, 19)]}
    base_elev = {"north": 26.0, "central": 34.0, "south": 44.0}

    for zone, members in zones.items():
        for i, name in enumerate(members):
            wn.add_junction(
                name,
                base_demand=_demand_for(_DIST_POP[name]),
                demand_pattern="diurnal",
                elevation=base_elev[zone] + 2.0 * i,
                coordinates=(200 + 120 * i, {"north": 420, "central": 220, "south": 40}[zone]),
            )
        for i in range(len(members) - 1):
            wn.add_pipe(
                f"{zone.upper()}_{i + 1}", members[i], members[i + 1],
                length=360.0, diameter=0.28, roughness=PIPE_ROUGHNESS,
            )

    wn.add_pipe("FEED_N", "DIS_N", "D1", length=240.0, diameter=0.40, roughness=PIPE_ROUGHNESS)
    wn.add_pipe("FEED_S", "DIS_S", "D13", length=240.0, diameter=0.40, roughness=PIPE_ROUGHNESS)

    wn.add_pipe("TANK_A_R", "D3", "TANK_A", length=200.0, diameter=0.30, roughness=PIPE_ROUGHNESS)
    wn.add_pipe("TANK_B_R", "D9", "TANK_B", length=200.0, diameter=0.28, roughness=PIPE_ROUGHNESS)
    wn.add_pipe("TANK_C_R", "D15", "TANK_C", length=200.0, diameter=0.28, roughness=PIPE_ROUGHNESS)

    # Zone-transfer valves. Closing one strands a zone on its tank alone; that
    # is the whole point of instrumenting them separately from the pumps.
    wn.add_valve("TCV_NC", "D6", "D7", diameter=0.28, valve_type="TCV", initial_setting=2.0)
    wn.add_valve("TCV_CS", "D12", "D13", diameter=0.28, valve_type="TCV", initial_setting=2.0)

    _level_control(wn, "PUMP_N", "TANK_A", lo=3.6, hi=6.8)
    _level_control(wn, "PUMP_S", "TANK_C", lo=3.4, hi=6.6)

    _base_options(wn, hours=48)
    return wn


DISTRICT_MULTIZONE = Archetype(
    id="district_multizone",
    description="Three-zone district, dual source, three tanks, transfer valves, ~13,000 served",
    build=_build_district_multizone,
    components=(
        Component("PLC-PUMP-N", "pump", "PUMP_N", "north"),
        Component("PLC-PUMP-S", "pump", "PUMP_S", "south"),
        Component("PLC-TANK-A", "tank_level", "TANK_A", "north", linked_pump="PUMP_N"),
        Component("PLC-TANK-B", "tank_level", "TANK_B", "central"),
        Component("PLC-TANK-C", "tank_level", "TANK_C", "south", linked_pump="PUMP_S"),
        Component("PLC-TCV-NC", "valve", "TCV_NC", "central"),
        Component("PLC-TCV-CS", "valve", "TCV_CS", "south"),
    ),
    population=dict(_DIST_POP),
)


ARCHETYPES: dict[str, Archetype] = {
    a.id: a for a in (RURAL_GRAVITY, MUNICIPAL_PUMPED, DISTRICT_MULTIZONE)
}


def get(archetype_id: str) -> Archetype:
    if archetype_id not in ARCHETYPES:
        raise KeyError(
            f"unknown archetype {archetype_id!r}; have {sorted(ARCHETYPES)}"
        )
    return ARCHETYPES[archetype_id]
