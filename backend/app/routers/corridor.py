import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Corridor as CorridorModel, Intersection as IntersectionModel
from app.engine.corridor_defs import CORRIDOR_BY_SLUG
from app.engine.corridor import (
    CorridorParams, simulate_corridor,
    Intersection as EngIntersection,
)
from app.schemas import CorridorRequest, CorridorResponse, JunctionMetricsOut, SimMetricsOut

router = APIRouter()


@router.post("/corridor", response_model=CorridorResponse)
def run_corridor(req: CorridorRequest, db: Session = Depends(get_db)):
    row = db.query(CorridorModel).filter_by(slug=req.corridor_slug).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Corridor '{req.corridor_slug}' not found")

    codes = json.loads(row.intersection_codes_json)
    int_rows = db.query(IntersectionModel).filter(IntersectionModel.code.in_(codes)).all()
    int_map = {r.code: r for r in int_rows}
    ordered_ints = [int_map[c] for c in codes if c in int_map]

    eng_ints = [
        EngIntersection(
            code=r.code,
            name=r.name,
            approach_distance_m=r.approach_distance_m,
            ped_cycle_s=r.ped_cycle_s,
            controller_type=r.controller_type,
        )
        for r in ordered_ints
    ]

    p = req.params or {}
    defaults = CORRIDOR_BY_SLUG.get(row.slug, {})
    queue_n = p.get("queue_n") or defaults.get("queue_n") or [6] * len(eng_ints)
    if len(queue_n) != len(eng_ints):
        raise HTTPException(status_code=422, detail=f"queue_n must have {len(eng_ints)} entries")
    if any(not (1 <= int(n) <= 20) for n in queue_n):
        raise HTTPException(status_code=422, detail="queue_n values must be between 1 and 20")
    weather = p.get("weather", defaults.get("weather", "dry"))
    if weather not in ("dry", "wet", "fog"):
        raise HTTPException(status_code=422, detail="weather must be dry, wet or fog")
    speed_kmh = float(p.get("speed_kmh", 100.0))
    cp = CorridorParams(
        intersections=eng_ints,
        ambulance_speed_kmh=speed_kmh,
        t_delay=float(p.get("t_delay", 0.8)),
        t_margin=float(p.get("t_margin", 1.0)),
        weather=weather,
        heavy_count_per_junction=int(p.get("heavy_count", 1)),
        queue_n_per_junction=[int(n) for n in queue_n],
        seed=req.seed,
    )

    result = simulate_corridor(cp)

    junctions = [
        JunctionMetricsOut(
            junction_index=j.junction_index,
            code=j.code,
            name=j.name,
            queue_n=j.queue_n,
            conventional=SimMetricsOut(
                ambulance_wait_s=j.conventional.ambulance_wait_s,
                crossing_time_s=j.conventional.crossing_time_s,
                queue_cleared_at_s=j.conventional.queue_cleared_at_s,
                ambulance_arrived_at_s=j.conventional.ambulance_arrived_at_s,
            ),
            predictive=SimMetricsOut(
                ambulance_wait_s=j.predictive.ambulance_wait_s,
                crossing_time_s=j.predictive.crossing_time_s,
                queue_cleared_at_s=j.predictive.queue_cleared_at_s,
                ambulance_arrived_at_s=j.predictive.ambulance_arrived_at_s,
            ),
            time_saved_s=j.time_saved_s,
            cumulative_time_conv=j.cumulative_time_conv,
            cumulative_time_pred=j.cumulative_time_pred,
        )
        for j in result.junctions
    ]

    return CorridorResponse(
        slug=row.slug,
        name=row.name,
        hospital_name=row.hospital_name,
        weather=weather,
        speed_kmh=speed_kmh,
        junctions=junctions,
        total_time_conv_s=result.total_time_conv_s,
        total_time_pred_s=result.total_time_pred_s,
        corridor_gain_s=result.corridor_gain_s,
    )
