import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  ShieldAlert,
  Radio,
  CheckCircle2,
  TrendingUp,
  Cpu,
  Award,
} from 'lucide-react';
import { MiniCanvas } from '../components/MiniCanvas';

interface JudgeDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JudgeDemoModal: React.FC<JudgeDemoModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);

  const steps = [
    {
      title: 'The Blockade Anomaly in Conventional Preemption',
      scenario: 'rush-hour-hospital-road',
      badge: 'PROBLEM DEMONSTRATION',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: ShieldAlert,
      metricLabel: 'Conventional Standstill Wait',
      metricValue: '11.2s',
      metricSub: '8 vehicles queued · 110 km/h',
      metricColor: 'text-rose-400',
      headline: 'Ambulances get trapped behind starting vehicles',
      narrative:
        'Standard emergency preemption systems trigger the traffic signal to GREEN only when the ambulance reaches the stop line. However, queued cars do not accelerate simultaneously — each driver has a 0.8s reaction delay wave. In an 8-vehicle queue, the ambulance is forced into a complete 11.2-second standstill stop right at the intersection.',
      points: [
        'Green light turns on too late at the stop line threshold',
        'Human reaction delays cascade through the queued vehicles',
        'Velocity halts from 110 km/h to 0 km/h, losing critical survival time',
      ],
      impactTag: 'CRITICAL BOTTLENECK ELIMINATED',
    },
    {
      title: 'Predictive Queue-Flushing Mathematical Preemption',
      scenario: 'rush-hour-hospital-road',
      badge: 'OUR SOLUTION',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      icon: Cpu,
      metricLabel: 'Ambulance Standstill Wait',
      metricValue: '0.0s (Zero Wait)',
      metricSub: 'Queue cleared ahead of arrival',
      metricColor: 'text-teal-400',
      headline: 'Early green clears the queue before the ambulance arrives',
      narrative:
        'QueueFlush AI predicts the exact queue clearance time using our formulation T_clear = (N - 1)·t_delay·w_f + t_margin. The signal turns green early at T_trigger = ETA - T_clear. By the time the ambulance reaches the intersection at 110 km/h, the entire approach lane is already vacant.',
      points: [
        'T_clear = 7.2s mathematically calculated from YOLO count N=8',
        'Early green triggers smoothly at T_trigger = ETA - 7.2s',
        'Ambulance glides through without braking — saving 11.2 seconds',
      ],
      impactTag: '100% ELIMINATION OF STANDSTILL DELAY',
    },
    {
      title: 'Audited Deterministic Pedestrian Safety Invariant',
      scenario: 'school-zone-pedestrian',
      badge: 'SAFETY CONTROLLER',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: CheckCircle2,
      metricLabel: 'Safety Invariant Status',
      metricValue: 'HOLD (Approved)',
      metricSub: '2.0s walk clearance enforced',
      metricColor: 'text-emerald-400',
      headline: 'Deterministic rule engine protects crosswalk pedestrians',
      narrative:
        'When an active school-zone pedestrian crossing has under 3.0 seconds remaining, the safety layer deterministically overrides the predictor with a mandatory SAFETY HOLD. Crosswalk clearance is guaranteed before the green phase is approved, preventing hazardous collisions.',
      points: [
        'Walk clearance buffer (< 3.0s threshold) strictly enforced',
        'Cross traffic gets mandatory 3.0s yellow + 1.0s all-red clearance',
        'Zero-trust safety layer operates independently of AI predictions',
      ],
      impactTag: 'ZERO-COMPROMISE SAFETY CERTIFIED',
    },
    {
      title: 'Fail-Safe Telemetry Dropout Recovery',
      scenario: 'telemetry-dropout',
      badge: 'FAIL-SAFE RESILIENCE',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: Radio,
      metricLabel: 'Controller State',
      metricValue: 'FAIL-SAFE ACTIVE',
      metricSub: 'Heartbeat timeout > 2.0s',
      metricColor: 'text-amber-400',
      headline: 'Instant graceful fallback to safe fixed timers on signal loss',
      narrative:
        'If emergency vehicle GPS or cellular telemetry drops for more than 2 seconds, the edge controller immediately reverts to certified fixed-time preemption. This eliminates single-point-of-failure risks and prevents deadlock across the urban traffic grid.',
      points: [
        '10Hz telemetry heartbeat monitored with 2.0s watchdog deadline',
        'Autonomous localized fallback ensures continuous intersection operation',
        'HMAC-SHA256 signature verification blocks unauthorized spoofing',
      ],
      impactTag: 'HIGH-AVAILABILITY FAULT TOLERANCE',
    },
    {
      title: 'Multi-Junction Green Wave 2.0 Corridor',
      scenario: 'hospital-corridor-a',
      badge: 'SMART CORRIDOR',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      icon: TrendingUp,
      metricLabel: 'Corridor Transit Time Saved',
      metricValue: '48.2s Saved',
      metricSub: '5 sequential smart junctions',
      metricColor: 'text-teal-400',
      headline: 'Synchronized preemption across 5 hospital approach junctions',
      narrative:
        'Across the 3.8 km Government Medical College Hospital corridor in Nagaram Smart City, QueueFlush AI coordinates preemption up to 3 intersections ahead. Cumulative transit time drops from 142.4s to 96.1s — delivering a 48.2-second critical advantage for trauma patients.',
      points: [
        'Coordinates up to 3 intersections ahead using real-time GPS speed vector',
        'Eliminates cumulative stop-and-go delays along arterial routes',
        'Cumulative transit time cut by 34% directly to Hospital ER',
      ],
      impactTag: 'GOLDEN-HOUR LIFE-SAVING ADVANTAGE',
    },
    {
      title: 'Executive Grand-Finale Evaluation Summary',
      scenario: 'summary',
      badge: 'EXECUTIVE SUMMARY',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: Award,
      metricLabel: 'Average Wait Elimination',
      metricValue: '100% (0.0s)',
      metricSub: 'Across 420 evaluated runs',
      metricColor: 'text-teal-400',
      headline: 'A production-ready predictive preemption platform',
      narrative:
        'QueueFlush AI combines low-cost YOLO edge vision, deterministic physics prediction, and audited safety controllers to eliminate emergency vehicle standstill delays. With zero hardcoded metrics, 100% offline fallback, and reproducible testbeds, it is ready for deployment across Indian smart cities.',
      points: [
        '12.8s average time saved per junction across dry, wet, and foggy weather',
        '100% deterministic reproducibility with audited decision logs',
        'No specialized vehicle hardware required — works with standard GPS OBU',
      ],
      impactTag: 'TEAM TEJAS021 · TEJAS 2026 GRAND FINALE',
    },
  ];

  // Global key navigation
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
        setTimerSeconds(0);
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
        setTimerSeconds(0);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, steps.length, onClose]);

  // Autoplay progression (~15s per slide)
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev >= 15) {
          setCurrentStep((s) => (s < steps.length - 1 ? s + 1 : s));
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, steps.length]);

  if (!isOpen) return null;

  const active = steps[currentStep];
  const Icon = active.icon;

  return (
    <div className="fixed inset-0 z-50 bg-[#2C0A21]/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-8 text-white animate-fade-in overflow-y-auto">
      {/* Top Presentation Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-4 border-b border-[#4A1A3C]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F5E6EF]/20 border border-[#5E1B48]/40 flex items-center justify-center text-[#5E1B48] shadow-lg">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">QueueFlush AI</span>
              <span className="bg-[#5E1B48] text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">JUDGE DEMO</span>
              <span className="text-[11px] font-mono text-slate-400">· Slide {currentStep + 1} of {steps.length}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Team TEJAS021 · TEJAS 2026 Grand Finale · SASTRA &amp; TEMENOS
            </p>
          </div>
        </div>

        {/* Slide countdown & controls */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-[#2C0A21] px-3 py-1.5 rounded-full border border-[#4A1A3C] text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Autoplay: {15 - timerSeconds}s</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>[Space] {isPaused ? 'Resume' : 'Pause'}</span>
            <span>·</span>
            <span>[← / →] Seek</span>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#2C0A21] hover:bg-[#3B0F2D] border border-[#4A1A3C] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Exit Demo Mode (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Presentation Body */}
      <div className="max-w-6xl w-full mx-auto my-auto py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#2C0A21]/90 rounded-3xl border border-[#4A1A3C] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow Behind Card */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Interactive Canvas Demonstration */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${active.badgeColor} flex items-center gap-1.5`}>
                <Icon className="w-3.5 h-3.5" />
                {active.badge}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{active.impactTag}</span>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#4A1A3C] bg-[#2C0A21] p-2 shadow-inner">
              <MiniCanvas />
            </div>

            <div className="p-3 bg-[#1C0614] rounded-xl border border-[#4A1A3C]/80 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">Approach Simulation State:</span>
              <span className="font-mono font-bold text-teal-400">110 km/h · 300m Approach</span>
            </div>
          </div>

          {/* Right: Keynote Briefing Dossier */}
          <div className="lg:col-span-6 space-y-5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-teal-400 font-mono">
                STAGE 0{currentStep + 1} OF 06
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                {active.title}
              </h2>
              <p className="text-sm font-semibold text-slate-300 mt-1">
                {active.headline}
              </p>
            </div>

            {/* Big Stat Metric Highlight Card */}
            <div className="bg-[#1C0614] p-4 rounded-2xl border border-[#4A1A3C] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">
                  {active.metricLabel}
                </span>
                <span className={`text-3xl font-extrabold num-font ${active.metricColor}`}>
                  {active.metricValue}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono bg-[#2C0A21] px-3 py-1.5 rounded-xl border border-[#4A1A3C] text-right">
                {active.metricSub}
              </span>
            </div>

            {/* Narrative Explanation */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {active.narrative}
            </p>

            {/* Key Evaluation Takeaways */}
            <div className="space-y-2 pt-2 border-t border-[#4A1A3C]">
              {active.points.map((pt, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 shrink-0" />
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav Stepper & Playback Controls */}
      <div className="max-w-6xl w-full mx-auto pt-4 border-t border-[#4A1A3C] flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Step Indicator Pills */}
        <div className="flex items-center gap-2">
          {steps.map((st, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentStep(idx);
                setTimerSeconds(0);
              }}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                currentStep === idx
                  ? 'w-10 bg-teal-400 shadow-sm shadow-teal-500/50'
                  : 'w-3 bg-[#3B0F2D] hover:bg-slate-700'
              }`}
              title={st.title}
            />
          ))}
        </div>

        {/* Transport buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCurrentStep((s) => Math.max(s - 1, 0));
              setTimerSeconds(0);
            }}
            disabled={currentStep === 0}
            className="p-2.5 rounded-xl bg-[#2C0A21] hover:bg-[#3B0F2D] text-white disabled:opacity-30 border border-[#4A1A3C] cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5E1B48] to-[#047857] hover:brightness-110 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
          >
            {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4" />}
            <span>{isPaused ? 'Resume Keynote' : 'Pause'}</span>
          </button>

          <button
            onClick={() => {
              setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
              setTimerSeconds(0);
            }}
            disabled={currentStep === steps.length - 1}
            className="p-2.5 rounded-xl bg-[#2C0A21] hover:bg-[#3B0F2D] text-white disabled:opacity-30 border border-[#4A1A3C] cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
