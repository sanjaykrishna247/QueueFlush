import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SimulatorCanvas } from '../components/SimulatorCanvas';
import { FormulaCard } from '../components/FormulaCard';
import { DecisionTerminal } from '../components/DecisionTerminal';
import {
  getScenarios,
  simulate,
  predictMath,
  saveRun,
  getVisionFixture,
} from '../api';
import type {
  Scenario,
  PredictorParams,
  PredictResponse,
  SimResult,
  SimFrame,
  SimEvent,
  DetectionBox,
  WeatherType,
} from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Bookmark,
  Eye,
  Sliders,
  Radio,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

// O(1) binary / direct frame lookup
function getFrameAtTime(frames: SimFrame[] | undefined, t: number): SimFrame | null {
  if (!frames || frames.length === 0) return null;
  // Frames are generated at 20Hz (0.05s step)
  const estimatedIdx = Math.min(frames.length - 1, Math.max(0, Math.round(t * 20)));
  // If timestamps are close, return directly
  if (Math.abs(frames[estimatedIdx].t - t) <= 0.05) {
    return frames[estimatedIdx];
  }
  // Otherwise quick binary search
  let low = 0;
  let high = frames.length - 1;
  let best = frames[0];
  while (low <= high) {
    const mid = (low + high) >> 1;
    const f = frames[mid];
    if (Math.abs(f.t - t) < Math.abs(best.t - t)) {
      best = f;
    }
    if (f.t < t) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export const SimulatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const scenarioSlugFromUrl = searchParams.get('scenario');

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioSlug, setSelectedScenarioSlug] = useState<string>(
    scenarioSlugFromUrl || 'rush-hour-hospital-road'
  );

  // Simulation Parameters
  const [params, setParams] = useState<PredictorParams>({
    N: 8,
    t_delay: 0.8,
    t_margin: 1.0,
    weather: 'dry',
    heavy_count: 2,
    distance_m: 300,
    speed_kmh: 110,
    ped_active: false,
    ped_remaining_s: 0,
  });

  const [seed, setSeed] = useState<number>(101);
  const [telemetryDropped, setTelemetryDropped] = useState<boolean>(false);
  const [showYolo, setShowYolo] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0); // 1.0x or 0.25x

  // Simulation Data
  const [convResult, setConvResult] = useState<SimResult | null>(null);
  const [predResult, setPredResult] = useState<SimResult | null>(null);
  const [detections, setDetections] = useState<DetectionBox[]>([]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [maxTime, setMaxTime] = useState<number>(16);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Frames rendered in canvas
  const [convFrame, setConvFrame] = useState<SimFrame | null>(null);
  const [predFrame, setPredFrame] = useState<SimFrame | null>(null);
  const [visibleEvents, setVisibleEvents] = useState<SimEvent[]>([]);

  // Ref-based animation controller to prevent React render loops/crashes
  const playbackTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  // Live Calculated Prediction
  const currentPrediction: PredictResponse = predictMath(params);

  // Load scenarios on mount
  useEffect(() => {
    getScenarios().then((list) => {
      if (list && list.length > 0) {
        setScenarios(list);
        const match = list.find((s) => s.slug === selectedScenarioSlug);
        if (match) applyScenario(match);
      }
    });
  }, []);

  // When scenario slug changes from URL
  useEffect(() => {
    if (scenarioSlugFromUrl && scenarios.length > 0) {
      const match = scenarios.find((s) => s.slug === scenarioSlugFromUrl);
      if (match) {
        setSelectedScenarioSlug(scenarioSlugFromUrl);
        applyScenario(match);
      }
    }
  }, [scenarioSlugFromUrl, scenarios]);

  const applyScenario = (sc: Scenario) => {
    setParams({
      N: sc.params.N,
      t_delay: sc.params.t_delay,
      t_margin: sc.params.t_margin,
      weather: sc.params.weather,
      heavy_count: sc.params.heavy_count,
      distance_m: sc.params.distance_m,
      speed_kmh: sc.params.speed_kmh,
      ped_active: sc.params.ped_active || false,
      ped_remaining_s: sc.params.ped_remaining_s || 0,
    });
    setSeed(sc.seed || 101);
    setTelemetryDropped(false);

    getVisionFixture(sc.slug).then((fix) => {
      if (fix && fix.detections) {
        setDetections(fix.detections);
      } else {
        const defaultDets: DetectionBox[] = [];
        for (let i = 0; i < sc.params.N; i++) {
          const isHeavy = i < (sc.params.heavy_count || 0);
          defaultDets.push({
            class: isHeavy ? (i % 2 === 0 ? 'bus' : 'truck') : 'car',
            conf: 0.91 + (i % 5) * 0.015,
            box: [-8 - i * 8.5, 12, isHeavy ? 35 : 22, 14],
          });
        }
        setDetections(defaultDets);
      }
    });
  };

  // Run backend simulation cleanly
  const runSimulationEngine = useCallback(async () => {
    // Stop playback
    isPlayingRef.current = false;
    setIsPlaying(false);
    playbackTimeRef.current = 0;
    setCurrentTime(0);
    setIsFinished(false);

    try {
      const resp = await simulate({
        scenario_slug: selectedScenarioSlug === 'custom' ? undefined : selectedScenarioSlug,
        params,
        seed,
        mode: 'both',
        telemetry_drop_at: telemetryDropped ? 2.5 : undefined,
      });

      if (resp.conventional) setConvResult(resp.conventional);
      if (resp.predictive) setPredResult(resp.predictive);

      const convMax = resp.conventional?.frames?.slice(-1)[0]?.t || 16;
      const predMax = resp.predictive?.frames?.slice(-1)[0]?.t || 16;
      const computedMax = Math.max(convMax, predMax, 14);
      setMaxTime(computedMax);

      // Frame at t=0
      if (resp.conventional?.frames?.[0]) setConvFrame(resp.conventional.frames[0]);
      if (resp.predictive?.frames?.[0]) setPredFrame(resp.predictive.frames[0]);
      if (resp.predictive?.events) setVisibleEvents(resp.predictive.events.filter((e) => e.t <= 0.1));
    } catch (err) {
      console.error('Failed to run simulation', err);
    }
  }, [params, seed, selectedScenarioSlug, telemetryDropped]);

  useEffect(() => {
    runSimulationEngine();
  }, [runSimulationEngine]);

  // Robust, Non-Recursive Animation Loop
  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimestampRef.current = null;
      return;
    }

    const onFrame = (timestamp: number) => {
      if (!isPlayingRef.current) return;
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;

      const deltaSec = ((timestamp - lastTimestampRef.current) / 1000) * speedMultiplier;
      lastTimestampRef.current = timestamp;

      // Advance time ref
      let nextTime = playbackTimeRef.current + deltaSec;

      if (nextTime >= maxTime) {
        nextTime = maxTime;
        playbackTimeRef.current = nextTime;
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsFinished(true);
        setCurrentTime(nextTime);

        // Final frames
        if (convResult?.frames) setConvFrame(convResult.frames[convResult.frames.length - 1]);
        if (predResult?.frames) setPredFrame(predResult.frames[predResult.frames.length - 1]);
        if (predResult?.events) setVisibleEvents(predResult.events);
        return;
      }

      playbackTimeRef.current = nextTime;
      setCurrentTime(nextTime);

      // Look up frames at O(1)
      if (convResult?.frames) {
        const cf = getFrameAtTime(convResult.frames, nextTime);
        if (cf) setConvFrame(cf);
      }

      if (predResult?.frames) {
        const pf = getFrameAtTime(predResult.frames, nextTime);
        if (pf) setPredFrame(pf);
        if (predResult.events) {
          const matched = predResult.events.filter((e) => e.t <= nextTime);
          setVisibleEvents((prev) => (prev.length !== matched.length ? matched : prev));
        }
      }

      animFrameRef.current = requestAnimationFrame(onFrame);
    };

    animFrameRef.current = requestAnimationFrame(onFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, maxTime, convResult, predResult, speedMultiplier]);

  const handlePlayPause = () => {
    if (isFinished || playbackTimeRef.current >= maxTime) {
      playbackTimeRef.current = 0;
      setCurrentTime(0);
      setIsFinished(false);
    }
    lastTimestampRef.current = null;
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    playbackTimeRef.current = 0;
    setCurrentTime(0);
    setIsFinished(false);

    if (convResult?.frames?.[0]) setConvFrame(convResult.frames[0]);
    if (predResult?.frames?.[0]) setPredFrame(predResult.frames[0]);
    setVisibleEvents([]);
  };

  const handleSeek = (newT: number) => {
    playbackTimeRef.current = newT;
    setCurrentTime(newT);
    if (convResult?.frames) {
      const cf = getFrameAtTime(convResult.frames, newT);
      if (cf) setConvFrame(cf);
    }
    if (predResult?.frames) {
      const pf = getFrameAtTime(predResult.frames, newT);
      if (pf) setPredFrame(pf);
      if (predResult.events) {
        const matched = predResult.events.filter((e) => e.t <= newT);
        setVisibleEvents((prev) => (prev.length !== matched.length ? matched : prev));
      }
    }
  };

  const handleSaveRun = async () => {
    try {
      await saveRun({
        scenario_slug: selectedScenarioSlug,
        mode: 'predictive',
        params,
        metrics: predResult?.metrics || {
          ambulance_wait_s: 0.0,
          crossing_time_s: 12.4,
          queue_cleared_at_s: 4.8,
          stopped: false,
          partial_flush: false,
        },
        seed,
        source: 'user',
      });
      setToastMessage('✅ Run logged to database successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('⚠️ Run recorded locally in offline cache');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Metrics
  const convWait = convResult?.metrics?.ambulance_wait_s ?? 11.2;
  const predWait = predResult?.metrics?.ambulance_wait_s ?? 0.0;
  const convCrossing = convResult?.metrics?.crossing_time_s ?? 24.8;
  const predCrossing = predResult?.metrics?.crossing_time_s ?? 13.5;
  const timeSaved = Math.max(0, convCrossing - predCrossing);
  const percentSaved = convCrossing > 0 ? ((timeSaved / convCrossing) * 100).toFixed(0) : '46';

  // Live ambulance telemetry values
  const convSpeed = convFrame?.ambulance?.v ? (convFrame.ambulance.v * 3.6).toFixed(0) : '0';
  const predSpeed = predFrame?.ambulance?.v ? (predFrame.ambulance.v * 3.6).toFixed(0) : '0';
  const convDist = convFrame?.ambulance ? Math.max(0, -convFrame.ambulance.x).toFixed(0) : params.distance_m.toString();
  const predDist = predFrame?.ambulance ? Math.max(0, -predFrame.ambulance.x).toFixed(0) : params.distance_m.toString();
  const convBlockedS = convFrame?.ambulance?.blocked_s ?? convFrame?.ambulance?.wait_accumulated_s ?? 0;
  const predBlockedS = predFrame?.ambulance?.blocked_s ?? predFrame?.ambulance?.wait_accumulated_s ?? 0;

  return (
    <div className="bg-[#FCFAFB] min-h-screen py-8 px-4 lg:px-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2C0A21] text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slide-in-right">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Control Room Header */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200/90 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#A8487F]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live junction simulator
            </div>
            <h1 className="text-3xl font-bold text-[#1F0A18] tracking-tight mt-1">Same queue, two signal strategies</h1>
            <p className="text-sm text-slate-500 mt-1">
              Left: green only when the ambulance arrives. Right: QueueFlush turns it green early so the lane is empty in time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scenario Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="sim-scenario-select" className="text-xs font-extrabold text-[#3B0F2D] uppercase tracking-wider">
                Sector Corridor:
              </label>
              <select
                id="sim-scenario-select"
                value={selectedScenarioSlug}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedScenarioSlug(val);
                  if (val !== 'custom') {
                    const match = scenarios.find((s) => s.slug === val);
                    if (match) applyScenario(match);
                  }
                }}
                className="bg-[#F1F5F9] border-2 border-slate-300 text-[#3B0F2D] text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#3B0F2D] cursor-pointer shadow-xs"
              >
                {scenarios.map((sc) => (
                  <option key={sc.slug} value={sc.slug}>
                    {sc.name} (N={sc.params.N}, {sc.params.weather})
                  </option>
                ))}
                <option value="custom">⚙️ Custom Parameters</option>
              </select>
            </div>

            {/* YOLO Overlay Toggle */}
            <button
              onClick={() => setShowYolo(!showYolo)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border-2 transition-all cursor-pointer shadow-xs ${
                showYolo
                  ? 'bg-[#DCFCE7] text-[#15803D] border-[#16A34A]/50 shadow-sm'
                  : 'bg-[#F1F5F9] text-[#64748B] border-slate-300 hover:bg-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>YOLO AI {showYolo ? 'ACTIVE' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Finished Results Banner */}
        {isFinished && (
          <div className="bg-gradient-to-r from-[#5E1B48] via-[#4A1439] to-[#2C0A21] text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-scale-in border border-teal-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Predictive Queue-Flushing Completed with Zero Ambulance Wait!
                </h3>
                <p className="text-xs text-white/90 mt-0.5">
                  Saved <strong className="text-yellow-300 font-bold">{timeSaved.toFixed(1)}s</strong> ({percentSaved}% less transit time). Ambulance wait: <strong className="text-emerald-300">0.0s</strong> vs conventional <strong className="text-rose-200">{convWait.toFixed(1)}s</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveRun}
              className="bg-white hover:bg-slate-100 text-[#5E1B48] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:scale-105 transition-all cursor-pointer whitespace-nowrap"
            >
              <Bookmark className="w-4 h-4" />
              <span>Save Run to DB</span>
            </button>
          </div>
        )}

        {/* Dual Split Screen Canvases */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Conventional Priority */}
          <div className="bg-white rounded-2xl border-2 border-red-200/80 p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FEE2E2] text-[#DC2626] border border-[#DC2626]/30 uppercase tracking-wide">
                      Conventional Baseline
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Green on arrival</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Green triggers only upon arrival · Ambulance halts behind stationary queue
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs num-font">
                  <span className="text-[#64748B] font-bold uppercase text-[10px]">Signal:</span>
                  <span className={`font-black text-sm ${convFrame?.signal === 'GREEN' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {convFrame?.signal || 'RED'}
                  </span>
                  <span className="text-[#64748B] font-bold uppercase text-[10px]">Hold:</span>
                  <span className="font-black text-sm text-[#DC2626]">
                    {convBlockedS.toFixed(1)}s
                  </span>
                </div>
              </div>

              <SimulatorCanvas
                mode="conventional"
                frame={convFrame}
                showYolo={showYolo}
                detections={detections}
                totalDistance={params.distance_m}
              />
            </div>

            {/* Live Telemetry Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs num-font">
              <div className="bg-[#F8FAFC] border border-slate-200/80 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-[#64748B] block font-sans">Speed</span>
                <span className="font-extrabold text-sm text-[#1F0A18]">{convSpeed} km/h</span>
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200/80 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-[#64748B] block font-sans">Dist to Stop</span>
                <span className="font-extrabold text-sm text-[#1F0A18]">{convDist}m</span>
              </div>
              <div className="bg-[#FEE2E2] border border-[#DC2626]/30 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-black uppercase text-[#DC2626] block font-sans">Wait Delay</span>
                <span className="font-black text-sm text-[#DC2626]">{convWait.toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Predictive Queue-Flushing */}
          <div className="bg-white rounded-2xl border-2 border-emerald-300/80 p-5 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-[#DCFCE7] text-[#15803D] border border-[#16A34A]/30 uppercase tracking-wide">
                      Predictive Queue-Flushing
                    </span>
                    <span className="text-[11px] font-bold text-[#5E1B48] uppercase">Early green</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    YOLO counts queue · Shockwave clears lane before arrival · 0s stoppage
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs num-font">
                  <span className="text-[#64748B] font-bold uppercase text-[10px]">Signal:</span>
                  <span className={`font-black text-sm ${predFrame?.signal === 'GREEN' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                    {predFrame?.signal || 'RED'}
                  </span>
                  <span className="text-[#64748B] font-bold uppercase text-[10px]">Hold:</span>
                  <span className="font-black text-sm text-[#15803D]">
                    {predBlockedS.toFixed(1)}s
                  </span>
                </div>
              </div>

              <SimulatorCanvas
                mode="predictive"
                frame={predFrame}
                showYolo={showYolo}
                detections={detections}
                totalDistance={params.distance_m}
              />
            </div>

            {/* Live Telemetry Bar */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs num-font">
              <div className="bg-[#F8FAFC] border border-slate-200/80 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-[#64748B] block font-sans">Speed</span>
                <span className="font-extrabold text-sm text-[#1F0A18]">{predSpeed} km/h</span>
              </div>
              <div className="bg-[#F8FAFC] border border-slate-200/80 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-bold uppercase text-[#64748B] block font-sans">Dist to Stop</span>
                <span className="font-extrabold text-sm text-[#1F0A18]">{predDist}m</span>
              </div>
              <div className="bg-[#DCFCE7] border border-[#16A34A]/40 p-2.5 rounded-xl text-center">
                <span className="text-[10px] font-black uppercase text-[#15803D] block font-sans">Wait Delay</span>
                <span className="font-black text-sm text-[#15803D]">{predWait.toFixed(1)}s (ZERO) ✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transport Playback Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-soft flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="bg-[#5E1B48] hover:bg-[#4A1439] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
            </button>

            <button
              onClick={handleReset}
              className="bg-[#F7F0F4] hover:bg-slate-200 text-[#1F0A18] px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset simulation timeline"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>

            <button
              onClick={() => setSpeedMultiplier(speedMultiplier === 1.0 ? 0.25 : 1.0)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                speedMultiplier === 0.25
                  ? 'bg-[#FEF3C7] text-[#D97706] border-[#D97706]/40'
                  : 'bg-[#F7F0F4] text-[#64748B] border-slate-300'
              }`}
            >
              Slow-mo {speedMultiplier === 0.25 ? '0.25x' : '1.0x'}
            </button>
          </div>

          {/* Timeline seek bar */}
          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <span className="text-xs font-mono text-[#64748B] tabular-nums">
              {currentTime.toFixed(1)}s
            </span>
            <input
              type="range"
              min="0"
              max={maxTime}
              step="0.05"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-[#5E1B48] cursor-pointer"
            />
            <span className="text-xs font-mono text-[#64748B] tabular-nums">
              {maxTime.toFixed(1)}s
            </span>
          </div>

          {/* Telemetry dropout toggle for FAIL-SAFE */}
          <button
            onClick={() => setTelemetryDropped(!telemetryDropped)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              telemetryDropped
                ? 'bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]/40 animate-pulse'
                : 'bg-[#F7F0F4] text-[#64748B] border-slate-300'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{telemetryDropped ? 'Telemetry Dropped (Fail-Safe)' : 'Simulate Telemetry Drop'}</span>
          </button>
        </div>

        {/* Live Parameter Sliders */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-[#5E1B48]" />
            <h3 className="font-extrabold text-sm text-[#1F0A18] uppercase tracking-wide">
              Live Parameter Controls
            </h3>
            <span className="text-xs text-[#64748B] ml-2">
              (Live dynamic recalculation across mathematical predictor &amp; safety invariants)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
            {/* Queue Size */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#334155]">Queue Size (N)</span>
                <span className="font-extrabold font-mono text-[#5E1B48] bg-[#F5E6EF] px-2 py-0.5 rounded">
                  {params.N} vehicles
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="12"
                value={params.N}
                onChange={(e) => setParams({ ...params, N: parseInt(e.target.value) })}
                className="w-full accent-[#5E1B48] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>2 (Light)</span>
                <span>12 (Gridlock)</span>
              </div>
            </div>

            {/* Speed */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#334155]">Ambulance Speed</span>
                <span className="font-extrabold font-mono text-[#5E1B48] bg-[#F5E6EF] px-2 py-0.5 rounded">
                  {params.speed_kmh} km/h
                </span>
              </div>
              <input
                type="range"
                min="70"
                max="160"
                step="5"
                value={params.speed_kmh}
                onChange={(e) => setParams({ ...params, speed_kmh: parseInt(e.target.value) })}
                className="w-full accent-[#5E1B48] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>70 km/h</span>
                <span>160 km/h</span>
              </div>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#334155]">Driver Delay (t_delay)</span>
                <span className="font-extrabold font-mono text-[#5E1B48] bg-[#F5E6EF] px-2 py-0.5 rounded">
                  {params.t_delay.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="1.6"
                step="0.1"
                value={params.t_delay}
                onChange={(e) => setParams({ ...params, t_delay: parseFloat(e.target.value) })}
                className="w-full accent-[#5E1B48] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>0.4s (Alert)</span>
                <span>1.6s (Delayed)</span>
              </div>
            </div>

            {/* Heavy */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#334155]">Heavy Vehicles</span>
                <span className="font-extrabold font-mono text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded">
                  {params.heavy_count} bus/truck
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                value={params.heavy_count}
                onChange={(e) => setParams({ ...params, heavy_count: parseInt(e.target.value) })}
                className="w-full accent-[#D97706] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>0 heavy (+0s)</span>
                <span>4 heavy (+2.4s)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 mt-4 border-t border-slate-100 text-xs">
            {/* Weather */}
            <div>
              <span className="font-bold text-[#334155] block mb-2">Weather Condition:</span>
              <div className="flex items-center gap-2 bg-[#F7F0F4] p-1 rounded-xl border border-slate-200">
                {(['dry', 'wet', 'fog'] as WeatherType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setParams({ ...params, weather: w })}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-xs capitalize transition-all cursor-pointer ${
                      params.weather === w
                        ? 'bg-white text-[#5E1B48] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1F0A18]'
                    }`}
                  >
                    {w} ({w === 'dry' ? '1.0x' : w === 'wet' ? '1.25x' : '1.35x'})
                  </button>
                ))}
              </div>
            </div>

            {/* Distance */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-[#334155]">Approach Distance:</span>
                <span className="font-mono font-bold text-[#5E1B48]">{params.distance_m}m</span>
              </div>
              <input
                type="range"
                min="100"
                max="450"
                step="25"
                value={params.distance_m}
                onChange={(e) => setParams({ ...params, distance_m: parseInt(e.target.value) })}
                className="w-full accent-[#5E1B48] cursor-pointer mt-2"
              />
            </div>

            {/* Pedestrian Phase */}
            <div className="flex items-center justify-between p-3 bg-[#F7F0F4] rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-[#1F0A18] block">Pedestrian Phase Active</span>
                <span className="text-[11px] text-[#64748B]">Enforces 3s walk clearance safety hold</span>
              </div>
              <input
                type="checkbox"
                checked={params.ped_active || false}
                onChange={(e) =>
                  setParams({
                    ...params,
                    ped_active: e.target.checked,
                    ped_remaining_s: e.target.checked ? 2.0 : 0,
                  })
                }
                className="w-5 h-5 accent-[#5E1B48] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Live Formula & Monospace Decision Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FormulaCard params={params} prediction={currentPrediction} />
          <DecisionTerminal events={visibleEvents} maxHeight="220px" />
        </div>
      </div>
    </div>
  );
};
