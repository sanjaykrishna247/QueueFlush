"""
QueueFlush AI — Pydantic v2 Request/Response Schemas
"""
from __future__ import annotations
from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# ── Predict ───────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    N: int = Field(..., ge=1, le=20, description="Vehicles queued")
    t_delay: float = Field(0.8, ge=0.4, le=1.6, description="Per-driver reaction delay (s)")
    t_margin: float = Field(1.0, ge=0.0, le=5.0, description="Safety buffer (s)")
    weather: Literal["dry", "wet", "fog"] = "dry"
    heavy_count: int = Field(0, ge=0, description="Number of buses/trucks")
    distance_m: float = Field(..., gt=0, description="Distance to stop line (m)")
    speed_kmh: float = Field(..., gt=0, le=200, description="Ambulance speed (km/h)")
    ped_active: bool = False
    ped_remaining_s: float = Field(0.0, ge=0.0)

    @field_validator("heavy_count")
    @classmethod
    def heavy_not_exceed_n(cls, v, info):
        n = info.data.get("N", 20)
        if v > n:
            raise ValueError(f"heavy_count ({v}) cannot exceed N ({n})")
        return v


class SafetyResult(BaseModel):
    approved: bool
    hold_s: float
    reasons: list[str]
    fail_safe: bool = False


class PredictResponse(BaseModel):
    t_clear: float
    eta: float
    t_trigger: float
    partial_flush: bool
    effective_t_delay: float
    weather_factor: float
    heavy_extra_s: float
    conventional_wait_s: float
    time_saved_s: float
    safety: SafetyResult


# ── Simulate ──────────────────────────────────────────────────────────────────
class SimulateRequest(BaseModel):
    scenario_slug: Optional[str] = None
    params: Optional[PredictRequest] = None
    seed: int = 42
    mode: Literal["conventional", "predictive", "both"] = "both"
    telemetry_drop_at: Optional[float] = None


class SimEventOut(BaseModel):
    t: float
    category: str
    message: str


class SimMetricsOut(BaseModel):
    ambulance_wait_s: float
    crossing_time_s: float
    queue_cleared_at_s: float
    ambulance_arrived_at_s: float


class SimResultOut(BaseModel):
    mode: str
    frames: list[dict[str, Any]]
    events: list[SimEventOut]
    metrics: SimMetricsOut
    safety_events: list[dict[str, Any]]


class SimulateResponse(BaseModel):
    conventional: Optional[SimResultOut] = None
    predictive: Optional[SimResultOut] = None


# ── Corridor ──────────────────────────────────────────────────────────────────
class CorridorRequest(BaseModel):
    corridor_slug: str
    params: Optional[dict[str, Any]] = None
    seed: int = 42


class JunctionMetricsOut(BaseModel):
    junction_index: int
    code: str
    name: str
    queue_n: int
    conventional: SimMetricsOut
    predictive: SimMetricsOut
    time_saved_s: float
    cumulative_time_conv: float
    cumulative_time_pred: float


class CorridorResponse(BaseModel):
    slug: str
    name: str
    hospital_name: str
    weather: str
    speed_kmh: float
    junctions: list[JunctionMetricsOut]
    total_time_conv_s: float
    total_time_pred_s: float
    corridor_gain_s: float


# ── Scenarios ─────────────────────────────────────────────────────────────────
class ScenarioOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str]
    tags: list[str]
    params: dict[str, Any]
    vehicle_mix: list[dict[str, Any]]
    telemetry_drop_at: Optional[float]
    seed: int
    is_demo: bool


# ── Corridors list ────────────────────────────────────────────────────────────
class CorridorOut(BaseModel):
    id: int
    slug: str
    name: str
    hospital_name: str
    total_length_km: float
    intersection_codes: list[str]
    gps_track: list[dict[str, Any]]


# ── Intersections ─────────────────────────────────────────────────────────────
class IntersectionOut(BaseModel):
    id: int
    code: str
    name: str
    lat: float
    lng: float
    approach_distance_m: float
    ped_cycle_s: float
    controller_type: str


