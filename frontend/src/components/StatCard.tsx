import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  subtext: string;
  accentColor: 'teal' | 'amber' | 'blue' | 'green';
  icon: LucideIcon;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  subtext,
  accentColor,
  icon: Icon,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (value - start) * ease;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [value]);

  const colorStyles = {
    teal: {
      bar: 'bg-[#5E1B48]',
      iconBg: 'bg-[#F5E6EF]',
      iconText: 'text-[#5E1B48]',
      numText: 'text-[#5E1B48]',
    },
    amber: {
      bar: 'bg-[#D97706]',
      iconBg: 'bg-[#FEF3C7]',
      iconText: 'text-[#D97706]',
      numText: 'text-[#D97706]',
    },
    blue: {
      bar: 'bg-[#2563EB]',
      iconBg: 'bg-[#DBEAFE]',
      iconText: 'text-[#2563EB]',
      numText: 'text-[#2563EB]',
    },
    green: {
      bar: 'bg-[#16A34A]',
      iconBg: 'bg-[#DCFCE7]',
      iconText: 'text-[#16A34A]',
      numText: 'text-[#16A34A]',
    },
  }[accentColor];

  return (
    <div className="relative bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-soft shadow-card-hover overflow-hidden">
      {/* 4px top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${colorStyles.bar}`} />

      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          {label}
        </span>
        <div className={`w-10 h-10 rounded-xl ${colorStyles.iconBg} ${colorStyles.iconText} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 my-2">
        <span className={`text-5xl font-extrabold tracking-tight num-font ${colorStyles.numText}`}>
          {displayValue.toFixed(1)}
        </span>
        <span className="text-xl font-bold text-[#64748B]">{unit}</span>
      </div>

      <p className="text-xs text-[#64748B] font-medium mt-1">
        {subtext}
      </p>
    </div>
  );
};
