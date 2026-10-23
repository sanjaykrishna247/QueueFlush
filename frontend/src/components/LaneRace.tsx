import React from 'react';
import { motion, type Easing } from 'framer-motion';
import { TopCar, TopAmbulance, BrakeGlow } from './Vehicles';

/**
 * Looping top-down view of one junction approach.
 * Conventional: green fires when the ambulance reaches the queue → it brakes and waits.
 * Predictive:   green fires early → the queue drains before the ambulance arrives.
 * Horizontal positions are % of road width. Timeline is D seconds, repeating.
 */
const D = 10;
const CARS = 5;
const STOP_LINE = 60; // front bumper of first car (in %)
const CAR_W = 6;
const GAP = 7.4;
const DRIVE = 2.1; // seconds for a car to accelerate out of frame
const REACTION = 0.5; // seconds between successive drivers starting

const queue = [
  { color: '#64748B', kind: 'car' as const },
  { color: '#E2E8F0', kind: 'suv' as const },
  { color: '#0F766E', kind: 'car' as const },
  { color: '#B91C1C', kind: 'car' as const },
  { color: '#1E3A8A', kind: 'suv' as const },
];

const Signal: React.FC<{ greenAt: number }> = ({ greenAt }) => {
  const t = [0, greenAt / D, greenAt / D + 0.002, 0.96, 1];
  return (
    <div className="absolute -top-1 z-20 flex items-start gap-1" style={{ left: `calc(${STOP_LINE + CAR_W}% + 14px)` }}>
      <div className="w-[3px] h-6 bg-slate-500 mt-6" />
      <div className="flex flex-col gap-[3px] p-[3px] rounded-[5px] bg-[#111] shadow-lg border border-black">
        <motion.span className="w-2.5 h-2.5 rounded-full"
          animate={{ backgroundColor: ['#EF4444', '#EF4444', '#3A1515', '#3A1515', '#EF4444'], boxShadow: ['0 0 8px #EF4444', '0 0 8px #EF4444', '0 0 0 transparent', '0 0 0 transparent', '0 0 8px #EF4444'] }}
          transition={{ duration: D, times: t, repeat: Infinity }} />
        <span className="w-2.5 h-2.5 rounded-full bg-[#3A2E10]" />
        <motion.span className="w-2.5 h-2.5 rounded-full"
          animate={{ backgroundColor: ['#11291A', '#11291A', '#22C55E', '#22C55E', '#11291A'], boxShadow: ['0 0 0 transparent', '0 0 0 transparent', '0 0 10px #22C55E', '0 0 10px #22C55E', '0 0 0 transparent'] }}
          transition={{ duration: D, times: t, repeat: Infinity }} />
      </div>
    </div>
  );
};

