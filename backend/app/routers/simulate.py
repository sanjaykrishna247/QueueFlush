import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Scenario
from app.engine.predictor import PredictorParams
from app.engine.simulator import simulate, simulate_both
from app.schemas import (
    SimulateRequest, SimulateResponse, SimResultOut, SimEventOut, SimMetricsOut
)

router = APIRouter()


def _to_result_out(res) -> SimResultOut:
    return SimResultOut(
        mode=res.mode,
        frames=res.frames[:] if isinstance(res.frames[0], dict) else [
            {
                "t": f.t, "signal": f.signal,
                "vehicles": f.vehicles, "ambulance": f.ambulance,
                "signal_changed_at": f.signal_changed_at,
                "prediction_label": f.prediction_label,
            }
            for f in res.frames
        ],
        events=[SimEventOut(t=e.t, category=e.category, message=e.message) for e in res.events],
        metrics=SimMetricsOut(
            ambulance_wait_s=res.metrics.ambulance_wait_s,
            crossing_time_s=res.metrics.crossing_time_s,
            queue_cleared_at_s=res.metrics.queue_cleared_at_s,
            ambulance_arrived_at_s=res.metrics.ambulance_arrived_at_s,
        ),
        safety_events=[
            {"type": se.type, "t": se.t, "detail": se.detail}
            for se in res.safety_events
        ],
    )


@router.post("/simulate", response_model=SimulateResponse)
def simulate_endpoint(req: SimulateRequest, db: Session = Depends(get_db)):
    telemetry_drop = req.telemetry_drop_at

    # Prioritize live params if provided, so slider adjustments always compute fresh micro-physics
    if req.params:
        rp = req.params
        try:
            p = PredictorParams(
                N=rp.N, t_delay=rp.t_delay, t_margin=rp.t_margin,
                weather=rp.weather, heavy_count=rp.heavy_count,
                distance_m=rp.distance_m, speed_kmh=rp.speed_kmh,
                ped_active=rp.ped_active, ped_remaining_s=rp.ped_remaining_s,
                seed=req.seed,
            )
        except AssertionError as e:
            raise HTTPException(status_code=422, detail=str(e))
    elif req.scenario_slug:
        row = db.query(Scenario).filter_by(slug=req.scenario_slug).first()
        if not row:
            raise HTTPException(status_code=404, detail=f"Scenario '{req.scenario_slug}' not found")
        params_raw = json.loads(row.params_json)
        seed = req.seed if req.seed != 42 else row.seed
        if telemetry_drop is None:
            telemetry_drop = row.telemetry_drop_at
        try:
            p = PredictorParams(**params_raw, seed=seed)
        except (TypeError, AssertionError) as e:
            raise HTTPException(status_code=422, detail=str(e))
    else:
        raise HTTPException(status_code=422, detail="Provide either scenario_slug or params")

    if req.mode == "both":
        results = simulate_both(p, telemetry_drop_at=telemetry_drop)
        return SimulateResponse(
            conventional=_to_result_out(results["conventional"]),
            predictive=_to_result_out(results["predictive"]),
        )
    else:
        res = simulate(p, req.mode, telemetry_drop_at=telemetry_drop)
        out = _to_result_out(res)
        if req.mode == "conventional":
            return SimulateResponse(conventional=out)
        else:
            return SimulateResponse(predictive=out)
