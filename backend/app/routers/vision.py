import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import VisionFixture
from app.schemas import VisionFixtureOut

router = APIRouter()


@router.get("/vision/fixtures/{scenario_slug}", response_model=VisionFixtureOut)
def get_vision_fixtures(scenario_slug: str, db: Session = Depends(get_db)):
    row = db.query(VisionFixture).filter_by(scenario_slug=scenario_slug).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No vision fixtures for '{scenario_slug}'")
    detections = json.loads(row.detections_json)
    return VisionFixtureOut(
        scenario_slug=row.scenario_slug,
        frame_no=row.frame_no,
        detections=detections,
        count=len(detections),
    )


@router.post("/vision/detect")
def detect_live():
    """
    Real YOLOv8n inference endpoint.
    Returns 501 if ultralytics is not installed.
    """
    try:
        import ultralytics  # noqa: F401
        return JSONResponse(
            status_code=501,
            content={"message": "YOLOv8n is installed. Provide an image file for inference."}
        )
    except ImportError:
        return JSONResponse(
            status_code=501,
            content={
                "message": "Live YOLOv8 inference not available (ultralytics not installed). "
                           "Using seeded detection fixtures instead. "
                           "Install with: pip install ultralytics",
                "fallback": "Use /api/vision/fixtures/{scenario_slug} for demo detections",
            }
        )
