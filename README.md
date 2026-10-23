# QueueFlush AI — Predictive Queue-Flushing for Emergency Vehicles

**Team TEJAS021 · TEJAS 2026 Grand Finale**  
*SASTRA Deemed University · TEMENOS & SASTRA ASCEND*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com)
[![Python Tests](https://img.shields.io/badge/pytest-50%20passed-brightgreen.svg)](https://pytest.org)
[![Theme](https://img.shields.io/badge/Design-Light%20Theme-F6F8FB.svg)](#design-system)

---

## 1. Executive Summary & Core Innovation

Conventional emergency vehicle preemption turns traffic signals **GREEN only when the emergency vehicle reaches the intersection stop line**. Stopped vehicles do not accelerate simultaneously; each driver has a human perception-reaction delay ($0.8\text{s}$ average). Consequently, the emergency vehicle is halted behind a cascade of slowly starting vehicles—this is **The Blockade Anomaly**.

**QueueFlush AI** predicts the queue clearance time and preempts the signal early:

$$T_{clear} = (N - 1) \cdot (t_{delay} \cdot w_f) + t_{margin} + t_{heavy}$$

$$T_{trigger} = \text{ETA} - T_{clear}$$

Where:
- $N$: Vehicles queued in the approach lane (provided by YOLO edge vision).
- $t_{delay}$: Per-driver startup reaction delay (default $0.8\text{s}$, range $0.4\text{s} - 1.6\text{s}$).
- $w_f$: Environmental drag factor ($\text{dry} = 1.0$, $\text{wet} = 1.25$, $\text{fog} = 1.35$).
- $t_{heavy}$: Extra startup delay for commercial vehicles ($+0.6\text{s}$ per bus/truck).
- $t_{margin}$: Safety buffer (default $1.0\text{s}$).
- $\text{ETA} = \frac{\text{distance to stop line}}{\text{ambulance speed}}$.
- $T_{trigger}$: Time offset from vehicle arrival to trigger early green.

If $\text{ETA} < T_{clear}$ (ambulance is too close), the engine triggers an immediate **Partial Flush**, still minimizing delay compared to conventional preemption.

### Deterministic Safety Layer
Safety invariants are governed by an audited rule engine:
1. **Pedestrian Phase Protection**: Active pedestrian clearance with $< 3.0\text{s}$ left triggers a `SAFETY HOLD`.
2. **Cross-Traffic Clearance**: Guaranteed minimum $3.0\text{s}$ yellow $+ 1.0\text{s}$ all-red before signal transitions.
3. **Fail-Safe Fallback**: Telemetry heartbeat loss $> 2.0\text{s}$ triggers immediate fallback to safe fixed timers.
4. **Zero-Trust Security**: HMAC-SHA256 signature verification protects against spoofed siren broadcasts.

---

## 2. Tech Stack & 100% Offline Guarantee

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS v4, Framer Motion, Recharts, Lucide Icons.
- **Rendering**: HTML5 Canvas running at 60 FPS, `window.devicePixelRatio`-aware for crisp projector display.
- **Backend**: FastAPI (Python 3.11+ / 3.14), SQLite via SQLAlchemy, Pydantic v2, Uvicorn, WebSockets.
- **Offline Guarantee**: All fonts (`Plus Jakarta Sans`, `JetBrains Mono`) are bundled locally via `@fontsource`. Zero external CDN calls, zero paid API keys. Full offline seed fallback (`offline-seed.json`) is packaged directly in the bundle.

---

## 3. Quick Start (One-Click Launch)

### Windows
Double-click `run.bat` or run in terminal:
```cmd
run.bat
```
*Auto-seeds SQLite database if missing, starts both backend and frontend, and opens the browser.*

### Linux / macOS
```bash
chmod +x run.sh
./run.sh
```

---

## 4. Manual Setup

### Backend Setup
```bash
cd backend
python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt   # needs Python 3.10+
python -X utf8 seed.py --export-frontend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Run pytest test suite:
```bash
python -m pytest
```
*(All 50 unit, scenario, API and auth tests pass)*

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173/** in your browser.

---

## Portal Credentials (demo accounts)

| Portal | Login | Password / PIN |
| :--- | :--- | :--- |
| Control room (admin) | `admin@queueflush.ai` | password `QueueFlush@2026`, 2FA `2026` |
| Driver — ambulance AMB-01 | badge `PILOT-108`, vehicle `TN 49 AB 1084` | PIN `1080` |
| Driver — ambulance AMB-02 | badge `PILOT-109`, vehicle `TN 49 AB 2271` | PIN `1090` |
| Driver — fire tender FIRE-01 | badge `FIRE-101`, vehicle `TN 49 GH 1001` | PIN `1010` |

Passwords are stored as salted PBKDF2 hashes; 5 wrong attempts lock an account for 60 s. Admin APIs need a session token.

---

## Deploy (Render backend + Vercel frontend)

**1. Push to GitHub** (the repo root is this `queueflush-ai` folder).

**2. Backend → Render**
- Render dashboard → **New → Blueprint** → select the repo. `render.yaml` sets everything up (root `backend/`, Python 3.12, `uvicorn` on `$PORT`, health check `/api/health`).
- When asked for `CORS_ORIGINS`, enter your Vercel URL (you can fill it in after step 3, then redeploy).
- Note the service URL, e.g. `https://queueflush-api.onrender.com`. Open `/api/health` to confirm.

**3. Frontend → Vercel**
- Vercel → **Add New → Project** → import the repo → set **Root Directory** to `frontend` (framework: Vite, settings come from `vercel.json`).
- Add environment variable `VITE_API_URL` = your Render URL (no trailing slash needed). Deploy.

**4.** Put the Vercel URL into Render's `CORS_ORIGINS` and redeploy the backend.

Things to know about the free tiers:
- Render free instances sleep after ~15 min idle; the first request takes ~30–60 s. **Open the backend URL a minute before presenting.** The site shows "Offline demo" until it wakes.
- The SQLite database lives on Render's temporary disk: it resets to the committed seed data on every redeploy/restart, and sign-in sessions reset too.

---

## 5. Judge Grand-Finale Demo Script (~3 Minutes Walkthrough)

Follow this sequence for the judge presentation:

| Step | Action | What to Explain to Judges |
| :--- | :--- | :--- |
| **1. Landing Page** | Open `http://localhost:5173/` | Show the **Live Preview Canvas** and the **3 Big Live Stat Cards** computed directly from the engine ($6.9\text{s}$ wait eliminated, $7.7\text{s}$ saved/junction, $42.0\text{s}$ corridor gain). Explain **The Blockade Anomaly**. |
| **2. 5-Stage Pipeline** | Click on pipeline stages | Click **AI Predictor** and **Safety Controller** to show the live hardware/software parameters. |
| **3. Live Simulator** | Click **"Launch Live Simulator"** in top nav | Show the **Split-Screen Canvas**: Left = Conventional (Red Pill), Right = Predictive (Plum Pill). Click **"Play Simulation"**. Point out the amber reaction rings when queued cars start, the red `BLOCKED ~9s` bubble on conventional, and the green 0.0s wait on predictive. |
| **4. Live Formula & Terminal** | Scroll down on Simulator | Move the **Queue Size (N)** and **Weather** sliders. Show the dark **Formula Card** dynamically computing live values, and point to the monospace **Decision Log Terminal** recording `[VISION]`, `[PREDICT]`, `[SAFETY]`, and `[SIGNAL]`. |
| **5. Corridor Mode** | Click **"Corridor"** in top nav | Select `Hospital Corridor A`. Click **"Start the run"**. Watch the horizontal 5-junction green wave pre-clear 3 intersections ahead on the Smart City GPS Map, and observe the cumulative bar race saving **~42s** to the hospital ER. |
| **6. Analytics & Benchmark** | Click **"Analytics"** in top nav | Show the 4 live Recharts charts (Wait vs Queue, Time Saved/Junction, Weather & t_delay effect, Safety Donut). Click **"Batch Benchmark"** to show real-time headless evaluation of 264 configurations. |
| **7. Architecture & Security** | Click **"Architecture"** in top nav | Demonstrate the 5-node topology. In the **HMAC Handshake Testbed**, click **"Transmit Valid Token"** (shows green verified check), then click **"Transmit Spoofed Token"** (shows red cross rejected attacker). |
| **8. Judge Demo Mode** | Press key **"D"** on keyboard | Triggers the 90-second guided autoplay presentation with synchronized scenario slides, slide timers, and executive summaries. |

---

## 6. Seeded Scenario Testbed

1. `rush-hour-hospital-road`: $N=8$, $110\text{ km/h}$, $t_{delay}=0.8\text{s}$, dry, $300\text{m}$ (Grand Finale Demo).
2. `light-traffic-night`: $N=3$, $140\text{ km/h}$, $t_{delay}=0.6\text{s}$, dry, $300\text{m}$.
3. `monsoon-evening`: $N=9$, $90\text{ km/h}$, $t_{delay}=0.8\text{s}$, wet ($1.25\times$), $300\text{m}$.
4. `foggy-dawn-highway`: $N=6$, $80\text{ km/h}$, $t_{delay}=0.9\text{s}$, fog ($1.35\times$), $350\text{m}$.
5. `bus-depot-exit`: $N=7$ ($3$ buses, $1$ truck), heavy vehicles add $+2.4\text{s}$.
6. `school-zone-pedestrian`: $N=5$, active pedestrian phase with $< 3.0\text{s}$ clearance triggers `SAFETY HOLD`.
7. `market-gridlock`: $N=12$, $70\text{ km/h}$, $t_{delay}=1.2\text{s}$, dry, $250\text{m}$.
8. `too-close-partial-flush`: $N=10$, distance $120\text{m}$ ($\text{ETA} < T_{clear}$) triggers immediate `PARTIAL FLUSH`.
9. `telemetry-dropout`: Telemetry stream dropped at $t=2.5\text{s}$ triggers `FAIL-SAFE` fixed timer revert.
10. `fire-engine-heavy`: Fire engine vehicle dynamics ($10\text{m}$ length, $1.0\text{ m/s}^2$ acceleration).
11. `elderly-driver-delays`: High perception delay ($t_{delay}=1.5\text{s}$).
12. `spoofed-signal-attack`: Forged HMAC cryptographic token triggers `REJECTED_TOKEN`.

---

## 7. License & Attribution

Developed by **Team TEJAS021** for **TEJAS 2026** at **SASTRA Deemed University**, sponsored by **TEMENOS & SASTRA ASCEND**.
All engine calculations are 100% deterministic and live-computed.
