"""
QueueFlush AI — Deterministic Predictor Engine
Computes T_clear, T_trigger, ETA given parameters.
All results are deterministic given (params, seed).
"""
from __future__ import annotations
import random
from dataclasses import dataclass, field
from typing import Literal

# Weather multipliers on t_delay
WEATHER_FACTOR: dict[str, float] = {
    "dry": 1.0,
    "wet": 1.25,
    "fog": 1.35,
}

# Extra startup delay per heavy vehicle (bus or truck)
HEAVY_VEHICLE_EXTRA_S = 0.6

# Safety thresholds
PED_MIN_CLEARANCE_S = 3.0     # pedestrian phase must have >= 3s remaining
SIDE_STREET_YELLOW_S = 3.0    # minimum yellow before switch
SIDE_STREET_ALL_RED_S = 1.0   # all-red intergreen after yellow
TELEMETRY_TIMEOUT_S  = 2.0    # heartbeat loss threshold -> FAIL-SAFE


@dataclass
class PredictorParams:
    N: int                          # vehicles queued in approach lane
    t_delay: float                  # per-driver startup reaction delay (s)
    t_margin: float                 # safety buffer (s)
    weather: Literal["dry", "wet", "fog"]
    heavy_count: int                # number of buses/trucks in queue
    distance_m: float               # distance from ambulance to stop line (m)
    speed_kmh: float                # ambulance speed (km/h)
    ped_active: bool = False        # pedestrian phase currently active
    ped_remaining_s: float = 0.0   # time left in pedestrian walk phase (s)
    seed: int = 0

    def __post_init__(self) -> None:
        assert 1 <= self.N <= 20,           f"N out of range: {self.N}"
        assert 0.4 <= self.t_delay <= 1.6,  f"t_delay out of range: {self.t_delay}"
        assert self.t_margin >= 0,          f"t_margin must be >= 0"
        assert self.weather in WEATHER_FACTOR, f"unknown weather: {self.weather}"
        assert self.heavy_count >= 0,       f"heavy_count must be >= 0"
        assert self.heavy_count <= self.N,  f"heavy_count cannot exceed N"
        assert self.distance_m > 0,         f"distance_m must be positive"
        assert self.speed_kmh > 0,          f"speed_kmh must be positive"
        assert self.ped_remaining_s >= 0,   f"ped_remaining_s must be >= 0"


@dataclass
class PredictorResult:
    # Adjusted per-driver delay
    effective_t_delay: float

    # Core formula outputs
    t_clear: float       # time for queue to clear (s)
    eta: float           # ambulance ETA to stop line (s)
    t_trigger: float     # when to trigger early GREEN relative to now (s)
    partial_flush: bool  # True if ETA < t_clear (ambulance arrives before queue clears)

    # Safety layer output
    safety_approved: bool
    safety_hold_s: float         # seconds to hold before approving (0 if none)
    safety_reasons: list[str]

    # Formula components for UI display
    weather_factor: float
    heavy_extra_s: float

    # Conventional comparison
    conventional_wait_s: float   # wait if signal turns GREEN only on arrival

    # Comparison
    time_saved_s: float

    def summary(self) -> str:
        return (
            f"ETA={self.eta:.2f}s  T_clear={self.t_clear:.2f}s  "
            f"T_trigger={self.t_trigger:.2f}s  partial={self.partial_flush}  "
            f"saved={self.time_saved_s:.2f}s"
        )


