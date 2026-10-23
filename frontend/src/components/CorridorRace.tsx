import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TopCar, TopAmbulance } from './Vehicles';
import { Hospital, Play, RotateCcw, Timer } from 'lucide-react';

/**
 * Two-lane race along a 5-junction corridor.
 * Positions are in % of road width; time in seconds (sim time).
 */
const JX = [14, 31, 48, 65, 82]; // junction stop-line x (%)
const HOSPITAL_X = 95;
const V = 15; // ambulance cruise speed (%/s)
const A_AMB = 24; // ambulance acceleration (%/s²)
const A_CAR = 14; // queued car acceleration (%/s²)
const V_CAR = 16;
const REACT = 0.55; // per-driver reaction delay (s)
const CAR_W = 2.7;
const CAR_GAP = 3.2;
const AMB_W = 4.2;
const START_X = -75;
const DT = 1 / 60;

const palette = ['#64748B', '#E2E8F0', '#0F766E', '#B91C1C', '#1E3A8A', '#CA8A04'];

type Mode = 'conventional' | 'predictive';

interface SimTrack {
  amb: number[]; // amb left x per frame
  greens: (number | null)[];
  finish: number;
  waits: number[];
}

function stopPoint(j: number, n: number) {
  // left x where the ambulance must stop behind the last queued car
  return JX[j] - CAR_W - (n - 1) * CAR_GAP - AMB_W - 0.8;
}

function simulate(mode: Mode, queues: number[]): SimTrack {
  const greens: (number | null)[] = queues.map(() => null);
  const waits = queues.map(() => 0);
  const amb: number[] = [];
  let x = START_X;
  let v = V;
  let t = 0;
  while (x < HOSPITAL_X + 2 && t < 60) {
    amb.push(x);
    if (mode === 'predictive') {
      // look ahead: pre-clear every junction whose queue needs to start moving now
      JX.forEach((jx, k) => {
        if (greens[k] !== null || jx <= x + AMB_W - 0.5) return;
        const n = queues[k];
        const clearT = 0.3 + (n - 1) * REACT + 1.0;
        const eta = Math.max(0, (stopPoint(k, n) - x) / V);
        if (eta <= clearT + 0.6) greens[k] = t;
      });
    }
    const j = JX.findIndex((jx) => jx > x + AMB_W - 0.5);
    let mustStop = false;
    let stopAt = Infinity;
    if (j >= 0) {
      const n = queues[j];
      const sp = stopPoint(j, n);
      const clearT = 0.3 + (n - 1) * REACT + 1.0;
      if (greens[j] === null) {
        if (mode === 'predictive') {
          const eta = Math.max(0, (sp - x) / V);
          if (eta <= clearT + 0.6) greens[j] = t;
        } else if (x >= sp - 0.05) {
          greens[j] = t;
        }
      }
      const g = greens[j];
      const free = g !== null && t >= g + 0.3 + (n - 1) * REACT + 1.0;
      if (!free && x <= sp + 0.01) {
        mustStop = true;
        stopAt = sp;
      }
    }
    if (mustStop && x + v * DT >= stopAt) {
      x = stopAt;
      v = 0;
      if (j >= 0) waits[j] += DT;
    } else {
      v = Math.min(V, v + A_AMB * DT);
      x += v * DT;
    }
    t += DT;
  }
  return { amb, greens, finish: t, waits };
}

function carX(start: number, dep: number | null, t: number) {
  if (dep === null || t < dep) return start;
  const dt = t - dep;
  const tMax = V_CAR / A_CAR;
  if (dt < tMax) return start + 0.5 * A_CAR * dt * dt;
  return start + 0.5 * A_CAR * tMax * tMax + V_CAR * (dt - tMax);
}

