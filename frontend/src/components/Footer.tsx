import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cpu, Eye, Radio, ArrowUpRight } from 'lucide-react';
import { BrandMark } from './Navbar';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Junction Simulator', to: '/simulator' },
      { label: 'Corridor Green Wave', to: '/corridor' },
      { label: 'Analytics & Benchmark', to: '/analytics' },
      { label: 'Architecture & Safety', to: '/architecture' },
    ],
  },
  {
    title: 'Access',
    links: [
      { label: 'Driver Portal', to: '/login' },
      { label: 'Admin Console', to: '/admin' },
    ],
  },
];

export const Footer: React.FC = () => {
  return (
    <footer className="relative mt-10 bg-[#2C0A21] text-[#E9D7E2] overflow-hidden">
      {/* glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full bg-[#A8487F]/30 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <BrandMark onDark />
              <span className="font-extrabold text-xl text-white tracking-tight">
                QueueFlush<span className="text-[#F25C8A]"> AI</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[#CDB6C5] max-w-md">
              Predictive queue-flushing for emergency vehicles. We clear the lane <em>before</em> the
              ambulance arrives — so it never has to stop.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: Radio, t: 'HMAC-signed telemetry' },
                { icon: Eye, t: 'Edge YOLO vision' },
                { icon: Cpu, t: 'Deterministic engine' },
                { icon: ShieldCheck, t: 'Fail-safe rules' },
              ].map(({ icon: Icon, t }) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                  <Icon className="w-3.5 h-3.5 text-[#F25C8A]" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60 mb-4">{col.title}</h4>
              <ul className="space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="group inline-flex items-center gap-1 hover:text-white transition-colors">
                      {l.label}
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="md:col-span-3">
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60 mb-4">Built for</h4>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="text-white font-bold">TEJAS 2026 Grand Finale</div>
              <div className="text-xs text-[#CDB6C5] mt-1">Team TEJAS021 · SASTRA Deemed University</div>
              <div className="text-xs text-[#CDB6C5]">TEMENOS &amp; SASTRA ASCEND</div>
            </div>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#B49AAB]">
          <p>© 2026 Team TEJAS021 · QueueFlush AI</p>
          <p className="font-mono">100% offline · zero paid APIs · deterministic &amp; auditable</p>
        </div>
      </div>

      {/* giant wordmark */}
      <div className="relative select-none pointer-events-none text-center font-extrabold tracking-tighter leading-none text-[18vw] md:text-[13vw] text-transparent bg-clip-text bg-gradient-to-b from-white/[0.09] to-transparent -mb-[3vw]">
        QueueFlush
      </div>
    </footer>
  );
};
