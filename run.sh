#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "====================================================================="
echo " QueueFlush AI — Predictive Queue-Flushing for Emergency Vehicles"
echo " Team TEJAS021 · TEJAS 2026 · SASTRA Deemed University"
echo "====================================================================="

# Check/seed backend (needs Python 3.10+; uses a local venv)
cd "$DIR/backend"
if [ ! -d ".venv" ]; then
    echo "[*] Creating Python virtual env..."
    PY=$(command -v python3.12 || command -v python3.11 || command -v python3)
    "$PY" -m venv .venv
    .venv/bin/pip install -q -r requirements.txt
fi
PYTHON="$DIR/backend/.venv/bin/python"
if [ ! -f "queueflush.db" ]; then
    echo "[*] First run: Seeding database..."
    export PYTHONIOENCODING=utf-8
    "$PYTHON" -X utf8 seed.py --export-frontend
fi

echo "[*] Starting FastAPI Backend on http://localhost:8000..."
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

cd "$DIR/frontend"
[ -d node_modules ] || npm install --legacy-peer-deps
echo "[*] Starting Vite Frontend on http://localhost:5173..."
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo "====================================================================="
echo " QueueFlush AI is running!"
echo " Frontend: http://localhost:5173/"
echo " Backend:  http://localhost:8000/docs"
echo " Press Ctrl+C to terminate both servers."
echo "====================================================================="

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
