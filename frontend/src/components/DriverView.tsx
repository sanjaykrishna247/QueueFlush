import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Pause, Play, RotateCcw, Radio, Hospital, Navigation, Timer, Gauge, ShieldCheck } from 'lucide-react';
import { simulateCorridor } from '../api';
import type { DriverProfile, CorridorSimResult } from '../types';
import { BrandMark } from './Navbar';
import { TopAmbulance } from './Vehicles';

/* Trip model (sim seconds; the clock runs 4× real time) */
const ROUTE_M = 3200;
const J_FRAC = [0.14, 0.32, 0.5, 0.68, 0.85];
const CRUISE = 60 / 3.6; // m/s
const ACC = 2.5;
const DEC = 4.5;
const REACT = 0.8;
const TIME_SCALE = 4;

type JState = 'waiting' | 'clearing' | 'green' | 'passed';

interface Sim {
  pos: number;
  v: number;
  t: number;
  stopped: number;
  greenAt: (number | null)[];
  passed: boolean[];
  done: boolean;
}

const fresh = (): Sim => ({ pos: 0, v: CRUISE, t: 0, stopped: 0, greenAt: [null, null, null, null, null], passed: [false, false, false, false, false], done: false });
const clearTime = (n: number) => 0.3 + (n - 1) * REACT + 1.0;

