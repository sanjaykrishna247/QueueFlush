"""
QueueFlush AI — Physics Simulator
Produces a timeline of frames at 20 Hz for both conventional and predictive modes.
Deterministic given (params, seed).
"""
from __future__ import annotations
import random
import math
from dataclasses import dataclass, field
from typing import Literal

from app.engine.predictor import PredictorParams, compute_prediction, WEATHER_FACTOR
from app.engine.safety import evaluate_safety, SafetyEvent

# ── Vehicle physics constants ────────────────────────────────────────────────
CAR_LENGTH_M      = 4.5
BUS_LENGTH_M      = 12.0
TRUCK_LENGTH_M    = 10.0
STANDSTILL_GAP_M  = 2.5
CAR_ACCEL_MS2     = 2.0
HEAVY_ACCEL_MS2   = 1.2
CAR_DECEL_MS2     = 4.0
MAX_SPEED_MS      = 14.0   # ~50 km/h in-junction max

AMB_ACCEL_MS2     = 2.5
AMB_DECEL_MS2     = 5.0
AMB_LENGTH_M      = 6.0

# Simulation parameters
FPS = 20
DT  = 1.0 / FPS
# Road coordinate: 0 = stop line, negative = behind (queue), positive = beyond


VehicleType = Literal["car", "bus", "truck", "motorcycle", "auto-rickshaw"]

VEHICLE_COLORS = [
    "#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#64748B",
]
TYPE_COLOR = {
    "bus": "#D97706",
    "truck": "#6B7280",
    "motorcycle": "#8B5CF6",
    "auto-rickshaw": "#10B981",
    "car": None,  # use rotating colors
}


@dataclass
class Vehicle:
    id: int
    type: VehicleType
    length: float       # metres
    accel: float        # m/s²
    x: float            # metres from stop line (negative = queued behind)
    v: float = 0.0      # m/s
    started: bool = False
    reaction_delay: float = 0.0   # individual reaction delay
    start_time: float | None = None
    reacting: bool = False        # brief flag: amber ring active
    color: str = "#2563EB"
    passed: bool = False          # has crossed the stop line

    def length_for_type(vtype: str) -> float:
        return {"bus": BUS_LENGTH_M, "truck": TRUCK_LENGTH_M}.get(vtype, CAR_LENGTH_M)

    def accel_for_type(vtype: str) -> float:
        return HEAVY_ACCEL_MS2 if vtype in ("bus", "truck") else CAR_ACCEL_MS2


@dataclass
class AmbulanceState:
    x: float           # metres (starts far negative, ends positive)
    v: float
    target_v: float
    blocked: bool = False
    blocked_since: float | None = None
    blocked_total_s: float = 0.0
    arrived: bool = False
    crossing_time: float | None = None
    cleared: bool = False


@dataclass
class SimFrame:
    t: float
    vehicles: list[dict]      # {id, type, x, v, reacting, passed}
    ambulance: dict           # {x, v, blocked, blocked_s}
    signal: str               # "RED" | "YELLOW" | "GREEN"
    signal_changed_at: float | None
    prediction_label: str | None  # "Early GREEN in 3.2s" or None


@dataclass
class SimEvent:
    t: float
    category: str   # VISION | PREDICT | SAFETY | SIGNAL | VEHICLE | AMBULANCE
    message: str


@dataclass
class SimMetrics:
    ambulance_wait_s: float
    crossing_time_s: float
    queue_cleared_at_s: float
    ambulance_arrived_at_s: float


@dataclass
class SimResult:
    mode: Literal["conventional", "predictive"]
    frames: list[SimFrame]
    events: list[SimEvent]
    metrics: SimMetrics
    safety_events: list[SafetyEvent]


def _vehicle_length(vtype: str) -> float:
    return {"bus": BUS_LENGTH_M, "truck": TRUCK_LENGTH_M}.get(vtype, CAR_LENGTH_M)


