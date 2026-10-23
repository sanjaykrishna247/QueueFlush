"""
QueueFlush AI — Idempotent Seed Script
Usage:
  python seed.py              # seed if DB is empty
  python seed.py --reset      # drop all data, re-seed
  python seed.py --export-frontend  # export offline-seed.json for frontend fallback
"""
from __future__ import annotations
import argparse
import json
import os
import random
import sys
import math
from datetime import datetime, timedelta
from pathlib import Path

# Ensure app module is importable
sys.path.insert(0, str(Path(__file__).parent))

from app.db import create_tables, SessionLocal, engine
from app.models import (
    Scenario, Intersection, Corridor, EmergencyDevice,
    VisionFixture, Run, BenchmarkResult, DecisionLog, SafetyEventRow
)
from app.engine.predictor import PredictorParams, compute_prediction
from app.engine.simulator import simulate, simulate_both
from app.engine.corridor import (
    CorridorParams, simulate_corridor, Intersection as EngIntersection
)

SEED_DIR = Path(__file__).parent / "seed"
FRONTEND_EXPORT_PATH = Path(__file__).parent.parent / "frontend" / "src" / "data" / "offline-seed.json"


def load_json(fname: str) -> list | dict:
    with open(SEED_DIR / fname, encoding="utf-8") as f:
        return json.load(f)


def build_params(p: dict, seed: int) -> PredictorParams:
    return PredictorParams(
        N=p["N"],
        t_delay=p["t_delay"],
        t_margin=p.get("t_margin", 1.0),
        weather=p["weather"],
        heavy_count=p["heavy_count"],
        distance_m=p["distance_m"],
        speed_kmh=p["speed_kmh"],
        ped_active=p.get("ped_active", False),
        ped_remaining_s=p.get("ped_remaining_s", 0.0),
        seed=seed,
    )


def generate_gps_track(intersections_data: list[dict], n_points: int = 120) -> list[dict]:
    """Generate a GPS track by interpolating between intersection coordinates."""
    if len(intersections_data) < 2:
        return []

    track = []
    total_dist = sum(
        math.sqrt(
            (intersections_data[i+1]["lat"] - intersections_data[i]["lat"])**2 +
            (intersections_data[i+1]["lng"] - intersections_data[i]["lng"])**2
        )
        for i in range(len(intersections_data) - 1)
    )

    # Distribute points proportionally to segment lengths
    t = 0
    rng = random.Random(999)
    for i in range(len(intersections_data) - 1):
        a = intersections_data[i]
        b = intersections_data[i + 1]
        seg_dist = math.sqrt((b["lat"] - a["lat"])**2 + (b["lng"] - a["lng"])**2)
        seg_points = max(2, int(n_points * seg_dist / total_dist))

        for j in range(seg_points):
            frac = j / seg_points
            # Add slight curvature noise
            noise_lat = rng.gauss(0, 0.0001)
            noise_lng = rng.gauss(0, 0.0001)
            lat = a["lat"] + (b["lat"] - a["lat"]) * frac + noise_lat
            lng = a["lng"] + (b["lng"] - a["lng"]) * frac + noise_lng
            track.append({"lat": round(lat, 6), "lng": round(lng, 6), "t": round(t, 1)})
            t += 1.0

    # Add endpoint
    last = intersections_data[-1]
    track.append({"lat": last["lat"], "lng": last["lng"], "t": round(t, 1)})
    return track


def generate_vision_fixtures(scenario: dict) -> list[dict]:
    """Generate YOLO-style detection fixtures for a scenario."""
    rng = random.Random(scenario["seed"] + 500)
    mix = scenario.get("vehicle_mix", [{"type": "car", "count": scenario["params"]["N"]}])

    detections = []
    x_base = 50
    y_base = 200
    for entry in mix:
        vtype = entry["type"]
        count = entry["count"]
        for i in range(count):
            w = 120 if vtype == "bus" else (100 if vtype == "truck" else (60 if vtype == "motorcycle" else 80))
            h = 50 if vtype in ("bus", "truck") else (35 if vtype == "motorcycle" else 45)
            conf = round(rng.uniform(0.82, 0.98), 2)
            x = x_base + rng.randint(-10, 10)
            y = y_base + i * (h + 8) + rng.randint(-3, 3)
            detections.append({
                "class": vtype,
                "conf": conf,
                "box": [x, y, w, h],
            })

    return detections


