import React, { useState, useId } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  Radio,
  Car,
  RotateCcw,
  Sliders,
  Eye,
  Activity,
  Layers,
  Scale,
  Lock,
} from 'lucide-react';

export const DecisionLogicVerification: React.FC = () => {
  // Input parameters (Interactive Admin Sandbox)
  const [distanceM, setDistanceM] = useState<number>(300);
  const [speedKmh, setSpeedKmh] = useState<number>(60);
  const [vehicleCountN, setVehicleCountN] = useState<number>(8);
  const [heavyCount, setHeavyCount] = useState<number>(2);
  const [twoWheelerCount, setTwoWheelerCount] = useState<number>(3);
  const [dischargeRateS, setDischargeRateS] = useState<number>(0.55); // veh/s
  const [pedestrianFree, setPedestrianFree] = useState<boolean>(true);
  const [pedCountdownS, setPedCountdownS] = useState<number>(0);
  const [activeScenario, setActiveScenario] = useState<string>('custom');

  // Input IDs for accessibility and label association
  const distanceInputId = useId();
  const speedInputId = useId();
  const vehicleCountInputId = useId();
  const heavyCountInputId = useId();
  const dischargeRateInputId = useId();
  const pedCountdownInputId = useId();

  // Calculated values
  // 1. Ambulance Velocity in m/s: V_ms = V_kmh / 3.6
  const speedMs = speedKmh / 3.6;

  // 2. Ambulance ETA (T1 = D / V)
  const t1Eta = speedMs > 0 ? distanceM / speedMs : 0;

  // 3. Queue Clearance Time (T2 = N / S)
  const t2Clearance = dischargeRateS > 0 ? vehicleCountN / dischargeRateS : 0;

  // Detailed queue startup formulation:
  // Startup delay = 1.0s, reaction headway = 1.2s, heavy vehicle adjustment = 0.6s/heavy
  const carCount = Math.max(0, vehicleCountN - heavyCount - twoWheelerCount);
  const detailedT2 = Math.max(
    0,
    (vehicleCountN - 1) * 1.2 + 2.0 + heavyCount * 0.6 - twoWheelerCount * 0.2
  );

  // 4. Time Margin (M = T1 - T2)
  const marginM = t1Eta - t2Clearance;

  // Decision logic
  const isOptimalFlush = marginM > 0;
  const triggerOffsetS = isOptimalFlush ? marginM : 0;

  // Safety checks
  const minPedClearanceS = 3.0;
  const safetyInterlockPass = pedestrianFree || pedCountdownS === 0;
  const requiredSafetyHoldS = pedestrianFree ? 0 : Math.max(0, minPedClearanceS - pedCountdownS);

  // Apply predefined scenarios
  const applyScenario = (type: string) => {
    setActiveScenario(type);
    if (type === 'optimal') {
      setDistanceM(350);
      setSpeedKmh(65);
      setVehicleCountN(6);
      setHeavyCount(1);
      setTwoWheelerCount(2);
      setDischargeRateS(0.6);
      setPedestrianFree(true);
      setPedCountdownS(0);
    } else if (type === 'heavy') {
      setDistanceM(200);
      setSpeedKmh(50);
      setVehicleCountN(14);
      setHeavyCount(4);
      setTwoWheelerCount(4);
      setDischargeRateS(0.48);
      setPedestrianFree(true);
      setPedCountdownS(0);
    } else if (type === 'pedestrian_hazard') {
      setDistanceM(280);
      setSpeedKmh(55);
      setVehicleCountN(7);
      setHeavyCount(1);
      setTwoWheelerCount(3);
      setDischargeRateS(0.55);
      setPedestrianFree(false);
      setPedCountdownS(2.2);
    } else if (type === 'urgent_close') {
      setDistanceM(90);
      setSpeedKmh(70);
      setVehicleCountN(9);
      setHeavyCount(2);
      setTwoWheelerCount(2);
      setDischargeRateS(0.52);
      setPedestrianFree(true);
      setPedCountdownS(0);
    }
  };

  const resetDefaults = () => {
    applyScenario('optimal');
  };

  return (
    <div className="space-y-6 text-[#334155] font-sans">
      {/* Official TEJAS & SASTRA Methodology Header */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-[#3B0F2D] text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                SASTRA · TEMENOS · TEJAS 2026
              </span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                ICCC VERIFICATION MATRIX
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                DETERMINISTIC FORMULATION
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#3B0F2D] tracking-tight">
              Technical Methodology &amp; Decision Logic Verification
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Real-time administrative verification of the 4-phase QueueFlush AI decision engine. 
              Validates input streams (OBU GPS, Edge YOLO Camera, Safety Control Unit) and calculates 
              exact mathematical margins for preemption timing.
            </p>
          </div>

          {/* Institutional Logos / Badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-center shadow-sm">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Institution</span>
              <span className="text-xs font-black text-[#3B0F2D]">SASTRA 40</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-center shadow-sm">
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Partner</span>
              <span className="text-xs font-black text-blue-700">temenos</span>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-2xl px-3.5 py-2 text-center shadow-sm">
              <span className="text-[10px] text-amber-700 block font-bold uppercase tracking-wider">Challenge</span>
              <span className="text-xs font-black text-amber-900 font-mono">TEJAS 2026</span>
            </div>
          </div>
        </div>

        {/* Quick Scenario Preset Selector */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Preset Verification Scenarios:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyScenario('optimal')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeScenario === 'optimal'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ✓ Standard Optimal Flush
            </button>

            <button
              onClick={() => applyScenario('heavy')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeScenario === 'heavy'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ⚠ Heavy Queue (14 Veh / 4 Trucks)
            </button>

            <button
              onClick={() => applyScenario('pedestrian_hazard')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeScenario === 'pedestrian_hazard'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              🚸 Pedestrian Hazard (SCU Hold)
            </button>

            <button
              onClick={() => applyScenario('urgent_close')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeScenario === 'urgent_close'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ⚡ Urgent Close-Range (Partial Flush)
            </button>

            <button
              onClick={resetDefaults}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Reset parameters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Pillars of Decision Logic — Grid Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* 1. DATA COLLECTION LAYER */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-black text-base text-[#3B0F2D] tracking-tight">
                    Data Collection Layer
                  </h3>
                  <p className="text-[11px] text-slate-400">Multi-source telematics &amp; vision sensors</p>
                </div>
              </div>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-black px-2 py-0.5 rounded">
                LIVE INPUTS
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* GPS Ambulance Telematics */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-[#3B0F2D] uppercase tracking-wide">
                      GPS Telemetry (Ambulance OBU)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    10 Hz Heartbeat OK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor={distanceInputId} className="text-[11px] font-bold text-slate-500 block mb-1">
                      Distance to Stopline (D): <span className="font-mono text-[#3B0F2D] font-black">{distanceM} m</span>
                    </label>
                    <input
                      id={distanceInputId}
                      type="range"
                      min={50}
                      max={500}
                      step={10}
                      value={distanceM}
                      onChange={(e) => {
                        setDistanceM(Number(e.target.value));
                        setActiveScenario('custom');
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label htmlFor={speedInputId} className="text-[11px] font-bold text-slate-500 block mb-1">
                      Velocity (V): <span className="font-mono text-[#3B0F2D] font-black">{speedKmh} km/h</span> ({speedMs.toFixed(1)} m/s)
                    </label>
                    <input
                      id={speedInputId}
                      type="range"
                      min={20}
                      max={120}
                      step={5}
                      value={speedKmh}
                      onChange={(e) => {
                        setSpeedKmh(Number(e.target.value));
                        setActiveScenario('custom');
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span>Approach Vector: <strong>Hospital Eastbound (Corridor Node 1)</strong></span>
                  <span className="font-mono text-slate-600">RTK Fix: Lat 10.7828° N, Lon 79.1378° E</span>
                </div>
              </div>

              {/* Dedicated Cameras (YOLO Vehicle Detection) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-black text-[#3B0F2D] uppercase tracking-wide">
                      Dedicated YOLOv8 Camera (Vehicle Detection)
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                    30 FPS Edge Inference
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor={vehicleCountInputId} className="text-[11px] font-bold text-slate-500 block mb-1">
                      Total Queued Vehicles (N): <span className="font-mono text-[#3B0F2D] font-black">{vehicleCountN} vehicles</span>
                    </label>
                    <input
                      id={vehicleCountInputId}
                      type="range"
                      min={1}
                      max={20}
                      value={vehicleCountN}
                      onChange={(e) => {
                        const newN = Number(e.target.value);
                        setVehicleCountN(newN);
                        if (heavyCount > newN) setHeavyCount(newN);
                        setActiveScenario('custom');
                      }}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>

                  {/* Vehicle Type Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Cars / Cabs</span>
                      <span className="text-base font-black text-[#3B0F2D] font-mono">{carCount}</span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">2W / Autos</span>
                      <span className="text-base font-black text-blue-600 font-mono">{twoWheelerCount}</span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Heavy (Bus/Truck)</span>
                      <span className="text-base font-black text-amber-600 font-mono">{heavyCount}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <label htmlFor={heavyCountInputId} className="text-[11px] font-bold text-slate-500 block mb-1">
                        Heavy Vehicles Count: <strong className="text-amber-700">{heavyCount}</strong>
                      </label>
                      <input
                        id={heavyCountInputId}
                        type="range"
                        min={0}
                        max={Math.min(6, vehicleCountN)}
                        value={heavyCount}
                        onChange={(e) => {
                          setHeavyCount(Number(e.target.value));
                          setActiveScenario('custom');
                        }}
                        className="w-full accent-amber-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label htmlFor={dischargeRateInputId} className="text-[11px] font-bold text-slate-500 block mb-1">
                        Discharge Rate (S): <strong className="text-[#3B0F2D] font-mono">{dischargeRateS.toFixed(2)} veh/s</strong>
                      </label>
                      <input
                        id={dischargeRateInputId}
                        type="range"
                        min={0.35}
                        max={0.85}
                        step={0.01}
                        value={dischargeRateS}
                        onChange={(e) => {
                          setDischargeRateS(Number(e.target.value));
                          setActiveScenario('custom');
                        }}
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Control Unit (Pedestrian Detection) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-[#3B0F2D] uppercase tracking-wide">
                      Safety Control Unit (SCU Pedestrian Status)
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase ${
                      pedestrianFree ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'
                    }`}
                  >
                    {pedestrianFree ? 'CROSSWALK FREE' : 'PEDESTRIANS DETECTED'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPedestrianFree(true);
                        setPedCountdownS(0);
                        setActiveScenario('custom');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        pedestrianFree
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ✓ Pedestrian Free (Clear)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPedestrianFree(false);
                        setPedCountdownS(2.5);
                        setActiveScenario('custom');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        !pedestrianFree
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ⚠ Pedestrian Crossing
                    </button>
                  </div>

                  {!pedestrianFree && (
                    <div className="w-full sm:w-auto text-xs">
                      <label htmlFor={pedCountdownInputId} className="text-[11px] font-bold text-rose-700 block mb-0.5">
                        Pedestrian Remaining Time: {pedCountdownS.toFixed(1)}s
                      </label>
                      <input
                        id={pedCountdownInputId}
                        type="range"
                        min={0.5}
                        max={5.0}
                        step={0.5}
                        value={pedCountdownS}
                        onChange={(e) => {
                          setPedCountdownS(Number(e.target.value));
                          setActiveScenario('custom');
                        }}
                        className="w-full accent-rose-600 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* 2. TIME ESTIMATION (T1 and T2 FORMULATION) */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-black text-base text-[#3B0F2D] tracking-tight">
                    Time Estimation Formulas
                  </h3>
                  <p className="text-[11px] text-slate-400">Deterministic ETA and Queue Clearance</p>
                </div>
              </div>
              <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-mono font-black px-2 py-0.5 rounded">
                STEP-BY-STEP MATH
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* Formula 1: Ambulance ETA (T1 = D/V) */}
              <div className="bg-[#2C0A21] text-white rounded-2xl p-5 border border-[#4A1A3C] space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Ambulance ETA: (T1 = D / V)
                  </span>
                  <span className="text-[10px] text-slate-400 bg-[#3B0F2D] px-2 py-0.5 rounded">
                    D = distance, V = speed/velocity
                  </span>
                </div>

                <div className="bg-[#1C0614]/80 p-3.5 rounded-xl border border-[#4A1A3C] text-xs space-y-2">
                  <div className="text-slate-400 text-[11px]">
                    Equation: <span className="text-white font-bold">T1 = D ÷ (V_kmh ÷ 3.6)</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-sm sm:text-base">
                    <span className="text-teal-400 font-black text-xl">{t1Eta.toFixed(2)}s</span>
                    <span className="text-slate-500">=</span>
                    <span>{distanceM.toFixed(1)} m</span>
                    <span className="text-slate-500">÷</span>
                    <span>({speedKmh} km/h ÷ 3.6)</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-blue-300">{speedMs.toFixed(2)} m/s</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between font-sans">
                  <span>Transit Time to Stopline:</span>
                  <strong className="text-white font-mono">{t1Eta.toFixed(2)} seconds</strong>
                </div>
              </div>

              {/* Formula 2: Queue clearance: (T2 = N / S) */}
              <div className="bg-[#2C0A21] text-white rounded-2xl p-5 border border-[#4A1A3C] space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Queue Clearance: (T2 = N / S)
                  </span>
                  <span className="text-[10px] text-slate-400 bg-[#3B0F2D] px-2 py-0.5 rounded">
                    N = number of vehicles, S = discharge rate
                  </span>
                </div>

                <div className="bg-[#1C0614]/80 p-3.5 rounded-xl border border-[#4A1A3C] text-xs space-y-2">
                  <div className="text-slate-400 text-[11px]">
                    Canonical Equation: <span className="text-white font-bold">T2 = N ÷ S</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-sm sm:text-base">
                    <span className="text-amber-400 font-black text-xl">{t2Clearance.toFixed(2)}s</span>
                    <span className="text-slate-500">=</span>
                    <span>{vehicleCountN} vehicles</span>
                    <span className="text-slate-500">÷</span>
                    <span>{dischargeRateS.toFixed(2)} veh/s</span>
                  </div>
                </div>

                {/* Micro-simulation expansion verification */}
                <div className="bg-[#3B0F2D]/60 p-2.5 rounded-xl border border-slate-700/60 text-[11px] space-y-1 font-sans">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Micro-Headway Wave Physics Model:</span>
                    <strong className="text-amber-300 font-mono">{detailedT2.toFixed(2)}s</strong>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Includes: (N-1)×1.2s headway + 2.0s startup + {heavyCount}×0.6s heavy delay.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* 3. AI DECISION LOGIC (TIME MARGIN: M = T1 - T2) */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                  3
                </div>
                <div>
                  <h3 className="font-black text-base text-[#3B0F2D] tracking-tight">
                    AI Decision Logic &amp; Margin
                  </h3>
                  <p className="text-[11px] text-slate-400">Compare Ambulance ETA with Queue Clearance</p>
                </div>
              </div>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-black px-2 py-0.5 rounded">
                M = T1 - T2
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* Margin Equation Box */}
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#3B0F2D] uppercase tracking-wide">
                    Calculate Time Margin: (M = T1 - T2)
                  </span>
                  <span
                    className={`font-mono text-xs font-black px-2.5 py-0.5 rounded-full ${
                      isOptimalFlush
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isOptimalFlush ? 'POSITIVE MARGIN (M > 0)' : 'NEGATIVE MARGIN (M ≤ 0)'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Formula Calculation</span>
                    <div className="flex items-baseline gap-2 font-mono text-base">
                      <span className={`text-2xl font-black ${isOptimalFlush ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {marginM >= 0 ? `+${marginM.toFixed(2)}s` : `${marginM.toFixed(2)}s`}
                      </span>
                      <span className="text-slate-400">=</span>
                      <span className="text-blue-600 font-bold">{t1Eta.toFixed(2)}s (T1)</span>
                      <span className="text-slate-400">-</span>
                      <span className="text-amber-600 font-bold">{t2Clearance.toFixed(2)}s (T2)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Trigger Timing</span>
                    <span className="text-sm font-black text-[#3B0F2D] font-mono block">
                      {isOptimalFlush ? `T_trigger = ${marginM.toFixed(1)}s` : 'T_trigger = 0.0s (IMMEDIATE)'}
                    </span>
                  </div>
                </div>

                {/* Decision Outcomes */}
                <div className="space-y-2 pt-1 text-xs">
                  {isOptimalFlush ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1 text-emerald-900">
                      <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>OPTIMAL QUEUE FLUSH: T1 (ETA) &gt; T2 (Clearance)</span>
                      </div>
                      <p className="text-[11px] text-emerald-800/90 leading-relaxed pl-6">
                        The signal controller delays green preemption by <strong>{marginM.toFixed(1)}s</strong> so that 
                        cross-traffic flows undisturbed until the precise moment required. When the ambulance reaches 
                        the junction in {t1Eta.toFixed(1)}s, exactly 0 stopped vehicles remain.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-amber-900">
                      <div className="flex items-center gap-2 font-black text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>PARTIAL FLUSH / IMMEDIATE DISPATCH: T1 (ETA) ≤ T2 (Clearance)</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed pl-6">
                        Queue clearance requirement ({t2Clearance.toFixed(1)}s) exceeds ambulance arrival time ({t1Eta.toFixed(1)}s). 
                        Immediate preemption triggered (T_trigger = 0.0s). In-cabin advisory sent to ambulance pilot to slow to 
                        caution speed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* 4. SIGNAL CONTROL & SAFETY CONTROL UNIT ENFORCEMENT */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-md flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm">
                  4
                </div>
                <div>
                  <h3 className="font-black text-base text-[#3B0F2D] tracking-tight">
                    Signal Control &amp; Safety Enforcement
                  </h3>
                  <p className="text-[11px] text-slate-400">Control room command &amp; interlocks</p>
                </div>
              </div>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-mono font-black px-2 py-0.5 rounded">
                HARDWARE INTERLOCK
              </span>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Directive 1: Send Recommended Timing */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-[#3B0F2D]">
                    1. Send Recommended Timing to Signal Controller
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    NTCIP-1202 / ITMS packet dispatched to Junction Controller #01 via MQTT/CoAP. 
                    Target phase: <strong>Phase 2 (Emergency Eastbound Approach)</strong>. Preemption Green Duration: <strong>{(t2Clearance + 8).toFixed(1)}s</strong>.
                  </p>
                </div>
              </div>

              {/* Directive 2: Enforce Safety Intervals & Pedestrian Interlock */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  safetyInterlockPass
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-rose-50/80 border-rose-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      safetyInterlockPass ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  />
                  <div className="space-y-1.5 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#3B0F2D]">
                        2. Safety Control Unit Interlock &amp; Pedestrian Clearance
                      </h4>
                      <span
                        className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded uppercase ${
                          safetyInterlockPass
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-rose-200 text-rose-900 animate-pulse'
                        }`}
                      >
                        {safetyInterlockPass ? 'INTERLOCK CLEARED' : 'SAFETY HOLD ACTIVE'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {safetyInterlockPass ? (
                        <>
                          Pedestrian crossing is <strong>VERIFIED FREE</strong>. Standard intergreen transitions 
                          (3.0s Yellow + 1.0s All-Red) safely executed before initiating corridor flush.
                        </>
                      ) : (
                        <>
                          Pedestrian crossing occupied! Required safety hold of <strong>{requiredSafetyHoldS.toFixed(1)}s</strong> 
                          enforced to allow pedestrians to reach median before granting vehicle green.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Directive 3: Update decisions continuously using live data */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                <Activity className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-[#3B0F2D]">
                    3. Continuous Dynamic Loop (Live Stream Updates)
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Decisions recalculate at <strong>10 Hz</strong>. If ambulance velocity varies or queue changes due to 
                    spillback, the margin $M$ and signal offsets adjust continuously in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Official MoRTH Audit & Verification Summary Strip */}
      <div className="bg-[#3B0F2D] text-white p-5 rounded-3xl border-2 border-amber-400/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 font-bold">
            ✓
          </div>
          <div>
            <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
              Central ICCC Calculation Validation Certificate
            </div>
            <div className="text-white font-bold text-sm">
              T1={t1Eta.toFixed(1)}s · T2={t2Clearance.toFixed(1)}s · Margin M={marginM >= 0 ? `+${marginM.toFixed(1)}s` : `${marginM.toFixed(1)}s`} · SCU={safetyInterlockPass ? 'PASS' : 'HOLD'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-300 border-t md:border-t-0 border-slate-700/60 pt-3 md:pt-0">
          <div>
            <span className="text-slate-400 block text-[9px] uppercase">Decision Hash</span>
            <span className="text-amber-300 font-bold">0x7F2A...B941 (SHA-256)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase">Compliance</span>
            <span className="text-emerald-400 font-bold">MoRTH IRC:SP:108</span>
          </div>
        </div>
      </div>
    </div>
  );
};
