@echo off
setlocal enabledelayedexpansion

echo =====================================================================
echo  QueueFlush AI — Predictive Queue-Flushing for Emergency Vehicles
echo  Team TEJAS021 · TEJAS 2026 · SASTRA Deemed University
echo =====================================================================

cd /d "%~dp0backend"
if not exist ".venv" (
    echo [*] First run: creating Python environment ^(needs Python 3.10+^)...
    python -m venv .venv
    .venv\Scripts\python -m pip install -q -r requirements.txt
)
set PY=%~dp0backend\.venv\Scripts\python.exe
if not exist "queueflush.db" (
    echo [*] First run detected: Seeding database...
    set PYTHONIOENCODING=utf-8
    "%PY%" -X utf8 seed.py --export-frontend
)

echo [*] Starting FastAPI Backend on port 8000...
start "QueueFlush Backend" cmd /k ""%PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 >nul

cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [*] First run: installing frontend packages...
    call npm install
)
echo [*] Starting Vite Frontend on port 5173...
start "QueueFlush Frontend" cmd /k "npm run dev -- --host 0.0.0.0 --port 5173"

timeout /t 3 >nul

echo [*] Opening QueueFlush AI in your default browser...
start http://localhost:5173/

echo =====================================================================
echo  QueueFlush AI is running!
echo  - Frontend: http://localhost:5173/
echo  - Backend API: http://localhost:8000/docs
echo  - Press 'D' in browser for Judge Demo Mode
echo =====================================================================
