import React, { useRef, useEffect, useCallback } from 'react';
import type { SimFrame, DetectionBox, SimMode } from '../types';

interface SimulatorCanvasProps {
  mode: SimMode;
  frame: SimFrame | null;
  showYolo?: boolean;
  detections?: DetectionBox[];
  totalDistance?: number;
}

const CAR_COLORS = ['#E5E7EB', '#1F2937', '#9CA3AF', '#B91C1C', '#1E3A8A', '#0F766E', '#F8FAFC', '#6B7280', '#7C2D12', '#334155'];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0 || h <= 0) return;
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Top-down vehicle facing right. (x = rear bumper, cy = lane centre) */
function drawVehicle(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  len: number,
  w: number,
  color: string,
  type: string,
  braking: boolean,
  flip = false
) {
  ctx.save();
  if (flip) {
    ctx.translate(x + len / 2, cy);
    ctx.scale(-1, 1);
    ctx.translate(-(x + len / 2), -cy);
  }
  const y = cy - w / 2;

  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, x + 1.5, y + 2, len, w, 4);
  ctx.fill();

  if (type === 'bus') {
    const g = ctx.createLinearGradient(0, y, 0, y + w);
    g.addColorStop(0, shade(color, 25));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -30));
    ctx.fillStyle = g;
    rr(ctx, x, y, len, w, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + len * 0.08 + i * len * 0.16, y + 2.5, len * 0.12, w - 5);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(x + len - 5, y + 2, 3.5, w - 4);
  } else if (type === 'truck') {
    // cargo box + cab
    ctx.fillStyle = '#CBD5E1';
    rr(ctx, x, y, len * 0.72, w, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (len * 0.72 * i) / 5, y + 1);
      ctx.lineTo(x + (len * 0.72 * i) / 5, y + w - 1);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    rr(ctx, x + len * 0.74, y + 0.5, len * 0.26, w - 1, 3);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(x + len - 5, y + 2, 3, w - 4);
  } else if (type === 'motorcycle') {
    ctx.fillStyle = '#111827';
    rr(ctx, x, cy - 1.5, len, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + len * 0.5, cy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // wheels
    ctx.fillStyle = '#0B0B0B';
    const wl = Math.max(3, len * 0.16);
    ctx.fillRect(x + len * 0.14, y - 0.8, wl, 1.8);
    ctx.fillRect(x + len * 0.14, y + w - 1, wl, 1.8);
    ctx.fillRect(x + len * 0.68, y - 0.8, wl, 1.8);
    ctx.fillRect(x + len * 0.68, y + w - 1, wl, 1.8);
    // body
    const g = ctx.createLinearGradient(0, y, 0, y + w);
    g.addColorStop(0, shade(color, 30));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -35));
    ctx.fillStyle = g;
    rr(ctx, x, y, len, w, Math.min(5, w * 0.38));
    ctx.fill();
    // glass + roof
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    rr(ctx, x + len * 0.58, y + w * 0.16, len * 0.15, w * 0.68, 2);
    ctx.fill();
    rr(ctx, x + len * 0.17, y + w * 0.2, len * 0.1, w * 0.6, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, x + len * 0.29, y + w * 0.2, len * 0.27, w * 0.6, 2);
    ctx.fill();
  }

  // headlights
  ctx.fillStyle = '#FEF9C3';
  ctx.fillRect(x + len - 1.6, y + 1.5, 1.6, 2.4);
  ctx.fillRect(x + len - 1.6, y + w - 3.9, 1.6, 2.4);
  // tail lights (bright + glow when braking)
  ctx.fillStyle = braking ? '#EF4444' : '#7F1D1D';
  ctx.fillRect(x, y + 1.5, 1.8, 2.6);
  ctx.fillRect(x, y + w - 4.1, 1.8, 2.6);
  if (braking) {
    const glow = ctx.createRadialGradient(x, cy, 0, x, cy, w * 0.9);
    glow.addColorStop(0, 'rgba(239,68,68,0.45)');
    glow.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - w, cy - w, w * 1.2, w * 2);
  }
  ctx.restore();
}