const Lane: React.FC<{ mode: 'conventional' | 'predictive' }> = ({ mode }) => {
  const conv = mode === 'conventional';
  const greenAt = conv ? 3.0 : 0.3;
  const ambArrive = 2.8;
  const lastDepart = greenAt + 0.3 + (CARS - 1) * REACTION;
  const backOfQueue = STOP_LINE - (CARS - 1) * GAP; // left edge of last car

  const ambLeft = conv ? [-16, backOfQueue - 9.2, backOfQueue - 9.2, 118, 118] : [-30, 118, 118];
  const ambTimes = conv
    ? [0, ambArrive / D, (lastDepart + 0.5) / D, (lastDepart + 4) / D, 1]
    : [0, 8.6 / D, 1];
  const ambEase: Easing[] = conv ? ['easeOut', 'linear', 'easeIn', 'linear'] : ['linear', 'linear'];

  return (
    <div className="relative h-[124px] rounded-2xl overflow-hidden border border-black/20 shadow-inner"
      style={{ background: 'linear-gradient(#5b8a4a,#4f7a41)' }}>
      {/* road surface */}
      <div className="absolute inset-x-0 top-[14px] bottom-[14px]"
        style={{ background: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px) 0 0/6px 6px, linear-gradient(#3d3d42,#36363b)' }} />
      {/* kerbs */}
      <div className="absolute inset-x-0 top-[11px] h-[4px] bg-[repeating-linear-gradient(90deg,#e5e5e5_0_14px,#9ca3af_14px_28px)]" />
      <div className="absolute inset-x-0 bottom-[11px] h-[4px] bg-[repeating-linear-gradient(90deg,#e5e5e5_0_14px,#9ca3af_14px_28px)]" />
      {/* cross street */}
      <div className="absolute top-0 bottom-0" style={{ left: `${STOP_LINE + CAR_W + 5.5}%`, width: '10%', background: 'linear-gradient(90deg,#38383d,#3d3d42)' }} />
      {/* centre line */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 h-[2px] bg-[repeating-linear-gradient(90deg,#facc15_0_22px,transparent_22px_38px)]" style={{ width: `${STOP_LINE + CAR_W + 5.5}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 h-[2px] right-0 bg-[repeating-linear-gradient(90deg,#facc15_0_22px,transparent_22px_38px)]" style={{ left: `${STOP_LINE + CAR_W + 15.5}%` }} />
      {/* stop line + zebra crossing */}
      <div className="absolute top-1/2 bottom-[14px] w-[3px] bg-white/90" style={{ left: `${STOP_LINE + CAR_W + 0.6}%` }} />
      <div className="absolute top-[14px] bottom-[14px] w-[3.4%] bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.85)_0_6px,transparent_6px_12px)]" style={{ left: `${STOP_LINE + CAR_W + 1.6}%` }} />

      {/* oncoming traffic (top lane, right → left) */}
      {[0, 1].map((k) => (
        <motion.div key={k} className="absolute top-[22px] z-10" style={{ width: `${CAR_W}%`, scaleX: -1 }}
          animate={{ left: ['112%', '-12%'] }}
          transition={{ duration: 4.2, delay: k * 2.4, repeat: Infinity, ease: 'linear' }}>
          <TopCar color={k ? '#CA8A04' : '#475569'} className="w-full h-auto" />
        </motion.div>
      ))}

      <Signal greenAt={greenAt} />

      {/* queued cars, index 0 at the front */}
      {queue.map((car, i) => {
        const start = STOP_LINE - i * GAP;
        const dep = greenAt + 0.3 + i * REACTION;
        const T = (s: number) => Math.min(1, Math.max(0, s / D));
        return (
          <motion.div key={i} className="absolute bottom-[22px] z-10" style={{ width: `${CAR_W}%` }}
            animate={{ left: [`${start}%`, `${start}%`, '122%', '122%'], opacity: [0, 1, 1, 1] }}
            transition={{
              duration: D,
              times: [0, T(dep), T(dep + DRIVE), 1],
              ease: ['linear', [0.55, 0, 0.9, 0.6], 'linear'],
              repeat: Infinity,
              opacity: { duration: D, times: [0, 0.03, 0.99, 1], repeat: Infinity },
            }}>
            <TopCar color={car.color} kind={car.kind} className="w-full h-auto"
              brake={<BrakeGlow duration={D} opacity={[1, 1, 0, 0]} times={[0, T(dep - 0.1), T(dep), 1]} />} />
            {/* driver reaction ripple */}
            <motion.span className="absolute inset-[-4px] rounded-lg border-2 border-amber-300"
              animate={{ opacity: [0, 0, 1, 0, 0], scale: [0.9, 0.9, 1, 1.35, 1.35] }}
              transition={{ duration: D, times: [0, T(dep - 0.25), T(dep - 0.05), T(dep + 0.5), 1], repeat: Infinity }} />
          </motion.div>
        );
      })}

      {/* ambulance */}
      <motion.div className="absolute bottom-[18px] z-[15]" style={{ width: '8.4%' }}
        animate={{ left: ambLeft.map((v) => `${v}%`) }}
        transition={{ duration: D, times: ambTimes, ease: ambEase, repeat: Infinity }}>
        <TopAmbulance className="w-full h-auto" />
      </motion.div>

      {/* status bubbles */}
      {conv ? (
        <motion.div className="absolute top-[18px] z-30 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold shadow-lg"
          style={{ left: `${backOfQueue - 14}%` }}
          animate={{ opacity: [0, 0, 1, 1, 0, 0], y: [6, 6, 0, 0, -6, -6] }}
          transition={{ duration: D, times: [0, ambArrive / D, (ambArrive + 0.25) / D, (lastDepart + 0.5) / D, (lastDepart + 0.8) / D, 1], repeat: Infinity }}>
          Ambulance stopped behind queue
        </motion.div>
      ) : (
        <motion.div className="absolute top-[18px] z-30 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-semibold shadow-lg"
          style={{ left: '34%' }}
          animate={{ opacity: [0, 0, 1, 1, 0], y: [6, 6, 0, 0, -6] }}
          transition={{ duration: D, times: [0, 3 / D, 3.3 / D, 7.5 / D, 8 / D], repeat: Infinity }}>
          Lane already clear — no braking
        </motion.div>
      )}
    </div>
  );
};

export const LaneRace: React.FC = () => (
  <div className="grid gap-5">
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-red-600">Conventional preemption</span>
        <span className="text-xs text-[#7A6B76]">green when the ambulance arrives</span>
      </div>
      <Lane mode="conventional" />
    </div>
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-[#5E1B48]">QueueFlush AI</span>
        <span className="text-xs text-[#7A6B76]">green at ETA − T<sub>clear</sub></span>
      </div>
      <Lane mode="predictive" />
    </div>
  </div>
);
