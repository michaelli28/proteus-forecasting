"""
Control perturbations, expressed as hydraulic actions.

The vocabulary here is deliberately small and physical: a perturbation stops a
pump, closes a valve, or spoofs a tank level high, for a duration. It carries no
exploit, no protocol, no vendor, and no sequence of steps — the adversary model
upstream decides WHICH component and for HOW LONG, and this module only knows
what that does to water.

The mapping from disclosed instrument bands (exposure / lockout / logic
modification / setpoint-with-alarm-suppression) onto these actions lives in the
TypeScript adversary model, not here, so that the solver stays a pure
deterministic function of its arguments.

Attacks are installed as `very_high` priority rules over a time window. The
archetypes' level-based fill switches are `low` priority rules, so the attack
outranks the automation for the whole window; an attacker who owns the PLC owns
the output. When the window closes the automation resumes (see `_hold_closed`).
"""

from __future__ import annotations

from dataclasses import dataclass

import wntr
from wntr.network.controls import (
    AndCondition,
    Control,
    ControlAction,
    ControlPriority,
    Rule,
    SimTimeCondition,
)

from .archetypes import Archetype

PERTURBATION_KINDS = ("none", "pump_stop", "valve_close", "level_spoof_high")

#: Which action each component kind admits.
KIND_FOR_COMPONENT = {
    "pump": "pump_stop",
    "booster": "pump_stop",
    "valve": "valve_close",
    "tank_level": "level_spoof_high",
}


@dataclass(frozen=True)
class Perturbation:
    kind: str
    #: component id from the archetype's register; ignored when kind == "none"
    component: str
    start_hour: float
    duration_hours: float

    def validate(self, archetype: Archetype) -> None:
        if self.kind not in PERTURBATION_KINDS:
            raise ValueError(
                f"unknown perturbation kind {self.kind!r}; have {PERTURBATION_KINDS}"
            )
        if self.kind == "none":
            return
        if self.duration_hours <= 0:
            raise ValueError("duration_hours must be > 0 for an acting perturbation")
        if self.start_hour < 0:
            raise ValueError("start_hour must be >= 0")

        known = {c.id: c for c in archetype.components}
        if self.component not in known:
            raise ValueError(
                f"component {self.component!r} is not in {archetype.id}'s register: "
                f"{sorted(known)}"
            )

        component = known[self.component]
        expected = KIND_FOR_COMPONENT[component.kind]
        if self.kind != expected:
            raise ValueError(
                f"{self.kind} is not expressible against a {component.kind} "
                f"({self.component}); expected {expected}"
            )


def _riser_for_tank(wn: wntr.network.WaterNetworkModel, tank_name: str) -> str:
    """The pipe connecting a tank to the network. Tanks here have exactly one."""
    risers = [
        name
        for name, link in wn.links()
        if link.start_node_name == tank_name or link.end_node_name == tank_name
    ]
    if len(risers) != 1:
        raise ValueError(
            f"tank {tank_name} has {len(risers)} connecting links; expected exactly 1"
        )
    return risers[0]


def _hold_closed(
    wn: wntr.network.WaterNetworkModel, link_name: str, start: int, end: int, tag: str
) -> None:
    """Force a link closed for [start, end), then hand it back as it was."""
    link = wn.get_link(link_name)

    wn.add_control(
        f"ATK_{tag}_{link_name}",
        Rule(
            AndCondition(
                SimTimeCondition(wn, ">=", start),
                SimTimeCondition(wn, "<", end),
            ),
            [ControlAction(link, "status", wntr.network.LinkStatus.Closed)],
            priority=ControlPriority.very_high,
            name=f"ATK_{tag}_{link_name}",
        ),
    )
    # A pump gets no recovery action: it stays off until its fill rule next
    # calls for it. Forcing it on at t=end restarted pumps that sit idle in the
    # baseline and scored the attack as an improvement.
    if isinstance(link, wntr.network.Pump):
        return

    # Everything else gets a ONE-SHOT at exactly t=end, not a standing ">= end"
    # rule, back to its own starting state. An ACTIVE valve is restored through
    # its setting: forcing it OPEN drops its throttle for the rest of the run,
    # and EPANET rejects "status = ACTIVE" in a control (error 200).
    if isinstance(link, wntr.network.Valve) and link.initial_status == wntr.network.LinkStatus.Active:
        action = ControlAction(link, "setting", link.initial_setting)
    else:
        action = ControlAction(link, "status", link.initial_status)
    wn.add_control(
        f"REC_{tag}_{link_name}",
        Control(
            SimTimeCondition(wn, "=", end),
            action,
            priority=ControlPriority.medium_high,
            name=f"REC_{tag}_{link_name}",
        ),
    )


def apply(
    wn: wntr.network.WaterNetworkModel,
    archetype: Archetype,
    perturbation: Perturbation,
) -> None:
    """
    Mutate `wn` in place so the perturbation is active over its window.

    The network runs normally before the window and recovers after it. A
    perturbation applied at t=0 with no recovery would measure "system with a
    broken pump", not "system under a timed attack", and the difference is the
    entire point of modelling duration.
    """
    perturbation.validate(archetype)
    if perturbation.kind == "none":
        return

    component = {c.id: c for c in archetype.components}[perturbation.component]
    start = int(perturbation.start_hour * 3600)
    end = int((perturbation.start_hour + perturbation.duration_hours) * 3600)

    if perturbation.kind in ("pump_stop", "valve_close"):
        _hold_closed(wn, component.element, start, end, "STOP")
        return

    # level_spoof_high: the PLC reports a full tank. Two things follow, and
    # modelling only one of them understates the event. The pump that fills on
    # that reading stops, AND the tank itself is cut out of the network, so the
    # storage that would have covered the gap is not there either. That joint
    # effect is what distinguishes a level compromise from stopping the pump.
    _hold_closed(wn, _riser_for_tank(wn, component.element), start, end, "SPOOF")
    if component.linked_pump:
        _hold_closed(wn, component.linked_pump, start, end, "SPOOF")