def _vehicle_accel(vtype: str) -> float:
    return HEAVY_ACCEL_MS2 if vtype in ("bus", "truck") else CAR_ACCEL_MS2


def _build_queue(
    N: int,
    heavy_count: int,
    t_delay_base: float,
    weather: str,
    rng: random.Random,
    extra_types: list[str] | None = None,
) -> list[Vehicle]:
    """
    Build N queued vehicles behind the stop line.
    heavy_count = number of buses/trucks.
    extra_types: optional list of additional vehicle types (motorcycle, auto-rickshaw).
    """
    wf = WEATHER_FACTOR[weather]
    # Assign vehicle types
    types: list[str] = []
    heavy_remaining = heavy_count
    for i in range(N):
        if heavy_remaining > 0 and rng.random() < 0.4:
            t = rng.choice(["bus", "truck"])
            types.append(t)
            heavy_remaining -= 1
        else:
            types.append("car")

    # Shuffle so heavy vehicles aren't always first
    rng.shuffle(types)

    # Assign positions (from stop line backwards)
    vehicles: list[Vehicle] = []
    x_pos = -(CAR_LENGTH_M + STANDSTILL_GAP_M)  # first car front just behind stop line
    car_color_idx = 0

    for i, vtype in enumerate(types):
        vlen = _vehicle_length(vtype)
        # Reaction delay: individual variation ±15%
        base_delay = t_delay_base * wf
        reaction = base_delay * rng.uniform(0.85, 1.15)

        # Color
        if TYPE_COLOR.get(vtype) is not None:
            color = TYPE_COLOR[vtype]
        else:
            color = VEHICLE_COLORS[car_color_idx % len(VEHICLE_COLORS)]
            car_color_idx += 1

        v = Vehicle(
            id=i,
            type=vtype,
            length=vlen,
            accel=_vehicle_accel(vtype),
            x=x_pos,      # position of front bumper relative to stop line
            reaction_delay=reaction,
            color=color,
        )
        vehicles.append(v)
        x_pos -= (vlen + STANDSTILL_GAP_M)

    return vehicles


