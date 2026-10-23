"""Portal authentication and admin authorization."""
from fastapi.testclient import TestClient

from app.main import app
from app import accounts

client = TestClient(app)
ADMIN = {"username": "admin@queueflush.ai", "password": "QueueFlush@2026", "pin": "2026"}
DRIVER = {"badge_id": "PILOT-108", "vehicle_reg": "TN 49 AB 1084", "pin": "1080"}


def _admin_headers():
    tok = client.post("/api/auth/admin/login", json=ADMIN).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def setup_function():
    accounts._FAILED.clear()


def test_admin_login_ok():
    r = client.post("/api/auth/admin/login", json=ADMIN)
    assert r.status_code == 200 and r.json()["token"].startswith("admin_")


def test_admin_wrong_password_or_pin_rejected():
    assert client.post("/api/auth/admin/login", json={**ADMIN, "password": "letmein"}).status_code == 401
    assert client.post("/api/auth/admin/login", json={**ADMIN, "pin": "0000"}).status_code == 401
    assert client.post("/api/auth/admin/login", json={**ADMIN, "username": "x@y.com"}).status_code == 401


def test_lockout_after_repeated_failures():
    bad = {**ADMIN, "password": "nope"}
    for _ in range(accounts.MAX_FAILED):
        client.post("/api/auth/admin/login", json=bad)
    assert client.post("/api/auth/admin/login", json=ADMIN).status_code == 429


def test_admin_endpoints_require_session():
    assert client.get("/api/admin/devices").status_code == 401
    assert client.get("/api/admin/audit-logs").status_code == 401
    assert client.post("/api/admin/override", json={}).status_code == 401
    assert client.get("/api/auth/admin/me").status_code == 401


def test_device_keys_are_masked():
    devices = client.get("/api/admin/devices", headers=_admin_headers()).json()
    assert devices and all(d["secret_key"].endswith("…") and len(d["secret_key"]) <= 9 for d in devices)


def test_driver_login_checks_pin_and_vehicle():
    assert client.post("/api/auth/driver/login", json=DRIVER).status_code == 200
    assert client.post("/api/auth/driver/login", json={**DRIVER, "pin": "9999"}).status_code == 401
    assert client.post("/api/auth/driver/login", json={**DRIVER, "vehicle_reg": "TN 49 AB 2271"}).status_code == 401


def test_driver_token_cannot_use_admin_api():
    tok = client.post("/api/auth/driver/login", json=DRIVER).json()["token"]
    assert client.get("/api/admin/devices", headers={"Authorization": f"Bearer {tok}"}).status_code == 403


def test_logout_ends_session():
    h = _admin_headers()
    assert client.get("/api/auth/admin/me", headers=h).status_code == 200
    client.post("/api/auth/logout", headers=h)
    assert client.get("/api/auth/admin/me", headers=h).status_code == 401