def compute_prediction(p: PredictorParams) -> PredictorResult:
    """Run the predictor engine deterministically."""

    # ── 1. Effective reaction delay (weather + heavy-vehicle adjustments) ──
    wf = WEATHER_FACTOR[p.weather]
    effective_t_delay = p.t_delay * wf

    # Extra delay from heavy vehicles
    heavy_extra_s = p.heavy_count * HEAVY_VEHICLE_EXTRA_S

    # ── 2. Core formula ─────────────────────────────────────────────────────
    # T_clear = (N-1) * effective_t_delay + t_margin + heavy_extra_s
    t_clear = (p.N - 1) * effective_t_delay + p.t_margin + heavy_extra_s

    # ETA = distance / speed  (convert km/h -> m/s)
    speed_ms = p.speed_kmh / 3.6
    eta = p.distance_m / speed_ms

    # T_trigger = ETA - T_clear  (when to issue early GREEN)
    t_trigger = eta - t_clear

    # Partial flush: ambulance arrives before queue clears
    partial_flush = (t_trigger < 0)

    # If partial flush, we trigger immediately (t_trigger = 0)
    effective_trigger = max(t_trigger, 0.0)

    # ── 3. Safety layer ──────────────────────────────────────────────────────
    safety_approved = True
    safety_hold_s = 0.0
    safety_reasons: list[str] = []

    if p.ped_active and p.ped_remaining_s < PED_MIN_CLEARANCE_S:
        # Not enough pedestrian clearance — HOLD until pedestrians clear
        hold = PED_MIN_CLEARANCE_S - p.ped_remaining_s
        # Minimum hold is (PED_MIN_CLEARANCE_S - ped_remaining_s) but actually we
        # hold until the full pedestrian cycle is done (ped_remaining_s seconds)
        hold = p.ped_remaining_s
        safety_hold_s = hold
        safety_approved = False   # will be approved after hold
        safety_reasons.append(
            f"SAFETY HOLD: pedestrian phase active with {p.ped_remaining_s:.1f}s "
            f"remaining (< {PED_MIN_CLEARANCE_S:.1f}s threshold)"
        )

    # Side street always needs minimum yellow + all-red before switch
    # (These are guaranteed by the signal controller; we log them as rules)
    min_side_phase = SIDE_STREET_YELLOW_S + SIDE_STREET_ALL_RED_S
    safety_reasons.append(
        f"INTERGREEN: side-street minimum {SIDE_STREET_YELLOW_S:.1f}s yellow + "
        f"{SIDE_STREET_ALL_RED_S:.1f}s all-red ({min_side_phase:.1f}s total) enforced"
    )

    if safety_approved:
        safety_reasons.insert(0, "Safety checks passed — GREEN approved")

    # ── 4. Conventional comparison ────────────────────────────────────────────
    # Conventional: ambulance arrives, then queue starts clearing from front to back
    # Ambulance wait = T_clear (it must wait while all cars vacate)
    # (More precisely: front car moves first, then each car delays)
    # In the conventional case the ambulance arrives while signal turns GREEN on arrival
    # and the queue starts clearing from the front. The ambulance is BEHIND the queue,
    # so it waits for ALL N cars to pass the stop line before it can go.
    # Simplified model: conventional_wait = T_clear (queue hasn't started yet on arrival)
    conventional_wait_s = t_clear

    # Predictive: if t_trigger > 0, the queue will clear exactly by arrival time
    # so ambulance wait ≈ 0; if partial flush, ambulance waits partial_remaining
    if partial_flush:
        # queue started at t=0, ambulance arrives at t=eta, T_clear > eta
        # so cleared = (eta / t_clear) fraction by arrival
        # remaining_clear_time = t_clear - eta
        predictive_wait_s = t_clear - eta
    else:
        predictive_wait_s = 0.0

    time_saved_s = conventional_wait_s - predictive_wait_s

    return PredictorResult(
        effective_t_delay=effective_t_delay,
        t_clear=t_clear,
        eta=eta,
        t_trigger=t_trigger,
        partial_flush=partial_flush,
        safety_approved=safety_approved,
        safety_hold_s=safety_hold_s,
        safety_reasons=safety_reasons,
        weather_factor=wf,
        heavy_extra_s=heavy_extra_s,
        conventional_wait_s=conventional_wait_s,
        time_saved_s=time_saved_s,
    )
