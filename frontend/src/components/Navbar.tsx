import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeBackendStatus, checkHealth } from '../api';
import { PlayCircle, RefreshCw, Menu, X, Lock } from 'lucide-react';

interface NavbarProps {
  onOpenJudgeDemo: () => void;
}

const navItems = [
  { label: 'Overview', path: '/' },
  { label: 'Simulator', path: '/simulator' },
  { label: 'Corridor', path: '/corridor' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Architecture', path: '/architecture' },
];

/** QueueFlush logo: a "Q" drawn as a road loop, tail = flush arrow, green signal inside. */
export const BrandMark: React.FC<{ className?: string; animated?: boolean; onDark?: boolean }> = ({
  className = 'w-10 h-10',
  animated = true,
  onDark = false,
}) => {
  const id = React.useId().replace(/:/g, '');
  const ring = 'M41.9 41.9 A15 15 0 1 1 46 31';
  const ringColor = onDark ? '#FFFFFF' : '#5E1B48';
  const dashColor = onDark ? '#5E1B48' : '#FFFFFF';
  const draw = animated ? { initial: { pathLength: 0 }, animate: { pathLength: 1 } } : {};
  return (
    <svg viewBox="8 8 50 50" className={`${className} shrink-0`} role="img" aria-label="QueueFlush AI logo">
      <defs>
        <linearGradient id={`tl${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ringColor} />
          <stop offset="1" stopColor="#F25C8A" />
        </linearGradient>
      </defs>
      <motion.path d={ring} fill="none" stroke={ringColor} strokeWidth="5.5" strokeLinecap="round" {...draw} transition={{ duration: 0.9, ease: 'easeInOut' }} />
      <motion.path
        d={ring} fill="none" stroke={dashColor} strokeWidth="1.2" strokeDasharray="2.2 3.2" strokeLinecap="round" opacity={0.7}
        animate={animated ? { strokeDashoffset: [0, -10.8] } : undefined}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path d="M39.5 39.5 L51 51" stroke={`url(#tl${id})`} strokeWidth="5.5" strokeLinecap="round" {...draw} transition={{ duration: 0.35, delay: 0.8 }} />
      <motion.path
        d="M44.5 52.5 L52.5 52.5 L52.5 44.5" fill="none" stroke="#F25C8A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        initial={animated ? { opacity: 0, x: -4, y: -4 } : undefined} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 1.05, duration: 0.3 }}
      />
      <motion.circle cx="30" cy="30" r="7.6" fill="#22C55E" opacity={0.22}
        animate={animated ? { r: [6, 9, 6], opacity: [0.3, 0.08, 0.3] } : undefined}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
      <circle cx="30" cy="30" r="4.6" fill="#22C55E" />
      <circle cx="28.7" cy="28.7" r="1.4" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
};

export const Navbar: React.FC<NavbarProps> = ({ onOpenJudgeDemo }) => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeBackendStatus((online) => setIsOnline(online));
    checkHealth();
    const interval = setInterval(() => checkHealth(), 10000);
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      unsub();
      clearInterval(interval);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleRetry = async () => {
    setChecking(true);
    await checkHealth();
    setChecking(false);
  };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50">
      <motion.div
        animate={{
          paddingTop: scrolled ? 8 : 14,
          paddingBottom: scrolled ? 8 : 14,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`px-4 lg:px-8 transition-[background,box-shadow,border-color] duration-300 border-b ${
          scrolled
            ? 'glass border-[#EDE3E9] shadow-[0_8px_30px_-12px_rgba(94,27,72,0.18)]'
            : 'bg-white/60 backdrop-blur-sm border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <motion.div whileHover={{ rotate: -6, scale: 1.06 }} transition={{ type: 'spring', stiffness: 300 }}>
              <BrandMark />
            </motion.div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg text-[#1F0A18] tracking-tight">
                QueueFlush<span className="text-[#A8487F]"> AI</span>
              </div>
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#7A6B76]">
                Predictive Emergency Preemption
              </div>
            </div>
          </Link>

          {/* Desktop navigation with sliding active pill */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-[#F7F0F4]/80 border border-[#EDE3E9]">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
                    active ? 'text-white' : 'text-[#5B4A57] hover:text-[#5E1B48]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-[#5E1B48] shadow-plum"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Engine live
              </div>
            ) : (
              <button
                onClick={handleRetry}
                disabled={checking}
                title="Retry backend connection"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Offline demo
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              </button>
            )}

            <Link
              to="/login"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold text-[#5E1B48] hover:bg-[#F5E6EF] transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              Portal
            </Link>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenJudgeDemo}
              className="btn-shine flex items-center gap-2 bg-[#5E1B48] hover:bg-[#48133A] text-white pl-3.5 pr-2 py-2 rounded-full text-[13px] font-bold shadow-plum cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Judge Demo</span>
              <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">D</kbd>
            </motion.button>

            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden p-2 rounded-full hover:bg-[#F5E6EF] text-[#5E1B48] cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden max-w-7xl mx-auto"
            >
              <div className="pt-3 pb-1 grid gap-1">
                {[...navItems, { label: 'Portal Login', path: '/login' }].map((item, i) => (
                  <motion.div
                    key={item.path}
                    initial={{ x: -12, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={item.path}
                      className={`block px-4 py-2.5 rounded-xl text-sm font-semibold ${
                        isActive(item.path) ? 'bg-[#5E1B48] text-white' : 'text-[#3F3340] hover:bg-[#F5E6EF]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.div>
    </header>
  );
};
