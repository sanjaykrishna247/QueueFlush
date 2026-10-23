"""
QueueFlush AI — Corridor Engine
Green-wave corridor with multiple intersections.
Predictive mode pre-clears up to 3 intersections ahead.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any
import math

from app.engine.predictor import PredictorParams, compute_prediction
from app.engine.simulator import simulate, SimResult, SimMetrics


@dataclass
class Intersection:
    code: str
    name: str
    approach_distance_m: float
    ped_cycle_s: float = 30.0
    controller_type: str = "NEMA TS2"


@dataclass
class CorridorParams:
    intersections: list[Intersection]
    ambulance_speed_kmh: float
    t_delay: float
    t_margin: float
    weather: str
    heavy_count_per_junction: int
    queue_n_per_junction: list[int]   # len == len(intersections)
    seed: int
    ped_active_junctions: list[int] = field(default_factory=list)  # indices with ped active
    ped_remaining_s: float = 2.0


@dataclass
class JunctionResult:
    junction_index: int
    code: str
    name: str
    queue_n: int
    conventional: SimMetrics
    predictive: SimMetrics
    time_saved_s: float
    cumulative_time_conv: float
    cumulative_time_pred: float


@dataclass
class CorridorResult:
    mode_label: str
    junctions: list[JunctionResult]
    total_time_conv_s: float
    total_time_pred_s: float
    corridor_gain_s: float


def simulate_corridor(cp: CorridorParams) -> CorridorResult:
    """
    Run both modes for each junction in sequence.
    Predictive mode pre-clears up to 3 junctions ahead.
    Returns per-junction and total metrics.
    """
    junction_results: list[JunctionResult] = []
    cumulative_conv = 0.0
    cumulative_pred = 0.0

    for i, intersection in enumerate(cp.intersections):
        N = cp.queue_n_per_junction[i]
        ped_active = i in cp.ped_active_junctions

        p = PredictorParams(
            N=N,
            t_delay=cp.t_delay,
            t_margin=cp.t_margin,
            weather=cp.weather,
            heavy_count=min(cp.heavy_count_per_junction, N // 3),
            distance_m=intersection.approach_distance_m,
            speed_kmh=cp.ambulance_speed_kmh,
            ped_active=ped_active,
            ped_remaining_s=cp.ped_remaining_s if ped_active else 0.0,
            seed=cp.seed + i * 100,
        )

        conv_result = simulate(p, "conventional")
        pred_result = simulate(p, "predictive")

        time_saved = (
            conv_result.metrics.crossing_time_s
            - pred_result.metrics.crossing_time_s
        )
        cumulative_conv += conv_result.metrics.crossing_time_s
        cumulative_pred += pred_result.metrics.crossing_time_s

        junction_results.append(JunctionResult(
            junction_index=i,
            code=intersection.code,
            name=intersection.name,
            queue_n=N,
            conventional=conv_result.metrics,
            predictive=pred_result.metrics,
            time_saved_s=round(time_saved, 3),
            cumulative_time_conv=round(cumulative_conv, 3),
            cumulative_time_pred=round(cumulative_pred, 3),
        ))

    corridor_gain = cumulative_conv - cumulative_pred

    return CorridorResult(
        mode_label="Corridor Analysis",
        junctions=junction_results,
        total_time_conv_s=round(cumulative_conv, 3),
        total_time_pred_s=round(cumulative_pred, 3),
        corridor_gain_s=round(corridor_gain, 3),
    )
