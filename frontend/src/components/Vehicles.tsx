import React from 'react';
import { motion } from 'framer-motion';

/** Top-down car, facing right. Draws at 100x46 in its own viewBox; size with CSS. */
export const TopCar: React.FC<{
  color?: string;
  brake?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  kind?: 'car' | 'suv' | 'bus';
}> = ({ color = '#94A3B8', brake, className, style, kind = 'car' }) => {
  const id = React.useId().replace(/:/g, '');
  if (kind === 'bus') {
    return (
      <svg viewBox="0 0 180 50" className={className} style={style}>
        <defs>
          <linearGradient id={`bb${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.85" />
            <stop offset="0.5" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <rect x="3" y="4" width="174" height="42" rx="6" fill="rgba(0,0,0,0.35)" transform="translate(2 3)" />
        <rect x="2" y="3" width="174" height="44" rx="6" fill={`url(#bb${id})`} />
        <rect x="160" y="7" width="12" height="36" rx="3" fill="#1E293B" opacity="0.85" />
        {[20, 50, 80, 110, 140].map((x) => (
          <rect key={x} x={x} y="10" width="22" height="30" rx="2" fill="white" opacity="0.18" />
        ))}
        <rect x="174" y="8" width="3" height="7" rx="1" fill="#FEF9C3" />
        <rect x="174" y="35" width="3" height="7" rx="1" fill="#FEF9C3" />
        <g>{brake}</g>
      </svg>
    );
  }
  const len = kind === 'suv' ? 104 : 100;
  return (
    <svg viewBox={`0 0 ${len} 46`} className={className} style={style}>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.8" />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <rect x="4" y="5" width={len - 6} height="38" rx="12" fill="rgba(0,0,0,0.35)" transform="translate(2 3)" />
      {/* wheels */}
      <rect x="14" y="1" width="16" height="6" rx="2" fill="#111" />
      <rect x="14" y="39" width="16" height="6" rx="2" fill="#111" />
      <rect x={len - 32} y="1" width="16" height="6" rx="2" fill="#111" />
      <rect x={len - 32} y="39" width="16" height="6" rx="2" fill="#111" />
      {/* body */}
      <rect x="2" y="4" width={len - 4} height="38" rx="12" fill={`url(#b${id})`} />
      {/* windscreen, roof, rear glass */}
      <path d={`M${len - 36} 9 Q${len - 22} 23 ${len - 36} 37 L${len - 44} 35 Q${len - 36} 23 ${len - 44} 11 Z`} fill="#1E293B" opacity="0.85" />
      <rect x="30" y="10" width={len - 76} height="26" rx="5" fill="white" opacity="0.12" />
      <path d="M22 11 Q14 23 22 35 L28 34 Q23 23 28 12 Z" fill="#1E293B" opacity="0.8" />
      {/* mirrors */}
      <rect x={len - 42} y="0" width="5" height="4" rx="1.5" fill={color} />
      <rect x={len - 42} y="42" width="5" height="4" rx="1.5" fill={color} />
      {/* headlights */}
      <rect x={len - 5} y="8" width="3" height="7" rx="1.5" fill="#FEF9C3" />
      <rect x={len - 5} y="31" width="3" height="7" rx="1.5" fill="#FEF9C3" />
      {/* tail lights (dim) */}
      <rect x="2" y="7" width="3" height="8" rx="1.5" fill="#7F1D1D" />
      <rect x="2" y="31" width="3" height="8" rx="1.5" fill="#7F1D1D" />
      <g>{brake}</g>
    </svg>
  );
};

/** Bright brake-light overlay, animated by the parent via `animate` on opacity. */
export const BrakeGlow: React.FC<{ opacity: number[]; times: number[]; duration: number }> = ({ opacity, times, duration }) => (
  <motion.g animate={{ opacity }} transition={{ duration, times, repeat: Infinity }}>
    <rect x="0" y="6" width="6" height="10" rx="2" fill="#EF4444" />
    <rect x="0" y="30" width="6" height="10" rx="2" fill="#EF4444" />
    <ellipse cx="0" cy="11" rx="8" ry="7" fill="#EF4444" opacity="0.35" />
    <ellipse cx="0" cy="35" rx="8" ry="7" fill="#EF4444" opacity="0.35" />
  </motion.g>
);

/** Top-down ambulance with flashing light bar, facing right. */
export const TopAmbulance: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg viewBox="0 0 120 50" className={className} style={{ overflow: 'visible', ...style }}>
    {/* siren glow on the road */}
    <motion.ellipse
      cx="70" cy="25" rx="62" ry="36" fill="#EF4444"
      animate={{ opacity: [0.28, 0.05, 0.05, 0.05], fill: ['#EF4444', '#EF4444', '#3B82F6', '#3B82F6'] }}
      transition={{ duration: 0.6, repeat: Infinity, times: [0, 0.45, 0.5, 1] }}
      style={{ filter: 'blur(10px)' }}
    />
    <motion.ellipse
      cx="70" cy="25" rx="62" ry="36" fill="#3B82F6"
      animate={{ opacity: [0.05, 0.05, 0.3, 0.05] }}
      transition={{ duration: 0.6, repeat: Infinity, times: [0, 0.5, 0.75, 1] }}
      style={{ filter: 'blur(10px)' }}
    />
    {/* headlight beams */}
    <path d="M117 10 L170 0 L170 22 Z" fill="#FEF9C3" opacity="0.18" />
    <path d="M117 40 L170 28 L170 50 Z" fill="#FEF9C3" opacity="0.18" />
    <rect x="4" y="6" width="114" height="42" rx="7" fill="rgba(0,0,0,0.35)" transform="translate(2 2)" />
    {/* wheels */}
    <rect x="16" y="1" width="18" height="6" rx="2" fill="#111" />
    <rect x="16" y="43" width="18" height="6" rx="2" fill="#111" />
    <rect x="86" y="1" width="18" height="6" rx="2" fill="#111" />
    <rect x="86" y="43" width="18" height="6" rx="2" fill="#111" />
    {/* body */}
    <rect x="2" y="4" width="116" height="42" rx="7" fill="#FAFAFA" stroke="#E2E8F0" />
    {/* cab */}
    <path d="M92 6 L112 9 Q118 25 112 41 L92 44 Z" fill="#F1F5F9" />
    <path d="M100 10 Q108 25 100 40 L95 39 Q101 25 95 11 Z" fill="#1E293B" opacity="0.85" />
    {/* side stripes */}
    <rect x="4" y="4" width="86" height="4" fill="#DC2626" />
    <rect x="4" y="42" width="86" height="4" fill="#DC2626" />
    {/* roof cross */}
    <rect x="38" y="19" width="22" height="12" rx="1" fill="#DC2626" />
    <rect x="43" y="14" width="12" height="22" rx="1" fill="#DC2626" />
    {/* light bar */}
    <rect x="84" y="10" width="6" height="30" rx="2" fill="#1E293B" />
    <motion.rect x="84" y="10" width="6" height="14" rx="2" fill="#EF4444"
      animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 0.3, repeat: Infinity }} />
    <motion.rect x="84" y="26" width="6" height="14" rx="2" fill="#3B82F6"
      animate={{ opacity: [0.15, 1, 0.15] }} transition={{ duration: 0.3, repeat: Infinity }} />
    {/* headlights */}
    <rect x="114" y="8" width="3" height="7" rx="1.5" fill="#FEF9C3" />
    <rect x="114" y="35" width="3" height="7" rx="1.5" fill="#FEF9C3" />
  </svg>
);
