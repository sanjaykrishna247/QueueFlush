import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getCorridors, simulateCorridor } from '../api';
import type { Corridor, CorridorSimResult } from '../types';
import { CorridorRace } from '../components/CorridorRace';
import { Reveal } from '../components/Motion';
import { ChevronDown, Hospital, Route } from 'lucide-react';

const fallbackPred = [
  { code: 'INT-01', name: 'Hospital Road x Gandhi Salai', wait_s: 0.0, crossing_s: 13.3, queue_n: 8, cleared: true },
  { code: 'INT-02', name: 'Collectorate Circle', wait_s: 0.0, crossing_s: 12.3, queue_n: 6, cleared: true },
  { code: 'INT-03', name: 'Anna Flyover North Approach', wait_s: 1.9, crossing_s: 16.3, queue_n: 9, cleared: true },
  { code: 'INT-04', name: 'Old Bus Stand Cross', wait_s: 0.0, crossing_s: 12.5, queue_n: 5, cleared: true },
  { code: 'INT-05', name: 'Medical College East Gate', wait_s: 0.0, crossing_s: 12.9, queue_n: 4, cleared: true },
];
const fallbackConv = [
  { code: 'INT-01', name: 'Hospital Road x Gandhi Salai', wait_s: 11.2, crossing_s: 24.5, queue_n: 8, cleared: true },
  { code: 'INT-02', name: 'Collectorate Circle', wait_s: 9.8, crossing_s: 22.1, queue_n: 6, cleared: true },
  { code: 'INT-03', name: 'Anna Flyover North Approach', wait_s: 13.4, crossing_s: 27.8, queue_n: 9, cleared: true },
  { code: 'INT-04', name: 'Old Bus Stand Cross', wait_s: 8.5, crossing_s: 21.0, queue_n: 5, cleared: true },
  { code: 'INT-05', name: 'Medical College East Gate', wait_s: 5.3, crossing_s: 18.2, queue_n: 4, cleared: true },
];

