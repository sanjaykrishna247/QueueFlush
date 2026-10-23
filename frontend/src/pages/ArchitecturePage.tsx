import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { verifyToken, signToken } from '../api';
import { Reveal } from '../components/Motion';
import { TopAmbulance } from '../components/Vehicles';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Radio,
  Eye,
  Cpu,
  TrafficCone,
  ArrowRight,
  Layers,
  Server,
  ChevronDown,
} from 'lucide-react';

const nodes = [
  { icon: Radio, title: 'Emergency vehicle', sub: 'On-board unit', facts: ['GPS at 10 Hz', 'HMAC-SHA256 signed'] },
  { icon: Eye, title: 'Edge camera', sub: 'Approach lane', facts: ['YOLOv8 on device', 'Queue count + vehicle mix'] },
  { icon: Cpu, title: 'Predictor', sub: 'QueueFlush core', facts: ['T_clear equation', 'Weather + heavy vehicles'], core: true },
  { icon: ShieldCheck, title: 'Safety layer', sub: 'Deterministic rules', facts: ['Pedestrian hold', 'Heartbeat fallback'] },
  { icon: TrafficCone, title: 'Signal controller', sub: 'Cabinet interface', facts: ['NEMA TS2 / 2070', 'Early green pulse'] },
];

const safetyRules = [
  {
    title: 'Pedestrians finish crossing first',
    threshold: 'Walk phase < 3.0 s remaining',
    action: 'Safety hold',
    description: 'If people are still on the crossing when early green would fire, the signal waits until they have cleared.',
    scenario: 'school-zone-pedestrian',
  },
  {
    title: 'Cross traffic is never cut off',
    threshold: '≥ 3.0 s yellow + 1.0 s all-red',
    action: 'Enforced clearance',
    description: 'Side-street traffic always gets a full yellow and all-red interval before the approach turns green.',
    scenario: 'market-gridlock',
  },
  {
    title: 'Lost signal means safe timers',
    threshold: 'Telemetry silent > 2.0 s',
    action: 'Fail-safe revert',
    description: 'If the ambulance stops reporting, the junction drops back to its fixed, pre-approved preemption timing.',
    scenario: 'telemetry-dropout',
  },
  {
    title: 'Too close? Flush what we can',
    threshold: 'ETA < T_clear',
    action: 'Partial flush',
    description: 'When the ambulance is already near, green fires immediately to move as much of the queue as possible.',
    scenario: 'too-close-partial-flush',
  },
];