export const DriverView: React.FC<{ profile: DriverProfile | null; onLogout: () => void }> = ({ profile, onLogout }) => {
  const [corr, setCorr] = useState<CorridorSimResult | null>(null);
  const [armed, setArmed] = useState(true);
  const [running, setRunning] = useState(true);
  const [sim, setSim] = useState<Sim>(fresh);
  const simRef = useRef<Sim>(sim);
  const [log, setLog] = useState<{ id: number; t: number; text: string; tone: 'green' | 'amber' | 'red' | 'plum' }[]>([]);
  const armedRef = useRef(armed);
  armedRef.current = armed;
  const logId = useRef(0);

  useEffect(() => {
    simulateCorridor({ corridor_slug: 'hospital-corridor-a' }).then(setCorr);
  }, []);

  const junctions = (corr?.predictive.junction_metrics ?? []).slice(0, 5);
  const queues = junctions.map((j) => Math.min(9, j.queue_n));
  const convWaits = (corr?.conventional.junction_metrics ?? []).map((j) => j.wait_s);
  const jPos = J_FRAC.map((f) => f * ROUTE_M);

  const push = (t: number, text: string, tone: 'green' | 'amber' | 'red' | 'plum') =>
    setLog((l) => [{ id: ++logId.current, t, text, tone }, ...l].slice(0, 7));

  // physics loop
  useEffect(() => {
    if (!running || queues.length < 5) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * TIME_SCALE;
      last = now;
      const s = simRef.current;
      const n = ((): Sim => {
        if (s.done) return s;
        const n = { ...s, greenAt: [...s.greenAt], passed: [...s.passed] };
        n.t += dt;
        const idx = n.passed.findIndex((p) => !p);
        if (idx === -1) {
          n.v = Math.min(CRUISE, n.v + ACC * dt);
          n.pos = Math.min(ROUTE_M, n.pos + n.v * dt);
          if (n.pos >= ROUTE_M) {
            n.done = true;
            push(n.t, 'Arrived at the hospital', 'plum');
          }
          return n;
        }
        // pre-clear every junction ahead whose queue must start now
        if (armedRef.current) {
          jPos.forEach((jp, k) => {
            if (n.passed[k] || n.greenAt[k] !== null) return;
            const eta = (jp - 40 - n.pos) / CRUISE;
            if (eta <= clearTime(queues[k]) + 2) {
              n.greenAt[k] = n.t;
              push(n.t, `${junctions[k]?.name ?? `J${k + 1}`}: green requested, ${queues[k]} cars moving off`, 'green');
            }
          });
        }
        const jp = jPos[idx];
        const stopLine = jp - 12 - queues[idx] * 7; // tail of the queue
        const g = n.greenAt[idx];
        const free = g !== null && n.t >= g + clearTime(queues[idx]);
        const gap = stopLine - n.pos;
        if (!free && gap < 60) {
          // brake to the queue tail
          n.v = Math.max(0, n.v - DEC * dt);
          if (gap <= 1 || n.v === 0) {
            n.v = 0;
            n.stopped += dt;
            if (n.greenAt[idx] === null) {
              n.greenAt[idx] = n.t; // conventional: green on arrival
              push(n.t, `Stopped behind ${queues[idx]} cars at ${junctions[idx]?.name ?? 'junction'} — waiting for green`, 'red');
            }
          }
        } else {
          n.v = Math.min(CRUISE, n.v + ACC * dt);
        }
        n.pos += n.v * dt;
        if (n.pos > jp + 5) {
          n.passed[idx] = true;
          push(n.t, `Passed ${junctions[idx]?.name ?? 'junction'}${n.v > 10 ? ' at full speed' : ''}`, n.v > 10 ? 'plum' : 'amber');
        }
        return n;
      })();
      if (n !== s) {
        simRef.current = n;
        setSim(n);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, queues.join(',')]);

  const restart = () => {
    simRef.current = fresh();
    setSim(simRef.current);
    setLog([]);
    setRunning(true);
  };

  const nextIdx = sim.passed.findIndex((p) => !p);
  const next = nextIdx >= 0 ? junctions[nextIdx] : null;
  const distNext = nextIdx >= 0 ? Math.max(0, jPos[nextIdx] - sim.pos) : 0;
  const jState = (k: number): JState => {
    if (sim.passed[k]) return 'passed';
    const g = sim.greenAt[k];
    if (g === null) return 'waiting';
    return sim.t >= g + clearTime(queues[k]) ? 'green' : 'clearing';
  };
  const carsLeft = (k: number) => {
    const g = sim.greenAt[k];
    if (g === null) return queues[k];
    return Math.max(0, queues[k] - Math.floor((sim.t - g - 0.3) / REACT + 1));
  };
  const remaining = ROUTE_M - sim.pos;
  const eta = remaining / CRUISE;
  const saved = convWaits.slice(0, sim.passed.filter(Boolean).length).reduce((a, b) => a + b, 0) - sim.stopped;
  const kmh = Math.round(sim.v * 3.6);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const st = nextIdx >= 0 ? jState(nextIdx) : 'passed';

  return (
    <div className="min-h-[calc(100vh-76px)] bg-[#140510] text-white">
      {/* top bar */}
      <div className="border-b border-white/10 bg-[#1C0817]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-4">
          <BrandMark className="w-8 h-8" onDark animated={false} />
          <div className="leading-tight">
            <div className="font-semibold">{profile?.pilot_name ?? 'Driver'}</div>
            <div className="text-sm text-white/55">{profile?.vehicle_id} · {profile?.reg_no}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setArmed((a) => !a)}
              className={`flex items-center gap-2 pl-3 pr-1 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors ${armed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/70'}`}
            >
              <Radio className="w-4 h-4" />
              Signal priority
              <span className={`relative w-10 h-6 rounded-full transition-colors ${armed ? 'bg-emerald-500' : 'bg-white/20'}`}>
                <motion.span layout className="absolute top-1 w-4 h-4 rounded-full bg-white" style={{ left: armed ? 20 : 4 }} />
              </span>
            </button>
            <button onClick={onLogout} className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 cursor-pointer" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* mission */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-white/60 text-sm"><Navigation className="w-4 h-4" /> Hospital Corridor A</div>
          <div className="flex items-center gap-2 text-lg font-semibold"><Hospital className="w-5 h-5 text-red-400" /> {profile?.assigned_hospital ?? 'Government Medical College Hospital'}</div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setRunning((r) => !r)} disabled={sim.done} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-40">
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{running ? 'Pause' : 'Resume'}
            </button>
            <button onClick={restart} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer">
              <RotateCcw className="w-4 h-4" /> Restart trip
            </button>
          </div>
        </div>

        {/* main cards */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* next signal */}
          <div className="lg:col-span-2 rounded-2xl bg-white/[0.04] border border-white/10 p-6 flex gap-6 items-center">
            <div className="flex flex-col gap-2 p-2.5 rounded-2xl bg-black/60 border border-white/10 shrink-0">
              {(['red', 'amber', 'green'] as const).map((c) => {
                const on = sim.done ? false : c === 'green' ? st === 'green' : c === 'amber' ? st === 'clearing' : st === 'waiting';
                const col = c === 'red' ? '#EF4444' : c === 'amber' ? '#F59E0B' : '#22C55E';
                return (
                  <motion.span key={c} className="w-9 h-9 rounded-full"
                    animate={{ backgroundColor: on ? col : '#1f1a1d', boxShadow: on ? `0 0 24px ${col}` : '0 0 0 transparent' }} transition={{ duration: 0.25 }} />
                );
              })}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/55">{sim.done ? 'Trip complete' : 'Next signal'}</div>
              <div className="text-2xl font-semibold truncate">{sim.done ? 'You have arrived' : next?.name ?? 'Loading route…'}</div>
              {!sim.done && next && (
                <>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-6xl font-semibold tabular-nums tracking-tight">{distNext >= 1000 ? (distNext / 1000).toFixed(1) : Math.round(distNext)}</span>
                    <span className="text-xl text-white/55">{distNext >= 1000 ? 'km' : 'm'}</span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={st} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`mt-2 text-base font-medium ${st === 'green' ? 'text-emerald-300' : st === 'clearing' ? 'text-amber-300' : 'text-red-300'}`}>
                      {st === 'green' && 'Green and clear — keep your speed'}
                      {st === 'clearing' && `Turning green early · ${carsLeft(nextIdx)} cars still moving off`}
                      {st === 'waiting' && (armed ? 'Red · green will be requested ahead of you' : 'Red · signal priority is off')}
                    </motion.div>
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-5">
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <div className="flex items-center justify-between text-sm text-white/55"><span>Speed</span><Gauge className="w-4 h-4" /></div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-4xl font-semibold tabular-nums ${kmh < 5 && !sim.done ? 'text-red-300' : ''}`}>{kmh}</span>
                <span className="text-white/55">km/h</span>
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
              <div className="flex items-center justify-between text-sm text-white/55"><span>Arrival</span><Timer className="w-4 h-4" /></div>
              <div className="mt-1 text-4xl font-semibold tabular-nums">{sim.done ? 'Now' : fmt(eta)}</div>
              <div className="text-sm text-white/55">{(remaining / 1000).toFixed(2)} km to go</div>
            </div>
          </div>
        </div>

        {/* route strip */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-6">
          <div className="flex items-center justify-between text-sm mb-6">
            <span className="text-white/55">Route</span>
            <span className="text-white/55">
              Stopped <span className={`font-medium ${sim.stopped > 0.5 ? 'text-red-300' : 'text-white'}`}>{sim.stopped.toFixed(1)}s</span>
              <span className="mx-2">·</span>
              Saved vs normal signals <span className="font-medium text-emerald-300">{Math.max(0, saved).toFixed(1)}s</span>
            </span>
          </div>
          <div className="relative h-16">
            <div className="absolute left-0 right-0 top-7 h-1.5 rounded-full bg-white/10" />
            <motion.div className="absolute left-0 top-7 h-1.5 rounded-full bg-gradient-to-r from-[#A8487F] to-[#F25C8A]" style={{ width: `${(sim.pos / ROUTE_M) * 100}%` }} />
            {J_FRAC.map((f, k) => {
              const s = jState(k);
              const col = s === 'passed' ? '#A8487F' : s === 'green' ? '#22C55E' : s === 'clearing' ? '#F59E0B' : '#EF4444';
              return (
                <div key={k} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${f * 100}%`, top: 0 }}>
                  <span className="text-[11px] text-white/45 mb-1 whitespace-nowrap">{queues[k] !== undefined && s !== 'passed' ? `${carsLeft(k)} cars` : ' '}</span>
                  <motion.span className="w-4 h-4 rounded-full border-2 border-[#140510]" animate={{ backgroundColor: col, boxShadow: s === 'green' ? '0 0 12px #22C55E' : '0 0 0 transparent' }} />
                  <span className="text-[11px] text-white/60 mt-2 whitespace-nowrap max-w-[90px] truncate">{junctions[k]?.name.split(/ [×x] /)[0] ?? `J${k + 1}`}</span>
                </div>
              );
            })}
            <div className="absolute right-0 top-4 translate-x-1/2"><Hospital className="w-6 h-6 text-red-400" /></div>
            <div className="absolute top-[18px] -translate-x-1/2 w-10" style={{ left: `${(sim.pos / ROUTE_M) * 100}%` }}>
              <TopAmbulance className="w-full h-auto" />
            </div>
          </div>
        </div>

        {/* event feed */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2 text-sm text-white/55">
            <ShieldCheck className="w-4 h-4" /> Signal messages
          </div>
          <ul className="divide-y divide-white/5 min-h-[120px]">
            <AnimatePresence initial={false}>
              {log.map((e) => (
                <motion.li key={e.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className={`w-2 h-2 rounded-full ${e.tone === 'green' ? 'bg-emerald-400' : e.tone === 'amber' ? 'bg-amber-400' : e.tone === 'red' ? 'bg-red-400' : 'bg-[#F25C8A]'}`} />
                  <span className="text-white/85 flex-1">{e.text}</span>
                  <span className="text-white/35 tabular-nums text-xs">{fmt(e.t)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {log.length === 0 && <li className="px-5 py-8 text-center text-sm text-white/40">Waiting for the first signal…</li>}
          </ul>
        </div>
        <p className="text-xs text-white/35">Trip clock runs at 4× speed for the demo. Turn signal priority off and restart to compare with normal signals.</p>
      </div>
    </div>
  );
};