export const CorridorPage: React.FC = () => {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('hospital-corridor-a');
  const [simResult, setSimResult] = useState<CorridorSimResult | null>(null);

  useEffect(() => {
    getCorridors().then((list) => {
      if (list && list.length > 0) setCorridors(list);
    });
  }, []);

  useEffect(() => {
    simulateCorridor({ corridor_slug: selectedSlug }).then((res) => setSimResult(res));
  }, [selectedSlug]);

  const currentCorridor = corridors.find((c) => c.slug === selectedSlug);
  const junctions = simResult?.predictive?.junction_metrics || fallbackPred;
  const convJunctions = simResult?.conventional?.junction_metrics || fallbackConv;

  const convTotal = simResult?.conventional?.total_time_s ?? 142.4;
  const predTotal = simResult?.predictive?.total_time_s ?? 96.1;
  const timeSaved = simResult?.predictive?.time_saved_s ?? Math.max(0, convTotal - predTotal);

  const queues = useMemo(() => junctions.map((j) => j.queue_n), [junctions]);
  const names = useMemo(
    () => junctions.map((j) => j.name.split(/ [x×] | – | - /)[0].replace(/ (Junction|Signal|Approach|Gate|Cross|Circle)$/, '')),
    [junctions]
  );
  const maxCrossing = Math.max(...convJunctions.map((j) => j.crossing_s ?? 0), ...junctions.map((j) => j.crossing_s ?? 0), 1);

  return (
    <div className="bg-[#FCFAFB] min-h-screen">
      {/* Header */}
      <section className="border-b border-[#EDE3E9] bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#A8487F]">
              <Route className="w-4 h-4" /> Corridor mode
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#1F0A18]">
              A green wave all the way to the ER
            </h1>
            <p className="mt-2 text-[#5B4A57] max-w-2xl">
              QueueFlush clears each junction ahead of the ambulance, so it keeps cruise speed through every signal.
              Press start and watch both runs side by side.
            </p>
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold text-[#7A6B76] mb-1.5">Corridor</label>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="appearance-none bg-white border border-[#E6DCE2] text-[#1F0A18] text-sm font-semibold rounded-lg pl-3 pr-10 py-2.5 outline-none focus:ring-4 focus:ring-[#5E1B48]/10 focus:border-[#5E1B48] cursor-pointer min-w-[260px]"
            >
              {corridors.length === 0 && <option value="hospital-corridor-a">Hospital Corridor A</option>}
              {corridors.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} · {c.total_length_km} km
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 bottom-3 w-4 h-4 text-[#7A6B76]" />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-8">
        {/* Race */}
        <Reveal>
          <div className="bg-white rounded-2xl border border-[#EDE3E9] p-5 sm:p-7 shadow-soft">
            <div className="flex items-center gap-2 mb-5 text-sm text-[#5B4A57]">
              <Hospital className="w-4 h-4 text-red-600" />
              Destination: <span className="font-semibold text-[#1F0A18]">{currentCorridor?.hospital_name || 'Government Medical College Hospital'}</span>
            </div>
            <CorridorRace queues={queues} names={names} />
          </div>
        </Reveal>

        {/* Engine results */}
        <div className="grid lg:grid-cols-12 gap-6">
          <Reveal className="lg:col-span-8">
            <div className="h-full bg-white rounded-2xl border border-[#EDE3E9] p-6 shadow-soft">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="text-lg font-bold text-[#1F0A18]">Crossing time per junction</h2>
                <div className="flex items-center gap-4 text-xs text-[#7A6B76]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Conventional</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#5E1B48]" />QueueFlush</span>
                </div>
              </div>
              <div className="space-y-5">
                {junctions.map((j, idx) => {
                  const c = convJunctions[idx] || { crossing_s: 24.5 };
                  const cC = c.crossing_s ?? 24.5;
                  const pC = j.crossing_s ?? 13;
                  return (
                    <div key={j.code || idx}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-[#1F0A18] font-medium">
                          <span className="text-[#7A6B76] font-mono text-xs mr-2">{j.code}</span>
                          {j.name}
                        </span>
                        <span className="font-mono text-xs text-[#7A6B76]">
                          <span className="text-red-600">{cC.toFixed(1)}s</span> → <span className="text-[#5E1B48] font-semibold">{pC.toFixed(1)}s</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 rounded-full bg-red-50 overflow-hidden">
                          <motion.div className="h-full rounded-full bg-red-500" initial={{ width: 0 }} whileInView={{ width: `${(cC / maxCrossing) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }} />
                        </div>
                        <div className="h-2 rounded-full bg-[#F5E6EF] overflow-hidden">
                          <motion.div className="h-full rounded-full bg-[#5E1B48]" initial={{ width: 0 }} whileInView={{ width: `${(pC / maxCrossing) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: idx * 0.08 + 0.1, ease: [0.16, 1, 0.3, 1] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-4" delay={0.1}>
            <div className="h-full rounded-2xl bg-[#5E1B48] text-white p-7 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#F25C8A]/30 blur-3xl" />
              <div className="relative">
                <div className="text-sm text-white/70">Whole corridor (engine result)</div>
                <div className="mt-3 text-5xl font-bold font-mono">−{((timeSaved / Math.max(convTotal, 1)) * 100).toFixed(0)}%</div>
                <div className="text-white/70 text-sm">travel time</div>
                <div className="mt-8 space-y-3 text-sm">
                  <div className="flex justify-between border-b border-white/15 pb-3">
                    <span className="text-white/70">Conventional</span>
                    <span className="font-mono">{convTotal.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between border-b border-white/15 pb-3">
                    <span className="text-white/70">QueueFlush AI</span>
                    <span className="font-mono">{predTotal.toFixed(1)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Time saved</span>
                    <span className="font-mono font-bold text-[#FFC2D6]">{timeSaved.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
};
