"""API-level tests for corridor, stats, token signing and the queue-aware simulator."""
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.engine.predictor import PredictorParams
from app.engine.simulator import simulate_both

client = TestClient(app)


def _params(**kw):
    base = dict(N=8, t_delay=0.8, t_margin=1.0, weather="dry", heavy_count=0,
                distance_m=300, speed_kmh=110, seed=1)
    base.update(kw)
    return PredictorParams(**base)


# ── Simulator ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("N,weather", [(4, "dry"), (8, "dry"), (6, "wet"), (6, "fog")])
def test_predictive_has_no_standstill_when_time_allows(N, weather):
    r = simulate_both(_params(N=N, weather=weather))
    assert r["predictive"].metrics.ambulance_wait_s == pytest.approx(0.0, abs=0.1)
    assert r["conventional"].metrics.ambulance_wait_s > 2.0


def test_conventional_green_fires_on_arrival_not_at_stop_line_eta():
    r = simulate_both(_params())
    conv = r["conventional"]
    green = next(e for e in conv.events if e.category == "SIGNAL" and "GREEN" in e.message)
    # detector fires once the ambulance is waiting at the queue (never later than the stop-line ETA)
    assert green.t <= 300 / (110 / 3.6) + 0.1
    assert conv.metrics.ambulance_wait_s > 2.0


def test_predictive_crosses_sooner():
    r = simulate_both(_params(N=10))
    assert r["predictive"].metrics.crossing_time_s < r["conventional"].metrics.crossing_time_s


# ── Token signing ────────────────────────────────────────────────────────────
def test_signed_token_verifies_and_tampering_fails():
    payload = json.dumps({"id": "AMB-01", "speed": 110})
    sig = client.post("/api/auth/sign-token", json={"device_id": "AMB-01", "payload": payload}).json()["signature"]
    ok = client.post("/api/auth/verify-token", json={"device_id": "AMB-01", "payload": payload, "signature": sig}).json()
    assert ok["valid"] is True

    tampered = payload.replace("110", "999")
    bad = client.post("/api/auth/verify-token", json={"device_id": "AMB-01", "payload": tampered, "signature": sig}).json()
    assert bad["valid"] is False


def test_unregistered_device_cannot_sign():
    r = client.post("/api/auth/sign-token", json={"device_id": "NOPE-00", "payload": "x"})
    assert r.status_code == 404


# ── Corridor ─────────────────────────────────────────────────────────────────
def test_corridor_returns_real_queue_sizes():
    d = client.post("/api/corridor", json={"corridor_slug": "hospital-corridor-a"}).json()
    assert [j["queue_n"] for j in d["junctions"]] == [8, 6, 7, 5, 9]
    assert d["corridor_gain_s"] > 0
    assert d["total_time_pred_s"] < d["total_time_conv_s"]


def test_corridor_rejects_bad_queue_list():
    r = client.post("/api/corridor", json={"corridor_slug": "hospital-corridor-a", "params": {"queue_n": [1, 2]}})
    assert r.status_code == 422


# ── Stats ────────────────────────────────────────────────────────────────────
def test_stats_are_positive_savings():
    s = client.get("/api/stats").json()
    assert s["avg_ambulance_wait_eliminated_s"] > 0
    assert s["avg_time_saved_per_junction_s"] > 0
    assert s["best_corridor_gain_s"] >= s["avg_time_saved_per_junction_s"]
