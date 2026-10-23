import React, { useEffect, useRef } from 'react';
import type { SimEvent } from '../types';
import { Terminal } from 'lucide-react';

interface DecisionTerminalProps {
  events: SimEvent[];
  maxHeight?: string;
}

export const DecisionTerminal: React.FC<DecisionTerminalProps> = ({ events, maxHeight = '220px' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'VISION':
        return 'text-blue-400 bg-teal-950/60 border border-blue-800/50';
      case 'PREDICT':
        return 'text-teal-400 bg-teal-950/60 border border-teal-800/50';
      case 'SAFETY':
        return 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/50';
      case 'SIGNAL':
        return 'text-amber-400 bg-amber-950/60 border border-amber-800/50';
      case 'TELEMETRY':
        return 'text-purple-400 bg-purple-950/60 border border-purple-800/50';
      default:
        return 'text-slate-400 bg-[#3B0F2D] border border-slate-700';
    }
  };

  return (
    <div className="bg-[#2C0A21] rounded-2xl border border-[#4A1A3C] overflow-hidden shadow-md">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2C0A21]/90 border-b border-[#4A1A3C]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">
            Live Decision Log Terminal
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500/80"></span>
          <span className="w-2 h-2 rounded-full bg-amber-500/80"></span>
          <span className="w-2 h-2 rounded-full bg-emerald-500/80"></span>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ maxHeight }}
        className="overflow-y-auto p-3.5 font-mono text-[11px] space-y-1.5 bg-[#2C0A21]"
      >
        {events.length === 0 ? (
          <div className="text-slate-500 italic py-4 text-center">
            Awaiting simulation start...
          </div>
        ) : (
          events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed hover:bg-[#3B0F2D]/30 px-1 rounded transition-colors">
              <span className="text-slate-500 tabular-nums shrink-0">
                [{ev.t.toFixed(1)}s]
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 uppercase tracking-wide ${getCategoryBadge(ev.category)}`}>
                {ev.category}
              </span>
              <span className="text-slate-300 break-words">
                {ev.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
