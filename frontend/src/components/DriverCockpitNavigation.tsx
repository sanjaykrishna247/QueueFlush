import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Play,
  Pause,
  RotateCcw,
  MapPin,
  Radio,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Gauge,
  Activity,
  Clock,
  Compass,
  PhoneCall,
  Zap,
} from 'lucide-react';

interface MissionAssignment {
  id: string;
  code: string;
  priority: 'CODE-RED (CARDIAC)' | 'CODE-RED (TRAUMA)' | 'CODE-VIOLET (ORGAN)';
  patientDetails: string;
  pickup: {
    name: string;
    landmark: string;
    coords: { x: number; y: number };
  };
  drop: {
    name: string;
    ward: string;
    coords: { x: number; y: number };
  };
  totalDistanceKm: number;
  targetSpeedKmh: number;
  hospitalContact: string;
}

interface CorridorSignal {
  id: string;
  code: string;
  name: string;
  distanceFromStartM: number;
  crossStreet: string;
  coords: { x: number; y: number };
  yoloVehicles: number;
  pedestrianStatus: 'CLEAR' | 'CLEARING' | 'WAIT';
}

const MISSIONS: MissionAssignment[] = [
  {
    id: 'm1',
    code: 'CAD-EMS-108-8842',
    priority: 'CODE-RED (TRAUMA)',
    patientDetails: '42M Poly-trauma victim · Oxygen 92% · Vitals Unstable',
    pickup: {
      name: 'Sector 9 Gandhi Road Crossing',
      landmark: 'Near Central Plaza',
      coords: { x: 50, y: 150 },
    },
    drop: {
      name: 'Govt Medical College Hospital',
      ward: 'Trauma ICU & Resuscitation Bay 1',
      coords: { x: 750, y: 150 },
    },
    totalDistanceKm: 3.2,
    targetSpeedKmh: 60,
    hospitalContact: '+91 4362 278800 (Trauma Desk)',
  },
  {
    id: 'm2',
    code: 'CAD-EMS-108-8845',
    priority: 'CODE-RED (CARDIAC)',
    patientDetails: '58F STEMI Heart Attack · Thrombolysis in transit',
    pickup: {
      name: 'Old Town Railway Colony',
      landmark: 'Platform 1 Approach',
      coords: { x: 50, y: 150 },
    },
    drop: {
      name: 'Apollo Heart Center',
      ward: 'Emergency Cath Lab 2',
      coords: { x: 750, y: 150 },
    },
    totalDistanceKm: 4.5,
    targetSpeedKmh: 65,
    hospitalContact: '+91 4362 245000 (Cath Team)',
  },
];

const SIGNALS: CorridorSignal[] = [
  {
    id: 's1',
    code: 'INT-01',
    name: 'Gandhi Road Cross',
    distanceFromStartM: 400,
    crossStreet: 'Gandhi Road North',
    coords: { x: 170, y: 150 },
    yoloVehicles: 7,
    pedestrianStatus: 'CLEAR',
  },
  {
    id: 's2',
    code: 'INT-02',
    name: 'Collectorate Circle',
    distanceFromStartM: 1050,
    crossStreet: 'Court Road Arterial',
    coords: { x: 310, y: 150 },
    yoloVehicles: 11,
    pedestrianStatus: 'CLEAR',
  },
  {
    id: 's3',
    code: 'INT-03',
    name: 'Anna Flyover Approach',
    distanceFromStartM: 1800,
    crossStreet: 'State Highway 49',
    coords: { x: 460, y: 150 },
    yoloVehicles: 5,
    pedestrianStatus: 'CLEAR',
  },
  {
    id: 's4',
    code: 'INT-04',
    name: 'Old Bus Stand Cross',
    distanceFromStartM: 2500,
    crossStreet: 'Market Street East',
    coords: { x: 600, y: 150 },
    yoloVehicles: 9,
    pedestrianStatus: 'CLEAR',
  },
  {
    id: 's5',
    code: 'INT-05',
    name: 'Medical College ER Gate',
    distanceFromStartM: 3100,
    crossStreet: 'Hospital Campus Perimeter',
    coords: { x: 710, y: 150 },
    yoloVehicles: 3,
    pedestrianStatus: 'CLEAR',
  },
];

