"""
P1 Engine Tests — QueueFlush AI
Tests: predictor math, weather/heavy adjustments, partial flush,
       pedestrian hold, min yellow + all-red, fail-safe, token verify,
       seeded runs are reproducible.
"""
import math
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.engine.predictor import (
    PredictorParams, compute_prediction,
    WEATHER_FACTOR, HEAVY_VEHICLE_EXTRA_S,
)
from app.engine.safety import (
    evaluate_safety, verify_token,
    PED_MIN_CLEARANCE_S, SIDE_YELLOW_S, SIDE_ALL_RED_S, TELEMETRY_TIMEOUT_S,
)
from app.engine.simulator import simulate, simulate_both


# ── Helper ────────────────────────────────────────────────────────────────────
def base_params(**kwargs) -> PredictorParams:
    defaults = dict(
        N=8, t_delay=0.8, t_margin=1.0,
        weather="dry", heavy_count=0,
        distance_m=300.0, speed_kmh=110.0,
        ped_active=False, ped_remaining_s=0.0,
        seed=101,
    )
    defaults.update(kwargs)
    return PredictorParams(**defaults)


# ── 1. Core formula ────────────────────────────────────────────────────────────
class TestPredictorMath:

    def test_t_clear_formula(self):
        p = base_params(N=8, t_delay=0.8, t_margin=1.0, weather="dry", heavy_count=0)
        r = compute_prediction(p)
        expected_t_clear = (8 - 1) * 0.8 * 1.0 + 1.0  # 6.6s
        assert math.isclose(r.t_clear, expected_t_clear, rel_tol=1e-6)

    def test_eta_formula(self):
        p = base_params(distance_m=300.0, speed_kmh=108.0)  # 108 km/h = 30 m/s
        r = compute_prediction(p)
        expected_eta = 300.0 / 30.0  # 10s
        assert math.isclose(r.eta, expected_eta, rel_tol=1e-6)

    def test_t_trigger_formula(self):
        p = base_params(N=8, t_delay=0.8, t_margin=1.0, weather="dry", heavy_count=0,
                        distance_m=300.0, speed_kmh=110.0)
        r = compute_prediction(p)
        speed_ms = 110.0 / 3.6
        expected_eta = 300.0 / speed_ms
        expected_t_clear = (7 * 0.8) + 1.0
        expected_trigger = expected_eta - expected_t_clear
        assert math.isclose(r.t_trigger, expected_trigger, rel_tol=1e-4)

    def test_n1_single_vehicle(self):
        """N=1: t_clear = 0 * delay + margin = margin"""
        p = base_params(N=1, t_delay=0.8, t_margin=1.0, weather="dry", heavy_count=0)
        r = compute_prediction(p)
        assert math.isclose(r.t_clear, 1.0, rel_tol=1e-6)


# ── 2. Weather adjustments ─────────────────────────────────────────────────────
class TestWeather:

    def test_dry_factor(self):
        p = base_params(weather="dry")
        r = compute_prediction(p)
        assert math.isclose(r.weather_factor, 1.0)
        assert math.isclose(r.effective_t_delay, 0.8)

    def test_wet_factor(self):
        p = base_params(weather="wet", t_delay=0.8)
        r = compute_prediction(p)
        assert math.isclose(r.weather_factor, 1.25)
        assert math.isclose(r.effective_t_delay, 0.8 * 1.25, rel_tol=1e-6)

    def test_fog_factor(self):
        p = base_params(weather="fog", t_delay=0.8)
        r = compute_prediction(p)
        assert math.isclose(r.weather_factor, 1.35)
        assert math.isclose(r.effective_t_delay, 0.8 * 1.35, rel_tol=1e-6)

    def test_fog_increases_t_clear(self):
        p_dry = base_params(weather="dry")
        p_fog = base_params(weather="fog")
        assert compute_prediction(p_fog).t_clear > compute_prediction(p_dry).t_clear


# ── 3. Heavy vehicle adjustments ──────────────────────────────────────────────
class TestHeavyVehicles:

    def test_zero_heavy(self):
        p = base_params(heavy_count=0)
        r = compute_prediction(p)
        assert math.isclose(r.heavy_extra_s, 0.0)

    def test_one_heavy(self):
        p = base_params(heavy_count=1)
        r = compute_prediction(p)
        assert math.isclose(r.heavy_extra_s, HEAVY_VEHICLE_EXTRA_S, rel_tol=1e-6)

    def test_two_heavy(self):
        p = base_params(heavy_count=2)
        r = compute_prediction(p)
        assert math.isclose(r.heavy_extra_s, 2 * HEAVY_VEHICLE_EXTRA_S, rel_tol=1e-6)

    def test_heavy_increases_t_clear(self):
        p0 = base_params(heavy_count=0)
        p2 = base_params(heavy_count=2)
        assert compute_prediction(p2).t_clear > compute_prediction(p0).t_clear


# ── 4. Partial flush ───────────────────────────────────────────────────────────
class TestPartialFlush:

    def test_partial_flush_triggered(self):
        """Short distance: ambulance too close -> partial flush"""
        p = base_params(N=10, distance_m=60.0, speed_kmh=110.0)
        r = compute_prediction(p)
        assert r.partial_flush is True
        assert r.t_trigger < 0

    def test_no_partial_flush_normal(self):
        p = base_params(N=3, distance_m=300.0, speed_kmh=110.0)
        r = compute_prediction(p)
        assert r.partial_flush is False
        assert r.t_trigger > 0


