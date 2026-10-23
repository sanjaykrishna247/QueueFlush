import json
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Run
from app.schemas import StatsResponse

router = APIRouter()


def compute_stats(db: Session) -> dict:
    """
    Headline numbers from the seeded engine runs.

    - avg wait eliminated: mean(conventional wait - predictive wait) per single-junction scenario
    - avg time saved per junction: mean(conventional crossing - predictive crossing), all junctions
    - best corridor gain: largest summed crossing-time saving over one corridor run
    """
    runs = db.query(Run).filter(Run.source == "seed").all()
    total_runs = db.query(Run).count()

    pairs: dict[tuple, dict] = defaultdict(dict)
    for r in runs:
        if r.mode not in ("conventional", "predictive"):
            continue
        pairs[(r.scenario_slug, r.seed)][r.mode] = json.loads(r.metrics_json)

    wait_saved: list[float] = []
    cross_saved: list[float] = []
    corridor_gain: dict[tuple, float] = defaultdict(float)

    for (slug, seed), modes in pairs.items():
        if "conventional" not in modes or "predictive" not in modes:
            continue
        c, p = modes["conventional"], modes["predictive"]
        d_cross = c.get("crossing_time_s", 0) - p.get("crossing_time_s", 0)
        cross_saved.append(d_cross)
        slug = slug or ""
        if slug.startswith("corridor:"):
            # slug format: corridor:<corridor-slug>:<junction-code>
            corridor_gain[(slug.split(":")[1], seed)] += d_cross
        else:
            wait_saved.append(c.get("ambulance_wait_s", 0) - p.get("ambulance_wait_s", 0))

    def mean(xs: list[float]) -> float:
        return round(sum(xs) / len(xs), 2) if xs else 0.0

    return {
        "avg_ambulance_wait_eliminated_s": mean(wait_saved),
        "avg_time_saved_per_junction_s": mean(cross_saved),
        "best_corridor_gain_s": round(max(corridor_gain.values()), 2) if corridor_gain else 0.0,
        "total_runs": total_runs,
    }


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    return StatsResponse(**compute_stats(db))
