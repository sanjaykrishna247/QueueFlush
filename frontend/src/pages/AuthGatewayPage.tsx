import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandMark } from '../components/Navbar';
import { ControlRoom } from '../components/ControlRoom';
import { DriverView } from '../components/DriverView';
import {
  adminLogin,
  adminLogout,
  driverLogin,
  getAdminDevices,
  toggleDeviceActive,
  addAdminDevice,
  getAdminAuditLogs,
  triggerAdminOverride,
} from '../api';
import type {
  AdminUser,
  DriverProfile,
  EmergencyDevice,
  AuditLog,
  SystemOverrideResponse,
} from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Radio,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  LogOut,
  Car,
  Navigation,
  Eye,
  ChevronRight,
  Scale,
  Flame,
} from 'lucide-react';
import { DecisionLogicVerification } from '../components/DecisionLogicVerification';
import { DriverCockpitNavigation } from '../components/DriverCockpitNavigation';

type PortalRole = 'driver' | 'admin';

export const AuthGatewayPage: React.FC = () => {
  // Current active session state
  const [activeRole, setActiveRole] = useState<PortalRole | null>(() => {
    return (localStorage.getItem('qf_role') as PortalRole) || null;
  });

  // Selected tab on login screen
  const [selectedTab, setSelectedTab] = useState<PortalRole>('driver');

  // Submitting state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Driver form inputs
  const [driverBadge, setDriverBadge] = useState<string>('PILOT-108');
  const [driverReg, setDriverReg] = useState<string>('TN 49 AB 1084');
  const [driverPin, setDriverPin] = useState<string>('1080');

  // Admin form inputs
  const [adminUser, setAdminUser] = useState<string>('admin@queueflush.ai');
  const [adminPass, setAdminPass] = useState<string>('QueueFlush@2026');
  const [adminPin, setAdminPin] = useState<string>('2026');



  // Stored Profiles
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(() => {
    const cached = localStorage.getItem('qf_driver_profile');
    return cached ? JSON.parse(cached) : null;
  });

  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(() => {
    const cached = localStorage.getItem('qf_admin_user');
    return cached ? JSON.parse(cached) : null;
  });



  // Admin-specific state
  const [adminTab, setAdminTab] = useState<'logic' | 'devices' | 'override' | 'audit' | 'nodes'>('logic');
  const [devices, setDevices] = useState<EmergencyDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [overrideActive, setOverrideActive] = useState<SystemOverrideResponse | null>(null);
  const [overrideCountdown, setOverrideCountdown] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newDeviceId, setNewDeviceId] = useState<string>('');
  const [newVehicleType, setNewVehicleType] = useState<string>('ambulance');
  const [newRegNo, setNewRegNo] = useState<string>('');

  // Driver-specific state
  const [preemptionActivated, setPreemptionActivated] = useState<boolean>(true);
  const [pilotSpeed, setPilotSpeed] = useState<number>(110);
  const [pilotDist, setPilotDist] = useState<number>(300);



  // Load admin data if admin role
  useEffect(() => {
    if (activeRole === 'admin') {
      Promise.all([getAdminDevices(), getAdminAuditLogs()])
        .then(([d, l]) => {
          setDevices(d);
          setAuditLogs(l);
        })
        .catch(() => {
          // session expired (e.g. server restarted) -> back to sign-in
          handleLogout();
          setErrorMsg('Your session expired. Please sign in again.');
        });
    }
  }, [activeRole]);

  // Periodic driver simulator ticker
  useEffect(() => {
    if (activeRole !== 'driver') return;
    const interval = setInterval(() => {
      setPilotDist((prev) => (prev > 10 ? prev - 5 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRole]);

  const handleDriverLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await driverLogin({
        badge_id: driverBadge,
        vehicle_reg: driverReg,
        pin: driverPin,
      });
      setDriverProfile(res.driver);
      setActiveRole('driver');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Sign-in failed. Check badge, registration and PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminLogin({
        username: adminUser,
        password: adminPass,
        pin: adminPin,
      });
      setAdminProfile(res.user);
      setActiveRole('admin');
      const [devs, logs] = await Promise.all([getAdminDevices(), getAdminAuditLogs()]);
      setDevices(devs);
      setAuditLogs(logs);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Sign-in failed. Check email, password and 2FA code.');
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = () => {
    adminLogout();
    localStorage.removeItem('qf_role');
    localStorage.removeItem('qf_driver_token');
    localStorage.removeItem('qf_driver_profile');
    localStorage.removeItem('qf_admin_token');
    localStorage.removeItem('qf_admin_user');
    setActiveRole(null);
  };

  const handleToggleDevice = async (deviceId: string, currentStatus: boolean) => {
    const updated = await toggleDeviceActive(deviceId, !currentStatus);
    setDevices((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, active: updated.active } : d))
    );
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId || !newRegNo) return;
    const created = await addAdminDevice({
      device_id: newDeviceId.toUpperCase(),
      vehicle_type: newVehicleType,
      reg_no: newRegNo.toUpperCase(),
    });
    setDevices((prev) => [...prev, created]);
    setShowAddModal(false);
    setNewDeviceId('');
    setNewRegNo('');
  };

  const handleTriggerOverride = async () => {
    const res = await triggerAdminOverride({
      scope: 'ALL_JUNCTIONS',
      action: 'FORCE_CASCADE_GREEN',
      duration_s: 45,
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
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1: Sign-in
  // ═══════════════════════════════════════════════════════════════════════════
  if (!activeRole) {
    const inputCls =
      'w-full bg-white border border-[#E6DCE2] rounded-lg py-2.5 px-3 text-[15px] text-[#1F0A18] outline-none transition focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10';
    const labelCls = 'block text-[13px] font-semibold text-[#3F3340] mb-1.5';

    return (
      <div className="min-h-[calc(100vh-76px)] grid lg:grid-cols-2 bg-white">
        {/* Left: brand panel */}
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#5E1B48] text-white p-12">
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F25C8A]/25 blur-3xl animate-blob" />
          <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] rounded-full bg-[#A8487F]/40 blur-3xl animate-blob [animation-delay:-7s]" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <BrandMark className="w-11 h-11" onDark />
              <span className="text-lg font-bold">QueueFlush <span className="text-[#FFC2D6]">AI</span></span>
            </div>
            <h1 className="mt-6 text-4xl xl:text-5xl font-bold leading-tight tracking-tight max-w-md">
              Clear the road before the siren gets there.
            </h1>
            <p className="mt-4 text-white/75 max-w-md leading-relaxed">
              Drivers get a live in-cabin view of the signals ahead. Control-room staff manage the fleet,
              review every decision and step in when needed.
            </p>
          </div>

          {/* little animated corridor */}
          <div className="relative rounded-2xl bg-white/[0.07] border border-white/15 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-white/70 mb-4">
              <span>Hospital corridor A · 5 junctions</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> live
              </span>
            </div>
            <div className="relative h-10">
              <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full bg-white/15" />
              <motion.div
                className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-400 to-[#F25C8A]"
                animate={{ width: ['0%', '100%', '100%'] }}
                transition={{ duration: 6, times: [0, 0.85, 1], repeat: Infinity, ease: 'easeInOut' }}
              />
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white/60"
                  style={{ left: `${i * 25}%` }}
                  animate={{ backgroundColor: ['#EF4444', '#EF4444', '#22C55E', '#22C55E', '#EF4444'] }}
                  transition={{ duration: 6, times: [0, Math.max(0.01, i * 0.17 - 0.12), Math.max(0.02, i * 0.17 - 0.11), 0.95, 1], repeat: Infinity }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ['0.0s', 'wait per junction'],
                ['5', 'signals pre-cleared'],
                ['HMAC', 'signed telemetry'],
              ].map(([v, l]) => (
                <div key={l}>
                  <div className="text-xl font-bold">{v}</div>
                  <div className="text-[11px] text-white/60">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex items-center justify-center px-5 py-12 sm:px-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-bold text-[#1F0A18] tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-[#7A6B76]">Choose how you're using QueueFlush today.</p>

            {/* role switch */}
            <div className="mt-7 grid grid-cols-2 p-1 rounded-xl bg-[#F7F0F4]">
              {([
                { key: 'driver', label: 'Emergency driver', icon: Car },
                { key: 'admin', label: 'Control room', icon: Lock },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedTab(key);
                    setErrorMsg(null);
                  }}
                  className={`relative flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                    selectedTab === key ? 'text-[#5E1B48]' : 'text-[#7A6B76] hover:text-[#3F3340]'
                  }`}
                >
                  {selectedTab === key && (
                    <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />
                  )}
                  <Icon className="relative w-4 h-4" />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 overflow-hidden"
                >
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    {errorMsg}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {selectedTab === 'driver' ? (
                <motion.form
                  key="driver"
                  onSubmit={handleDriverLogin}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6 space-y-4"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Badge ID</label>
                      <input value={driverBadge} onChange={(e) => setDriverBadge(e.target.value)} required placeholder="PILOT-108" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Vehicle registration</label>
                      <input value={driverReg} onChange={(e) => setDriverReg(e.target.value)} required placeholder="TN 49 AB 1084" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>PIN</label>
                    <input type="password" value={driverPin} onChange={(e) => setDriverPin(e.target.value)} required placeholder="•••" className={`${inputCls} tracking-widest`} />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#5E1B48] hover:bg-[#48133A] text-white py-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Navigation className="w-4 h-4" />}
                    Open driver view
                  </button>
                  <p className="text-sm text-center text-[#7A6B76]">
                    Demo account: badge <span className="font-mono text-[#3F3340]">PILOT-108</span>, PIN <span className="font-mono text-[#3F3340]">1080</span> ·{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setDriverBadge('PILOT-108');
                        setDriverReg('TN 49 AB 1084');
                        setDriverPin('1080');
                        handleDriverLogin();
                      }}
                      className="font-semibold text-[#5E1B48] hover:underline cursor-pointer"
                    >
                      use it
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.form
                  key="admin"
                  onSubmit={handleAdminLogin}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="mt-6 space-y-4"
                >
                  <div>
                    <label className={labelCls}>Email</label>
                    <input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} required placeholder="admin@queueflush.ai" className={inputCls} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Password</label>
                      <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>2FA code</label>
                      <input value={adminPin} onChange={(e) => setAdminPin(e.target.value)} required placeholder="2026" className={`${inputCls} tracking-widest`} />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#5E1B48] hover:bg-[#48133A] text-white py-3 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Open control room
                  </button>
                  <p className="text-sm text-center text-[#7A6B76]">
                    Demo account is pre-filled ·{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAdminUser('admin@queueflush.ai');
                        setAdminPass('QueueFlush@2026');
                        setAdminPin('2026');
                        handleAdminLogin();
                      }}
                      className="font-semibold text-[#5E1B48] hover:underline cursor-pointer"
                    >
                      sign in with it
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-10 pt-6 border-t border-[#EDE3E9] flex items-center gap-2 text-xs text-[#7A6B76]">
              <Lock className="w-3.5 h-3.5" />
              Sessions are signed and every action is written to the audit log.
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // SCREEN 2A: driver
  if (activeRole === 'driver') {
    return <DriverView profile={driverProfile} onLogout={handleLogout} />;
  }

  // SCREEN 2B: control room
  return (
    <ControlRoom
      profile={adminProfile}
      onLogout={handleLogout}
      onSessionExpired={() => {
        handleLogout();
        setErrorMsg('Your session expired. Please sign in again.');
      }}
    />
  );
};
