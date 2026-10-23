"""
QueueFlush AI — SQLAlchemy ORM Models
"""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
)
from app.db import Base


class Scenario(Base):
    __tablename__ = "scenarios"
    id          = Column(Integer, primary_key=True, index=True)
    slug        = Column(String(80), unique=True, nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    tags_json   = Column(Text, default="[]")          # JSON array of strings
    params_json = Column(Text, nullable=False)         # JSON of PredictorParams fields
    vehicle_mix_json = Column(Text, default="[]")     # JSON vehicle composition
    telemetry_drop_at = Column(Float, nullable=True)  # None = no drop
    seed        = Column(Integer, nullable=False, default=0)
    is_demo     = Column(Boolean, default=False)


class Intersection(Base):
    __tablename__ = "intersections"
    id                  = Column(Integer, primary_key=True, index=True)
    code                = Column(String(30), unique=True, nullable=False, index=True)
    name                = Column(String(200), nullable=False)
    lat                 = Column(Float, nullable=False)
    lng                 = Column(Float, nullable=False)
    approach_distance_m = Column(Float, nullable=False)
    ped_cycle_s         = Column(Float, default=30.0)
    controller_type     = Column(String(50), default="NEMA TS2")


class Corridor(Base):
    __tablename__ = "corridors"
    id                      = Column(Integer, primary_key=True, index=True)
    slug                    = Column(String(80), unique=True, nullable=False, index=True)
    name                    = Column(String(200), nullable=False)
    hospital_name           = Column(String(200), nullable=False)
    total_length_km         = Column(Float, nullable=False)
    intersection_codes_json = Column(Text, nullable=False)   # JSON array of codes
    gps_track_json          = Column(Text, nullable=False)   # JSON array of {lat,lng,t}


class EmergencyDevice(Base):
    __tablename__ = "emergency_devices"
    id           = Column(Integer, primary_key=True, index=True)
    device_id    = Column(String(30), unique=True, nullable=False, index=True)
    vehicle_type = Column(String(30), nullable=False)  # "ambulance" | "fire_engine"
    reg_no       = Column(String(30), nullable=False)
    secret_key   = Column(String(80), nullable=False)  # 32-byte hex
    active       = Column(Boolean, default=True)


class VisionFixture(Base):
    __tablename__ = "vision_fixtures"
    id              = Column(Integer, primary_key=True, index=True)
    scenario_slug   = Column(String(80), nullable=False, index=True)
    frame_no        = Column(Integer, nullable=False, default=0)
    detections_json = Column(Text, nullable=False)   # JSON array of detections


class Run(Base):
    __tablename__ = "runs"
    id            = Column(Integer, primary_key=True, index=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    scenario_slug = Column(String(80), nullable=True, index=True)
    mode          = Column(String(30), nullable=False)       # "conventional" | "predictive" | "both"
    params_json   = Column(Text, nullable=False)
    metrics_json  = Column(Text, nullable=False)
    seed          = Column(Integer, nullable=False, default=0)
    source        = Column(String(20), default="user")       # "seed" | "user" | "benchmark"


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"
    id         = Column(Integer, primary_key=True, index=True)
    batch_id   = Column(String(50), nullable=False, index=True)
    N          = Column(Integer, nullable=False)
    weather    = Column(String(20), nullable=False)
    t_delay    = Column(Float, nullable=False)
    heavy_count= Column(Integer, nullable=False, default=0)
    mode       = Column(String(20), nullable=False)
    wait_s     = Column(Float, nullable=False)
    crossing_s = Column(Float, nullable=False)


class DecisionLog(Base):
    __tablename__ = "decision_logs"
    id       = Column(Integer, primary_key=True, index=True)
    run_id   = Column(Integer, ForeignKey("runs.id"), nullable=True, index=True)
    t        = Column(Float, nullable=False)
    category = Column(String(30), nullable=False)  # VISION | PREDICT | SAFETY | SIGNAL | VEHICLE | AMBULANCE
    message  = Column(Text, nullable=False)


class SafetyEventRow(Base):
    __tablename__ = "safety_events"
    id       = Column(Integer, primary_key=True, index=True)
    run_id   = Column(Integer, ForeignKey("runs.id"), nullable=True, index=True)
    type     = Column(String(30), nullable=False)   # HOLD | FAILSAFE | PARTIAL_FLUSH | REJECTED_TOKEN
    t        = Column(Float, nullable=False)
    detail   = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