# ── Runs ──────────────────────────────────────────────────────────────────────
class RunOut(BaseModel):
    id: int
    created_at: datetime
    scenario_slug: Optional[str]
    mode: str
    params: dict[str, Any]
    metrics: dict[str, Any]
    seed: int
    source: str


class RunCreate(BaseModel):
    scenario_slug: Optional[str] = None
    mode: str
    params: dict[str, Any]
    metrics: dict[str, Any]
    seed: int = 42
    source: str = "user"


# ── Auth ──────────────────────────────────────────────────────────────────────
class TokenVerifyRequest(BaseModel):
    device_id: str
    payload: str
    signature: str


class TokenSignRequest(BaseModel):
    device_id: str
    payload: str


class TokenSignResponse(BaseModel):
    device_id: str
    payload: str
    signature: str
    algorithm: str = "HMAC-SHA256"


class TokenVerifyResponse(BaseModel):
    valid: bool
    device_id: str
    vehicle_type: Optional[str] = None
    reg_no: Optional[str] = None
    reason: str


# ── Admin Auth & Management ──────────────────────────────────────────────────
class AdminLoginRequest(BaseModel):
    username: str
    password: str
    pin: Optional[str] = "2026"


class AdminUserOut(BaseModel):
    username: str
    full_name: str
    designation: str
    clearance_level: str
    node_id: str
    department: str
    login_time: str


class AdminLoginResponse(BaseModel):
    success: bool
    token: str
    user: AdminUserOut
    message: str


class EmergencyDeviceOut(BaseModel):
    id: int
    device_id: str
    vehicle_type: str
    reg_no: str
    secret_key: str
    active: bool


class DeviceToggleRequest(BaseModel):
    device_id: str
    active: bool


class DeviceAddRequest(BaseModel):
    device_id: str
    vehicle_type: str
    reg_no: str
    secret_key: Optional[str] = None


class SystemOverrideRequest(BaseModel):
    scope: str = "ALL_JUNCTIONS"  # ALL_JUNCTIONS or specific code
    action: str = "FORCE_CASCADE_GREEN"
    duration_s: int = 45
    reason: str = "National Emergency Protocol Level 1 Activation"


class SystemOverrideResponse(BaseModel):
    success: bool
    scope: str
    action: str
    active_until: str
    affected_junctions: list[str]
    authorized_by: str


# ── Driver & Pilot Auth ──────────────────────────────────────────────────────
class DriverLoginRequest(BaseModel):
    badge_id: str
    vehicle_reg: str
    pin: Optional[str] = "108"


class DriverProfile(BaseModel):
    badge_id: str
    pilot_name: str
    vehicle_id: str
    vehicle_type: str
    reg_no: str
    assigned_hospital: str
    status: str
    gps_active: bool
    speed_kmh: float
    current_corridor: str


class DriverLoginResponse(BaseModel):
    success: bool
    token: str
    driver: DriverProfile
    message: str


# ── Citizen Commuter Auth ────────────────────────────────────────────────────
class CitizenLoginRequest(BaseModel):
    identifier: str
    otp: Optional[str] = "2026"


class CitizenProfile(BaseModel):
    full_name: str
    identifier: str
    city: str
    alert_notifications: bool
    yield_compliance_rating: str


class CitizenLoginResponse(BaseModel):
    success: bool
    token: str
    citizen: CitizenProfile
    message: str



# ── Stats ─────────────────────────────────────────────────────────────────────
class StatsResponse(BaseModel):
    avg_ambulance_wait_eliminated_s: float
    avg_time_saved_per_junction_s: float
    best_corridor_gain_s: float
    total_runs: int


# ── Benchmark ────────────────────────────────────────────────────────────────
class BenchmarkResponse(BaseModel):
    batch_id: str
    rows_generated: int
    summary: dict[str, Any]


# ── Vision ────────────────────────────────────────────────────────────────────
class DetectionOut(BaseModel):
    cls: str = Field(alias="class")
    conf: float
    box: list[float]

    model_config = {"populate_by_name": True}


class VisionFixtureOut(BaseModel):
    scenario_slug: str
    frame_no: int
    detections: list[dict[str, Any]]
    count: int
