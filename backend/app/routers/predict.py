from fastapi import APIRouter
from app.engine.predictor import PredictorParams, compute_prediction
from app.engine.safety import evaluate_safety
from app.schemas import PredictRequest, PredictResponse, SafetyResult

router = APIRouter()


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    p = PredictorParams(
        N=req.N,
        t_delay=req.t_delay,
        t_margin=req.t_margin,
        weather=req.weather,
        heavy_count=req.heavy_count,
        distance_m=req.distance_m,
        speed_kmh=req.speed_kmh,
        ped_active=req.ped_active,
        ped_remaining_s=req.ped_remaining_s,
        seed=0,
    )
    result = compute_prediction(p)
    safety = evaluate_safety(
        sim_time=0.0,
        ped_active=req.ped_active,
        ped_remaining_s=req.ped_remaining_s,
        telemetry_last_seen_s=None,
        side_phase_remaining_s=0.0,
        partial_flush=result.partial_flush,
    )
    return PredictResponse(
        t_clear=result.t_clear,
        eta=result.eta,
        t_trigger=result.t_trigger,
        partial_flush=result.partial_flush,
        effective_t_delay=result.effective_t_delay,
        weather_factor=result.weather_factor,
        heavy_extra_s=result.heavy_extra_s,
        conventional_wait_s=result.conventional_wait_s,
        time_saved_s=result.time_saved_s,
        safety=SafetyResult(
            approved=safety.approved,
            hold_s=safety.hold_s,
            reasons=safety.reasons,
            fail_safe=safety.fail_safe,
        ),
    )