export const ArchitecturePage: React.FC = () => {
  const [deviceId, setDeviceId] = useState<string>('AMB-01');
  const [tokenPayload, setTokenPayload] = useState<string>(
    '{"id":"AMB-01","speed":110,"lat":10.782,"lng":79.131,"t":1729600000}'
  );
  const [verificationResult, setVerificationResult] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [sentKind, setSentKind] = useState<'valid' | 'spoof' | null>(null);
  const [packetKey, setPacketKey] = useState(0);

  const [sentSig, setSentSig] = useState<string>('');

  const handleTestToken = async (spoof: boolean) => {
    setIsVerifying(true);
    setVerificationResult(null);
    setSentKind(spoof ? 'spoof' : 'valid');

    // Valid: the vehicle's on-board unit signs with its own key.
    // Forged: an attacker without the key makes up a signature.
    let signature: string;
    let signError: string | null = null;
    if (spoof) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      signature = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } else {
      const signed = await signToken({ device_id: deviceId, payload: tokenPayload });
      if ('signature' in signed) {
        signature = signed.signature;
      } else {
        signature = '';
        signError = signed.error;
      }
    }
    setSentSig(signature);
    setPacketKey((k) => k + 1);

    const delay = new Promise((r) => setTimeout(r, 1100)); // let the packet travel
    const result = await verifyToken({ device_id: deviceId, payload: tokenPayload, signature: signature || 'unsigned' });
    await delay;
    setVerificationResult(signError && !result.valid ? { valid: false, reason: signError } : result);
    setIsVerifying(false);
  };

  return (
    <div className="bg-[#FCFAFB] min-h-screen">
      {/* Header */}
      <section className="border-b border-[#EDE3E9] bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#A8487F]">
            <Layers className="w-4 h-4" /> Architecture &amp; safety
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-[#1F0A18]">How a siren becomes a green light</h1>
          <p className="mt-2 text-[#5B4A57] max-w-2xl">
            Five pieces, each with one job. Every message is signed, and every decision passes a rule-based safety check
            before it reaches the signal.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-10">
        {/* Pipeline */}
        <Reveal>
          <div className="bg-white rounded-2xl border border-[#EDE3E9] p-6 sm:p-8 shadow-soft">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-lg font-bold text-[#1F0A18]">Data path</h2>
              <span className="text-sm text-[#7A6B76]">end-to-end at the edge, &lt; 35 ms</span>
            </div>

            <div className="relative">
              {/* connector with travelling packets */}
              <div className="hidden md:block absolute left-[10%] right-[10%] top-7 h-[2px] bg-[#EDE3E9]">
                {[0, 1, 2].map((k) => (
                  <motion.span
                    key={k}
                    className="absolute -top-[3px] w-2 h-2 rounded-full bg-[#5E1B48] shadow-[0_0_10px_rgba(94,27,72,0.6)]"
                    animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 3, delay: k, repeat: Infinity, ease: 'linear' }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {nodes.map((n, i) => {
                  const Icon = n.icon;
                  return (
                    <motion.div
                      key={n.title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="relative text-center"
                    >
                      <div
                        className={`relative z-10 mx-auto w-14 h-14 rounded-xl flex items-center justify-center border ${
                          n.core ? 'bg-[#5E1B48] text-white border-[#5E1B48] shadow-plum' : 'bg-white text-[#5E1B48] border-[#EBCADC]'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="mt-4 text-xs text-[#7A6B76] font-mono">0{i + 1}</div>
                      <div className="font-semibold text-[#1F0A18]">{n.title}</div>
                      <div className="text-sm text-[#7A6B76]">{n.sub}</div>
                      <ul className="mt-3 space-y-1 text-[13px] text-[#5B4A57]">
                        {n.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        {/* HMAC handshake */}
        <Reveal>
          <div className="bg-white rounded-2xl border border-[#EDE3E9] p-6 sm:p-8 shadow-soft">
            <h2 className="text-lg font-bold text-[#1F0A18]">Try to spoof a siren</h2>
            <p className="text-[#5B4A57] mt-1 mb-7">
              Every preemption request carries an HMAC-SHA256 signature. Send a real one, then a forged one, and watch the
              signal cabinet decide.
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="relative">
                  <label className="block text-[13px] font-semibold text-[#3F3340] mb-1.5">Sending device</label>
                  <select
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="appearance-none w-full bg-white border border-[#E6DCE2] text-[#1F0A18] rounded-lg py-2.5 pl-3 pr-10 outline-none focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10 cursor-pointer"
                  >
                    <option value="AMB-01">AMB-01 · registered ambulance (TN 49 AB 1084)</option>
                    <option value="AMB-02">AMB-02 · registered trauma unit (TN 49 AC 2021)</option>
                    <option value="UNKNOWN-99">UNKNOWN-99 · unregistered device</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 bottom-3 w-4 h-4 text-[#7A6B76]" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#3F3340] mb-1.5">Telemetry payload</label>
                  <textarea
                    value={tokenPayload}
                    onChange={(e) => setTokenPayload(e.target.value)}
                    rows={3}
                    className="w-full bg-[#FBF7F9] text-[#3F3340] font-mono text-[13px] rounded-lg p-3 border border-[#E6DCE2] outline-none focus:border-[#5E1B48] focus:ring-4 focus:ring-[#5E1B48]/10"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTestToken(false)}
                    disabled={isVerifying}
                    className="bg-[#5E1B48] hover:bg-[#48133A] text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Send signed request
                  </button>
                  <button
                    onClick={() => handleTestToken(true)}
                    disabled={isVerifying}
                    className="bg-white hover:bg-red-50 text-red-600 border border-red-200 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Send forged request
                  </button>
                </div>
              </div>

              {/* visual */}
              <div className="rounded-xl bg-[#2C0A21] p-6 text-white flex flex-col">
                <div className="relative h-28 flex items-center">
                  <div className="w-24 shrink-0">
                    <TopAmbulance className="w-full h-auto" />
                    <div className="text-[11px] text-white/60 mt-2 text-center">{deviceId}</div>
                  </div>
                  <div className="relative flex-1 mx-4 h-[2px] bg-white/15">
                    <AnimatePresence>
                      {sentKind && (
                        <motion.div
                          key={packetKey}
                          className={`absolute -top-3 px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            sentKind === 'spoof' ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                          initial={{ left: '0%', opacity: 0 }}
                          animate={{ left: '82%', opacity: [0, 1, 1, 0] }}
                          transition={{ duration: 1.1, ease: 'easeInOut' }}
                        >
                          {sentSig ? `sig ${sentSig.slice(0, 6)}…${sentSig.slice(-4)}` : 'unsigned'}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div
                    animate={
                      verificationResult
                        ? verificationResult.valid
                          ? { borderColor: '#22C55E', boxShadow: '0 0 30px rgba(34,197,94,0.35)' }
                          : { borderColor: '#EF4444', boxShadow: '0 0 30px rgba(239,68,68,0.35)', x: [0, -6, 6, -4, 4, 0] }
                        : { borderColor: 'rgba(255,255,255,0.2)', boxShadow: '0 0 0 rgba(0,0,0,0)' }
                    }
                    transition={{ duration: 0.4 }}
                    className="w-24 shrink-0 rounded-lg border-2 bg-white/5 p-3 text-center"
                  >
                    <Server className="w-6 h-6 mx-auto text-white/80" />
                    <div className="text-[11px] text-white/60 mt-1">Signal cabinet</div>
                  </motion.div>
                </div>

                <div className="mt-6 flex-1 min-h-[96px]">
                  <AnimatePresence mode="wait">
                    {verificationResult ? (
                      <motion.div
                        key={verificationResult.valid ? 'ok' : 'bad'}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`rounded-lg p-4 border ${
                          verificationResult.valid ? 'bg-emerald-500/10 border-emerald-400/40' : 'bg-red-500/10 border-red-400/40'
                        }`}
                      >
                        <div className={`flex items-center gap-2 font-semibold ${verificationResult.valid ? 'text-emerald-300' : 'text-red-300'}`}>
                          {verificationResult.valid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                          {verificationResult.valid ? 'Accepted — preemption approved' : 'Rejected — preemption denied'}
                        </div>
                        <p className="text-sm text-white/70 mt-1">
                          {verificationResult.reason || (verificationResult.valid ? 'Signature matches the key registered for this vehicle.' : 'Request dropped and written to the audit log.')}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-white/50 text-center pt-6">
                        {isVerifying ? 'Verifying signature…' : 'Send a request to see the result.'}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <div className="pt-4 mt-4 border-t border-white/10 text-xs text-white/45 flex justify-between">
                  <span>256-bit shared key per vehicle</span>
                  <span>rejections are audited</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Safety rules */}
        <div>
          <Reveal>
            <h2 className="text-2xl font-bold text-[#1F0A18]">Four rules the AI can't override</h2>
            <p className="text-[#5B4A57] mt-1 mb-6">The predictor proposes; this deterministic layer decides.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            {safetyRules.map((rule, i) => (
              <Reveal key={rule.scenario} delay={(i % 2) * 0.08}>
                <div className="group h-full bg-white rounded-2xl border border-[#EDE3E9] p-6 shadow-soft shadow-card-hover flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-[#F5E6EF] text-[#5E1B48] font-bold flex items-center justify-center">{i + 1}</span>
                      <h3 className="font-semibold text-[#1F0A18] text-lg leading-snug pt-0.5">{rule.title}</h3>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">{rule.action}</span>
                  </div>
                  <p className="text-[#5B4A57] mt-3 leading-relaxed">{rule.description}</p>
                  <div className="mt-4 text-sm text-[#7A6B76]">
                    Trigger: <span className="font-mono text-[#3F3340]">{rule.threshold}</span>
                  </div>
                  <div className="mt-auto pt-5">
                    <Link
                      to={`/simulator?scenario=${rule.scenario}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E1B48]"
                    >
                      Run this scenario
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
