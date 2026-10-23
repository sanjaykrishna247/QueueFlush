import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniCanvas } from '../components/MiniCanvas';
import { LaneRace } from '../components/LaneRace';
import { Reveal, CountUp, WordReveal, TiltCard, AuroraBackground } from '../components/Motion';
import { getStats, getScenarios, predictMath } from '../api';
import type { StatsResponse, Scenario, WeatherType } from '../types';
import {
  Zap,
  Clock,
  TrendingUp,
  Radio,
  Eye,
  Cpu,
  ShieldCheck,
  TrafficCone,
  ArrowRight,
  Play,
  CheckCircle2,
  Sparkles,
  CloudRain,
  CloudFog,
  Sun,
  Activity,
  Lock,
  Gauge,
} from 'lucide-react';

interface LandingPageProps {
  onOpenJudgeDemo: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const pipelineSteps = [
  {
    title: 'Emergency Node',
    subtitle: 'Vehicle telemetry',
    tech: 'GPS + HMAC-SHA256',
    icon: Radio,
    detail:
      'The ambulance broadcasts authenticated GPS position, speed and heading at 10 Hz. Every packet is HMAC-signed so a spoofed siren can never trigger a signal.',
  },
  {
    title: 'Visual Edge Node',
    subtitle: 'YOLO queue counter',
    tech: 'YOLOv8 edge inference',
    icon: Eye,
    detail:
      'A camera on the junction approach counts queued vehicles in real time — cars, buses, trucks, autos — producing a verified queue length N and vehicle mix.',
  },
  {
    title: 'AI Predictor',
    subtitle: 'Startup reaction engine',
    tech: 'T_clear = (N−1)·t_d·w_f + t_m',
    icon: Cpu,
    detail:
      'Models the human reaction wave of stopped drivers, applies weather drag (dry / wet / fog) and heavy-vehicle penalties (+0.6 s per bus) to compute exact clearance time.',
  },
  {
    title: 'Safety Controller',
    subtitle: 'Deterministic rules',
    tech: 'Pedestrian & fail-safe checks',
    icon: ShieldCheck,
    detail:
      'Protects active pedestrian phases (< 3 s → hold), enforces 3 s yellow + 1 s all-red for cross traffic, and falls back to fixed timers if telemetry drops for 2 s.',
  },
  {
    title: 'Signal Hardware',
    subtitle: 'Adaptive preemption',
    tech: 'NEMA TS2 / 2070 controller',
    icon: TrafficCone,
    detail:
      'Turns green at exactly T_trigger — early enough that the approach lane is empty the moment the ambulance arrives. No braking, no waiting.',
  },
];

const marqueeItems = [
  'Zero-wait junction crossing',
  'Edge YOLO vision',
  'Weather-aware reaction model',
  'HMAC zero-trust telemetry',
  '5-junction green wave',
  'Pedestrian safety hold',
  'Fail-safe fixed timers',
  '100% offline · no paid APIs',
];

const weatherOpts: { key: WeatherType; label: string; icon: typeof Sun }[] = [
  { key: 'dry', label: 'Dry', icon: Sun },
  { key: 'wet', label: 'Wet', icon: CloudRain },
  { key: 'fog', label: 'Fog', icon: CloudFog },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenJudgeDemo }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsResponse>({
    avg_ambulance_wait_eliminated_s: 6.9,
    avg_time_saved_per_junction_s: 7.68,
    best_corridor_gain_s: 41.95,
    total_runs: 210,
  });
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(2);
  const [autoPlay, setAutoPlay] = useState(true);

  // Interactive formula playground
  const [N, setN] = useState(8);
  const [tDelay, setTDelay] = useState(0.8);
  const [weather, setWeather] = useState<WeatherType>('dry');
  const live = predictMath({ N, t_delay: tDelay, t_margin: 1.0, weather, heavy_count: 0, distance_m: 300, speed_kmh: 110, ped_active: false, ped_remaining_s: 0 });
  const blockade = predictMath({ N: 8, t_delay: 0.8, t_margin: 1.0, weather: 'dry', heavy_count: 0, distance_m: 300, speed_kmh: 110, ped_active: false, ped_remaining_s: 0 });
  const heroPrediction = predictMath({ N: 4, t_delay: 0.7, t_margin: 1.0, weather: 'dry', heavy_count: 0, distance_m: 300, speed_kmh: 110, ped_active: false, ped_remaining_s: 0 });