const Road: React.FC<{
  mode: Mode;
  track: SimTrack;
  queues: number[];
  t: number;
  names: string[];
}> = ({ mode, track, queues, t, names }) => {
  const frame = Math.min(track.amb.length - 1, Math.floor(t / DT));
  const ax = track.amb[frame];
  const done = t >= track.finish;
  const elapsed = Math.min(t, track.finish);
  const conv = mode === 'conventional';
  const stopped = frame > 0 && Math.abs(track.amb[frame] - track.amb[frame - 1]) < 1e-6 && !done && ax > START_X;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${conv ? 'bg-red-500' : 'bg-[#5E1B48]'}`} />
          <span className={`text-sm font-semibold ${conv ? 'text-red-600' : 'text-[#5E1B48]'}`}>
            {conv ? 'Conventional signals' : 'QueueFlush AI green wave'}
          </span>
          {stopped && (
            <span className="text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-md">stopped at red</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-sm ${done ? (conv ? 'text-red-600 font-bold' : 'text-[#5E1B48] font-bold') : 'text-[#3F3340]'}`}>
          <Timer className="w-4 h-4" />
          {elapsed.toFixed(1)}s {done && '· arrived'}
        </div>
      </div>

      <div className="relative h-[118px] rounded-2xl overflow-hidden border border-black/15" style={{ background: 'linear-gradient(#5b8a4a,#4f7a41)' }}>
        {/* main road */}
        <div className="absolute inset-x-0 top-[30px] bottom-[30px]" style={{ background: 'linear-gradient(#3d3d42,#36363b)' }} />
        <div className="absolute inset-x-0 top-[27px] h-[3px] bg-[repeating-linear-gradient(90deg,#e5e5e5_0_12px,#9ca3af_12px_24px)]" />
        <div className="absolute inset-x-0 bottom-[27px] h-[3px] bg-[repeating-linear-gradient(90deg,#e5e5e5_0_12px,#9ca3af_12px_24px)]" />
        <div className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#facc15_0_16px,transparent_16px_30px)] opacity-80" />

        {/* junctions */}
        {JX.map((jx, j) => {
          const g = track.greens[j];
          const passed = ax > jx + 3;
          const green = g !== null && t >= g && !(passed && t > (g ?? 0) + 0.3 + queues[j] * REACT + 4);
          return (
            <React.Fragment key={j}>
              <div className="absolute top-0 bottom-0 w-[5%]" style={{ left: `${jx + 0.6}%`, background: '#3a3a3f' }} />
              <div className="absolute top-[30px] bottom-[30px] w-[1.6%] bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.8)_0_5px,transparent_5px_10px)]" style={{ left: `${jx + 0.6}%` }} />
              <div className="absolute bottom-[30px] w-[2px] h-[29px] bg-white/90" style={{ left: `${jx + 0.2}%` }} />
              {/* signal head */}
              <div className="absolute bottom-[4px] z-20 flex gap-[2px] p-[2px] rounded bg-[#111] border border-black" style={{ left: `${jx - 1.4}%` }}>
                <span className="w-2 h-2 rounded-full transition-colors duration-150" style={{ background: green ? '#3A1515' : '#EF4444', boxShadow: green ? 'none' : '0 0 6px #EF4444' }} />
                <span className="w-2 h-2 rounded-full transition-colors duration-150" style={{ background: green ? '#22C55E' : '#11291A', boxShadow: green ? '0 0 8px #22C55E' : 'none' }} />
              </div>
              <div className="absolute top-[7px] text-[10px] font-semibold text-white/90 whitespace-nowrap overflow-hidden text-ellipsis text-right" style={{ left: `${jx - 12}%`, width: '11.5%' }}>
                {names[j] ?? `J${j + 1}`}
              </div>
              {/* queued cars */}
              {Array.from({ length: queues[j] }).map((_, k) => {
                const start = jx - CAR_W - k * CAR_GAP;
                const dep = g === null ? null : g + 0.3 + k * REACT;
                const x = carX(start, dep, t);
                const gone = x > jx + 7;
                const moving = dep !== null && t >= dep;
                return (
                  <div key={k} className="absolute bottom-[36px] transition-opacity duration-300"
                    style={{ left: `${x}%`, width: `${CAR_W}%`, opacity: gone ? 0 : 1 }}>
                    <TopCar color={palette[(j * 2 + k) % palette.length]} className="w-full h-auto"
                      brake={!moving ? (
                        <g>
                          <rect x="0" y="6" width="6" height="10" rx="2" fill="#EF4444" />
                          <rect x="0" y="30" width="6" height="10" rx="2" fill="#EF4444" />
                        </g>
                      ) : undefined} />
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* hospital */}
        <div className="absolute right-0 top-0 bottom-0 w-[4.5%] bg-white/95 border-l-4 border-red-500 flex items-center justify-center">
          <Hospital className="w-5 h-5 text-red-600" />
        </div>

        {/* ambulance */}
        <div className="absolute bottom-[33px] z-10" style={{ left: `${ax}%`, width: `${AMB_W}%` }}>
          <TopAmbulance className="w-full h-auto" />
        </div>
      </div>
    </div>
  );
};

export const CorridorRace: React.FC<{ queues: number[]; names: string[] }> = ({ queues: rawQueues, names }) => {
  const queues = useMemo(() => JX.map((_, j) => Math.max(2, Math.min(4, Math.round((rawQueues[j] ?? 6) / 2)))), [rawQueues]);
  const conv = useMemo(() => simulate('conventional', queues), [queues]);
  const pred = useMemo(() => simulate('predictive', queues), [queues]);
  const end = Math.max(conv.finish, pred.finish) + 0.6;

  const [t, setT] = useState(() => Number(new URLSearchParams(window.location.search).get('previewT')) || 0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * speed;
      last = now;
      setT((prev) => {
        const nt = prev + dt;
        if (nt >= end) {
          setRunning(false);
          return end;
        }
        return nt;
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, speed, end]);

  // restart when the corridor changes
  useEffect(() => {
    setT(Number(new URLSearchParams(window.location.search).get('previewT')) || 0);
    setRunning(false);
  }, [queues]);

  const saved = conv.finish - pred.finish;
  const finished = t >= end - 0.01;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            if (finished) setT(0);
            setRunning((r) => !r);
          }}
          className="inline-flex items-center gap-2 bg-[#5E1B48] hover:bg-[#48133A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          {running ? 'Pause' : finished ? 'Replay' : t > 0 ? 'Resume' : 'Start the run'}
        </motion.button>
        <button
          onClick={() => {
            setRunning(false);
            setT(0);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-[#3F3340] border border-[#E6DCE2] hover:bg-[#F7F0F4] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F7F0F4] text-sm">
          {[1, 1.5, 2.5].map((s) => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${speed === s ? 'bg-white text-[#5E1B48] shadow-sm' : 'text-[#7A6B76]'}`}>
              {s}×
            </button>
          ))}
        </div>
        <div className="ml-auto text-sm text-[#7A6B76]">
          Queues: <span className="font-mono text-[#3F3340]">{queues.join(' · ')}</span> cars
        </div>
      </div>

      <Road mode="conventional" track={conv} queues={queues} t={t} names={names} />
      <Road mode="predictive" track={pred} queues={queues} t={t} names={names} />

      <motion.div
        className="grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
          <div className="text-xs font-semibold text-red-700">Conventional</div>
          <div className="text-2xl font-bold text-red-600 font-mono mt-1">{conv.finish.toFixed(1)}s</div>
        </div>
        <div className="rounded-xl border border-[#EBCADC] bg-[#FBF4F8] p-4">
          <div className="text-xs font-semibold text-[#5E1B48]">QueueFlush AI</div>
          <div className="text-2xl font-bold text-[#5E1B48] font-mono mt-1">{pred.finish.toFixed(1)}s</div>
        </div>
        <div className="rounded-xl bg-[#5E1B48] text-white p-4">
          <div className="text-xs font-semibold text-white/75">Saved in this run</div>
          <div className="text-2xl font-bold font-mono mt-1">−{saved.toFixed(1)}s</div>
        </div>
      </motion.div>
      <p className="text-xs text-[#7A6B76]">
        Animation time is scaled to fit the screen; the per-junction numbers below come from the backend engine.
      </p>
    </div>
  );
};
