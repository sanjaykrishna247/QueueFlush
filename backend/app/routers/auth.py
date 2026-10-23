import hmac
import hashlib
import uuid
import secrets
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import EmergencyDevice, SafetyEventRow
from app.schemas import (
    TokenVerifyRequest,
    TokenVerifyResponse,
    TokenSignRequest,
    TokenSignResponse,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminUserOut,
    EmergencyDeviceOut,
    DeviceToggleRequest,
    DeviceAddRequest,
    SystemOverrideRequest,
    SystemOverrideResponse,
    DriverLoginRequest,
    DriverLoginResponse,
    DriverProfile,
    CitizenLoginRequest,
    CitizenLoginResponse,
    CitizenProfile,
)
from app.engine.safety import verify_token, sign_token
from app.accounts import (
    verify_admin, verify_driver, create_session, end_session,
    require_admin, check_lockout, record_failure, clear_failures,
)

router = APIRouter()

# ── Vehicle Token Verification (Edge) ─────────────────────────────────────────
@router.post("/auth/sign-token", response_model=TokenSignResponse)
def sign_device_token(req: TokenSignRequest, db: Session = Depends(get_db)):
    """
    Simulated on-board unit: signs a telemetry payload with the vehicle's own key.
    Only registered, active devices hold a key, so an unknown device cannot get a signature.
    """
    device = db.query(EmergencyDevice).filter_by(device_id=req.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Unknown device — no signing key provisioned")
    if not device.active:
        raise HTTPException(status_code=403, detail="Device deactivated — signing key revoked")
    return TokenSignResponse(
        device_id=req.device_id,
        payload=req.payload,
        signature=sign_token(req.device_id, req.payload, device.secret_key),
    )


@router.post("/auth/verify-token", response_model=TokenVerifyResponse)
def verify_device_token(req: TokenVerifyRequest, db: Session = Depends(get_db)):
    device = db.query(EmergencyDevice).filter_by(device_id=req.device_id).first()

    if not device:
        # Log rejection
        db.add(SafetyEventRow(
            run_id=None,
            type="REJECTED_TOKEN",
            t=0.0,
            detail=f"Unknown device: {req.device_id}",
        ))
        db.commit()
        return TokenVerifyResponse(
            valid=False,
            device_id=req.device_id,
            reason="Unknown device ID — signal preemption denied",
        )

    if not device.active:
        return TokenVerifyResponse(
            valid=False,
            device_id=req.device_id,
            reason="Device deactivated — contact traffic control centre",
        )

    valid = verify_token(req.device_id, req.payload, req.signature, device.secret_key)

    if not valid:
        db.add(SafetyEventRow(
            run_id=None,
            type="REJECTED_TOKEN",
            t=0.0,
            detail=f"Invalid HMAC signature from device {req.device_id}",
        ))
        db.commit()
        return TokenVerifyResponse(
            valid=False,
            device_id=req.device_id,
            reason="Invalid HMAC-SHA256 signature — possible spoofing attempt logged",
        )

    return TokenVerifyResponse(
        valid=True,
        device_id=req.device_id,
        vehicle_type=device.vehicle_type,
        reg_no=device.reg_no,
        reason="Token verified — signal preemption authorized",
    )


# ── Admin Login & Authentication ─────────────────────────────────────────────
def _mask(key: str) -> str:
    return key[:8] + "…" if key else ""


def _device_out(d: EmergencyDevice, reveal_key: bool = False) -> EmergencyDeviceOut:
    return EmergencyDeviceOut(
        id=d.id,
        device_id=d.device_id,
        vehicle_type=d.vehicle_type,
        reg_no=d.reg_no,
        secret_key=d.secret_key if reveal_key else _mask(d.secret_key),
        active=d.active,
    )


def _audit(db: Session, kind: str, detail: str) -> None:
    db.add(SafetyEventRow(run_id=None, type=kind, t=0.0, detail=detail))
    db.commit()


@router.post("/auth/admin/login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    key = "admin:" + req.username.strip().lower()
    check_lockout(key)
    acct = verify_admin(req.username, req.password, (req.pin or "").strip())
    if not acct:
        record_failure(key)
        _audit(db, "AUTH_FAILED", f"Admin sign-in failed for '{req.username.strip()[:60]}'")
        raise HTTPException(status_code=401, detail="Incorrect email, password or 2FA code.")
    clear_failures(key)

    user_info = AdminUserOut(
        username=req.username.strip().lower(),
        full_name=acct["full_name"],
        designation=acct["designation"],
        clearance_level=acct["clearance_level"],
        node_id=acct["node_id"],
        department=acct["department"],
        login_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    )
    token = create_session("admin", user_info.username, user_info.model_dump())
    _audit(db, "AUTH_GRANTED", f"Admin {user_info.username} signed in")
    return AdminLoginResponse(success=True, token=token, user=user_info, message="Signed in.")


@router.get("/auth/admin/me", response_model=AdminUserOut)
def get_current_admin(session: dict = Depends(require_admin)):
    return AdminUserOut(**session["profile"])


@router.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        end_session(authorization[len("Bearer "):].strip())
    return {"success": True}


# ── Fleet OBU Device Registry (admin only) ───────────────────────────────────
@router.get("/admin/devices", response_model=List[EmergencyDeviceOut])
def get_all_devices(db: Session = Depends(get_db), session: dict = Depends(require_admin)):
    devices = db.query(EmergencyDevice).order_by(EmergencyDevice.id.asc()).all()
    return [_device_out(d) for d in devices]


@router.post("/admin/devices/toggle", response_model=EmergencyDeviceOut)
def toggle_device_status(req: DeviceToggleRequest, db: Session = Depends(get_db), session: dict = Depends(require_admin)):
    device = db.query(EmergencyDevice).filter_by(device_id=req.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {req.device_id} not found")
    device.active = req.active
    db.commit()
    db.refresh(device)
    _audit(db, "DEVICE_UPDATED", f"{session['subject']} set {device.device_id} {'active' if device.active else 'revoked'}")
    return _device_out(device)


@router.post("/admin/devices/add", response_model=EmergencyDeviceOut)
def add_new_device(req: DeviceAddRequest, db: Session = Depends(get_db), session: dict = Depends(require_admin)):
    device_id = req.device_id.strip().upper()
    if not device_id or len(device_id) > 30:
        raise HTTPException(status_code=422, detail="Device ID must be 1–30 characters")
    if db.query(EmergencyDevice).filter_by(device_id=device_id).first():
        raise HTTPException(status_code=400, detail=f"Device {device_id} already registered")
    new_dev = EmergencyDevice(
        device_id=device_id,
        vehicle_type=req.vehicle_type,
        reg_no=req.reg_no.strip().upper(),
        secret_key=secrets.token_hex(32),   # always server-generated
        active=True,
    )
    db.add(new_dev)
    db.commit()
    db.refresh(new_dev)
    _audit(db, "DEVICE_ADDED", f"{session['subject']} registered {device_id}")
    # the full key is shown exactly once, at provisioning time
    return _device_out(new_dev, reveal_key=True)


# ── Audit Trail & Security Events ────────────────────────────────────────────
@router.get("/admin/audit-logs")
def get_audit_logs(db: Session = Depends(get_db), session: dict = Depends(require_admin)):
    logs = db.query(SafetyEventRow).order_by(SafetyEventRow.id.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "type": l.type,
            "t": l.t,
            "detail": l.detail,
            "run_id": l.run_id,
            "created_at": l.created_at.isoformat() + "Z" if l.created_at else None,
        }
        for l in logs
    ]


# ── System-Wide Emergency Preemption Override ────────────────────────────────
@router.post("/admin/override", response_model=SystemOverrideResponse)
def trigger_system_override(req: SystemOverrideRequest, db: Session = Depends(get_db), session: dict = Depends(require_admin)):
    if not (5 <= req.duration_s <= 300):
        raise HTTPException(status_code=422, detail="duration_s must be between 5 and 300 seconds")
    expires_at = (datetime.utcnow() + timedelta(seconds=req.duration_s)).strftime("%H:%M:%S UTC")
    from app.models import Intersection as IntersectionModel
    affected = [f"{i.code}: {i.name}" for i in db.query(IntersectionModel).order_by(IntersectionModel.code).limit(5).all()]
    _audit(db, "MANUAL_OVERRIDE", f"{session['subject']} held {req.scope.replace('_', ' ').lower()} green for {req.duration_s}s — {req.reason[:120]}")
    return SystemOverrideResponse(
        success=True,
        scope=req.scope,
        action=req.action,
        active_until=expires_at,
        affected_junctions=affected,
        authorized_by=session["profile"].get("full_name", session["subject"]),
    )


# ── Emergency Driver Authentication ──────────────────────────────────────────
@router.post("/auth/driver/login", response_model=DriverLoginResponse)
def driver_login(req: DriverLoginRequest, db: Session = Depends(get_db)):
    badge = req.badge_id.strip().upper()
    key = "driver:" + badge
    check_lockout(key)
    acct = verify_driver(badge, (req.pin or "").strip())
    device = db.query(EmergencyDevice).filter_by(device_id=acct["device_id"]).first() if acct else None
    reg_ok = device is not None and device.reg_no.replace(" ", "").upper() == req.vehicle_reg.replace(" ", "").upper()
    if not acct or not reg_ok:
        record_failure(key)
        _audit(db, "AUTH_FAILED", f"Driver sign-in failed for badge '{badge[:30]}'")
        raise HTTPException(status_code=401, detail="Badge, vehicle registration or PIN is incorrect.")
    if not device.active:
        raise HTTPException(status_code=403, detail="This vehicle's on-board unit has been revoked.")
    clear_failures(key)

    profile = DriverProfile(
        badge_id=badge,
        pilot_name=acct["name"],
        vehicle_id=device.device_id,
        vehicle_type="Fire tender" if device.vehicle_type.startswith("fire") else "Advanced Life Support Ambulance",
        reg_no=device.reg_no,
        assigned_hospital="Government Medical College Hospital",
        status="DISPATCH_ACTIVE · IN-TRANSIT",
        gps_active=True,
        speed_kmh=110.0,
        current_corridor="Hospital Corridor A",
    )
    token = create_session("driver", badge, profile.model_dump())
    _audit(db, "AUTH_GRANTED", f"Driver {badge} signed in on {device.device_id}")
    return DriverLoginResponse(success=True, token=token, driver=profile, message="Signed in.")


# ── Citizen Commuter Authentication ──────────────────────────────────────────
@router.post("/auth/citizen/login", response_model=CitizenLoginResponse)
def citizen_login(req: CitizenLoginRequest):
    ident = req.identifier.strip()
    profile = CitizenProfile(
        full_name="Priya Sharma",
        identifier=ident or "9876543210",
        city="Nagaram Smart City (Zone 3)",
        alert_notifications=True,
        yield_compliance_rating="Grade A+ (Section 194E MV Act Compliant)",
    )
    token = "citizen_" + secrets.token_hex(20)

    return CitizenLoginResponse(
        success=True,
        token=token,
        citizen=profile,
        message="Citizen profile authenticated. Live corridor awareness active.",
    )

