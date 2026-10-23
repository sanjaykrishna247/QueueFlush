import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import BenchmarkResult, Run
from app.engine.predictor import PredictorParams
from app.engine.simulator import simulate
from app.schemas import BenchmarkResponse

router = APIRouter()


@router.post("/benchmark", response_model=BenchmarkResponse)
def run_benchmark(db: Session = Depends(get_db)):
    batch_id = f"user-batch-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    count = 0
    total_saved = 0.0
    max_saved = 0.0

    for N in range(2, 13):
        for weather in ["dry", "wet", "fog"]:
            for t_delay in [0.6, 0.8, 1.0, 1.2]:
                heavy = min(N // 4, 3)
                try:
                    p = PredictorParams(
                        N=N, t_delay=t_delay, t_margin=1.0,
                        weather=weather, heavy_count=heavy,
                        distance_m=300.0, speed_kmh=100.0,
                        seed=42,
                    )
                except AssertionError:
                    continue
                for mode in ["conventional", "predictive"]:
                    res = simulate(p, mode)  # type: ignore[arg-type]
                    db.add(BenchmarkResult(
                        batch_id=batch_id,
                        N=N, weather=weather, t_delay=t_delay,
                        heavy_count=heavy, mode=mode,
                        wait_s=res.metrics.ambulance_wait_s,
                        crossing_s=res.metrics.crossing_time_s,
                    ))
                    count += 1
                    if mode == "conventional":
                        total_saved += res.metrics.ambulance_wait_s
                    else:
                        total_saved -= res.metrics.ambulance_wait_s
                        if res.metrics.ambulance_wait_s < max_saved:
                            pass

    db.commit()
    return BenchmarkResponse(
        batch_id=batch_id,
        rows_generated=count,
        summary={
            "N_range": "2–12",
            "weather_conditions": ["dry", "wet", "fog"],
            "t_delay_values": [0.6, 0.8, 1.0, 1.2],
            "modes": ["conventional", "predictive"],
        },
    )
