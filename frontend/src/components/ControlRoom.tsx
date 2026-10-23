import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  TrafficCone,
  Calculator,
  Ambulance,
  ScrollText,
  Siren,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  UserCheck,
  UserX,
  Plus,
  X,
  Copy,
  Check,
  Flame,
  Activity,
  Clock,
} from 'lucide-react';
import {
  getAdminDevices,
  getAdminAuditLogs,
  toggleDeviceActive,
  addAdminDevice,
  triggerAdminOverride,
  getStats,
  getCorridors,
  simulateCorridor,
  predict,
} from '../api';
import type {
  AdminUser,
  AuditLog,
  EmergencyDevice,
  Corridor,
  CorridorSimResult,
  StatsResponse,
  PredictResponse,
  WeatherType,
  SystemOverrideResponse,
} from '../types';
import { BrandMark } from './Navbar';

type Tab = 'overview' | 'junctions' | 'decision' | 'fleet' | 'audit' | 'override';

const NAV: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'junctions', label: 'Junctions', icon: TrafficCone },
  { key: 'decision', label: 'Decision check', icon: Calculator },
  { key: 'fleet', label: 'Fleet', icon: Ambulance },
  { key: 'audit', label: 'Audit log', icon: ScrollText },
  { key: 'override', label: 'Manual override', icon: Siren },
];