# ── 5. Pedestrian safety hold ─────────────────────────────────────────────────
class TestPedestrianHold:

    def test_ped_hold_triggered_below_threshold(self):
        sd = evaluate_safety(
            sim_time=0.0,
            ped_active=True,
            ped_remaining_s=2.0,    # < 3.0 threshold
            telemetry_last_seen_s=None,
            side_phase_remaining_s=0.0,
            partial_flush=False,
        )
        assert not sd.approved
        assert sd.hold_s == pytest.approx(2.0)
        assert any("HOLD" in r for r in sd.reasons)

    def test_ped_hold_not_triggered_above_threshold(self):
        sd = evaluate_safety(
            sim_time=0.0,
            ped_active=True,
            ped_remaining_s=4.0,    # >= 3.0 threshold
            telemetry_last_seen_s=None,
            side_phase_remaining_s=0.0,
            partial_flush=False,
        )
        # No hold; side phase OK -> approved
        assert sd.hold_s == pytest.approx(0.0)

    def test_ped_not_active(self):
        sd = evaluate_safety(
            sim_time=0.0,
            ped_active=False,
            ped_remaining_s=1.0,
            telemetry_last_seen_s=None,
            side_phase_remaining_s=0.0,
            partial_flush=False,
        )
        assert sd.approved


# ── 6. Side-street minimum yellow + all-red ────────────────────────────────────
class TestIntergreen:

    def test_min_intergreen_enforced(self):
        """If side phase remaining < yellow + all-red, hold must cover it."""
        side_remaining = 2.0  # less than 3.0+1.0=4.0
        sd = evaluate_safety(
            sim_time=0.0,
            ped_active=False,
            ped_remaining_s=0.0,
            telemetry_last_seen_s=None,
            side_phase_remaining_s=side_remaining,
            partial_flush=False,
        )
        assert sd.hold_s >= side_remaining

    def test_intergreen_ok_when_enough_time(self):
        sd = evaluate_safety(
            sim_time=0.0,
            ped_active=False,
            ped_remaining_s=0.0,
            telemetry_last_seen_s=None,
            side_phase_remaining_s=5.0,  # > 4.0
            partial_flush=False,
        )
        # hold should not be triggered by side phase
        assert sd.hold_s == pytest.approx(0.0)


# ── 7. Fail-safe (telemetry drop) ─────────────────────────────────────────────
class TestFailSafe:

    def test_failsafe_triggers_when_heartbeat_lost(self):
        sd = evaluate_safety(
            sim_time=5.0,
            ped_active=False,
            ped_remaining_s=0.0,
            telemetry_last_seen_s=TELEMETRY_TIMEOUT_S + 0.1,  # just over threshold
            side_phase_remaining_s=0.0,
            partial_flush=False,
        )
        assert sd.fail_safe is True
        assert not sd.approved

    def test_no_failsafe_within_timeout(self):
        sd = evaluate_safety(
            sim_time=5.0,
            ped_active=False,
            ped_remaining_s=0.0,
            telemetry_last_seen_s=TELEMETRY_TIMEOUT_S - 0.5,  # within threshold
            side_phase_remaining_s=0.0,
            partial_flush=False,
        )
        assert sd.fail_safe is False


# ── 8. Token verification ──────────────────────────────────────────────────────
class TestTokenVerify:

    def _make_token(self, device_id: str, payload: str, secret: str) -> str:
        import hmac, hashlib
        return hmac.new(
            secret.encode(),
            f"{device_id}:{payload}".encode(),
            hashlib.sha256,
        ).hexdigest()

    def test_valid_token(self):
        secret = "abc123secret"
        sig = self._make_token("AMB-01", "dispatch:T1234", secret)
        assert verify_token("AMB-01", "dispatch:T1234", sig, secret)

    def test_invalid_token(self):
        secret = "abc123secret"
        assert not verify_token("AMB-01", "dispatch:T1234", "badsignature", secret)

    def test_wrong_device(self):
        secret = "abc123secret"
        sig = self._make_token("AMB-01", "dispatch:T1234", secret)
        assert not verify_token("AMB-99", "dispatch:T1234", sig, secret)


# ── 9. Seeded runs are reproducible ───────────────────────────────────────────
class TestReproducibility:

    def test_same_seed_same_metrics(self):
        p = base_params(seed=42)
        r1 = simulate(p, "predictive")
        r2 = simulate(p, "predictive")
        assert r1.metrics.ambulance_wait_s == r2.metrics.ambulance_wait_s
        assert r1.metrics.crossing_time_s  == r2.metrics.crossing_time_s
        assert len(r1.frames) == len(r2.frames)

    def test_different_seeds_may_differ(self):
        p1 = base_params(seed=1)
        p2 = base_params(seed=999)
        r1 = simulate(p1, "predictive")
        r2 = simulate(p2, "predictive")
        # Not guaranteed to differ, but usually will with different seeds
        # (different individual reaction delays from rng)
        # Just check both run without error
        assert r1.metrics is not None
        assert r2.metrics is not None


# ── 10. Predictive is always <= conventional ───────────────────────────────────
class TestPredictiveIsBetter:

    @pytest.mark.parametrize("N,weather,heavy", [
        (3, "dry", 0),
        (8, "dry", 1),
        (8, "wet", 1),
        (8, "fog", 2),
        (12, "dry", 3),
    ])
    def test_predictive_wait_le_conventional(self, N, weather, heavy):
        p = base_params(N=N, weather=weather, heavy_count=heavy, seed=42)
        results = simulate_both(p)
        conv_wait = results["conventional"].metrics.ambulance_wait_s
        pred_wait = results["predictive"].metrics.ambulance_wait_s
        assert pred_wait <= conv_wait + 0.05, (
            f"Predictive wait ({pred_wait}s) > conventional ({conv_wait}s) "
            f"for N={N}, weather={weather}, heavy={heavy}"
        )
