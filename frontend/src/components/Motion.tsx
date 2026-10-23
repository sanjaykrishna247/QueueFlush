import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate, useMotionValue, useSpring, useTransform } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades + slides children in when they scroll into view. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}> = ({ children, delay = 0, y = 28, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.8, delay, ease: EASE }}
  >
    {children}
  </motion.div>
);

/** Number that counts up from 0 once visible. */
export const CountUp: React.FC<{ value: number; decimals?: number; duration?: number; className?: string }> = ({
  value,
  decimals = 1,
  duration = 1.8,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}
    </span>
  );
};

/** Splits a line into words that rise in one after another. */
export const WordReveal: React.FC<{ text: string; className?: string; delay?: number }> = ({ text, className, delay = 0 }) => (
  <span className={className}>
    {text.split(' ').map((w, i) => (
      <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.08em]">
        <motion.span
          className="inline-block"
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          transition={{ duration: 0.9, delay: delay + i * 0.08, ease: EASE }}
        >
          {w}
          {' '}
        </motion.span>
      </span>
    ))}
  </span>
);

/** Card that tilts slightly toward the cursor. */
export const TiltCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 });

  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
    >
      {children}
    </motion.div>
  );
};

/** Soft plum gradient blobs that drift in the background. */
export const AuroraBackground: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden -z-10 ${className}`}>
    <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-[#5E1B48]/20 blur-[110px] animate-blob" />
    <div className="absolute top-10 right-[-120px] w-[460px] h-[460px] rounded-full bg-[#F25C8A]/20 blur-[110px] animate-blob [animation-delay:-6s]" />
    <div className="absolute bottom-[-160px] left-1/3 w-[520px] h-[520px] rounded-full bg-[#A8487F]/15 blur-[120px] animate-blob [animation-delay:-12s]" />
    <div className="absolute inset-0 bg-line-grid" />
  </div>
);
