import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Scenario, Intersection as IntersectionModel, Corridor as CorridorModel
from app.schemas import ScenarioOut, CorridorOut, IntersectionOut

router = APIRouter()


def _scenario_out(row) -> ScenarioOut:
    return ScenarioOut(
        id=row.id,
        slug=row.slug,
        name=row.name,
        description=row.description,
        tags=json.loads(row.tags_json or "[]"),
        params=json.loads(row.params_json),
        vehicle_mix=json.loads(row.vehicle_mix_json or "[]"),
        telemetry_drop_at=row.telemetry_drop_at,
        seed=row.seed,
        is_demo=row.is_demo,
    )


def _corridor_out(row) -> CorridorOut:
    return CorridorOut(
        id=row.id,
        slug=row.slug,
        name=row.name,
        hospital_name=row.hospital_name,
        total_length_km=row.total_length_km,
        intersection_codes=json.loads(row.intersection_codes_json),
        gps_track=json.loads(row.gps_track_json),
    )


@router.get("/scenarios", response_model=list[ScenarioOut])
def list_scenarios(db: Session = Depends(get_db)):
    return [_scenario_out(r) for r in db.query(Scenario).all()]


@router.get("/scenarios/{slug}", response_model=ScenarioOut)
def get_scenario(slug: str, db: Session = Depends(get_db)):
    row = db.query(Scenario).filter_by(slug=slug).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Scenario '{slug}' not found")
    return _scenario_out(row)


@router.get("/corridors", response_model=list[CorridorOut])
def list_corridors(db: Session = Depends(get_db)):
    return [_corridor_out(r) for r in db.query(CorridorModel).all()]


@router.get("/corridors/{slug}", response_model=CorridorOut)
def get_corridor(slug: str, db: Session = Depends(get_db)):
    row = db.query(CorridorModel).filter_by(slug=slug).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Corridor '{slug}' not found")
    return _corridor_out(row)


@router.get("/intersections", response_model=list[IntersectionOut])
def list_intersections(db: Session = Depends(get_db)):
    rows = db.query(IntersectionModel).all()
    return [
        IntersectionOut(
            id=r.id, code=r.code, name=r.name, lat=r.lat, lng=r.lng,
            approach_distance_m=r.approach_distance_m,
            ped_cycle_s=r.ped_cycle_s, controller_type=r.controller_type,
        )
        for r in rows
    ]