export const DriverCockpitNavigation: React.FC = () => {
  const [selectedMission, setSelectedMission] = useState<MissionAssignment>(MISSIONS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [ambulanceProgressM, setAmbulanceProgressM] = useState<number>(180);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(60);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const totalTripMeters = selectedMission.totalDistanceKm * 1000;

  // Real-time loop driving progress
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setAmbulanceProgressM((prev) => {
        const speedMs = currentSpeedKmh / 3.6;
        const next = prev + speedMs * 0.5; // step 0.5s of real physics
        return next >= totalTripMeters ? 50 : next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying, currentSpeedKmh, totalTripMeters]);

  // Determine signal status based on ambulance proximity
  // QueueFlush AI principle:
  // If ambulance is within 350m of signal: signal is PREEMPTED GREEN (shockwave cleared)
  // If ambulance is within 650m: signal is QUEUE FLUSHING (flushing cross/ahead traffic)
  // If ambulance is > 650m away: signal is RED (standard cross-traffic cycle)
  // Once ambulance has passed signal: signal resets to NORMAL GREEN or clears
  const getSignalLiveState = (sig: CorridorSignal) => {
    const distToSignal = sig.distanceFromStartM - ambulanceProgressM;

    if (distToSignal < -40) {
      return {
        status: 'PASSED',
        lamp: 'green' as const,
        label: 'CLEARED · PASSED',
        bg: 'bg-emerald-950/40 border-emerald-800 text-emerald-400',
        dot: 'bg-emerald-400',
        waitSec: 0,
      };
    } else if (distToSignal <= 380) {
      return {
        status: 'PREEMPTED_GREEN',
        lamp: 'green' as const,
        label: 'PREEMPTED GREEN (HOLD)',
        bg: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
        dot: 'bg-emerald-400 animate-pulse',
        waitSec: 0,
      };
    } else if (distToSignal <= 750) {
      return {
        status: 'QUEUE_FLUSHING',
        lamp: 'yellow' as const,
        label: 'PRE-FLUSHING QUEUE',
        bg: 'bg-amber-500/20 border-amber-400 text-amber-300',
        dot: 'bg-amber-400 animate-ping',
        waitSec: 0,
      };
    } else {
      return {
        status: 'RED',
        lamp: 'red' as const,
        label: 'RED (CROSS-TRAFFIC)',
        bg: 'bg-rose-950/40 border-rose-800/80 text-rose-400',
        dot: 'bg-rose-500',
        waitSec: Math.max(2, Math.round((distToSignal - 700) / 16)),
      };
    }
  };

  // Find next upcoming signal
  const upcomingSignals = SIGNALS.filter((s) => s.distanceFromStartM > ambulanceProgressM);
  const nextSignal = upcomingSignals[0] || SIGNALS[SIGNALS.length - 1];
  const distToNextSignal = Math.max(0, Math.round(nextSignal.distanceFromStartM - ambulanceProgressM));
  const nextSignalState = getSignalLiveState(nextSignal);

  // Remaining trip metrics
  const remainingTripMeters = Math.max(0, totalTripMeters - ambulanceProgressM);
  const remainingTripSec = Math.round(remainingTripMeters / (currentSpeedKmh / 3.6));
  const etaMinutes = Math.floor(remainingTripSec / 60);
  const etaSeconds = remainingTripSec % 60;

  // SVG coordinate calculation for ambulance on map
  const mapWidth = 800;
  const startX = 60;
  const endX = 740;
  const progressRatio = Math.min(1, Math.max(0, ambulanceProgressM / totalTripMeters));
  const ambulanceMapX = startX + progressRatio * (endX - startX);
  const ambulanceMapY = 150;

  return (
    <div className="space-y-6 font-sans">
      {/* ─────────────────────────────────────────────────────────────────
          1. ACTIVE CAD DISPATCH ASSIGNMENT BANNER
         ───────────────────────────────────────────────────────────────── */}
      <div className="bg-[#3B0F2D] border-2 border-amber-400/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Amber accent glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                ACTIVE CAD DISPATCH: {selectedMission.code}
              </span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded font-mono uppercase">
                {selectedMission.priority}
              </span>
              <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                DSRC 5.9 GHz + 4G-V2X LINK LOCKED
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>{selectedMission.pickup.name}</span>
              <ArrowRight className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-emerald-300">{selectedMission.drop.name}</span>
            </h2>

            <p className="text-xs text-blue-200">
              <strong className="text-amber-200">Patient Triage:</strong> {selectedMission.patientDetails} ·{' '}
              <strong className="text-blue-200">Destination:</strong> {selectedMission.drop.ward} ·{' '}
              <span className="text-emerald-300 font-bold">{selectedMission.hospitalContact}</span>
            </p>
          </div>

          {/* Quick Mission Selector & Sim Toggles */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <select
              value={selectedMission.id}
              onChange={(e) => {
                const found = MISSIONS.find((m) => m.id === e.target.value);
                if (found) {
                  setSelectedMission(found);
                  setAmbulanceProgressM(100);
                }
              }}
              className="bg-[#24081B] text-white border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:border-amber-400"
            >
              <option value="m1">Mission 1: Sector 9 → Medical College (3.2 km)</option>
              <option value="m2">Mission 2: Railway Colony → Apollo Heart (4.5 km)</option>
            </select>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                isPlaying
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'PAUSE ROUTE' : 'RESUME ROUTE'}</span>
            </button>

            <button
              onClick={() => setAmbulanceProgressM(50)}
              className="p-2 bg-[#24081B] hover:bg-[#3B0F2D] border border-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
              title="Restart corridor run"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. GREEN WAVE CONSTANT VELOCITY GUIDANCE HUD
         ───────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Speed Guidance Gauge */}
        <div className="bg-[#2C0A21] border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" />
              Target Green-Wave Speed
            </span>
            <span className="bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-black">
              SYNCED
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black font-mono text-white">{currentSpeedKmh}</span>
            <span className="text-xs text-slate-400 font-mono">km/h</span>
            <span className="text-xs font-extrabold text-emerald-400 font-mono ml-auto">
              OPTIMAL {selectedMission.targetSpeedKmh} km/h
            </span>
          </div>

          <p className="text-[11px] text-emerald-300/90 font-medium mt-2 leading-relaxed">
            ✓ <strong>Maintain ~{selectedMission.targetSpeedKmh} km/h:</strong> All 5 signals programmed to flush queues right as you arrive. Zero stop-and-go braking.
          </p>

          <div className="mt-3 pt-3 border-t border-[#4A1A3C] flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[10px]">Adjust Speed:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentSpeedKmh((s) => Math.max(30, s - 5))}
                className="px-2 py-0.5 bg-[#24081B] hover:bg-[#3B0F2D] text-white rounded border border-slate-700 font-mono text-xs cursor-pointer"
              >
                -5
              </button>
              <button
                onClick={() => setCurrentSpeedKmh((s) => Math.min(100, s + 5))}
                className="px-2 py-0.5 bg-[#24081B] hover:bg-[#3B0F2D] text-white rounded border border-slate-700 font-mono text-xs cursor-pointer"
              >
                +5
              </button>
            </div>
          </div>
        </div>

        {/* Next Signal Ahead HUD */}
        <div className="bg-[#2C0A21] border-2 border-blue-500/40 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[10px] text-blue-300 font-bold uppercase tracking-wider">
            <span>Next Signal Ahead</span>
            <span className="font-mono text-white">{nextSignal.code}</span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black font-mono text-amber-400">{distToNextSignal}m</span>
              <span className="text-xs text-slate-400 block font-sans truncate">{nextSignal.name}</span>
            </div>

            {/* 3-lamp mini HUD */}
            <div className="bg-[#24081B] p-1.5 rounded-xl border border-slate-700 flex flex-col gap-1 items-center">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  nextSignalState.lamp === 'red' ? 'bg-rose-500 shadow-lg shadow-rose-500/80 animate-pulse' : 'bg-rose-950/60'
                }`}
              />
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  nextSignalState.lamp === 'yellow' ? 'bg-amber-400 shadow-lg shadow-amber-400/80 animate-ping' : 'bg-amber-950/60'
                }`}
              />
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  nextSignalState.lamp === 'green' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/80 animate-pulse' : 'bg-emerald-950/60'
                }`}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#4A1A3C] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Live State:</span>
            <span className="font-bold text-emerald-400">{nextSignalState.label}</span>
          </div>
        </div>

        {/* Queue Clearance Status */}
        <div className="bg-[#2C0A21] border border-slate-700 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Queue Shockwave Ahead
          </div>
          <div className="text-3xl font-black font-mono text-emerald-400">0.0s WAIT</div>
          <p className="text-[11px] text-slate-300">
            YOLO AI has detected <strong>{nextSignal.yoloVehicles} vehicles</strong> queued; preemption trigger activated early to clear intersection.
          </p>
          <div className="pt-2 border-t border-[#4A1A3C] text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Pedestrian Interlock:</span>
            <span className="text-emerald-400 font-bold">✓ SCU FREE</span>
          </div>
        </div>

        {/* Total ETA to Destination Hospital */}
        <div className="bg-[#2C0A21] border border-slate-700 rounded-2xl p-5 shadow-lg space-y-2">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Destination Arrival ETA
          </div>
          <div className="text-3xl font-black font-mono text-blue-300">
            {etaMinutes}m {etaSeconds < 10 ? `0${etaSeconds}` : etaSeconds}s
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Remaining: <strong>{(remainingTripMeters / 1000).toFixed(2)} km</strong> to {selectedMission.drop.name}
          </p>
          <div className="pt-2 border-t border-[#4A1A3C] text-[10px] text-slate-400 font-mono flex items-center justify-between">
            <span>Time Saved vs Normal:</span>
            <span className="text-emerald-400 font-bold">-4m 28s</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          3. INTERACTIVE CORRIDOR ROUTING MAP (PICKUP TO DROP CANVAS)
         ───────────────────────────────────────────────────────────────── */}
      <div className="bg-[#3B0F2D] border-2 border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-300">
              <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                Live Tactical Route Navigation Grid (Point A → Point B)
              </h3>
              <p className="text-xs text-slate-400">
                Continuous dynamic route overview with real-time signal heads &amp; corridor preemption waves
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 bg-emerald-950/70 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              GREEN CORRIDOR ACTIVE
            </span>
          </div>
        </div>

        {/* Tactical SVG Route Map */}
        <div className="w-full bg-[#1C0614] rounded-2xl border-2 border-[#4A1A3C] p-4 overflow-x-auto relative">
          <svg viewBox="0 0 800 280" className="w-full min-w-[700px] h-64 select-none">
            <defs>
              {/* Road Pattern */}
              <linearGradient id="roadGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6E2453" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#5E1B48" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6E2453" stopOpacity="0.4" />
              </linearGradient>

              {/* Siren Pulse Animation Filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background Grid Lines */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F243A" strokeWidth="0.8" />
            </pattern>
            <rect width="800" height="280" fill="url(#grid)" />

            {/* Cross Streets (Vertical Roads) */}
            {SIGNALS.map((sig) => (
              <g key={`cross-${sig.id}`}>
                <rect x={sig.coords.x - 18} y={20} width="36" height="240" fill="#0D1E30" stroke="#1E293B" strokeWidth="1" />
                <line x1={sig.coords.x} y1={20} x2={sig.coords.x} y2={260} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                <text x={sig.coords.x} y={35} fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">
                  {sig.crossStreet}
                </text>
              </g>
            ))}

            {/* Main Arterial Corridor (Horizontal Highway) */}
            <rect x="20" y="125" width="760" height="50" fill="#0B1A2C" stroke="#6E2453" strokeWidth="1.5" rx="6" />
            <line x1="20" y1="150" x2="780" y2="150" stroke="#E2E8F0" strokeWidth="1.8" strokeDasharray="10 8" opacity="0.4" />

            {/* Green Corridor Wave Aura (Where ambulance preemption is active) */}
            <line
              x1={Math.max(30, ambulanceMapX - 80)}
              y1="150"
              x2={Math.min(760, ambulanceMapX + 220)}
              y2="150"
              stroke="#10B981"
              strokeWidth="12"
              opacity="0.35"
              strokeLinecap="round"
              filter="url(#glow)"
            />

            {/* Traveled Route Path */}
            <line
              x1="60"
              y1="150"
              x2={ambulanceMapX}
              y2="150"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* Point A: PICKUP LOCATION PIN */}
            <g transform="translate(60, 150)">
              <circle r="14" fill="#059669" opacity="0.3" className="animate-ping" />
              <circle r="8" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
              <text x="0" y="-18" fill="#34D399" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                PICKUP (POINT A)
              </text>
              <text x="0" y="24" fill="#94A3B8" fontSize="8" textAnchor="middle" fontFamily="sans-serif">
                {selectedMission.pickup.name}
              </text>
            </g>

            {/* Point B: DROP LOCATION PIN (HOSPITAL) */}
            <g transform="translate(740, 150)">
              <circle r="16" fill="#2563EB" opacity="0.25" className="animate-pulse" />
              <rect x="-10" y="-10" width="20" height="20" rx="4" fill="#1E40AF" stroke="#60A5FA" strokeWidth="2" />
              <text x="0" y="4" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">🏥</text>
              <text x="0" y="-18" fill="#60A5FA" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                DROP (POINT B)
              </text>
              <text x="0" y="24" fill="#94A3B8" fontSize="8" textAnchor="middle" fontFamily="sans-serif">
                {selectedMission.drop.name}
              </text>
            </g>

            {/* SIGNALS ON MAP */}
            {SIGNALS.map((sig) => {
              const liveState = getSignalLiveState(sig);
              const isSelected = selectedSignalId === sig.id;

              return (
                <g
                  key={sig.id}
                  transform={`translate(${sig.coords.x}, ${sig.coords.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedSignalId(isSelected ? null : sig.id)}
                >
                  {/* Zebra Crosswalk */}
                  <line x1="-12" y1="-20" x2="-12" y2="20" stroke="#94A3B8" strokeWidth="2" opacity="0.4" strokeDasharray="3 3" />
                  <line x1="12" y1="-20" x2="12" y2="20" stroke="#94A3B8" strokeWidth="2" opacity="0.4" strokeDasharray="3 3" />

                  {/* Signal Gantry Head */}
                  <rect
                    x="-10"
                    y="-50"
                    width="20"
                    height="32"
                    rx="4"
                    fill="#1F0A18"
                    stroke={liveState.lamp === 'green' ? '#10B981' : liveState.lamp === 'yellow' ? '#F59E0B' : '#EF4444'}
                    strokeWidth="1.5"
                  />

                  {/* Red Light */}
                  <circle
                    cx="0"
                    cy="-43"
                    r="3.5"
                    fill={liveState.lamp === 'red' ? '#EF4444' : '#450A0A'}
                    filter={liveState.lamp === 'red' ? 'url(#glow)' : undefined}
                  />
                  {/* Yellow Light */}
                  <circle
                    cx="0"
                    cy="-34"
                    r="3.5"
                    fill={liveState.lamp === 'yellow' ? '#F59E0B' : '#451A03'}
                    filter={liveState.lamp === 'yellow' ? 'url(#glow)' : undefined}
                  />
                  {/* Green Light */}
                  <circle
                    cx="0"
                    cy="-25"
                    r="3.5"
                    fill={liveState.lamp === 'green' ? '#10B981' : '#064E3B'}
                    filter={liveState.lamp === 'green' ? 'url(#glow)' : undefined}
                  />

                  {/* Junction Identifier Label */}
                  <text x="0" y="52" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                    {sig.code}
                  </text>
                  <text x="0" y="63" fill="#64748B" fontSize="8" textAnchor="middle" fontFamily="sans-serif">
                    {Math.round(sig.distanceFromStartM)}m
                  </text>

                  {/* Status Banner */}
                  <rect
                    x="-32"
                    y="70"
                    width="64"
                    height="14"
                    rx="3"
                    fill={liveState.lamp === 'green' ? '#064E3B' : liveState.lamp === 'yellow' ? '#78350F' : '#450A0A'}
                    stroke={liveState.lamp === 'green' ? '#10B981' : liveState.lamp === 'yellow' ? '#F59E0B' : '#EF4444'}
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="80"
                    fill={liveState.lamp === 'green' ? '#34D399' : liveState.lamp === 'yellow' ? '#FCD34D' : '#FCA5A5'}
                    fontSize="7"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {liveState.status === 'PREEMPTED_GREEN'
                      ? 'GREEN'
                      : liveState.status === 'QUEUE_FLUSHING'
                      ? 'FLUSH'
                      : liveState.status === 'PASSED'
                      ? 'CLEARED'
                      : 'RED'}
                  </text>
                </g>
              );
            })}

            {/* LIVE MOVING AMBULANCE (VEHICLE ICON) */}
            <g transform={`translate(${ambulanceMapX}, ${ambulanceMapY})`}>
              {/* Emergency Radar Ripple */}
              <circle r="22" fill="#38BDF8" opacity="0.25" className="animate-ping" />
              <circle r="14" fill="#EF4444" opacity="0.3" className="animate-pulse" />

              {/* Ambulance Body */}
              <rect x="-14" y="-8" width="28" height="16" rx="4" fill="#FFFFFF" stroke="#3B0F2D" strokeWidth="1.5" />
              <rect x="-14" y="-8" width="8" height="16" rx="2" fill="#EF4444" />

              {/* Red Cross */}
              <rect x="2" y="-4" width="8" height="8" fill="#EF4444" rx="1" />
              <line x1="6" y1="-2" x2="6" y2="2" stroke="#FFFFFF" strokeWidth="1.5" />
              <line x1="4" y1="0" x2="8" y2="0" stroke="#FFFFFF" strokeWidth="1.5" />

              {/* Siren Lights Flashing */}
              <circle cx="-1" cy="-7" r="2" fill="#38BDF8" className="animate-ping" />
              <circle cx="1" cy="-7" r="2" fill="#EF4444" className="animate-ping" />

              {/* In-Cabin Telemetry Callout */}
              <g transform="translate(0, -26)">
                <rect x="-35" y="-12" width="70" height="16" rx="4" fill="#3B0F2D" stroke="#38BDF8" strokeWidth="1" />
                <text x="0" y="-1" fill="#38BDF8" fontSize="8" fontWeight="black" textAnchor="middle" fontFamily="monospace">
                  AMB-01 · {currentSpeedKmh}km/h
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono pt-2 border-t border-slate-700/60 text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Preempted Green (Queue Flushed)</span>
            </span>

            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Queue Flushing (Preemption In-Progress)</span>
            </span>

            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Red (Cross-Traffic Cycle)</span>
            </span>
          </div>

          <span className="text-slate-400 text-[11px]">
            *Click any junction icon on the map to inspect camera detection breakdown
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          4. CONTINUOUS CORRIDOR SIGNAL TIMELINE TRACK (PICKUP TO DROP)
         ───────────────────────────────────────────────────────────────── */}
      <div className="bg-[#3B0F2D] border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="font-black text-base text-white">
              Continuous Signal Status Track (Pickup to Hospital Drop)
            </h3>
          </div>
          <span className="text-xs text-blue-300 font-mono">
            {SIGNALS.length} Preemption Nodes Online
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SIGNALS.map((sig, i) => {
            const liveState = getSignalLiveState(sig);
            const distFromAmbulance = Math.round(sig.distanceFromStartM - ambulanceProgressM);

            return (
              <div
                key={sig.id}
                className={`p-4 rounded-2xl border transition-all ${liveState.bg} space-y-3 relative overflow-hidden`}
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">
                    Signal {i + 1}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/40">
                    {distFromAmbulance > 0 ? `${distFromAmbulance}m ahead` : `${Math.abs(distFromAmbulance)}m cleared`}
                  </span>
                </div>

                {/* Main Code & Signal Head */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-black text-white font-mono">{sig.code}</h4>
                    <p className="text-xs text-slate-300 truncate max-w-[110px]">{sig.name}</p>
                  </div>

                  {/* 3-lamp head visual */}
                  <div className="bg-[#1C0614] p-1 rounded-lg border border-slate-700/80 flex flex-col gap-1 items-center">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        liveState.lamp === 'red' ? 'bg-rose-500 shadow-sm shadow-rose-400' : 'bg-rose-950/80'
                      }`}
                    />
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        liveState.lamp === 'yellow' ? 'bg-amber-400 shadow-sm shadow-amber-300' : 'bg-amber-950/80'
                      }`}
                    />
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        liveState.lamp === 'green' ? 'bg-emerald-400 shadow-sm shadow-emerald-300' : 'bg-emerald-950/80'
                      }`}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1 font-bold">
                    <span className={`w-1.5 h-1.5 rounded-full ${liveState.dot}`} />
                    <span className="truncate">{liveState.label}</span>
                  </span>
                </div>

                {/* Details Footer */}
                <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
                  <span>YOLO: {sig.yoloVehicles} veh</span>
                  <span className="text-emerald-400 font-bold">SCU: {sig.pedestrianStatus}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