// ── helpers ────────────────────────────────────────────────────────────────
const EVENT_META: Record<string, { label: string; tone: 'red' | 'green' | 'amber' | 'plum' | 'gray'; icon: typeof ShieldAlert }> = {
  REJECTED_TOKEN: { label: 'Spoof blocked', tone: 'red', icon: ShieldAlert },
  AUTH_FAILED: { label: 'Failed sign-in', tone: 'amber', icon: UserX },
  AUTH_GRANTED: { label: 'Signed in', tone: 'green', icon: UserCheck },
  DEVICE_ADDED: { label: 'Vehicle added', tone: 'plum', icon: KeyRound },
  DEVICE_UPDATED: { label: 'Vehicle updated', tone: 'plum', icon: KeyRound },
  MANUAL_OVERRIDE: { label: 'Override', tone: 'red', icon: Siren },
  FAILSAFE: { label: 'Fail-safe', tone: 'amber', icon: ShieldAlert },
  HOLD: { label: 'Pedestrian hold', tone: 'amber', icon: ShieldCheck },
  PED_SAFETY_HOLD: { label: 'Pedestrian hold', tone: 'amber', icon: ShieldCheck },
  PARTIAL_FLUSH: { label: 'Partial flush', tone: 'gray', icon: Activity },
};
const toneCls = {
  red: 'bg-red-50 text-red-700 ring-red-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  plum: 'bg-[#F5E6EF] text-[#5E1B48] ring-[#EBCADC]',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
};
const meta = (type: string) => EVENT_META[type] ?? { label: type.replace(/_/g, ' ').toLowerCase(), tone: 'gray' as const, icon: Activity };

function timeAgo(iso?: string | null) {
  if (!iso) return 'seeded';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

const Card: React.FC<{ title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, action, children, className = '' }) => (
  <section className={`bg-white rounded-xl border border-[#EDE3E9] ${className}`}>
    {title && (
      <header className="flex items-center justify-between px-5 py-4 border-b border-[#F3ECF0]">
        <h2 className="font-semibold text-[#1F0A18]">{title}</h2>
        {action}
      </header>
    )}
    {children}
  </section>
);

const Pill: React.FC<{ tone: keyof typeof toneCls; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${toneCls[tone]}`}>{children}</span>
);

// ── main component ─────────────────────────────────────────────────────────
export const ControlRoom: React.FC<{ profile: AdminUser | null; onLogout: () => void; onSessionExpired: () => void }> = ({
  profile,
  onLogout,
  onSessionExpired,
}) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [devices, setDevices] = useState<EmergencyDevice[]>([]);
  const [logs, setLogs] = useState<(AuditLog & { created_at?: string | null })[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorSlug, setCorridorSlug] = useState('hospital-corridor-a');
  const [corridor, setCorridor] = useState<CorridorSimResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [override, setOverride] = useState<SystemOverrideResponse | null>(null);
  const [overrideLeft, setOverrideLeft] = useState(0);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [d, l] = await Promise.all([getAdminDevices(), getAdminAuditLogs()]);
      setDevices(d);
      setLogs(l as any);
    } catch {
      onSessionExpired();
      return;
    } finally {
      setRefreshing(false);
    }
    getStats().then(setStats);
  }, [onSessionExpired]);

  useEffect(() => {
    load();
    getCorridors().then((c) => c.length && setCorridors(c));
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    simulateCorridor({ corridor_slug: corridorSlug }).then(setCorridor);
  }, [corridorSlug]);

  useEffect(() => {
    if (overrideLeft <= 0) return;
    const id = setTimeout(() => {
      setOverrideLeft((s) => s - 1);
      if (overrideLeft === 1) setOverride(null);
    }, 1000);
    return () => clearTimeout(id);
  }, [overrideLeft]);

  const activeCount = devices.filter((d) => d.active).length;
  const blocked = logs.filter((l) => l.type === 'REJECTED_TOKEN').length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-[calc(100vh-76px)] bg-[#FAF7F9] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[#EDE3E9] bg-white">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-[#F3ECF0]">
          <BrandMark className="w-8 h-8" animated={false} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[#1F0A18]">Control room</div>
            <div className="text-xs text-[#7A6B76]">Traffic control centre</div>
          </div>
        </div>
        <nav className="p-3 space-y-0.5 flex-1">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                tab === key ? 'text-[#5E1B48] font-semibold' : 'text-[#5B4A57] hover:bg-[#FBF4F8]'
              }`}
            >
              {tab === key && (
                <motion.span layoutId="cr-active" className="absolute inset-0 rounded-lg bg-[#F5E6EF]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
              )}
              <Icon className="relative w-4 h-4" />
              <span className="relative">{label}</span>
              {key === 'audit' && blocked > 0 && <span className="relative ml-auto text-[11px] font-semibold text-red-600">{blocked}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[#F3ECF0]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-[#5E1B48] text-white text-xs font-semibold flex items-center justify-center">
              {(profile?.full_name || 'CR').split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[#1F0A18] truncate">{profile?.full_name || 'Supervisor'}</div>
              <div className="text-xs text-[#7A6B76] truncate">{profile?.username}</div>
            </div>
            <button onClick={onLogout} title="Sign out" className="p-1.5 rounded-md text-[#7A6B76] hover:bg-[#F7F0F4] hover:text-[#5E1B48] cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* mobile tabs */}
        <div className="lg:hidden flex gap-1 overflow-x-auto px-4 pt-4">
          {NAV.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm cursor-pointer ${tab === key ? 'bg-[#5E1B48] text-white' : 'bg-white border border-[#EDE3E9] text-[#5B4A57]'}`}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {override && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-red-600 text-white px-6 py-2.5 text-sm flex items-center gap-3">
                <Siren className="w-4 h-4 animate-pulse" />
                <span className="font-semibold">Manual override active</span>
                <span className="text-white/80">All corridor signals held green · {overrideLeft}s left · authorised by {override.authorized_by}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4 sm:px-8 py-7 max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#1F0A18] tracking-tight">
                {tab === 'overview' ? greeting : NAV.find((n) => n.key === tab)?.label}
              </h1>
              <p className="text-sm text-[#7A6B76] mt-0.5">
                {tab === 'overview' && 'Live status of the preemption network.'}
                {tab === 'junctions' && 'Queue sizes and expected ambulance delay at each signal on a corridor.'}
                {tab === 'decision' && 'Check exactly what the engine would decide for a given approach.'}
                {tab === 'fleet' && 'Vehicles allowed to request a green light.'}
                {tab === 'audit' && 'Every sign-in, spoof attempt and admin action, newest first.'}
                {tab === 'override' && 'Force a corridor green when an incident needs it. Every use is audited.'}
              </p>
            </div>
            <button onClick={load} className="inline-flex items-center gap-2 text-sm text-[#5B4A57] px-3 py-1.5 rounded-lg border border-[#EDE3E9] bg-white hover:bg-[#FBF4F8] cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {tab === 'overview' && (
                <Overview
                  stats={stats}
                  activeCount={activeCount}
                  totalDevices={devices.length}
                  blocked={blocked}
                  override={override}
                  overrideLeft={overrideLeft}
                  logs={logs}
                  corridor={corridor}
                  onGo={setTab}
                />
              )}
              {tab === 'junctions' && (
                <Junctions corridors={corridors} slug={corridorSlug} setSlug={setCorridorSlug} data={corridor} override={!!override} />
              )}
              {tab === 'decision' && <DecisionCheck />}
              {tab === 'fleet' && <Fleet devices={devices} setDevices={setDevices} onChanged={load} />}
              {tab === 'audit' && <Audit logs={logs} />}
              {tab === 'override' && (
                <Override
                  active={override}
                  left={overrideLeft}
                  onStart={async (duration, reason) => {
                    const res = await triggerAdminOverride({ scope: 'ALL_JUNCTIONS', action: 'FORCE_CASCADE_GREEN', duration_s: duration, reason });
                    setOverride(res);
                    setOverrideLeft(duration);
                    load();
                  }}
                  onCancel={() => {
                    setOverride(null);
                    setOverrideLeft(0);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

// ── Overview ───────────────────────────────────────────────────────────────
const Overview: React.FC<{
  stats: StatsResponse | null;
  activeCount: number;
  totalDevices: number;
  blocked: number;
  override: SystemOverrideResponse | null;
  overrideLeft: number;
  logs: (AuditLog & { created_at?: string | null })[];
  corridor: CorridorSimResult | null;
  onGo: (t: Tab) => void;
}> = ({ stats, activeCount, totalDevices, blocked, override, overrideLeft, logs, corridor, onGo }) => {
  const kpis = [
    { label: 'Vehicles authorised', value: `${activeCount}`, sub: `of ${totalDevices} registered`, icon: Ambulance },
    { label: 'Avg wait removed', value: stats ? `${stats.avg_ambulance_wait_eliminated_s.toFixed(1)}s` : '—', sub: 'per junction, engine runs', icon: Clock },
    { label: 'Best corridor gain', value: stats ? `${stats.best_corridor_gain_s.toFixed(0)}s` : '—', sub: '5-junction green wave', icon: Activity },
    { label: 'Spoof attempts blocked', value: `${blocked}`, sub: 'in the last 50 events', icon: ShieldAlert, warn: blocked > 0 },
  ];
  const junctions = corridor?.predictive.junction_metrics ?? [];
  const conv = corridor?.conventional.junction_metrics ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-xl border border-[#EDE3E9] p-5">
            <div className="flex items-center justify-between text-sm text-[#7A6B76]">
              {k.label}
              <k.icon className={`w-4 h-4 ${k.warn ? 'text-red-500' : 'text-[#A8487F]'}`} />
            </div>
            <div className={`mt-2 text-3xl font-semibold tracking-tight ${k.warn ? 'text-red-600' : 'text-[#1F0A18]'}`}>{k.value}</div>
            <div className="text-xs text-[#7A6B76] mt-1">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card title="Hospital Corridor A" className="lg:col-span-3" action={<button onClick={() => onGo('junctions')} className="text-sm text-[#5E1B48] font-medium hover:underline cursor-pointer">All junctions</button>}>
          <div className="p-5">
            {override && (
              <div className="mb-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">Override active — signals held green for {overrideLeft}s.</div>
            )}
            <div className="flex items-start justify-between gap-2">
              {junctions.map((j, i) => {
                const saved = (conv[i]?.wait_s ?? 0) - j.wait_s;
                return (
                  <div key={j.code} className="flex-1 flex flex-col items-center text-center">
                    <div className="relative w-full flex items-center">
                      <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : 'bg-[#EBCADC]'}`} />
                      <motion.span
                        className="w-4 h-4 rounded-full ring-4 ring-white"
                        animate={{ backgroundColor: override ? '#22C55E' : ['#EF4444', '#EF4444', '#22C55E', '#22C55E'] }}
                        transition={override ? {} : { duration: 6, times: [0, 0.15 + i * 0.12, 0.17 + i * 0.12, 1], repeat: Infinity }}
                      />
                      <div className={`h-0.5 flex-1 ${i === junctions.length - 1 ? 'opacity-0' : 'bg-[#EBCADC]'}`} />
                    </div>
                    <div className="mt-2 text-xs font-medium text-[#1F0A18] leading-tight line-clamp-2 px-1">{j.name}</div>
                    <div className="text-xs text-[#7A6B76] mt-1">{j.queue_n} queued</div>
                    <div className="text-xs font-semibold text-emerald-600">−{saved.toFixed(1)}s</div>
                  </div>
                );
              })}
            </div>
            {corridor && (
              <div className="mt-6 grid grid-cols-3 text-sm border-t border-[#F3ECF0] pt-4">
                <div>
                  <div className="text-[#7A6B76] text-xs">Normal signals</div>
                  <div className="font-semibold text-[#1F0A18]">{corridor.conventional.total_time_s.toFixed(0)}s</div>
                </div>
                <div>
                  <div className="text-[#7A6B76] text-xs">With QueueFlush</div>
                  <div className="font-semibold text-[#5E1B48]">{corridor.predictive.total_time_s.toFixed(0)}s</div>
                </div>
                <div>
                  <div className="text-[#7A6B76] text-xs">Saved per trip</div>
                  <div className="font-semibold text-emerald-600">{corridor.predictive.time_saved_s.toFixed(0)}s</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Recent activity" className="lg:col-span-2" action={<button onClick={() => onGo('audit')} className="text-sm text-[#5E1B48] font-medium hover:underline cursor-pointer">View log</button>}>
          <ul className="divide-y divide-[#F3ECF0]">
            {logs.slice(0, 6).map((l) => {
              const m = meta(l.type);
              return (
                <li key={l.id} className="px-5 py-3 flex gap-3">
                  <span className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center ring-1 ring-inset ${toneCls[m.tone]}`}>
                    <m.icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-[#1F0A18]"><span className="font-medium">{m.label}</span></div>
                    <div className="text-xs text-[#7A6B76] truncate">{l.detail}</div>
                  </div>
                  <span className="ml-auto text-xs text-[#9C8E98] shrink-0">{timeAgo(l.created_at)}</span>
                </li>
              );
            })}
            {logs.length === 0 && <li className="px-5 py-8 text-sm text-center text-[#7A6B76]">No events yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
};

// ── Junctions ──────────────────────────────────────────────────────────────
const Junctions: React.FC<{ corridors: Corridor[]; slug: string; setSlug: (s: string) => void; data: CorridorSimResult | null; override: boolean }> = ({ corridors, slug, setSlug, data, override }) => {
  const pred = data?.predictive.junction_metrics ?? [];
  const conv = data?.conventional.junction_metrics ?? [];
  const max = Math.max(1, ...conv.map((c) => c.wait_s));
  return (
    <Card
      title="Signals on corridor"
      action={
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="text-sm border border-[#EDE3E9] rounded-lg px-2.5 py-1.5 bg-white cursor-pointer outline-none focus:border-[#5E1B48]">
          {(corridors.length ? corridors : [{ slug: 'hospital-corridor-a', name: 'Hospital Corridor A' } as Corridor]).map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#7A6B76] border-b border-[#F3ECF0]">
              <th className="font-medium px-5 py-3">Junction</th>
              <th className="font-medium px-5 py-3">Signal</th>
              <th className="font-medium px-5 py-3">Queue</th>
              <th className="font-medium px-5 py-3 w-[36%]">Ambulance wait — normal vs QueueFlush</th>
              <th className="font-medium px-5 py-3 text-right">Crossing time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3ECF0]">
            {pred.map((j, i) => {
              const c = conv[i];
              return (
                <tr key={j.code} className="hover:bg-[#FCFAFB]">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-[#1F0A18]">{j.name}</div>
                    <div className="text-xs text-[#7A6B76]">{j.code}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {override ? <Pill tone="green">Held green</Pill> : <Pill tone="gray">Normal cycle</Pill>}
                  </td>
                  <td className="px-5 py-3.5 text-[#3F3340]">{j.queue_n} vehicles</td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${((c?.wait_s ?? 0) / max) * 100}%` }} />
                        <span className="text-xs text-[#7A6B76] shrink-0">{(c?.wait_s ?? 0).toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-[#5E1B48]" style={{ width: `${Math.max(1, (j.wait_s / max) * 100)}%` }} />
                        <span className="text-xs text-[#5E1B48] font-medium shrink-0">{j.wait_s.toFixed(1)}s</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-[#3F3340]">
                    {(c?.crossing_s ?? 0).toFixed(1)}s → <span className="font-semibold text-[#5E1B48]">{j.crossing_s.toFixed(1)}s</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ── Decision check ─────────────────────────────────────────────────────────
const DecisionCheck: React.FC = () => {
  const [p, setP] = useState({ N: 8, t_delay: 0.8, t_margin: 1.0, weather: 'dry' as WeatherType, heavy_count: 1, distance_m: 300, speed_kmh: 110, ped_active: false, ped_remaining_s: 2 });
  const [res, setRes] = useState<PredictResponse | null>(null);
  useEffect(() => {
    const id = setTimeout(() => predict(p).then(setRes), 150);
    return () => clearTimeout(id);
  }, [p]);
  const set = (k: keyof typeof p, v: number | boolean | string) => setP((o) => ({ ...o, [k]: v }));
  const r: any = res;
  const action = r?.safety?.action ?? (r?.partial_flush ? 'PARTIAL_FLUSH' : r?.safety?.approved === false ? 'HOLD' : 'PROCEED');
  const verdict =
    p.ped_active && p.ped_remaining_s < 3
      ? { tone: 'amber' as const, title: 'Hold for pedestrians', body: `People are still crossing (${p.ped_remaining_s.toFixed(1)}s left). Green waits until they clear.` }
      : r?.partial_flush
      ? { tone: 'amber' as const, title: 'Partial flush now', body: 'The ambulance is too close to clear the whole queue, so green fires immediately.' }
      : { tone: 'green' as const, title: `Early green in ${(r?.t_trigger ?? 0).toFixed(1)}s`, body: 'The queue will be moving before the ambulance reaches it — no stop needed.' };

  const Slider = ({ label, k, min, max, step, unit }: { label: string; k: keyof typeof p; min: number; max: number; step: number; unit: string }) => (
    <label className="block">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-[#3F3340]">{label}</span>
        <span className="font-medium text-[#1F0A18]">{(p[k] as number).toFixed(step < 1 ? 1 : 0)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={p[k] as number} onChange={(e) => set(k, +e.target.value)} className="w-full cursor-pointer" />
    </label>
  );

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <Card title="Approach" className="lg:col-span-2">
        <div className="p-5 space-y-5">
          <Slider label="Vehicles queued" k="N" min={1} max={15} step={1} unit="" />
          <Slider label="Buses / trucks" k="heavy_count" min={0} max={Math.min(4, p.N)} step={1} unit="" />
          <Slider label="Driver reaction" k="t_delay" min={0.4} max={1.6} step={0.1} unit="s" />
          <Slider label="Ambulance distance" k="distance_m" min={60} max={600} step={10} unit="m" />
          <Slider label="Ambulance speed" k="speed_kmh" min={40} max={140} step={5} unit="km/h" />
          <div>
            <div className="text-sm text-[#3F3340] mb-2">Weather</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F0F4] rounded-lg">
              {(['dry', 'wet', 'fog'] as WeatherType[]).map((w) => (
                <button key={w} onClick={() => set('weather', w)} className={`py-1.5 rounded-md text-sm capitalize cursor-pointer ${p.weather === w ? 'bg-white shadow-sm text-[#5E1B48] font-medium' : 'text-[#7A6B76]'}`}>{w}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between text-sm text-[#3F3340] cursor-pointer">
            Pedestrians crossing
            <input type="checkbox" checked={p.ped_active} onChange={(e) => set('ped_active', e.target.checked)} className="w-4 h-4 accent-[#5E1B48]" />
          </label>
          {p.ped_active && <Slider label="Walk time left" k="ped_remaining_s" min={0} max={10} step={0.5} unit="s" />}
        </div>
      </Card>

      <div className="lg:col-span-3 space-y-6">
        <motion.div layout className={`rounded-xl p-5 ring-1 ring-inset ${toneCls[verdict.tone]}`}>
          <div className="text-xs font-medium opacity-80">Engine decision · {String(action).replace('_', ' ').toLowerCase()}</div>
          <div className="text-xl font-semibold mt-1">{verdict.title}</div>
          <div className="text-sm mt-1 opacity-90">{verdict.body}</div>
        </motion.div>

        <Card title="How it was worked out">
          <div className="p-5 space-y-4 text-sm">
            {[
              ['Effective reaction', `${p.t_delay.toFixed(1)}s × ${(r?.weather_factor ?? 1).toFixed(2)} (${p.weather})`, `${(r?.effective_t_delay ?? 0).toFixed(2)}s`],
              ['Queue clear time', `(${p.N} − 1) × ${(r?.effective_t_delay ?? 0).toFixed(2)} + ${p.t_margin.toFixed(1)} + ${(r?.heavy_extra_s ?? r?.heavy_adjustment_s ?? 0).toFixed(1)} heavy`, `${(r?.t_clear ?? 0).toFixed(2)}s`],
              ['Ambulance arrival', `${p.distance_m} m ÷ ${(p.speed_kmh / 3.6).toFixed(1)} m/s`, `${(r?.eta ?? 0).toFixed(2)}s`],
              ['Green fires at', 'arrival − clear time', `${(r?.t_trigger ?? 0).toFixed(2)}s`],
            ].map(([a, b, c], i) => (
              <div key={a} className="flex items-center gap-4">
                <span className="w-6 h-6 shrink-0 rounded-full bg-[#F5E6EF] text-[#5E1B48] text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#1F0A18]">{a}</div>
                  <div className="text-xs text-[#7A6B76] font-mono truncate">{b}</div>
                </div>
                <div className="font-semibold text-[#1F0A18] font-mono">{c}</div>
              </div>
            ))}
            {r?.conventional_wait_s !== undefined && (
              <div className="pt-4 mt-2 border-t border-[#F3ECF0] flex justify-between">
                <span className="text-[#7A6B76]">Wait with normal signals</span>
                <span className="font-semibold text-red-600">{r.conventional_wait_s.toFixed(1)}s</span>
              </div>
            )}
          </div>
        </Card>

        {r?.safety?.reasons?.length > 0 && (
          <Card title="Safety checks">
            <ul className="p-5 space-y-2 text-sm">
              {r.safety.reasons.map((x: string) => (
                <li key={x} className="flex gap-2 text-[#3F3340]">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                  {x}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};

// ── Fleet ──────────────────────────────────────────────────────────────────
const Fleet: React.FC<{ devices: EmergencyDevice[]; setDevices: React.Dispatch<React.SetStateAction<EmergencyDevice[]>>; onChanged: () => void }> = ({ devices, setDevices, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ device_id: '', vehicle_type: 'ambulance', reg_no: '' });
  const [newKey, setNewKey] = useState<EmergencyDevice | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async (d: EmergencyDevice) => {
    const u = await toggleDeviceActive(d.device_id, !d.active);
    setDevices((prev) => prev.map((x) => (x.device_id === d.device_id ? { ...x, active: u.active } : x)));
    onChanged();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const created = await addAdminDevice(form);
      setNewKey(created);
      setOpen(false);
      setForm({ device_id: '', vehicle_type: 'ambulance', reg_no: '' });
      onChanged();
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail || 'Could not register vehicle');
    }
  };

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {newKey && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-[#FBF4F8] ring-1 ring-[#EBCADC] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold text-[#1F0A18]">{newKey.device_id} registered</div>
                <div className="text-sm text-[#5B4A57]">Copy this signing key into the vehicle's on-board unit now. It won't be shown again.</div>
                <code className="mt-2 block text-xs bg-white rounded-md px-3 py-2 ring-1 ring-[#EBCADC] break-all">{newKey.secret_key}</code>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { navigator.clipboard?.writeText(newKey.secret_key); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="p-2 rounded-md hover:bg-white cursor-pointer" title="Copy">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#5E1B48]" />}
                </button>
                <button onClick={() => setNewKey(null)} className="p-2 rounded-md hover:bg-white cursor-pointer" title="Dismiss"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card title={`${devices.length} vehicles`} action={
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#5E1B48] hover:bg-[#48133A] text-white px-3 py-1.5 rounded-lg cursor-pointer">
          <Plus className="w-4 h-4" /> Add vehicle
        </button>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#7A6B76] border-b border-[#F3ECF0]">
                <th className="font-medium px-5 py-3">Vehicle</th>
                <th className="font-medium px-5 py-3">Registration</th>
                <th className="font-medium px-5 py-3">Signing key</th>
                <th className="font-medium px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3ECF0]">
              {devices.map((d) => {
                const fire = d.vehicle_type.startsWith('fire');
                return (
                  <tr key={d.device_id} className="hover:bg-[#FCFAFB]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${fire ? 'bg-orange-50 text-orange-600' : 'bg-[#F5E6EF] text-[#5E1B48]'}`}>
                          {fire ? <Flame className="w-4 h-4" /> : <Ambulance className="w-4 h-4" />}
                        </span>
                        <div>
                          <div className="font-medium text-[#1F0A18]">{d.device_id}</div>
                          <div className="text-xs text-[#7A6B76] capitalize">{d.vehicle_type.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#3F3340]">{d.reg_no}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#7A6B76]">{d.secret_key}</td>
                    <td className="px-5 py-3.5">{d.active ? <Pill tone="green">Authorised</Pill> : <Pill tone="red">Revoked</Pill>}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => toggle(d)} className={`text-sm font-medium cursor-pointer hover:underline ${d.active ? 'text-red-600' : 'text-emerald-700'}`}>
                        {d.active ? 'Revoke' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.form onSubmit={submit} onClick={(e) => e.stopPropagation()} initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
              className="bg-white rounded-xl w-full max-w-md shadow-2xl">
              <div className="px-5 py-4 border-b border-[#F3ECF0] flex items-center justify-between">
                <h3 className="font-semibold text-[#1F0A18]">Add vehicle</h3>
                <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-[#F7F0F4] cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-4 text-sm">
                {err && <div className="text-red-700 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
                <label className="block">
                  <span className="text-[#3F3340]">Device ID</span>
                  <input required value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value.toUpperCase() })} placeholder="AMB-05"
                    className="mt-1.5 w-full border border-[#E6DCE2] rounded-lg px-3 py-2 outline-none focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10" />
                </label>
                <label className="block">
                  <span className="text-[#3F3340]">Type</span>
                  <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                    className="mt-1.5 w-full border border-[#E6DCE2] rounded-lg px-3 py-2 bg-white outline-none focus:border-[#5E1B48]">
                    <option value="ambulance">Ambulance</option>
                    <option value="fire_engine">Fire tender</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[#3F3340]">Registration number</span>
                  <input required value={form.reg_no} onChange={(e) => setForm({ ...form, reg_no: e.target.value.toUpperCase() })} placeholder="TN 49 AB 9988"
                    className="mt-1.5 w-full border border-[#E6DCE2] rounded-lg px-3 py-2 outline-none focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10" />
                </label>
                <p className="text-xs text-[#7A6B76]">A signing key is generated on the server and shown once.</p>
              </div>
              <div className="px-5 py-4 border-t border-[#F3ECF0] flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg text-sm text-[#5B4A57] hover:bg-[#F7F0F4] cursor-pointer">Cancel</button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5E1B48] hover:bg-[#48133A] text-white cursor-pointer">Register</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Audit log ──────────────────────────────────────────────────────────────
const FILTERS: { key: string; label: string; match: (t: string) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'security', label: 'Security', match: (t) => ['REJECTED_TOKEN', 'AUTH_FAILED'].includes(t) },
  { key: 'access', label: 'Sign-ins', match: (t) => t.startsWith('AUTH') },
  { key: 'admin', label: 'Admin actions', match: (t) => ['DEVICE_ADDED', 'DEVICE_UPDATED', 'MANUAL_OVERRIDE'].includes(t) },
  { key: 'safety', label: 'Safety', match: (t) => ['FAILSAFE', 'HOLD', 'PED_SAFETY_HOLD', 'PARTIAL_FLUSH'].includes(t) },
];

const Audit: React.FC<{ logs: (AuditLog & { created_at?: string | null })[] }> = ({ logs }) => {
  const [f, setF] = useState('all');
  const filter = FILTERS.find((x) => x.key === f)!;
  const rows = useMemo(() => logs.filter((l) => filter.match(l.type)), [logs, filter]);
  return (
    <Card
      title={`${rows.length} events`}
      action={
        <div className="flex gap-1 p-1 bg-[#F7F0F4] rounded-lg">
          {FILTERS.map((x) => (
            <button key={x.key} onClick={() => setF(x.key)} className={`px-2.5 py-1 rounded-md text-xs cursor-pointer ${f === x.key ? 'bg-white shadow-sm text-[#5E1B48] font-medium' : 'text-[#7A6B76]'}`}>{x.label}</button>
          ))}
        </div>
      }
    >
      <ul className="divide-y divide-[#F3ECF0]">
        {rows.map((l) => {
          const m = meta(l.type);
          return (
            <li key={l.id} className="px-5 py-3 flex items-center gap-4">
              <span className="w-32 shrink-0"><Pill tone={m.tone}><m.icon className="w-3 h-3" />{m.label}</Pill></span>
              <span className="text-sm text-[#3F3340] flex-1 min-w-0 truncate">{l.detail}</span>
              <span className="text-xs text-[#9C8E98] shrink-0">{timeAgo(l.created_at)}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-5 py-10 text-sm text-center text-[#7A6B76]">Nothing here.</li>}
      </ul>
    </Card>
  );
};

// ── Override ───────────────────────────────────────────────────────────────
const Override: React.FC<{ active: SystemOverrideResponse | null; left: number; onStart: (d: number, reason: string) => Promise<void>; onCancel: () => void }> = ({ active, left, onStart, onCancel }) => {
  const [duration, setDuration] = useState(45);
  const [reason, setReason] = useState('Multi-casualty incident on Hospital Road');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (active) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="relative flex w-3 h-3"><span className="absolute inset-0 rounded-full bg-red-500 animate-ping" /><span className="relative w-3 h-3 rounded-full bg-red-600" /></span>
            <h2 className="text-lg font-semibold text-[#1F0A18]">Override running — {left}s left</h2>
          </div>
          <p className="text-sm text-[#5B4A57] mt-1">Signals below are held green. Authorised by {active.authorized_by}, until {active.active_until}.</p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm">
            {active.affected_junctions.map((j) => (
              <li key={j} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800"><span className="w-2 h-2 rounded-full bg-emerald-500" />{j}</li>
            ))}
          </ul>
          <button onClick={onCancel} className="mt-5 text-sm font-medium px-4 py-2 rounded-lg border border-[#EDE3E9] hover:bg-[#F7F0F4] cursor-pointer">End override</button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6 max-w-xl space-y-5">
        <div className="flex gap-3 text-sm text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          This bypasses the predictive engine and holds every corridor signal green. Cross traffic still gets its yellow and all-red interval first.
        </div>
        <label className="block text-sm">
          <span className="text-[#3F3340]">Duration</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1 p-1 bg-[#F7F0F4] rounded-lg">
            {[30, 45, 90, 120].map((d) => (
              <button type="button" key={d} onClick={() => setDuration(d)} className={`py-1.5 rounded-md cursor-pointer ${duration === d ? 'bg-white shadow-sm text-[#5E1B48] font-medium' : 'text-[#7A6B76]'}`}>{d}s</button>
            ))}
          </div>
        </label>
        <label className="block text-sm">
          <span className="text-[#3F3340]">Reason (saved to audit log)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5 w-full border border-[#E6DCE2] rounded-lg px-3 py-2 outline-none focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10" />
        </label>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} disabled={!reason.trim()} className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50">
            Start override
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#3F3340]">Hold all signals green for {duration}s?</span>
            <button disabled={busy} onClick={async () => { setBusy(true); await onStart(duration, reason); setBusy(false); setConfirm(false); }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white cursor-pointer">Yes, start</button>
            <button onClick={() => setConfirm(false)} className="px-3 py-2 rounded-lg text-sm text-[#5B4A57] hover:bg-[#F7F0F4] cursor-pointer">Cancel</button>
          </div>
        )}
      </div>
    </Card>
  );
};