def seed_database(db, reset: bool = False):
    """Main seed function — idempotent."""

    if reset:
        print("🗑️  Dropping all data...")
        for model in [SafetyEventRow, DecisionLog, BenchmarkResult, Run,
                      VisionFixture, EmergencyDevice, Corridor, Intersection, Scenario]:
            db.query(model).delete()
        db.commit()

    # ── Scenarios ──────────────────────────────────────────────────────────
    scenarios_data = load_json("scenarios.json")
    scenario_slugs_inserted = set()
    for s in scenarios_data:
        if db.query(Scenario).filter_by(slug=s["slug"]).first():
            scenario_slugs_inserted.add(s["slug"])
            continue
        row = Scenario(
            slug=s["slug"],
            name=s["name"],
            description=s.get("description", ""),
            tags_json=json.dumps(s.get("tags", [])),
            params_json=json.dumps(s["params"]),
            vehicle_mix_json=json.dumps(s.get("vehicle_mix", [])),
            telemetry_drop_at=s.get("telemetry_drop_at"),
            seed=s["seed"],
            is_demo=s.get("is_demo", False),
        )
        db.add(row)
        scenario_slugs_inserted.add(s["slug"])
    db.commit()
    print(f"✅ Scenarios: {len(scenarios_data)}")

    # ── Intersections ──────────────────────────────────────────────────────
    ints_data = load_json("intersections.json")
    for i in ints_data:
        if db.query(Intersection).filter_by(code=i["code"]).first():
            continue
        row = Intersection(**i)
        db.add(row)
    db.commit()
    print(f"✅ Intersections: {len(ints_data)}")

    # ── Corridors ──────────────────────────────────────────────────────────
    from app.engine.corridor_defs import CORRIDOR_DEFS
    corridors_raw = [dict(c) for c in CORRIDOR_DEFS]

    int_map = {i["code"]: i for i in ints_data}
    for corr in corridors_raw:
        if db.query(Corridor).filter_by(slug=corr["slug"]).first():
            continue
        int_subset = [int_map[c] for c in corr["intersection_codes"] if c in int_map]
        track = generate_gps_track(int_subset)
        total_km = round(len(track) * 0.05, 2)  # ~50m per point approx
        row = Corridor(
            slug=corr["slug"],
            name=corr["name"],
            hospital_name=corr["hospital_name"],
            total_length_km=total_km,
            intersection_codes_json=json.dumps(corr["intersection_codes"]),
            gps_track_json=json.dumps(track),
        )
        db.add(row)
    db.commit()
    print(f"✅ Corridors: {len(corridors_raw)}")

    # ── Emergency Devices ──────────────────────────────────────────────────
    devices_data = load_json("emergency_devices.json")
    for d in devices_data:
        if db.query(EmergencyDevice).filter_by(device_id=d["device_id"]).first():
            continue
        row = EmergencyDevice(**d)
        db.add(row)
    db.commit()
    print(f"✅ Emergency Devices: {len(devices_data)}")

    # ── Vision Fixtures ────────────────────────────────────────────────────
    for s in scenarios_data:
        if db.query(VisionFixture).filter_by(scenario_slug=s["slug"]).first():
            continue
        detections = generate_vision_fixtures(s)
        row = VisionFixture(
            scenario_slug=s["slug"],
            frame_no=0,
            detections_json=json.dumps(detections),
        )
        db.add(row)
    db.commit()
    print(f"✅ Vision Fixtures: {len(scenarios_data)}")

    # ── Seeded Runs (every scenario × both modes × 5 seeds) ───────────────
    run_count = 0
    base_dt = datetime.utcnow() - timedelta(days=14)
    violations = []

    for s in scenarios_data:
        params_raw = s["params"]
        base_seed = s["seed"]
        telemetry_drop = s.get("telemetry_drop_at")

        for seed_offset_idx in range(5):
            seed = base_seed + seed_offset_idx * 1000
            created_at = base_dt + timedelta(
                days=seed_offset_idx * 2.5,
                hours=random.Random(seed).randint(0, 20),
            )

            try:
                p = build_params(params_raw, seed)
            except (AssertionError, Exception) as e:
                print(f"  ⚠️  Skip scenario {s['slug']} seed {seed}: {e}")
                continue

            results = simulate_both(p, telemetry_drop_at=telemetry_drop)

            for mode_key, res in results.items():
                metrics = {
                    "ambulance_wait_s": res.metrics.ambulance_wait_s,
                    "crossing_time_s": res.metrics.crossing_time_s,
                    "queue_cleared_at_s": res.metrics.queue_cleared_at_s,
                    "ambulance_arrived_at_s": res.metrics.ambulance_arrived_at_s,
                }
                run_row = Run(
                    created_at=created_at,
                    scenario_slug=s["slug"],
                    mode=mode_key,
                    params_json=json.dumps(params_raw),
                    metrics_json=json.dumps(metrics),
                    seed=seed,
                    source="seed",
                )
                db.add(run_row)
                db.flush()

                for ev in res.events:
                    db.add(DecisionLog(
                        run_id=run_row.id,
                        t=ev.t,
                        category=ev.category,
                        message=ev.message,
                    ))
                for sev in res.safety_events:
                    db.add(SafetyEventRow(
                        run_id=run_row.id,
                        type=sev.type,
                        t=sev.t,
                        detail=sev.detail,
                    ))
                run_count += 1

            # Verify: predictive wait <= conventional wait
            conv_wait = results["conventional"].metrics.ambulance_wait_s
            pred_wait = results["predictive"].metrics.ambulance_wait_s
            if pred_wait > conv_wait + 0.1:
                violations.append(
                    f"FAIL: {s['slug']} seed={seed} pred_wait={pred_wait:.2f} > conv_wait={conv_wait:.2f}"
                )

    db.commit()
    print(f"✅ Seeded Runs: {run_count}")

    if violations:
        print("\n❌ ENGINE VIOLATIONS DETECTED:")
        for v in violations:
            print(f"  {v}")
    else:
        print("✅ All seeded runs: predictive ≤ conventional (engine verified)")

    # ── Corridor Runs ──────────────────────────────────────────────────────
    corr_run_count = 0
    for corr in corridors_raw:
        int_subset = [int_map[c] for c in corr["intersection_codes"] if c in int_map]
        eng_ints = [
            EngIntersection(
                code=i["code"],
                name=i["name"],
                approach_distance_m=i["approach_distance_m"],
                ped_cycle_s=i.get("ped_cycle_s", 30),
                controller_type=i.get("controller_type", "NEMA TS2"),
            )
            for i in int_subset
        ]

        for seed_offset in range(3):
            seed = 200 + seed_offset * 100
            cp = CorridorParams(
                intersections=eng_ints,
                ambulance_speed_kmh=100.0,
                t_delay=0.8,
                t_margin=1.0,
                weather=corr["weather"],
                heavy_count_per_junction=1,
                queue_n_per_junction=corr["queue_n"],
                seed=seed,
            )
            result = simulate_corridor(cp)

            for junc in result.junctions:
                for mode_key, m in [("conventional", junc.conventional), ("predictive", junc.predictive)]:
                    metrics = {
                        "ambulance_wait_s": m.ambulance_wait_s,
                        "crossing_time_s": m.crossing_time_s,
                        "junction": junc.code,
                        "cumulative_time_conv": junc.cumulative_time_conv,
                        "cumulative_time_pred": junc.cumulative_time_pred,
                    }
                    run_row = Run(
                        created_at=base_dt + timedelta(days=seed_offset),
                        scenario_slug=f"corridor:{corr['slug']}:{junc.code}",
                        mode=mode_key,
                        params_json=json.dumps({"corridor": corr["slug"], "seed": seed}),
                        metrics_json=json.dumps(metrics),
                        seed=seed,
                        source="seed",
                    )
                    db.add(run_row)
                    corr_run_count += 1

    db.commit()
    print(f"✅ Corridor Runs: {corr_run_count}")

    # ── Benchmark Grid ─────────────────────────────────────────────────────
    if not db.query(BenchmarkResult).filter_by(batch_id="seed-batch-1").first():
        batch_count = 0
        BATCH_ID = "seed-batch-1"
        for N in range(2, 13):
            for weather in ["dry", "wet", "fog"]:
                for t_delay in [0.6, 0.8, 1.0, 1.2]:
                    for mode in ["conventional", "predictive"]:
                        heavy = min(N // 4, 3)
                        try:
                            p = PredictorParams(
                                N=N, t_delay=t_delay, t_margin=1.0,
                                weather=weather, heavy_count=heavy,
                                distance_m=300.0, speed_kmh=100.0,
                                seed=42,
                            )
                        except AssertionError:
                            continue
                        res = simulate(p, mode)  # type: ignore[arg-type]
                        db.add(BenchmarkResult(
                            batch_id=BATCH_ID,
                            N=N, weather=weather, t_delay=t_delay,
                            heavy_count=heavy, mode=mode,
                            wait_s=res.metrics.ambulance_wait_s,
                            crossing_s=res.metrics.crossing_time_s,
                        ))
                        batch_count += 1
        db.commit()
        print(f"✅ Benchmark Grid: {batch_count} rows (batch-id: seed-batch-1)")
    else:
        print("✅ Benchmark Grid: already seeded")

    # Print summary table
    total_runs = db.query(Run).count()
    total_scenarios = db.query(Scenario).count()
    total_intersections = db.query(Intersection).count()
    total_corridors = db.query(Corridor).count()
    total_bench = db.query(BenchmarkResult).count()
    total_logs = db.query(DecisionLog).count()

    print("\n" + "="*55)
    print("  SEED SUMMARY")
    print("="*55)
    print(f"  Scenarios       : {total_scenarios}")
    print(f"  Intersections   : {total_intersections}")
    print(f"  Corridors       : {total_corridors}")
    print(f"  Emergency Devs  : {db.query(EmergencyDevice).count()}")
    print(f"  Vision Fixtures : {db.query(VisionFixture).count()}")
    print(f"  Runs (total)    : {total_runs}")
    print(f"  Decision Logs   : {total_logs}")
    print(f"  Safety Events   : {db.query(SafetyEventRow).count()}")
    print(f"  Benchmark Rows  : {total_bench}")
    print("="*55)

    return scenarios_data, corridors_raw, int_map


def export_frontend(scenarios_data, corridors_raw, int_map, db):
    """Export offline-seed.json for frontend fallback."""
    FRONTEND_EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    demo_slugs = [s["slug"] for s in scenarios_data if s.get("is_demo")]
    demo_timelines = {}

    for slug in demo_slugs:
        s = next(x for x in scenarios_data if x["slug"] == slug)
        try:
            p = build_params(s["params"], s["seed"])
        except AssertionError:
            continue
        results = simulate_both(p, telemetry_drop_at=s.get("telemetry_drop_at"))
        demo_timelines[slug] = {
            mode: {
                "frames": [
                    {"t": f.t, "signal": f.signal, "ambulance": f.ambulance,
                     "prediction_label": f.prediction_label}
                    for f in res.frames[::5]  # downsample to 4Hz for JSON size
                ],
                "events": [{"t": e.t, "category": e.category, "message": e.message}
                           for e in res.events],
                "metrics": {
                    "ambulance_wait_s": res.metrics.ambulance_wait_s,
                    "crossing_time_s": res.metrics.crossing_time_s,
                },
            }
            for mode, res in results.items()
        }

    export = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "scenarios": [
            {
                "slug": s["slug"], "name": s["name"], "description": s.get("description", ""),
                "tags": s.get("tags", []), "params": s["params"],
                "seed": s["seed"], "is_demo": s.get("is_demo", False),
            }
            for s in scenarios_data
        ],
        "corridors": [
            {
                "slug": c["slug"], "name": c["name"], "hospital_name": c["hospital_name"],
                "intersection_codes": c["intersection_codes"], "queue_n": c["queue_n"],
                "weather": c["weather"],
            }
            for c in corridors_raw
        ],
        "demo_timelines": demo_timelines,
        "stats": compute_stats(db),
    }

    with open(FRONTEND_EXPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(export, f, indent=2)

    print(f"✅ Frontend offline seed exported: {FRONTEND_EXPORT_PATH}")


def compute_stats(db) -> dict:
    # Single source of truth: same logic as GET /api/stats
    from app.routers.stats import compute_stats as _compute
    return _compute(db)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QueueFlush AI — Seed Database")
    parser.add_argument("--reset", action="store_true", help="Drop and re-seed all data")
    parser.add_argument("--export-frontend", action="store_true", help="Export offline-seed.json")
    args = parser.parse_args()

    create_tables()
    db = SessionLocal()

    try:
        print("🚀 QueueFlush AI — Seeding Database")
        print("="*55)
        scenarios_data, corridors_raw, int_map = seed_database(db, reset=args.reset)

        if args.export_frontend:
            export_frontend(scenarios_data, corridors_raw, int_map, db)

    finally:
        db.close()

    print("\n✅ Seeding complete!")
