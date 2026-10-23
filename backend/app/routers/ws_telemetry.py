"""
QueueFlush AI — WebSocket Telemetry Router
Streams seeded GPS track at 10Hz with HMAC-signed messages.
Supports {"cmd":"drop"} to simulate telemetry loss.
"""
from __future__ import annotations
import asyncio
import json
import hmac
import hashlib
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import Corridor as CorridorModel, EmergencyDevice

router = APIRouter()


def _sign_frame(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


@router.websocket("/ws/telemetry")
async def telemetry_ws(
    websocket: WebSocket,
    corridor: str = Query("hospital-corridor-a"),
):
    await websocket.accept()

    db = SessionLocal()
    try:
        row = db.query(CorridorModel).filter_by(slug=corridor).first()
        if not row:
            await websocket.send_json({"error": f"Corridor '{corridor}' not found"})
            await websocket.close()
            return

        track = json.loads(row.gps_track_json)

        # Use AMB-01 secret for signing
        device = db.query(EmergencyDevice).filter_by(device_id="AMB-01").first()
        secret = device.secret_key if device else "default-secret"

        drop_mode = False
        drop_start: float | None = None
        telemetry_lost_s = 0.0

        for i, point in enumerate(track):
            # Check for incoming commands (non-blocking)
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.001)
                cmd = json.loads(raw)
                if cmd.get("cmd") == "drop":
                    drop_mode = True
                    drop_start = time.monotonic()
                elif cmd.get("cmd") == "restore":
                    drop_mode = False
                    drop_start = None
                    telemetry_lost_s = 0.0
            except (asyncio.TimeoutError, Exception):
                pass

            if drop_mode:
                if drop_start:
                    telemetry_lost_s = time.monotonic() - drop_start
                # Send heartbeat-lost notification instead of real data
                await websocket.send_json({
                    "type": "heartbeat_lost",
                    "lost_s": round(telemetry_lost_s, 1),
                    "frame": i,
                })
            else:
                frame_payload = json.dumps({
                    "lat": point["lat"],
                    "lng": point["lng"],
                    "t": point["t"],
                    "frame": i,
                    "corridor": corridor,
                })
                sig = _sign_frame(frame_payload, secret)
                await websocket.send_json({
                    "type": "telemetry",
                    "payload": frame_payload,
                    "signature": sig,
                    "device_id": "AMB-01",
                })

            await asyncio.sleep(0.1)  # 10 Hz

        await websocket.send_json({"type": "complete", "total_frames": len(track)})

    except WebSocketDisconnect:
        pass
    finally:
        db.close()