export const SimulatorCanvas: React.FC<SimulatorCanvasProps> = ({
  mode,
  frame,
  showYolo = false,
  detections = [],
  totalDistance = 300,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef({ frame, mode, showYolo, detections, totalDistance });
  argsRef.current = { frame, mode, showYolo, detections, totalDistance };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || container.clientWidth <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = container.clientWidth;
    const H = Math.max(170, Math.round(W * (250 / 640)));
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { frame, mode, showYolo, totalDistance } = argsRef.current;
    const t = frame?.t ?? 0;

    // ── Geometry ──────────────────────────────────────────────
    const roadY = H * 0.3;
    const roadH = H * 0.5;
    const laneH = roadH / 2;
    const approachY = roadY + laneH * 1.5; // our lane (bottom)
    const oncomingY = roadY + laneH * 0.5;
    const stopX = W - 120;
    const startX = 16;
    // Zoomed approach: the last NEAR metres (where the queue sits) get most of the width
    const span = stopX - startX;
    const NEAR = Math.min(80, totalDistance * 0.6);
    const nearPx = span * 0.66;
    const scale = nearPx / NEAR; // px per metre near the junction
    const farScale = (span - nearPx) / Math.max(1, totalDistance - NEAR);
    const toPx = (m: number) => {
      const d = -m; // metres before the stop line (negative = past it)
      if (d <= NEAR) return stopX - d * scale;
      return stopX - nearPx - (d - NEAR) * farScale;
    };
    const crossX = stopX + 30;
    const crossW = 64;

    // ── Ground: grass + verge texture ─────────────────────────
    const grass = ctx.createLinearGradient(0, 0, 0, H);
    grass.addColorStop(0, '#5F8F4E');
    grass.addColorStop(1, '#4D7A3F');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 160; i++) {
      const gx = (i * 97.3) % W;
      const gy = (i * 53.7) % H;
      ctx.fillRect(gx, gy, 2, 2);
    }
    // footpaths
    ctx.fillStyle = '#C9C3B6';
    ctx.fillRect(0, roadY - 10, W, 8);
    ctx.fillRect(0, roadY + roadH + 2, W, 8);
    // trees on verge (deterministic)
    for (let i = 0; i < 7; i++) {
      const tx = 40 + i * ((stopX - 60) / 6);
      [[roadY - 24, 9], [roadY + roadH + 26, 8]].forEach(([ty, r]) => {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(tx + 3, ty + 3, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2F6B2E';
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3F8A3B';
        ctx.beginPath();
        ctx.arc(tx - r * 0.25, ty - r * 0.25, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ── Road ──────────────────────────────────────────────────
    const asphalt = ctx.createLinearGradient(0, roadY, 0, roadY + roadH);
    asphalt.addColorStop(0, '#45454B');
    asphalt.addColorStop(0.5, '#3B3B41');
    asphalt.addColorStop(1, '#434349');
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, roadY, W, roadH);
    // cross street
    ctx.fillStyle = '#3E3E44';
    ctx.fillRect(crossX, 0, crossW, H);
    ctx.fillStyle = '#C9C3B6';
    ctx.fillRect(crossX - 6, 0, 6, roadY - 2);
    ctx.fillRect(crossX + crossW, 0, 6, roadY - 2);
    ctx.fillRect(crossX - 6, roadY + roadH + 2, 6, H);
    ctx.fillRect(crossX + crossW, roadY + roadH + 2, 6, H);
    // asphalt speckle
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 400; i++) ctx.fillRect((i * 37.1) % W, roadY + ((i * 13.7) % roadH), 1, 1);
    // kerbs
    for (let kx = 0; kx < W; kx += 14) {
      if (kx > crossX - 6 && kx < crossX + crossW + 6) continue;
      ctx.fillStyle = (kx / 14) % 2 ? '#E5E7EB' : '#9CA3AF';
      ctx.fillRect(kx, roadY - 2, 14, 2.5);
      ctx.fillRect(kx, roadY + roadH, 14, 2.5);
    }
    // centre line (double yellow near junction, dashed elsewhere)
    ctx.fillStyle = '#FACC15';
    const solidFrom = stopX - 70;
    for (let dx = 0; dx < solidFrom; dx += 26) ctx.fillRect(dx, roadY + laneH - 1, 14, 2);
    ctx.fillRect(solidFrom, roadY + laneH - 2.5, stopX - solidFrom, 1.6);
    ctx.fillRect(solidFrom, roadY + laneH + 1, stopX - solidFrom, 1.6);
    ctx.fillRect(crossX + crossW + 10, roadY + laneH - 1, W, 2);

    // painted arrow + "AMBULANCE" box marking in approach lane
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const ax = stopX - 46;
    ctx.beginPath();
    ctx.moveTo(ax + 14, approachY);
    ctx.lineTo(ax + 4, approachY - 7);
    ctx.lineTo(ax + 4, approachY - 2.5);
    ctx.lineTo(ax - 12, approachY - 2.5);
    ctx.lineTo(ax - 12, approachY + 2.5);
    ctx.lineTo(ax + 4, approachY + 2.5);
    ctx.lineTo(ax + 4, approachY + 7);
    ctx.closePath();
    ctx.fill();

    // stop line + zebra
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(stopX, roadY + laneH + 2, 4, laneH - 4);
    for (let s = 0; s < 8; s++) ctx.fillRect(stopX + 10, roadY + 3 + s * (roadH / 8), 16, roadH / 8 - 4);

    // ── Predictive flush zone (subtle) ────────────────────────
    if (mode === 'predictive' && frame?.signal === 'GREEN') {
      const zoneStart = toPx(-Math.min(totalDistance * 0.6, 160));
      const g = ctx.createLinearGradient(zoneStart, 0, stopX, 0);
      g.addColorStop(0, 'rgba(34,197,94,0)');
      g.addColorStop(1, 'rgba(34,197,94,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(zoneStart, roadY + laneH + 2, stopX - zoneStart, laneH - 4);
    }

    // distance markers on footpath
    ctx.font = '600 9px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(31,41,55,0.75)';
    [300, 200, 100, 50].forEach((d) => {
      if (d > totalDistance) return;
      const tx = toPx(-d);
      if (tx < startX + 10 || tx > stopX - 30) return;
      ctx.fillRect(tx, roadY + roadH + 2, 1.5, 8);
      ctx.fillText(`${d} m`, tx + 3, roadY + roadH + 9);
    });

    // ── Oncoming traffic (decorative, deterministic on t) ─────
    const carLen = 4.5 * scale;
    const carW = Math.min(laneH * 0.5, 2.0 * scale);
    for (let k = 0; k < 3; k++) {
      const span = W + 160;
      const ox = W + 60 - ((t * 75 + k * (span / 3)) % span);
      drawVehicle(ctx, ox, oncomingY, carLen, carW, CAR_COLORS[(k * 3 + 1) % CAR_COLORS.length], 'car', false, true);
    }

    // ── Queue vehicles ────────────────────────────────────────
    const vehicles = frame?.vehicles || [];
    vehicles.forEach((veh, idx) => {
      const front = toPx(veh.x);
      if (front < -60 || front > W + 60) return;
      const type = veh.type || 'car';
      const metres = veh.length || (type === 'bus' ? 12 : type === 'truck' ? 10 : 4.5);
      const len = type === 'motorcycle' ? 2.2 * scale : metres * scale;
      const w = type === 'bus' || type === 'truck' ? Math.min(laneH * 0.62, 2.55 * scale) : carW;
      const color = type === 'bus' ? '#D97706' : type === 'truck' ? '#1D4ED8' : CAR_COLORS[(veh.id ?? idx) % CAR_COLORS.length];
      const braking = (veh.v ?? 0) < 0.5 && !veh.passed;
      drawVehicle(ctx, front - len, approachY, len, w, color, type, braking);

      if (veh.reacting) {
        ctx.strokeStyle = 'rgba(251,191,36,0.9)';
        ctx.lineWidth = 1.5;
        rr(ctx, front - len - 3, approachY - w / 2 - 3, len + 6, w + 6, 5);
        ctx.stroke();
      }
      if (showYolo && !veh.passed && front < stopX + 4) {
        ctx.strokeStyle = 'rgba(34,211,238,0.95)';
        ctx.lineWidth = 1;
        ctx.strokeRect(front - len - 1.5, approachY - w / 2 - 1.5, len + 3, w + 3);
      }
    });

    // ── Ambulance ─────────────────────────────────────────────
    if (frame?.ambulance) {
      const amb = frame.ambulance;
      const front = toPx(amb.x);
      const len = 6.2 * scale;
      const w = Math.min(laneH * 0.55, 2.3 * scale);
      const rear = front - len;
      const y = approachY - w / 2;
      const flash = Math.floor(t * 8) % 2 === 0;

      if (front > -60 && front < W + 80) {
        // siren wash on the road
        const wash = ctx.createRadialGradient(rear + len * 0.6, approachY, 2, rear + len * 0.6, approachY, 46);
        wash.addColorStop(0, flash ? 'rgba(239,68,68,0.38)' : 'rgba(59,130,246,0.38)');
        wash.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = wash;
        ctx.fillRect(rear - 30, approachY - 50, len + 80, 100);
        // headlight beams
        const beam = ctx.createLinearGradient(front, 0, front + 60, 0);
        beam.addColorStop(0, 'rgba(254,249,195,0.35)');
        beam.addColorStop(1, 'rgba(254,249,195,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(front, approachY - 3);
        ctx.lineTo(front + 60, approachY - 14);
        ctx.lineTo(front + 60, approachY + 14);
        ctx.lineTo(front, approachY + 3);
        ctx.closePath();
        ctx.fill();

        // body
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        rr(ctx, rear + 2, y + 2.5, len, w, 3);
        ctx.fill();
        ctx.fillStyle = '#0B0B0B';
        ctx.fillRect(rear + len * 0.15, y - 0.8, 5, 1.8);
        ctx.fillRect(rear + len * 0.15, y + w - 1, 5, 1.8);
        ctx.fillRect(rear + len * 0.72, y - 0.8, 5, 1.8);
        ctx.fillRect(rear + len * 0.72, y + w - 1, 5, 1.8);
        ctx.fillStyle = '#FAFAFA';
        rr(ctx, rear, y, len, w, 3);
        ctx.fill();
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // cab + windscreen
        ctx.fillStyle = '#EEF2F7';
        rr(ctx, rear + len * 0.76, y + 0.6, len * 0.24, w - 1.2, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(15,23,42,0.85)';
        rr(ctx, rear + len * 0.82, y + w * 0.17, len * 0.1, w * 0.66, 2);
        ctx.fill();
        // red side stripes + roof cross
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(rear + 1, y, len * 0.74, 1.6);
        ctx.fillRect(rear + 1, y + w - 1.6, len * 0.74, 1.6);
        const cx = rear + len * 0.38;
        ctx.fillRect(cx - 4, approachY - 1.4, 8, 2.8);
        ctx.fillRect(cx - 1.4, approachY - 4, 2.8, 8);
        // light bar
        ctx.fillStyle = '#111827';
        ctx.fillRect(rear + len * 0.68, y + 1.5, 3, w - 3);
        ctx.fillStyle = flash ? '#EF4444' : '#3B82F6';
        ctx.fillRect(rear + len * 0.68, y + 1.5, 3, (w - 3) / 2);
        ctx.fillStyle = flash ? '#3B82F6' : '#EF4444';
        ctx.fillRect(rear + len * 0.68, y + 1.5 + (w - 3) / 2, 3, (w - 3) / 2);

        // speed tag
        const kmh = Math.round((amb.v ?? 0) * 3.6);
        const tag = `${kmh} km/h`;
        ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
        const tw = ctx.measureText(tag).width + 10;
        ctx.fillStyle = 'rgba(17,24,39,0.82)';
        const tagX = Math.max(4, Math.min(W - tw - 4, rear + len / 2 - tw / 2));
        rr(ctx, tagX, y - 18, tw, 13, 6);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(tag, tagX + 5, y - 8.5);

        // stalled bubble
        const stalled = amb.blocked_s ?? amb.wait_accumulated_s ?? 0;
        if ((amb.blocked || (stalled > 0.05 && (amb.v ?? 0) < 1)) && !amb.arrived) {
          const msg = `Stopped behind queue · ${stalled.toFixed(1)}s`;
          ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
          const mw = ctx.measureText(msg).width + 14;
          const bx = Math.max(6, Math.min(W - mw - 6, front - mw / 2));
          const by = roadY - 30;
          ctx.fillStyle = '#DC2626';
          rr(ctx, bx, by, mw, 18, 6);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(msg, bx + 7, by + 12.5);
        }
      }
    }

    // ── Traffic signal on the verge ───────────────────────────
    const sigX = stopX + 2;
    const sigY = roadY + roadH + 12;
    ctx.fillStyle = '#4B5563';
    ctx.fillRect(sigX + 7, sigY + 34, 3, H - sigY - 34);
    ctx.fillStyle = '#0B0B0B';
    rr(ctx, sigX, sigY - 2, 17, 38, 4);
    ctx.fill();
    const s = frame?.signal || 'RED';
    const lamps: [string, boolean, string][] = [
      ['#EF4444', s === 'RED' || s === 'ALL_RED', '#3A1515'],
      ['#F59E0B', s === 'YELLOW', '#3A2E10'],
      ['#22C55E', s === 'GREEN', '#11291A'],
    ];
    lamps.forEach(([on, lit, off], i) => {
      const ly = sigY + 5 + i * 11;
      if (lit) {
        const g = ctx.createRadialGradient(sigX + 8.5, ly, 1, sigX + 8.5, ly, 13);
        g.addColorStop(0, on);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sigX + 8.5, ly, 13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = lit ? on : off;
      ctx.beginPath();
      ctx.arc(sigX + 8.5, ly, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── YOLO summary chip ─────────────────────────────────────
    if (showYolo) {
      const waiting = vehicles.filter((v) => !v.passed);
      const counts: Record<string, number> = {};
      waiting.forEach((v) => (counts[v.type || 'car'] = (counts[v.type || 'car'] || 0) + 1));
      const txt = `YOLO · ${waiting.length} in queue` + (waiting.length ? ' (' + Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ') + ')' : '');
      ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
      const cw = ctx.measureText(txt).width + 14;
      ctx.fillStyle = 'rgba(8,145,178,0.92)';
      rr(ctx, 10, H - 28, cw, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(txt, 17, H - 15.5);
    }

    // ── Status chip (top-left) ────────────────────────────────
    let chip = '';
    let chipColor = '';
    const queued = vehicles.filter((v) => !v.passed && (v.v ?? 0) < 0.5).length;
    if (mode === 'predictive') {
      if (frame?.prediction_label) {
        chip = frame.prediction_label;
        chipColor = '#5E1B48';
      } else if (frame?.signal === 'GREEN' && vehicles.some((v) => !v.passed)) {
        chip = `Early green · ${vehicles.filter((v) => !v.passed).length} vehicles clearing`;
        chipColor = '#15803D';
      } else if (frame?.signal === 'GREEN') {
        chip = 'Lane clear — no stop needed';
        chipColor = '#15803D';
      }
    } else if (frame) {
      chip = frame.signal === 'GREEN' ? 'Green on arrival — queue starting' : `Red · ${queued} vehicles waiting`;
      chipColor = frame.signal === 'GREEN' ? '#B45309' : '#B91C1C';
    }
    if (chip) {
      ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
      const cw = ctx.measureText(chip).width + 16;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      rr(ctx, 10, 10, cw, 20, 10);
      ctx.fill();
      ctx.fillStyle = chipColor;
      ctx.beginPath();
      ctx.arc(19, 20, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1F2937';
      ctx.fillText(chip, 26, 23.5);
    }
  }, []);

  useEffect(() => {
    draw();
  }, [draw, frame, mode, showYolo, detections, totalDistance]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden border border-black/10 shadow-inner bg-[#4D7A3F]">
      <canvas ref={canvasRef} className="w-full block" />
    </div>
  );
};
