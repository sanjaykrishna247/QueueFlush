"""
QueueFlush AI — Safety Controller
Deterministic rule-based safety layer that runs AFTER the predictor.
Returns safety decisions and logs events.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
import time

# Safety constants
PED_MIN_CLEARANCE_S   = 3.0
SIDE_YELLOW_S         = 3.0
SIDE_ALL_RED_S        = 1.0
TELEMETRY_TIMEOUT_S   = 2.0


SafetyEventType = Literal["HOLD", "FAILSAFE", "PARTIAL_FLUSH", "REJECTED_TOKEN"]


@dataclass
class SafetyEvent:
    type: SafetyEventType
    t: float          # simulation time when event occurred (s)
    detail: str


@dataclass
class SafetyDecision:
    approved: bool
    hold_s: float                  # seconds to delay green (0 = immediate)
    reasons: list[str] = field(default_factory=list)
    events: list[SafetyEvent] = field(default_factory=list)
    fail_safe: bool = False        # revert to fixed timers


def evaluate_safety(
    *,
    sim_time: float,
    ped_active: bool,
    ped_remaining_s: float,
    telemetry_last_seen_s: float | None,  # None = never lost
    side_phase_remaining_s: float,         # remaining yellow/all-red on cross street
    partial_flush: bool,
) -> SafetyDecision:
    """
    Deterministic rule-based safety evaluation.
    Returns a SafetyDecision describing whether to approve early GREEN and any holds.
    """
    approved = True
    hold_s = 0.0
    reasons: list[str] = []
    events: list[SafetyEvent] = []
    fail_safe = False

    # ── Rule 1: Telemetry / sensor heartbeat ────────────────────────────────
    if telemetry_last_seen_s is not None and telemetry_last_seen_s > TELEMETRY_TIMEOUT_S:
        approved = False
        fail_safe = True
        reasons.append(
            f"FAIL-SAFE: telemetry heartbeat lost for {telemetry_last_seen_s:.1f}s "
            f"(> {TELEMETRY_TIMEOUT_S:.1f}s threshold) — reverting to fixed timers"
        )
        events.append(SafetyEvent(
            type="FAILSAFE",
            t=sim_time,
            detail=f"Heartbeat lost {telemetry_last_seen_s:.1f}s ago",
        ))
        return SafetyDecision(
            approved=approved, hold_s=hold_s, reasons=reasons,
            events=events, fail_safe=fail_safe
        )

    # ── Rule 2: Pedestrian walk phase ────────────────────────────────────────
    if ped_active and ped_remaining_s < PED_MIN_CLEARANCE_S:
        hold_s = ped_remaining_s  # wait until pedestrian phase fully expires
        approved = False          # temporarily; will be approved after hold
        reasons.append(
            f"SAFETY HOLD: pedestrian clearance {ped_remaining_s:.1f}s "
            f"< {PED_MIN_CLEARANCE_S:.1f}s minimum — green delayed by {hold_s:.1f}s"
        )
        events.append(SafetyEvent(
            type="HOLD",
            t=sim_time,
            detail=f"Ped remaining: {ped_remaining_s:.1f}s",
        ))

    # ── Rule 3: Side-street minimum yellow + all-red ─────────────────────────
    min_intergreen = SIDE_YELLOW_S + SIDE_ALL_RED_S
    if side_phase_remaining_s > 0:
        if side_phase_remaining_s < min_intergreen:
            # Not enough intergreen time — hold for the remaining side-phase time
            extra_hold = side_phase_remaining_s
            reasons.append(
                f"INTERGREEN HOLD: side-street phase only {side_phase_remaining_s:.1f}s "
                f"remaining — need {min_intergreen:.1f}s minimum"
            )
            hold_s = max(hold_s, extra_hold)
        else:
            # Enough intergreen time — no hold needed for this rule
            reasons.append(
                f"INTERGREEN OK: side-street has {side_phase_remaining_s:.1f}s "
                f"(>= {min_intergreen:.1f}s yellow+all-red) — approved"
            )
    else:
        reasons.append(
            f"INTERGREEN OK: side-street cleared ({SIDE_YELLOW_S:.1f}s yellow + "
            f"{SIDE_ALL_RED_S:.1f}s all-red already served)"
        )

    # ── Rule 4: Partial flush notification ───────────────────────────────────
    if partial_flush:
        reasons.append(
            "PARTIAL FLUSH: ETA < T_clear — triggering GREEN immediately; "
            "ambulance will experience reduced but non-zero wait"
        )
        events.append(SafetyEvent(
            type="PARTIAL_FLUSH",
            t=sim_time,
            detail="Ambulance too close to allow full queue clearance",
        ))

    # If only hold (not fail-safe), approved after hold_s
    if not fail_safe and hold_s == 0.0:
        approved = True

    if not reasons:
        reasons.append("All safety checks passed — GREEN approved immediately")

    return SafetyDecision(
        approved=approved,
        hold_s=hold_s,
        reasons=reasons,
        events=events,
        fail_safe=fail_safe,
    )


def verify_token(device_id: str, payload: str, signature: str, secret_key: str) -> bool:
    """
    Verify HMAC-SHA256 signature of an ambulance/device token.
    Returns True if valid, False if invalid/spoofed.
    """
    import hmac, hashlib
    expected = hmac.new(
        secret_key.encode(),
        f"{device_id}:{payload}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def sign_token(device_id: str, payload: str, secret_key: str) -> str:
    """HMAC-SHA256 signature exactly as an on-board unit would compute it."""
    import hmac, hashlib
    return hmac.new(
        secret_key.encode(),
        f"{device_id}:{payload}".encode(),
        hashlib.sha256,
    ).hexdigest()
