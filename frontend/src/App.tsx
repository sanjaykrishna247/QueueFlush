import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { CorridorPage } from './pages/CorridorPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { AuthGatewayPage } from './pages/AuthGatewayPage';
import { JudgeDemoModal } from './pages/JudgeDemoModal';

export const App: React.FC = () => {
  const [judgeDemoOpen, setJudgeDemoOpen] = useState<boolean>(false);

  // Global key listener for 'D' to open Judge Demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setJudgeDemoOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Router>
      <Shell onOpenJudgeDemo={() => setJudgeDemoOpen(true)} />
      <JudgeDemoModal isOpen={judgeDemoOpen} onClose={() => setJudgeDemoOpen(false)} />
    </Router>
  );
};

const Shell: React.FC<{ onOpenJudgeDemo: () => void }> = ({ onOpenJudgeDemo }) => {
  const location = useLocation();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFB] text-[#3F3340] font-sans antialiased">
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] z-[60] origin-left bg-gradient-to-r from-[#5E1B48] via-[#A8487F] to-[#F25C8A]"
        style={{ scaleX: progress }}
      />
      <Navbar onOpenJudgeDemo={onOpenJudgeDemo} />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<LandingPage onOpenJudgeDemo={onOpenJudgeDemo} />} />
              <Route path="/simulator" element={<SimulatorPage />} />
              <Route path="/corridor" element={<CorridorPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/architecture" element={<ArchitecturePage />} />
              <Route path="/admin" element={<AuthGatewayPage />} />
              <Route path="/admin/login" element={<AuthGatewayPage />} />
              <Route path="/login" element={<AuthGatewayPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
};

export default App;