  useEffect(() => {
    getStats().then((data) => {
      if (data && data.total_runs) setStats(data);
    });
    getScenarios().then((data) => {
      if (data && data.length) setScenarios(data);
      setScenariosLoading(false);
    });
  }, []);

  // Auto-advance pipeline until the user clicks a stage
  useEffect(() => {
    if (!autoPlay) return;
    const id = setInterval(() => setActiveStep((s) => (s + 1) % pipelineSteps.length), 3200);
    return () => clearInterval(id);
  }, [autoPlay]);

  const statCards = [
    { label: 'Avg ambulance wait eliminated', value: stats.avg_ambulance_wait_eliminated_s, icon: Zap, sub: 'Standstill time removed per junction, all seeded scenarios' },
    { label: 'Avg time saved per junction', value: stats.avg_time_saved_per_junction_s, icon: Clock, sub: 'Faster crossing, including corridor junctions' },
    { label: 'Best corridor gain', value: stats.best_corridor_gain_s, icon: TrendingUp, sub: '5-junction green wave to the hospital ER' },
  ];

  const maxBar = Math.max(live.t_clear, 1);

  return (
    <div className="bg-white overflow-x-hidden">
      {/* ================= HERO ================= */}
      <section className="relative isolate pt-10 pb-24 md:pt-16 md:pb-32">
        <AuroraBackground />
        <div className="max-w-7xl mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-white border border-[#EDE3E9] shadow-soft text-xs font-semibold text-[#5E1B48]"
            >
              <span className="px-2 py-0.5 rounded-full bg-[#5E1B48] text-white text-[10px] font-bold tracking-wide">TEJAS 2026</span>
              Grand Finale · Team TEJAS021
              <Sparkles className="w-3.5 h-3.5 text-[#F25C8A]" />
            </motion.div>

            <h1 className="mt-6 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#1F0A18]">
              <WordReveal text="Ambulances should" />
              <br />
              <span className="inline-flex flex-wrap">
                <WordReveal text="never" delay={0.25} />
                <motion.span
                  className="inline-block"
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
                >
                  <span className="text-gradient-plum pr-1">wait.</span>
                </motion.span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
              className="mt-6 text-lg text-[#5B4A57] leading-relaxed max-w-xl"
            >
              Traffic lights turn green when the ambulance <em>reaches</em> the junction — but queued drivers
              react one by one, and it gets stuck. <strong className="text-[#1F0A18]">QueueFlush AI</strong> predicts
              exactly how long the queue needs to clear and turns the light green <em>early</em>.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.75, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/simulator"
                  className="btn-shine inline-flex items-center gap-2 bg-[#5E1B48] hover:bg-[#48133A] text-white px-6 py-3.5 rounded-full text-sm font-bold shadow-plum transition-colors"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Launch live simulator
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenJudgeDemo}
                className="inline-flex items-center gap-2 bg-white text-[#5E1B48] border border-[#EBCADC] hover:border-[#5E1B48] px-6 py-3.5 rounded-full text-sm font-bold shadow-soft cursor-pointer transition-colors"
              >
                <Zap className="w-4 h-4" />
                90-second judge demo
                <kbd className="text-[10px] bg-[#F5E6EF] px-1.5 py-0.5 rounded-full font-mono">D</kbd>
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[#5B4A57]"
            >
              {['Deterministic physics engine', 'Zero-trust signed telemetry', 'Runs fully offline'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#5E1B48]" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Hero visual */}
          <motion.div
            className="lg:col-span-5 relative"
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: EASE }}
          >
            <TiltCard className="relative">
              <div className="border-glow rounded-[28px] bg-white p-3 shadow-[0_30px_80px_-20px_rgba(94,27,72,0.35)]">
                <div className="flex items-center justify-between px-2 pb-2.5 pt-1">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F25C8A]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EBCADC]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EBCADC]" />
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#5E1B48] tracking-wider">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-[#F25C8A] animate-pulse-ring" />
                      <span className="relative w-2 h-2 rounded-full bg-[#F25C8A]" />
                    </span>
                    LIVE ENGINE PREVIEW
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden">
                  <MiniCanvas />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#7A6B76] px-2 pt-2.5 font-mono">
                  <span>N = 4 · t<sub>delay</sub> = 0.7s</span>
                  <span className="text-[#5E1B48] font-bold">T<sub>clear</sub> = {heroPrediction.t_clear.toFixed(1)}s</span>
                </div>
              </div>
            </TiltCard>

            {/* floating chips */}
            <div className="hidden sm:block absolute -left-8 top-16 animate-float">
              <div className="glass border border-[#EDE3E9] rounded-2xl px-4 py-3 shadow-soft">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A6B76]">Ambulance wait</div>
                <div className="text-2xl font-extrabold text-emerald-600 num-font">0.0s</div>
              </div>
            </div>
            <div className="hidden sm:block absolute -right-6 -bottom-8 animate-float [animation-delay:-3s]">
              <div className="glass border border-[#EDE3E9] rounded-2xl px-4 py-3 shadow-soft flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#5E1B48] text-white flex items-center justify-center">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A6B76]">Cruise kept</div>
                  <div className="text-lg font-extrabold text-[#1F0A18] num-font">110 km/h</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <section className="relative border-y border-[#EDE3E9] bg-[#FCFAFB] py-4 overflow-hidden">
        <div className="flex w-max animate-marquee">
          {[...marqueeItems, ...marqueeItems].map((t, i) => (
            <span key={i} className="flex items-center gap-3 px-6 text-sm font-semibold text-[#5B4A57] whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F25C8A]" />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {statCards.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className={`group relative h-full rounded-3xl p-7 overflow-hidden shadow-card-hover border ${
                  i === 0 ? 'bg-[#5E1B48] text-white border-[#5E1B48] shadow-plum' : 'bg-white border-[#EDE3E9] shadow-soft'
                }`}>
                  {i === 0 && <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#F25C8A]/30 blur-3xl" />}
                  <div className="relative flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${i === 0 ? 'text-white/70' : 'text-[#7A6B76]'}`}>{s.label}</span>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${
                      i === 0 ? 'bg-white/15 text-white' : 'bg-[#F5E6EF] text-[#5E1B48]'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="relative mt-6 flex items-baseline gap-2">
                    <CountUp value={s.value} className={`text-6xl font-extrabold tracking-tight num-font ${i === 0 ? 'text-white' : 'text-[#5E1B48]'}`} />
                    <span className={`text-xl font-bold ${i === 0 ? 'text-white/70' : 'text-[#7A6B76]'}`}>sec</span>
                  </div>
                  <p className={`relative mt-2 text-sm ${i === 0 ? 'text-white/75' : 'text-[#7A6B76]'}`}>{s.sub}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={0.2}>
          <p className="text-center text-xs text-[#7A6B76] mt-6 font-mono">
            Computed by the physics engine across <CountUp value={stats.total_runs} decimals={0} className="font-bold text-[#5E1B48]" /> logged simulation runs
          </p>
        </Reveal>
      </section>

      {/* ================= PROBLEM vs SOLUTION ================= */}
      <section className="relative bg-[#FCFAFB] border-y border-[#EDE3E9] py-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-60 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
          <Reveal className="lg:col-span-5">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#F25C8A]">The blockade anomaly</span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1F0A18] leading-[1.08]">
              Green at the stop line is <span className="text-[#5E1B48]">already too late.</span>
            </h2>
            <p className="mt-5 text-[#5B4A57] leading-relaxed">
              Stopped cars don't move together. Each driver takes about <strong className="text-[#1F0A18]">0.8 s</strong> to react
              to the car ahead. In an 8-car queue, the last car doesn't even touch the accelerator until
              <strong className="text-[#1F0A18]"> 5.6 s</strong> after green — and the ambulance sits behind it.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-red-100 p-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Conventional</div>
                <div className="text-3xl font-extrabold text-red-600 num-font mt-1">{blockade.t_clear.toFixed(1)}s</div>
                <div className="text-xs text-[#7A6B76]">standstill · 8-car queue</div>
              </div>
              <div className="rounded-2xl bg-[#5E1B48] p-4 text-white shadow-plum">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">QueueFlush AI</div>
                <div className="text-3xl font-extrabold num-font mt-1">0.0s</div>
                <div className="text-xs text-white/70">cruise speed kept</div>
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-7" delay={0.15}>
            <div className="rounded-[28px] bg-white border border-[#EDE3E9] p-6 sm:p-8 shadow-soft">
              <div className="flex items-center justify-between mb-6">
                <span className="flex items-center gap-2 text-sm font-bold text-[#1F0A18]">
                  <Activity className="w-4 h-4 text-[#5E1B48]" />
                  Same junction, same queue — two strategies
                </span>
                <span className="text-[10px] font-mono text-[#7A6B76] bg-[#F7F0F4] px-2 py-1 rounded-full">looping · 10s</span>
              </div>
              <LaneRace />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FORMULA PLAYGROUND ================= */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-24">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#F25C8A]">The engine</span>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1F0A18]">One equation. Zero waiting.</h2>
          <p className="mt-4 text-[#5B4A57]">Drag the sliders — this is the same deterministic math the backend runs.</p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 grid lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="rounded-[28px] bg-white border border-[#EDE3E9] p-7 shadow-soft space-y-7">
              <div>
                <div className="flex justify-between text-sm font-semibold text-[#1F0A18] mb-3">
                  <span>Queue size <span className="font-mono text-[#7A6B76]">N</span></span>
                  <span className="font-mono text-[#5E1B48] font-bold">{N} vehicles</span>
                </div>
                <input type="range" min={1} max={15} value={N} onChange={(e) => setN(+e.target.value)} className="w-full cursor-pointer" />
                <div className="mt-3 flex gap-1 flex-wrap">
                  {Array.from({ length: N }).map((_, i) => (
                    <motion.span
                      key={i}
                      layout
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-3 rounded-sm bg-[#EBCADC]"
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm font-semibold text-[#1F0A18] mb-3">
                  <span>Driver reaction delay <span className="font-mono text-[#7A6B76]">t_delay</span></span>
                  <span className="font-mono text-[#5E1B48] font-bold">{tDelay.toFixed(1)} s</span>
                </div>
                <input type="range" min={0.4} max={1.6} step={0.1} value={tDelay} onChange={(e) => setTDelay(+e.target.value)} className="w-full cursor-pointer" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1F0A18] mb-3">Weather</div>
                <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#F7F0F4]">
                  {weatherOpts.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setWeather(key)}
                      className={`relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors ${
                        weather === key ? 'text-white' : 'text-[#5B4A57] hover:text-[#5E1B48]'
                      }`}
                    >
                      {weather === key && (
                        <motion.span layoutId="weather-pill" className="absolute inset-0 rounded-xl bg-[#5E1B48]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                      )}
                      <Icon className="relative w-4 h-4" />
                      <span className="relative">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Output */}
            <div className="relative rounded-[28px] bg-[#2C0A21] text-white p-7 overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#F25C8A]/25 blur-3xl" />
              <div className="relative font-mono text-sm text-[#E0A6C6]">
                T<sub>clear</sub> = ({N} − 1) × {tDelay.toFixed(1)} × {live.weather_factor.toFixed(2)} + 1.0
              </div>
              <div className="relative mt-4 flex items-baseline gap-2">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={live.t_clear}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-7xl font-extrabold num-font"
                  >
                    {live.t_clear.toFixed(1)}
                  </motion.span>
                </AnimatePresence>
                <span className="text-2xl text-white/60 font-bold">s to clear</span>
              </div>
              <p className="relative mt-2 text-sm text-white/70">
                Ambulance ETA at 300 m / 110 km/h is <span className="font-mono text-white">{live.eta.toFixed(1)} s</span> →
                fire green <span className="font-mono text-[#F25C8A] font-bold">{live.t_clear.toFixed(1)} s early</span>.
              </p>

              <div className="relative mt-8 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/70">Conventional wait</span>
                    <span className="font-mono text-red-300">{live.t_clear.toFixed(1)} s</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400" animate={{ width: `${(live.t_clear / maxBar) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/70">QueueFlush wait</span>
                    <span className="font-mono text-emerald-300">{live.partial_flush ? 'partial flush' : '0.0 s'}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-emerald-400" animate={{ width: live.partial_flush ? '25%' : '2%' }} />
                  </div>
                </div>
              </div>

              <div className={`relative mt-6 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
                live.partial_flush ? 'bg-amber-400/20 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {live.partial_flush ? 'ETA < T_clear → immediate partial flush' : `Safety approved · trigger at T = ${live.t_trigger.toFixed(1)} s`}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= PIPELINE ================= */}
      <section className="relative bg-[#2C0A21] text-white py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[#A8487F]/25 blur-[140px] animate-blob" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
          <Reveal className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#F25C8A]">How it works</span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight">From siren to green in five stages.</h2>
          </Reveal>

          <div className="relative mt-14">
            {/* connecting line */}
            <svg className="hidden md:block absolute top-7 left-0 w-full h-2 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 2">
              <line x1="10" y1="1" x2="90" y2="1" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3" />
              <motion.line
                x1="10" y1="1" x2="90" y2="1" stroke="#F25C8A" strokeWidth="0.35"
                animate={{ pathLength: (activeStep + 0.0001) / (pipelineSteps.length - 1) }}
                transition={{ duration: 0.8, ease: EASE }}
              />
            </svg>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {pipelineSteps.map((step, i) => {
                const Icon = step.icon;
                const active = activeStep === i;
                const done = i <= activeStep;
                return (
                  <button
                    key={step.title}
                    onClick={() => {
                      setActiveStep(i);
                      setAutoPlay(false);
                    }}
                    className="group flex md:flex-col items-center md:text-center gap-4 text-left cursor-pointer"
                  >
                    <motion.div
                      animate={{ scale: active ? 1.12 : 1 }}
                      className={`relative z-10 w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border transition-colors duration-300 ${
                        active
                          ? 'bg-[#F25C8A] border-[#F25C8A] text-white shadow-[0_0_40px_rgba(242,92,138,0.6)]'
                          : done
                          ? 'bg-[#5E1B48] border-[#A8487F] text-white'
                          : 'bg-white/5 border-white/15 text-white/60 group-hover:text-white'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                      {active && <span className="absolute inset-0 rounded-2xl border-2 border-[#F25C8A] animate-pulse-ring" />}
                    </motion.div>
                    <div>
                      <div className="text-[10px] font-mono text-white/50">0{i + 1}</div>
                      <div className={`font-bold text-sm ${active ? 'text-white' : 'text-white/80'}`}>{step.title}</div>
                      <div className="text-xs text-white/50">{step.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 rounded-3xl bg-white/[0.06] border border-white/10 backdrop-blur p-7 min-h-[150px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-col md:flex-row md:items-center gap-6 justify-between"
                >
                  <div className="max-w-3xl">
                    <div className="text-xs font-bold text-[#F25C8A] uppercase tracking-wider">Stage 0{activeStep + 1}</div>
                    <h3 className="text-2xl font-bold mt-1">{pipelineSteps[activeStep].title} — {pipelineSteps[activeStep].subtitle}</h3>
                    <p className="text-white/70 mt-2 leading-relaxed">{pipelineSteps[activeStep].detail}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[#E0A6C6]">
                    {pipelineSteps[activeStep].tech}
                  </span>
                </motion.div>
              </AnimatePresence>
              {autoPlay && (
                <div className="mt-5 h-0.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div key={activeStep} className="h-full bg-[#F25C8A]" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 3.2, ease: 'linear' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= SCENARIOS ================= */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-24">
        <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#F25C8A]">Seeded testbed</span>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[#1F0A18]">Tested on real-world chaos.</h2>
            <p className="mt-3 text-[#5B4A57]">Monsoon evenings, foggy highways, school zones, spoofing attacks — click any to replay it.</p>
          </div>
          <Link to="/simulator" className="group inline-flex items-center gap-1.5 text-sm font-bold text-[#5E1B48]">
            Open custom simulator
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenariosLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-[#EDE3E9] p-6 flex flex-col gap-3">
                  <div className="skeleton h-5 w-28" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-5/6" />
                </div>
              ))
            : scenarios.slice(0, 6).map((sc, i) => (
                <Reveal key={sc.slug} delay={(i % 3) * 0.08}>
                  <button
                    onClick={() => navigate(`/simulator?scenario=${sc.slug}`)}
                    className="group relative w-full h-full text-left rounded-3xl bg-white border border-[#EDE3E9] p-6 shadow-soft shadow-card-hover overflow-hidden cursor-pointer"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#5E1B48] to-[#F25C8A] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold font-mono text-[#5E1B48] bg-[#F5E6EF] px-2.5 py-1 rounded-full">
                        {sc.params.weather.toUpperCase()} · N={sc.params.N}
                      </span>
                      {sc.is_demo && (
                        <span className="text-[10px] font-bold bg-[#F25C8A] text-white px-2 py-0.5 rounded-full uppercase">Demo</span>
                      )}
                    </div>
                    <h3 className="font-bold text-lg text-[#1F0A18] mt-4">{sc.name}</h3>
                    <p className="text-sm text-[#7A6B76] leading-relaxed mt-1.5 line-clamp-2">{sc.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {sc.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] text-[#7A6B76] bg-[#F7F0F4] px-2 py-0.5 rounded-md">#{t}</span>
                      ))}
                    </div>
                    <div className="mt-5 pt-4 border-t border-[#EDE3E9] flex items-center justify-between">
                      <span className="text-xs font-mono text-[#7A6B76]">{sc.params.speed_kmh} km/h · {sc.params.distance_m} m</span>
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#5E1B48]">
                        Simulate
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </button>
                </Reveal>
              ))}
        </div>
      </section>

      {/* ================= TRUST STRIP ================= */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, t: 'Pedestrian protection', d: 'Hold if < 3 s clearance' },
            { icon: Lock, t: 'HMAC-SHA256', d: 'Spoofed sirens rejected' },
            { icon: Activity, t: 'Fail-safe fallback', d: 'Fixed timers on 2 s dropout' },
            { icon: TrafficCone, t: 'Cross-traffic safe', d: '3 s yellow + 1 s all-red' },
          ].map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-[#EDE3E9] p-5 hover:bg-[#FBF4F8] transition-colors">
                <Icon className="w-5 h-5 text-[#5E1B48]" />
                <div className="font-bold text-[#1F0A18] mt-3">{t}</div>
                <div className="text-sm text-[#7A6B76]">{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pb-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#5E1B48] via-[#6E2453] to-[#A8487F] px-8 py-16 sm:px-16 text-white text-center shadow-plum">
            <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#F25C8A]/30 blur-3xl animate-blob" />
            <div className="absolute -bottom-24 -right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-blob [animation-delay:-8s]" />
            <div className="relative">
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Watch the queue flush itself.</h2>
              <p className="mt-4 text-white/80 max-w-xl mx-auto">
                Run the split-screen simulator, then light up a 5-junction green wave all the way to the hospital.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/simulator" className="btn-shine inline-flex items-center gap-2 bg-white text-[#5E1B48] px-7 py-3.5 rounded-full font-bold shadow-xl">
                    <Play className="w-4 h-4 fill-[#5E1B48]" />
                    Launch simulator
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }}>
                  <Link to="/corridor" className="inline-flex items-center gap-2 bg-white/10 border border-white/30 hover:bg-white/20 px-7 py-3.5 rounded-full font-bold transition-colors">
                    Corridor green wave
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};
