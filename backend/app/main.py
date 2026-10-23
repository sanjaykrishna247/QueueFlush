"""
QueueFlush AI — FastAPI Main Application
"""
from __future__ import annotations
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import create_tables, SessionLocal
from app.routers import predict, simulate, corridor, scenarios, runs, stats, auth, vision, ws_telemetry, benchmark


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and auto-seed if DB is empty
    create_tables()
    db = SessionLocal()
    try:
        from app.models import Scenario
        if db.query(Scenario).count() == 0:
            print("📦 Empty database detected — auto-seeding...")
            import subprocess, sys
            subprocess.run(
                [sys.executable, "seed.py"],
                cwd=os.path.dirname(__file__) + "/..",
                check=True,
            )
    finally:
        db.close()
    yield


app = FastAPI(
    title="QueueFlush AI",
    description="Predictive Queue-Flushing for Emergency Vehicles — TEJAS021, TEJAS 2026, SASTRA",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: local dev servers + deployed frontends.
#   CORS_ORIGINS       comma-separated exact origins, e.g. https://queueflush.vercel.app
#   CORS_ORIGIN_REGEX  optional pattern, e.g. https://queueflush-.*\.vercel\.app for preview deploys
# Auth uses bearer tokens (no cookies), so credentials are not needed.
_origins = ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"]
_origins += [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(predict.router,     prefix="/api", tags=["predict"])
app.include_router(simulate.router,    prefix="/api", tags=["simulate"])
app.include_router(corridor.router,    prefix="/api", tags=["corridor"])
app.include_router(scenarios.router,   prefix="/api", tags=["scenarios"])
app.include_router(runs.router,        prefix="/api", tags=["runs"])
app.include_router(stats.router,       prefix="/api", tags=["stats"])
app.include_router(auth.router,        prefix="/api", tags=["auth"])
app.include_router(vision.router,      prefix="/api", tags=["vision"])
app.include_router(benchmark.router,   prefix="/api", tags=["benchmark"])
app.include_router(ws_telemetry.router, tags=["websocket"])


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "QueueFlush AI Engine", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health", tags=["health"])
async def health():
    return {
        "status": "ok",
        "service": "QueueFlush AI Engine",
        "version": "1.0.0",
        "team": "TEJAS021",
        "event": "TEJAS 2026 — SASTRA",
    }
