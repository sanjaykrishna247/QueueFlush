export type WeatherType = 'dry' | 'wet' | 'fog';
export type SimMode = 'conventional' | 'predictive';
export type SignalState = 'RED' | 'YELLOW' | 'ALL_RED' | 'GREEN';

export interface PredictorParams {
  N: number;
  t_delay: number;
  t_margin: number;
  weather: WeatherType;
  heavy_count: number;
  distance_m: number;
  speed_kmh: number;
  ped_active?: boolean;
  ped_remaining_s?: number;
}

export interface SafetyResult {
  approved: boolean;
  action: 'PROCEED' | 'HOLD' | 'FAILSAFE' | 'PARTIAL_FLUSH';
  hold_seconds: number;
  reasons: string[];
}

export interface PredictResponse {
  t_clear: number;
  eta: number;
  t_trigger: number;
  partial_flush: boolean;
  weather_factor: number;
  heavy_adjustment_s: number;
  effective_t_delay: number;
  safety: SafetyResult;
  reasons: string[];
}

export interface VehicleFrame {
  id: number;
  type: 'car' | 'bus' | 'truck' | 'ambulance' | 'motorcycle' | 'auto-rickshaw';
  x: number;
  v: number;
  state?: string;
  reacting?: boolean;
  reaction_active?: boolean;
  passed?: boolean;
  color?: string;
  length?: number;
}

export interface SimFrame {
  t: number;
  signal: SignalState;
  ambulance: {
    x: number;
    v: number;
    state?: string;
    blocked?: boolean;
    blocked_s?: number;
    wait_accumulated_s?: number;
    arrived?: boolean;
  };
  vehicles: VehicleFrame[];
  prediction_zone_start?: number;
  prediction_zone_end?: number;
  prediction_label?: string | null;
  early_green_in_s?: number;
  signal_changed_at?: number | null;
}

export interface SimEvent {
  t: number;
  category: 'VISION' | 'PREDICT' | 'SAFETY' | 'SIGNAL' | 'TELEMETRY';
  message: string;
}

export interface SimMetrics {
  ambulance_wait_s: number;
  crossing_time_s: number;
  queue_cleared_at_s: number;
  stopped: boolean;
  partial_flush: boolean;
}

export interface SimResult {
  mode: SimMode;
  frames: SimFrame[];
  events: SimEvent[];
  metrics: SimMetrics;
  prediction?: PredictResponse;
}

export interface Scenario {
  id?: number;
  slug: string;
  name: string;
  description: string;
  tags: string[];
  params: {
    N: number;
    t_delay: number;
    t_margin: number;
    weather: WeatherType;
    heavy_count: number;
    distance_m: number;
    speed_kmh: number;
    ped_active?: boolean;
    ped_remaining_s?: number;
  };
  seed: number;
  is_demo: boolean;
  telemetry_drop_at?: number;
}

export interface Intersection {
  code: string;
  name: string;
  lat: number;
  lng: number;
  approach_distance_m: number;
  ped_cycle_s: number;
  controller_type: string;
}

export interface GPSPoint {
  t: number;
  lat: number;
  lng: number;
  speed_kmh: number;
  signature?: string;
}

export interface Corridor {
  id?: number;
  slug: string;
  name: string;
  hospital_name: string;
  total_length_km: number;
  intersection_codes: string[];
  intersections?: Intersection[];
  gps_track?: GPSPoint[];
  queue_n?: number[];
  weather?: WeatherType;
}

export interface CorridorSimResult {
  corridor_slug: string;
  conventional: {
    total_time_s: number;
    total_wait_s: number;
    junction_metrics: Array<{
      code: string;
      name: string;
      wait_s: number;
      crossing_s: number;
      queue_n: number;
      cleared: boolean;
    }>;
  };
  predictive: {
    total_time_s: number;
    total_wait_s: number;
    time_saved_s: number;
    junction_metrics: Array<{
      code: string;
      name: string;
      wait_s: number;
      crossing_s: number;
      queue_n: number;
      cleared: boolean;
    }>;
  };
}

export interface RunRecord {
  id: number;
  created_at: string;
  scenario_slug: string;
  mode: SimMode;
  params: PredictorParams;
  metrics: SimMetrics;
  seed: number;
  source: 'seed' | 'user' | 'benchmark';
}

export interface StatsResponse {
  avg_ambulance_wait_eliminated_s: number;
  avg_time_saved_per_junction_s: number;
  best_corridor_gain_s: number;
  total_runs: number;
  conventional_avg_wait_s?: number;
  predictive_avg_wait_s?: number;
}

export interface DetectionBox {
  class: string;
  conf: number;
  box: [number, number, number, number]; // [x, y, w, h]
}

export interface VisionFixture {
  scenario_slug: string;
  frame_no: number;
  detections: DetectionBox[];
}

export interface AdminUser {
  username: string;
  full_name: string;
  designation: string;
  clearance_level: string;
  node_id: string;
  department: string;
  login_time: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token: string;
  user: AdminUser;
  message: string;
}

export interface EmergencyDevice {
  id: number;
  device_id: string;
  vehicle_type: string;
  reg_no: string;
  secret_key: string;
  active: boolean;
}

export interface AuditLog {
  id: number;
  type: string;
  t: number;
  detail: string;
  run_id?: number | null;
}

export interface SystemOverrideResponse {
  success: boolean;
  scope: string;
  action: string;
  active_until: string;
  affected_junctions: string[];
  authorized_by: string;
}

export interface DriverProfile {
  badge_id: string;
  pilot_name: string;
  vehicle_id: string;
  vehicle_type: string;
  reg_no: string;
  assigned_hospital: string;
  status: string;
  gps_active: boolean;
  speed_kmh: number;
  current_corridor: string;
}

export interface DriverLoginResponse {
  success: boolean;
  token: string;
  driver: DriverProfile;
  message: string;
}

export interface CitizenProfile {
  full_name: string;
  identifier: string;
  city: string;
  alert_notifications: boolean;
  yield_compliance_rating: string;
}

export interface CitizenLoginResponse {
  success: boolean;
  token: string;
  citizen: CitizenProfile;
  message: string;
}


