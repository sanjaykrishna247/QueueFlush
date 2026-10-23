import React from 'react';
import type { PredictResponse, PredictorParams } from '../types';

interface FormulaCardProps {
  params: PredictorParams;
  prediction: PredictResponse;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ params, prediction }) => {
  const { N, t_delay, t_margin, weather, heavy_count, distance_m, speed_kmh } = params;
  const { t_clear, eta, t_trigger, weather_factor, heavy_adjustment_s, partial_flush } = prediction;

  return (
    <div className="bg-[#2C0A21] text-white rounded-2xl p-5 border border-[#4A1A3C] shadow-md">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#4A1A3C]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5E1B48]"></span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
            Mathematical Formulation
          </h3>
        </div>
        <span className="text-[10px] num-font text-slate-400 bg-[#3B0F2D]/60 px-2 py-0.5 rounded">
          LIVE COMPUTED
        </span>
      </div>

      <div className="space-y-4 text-xs">
        {/* T_clear equation */}
        <div className="bg-[#2C0A21]/80 rounded-xl p-3 border border-[#4A1A3C] font-mono">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
            <span>Queue Clearance Time:</span>
            <span className="text-teal-400 font-bold">T_clear = (N - 1) × (t_delay × w_f) + t_margin + t_heavy</span>
          </div>
          <div className="text-sm font-semibold tracking-tight text-white flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-teal-400 font-extrabold text-base">{t_clear.toFixed(2)}s</span>
            <span className="text-slate-400">=</span>
            <span>({N} - 1)</span>
            <span className="text-slate-400">×</span>
            <span>({t_delay}s × {weather_factor.toFixed(2)} [{weather}])</span>
            <span className="text-slate-400">+</span>
            <span>{t_margin.toFixed(1)}s</span>
            {heavy_count > 0 && (
              <>
                <span className="text-slate-400">+</span>
                <span className="text-amber-400">+{heavy_adjustment_s.toFixed(1)}s ({heavy_count} heavy)</span>
              </>
            )}
          </div>
        </div>

        {/* T_trigger equation */}
        <div className="bg-[#2C0A21]/80 rounded-xl p-3 border border-[#4A1A3C] font-mono">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center justify-between">
            <span>Preemption Trigger Offset:</span>
            <span className="text-amber-400 font-bold">T_trigger = ETA - T_clear</span>
          </div>
          <div className="text-sm font-semibold tracking-tight text-white flex flex-wrap items-center gap-1.5 pt-1">
            <span className={`font-extrabold text-base ${partial_flush ? 'text-amber-400' : 'text-teal-400'}`}>
              {t_trigger.toFixed(2)}s
            </span>
            <span className="text-slate-400">=</span>
            <span className="text-blue-400">{eta.toFixed(2)}s</span>
            <span className="text-[11px] text-slate-400">({distance_m}m @ {speed_kmh}km/h)</span>
            <span className="text-slate-400">-</span>
            <span className="text-teal-400">{t_clear.toFixed(2)}s</span>
          </div>
        </div>

        {/* Status Callout */}
        <div className="flex items-center justify-between pt-1 text-[11px]">
          {partial_flush ? (
            <div className="flex items-center gap-2 text-amber-400 font-medium bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-lg w-full">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>PARTIAL FLUSH: ETA &lt; T_clear. Immediate green preemption triggered.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-teal-300 font-medium bg-teal-950/40 border border-teal-800/40 px-2.5 py-1 rounded-lg w-full">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              <span>OPTIMAL FLUSH: Preemption triggers in {t_trigger.toFixed(1)}s (Zero queue remaining on arrival)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
