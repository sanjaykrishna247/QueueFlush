import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Run as RunModel
from app.schemas import RunOut, RunCreate

router = APIRouter()


def _run_out(r) -> RunOut:
    return RunOut(
        id=r.id,
        created_at=r.created_at,
        scenario_slug=r.scenario_slug,
        mode=r.mode,
        params=json.loads(r.params_json),
        metrics=json.loads(r.metrics_json),
        seed=r.seed,
        source=r.source,
    )


@router.get("/runs", response_model=list[RunOut])
def list_runs(
    limit: int = Query(50, ge=1, le=500),
    mode: str | None = None,
    scenario: str | None = None,
    weather: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(RunModel)
    if mode:
        q = q.filter(RunModel.mode == mode)
    if scenario:
        q = q.filter(RunModel.scenario_slug == scenario)
    if source:
        q = q.filter(RunModel.source == source)
    if weather:
        # Filter by weather in params_json (simple string contains)
        q = q.filter(RunModel.params_json.contains(f'"weather": "{weather}"'))
    rows = q.order_by(RunModel.created_at.desc()).limit(limit).all()
    return [_run_out(r) for r in rows]


@router.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    r = db.query(RunModel).filter_by(id=run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_out(r)


@router.post("/runs", response_model=RunOut)
def create_run(req: RunCreate, db: Session = Depends(get_db)):
    row = RunModel(
        created_at=datetime.utcnow(),
        scenario_slug=req.scenario_slug,
        mode=req.mode,
        params_json=json.dumps(req.params),
        metrics_json=json.dumps(req.metrics),
        seed=req.seed,
        source=req.source,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _run_out(row)


@router.delete("/runs/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)):
    r = db.query(RunModel).filter_by(id=run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Run not found")
    if r.source == "seed":
        raise HTTPException(status_code=403, detail="Cannot delete seeded runs")
    db.delete(r)
    db.commit()
    return {"deleted": run_id}