def simulate(
    params: PredictorParams,
    mode: Literal["conventional", "predictive"],
    *,
    telemetry_drop_at: float | None = None,
) -> SimResult:
    """
    Run the physics simulation for one mode.
    Returns frames at 20 Hz, events, and metrics.
    """
    rng = random.Random(params.seed)

    # Run predictor
    pred = compute_prediction(params)

    events: list[SimEvent] = []
    safety_events: list[SafetyEvent] = []

    # Log vision event
    events.append(SimEvent(
        t=0.0,
        category="VISION",
        message=f"N={params.N} vehicles detected in approach lane",
    ))

    # Log predictor event
    events.append(SimEvent(
        t=0.1,
        category="PREDICT",
        message=(
            f"T_clear={pred.t_clear:.2f}s  ETA={pred.eta:.2f}s  "
            f"T_trigger={pred.t_trigger:.2f}s  weather={params.weather}(x{pred.weather_factor})  "
            f"heavy_extra={pred.heavy_extra_s:.1f}s"
        ),
    ))

    # Build vehicle queue
    vehicles = _build_queue(
        params.N, params.heavy_count,
        params.t_delay, params.weather,
        rng,
    )

    # Ambulance starts at -distance_m from stop line
    amb_speed = params.speed_kmh / 3.6
    amb = AmbulanceState(
        x=-params.distance_m,
        v=amb_speed,
        target_v=amb_speed,
    )

    # Signal state
    signal = "RED"
    signal_changed_at: float | None = None

    # The ambulance meets the *tail* of the queue, not the stop line, so the
    # controller schedules against the ETA to the queue tail (from vision: N + mix).
    queue_length_m = sum(v.length + STANDSTILL_GAP_M for v in vehicles) + STANDSTILL_GAP_M
    eta_tail = max(0.0, (params.distance_m - queue_length_m) / amb_speed)
    partial_flush = eta_tail < pred.t_clear

    # Green trigger time
    if mode == "predictive":
        green_trigger_t = max(eta_tail - pred.t_clear, 0.0)
        events.append(SimEvent(
            t=0.15, category="PREDICT",
            message=(
                f"Queue tail at -{queue_length_m:.0f}m -> ETA_tail={eta_tail:.2f}s; "
                f"early GREEN scheduled at t={green_trigger_t:.2f}s"
            ),
        ))
        if partial_flush:
            events.append(SimEvent(
                t=0.0, category="SIGNAL",
                message="PARTIAL FLUSH: ETA < T_clear — triggering GREEN immediately",
            ))
    else:
        # Conventional: loop detector fires when the ambulance arrives at the
        # junction (stops at the queue tail); ETA to stop line is a fallback.
        green_trigger_t = pred.eta

    # Pedestrian phase state
    ped_remaining = params.ped_remaining_s
    ped_active = params.ped_active

    # Safety evaluation
    telemetry_age = None  # seconds since last heartbeat (None = OK)
    safety_eval = evaluate_safety(
        sim_time=0.0,
        ped_active=ped_active,
        ped_remaining_s=ped_remaining,
        telemetry_last_seen_s=telemetry_age,
        side_phase_remaining_s=0.0,  # simplified: cross street already cleared
        partial_flush=pred.partial_flush,
    )
    safety_events.extend(safety_eval.events)

    for r in safety_eval.reasons:
        events.append(SimEvent(t=0.2, category="SAFETY", message=r))

    # Apply safety hold
    if safety_eval.hold_s > 0:
        green_trigger_t += safety_eval.hold_s
        events.append(SimEvent(
            t=0.2, category="SAFETY",
            message=f"GREEN delayed by {safety_eval.hold_s:.1f}s (safety hold)",
        ))

    # Run simulation frames
    frames: list[SimFrame] = []
    t = 0.0
    max_sim_time = max(pred.eta * 3.5, pred.t_clear * 2.5, 60.0)

    queue_cleared_at: float | None = None
    amb_wait_start: float | None = None
    amb_wait_total = 0.0
    amb_arrived_at: float | None = None
    amb_crossing_time: float | None = None

    # Track which vehicles have started moving
    first_started_at: float | None = None
    # For conventional mode, queue start is triggered by green
    green_given = False
    signal_green_at: float | None = None

    while t < max_sim_time:
        # ── Telemetry drop ────────────────────────────────────────────────
        if telemetry_drop_at is not None and t >= telemetry_drop_at:
            if telemetry_age is None:
                telemetry_age = 0.0
            telemetry_age += DT
            if telemetry_age > 2.0 and not safety_eval.fail_safe:
                safety_eval.fail_safe = True
                # In fail-safe mode, cancel predictive green, revert to fixed timers
                green_trigger_t = pred.eta  # revert to conventional timing
                events.append(SimEvent(
                    t=t, category="SAFETY",
                    message=f"FAIL-SAFE: telemetry lost {telemetry_age:.1f}s — reverting to fixed timers",
                ))
                safety_events.append(SafetyEvent(
                    type="FAILSAFE", t=t,
                    detail=f"Telemetry heartbeat lost {telemetry_age:.1f}s ago",
                ))

        # ── Signal logic ──────────────────────────────────────────────────
        if (
            mode == "conventional"
            and not green_given
            and amb.blocked
            and amb.v < 0.5
            and green_trigger_t > t
            and not (ped_active and ped_remaining - t > 0 and safety_eval.hold_s > 0)
        ):
            # ambulance detected waiting at the junction -> conventional preemption fires now
            green_trigger_t = t
        if not green_given and t >= green_trigger_t:
            signal = "GREEN"
            signal_changed_at = t
            green_given = True
            signal_green_at = t
            label = "EARLY PREEMPTION" if mode == "predictive" else "ON ARRIVAL"
            events.append(SimEvent(
                t=t, category="SIGNAL",
                message=f"NS -> GREEN ({label}) at t={t:.2f}s",
            ))

        # ── Queue clearing (vehicles start after green with car-following) ───
        if green_given:
            for i, veh in enumerate(vehicles):
                if veh.passed:
                    continue
                if veh.started:
                    # Accelerate up to speed limit, respecting car ahead
                    desired_v = MAX_SPEED_MS
                    if i > 0:
                        leader = vehicles[i - 1]
                        if not leader.passed:
                            leader_rear_x = leader.x - leader.length
                            headway = leader_rear_x - veh.x
                            if headway < STANDSTILL_GAP_M + 1.5:
                                desired_v = min(desired_v, leader.v)
                                veh.v = max(0.0, veh.v - CAR_DECEL_MS2 * DT)
                            else:
                                desired_v = min(desired_v, leader.v + 2.5)

                    if veh.v < desired_v:
                        veh.v = min(veh.v + veh.accel * DT, desired_v)
                    elif veh.v > desired_v:
                        veh.v = max(veh.v - CAR_DECEL_MS2 * DT, desired_v)

                    # Collision guard: never jump over leader
                    next_x = veh.x + veh.v * DT
                    if i > 0:
                        leader = vehicles[i - 1]
                        if not leader.passed:
                            leader_rear_x = leader.x - leader.length
                            safe_limit = leader_rear_x - STANDSTILL_GAP_M
                            if next_x > safe_limit:
                                next_x = safe_limit
                                veh.v = leader.v
                    veh.x = next_x
                    veh.reacting = False
                    if veh.x > 30.0:  # fully crossed intersection
                        veh.passed = True
                else:
                    # Check if it's this vehicle's turn to start
                    if i == 0:
                        start_time_expected = signal_green_at + veh.reaction_delay
                    else:
                        prev = vehicles[i - 1]
                        if prev.start_time is not None:
                            start_time_expected = prev.start_time + veh.reaction_delay
                        else:
                            start_time_expected = float("inf")

                    if t >= start_time_expected:
                        veh.started = True
                        veh.start_time = t
                        if first_started_at is None:
                            first_started_at = t
                        veh.reacting = True
                    elif signal_green_at is not None and start_time_expected < float("inf"):
                        veh.reacting = (t > signal_green_at)

            # Check if all vehicles passed
            if all(v.passed for v in vehicles) and queue_cleared_at is None:
                queue_cleared_at = t
                events.append(SimEvent(
                    t=t, category="VEHICLE",
                    message=f"Queue fully cleared at t={t:.2f}s",
                ))

        # ── Ambulance physics (car-following + obstacle avoidance) ────────
        if not amb.cleared:
            # 1. Identify closest vehicle ahead whose rear bumper is in front of the ambulance
            lead_vehicles = [v for v in vehicles if not v.passed and (v.x - v.length) > (amb.x - 0.5)]

            obstacle_x: float | None = None
            leader_v = 0.0

            if lead_vehicles:
                # Vehicle with smallest x is the tail of the queue directly ahead of the ambulance
                closest_ahead = min(lead_vehicles, key=lambda v: (v.x - v.length))
                obstacle_x = (closest_ahead.x - closest_ahead.length) - STANDSTILL_GAP_M
                leader_v = closest_ahead.v
            elif signal == "RED":
                # No vehicles ahead, but signal is RED -> stop before stop line
                obstacle_x = -STANDSTILL_GAP_M
                leader_v = 0.0

            # 2. Longitudinal speed control and stopping distance
            if obstacle_x is not None:
                gap = obstacle_x - amb.x
                stopping_dist = (amb.v ** 2) / (2 * AMB_DECEL_MS2)

                if gap <= 0.2:
                    # Right behind obstacle -> standstill
                    amb.v = min(amb.v, leader_v)
                    amb.x = min(amb.x, obstacle_x)
                    amb.blocked = True
                elif gap <= stopping_dist + 5.0:
                    # In braking distance
                    target_speed = leader_v if (leader_v > 0 and gap > STANDSTILL_GAP_M) else 0.0
                    if amb.v > target_speed:
                        amb.v = max(amb.v - AMB_DECEL_MS2 * DT, target_speed)
                    else:
                        amb.v = min(amb.v + AMB_ACCEL_MS2 * DT, target_speed)

                    amb.blocked = (amb.v < 0.5)
                else:
                    amb.blocked = False
                    amb.v = min(amb.v + AMB_ACCEL_MS2 * DT, amb.target_v)

                # Hard physical collision barrier: front bumper CANNOT exceed obstacle_x
                next_x = amb.x + amb.v * DT
                if next_x > obstacle_x:
                    next_x = obstacle_x
                    amb.v = leader_v
                    amb.blocked = True
                amb.x = next_x
            else:
                # Open road -> unobstructed cruising
                amb.blocked = False
                amb.v = min(amb.v + AMB_ACCEL_MS2 * DT, amb.target_v)
                amb.x += amb.v * DT

            # Accumulate standstill wait time whenever blocked behind queue or red light
            if amb.blocked or (amb.v < 0.5 and not amb.arrived):
                amb_wait_total += DT

            # Check if ambulance passed the stop line
            if amb.x >= 0.0 and not amb.arrived:
                amb.arrived = True
                amb_arrived_at = t
                amb_crossing_time = t
                events.append(SimEvent(
                    t=t, category="AMBULANCE",
                    message=f"Ambulance crossed stop line at t={t:.2f}s (wait={amb_wait_total:.2f}s)",
                ))

            # Conclude simulation once ambulance has fully cleared junction (+35m beyond stop line)
            if amb.x >= 35.0:
                amb.cleared = True
                break

        # ── Build frame ───────────────────────────────────────────────────
        prediction_label = None
        if mode == "predictive" and not green_given and t < green_trigger_t:
            remaining = green_trigger_t - t
            prediction_label = f"Early GREEN in {remaining:.1f}s"

        frames.append(SimFrame(
            t=round(t, 3),
            vehicles=[{
                "id": v.id,
                "type": v.type,
                "x": round(v.x, 3),
                "v": round(v.v, 3),
                "reacting": v.reacting,
                "passed": v.passed,
                "color": v.color,
                "length": v.length,
            } for v in vehicles],
            ambulance={
                "x": round(amb.x, 3),
                "v": round(amb.v, 3),
                "blocked": amb.blocked,
                "blocked_s": round(amb_wait_total, 3),
                "arrived": amb.arrived,
            },
            signal=signal,
            signal_changed_at=round(signal_changed_at, 3) if signal_changed_at else None,
            prediction_label=prediction_label,
        ))

        t = round(t + DT, 4)

    # If simulation ended without ambulance arriving (edge case)
    if amb_arrived_at is None:
        amb_arrived_at = t
        amb_crossing_time = t

    metrics = SimMetrics(
        ambulance_wait_s=round(amb_wait_total, 3),
        crossing_time_s=round(amb_crossing_time or t, 3),
        queue_cleared_at_s=round(queue_cleared_at or t, 3),
        ambulance_arrived_at_s=round(amb_arrived_at, 3),
    )

    return SimResult(
        mode=mode,
        frames=frames,
        events=events,
        metrics=metrics,
        safety_events=safety_events,
    )


def simulate_both(
    params: PredictorParams,
    telemetry_drop_at: float | None = None,
) -> dict[str, SimResult]:
    """Simulate both conventional and predictive modes with the same seed."""
    return {
        "conventional": simulate(params, "conventional", telemetry_drop_at=None),
        "predictive": simulate(params, "predictive", telemetry_drop_at=telemetry_drop_at),
    }
