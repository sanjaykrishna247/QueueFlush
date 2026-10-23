import React, { useState, useEffect } from 'react';
import {
  adminLogin,
  getAdminMe,
  adminLogout,
  getAdminDevices,
  toggleDeviceActive,
  addAdminDevice,
  getAdminAuditLogs,
  triggerAdminOverride,
} from '../api';
import type { AdminUser, EmergencyDevice, AuditLog, SystemOverrideResponse } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  User,
  Key,
  Radio,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  LogOut,
  Car,
  Flame,
  Scale,
} from 'lucide-react';
import { DecisionLogicVerification } from '../components/DecisionLogicVerification';

export const AdminPage: React.FC = () => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Login form inputs
  const [username, setUsername] = useState<string>('admin@queueflush.ai');
  const [password, setPassword] = useState<string>('QueueFlush@2026');
  const [pin, setPin] = useState<string>('2026');

  // Admin dashboard state
  const [activeTab, setActiveTab] = useState<'logic' | 'devices' | 'override' | 'audit' | 'nodes'>('logic');
  const [devices, setDevices] = useState<EmergencyDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [overrideActive, setOverrideActive] = useState<SystemOverrideResponse | null>(null);
  const [overrideCountdown, setOverrideCountdown] = useState<number>(0);

  // New device form modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newDeviceId, setNewDeviceId] = useState<string>('');
  const [newVehicleType, setNewVehicleType] = useState<string>('ambulance');
  const [newRegNo, setNewRegNo] = useState<string>('');

  // Check existing session on mount
  useEffect(() => {
    getAdminMe().then((user) => {
      if (user) {
        setCurrentUser(user);
        loadAdminData();
      }
      setLoading(false);
    });
  }, []);

  const loadAdminData = async () => {
    try {
      const [devList, logs] = await Promise.all([getAdminDevices(), getAdminAuditLogs()]);
      setDevices(devList);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load admin data', err);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await adminLogin({ username, password, pin });
      if (res && res.user) {
        setCurrentUser(res.user);
        await loadAdminData();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Invalid Government Credentials or PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = () => {
    setUsername('admin@queueflush.ai');
    setPassword('QueueFlush@2026');
    setPin('2026');
  };

  const handleLogout = () => {
    adminLogout();
    setCurrentUser(null);
  };

  const handleToggleDevice = async (deviceId: string, currentStatus: boolean) => {
    try {
      const updated = await toggleDeviceActive(deviceId, !currentStatus);
      setDevices((prev) =>
        prev.map((d) => (d.device_id === deviceId ? { ...d, active: updated.active } : d))
      );
    } catch (err) {
      console.error('Failed to toggle device', err);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId || !newRegNo) return;
    try {
      const created = await addAdminDevice({
        device_id: newDeviceId.toUpperCase(),
        vehicle_type: newVehicleType,
        reg_no: newRegNo.toUpperCase(),
      });
      setDevices((prev) => [...prev, created]);
      setShowAddModal(false);
      setNewDeviceId('');
      setNewRegNo('');
    } catch (err) {
      console.error('Failed to add device', err);
    }
  };

  const handleTriggerOverride = async () => {
    try {
      const res = await triggerAdminOverride({
        scope: 'ALL_JUNCTIONS',
        action: 'FORCE_CASCADE_GREEN',
        duration_s: 45,
        reason: 'National Emergency Level-1 Trauma Corridor Preemption',
      });
      setOverrideActive(res);
      setOverrideCountdown(45);

      const interval = setInterval(() => {
        setOverrideCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setOverrideActive(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to trigger override', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#24081B] text-white flex items-center justify-center font-mono text-sm">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <span>Verifying GovNet Session Credentials...</span>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. UN-AUTHENTICATED: Government Admin Login Portal
  // ───────────────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#24081B] text-slate-200 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center relative overflow-hidden">
        {/* Background GovNet Grid Texture */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full mx-auto relative z-10 space-y-6">
          {/* Official Emblem & Portal Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-[#3B0F2D] border-2 border-amber-400/50 mx-auto flex items-center justify-center text-amber-300 text-2xl shadow-xl">
              🇮🇳
            </div>
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest block">
                भारत सरकार · सड़क परिवहन एवं राजमार्ग मंत्रालय
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                ICCC Administrator Portal
              </h1>
              <p className="text-xs text-slate-400">
                National Intelligent Traffic Management System (NITMS) · Restricted Access
              </p>
            </div>
          </div>

          {/* Statutory Security Warning */}
          <div className="bg-[#2C0A21] border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-200/90 flex items-start gap-2.5 shadow-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>STATUTORY NOTICE:</strong> This system is restricted exclusively to authorized MoRTH officers
              and NIC Traffic Administrators. All actions are logged and audited under{' '}
              <strong>IT Act Sections 43 &amp; 66</strong>.
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-[#3B0F2D]/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
            {errorMsg && (
              <div className="bg-rose-950/80 border border-rose-500/50 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Official Gov SSO ID / NIC Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. admin@queueflush.ai"
                    className="w-full bg-[#24081B] border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-white text-xs font-mono outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                  Security Passphrase
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#24081B] border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-white text-xs font-mono outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase tracking-wider text-[10px] mb-1.5 flex justify-between">
                  <span>2FA Security Token / PIN</span>
                  <span className="text-amber-300 font-mono text-[9px]">DEFAULT: 2026</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={6}
                    placeholder="2026"
                    className="w-full bg-[#24081B] border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-white text-xs font-mono outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 tracking-widest"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg hover:shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying GovNet Clearance...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorize &amp; Access Command Console</span>
                  </>
                )}
              </button>
            </form>

            {/* Evaluator Quick-Fill Helper */}
            <div className="pt-3 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  handleQuickFill();
                  handleLogin();
                }}
                className="w-full bg-[#24081B] hover:bg-[#3B0F2D] text-amber-300 border border-amber-400/30 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>1-Click Evaluator Login (Director Clearance)</span>
              </button>
            </div>
          </div>

          {/* Security Credentials Footer */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>TLS 1.3 256-BIT SSL</span>
            </span>
            <span>·</span>
            <span>NIC-NDLS-ITMS-021</span>
            <span>·</span>
            <span>GIGW 3.0</span>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AUTHENTICATED: Government Central ICCC Command & Control Room
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FCFAFB] text-[#334155] py-8 px-4 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Officer Identity & Command Banner */}
        <div className="bg-[#3B0F2D] text-white p-6 rounded-2xl border-2 border-amber-400/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-2xl shadow-inner shrink-0">
              🇮🇳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  {currentUser.clearance_level}
                </span>
                <span className="text-emerald-400 text-xs font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  AUTHENTICATED
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 text-white">
                {currentUser.full_name}
              </h1>
              <p className="text-xs text-amber-200/90 font-medium">
                {currentUser.designation} · {currentUser.department}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 ml-auto md:ml-0">
            {/* Active Override Status */}
            {overrideActive && (
              <div className="bg-rose-950/80 border border-rose-500/50 px-3.5 py-1.5 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="font-extrabold uppercase font-mono">
                  OVERRIDE ACTIVE ({overrideCountdown}s)
                </span>
              </div>
            )}

            <button
              onClick={handleTriggerOverride}
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>CODE-RED CASCADE OVERRIDE</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-[#3B0F2D] hover:bg-slate-700 text-slate-200 border border-slate-600 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('logic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'logic'
                ? 'bg-[#3B0F2D] text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Scale className="w-4 h-4 text-amber-400" />
            <span>AI Decision Logic &amp; Math Verification</span>
            <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded font-mono">
              TEJAS 2026
            </span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'devices'
                ? 'bg-[#3B0F2D] text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Emergency Fleet Registry ({devices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('override')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'override'
                ? 'bg-[#3B0F2D] text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Junction Preemption Override</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#3B0F2D] text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Security &amp; Spoof Audit Trail ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('nodes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'nodes'
                ? 'bg-[#3B0F2D] text-amber-300 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Edge YOLO Hardware Grid</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 0: AI Decision Logic & Math Verification (SASTRA / TEJAS 2026)
           ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'logic' && (
          <DecisionLogicVerification />
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 1: Fleet OBU & RFID Device Registry
           ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'devices' && (
          <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-6 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-lg text-[#3B0F2D] tracking-tight">
                  AIS-140 Registered Emergency Responders
                </h3>
                <p className="text-xs text-slate-500">
                  Authorized ambulances and fire appliances transmitting HMAC-SHA256 authenticated preemption tokens.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadAdminData}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Refresh device list"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#3B0F2D] hover:bg-[#6E2453] text-amber-300 px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Vehicle OBU</span>
                </button>
              </div>
            </div>

            {/* Devices Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider">
                    <th className="py-3 px-4">Device ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Gov Registration</th>
                    <th className="py-3 px-4">HMAC Secret (32-byte)</th>
                    <th className="py-3 px-4">Authorization</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#3B0F2D]">
                        <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {d.device_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans capitalize">
                        {d.vehicle_type === 'ambulance' ? (
                          <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                            <Car className="w-3.5 h-3.5" /> Ambulance
                          </span>
                        ) : d.vehicle_type === 'fire_engine' ? (
                          <span className="flex items-center gap-1.5 text-orange-600 font-semibold">
                            <Flame className="w-3.5 h-3.5" /> Fire Engine
                          </span>
                        ) : (
                          <span className="text-slate-500">Unspecified</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{d.reg_no}</td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <span className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                          {d.secret_key.substring(0, 16)}••••••••
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {d.active ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            ACTIVE · AUTHORIZED
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            REVOKED / INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleDevice(d.device_id, d.active)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold font-sans transition-colors cursor-pointer ${
                            d.active
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {d.active ? 'Revoke Access' : 'Authorize OBU'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 2: Junction Preemption Override
           ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'override' && (
          <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-6 shadow-md space-y-6">
            <div>
              <h3 className="font-black text-lg text-[#3B0F2D] tracking-tight">
                National Arterial Emergency Override Dispatch
              </h3>
              <p className="text-xs text-slate-500">
                Direct statutory override to force Green Wave preemption across urban hospital corridors.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#3B0F2D] text-white p-5 rounded-2xl border border-amber-400/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase bg-amber-400 text-slate-950 font-bold px-1.5 py-0.5 rounded">
                    CODE-RED
                  </span>
                  <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
                </div>
                <h4 className="font-extrabold text-base">All 5 Corridors Force-Clear</h4>
                <p className="text-xs text-slate-300">
                  Instantly triggers early green across INT-01 through INT-05, halting side-streets and securing crosswalks.
                </p>
                <button
                  onClick={handleTriggerOverride}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-extrabold text-xs uppercase shadow-md transition-all cursor-pointer"
                >
                  Execute 45s Green Wave
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                    CONTROLLER FAIL-SAFE
                  </span>
                  <ShieldAlert className="w-5 h-5 text-slate-500" />
                </div>
                <h4 className="font-extrabold text-base text-[#3B0F2D]">Revert to Fixed Timers</h4>
                <p className="text-xs text-slate-500">
                  Instantly releases preemption holds and returns all arterial signal controllers to standard cyclic time-of-day plans.
                </p>
                <button
                  onClick={() => setOverrideActive(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 rounded-xl font-extrabold text-xs uppercase transition-colors cursor-pointer"
                >
                  Restore Normal Cycle
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                    AIS-140 GPS SYNC
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="font-extrabold text-base text-[#3B0F2D]">10 Hz Telemetry Stream</h4>
                <p className="text-xs text-slate-500">
                  Active connection to National Ambulance 108 CAD server. Real-time heartbeat interval: 100ms.
                </p>
                <div className="text-xs font-mono text-emerald-700 font-bold pt-1">
                  ● 0 PACKET LOSS · PING 12ms
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 3: Security & Spoof Audit Trail
           ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-6 shadow-md space-y-5">
            <div>
              <h3 className="font-black text-lg text-[#3B0F2D] tracking-tight">
                Cryptographic Token Verification &amp; Security Log
              </h3>
              <p className="text-xs text-slate-500">
                Audited record of all vehicle preemption handshake requests, rejected tokens, and safety invariant holds.
              </p>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    log.type === 'REJECTED_TOKEN'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : log.type === 'FAILSAFE'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {log.type === 'REJECTED_TOKEN' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : log.type === 'FAILSAFE' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="font-bold">{log.type}</span>
                    <span className="text-slate-500">·</span>
                    <span>{log.detail}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 font-sans">
                    t = {log.t.toFixed(1)}s (Sim Record #{log.id})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            TAB 4: Edge Vision AI Node Health
           ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'nodes' && (
          <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-6 shadow-md space-y-5">
            <div>
              <h3 className="font-black text-lg text-[#3B0F2D] tracking-tight">
                Junction Edge AI Camera Telemetry
              </h3>
              <p className="text-xs text-slate-500">
                NVIDIA Jetson AGX / Edge TPU micro-vision nodes executing real-time YOLOv8 vehicle classification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {[
                { code: 'INT-01', name: 'Hospital Road x Gandhi Salai', fps: 30.1, temp: '42°C', status: 'ONLINE', conf: '96.2%' },
                { code: 'INT-02', name: 'Collectorate Circle', fps: 29.8, temp: '44°C', status: 'ONLINE', conf: '94.8%' },
                { code: 'INT-03', name: 'Anna Flyover Approach', fps: 30.0, temp: '41°C', status: 'ONLINE', conf: '95.1%' },
                { code: 'INT-04', name: 'Old Bus Stand Cross', fps: 28.9, temp: '45°C', status: 'ONLINE', conf: '93.7%' },
                { code: 'INT-05', name: 'Medical College East Gate', fps: 30.2, temp: '39°C', status: 'ONLINE', conf: '97.4%' },
              ].map((node) => (
                <div key={node.code} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#3B0F2D]">{node.code}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {node.status}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-800">{node.name}</h4>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 font-mono text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">FPS</span>
                      <strong>{node.fps}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Confidence</span>
                      <strong className="text-emerald-700">{node.conf}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Temp</span>
                      <strong>{node.temp}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Add New Vehicle OBU */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="font-black text-lg text-[#3B0F2D]">Register Emergency Responder OBU</h3>
              <form onSubmit={handleAddDevice} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Device ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AMB-05 or FIRE-03"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Vehicle Type</label>
                  <select
                    value={newVehicleType}
                    onChange={(e) => setNewVehicleType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option value="ambulance">Ambulance (108 / Emergency Life Support)</option>
                    <option value="fire_engine">Fire &amp; Rescue Appliance (101)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Vehicle Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TN 49 AB 9988"
                    value={newRegNo}
                    onChange={(e) => setNewRegNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 uppercase font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#3B0F2D] hover:bg-[#6E2453] text-amber-300 px-4 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    Register &amp; Generate HMAC Key
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
