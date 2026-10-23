"""
Portal accounts, password checking and sessions.

Passwords and PINs are stored only as salted PBKDF2-SHA256 hashes.
Sessions are random bearer tokens held in memory with an expiry.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Optional

from fastapi import Header, HTTPException

PBKDF2_ROUNDS = 200_000
SESSION_TTL_S = 8 * 3600
MAX_FAILED = 5
LOCKOUT_S = 60


def _check(secret: str, rec: dict) -> bool:
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode(), bytes.fromhex(rec["salt"]), PBKDF2_ROUNDS).hex()
    return hmac.compare_digest(digest, rec["hash"])


ADMIN_ACCOUNTS: dict[str, dict] = {
    "admin@queueflush.ai": {
        "password": {'salt': 'ae25eedb3524ea1b69328aabc21a5252', 'hash': 'f3dcafa30efbc36fb47487f2a9d4620e468fdd7ee2a4d8e1e508c8c1300452d2'},
        "pin": {'salt': '9971f9d01b4db2dfe7a89122254906de', 'hash': '739965a4344eb1f859d14b6b18ab6f1623902b21ffbf88e1be9cafc729bbf713'},
        "full_name": "Control Room Supervisor",
        "designation": "Traffic Control Centre — Emergency Preemption",
        "clearance_level": "SUPERVISOR",
        "node_id": "TCC-NODE-021",
        "department": "QueueFlush AI · Team TEJAS021",
    },
}

DRIVER_ACCOUNTS: dict[str, dict] = {
    "PILOT-108": {"pin": {'salt': '4a8742ffc91d3e0ad5797eb8a18ff566', 'hash': '1027cc86cbe0fb245b4702404c66ededb30487a3023692e937bfabc45b96aed5'}, "device_id": "AMB-01", "name": "K. Murugan (108 EMS pilot)"},
    "PILOT-109": {"pin": {'salt': '58f3fc5598f96abd52acd4f46d76bae2', 'hash': 'f76f735c7719c61a2b9e24c30851bb4aff559f0d56eaa48717553210e92e32bf'}, "device_id": "AMB-02", "name": "S. Priya (108 EMS pilot)"},
    "FIRE-101":  {"pin": {'salt': '8fa0654d5b31be1e1be4376bd3f2021b', 'hash': 'd89c2a146fb0d8fb503f34908d62f20d531faaa59c33a582bea88ef37d6a3319'},  "device_id": "FIRE-01", "name": "R. Kumar (Fire & Rescue)"},
}

# token -> {"role": "admin"|"driver", "subject": str, "expires": float, "profile": dict}
SESSIONS: dict[str, dict] = {}
_FAILED: dict[str, list[float]] = {}


def check_lockout(key: str) -> None:
    now = time.time()
    recent = [t for t in _FAILED.get(key, []) if now - t < LOCKOUT_S]
    _FAILED[key] = recent
    if len(recent) >= MAX_FAILED:
        wait = int(LOCKOUT_S - (now - recent[0])) + 1
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {wait}s.")


def record_failure(key: str) -> None:
    _FAILED.setdefault(key, []).append(time.time())


def clear_failures(key: str) -> None:
    _FAILED.pop(key, None)


def verify_admin(username: str, password: str, pin: str) -> Optional[dict]:
    acct = ADMIN_ACCOUNTS.get(username.strip().lower())
    if not acct:
        # still spend the hashing time so unknown users aren't distinguishable by timing
        _check(password, {"salt": "00" * 16, "hash": "00" * 32})
        return None
    ok_pw = _check(password, acct["password"])
    ok_pin = _check(pin, acct["pin"])
    return acct if (ok_pw and ok_pin) else None


def verify_driver(badge: str, pin: str) -> Optional[dict]:
    acct = DRIVER_ACCOUNTS.get(badge.strip().upper())
    if not acct:
        _check(pin, {"salt": "00" * 16, "hash": "00" * 32})
        return None
    return acct if _check(pin, acct["pin"]) else None


def create_session(role: str, subject: str, profile: dict) -> str:
    token = f"{role}_" + secrets.token_urlsafe(32)
    SESSIONS[token] = {"role": role, "subject": subject, "expires": time.time() + SESSION_TTL_S, "profile": profile}
    return token


def end_session(token: str) -> None:
    SESSIONS.pop(token, None)


def _session_from_header(authorization: Optional[str], role: str) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required", headers={"WWW-Authenticate": "Bearer"})
    token = authorization[len("Bearer "):].strip()
    sess = SESSIONS.get(token)
    if not sess or sess["expires"] < time.time():
        SESSIONS.pop(token, None)
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    if sess["role"] != role:
        raise HTTPException(status_code=403, detail="Not allowed for this account type")
    return {**sess, "token": token}


def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    return _session_from_header(authorization, "admin")


def require_driver(authorization: Optional[str] = Header(None)) -> dict:
    return _session_from_header(authorization, "driver")
