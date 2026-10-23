import axios from 'axios';
import type {
  Scenario,
  Corridor,
  PredictorParams,
  PredictResponse,
  SimResult,
  CorridorSimResult,
  StatsResponse,
  RunRecord,
  VisionFixture,
  AdminUser,
  AdminLoginResponse,
  EmergencyDevice,
  AuditLog,
  SystemOverrideResponse,
  DriverProfile,
  DriverLoginResponse,
  CitizenProfile,
  CitizenLoginResponse,
} from './types';
import offlineSeed from './data/offline-seed.json';

// In dev, Vite proxies /api to localhost:8000. In production (Vercel) set
// VITE_API_URL to the Render backend, e.g. https://queueflush-api.onrender.com
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const client = axios.create({
  baseURL: API_URL,
  // Render's free tier sleeps when idle; give a cold start time to wake up
  timeout: API_URL ? 15000 : 4000,
});

// Attach the admin session token to admin-only requests
client.interceptors.request.use((config) => {
  const url = config.url || '';
  if (url.startsWith('/api/admin') || url.startsWith('/api/auth/admin/me') || url.startsWith('/api/auth/logout')) {
    const token = localStorage.getItem('qf_admin_token') || localStorage.getItem('qf_driver_token');
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/** True when the request never reached the backend (offline demo mode). */
const isNetworkError = (err: any) => !err?.response;

let isBackendOnline = true;
const listeners = new Set<(online: boolean) => void>();

export const notifyStatus = (online: boolean) => {
  if (isBackendOnline !== online) {
    isBackendOnline = online;
    listeners.forEach((fn) => fn(online));
  }
};

export const subscribeBackendStatus = (fn: (online: boolean) => void) => {
  listeners.add(fn);
  fn(isBackendOnline);
  return () => {
    listeners.delete(fn);
  };
};

export const getBackendStatus = () => isBackendOnline;

export const checkHealth = async (): Promise<boolean> => {
  try {
    const res = await client.get('/api/health');
    const online = res.status === 200;
    notifyStatus(online);
    return online;
  } catch {
    notifyStatus(false);
    return false;
  }
};

export const getScenarios = async (): Promise<Scenario[]> => {
  try {
    const res = await client.get<Scenario[]>('/api/scenarios');
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    return (offlineSeed.scenarios as unknown as Scenario[]) || [];
  }
};

export const getScenario = async (slug: string): Promise<Scenario | null> => {
  try {
    const res = await client.get<Scenario>(`/api/scenarios/${slug}`);
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    const found = (offlineSeed.scenarios as unknown as Scenario[]).find((s) => s.slug === slug);
    return found || null;
  }
};

export const getCorridors = async (): Promise<Corridor[]> => {
  try {
    const res = await client.get<Corridor[]>('/api/corridors');
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    return (offlineSeed.corridors as unknown as Corridor[]) || [];
  }
};

export const getCorridor = async (slug: string): Promise<Corridor | null> => {
  try {
    const res = await client.get<Corridor>(`/api/corridors/${slug}`);
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    const found = (offlineSeed.corridors as unknown as Corridor[]).find((c) => c.slug === slug);
    return found || null;
  }
};

export const predictMath = (p: PredictorParams): PredictResponse => {
  // Pure TypeScript local prediction mirror for instant zero-latency slider preview
  const weatherFactors: Record<string, number> = { dry: 1.0, wet: 1.25, fog: 1.35 };
  const wf = weatherFactors[p.weather] ?? 1.0;
  const effectiveDelay = p.t_delay * wf;
  const heavyAdj = (p.heavy_count || 0) * 0.6;
  const t_clear = Math.max(0, (p.N - 1) * effectiveDelay + p.t_margin + heavyAdj);
  const speed_ms = (p.speed_kmh * 1000) / 3600;
  const eta = speed_ms > 0 ? p.distance_m / speed_ms : 999.0;
  const t_trigger = eta - t_clear;
  const partial_flush = eta < t_clear;

  let approved = true;
  let action: 'PROCEED' | 'HOLD' | 'FAILSAFE' | 'PARTIAL_FLUSH' = 'PROCEED';
  let hold_s = 0.0;
  const reasons: string[] = [];

  if (p.ped_active && (p.ped_remaining_s ?? 0) < 3.0) {
    approved = false;
    action = 'HOLD';
    hold_s = Math.max(1.0, 3.0 - (p.ped_remaining_s ?? 0));
    reasons.push(`SAFETY HOLD: Active ped clearance has ${p.ped_remaining_s?.toFixed(1)}s remaining (< 3.0s threshold)`);
  } else if (partial_flush) {
    action = 'PARTIAL_FLUSH';
    reasons.push(`PARTIAL FLUSH: ETA (${eta.toFixed(1)}s) < T_clear (${t_clear.toFixed(1)}s). Triggering immediate green.`);
  } else {
    reasons.push(`PROCEED: Early green scheduled at T_trigger = ${t_trigger.toFixed(1)}s`);
  }

  return {
    t_clear: Math.round(t_clear * 100) / 100,
    eta: Math.round(eta * 100) / 100,
    t_trigger: Math.round(t_trigger * 100) / 100,
    partial_flush,
    weather_factor: wf,
    heavy_adjustment_s: heavyAdj,
    effective_t_delay: Math.round(effectiveDelay * 100) / 100,
    safety: {
      approved,
      action,
      hold_seconds: hold_s,
      reasons,
    },
    reasons,
  };
};

export const predict = async (params: PredictorParams): Promise<PredictResponse> => {
  try {
    const res = await client.post<PredictResponse>('/api/predict', params);
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    return predictMath(params);
  }
};

export const simulate = async (body: {
  scenario_slug?: string;
  params?: PredictorParams;
  seed?: number;
  mode?: 'conventional' | 'predictive' | 'both';
  telemetry_drop_at?: number;
}): Promise<{ conventional?: SimResult; predictive?: SimResult }> => {
  try {
    const res = await client.post('/api/simulate', body);
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    // Offline fallback for demo scenarios
    const slug = body.scenario_slug;
    if (slug && (offlineSeed as any).demo_timelines?.[slug]) {
      return (offlineSeed as any).demo_timelines[slug];
    }
    // Return empty fallback
    return {};
  }
};

export const simulateCorridor = async (body: {
  corridor_slug: string;
  seed?: number;
}): Promise<CorridorSimResult> => {
  try {
    const res = await client.post('/api/corridor', body);
    notifyStatus(true);
    const d = res.data as any;

    if (d && d.junctions && Array.isArray(d.junctions)) {
      const convWait = d.junctions.reduce((acc: number, j: any) => acc + (j.conventional?.ambulance_wait_s || 0), 0);
      const predWait = d.junctions.reduce((acc: number, j: any) => acc + (j.predictive?.ambulance_wait_s || 0), 0);

      return {
        corridor_slug: d.slug || body.corridor_slug,
        conventional: {
          total_time_s: d.total_time_conv_s ?? 142.4,
          total_wait_s: Math.round(convWait * 10) / 10,
          junction_metrics: d.junctions.map((j: any) => ({
            code: j.code,
            name: j.name,
            wait_s: j.conventional?.ambulance_wait_s ?? 0,
            crossing_s: j.conventional?.crossing_time_s ?? 0,
            queue_n: j.queue_n ?? 6,
            cleared: true,
          })),
        },
        predictive: {
          total_time_s: d.total_time_pred_s ?? 96.1,
          total_wait_s: Math.round(predWait * 10) / 10,
          time_saved_s: d.corridor_gain_s ?? Math.max(0, (d.total_time_conv_s ?? 142.4) - (d.total_time_pred_s ?? 96.1)),
          junction_metrics: d.junctions.map((j: any) => ({
            code: j.code,
            name: j.name,
            wait_s: j.predictive?.ambulance_wait_s ?? 0,
            crossing_s: j.predictive?.crossing_time_s ?? 0,
            queue_n: j.queue_n ?? 6,
            cleared: true,
          })),
        },
      };
    }

    if (d && d.conventional && d.predictive) {
      return d as CorridorSimResult;
    }

    throw new Error('Unexpected corridor response structure');
  } catch {
    notifyStatus(false);
    // Fallback corridor metrics
    return {
      corridor_slug: body.corridor_slug,
      conventional: {
        total_time_s: 142.4,
        total_wait_s: 48.2,
        junction_metrics: [
          { code: 'INT-01', name: 'Hospital Road x Gandhi Salai', wait_s: 11.2, crossing_s: 24.5, queue_n: 8, cleared: true },
          { code: 'INT-02', name: 'Collectorate Circle', wait_s: 9.8, crossing_s: 22.1, queue_n: 6, cleared: true },
          { code: 'INT-03', name: 'Anna Flyover North Approach', wait_s: 13.4, crossing_s: 27.8, queue_n: 9, cleared: true },
          { code: 'INT-04', name: 'Old Bus Stand Cross', wait_s: 8.5, crossing_s: 21.0, queue_n: 5, cleared: true },
          { code: 'INT-05', name: 'Medical College East Gate', wait_s: 5.3, crossing_s: 18.2, queue_n: 4, cleared: true },
        ],
      },
      predictive: {
        total_time_s: 96.1,
        total_wait_s: 1.9,
        time_saved_s: 46.3,
        junction_metrics: [
          { code: 'INT-01', name: 'Hospital Road x Gandhi Salai', wait_s: 0.0, crossing_s: 13.3, queue_n: 8, cleared: true },
          { code: 'INT-02', name: 'Collectorate Circle', wait_s: 0.0, crossing_s: 12.3, queue_n: 6, cleared: true },
          { code: 'INT-03', name: 'Anna Flyover North Approach', wait_s: 1.9, crossing_s: 16.3, queue_n: 9, cleared: true },
          { code: 'INT-04', name: 'Old Bus Stand Cross', wait_s: 0.0, crossing_s: 12.5, queue_n: 5, cleared: true },
          { code: 'INT-05', name: 'Medical College East Gate', wait_s: 0.0, crossing_s: 12.9, queue_n: 4, cleared: true },
        ],
      },
    };
  }
};

export const getStats = async (): Promise<StatsResponse> => {
  try {
    const res = await client.get<StatsResponse>('/api/stats');
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    return (offlineSeed as any).stats || {
      avg_ambulance_wait_eliminated_s: 6.9,
      avg_time_saved_per_junction_s: 7.68,
      best_corridor_gain_s: 41.95,
      total_runs: 210,
    };
  }
};

export const getRuns = async (params?: {
  limit?: number;
  mode?: string;
  scenario?: string;
  weather?: string;
}): Promise<RunRecord[]> => {
  try {
    const res = await client.get<RunRecord[]>('/api/runs', { params });
    notifyStatus(true);
    return res.data;
  } catch {
    notifyStatus(false);
    return [];
  }
};

export const saveRun = async (data: any) => {
  try {
    const res = await client.post('/api/runs', data);
    return res.data;
  } catch (err) {
    console.error('Failed to save run', err);
    throw err;
  }
};

export const getVisionFixture = async (scenarioSlug: string): Promise<VisionFixture | null> => {
  try {
    const res = await client.get<VisionFixture>(`/api/vision/fixtures/${scenarioSlug}`);
    notifyStatus(true);
    return res.data;
  } catch {
    return null;
  }
};

/** Ask the (simulated) on-board unit of a registered vehicle to sign a payload. */
export const signToken = async (body: {
  device_id: string;
  payload: string;
}): Promise<{ signature: string } | { error: string }> => {
  try {
    const res = await client.post('/api/auth/sign-token', body);
    notifyStatus(true);
    return res.data;
  } catch (err: any) {
    if (!err.response) notifyStatus(false);
    return { error: err.response?.data?.detail || 'Signing unavailable' };
  }
};

export const verifyToken = async (body: {
  device_id: string;
  payload: string;
  signature: string;
}): Promise<{ valid: boolean; device?: any; reason?: string }> => {
  try {
    const res = await client.post('/api/auth/verify-token', body);
    return res.data;
  } catch (err: any) {
    return { valid: false, reason: err.response?.data?.detail || 'Verification error' };
  }
};

export const runBenchmark = async () => {
  const res = await client.post('/api/benchmark');
  return res.data;
};

// ── Admin Portal API ──────────────────────────────────────────────────────────
export const adminLogin = async (body: {
  username: string;
  password: string;
  pin?: string;
}): Promise<AdminLoginResponse> => {
  try {
    const res = await client.post<AdminLoginResponse>('/api/auth/admin/login', body);
    if (res.data.token) {
      localStorage.setItem('qf_role', 'admin');
      localStorage.setItem('qf_admin_token', res.data.token);
      localStorage.setItem('qf_admin_user', JSON.stringify(res.data.user));
    }
    return res.data;
  } catch (err: any) {
    if (isNetworkError(err)) {
      notifyStatus(false);
      if (body.username && body.password) {
        const demoUser: AdminUser = {
          username: body.username,
          full_name: 'Dr. R. Ramanathan, IAS',
          designation: 'Chief Director (National ITMS Operations)',
          clearance_level: 'LEVEL-4 NATIONAL PREEMPTION DISPATCH',
          node_id: 'NIC-NDLS-ITMS-021',
          department: 'Ministry of Road Transport and Highways (MoRTH)',
          login_time: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
        };
        const demoRes: AdminLoginResponse = {
          success: true,
          token: 'govnet_demo_session_token',
          user: demoUser,
          message: 'Authenticated via Local Government SSO Clearance',
        };
        localStorage.setItem('qf_admin_token', demoRes.token);
        localStorage.setItem('qf_admin_user', JSON.stringify(demoRes.user));
        return demoRes;
      }
    }
    throw err;
  }
};

export const getAdminMe = async (): Promise<AdminUser | null> => {
  const token = localStorage.getItem('qf_admin_token');
  if (!token) return null;
  try {
    const res = await client.get<AdminUser>('/api/auth/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) {
      // expired / invalid session
      localStorage.removeItem('qf_admin_token');
      localStorage.removeItem('qf_admin_user');
      return null;
    }
    const cached = localStorage.getItem('qf_admin_user');
    return cached ? JSON.parse(cached) : null;
  }
};

export const adminLogout = () => {
  client.post('/api/auth/logout').catch(() => {});
  localStorage.removeItem('qf_admin_token');
  localStorage.removeItem('qf_admin_user');
};

export const getAdminDevices = async (): Promise<EmergencyDevice[]> => {
  try {
    const res = await client.get<EmergencyDevice[]>('/api/admin/devices');
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    return [
      { id: 1, device_id: 'AMB-01', vehicle_type: 'ambulance', reg_no: 'TN 49 AB 1084', secret_key: 'a3f8c2e1d94b7605...', active: true },
      { id: 2, device_id: 'AMB-02', vehicle_type: 'ambulance', reg_no: 'TN 49 AB 2271', secret_key: 'b9e3a6c1f4d7b0e8...', active: true },
      { id: 3, device_id: 'AMB-03', vehicle_type: 'ambulance', reg_no: 'TN 49 CD 3389', secret_key: 'c5f2d9b6e3a0c8f4...', active: true },
      { id: 4, device_id: 'FIRE-01', vehicle_type: 'fire_engine', reg_no: 'TN 49 GH 1001', secret_key: 'e7a4c1f8d5b2e0a6...', active: true },
      { id: 5, device_id: 'UNKNOWN-99', vehicle_type: 'unknown', reg_no: 'TN 00 ZZ 0000', secret_key: '0000000000000000...', active: false },
    ];
  }
};

export const toggleDeviceActive = async (deviceId: string, active: boolean): Promise<EmergencyDevice> => {
  try {
    const res = await client.post<EmergencyDevice>('/api/admin/devices/toggle', { device_id: deviceId, active });
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    return {
      id: 99,
      device_id: deviceId,
      vehicle_type: 'ambulance',
      reg_no: 'DEMO-REG',
      secret_key: 'demo-key',
      active,
    };
  }
};

export const addAdminDevice = async (device: {
  device_id: string;
  vehicle_type: string;
  reg_no: string;
}): Promise<EmergencyDevice> => {
  try {
    const res = await client.post<EmergencyDevice>('/api/admin/devices/add', device);
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    return {
      id: Math.floor(Math.random() * 1000) + 10,
      device_id: device.device_id,
      vehicle_type: device.vehicle_type,
      reg_no: device.reg_no,
      secret_key: 'sec_' + Math.random().toString(36).substring(2),
      active: true,
    };
  }
};

export const getAdminAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    const res = await client.get<AuditLog[]>('/api/admin/audit-logs');
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    return [
      { id: 101, type: 'REJECTED_TOKEN', t: 0.0, detail: 'Unknown device: ROGUE-99 — preemption denied' },
      { id: 102, type: 'FAILSAFE', t: 8.4, detail: 'Telemetry heartbeat lost 2.1s ago — reverted to fallback' },
      { id: 103, type: 'PED_SAFETY_HOLD', t: 0.2, detail: 'School-zone pedestrian walk active: 2.0s hold' },
      { id: 104, type: 'AUTH_GRANTED', t: 1.1, detail: 'Device AMB-01 authenticated via HMAC-SHA256' },
    ];
  }
};

export const triggerAdminOverride = async (req: {
  scope?: string;
  action?: string;
  duration_s?: number;
  reason?: string;
}): Promise<SystemOverrideResponse> => {
  try {
    const res = await client.post<SystemOverrideResponse>('/api/admin/override', req);
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    return {
      success: true,
      scope: req.scope || 'ALL_JUNCTIONS',
      action: req.action || 'FORCE_CASCADE_GREEN',
      active_until: 'Active (45s window)',
      affected_junctions: [
        'INT-01: Hospital Road x Gandhi Salai',
        'INT-02: Collectorate Circle',
        'INT-03: Medical College Junction',
        'INT-04: Ring Road Expressway',
        'INT-05: Trauma Emergency Gate',
      ],
      authorized_by: 'Dr. R. Ramanathan, IAS (Chief Director, MoRTH ITMS)',
    };
  }
};

export const driverLogin = async (body: {
  badge_id: string;
  vehicle_reg: string;
  pin?: string;
}): Promise<DriverLoginResponse> => {
  try {
    const res = await client.post<DriverLoginResponse>('/api/auth/driver/login', body);
    if (res.data.token) {
      localStorage.setItem('qf_role', 'driver');
      localStorage.setItem('qf_driver_token', res.data.token);
      localStorage.setItem('qf_driver_profile', JSON.stringify(res.data.driver));
    }
    return res.data;
  } catch (err: any) {
    if (!isNetworkError(err)) throw err;
    notifyStatus(false);
    const fallbackProfile: DriverProfile = {
      badge_id: body.badge_id || 'PILOT-108',
      pilot_name: 'K. Muruganandam (Senior 108 EMS Pilot)',
      vehicle_id: 'AMB-01',
      vehicle_type: 'Advanced Life Support Ambulance (ALS)',
      reg_no: body.vehicle_reg || 'TN 49 AB 1084',
      assigned_hospital: 'Government Medical College Hospital, Trauma Emergency Dept',
      status: 'DISPATCH_ACTIVE · IN-TRANSIT',
      gps_active: true,
      speed_kmh: 110.0,
      current_corridor: 'Hospital Road x Gandhi Salai Arterial',
    };
    const fallbackRes: DriverLoginResponse = {
      success: true,
      token: 'pilot_demo_token',
      driver: fallbackProfile,
      message: 'Pilot identity verified. OBU Cryptographic Preemption Active.',
    };
    localStorage.setItem('qf_role', 'driver');
    localStorage.setItem('qf_driver_token', fallbackRes.token);
    localStorage.setItem('qf_driver_profile', JSON.stringify(fallbackRes.driver));
    return fallbackRes;
  }
};

export const citizenLogin = async (body: {
  identifier: string;
  otp?: string;
}): Promise<CitizenLoginResponse> => {
  try {
    const res = await client.post<CitizenLoginResponse>('/api/auth/citizen/login', body);
    if (res.data.token) {
      localStorage.setItem('qf_role', 'user');
      localStorage.setItem('qf_citizen_token', res.data.token);
      localStorage.setItem('qf_citizen_profile', JSON.stringify(res.data.citizen));
    }
    return res.data;
  } catch {
    const fallbackProfile: CitizenProfile = {
      full_name: 'Priya Sharma',
      identifier: body.identifier || '9876543210',
      city: 'Nagaram Smart City (Zone 3)',
      alert_notifications: true,
      yield_compliance_rating: 'Grade A+ (Section 194E MV Act Compliant)',
    };
    const fallbackRes: CitizenLoginResponse = {
      success: true,
      token: 'citizen_demo_token',
      citizen: fallbackProfile,
      message: 'Citizen profile authenticated. Live corridor awareness active.',
    };
    localStorage.setItem('qf_role', 'user');
    localStorage.setItem('qf_citizen_token', fallbackRes.token);
    localStorage.setItem('qf_citizen_profile', JSON.stringify(fallbackRes.citizen));
    return fallbackRes;
  }
};


