import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Shield,
  Plus,
  Compass,
  Lock,
  Trophy,
  User as UserIcon,
  Delete,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Swords,
  BarChart3,
  MessageSquare,
  Zap,
  Award,
  ArrowRight,
  GraduationCap,
   ExternalLink,
  Play,
  Pause,
  Eye,
  EyeOff
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallComponents';

export interface ShowcaseLandingPageProps {
  tuitionVaultCategory: string;
  setTuitionVaultCategory: (cat: any) => void;
  setLoginTarget: (target: string) => void;
  pinInput: string;
  setPinInput: React.Dispatch<React.SetStateAction<string>>;
  handlePinInputChange: (val: string) => void;
  signInNameInput: string;
  setSignInNameInput: (val: string) => void;
  loginError: string;
  setLoginError: (val: string) => void;
  signUpName: string;
  setSignUpName: (val: string) => void;
  signUpInstitute: string;
  setSignUpInstitute: (val: string) => void;
  signUpPin: string;
  setSignUpPin: (val: string) => void;
  signUpError: string;
  setSignUpError: (val: string) => void;
  isSigningUp: boolean;
  signUpPendingApprovalName: string | null;
  setSignUpPendingApprovalName: (val: string | null) => void;
  handlePublicSignUp: (e: React.FormEvent) => void;
  enterGuestDemoMode: () => void;
  isConnected: boolean;
  scholarCount: number;
  activeGrindersCount: number;
  isRaidBlackoutActive: boolean;
  lockoutSecondsRemaining: number;
  isVerifyingPin: boolean;
  pinStrengthHint?: string;
  failedAttemptsCount?: number;
  rememberedScholar?: { id: string; name: string; institute?: string } | null;
  onInstantRememberedLogin?: () => void;
  onClearRememberedScholar?: () => void;
  pwa: {
    isInstallable: boolean;
    isInstalled: boolean;
    isMobileDevice: boolean;
    triggerInstall: () => void;
  };
}

interface SimScholar {
  id: string;
  name: string;
  cohort: string;
  xp: number;
  streak: number;
  status: string;
  accent: string;
}

const INITIAL_SIM_SCHOLARS: SimScholar[] = [
  {
    id: 'sai',
    name: 'Sai',
    cohort: 'Allen · Sovereign',
    xp: 3480,
    streak: 14,
    status: 'Solving Rotational Mechanics',
    accent: '#FACC15'
  },
  {
    id: 'utham',
    name: 'Utham',
    cohort: 'Modulus · Vanguard',
    xp: 3440,
    streak: 11,
    status: '50m Pomodoro Active',
    accent: '#38BDF8'
  },
  {
    id: 'ved',
    name: 'Ved',
    cohort: 'Allen · Grandmaster',
    xp: 3390,
    streak: 9,
    status: '98.6%ile Mock Normalized',
    accent: '#22C55E'
  },
  {
    id: 'aryan',
    name: 'Aryan',
    cohort: 'Modulus · Sentinel',
    xp: 3320,
    streak: 7,
    status: 'Electrostatics PYQ Drill',
    accent: '#8B5CF6'
  }
];

const SHOWCASE_FEATURES = [
  {
    id: 'leaderboard',
    label: 'Live Standings',
    icon: Trophy,
    accent: '#FACC15',
    title: 'Real-Time XP Standings & Friday 11:59 PM Blind Blackout',
    summary:
      'Every verified study minute, solved problem, and mock test fuels your weekly XP score. At Friday 11:59 PM, standings lock into Blind Blackout until the Saturday Podium Reveal.',
    metrics: [
      { label: 'Study Time Rate', value: '60 XP / hr', color: 'text-[#38BDF8]' },
      { label: '7-Day Streak Boost', value: '1.35x XP', color: 'text-[#22C55E]' },
      { label: 'Friday 11:59 PM', value: 'Blind Lock', color: 'text-[#FACC15]' }
    ],
    previewItems: [
      {
        rank: '#1',
        name: 'Sai',
        tag: 'Tier I / Sovereign',
        stat: '3,480 XP / 14d Streak',
        highlight: 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
      },
      {
        rank: '#2',
        name: 'Utham',
        tag: 'Tier I / Grandmaster',
        stat: '3,440 XP / Physics Live',
        highlight: 'border-[#38BDF8] bg-[#2563EB]/15 text-[#38BDF8]'
      },
      {
        rank: '#3',
        name: 'Ved',
        tag: 'Tier II / Vanguard',
        stat: '3,390 XP / 98.6%ile Peak',
        highlight: 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#C4B5FD]'
      }
    ]
  },
  {
    id: 'chronometer',
    label: 'Focus Chronometer',
    icon: Clock,
    accent: '#22C55E',
    title: 'Zero-Drift Orbital Chronometer & 24/7 Co-Op Study Lounge',
    summary:
      'Run deterministic Stopwatch or 50m/90m Pomodoro blocks with lock-screen media controls, lap splits, and screen wake-lock. Enter the 24/7 Study Lounge to synchronize focus blocks with squadmates.',
    metrics: [
      { label: 'Timer Engine', value: 'Zero-Drift v3', color: 'text-[#22C55E]' },
      { label: 'Mystery Crate Drop', value: '45m+ Block', color: 'text-[#FACC15]' },
      { label: 'Co-Op Synergy', value: '+15% Boost', color: 'text-[#38BDF8]' }
    ],
    previewItems: [
      {
        rank: 'LIVE',
        name: '50:00 Shared Pomodoro Block',
        tag: 'Physics / Rotational Dynamics',
        stat: '+15% Co-Op Synergy',
        highlight: 'border-[#22C55E] bg-[#22C55E]/10 text-[#4ADE80]'
      },
      {
        rank: 'DROP',
        name: 'Mystery Tactical Loot Crate',
        tag: 'Unlocks after 45+ min focus',
        stat: 'Boosters & Shields',
        highlight: 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
      },
      {
        rank: 'SYNC',
        name: 'Lock-Screen Media Controls',
        tag: 'Mobile & Desktop PWA Ready',
        stat: 'Zero-drift persistence',
        highlight: 'border-[#38BDF8] bg-[#2563EB]/15 text-[#38BDF8]'
      }
    ]
  },
  {
    id: 'raids',
    label: 'Co-Op Boss Raids',
    icon: Shield,
    accent: '#F43F5E',
    title: 'Weekly Co-Op Raid Bosses & Squad Victory Rewards',
    summary:
      'The entire squad unites against weekly bosses like the Backlog Leviathan and Organic Hydra. Every logged study minute and solved JEE Advanced problem deals direct HP damage.',
    metrics: [
      { label: 'Time Damage', value: '1 HP / min', color: 'text-[#F43F5E]' },
      { label: 'Adv. Problem Crit', value: '3.5x DMG', color: 'text-[#FACC15]' },
      { label: 'Squad Clear Loot', value: '+250 XP', color: 'text-[#22C55E]' }
    ],
    previewItems: [
      {
        rank: 'BOSS',
        name: 'The Backlog Leviathan',
        tag: '398 / 2,000 HP Remaining',
        stat: '80.1% Depleted',
        highlight: 'border-[#F43F5E] bg-[#F43F5E]/15 text-[#FDA4AF]'
      },
      {
        rank: 'HIT',
        name: 'Squad Combo Strike',
        tag: '40 Hard Calculus Questions',
        stat: '-140 Boss HP',
        highlight: 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
      },
      {
        rank: 'LOOT',
        name: 'Weekend Raid Victory Chest',
        tag: 'All Active Scholars',
        stat: 'Rare Artifact + XP',
        highlight: 'border-[#22C55E] bg-[#22C55E]/10 text-[#4ADE80]'
      }
    ]
  },
  {
    id: 'warfare',
    label: 'Tactical Duels',
    icon: Swords,
    accent: '#8B5CF6',
    title: '1v1 Quickdraw Duels, 12h Bush Ambush & Defense Shields',
    summary:
      'Challenge rivals to consensual 1v1 Quickdraw Study Duels with XP wagers, plant a 12-hour Bush Ambush to overtake a rival above you, or deploy an Iron Dome Shield to guard your rank.',
    metrics: [
      { label: '1v1 Quickdraw', value: 'XP Wager', color: 'text-[#8B5CF6]' },
      { label: 'Bush Ambush', value: '12h Window', color: 'text-[#22C55E]' },
      { label: 'Audit Challenge', value: 'Proof Check', color: 'text-[#F43F5E]' }
    ],
    previewItems: [
      {
        rank: 'DUEL',
        name: 'Quickdraw 1v1 Focus Arena',
        tag: '45m Sprint / 100 XP Pot',
        stat: 'Winner takes pot',
        highlight: 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#C4B5FD]'
      },
      {
        rank: 'TRAP',
        name: '12-Hour Bush Ambush',
        tag: 'Overtake Rival in Standings',
        stat: '+75 XP Overtake Bounty',
        highlight: 'border-[#22C55E] bg-[#22C55E]/10 text-[#4ADE80]'
      },
      {
        rank: 'WARD',
        name: 'Iron Dome & Mirage Decoy',
        tag: 'Tactical Defense Inventory',
        stat: 'Blocks XP steals',
        highlight: 'border-[#38BDF8] bg-[#2563EB]/15 text-[#38BDF8]'
      }
    ]
  },
  {
    id: 'analytics',
    label: 'Cohort Analytics',
    icon: BarChart3,
    accent: '#38BDF8',
    title: 'Cohort-Normalized Mock Percentiles & Faculty Grading',
    summary:
      'Raw ranks across different coaching institutes are calibrated into fair percentiles so Allen and Modulus batches compete on equal footing, paired with faculty homework grading.',
    metrics: [
      { label: 'Cohort Formula', value: 'Fair %ile', color: 'text-[#38BDF8]' },
      { label: 'Weekly Exam Cap', value: '300 XP Max', color: 'text-[#FACC15]' },
      { label: 'Homework Boost', value: '2.0x Speed', color: 'text-[#22C55E]' }
    ],
    previewItems: [
      {
        rank: '99.1%',
        name: 'Normalized Mock Percentile',
        tag: 'Allen vs Modulus Calibrated',
        stat: 'Zero batch distortion',
        highlight: 'border-[#38BDF8] bg-[#2563EB]/15 text-[#38BDF8]'
      },
      {
        rank: 'EVAL',
        name: 'Multi-Exam Trajectory Ledger',
        tag: 'Physics / Chemistry / Math',
        stat: 'Topic delta tracking',
        highlight: 'border-[#22C55E] bg-[#22C55E]/10 text-[#4ADE80]'
      },
      {
        rank: '2X',
        name: 'Tuition Homework Speed Boost',
        tag: 'Verified Solution Uploads',
        stat: 'Double XP for 100% sets',
        highlight: 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
      }
    ]
  },
  {
    id: 'doubts',
    label: 'Doubt Bounties',
    icon: MessageSquare,
    accent: '#FACC15',
    title: 'Peer Doubt Bounties & Real-Time Squad Channels',
    summary:
      'Stuck on a tough Electrostatics or Conic Sections problem? Post it in Squad Doubt Bounties. Peers who upload a clear step-by-step solution earn an instant verified XP bounty.',
    metrics: [
      { label: 'Peer Resolution', value: '+20-35 XP', color: 'text-[#FACC15]' },
      { label: 'Sub-Channels', value: '3 Focused', color: 'text-[#38BDF8]' },
      { label: 'Web Push Alerts', value: 'Instant Ping', color: 'text-[#22C55E]' }
    ],
    previewItems: [
      {
        rank: '+35 XP',
        name: 'Rotational Impulse Doubt Bounty',
        tag: 'Solved with Step-by-Step Photo',
        stat: 'Instant XP Transfer',
        highlight: 'border-[#FACC15] bg-[#FACC15]/10 text-[#FACC15]'
      },
      {
        rank: 'CHAT',
        name: 'Dedicated Topic Sub-Channels',
        tag: 'General / Doubts / Warfare',
        stat: 'Unread badge tracking',
        highlight: 'border-[#38BDF8] bg-[#2563EB]/15 text-[#38BDF8]'
      },
      {
        rank: 'PUSH',
        name: 'Standalone WebAPK Alerts',
        tag: 'Lock-Screen Notifications',
        stat: 'Rival session alerts',
        highlight: 'border-[#22C55E] bg-[#22C55E]/10 text-[#4ADE80]'
      }
    ]
  }
];

export const ShowcaseLandingPage: React.FC<ShowcaseLandingPageProps> = ({
  tuitionVaultCategory,
  setTuitionVaultCategory,
  setLoginTarget,
  pinInput,
  setPinInput,
  handlePinInputChange,
  signInNameInput,
  setSignInNameInput,
  loginError,
  setLoginError,
  signUpName,
  setSignUpName,
  signUpInstitute,
  setSignUpInstitute,
  signUpPin,
  setSignUpPin,
  signUpError,
  setSignUpError,
  isSigningUp,
  signUpPendingApprovalName,
  setSignUpPendingApprovalName,
  handlePublicSignUp,
  enterGuestDemoMode,
  scholarCount,
  activeGrindersCount,
  isRaidBlackoutActive,
  lockoutSecondsRemaining,
  isVerifyingPin,
  pinStrengthHint,
  failedAttemptsCount = 0,
  rememberedScholar,
  onInstantRememberedLogin,
  onClearRememberedScholar,
  pwa
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Interactive Intro Curtain State (fast 950ms kinetic reveal on first visit, skippable)
  const [showIntroCurtain, setShowIntroCurtain] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('jee_arena_intro_seen_v2') !== '1';
  });

  useEffect(() => {
    if (!showIntroCurtain) return;
    if (prefersReducedMotion) {
      setShowIntroCurtain(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowIntroCurtain(false);
      try {
        sessionStorage.setItem('jee_arena_intro_seen_v2', '1');
      } catch {
        // ignore storage restrictions
      }
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [showIntroCurtain, prefersReducedMotion]);

  // Interactive Hero Stage State (Standings Overtake Sim | Raid Boss Strike Sim | Focus Chronometer Sim)
  const [heroStageMode, setHeroStageMode] = useState<'standings' | 'boss' | 'timer'>('standings');
  const [simScholars, setSimScholars] = useState<SimScholar[]>(INITIAL_SIM_SCHOLARS);
  const [simBlackout, setSimBlackout] = useState<boolean>(false);
  const [lastOvertakeBanner, setLastOvertakeBanner] = useState<string | null>(null);

  // Interactive Raid Boss State
  const [simBossHp, setSimBossHp] = useState<number>(1420);
  const maxBossHp = 2000;
  const [bossHitFlash, setBossHitFlash] = useState<boolean>(false);
  const [lastBossStrikeText, setLastBossStrikeText] = useState<string>('Ready for squad combo strike');

  // Interactive Focus Chronometer State
  const [simTimerRunning, setSimTimerRunning] = useState<boolean>(true);
  const [simSeconds, setSimSeconds] = useState<number>(2684); // 44m 44s so user is close to 45m Mystery Crate!
  const [simSubject, setSimSubject] = useState<'Physics' | 'Chemistry' | 'Mathematics'>('Physics');

  useEffect(() => {
    if (!simTimerRunning) return;
    const interval = window.setInterval(() => {
      setSimSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [simTimerRunning]);

  // Interactive Bento Difficulty Calculator State
  const [selectedDiffTier, setSelectedDiffTier] = useState<'easy' | 'mains' | 'hard' | 'adv'>('adv');
  const [questionCountSim, setQuestionCountSim] = useState<number>(20);

  // Interactive Cohort Percentile Normalizer State
  const [selectedCohortExample, setSelectedCohortExample] = useState<'allen' | 'modulus'>('allen');

  // Interactive 6-System Walkthrough Tab
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<string>('leaderboard');
  const [vaultHighlightPulse, setVaultHighlightPulse] = useState<boolean>(false);

  const isLocked = lockoutSecondsRemaining > 0;
  const remainingTriesBeforeCooldown = Math.max(0, 4 - (failedAttemptsCount % 4));

  const formatCooldown = (secs: number) => {
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  const formatSimClock = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const triggerScholarBoost = (id: string, deltaXp: number, reason: string) => {
    setSimScholars((prev) => {
      const oldOrder = [...prev].sort((a, b) => b.xp - a.xp).map((s) => s.id);
      const updated = prev
        .map((s) => (s.id === id ? { ...s, xp: s.xp + deltaXp, status: reason } : s))
        .sort((a, b) => b.xp - a.xp);
      const newOrder = updated.map((s) => s.id);
      const boostedScholar = updated.find((s) => s.id === id);
      if (boostedScholar && oldOrder.indexOf(id) > newOrder.indexOf(id)) {
        const newRank = newOrder.indexOf(id) + 1;
        setLastOvertakeBanner(`${boostedScholar.name} surged to Rank #${newRank} (+${deltaXp} XP)!`);
      } else if (boostedScholar) {
        setLastOvertakeBanner(`${boostedScholar.name} logged +${deltaXp} XP (${reason})`);
      }
      return updated;
    });
  };

  const triggerBossStrike = (damage: number, label: string) => {
    setSimBossHp((prev) => Math.max(0, prev - damage));
    setBossHitFlash(true);
    setLastBossStrikeText(`${label} dealt -${damage} Boss HP!`);
    window.setTimeout(() => setBossHitFlash(false), 260);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (id === 'arcade-vault-section') {
        setVaultHighlightPulse(true);
        window.setTimeout(() => setVaultHighlightPulse(false), 1200);
      }
    }
  };

  const currentFeature =
    SHOWCASE_FEATURES.find((f) => f.id === activeShowcaseTab) || SHOWCASE_FEATURES[0];

  const diffMultipliers = {
    easy: { label: 'Easy Drill', mult: 1.0, color: '#94A3B8', tag: 'Foundation' },
    mains: { label: 'JEE Mains', mult: 1.5, color: '#38BDF8', tag: 'Speed & Accuracy' },
    hard: { label: 'Hard Concept', mult: 2.5, color: '#FACC15', tag: 'Multi-Concept' },
    adv: { label: 'JEE Advanced', mult: 3.5, color: '#22C55E', tag: '3.5x Boss Crit' }
  };

  const activeDiff = diffMultipliers[selectedDiffTier];
  const calculatedQuestionXp = Math.round(questionCountSim * activeDiff.mult);

  return (
    <div className="w-full max-w-[1380px] mx-auto px-3 sm:px-5 md:px-8 py-3 sm:py-5 space-y-10 sm:space-y-16 z-10 relative">
      {/* KINETIC INTRO CURTAIN OVERLAY (Skippable, compositor-only transform/opacity) */}
      <AnimatePresence>
        {showIntroCurtain && (
          <motion.div
            key="arcade-intro-curtain"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setShowIntroCurtain(false)}
            className="fixed inset-0 z-50 bg-[#080C16] flex flex-col items-center justify-center px-4 cursor-pointer select-none"
          >
            <motion.div
              initial={{ scale: 0.86, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="surface-card p-6 sm:p-8 max-w-md w-full text-center space-y-4 border-2 border-[#38BDF8]"
            >
              <div className="w-14 h-14 rounded-[18px] bg-[#2563EB] border-2 border-[#38BDF8] border-b-4 border-b-[#1E3A8A] flex items-center justify-center mx-auto text-[#FACC15]">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-[#38BDF8]">
                  SEASON 5 COMMAND DECK
                </div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
                  JEE Grind Arena
                </h2>
              </div>
              <div className="w-full bg-[#080C16] h-3 rounded-xl border-2 border-[#334155] overflow-hidden p-0.5">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.85, ease: 'easeInOut' }}
                  className="h-full bg-[#22C55E] rounded-lg origin-left"
                />
              </div>
              <div className="text-[11px] font-mono text-[#94A3B8]">
                 Synchronizing live leaderboard &amp; chronometer · Tap anywhere to skip
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. STRICT 3-ZONE TOP NAVIGATION BAR */}
      <header className="surface-card px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8 sticky top-2 z-40 bg-[#111827]/95 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-display font-bold text-lg sm:text-xl text-white tracking-tight whitespace-nowrap shrink-0 no-underline hover:text-[#38BDF8] transition-colors"
        >
          JEE Grind Arena
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#94A3B8]">
          <button
            type="button"
            onClick={() => scrollToSection('hero-simulator-stage')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live Simulator
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('bento-architecture-section')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Arena Mechanics
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('interactive-showcase-section')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            System Tour
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('arcade-vault-section')}
            className="hover:text-[#FACC15] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            PIN Vault
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {rememberedScholar && onInstantRememberedLogin ? (
            <button
              type="button"
              onClick={onInstantRememberedLogin}
              className="arcade-btn-lime px-4 py-2 text-xs sm:text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>Resume as {rememberedScholar.name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => scrollToSection('arcade-vault-section')}
              className="arcade-btn-lime px-4 py-2 text-xs sm:text-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
              <span>Unlock PIN Vault</span>
            </button>
          )}
        </div>
      </header>

      {/* RETURNING SCHOLAR 1-TAP AUTO-LOGIN BANNER */}
      {rememberedScholar && onInstantRememberedLogin && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-card p-4 sm:px-6 border-2 border-[#22C55E] bg-[#111827] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[14px] bg-[#22C55E] text-[#020617] font-display font-bold text-lg flex items-center justify-center border-2 border-[#020617] border-b-4 border-b-[#14532D] shrink-0">
              {rememberedScholar.name[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-display font-bold text-white">
                Welcome back, {rememberedScholar.name}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Recognized scholar terminal on this device · Jump straight into your study command deck in one tap.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onInstantRememberedLogin}
              className="arcade-btn-lime flex-1 sm:flex-initial px-4 py-2.5 text-xs whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Enter Arena Now</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
            {onClearRememberedScholar && (
              <button
                type="button"
                onClick={onClearRememberedScholar}
                className="arcade-key px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Switch Account
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* 2. HERO SECTION: ASYMMETRIC SPLIT WITH PLAYABLE LIVE ARENA SIMULATOR (ZERO AI IMAGES) */}
      <section
        id="hero-simulator-stage"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch pt-2 sm:pt-4"
      >
        {/* Left 6 Columns: High-Impact Proposition & Primary Actions (Strict Max 4 Text Elements) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 flex flex-col justify-center space-y-6 py-2 sm:py-6"
        >
          {/* Element 1: Single Eyebrow */}
          <div className="text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#38BDF8]">
            SEASON 5 COMPETITIVE STUDY ENGINE
          </div>

          {/* Element 2: Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-[56px] font-display font-bold text-white leading-[1.05] tracking-tight"
            style={{ textWrap: 'balance' }}
          >
            Turn solitary JEE prep into a{' '}
            <span className="text-[#FACC15] underline decoration-[#2563EB] decoration-4 underline-offset-8">
              live squad sport.
            </span>
          </h1>

          {/* Element 3: Subtext (19 words, <= 3 lines) */}
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed max-w-[54ch]">
            Log verified focus blocks, battle weekly co-op raid bosses, normalize coaching mock ranks, and climb the live XP leaderboard.
          </p>

          {/* Element 4: CTAs (1 Primary + 1 Secondary, single-line) */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => scrollToSection('arcade-vault-section')}
              className="arcade-btn-lime min-h-[48px] px-6 py-3 text-sm whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>Unlock Scholar Vault</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={enterGuestDemoMode}
              className="arcade-btn-cobalt min-h-[48px] px-5 py-3 text-sm whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#FACC15] shrink-0" />
              <span>Launch Demo Sandbox</span>
            </button>
          </div>
        </motion.div>

        {/* Right 6 Columns: Interactive Tactile Arena Stage (Playable without logging in!) */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-6 surface-card overflow-hidden flex flex-col justify-between border-2 border-[#334155]"
        >
          {/* Interactive Stage Mode Switcher Header */}
          <div className="bg-[#162033] border-b-4 border-[#020617] p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 p-1 bg-[#080C16] rounded-[14px] border-2 border-[#1E293B]">
              <button
                type="button"
                onClick={() => setHeroStageMode('standings')}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  heroStageMode === 'standings'
                    ? 'bg-[#2563EB] text-white border border-[#38BDF8]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>Live XP Race</span>
              </button>
              <button
                type="button"
                onClick={() => setHeroStageMode('boss')}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  heroStageMode === 'boss'
                    ? 'bg-[#F43F5E] text-white border border-[#FDA4AF]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>Raid Boss</span>
              </button>
              <button
                type="button"
                onClick={() => setHeroStageMode('timer')}
                className={`px-3 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  heroStageMode === 'timer'
                    ? 'bg-[#22C55E] text-[#020617] border border-[#020617]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Chronometer</span>
              </button>
            </div>

            <span className="font-mono text-[11px] font-bold text-[#38BDF8] whitespace-nowrap">
              INTERACTIVE PREVIEW
            </span>
          </div>

          {/* Interactive Stage Body */}
          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4 bg-[#0B1120]">
            <AnimatePresence mode="wait">
              {heroStageMode === 'standings' && (
                <motion.div
                  key="stage-standings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs sm:text-sm font-display font-bold text-white">
                        Tap +60 XP on any scholar to trigger a live overtake
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">
                        {lastOvertakeBanner || 'Spring layout physics reorder ranks in real time'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSimBlackout((b) => !b)}
                      className={`px-3 py-1.5 rounded-xl border-2 border-b-4 text-[11px] font-mono font-extrabold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-all ${
                        simBlackout
                          ? 'bg-[#FACC15] text-[#020617] border-[#020617] border-b-[#A16207]'
                          : 'bg-[#111827] text-slate-200 border-[#334155] border-b-[#020617] hover:border-[#FACC15]'
                      }`}
                    >
                      {simBlackout ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#FACC15]" />}
                      <span>{simBlackout ? 'Blackout ON' : 'Test Blackout'}</span>
                    </button>
                  </div>

                  {/* Animated Leaderboard Rows */}
                  <div className="space-y-2">
                    {simScholars.map((scholar, index) => {
                      const rank = index + 1;
                      const topXp = simScholars[0]?.xp || 3500;
                      const pct = Math.max(25, Math.min(100, Math.round((scholar.xp / topXp) * 100)));

                      return (
                        <motion.div
                          key={scholar.id}
                          layout
                          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                          className={`p-3 rounded-[16px] border-2 border-b-4 flex items-center justify-between gap-3 ${
                            rank === 1
                              ? 'bg-[#111827] border-[#FACC15] border-b-[#020617]'
                              : 'bg-[#111827] border-[#334155] border-b-[#020617]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-xl border-2 border-[#020617] font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${
                                rank === 1
                                  ? 'bg-[#FACC15] text-[#020617]'
                                  : rank === 2
                                  ? 'bg-[#38BDF8] text-[#020617]'
                                  : rank === 3
                                  ? 'bg-[#8B5CF6] text-white'
                                  : 'bg-[#1E293B] text-slate-300'
                              }`}
                            >
                              #{rank}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-display font-bold text-white truncate">
                                  {simBlackout ? `Encrypted Scholar 0${rank}` : scholar.name}
                                </span>
                                <span className="font-mono tabular-nums text-xs sm:text-sm font-extrabold text-[#FACC15] shrink-0">
                                  {simBlackout ? '???? XP' : `${scholar.xp.toLocaleString()} XP`}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[11px] text-[#94A3B8] mt-0.5">
                                <span className="truncate">
                                  {simBlackout ? 'Friday 11:59 PM Blind Lock Active' : scholar.status}
                                </span>
                                <span className="font-mono text-[#4ADE80] shrink-0">
                                  {scholar.streak}d streak
                                </span>
                              </div>

                              <div className="w-full h-1.5 bg-[#080C16] rounded-full overflow-hidden mt-1.5">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: simBlackout ? '#475569' : scholar.accent }}
                                  animate={{ width: simBlackout ? '50%' : `${pct}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              triggerScholarBoost(scholar.id, 60, 'Solved 25 JEE Adv. Problems')
                            }
                            className="arcade-btn-cobalt px-2.5 py-2 text-[11px] font-mono whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            +60 XP
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {heroStageMode === 'boss' && (
                <motion.div
                  key="stage-boss"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <motion.div
                    animate={bossHitFlash ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.24 }}
                    className={`p-4 rounded-[18px] border-2 border-b-4 transition-colors ${
                      bossHitFlash
                        ? 'bg-[#F43F5E]/20 border-[#F43F5E] border-b-[#020617]'
                        : 'bg-[#111827] border-[#334155] border-b-[#020617]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-[#F43F5E] uppercase">
                          WEEKLY SQUAD BOSS RAID
                        </span>
                        <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                          The Backlog Leviathan
                        </h3>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-base sm:text-lg font-extrabold text-[#FACC15]">
                          {simBossHp.toLocaleString()} / {maxBossHp.toLocaleString()} HP
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">
                          {Math.round(((maxBossHp - simBossHp) / maxBossHp) * 100)}% Depleted
                        </div>
                      </div>
                    </div>

                    {/* Chunky Tactile Boss HP Bar */}
                    <div className="w-full h-5 bg-[#080C16] rounded-xl border-2 border-[#334155] p-0.5 mt-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-[#F43F5E] rounded-lg"
                        animate={{ width: `${Math.max(0, (simBossHp / maxBossHp) * 100)}%` }}
                        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-[#E0F2FE]">
                      <span>{lastBossStrikeText}</span>
                      {simBossHp === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSimBossHp(maxBossHp);
                            setLastBossStrikeText('Boss respawned for next squad run!');
                          }}
                          className="text-[#4ADE80] underline cursor-pointer"
                        >
                          Respawn Boss
                        </button>
                      )}
                    </div>
                  </motion.div>

                  {/* Interactive Attack Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => triggerBossStrike(90, '90m Deep Focus Block')}
                      className="arcade-btn-cobalt p-3 text-left flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-display font-bold text-white">
                          Log 90m Focus Block
                        </div>
                        <div className="text-[11px] text-[#E0F2FE] font-normal">
                          1 HP damage per focus minute
                        </div>
                      </div>
                      <span className="font-mono text-xs font-extrabold text-[#FACC15] shrink-0">
                        -90 HP
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => triggerBossStrike(140, '40 JEE Advanced Problems (3.5x Crit)')}
                      className="arcade-btn-coral p-3 text-left flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-display font-bold text-white">
                          40 Adv. Problems Solved
                        </div>
                        <div className="text-[11px] text-rose-100 font-normal">
                          3.5x Critical Strike Multiplier
                        </div>
                      </div>
                      <span className="font-mono text-xs font-extrabold text-[#FACC15] shrink-0">
                        -140 HP
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}

              {heroStageMode === 'timer' && (
                <motion.div
                  key="stage-timer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-[18px] bg-[#111827] border-2 border-[#334155] border-b-4 border-b-[#020617] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center sm:text-left">
                      <div className="text-[11px] font-mono font-bold text-[#4ADE80] uppercase">
                        ZERO-DRIFT ORBITAL CHRONOMETER
                      </div>
                      <div className="text-3xl sm:text-4xl font-mono tabular-nums font-extrabold text-white tracking-tight">
                        {formatSimClock(simSeconds)}
                      </div>
                      <div className="text-xs text-[#94A3B8]">
                        Subject: <strong className="text-white">{simSubject}</strong> · Banked XP:{' '}
                        <strong className="text-[#FACC15]">+{Math.floor(simSeconds / 60)} XP</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSimTimerRunning((r) => !r)}
                        className={`px-4 py-2.5 rounded-xl font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                          simTimerRunning ? 'arcade-btn-canary' : 'arcade-btn-lime'
                        }`}
                      >
                        {simTimerRunning ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimSeconds((s) => s + 60)}
                        className="arcade-btn-cobalt px-3 py-2.5 text-xs font-mono cursor-pointer"
                      >
                        +1m Skip
                      </button>
                    </div>
                  </div>

                  {/* Subject Selector + Mystery Loot Crate Unlock Bar */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['Physics', 'Chemistry', 'Mathematics'] as const).map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setSimSubject(subj)}
                        className={`py-2 px-3 rounded-xl font-display font-bold text-xs border-2 cursor-pointer transition-all ${
                          simSubject === subj
                            ? 'bg-[#2563EB] text-white border-[#38BDF8]'
                            : 'bg-[#111827] text-[#94A3B8] border-[#334155] hover:text-white'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-[14px] bg-[#111827] border-2 border-[#FACC15]/60 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <div className="font-display font-bold text-[#FACC15]">
                        {simSeconds >= 2700
                          ? 'Mystery Tactical Loot Crate Unlocked!'
                          : `Mystery Loot Crate in ${Math.max(0, 2700 - simSeconds)}s`}
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">
                        45+ minute focus sessions drop XP multipliers, Streak Freezes &amp; Shields
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-extrabold text-[#4ADE80] shrink-0">
                      {Math.min(100, Math.floor((simSeconds / 2700) * 100))}%
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stage Footer Bar */}
            <div className="pt-3 border-t-2 border-[#1E293B] flex items-center justify-between gap-2 text-xs text-[#94A3B8]">
              <span>Want to explore the full dashboard with sample data?</span>
              <button
                type="button"
                onClick={enterGuestDemoMode}
                className="font-display font-bold text-[#38BDF8] hover:text-[#FACC15] flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open Full Sandbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. FULL-WIDTH QUANTITATIVE TELEMETRY STRIP (Adjacent Proof, Tabular Numerals, Zero Left Accent Bars) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="surface-card p-4 sm:p-5 bg-[#111827]">
          <div className="text-xs font-semibold text-[#94A3B8]">Verified Squad Roster</div>
          <div className="text-2xl sm:text-3xl font-mono tabular-nums font-extrabold text-white mt-1">
            {scholarCount} Scholars
          </div>
          <div className="text-xs text-[#38BDF8] mt-1">
            Competing across Allen &amp; Modulus batches
          </div>
        </div>

        <div className="surface-card p-4 sm:p-5 bg-[#111827]">
          <div className="text-xs font-semibold text-[#94A3B8]">24/7 Co-Op Study Lounge</div>
          <div className="text-2xl sm:text-3xl font-mono tabular-nums font-extrabold text-[#4ADE80] mt-1">
            {activeGrindersCount > 0 ? `${activeGrindersCount} Grinding` : '24/7 Open'}
          </div>
          <div className="text-xs text-[#94A3B8] mt-1">
            +15% XP synergy when studying together
          </div>
        </div>

        <div className="surface-card p-4 sm:p-5 bg-[#111827]">
          <div className="text-xs font-semibold text-[#94A3B8]">Friday 11:59 PM Protocol</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-[#FACC15] mt-1">
            {isRaidBlackoutActive ? 'Blackout Active' : 'Blind Blackout'}
          </div>
          <div className="text-xs text-[#94A3B8] mt-1">
            Ranks mask until Saturday Podium Reveal
          </div>
        </div>

        <div className="surface-card p-4 sm:p-5 bg-[#111827]">
          <div className="text-xs font-semibold text-[#94A3B8]">Cohort Mock Calibration</div>
          <div className="text-2xl sm:text-3xl font-mono tabular-nums font-extrabold text-[#C4B5FD] mt-1">
            300 XP Cap
          </div>
          <div className="text-xs text-[#94A3B8] mt-1">
            Normalized by coaching batch size
          </div>
        </div>
      </section>

      {/* 4. ASYMMETRIC 5-CELL INTERACTIVE BENTO ARCHITECTURE (Exact 5 cells for 5 core mechanics) */}
      <section id="bento-architecture-section" className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-white tracking-tight">
            Built for high-consistency JEE preparation.
          </h2>
          <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
            Every mechanic in the Arena rewards deep daily study blocks, difficult problem sets, and honest peer competition.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Bento Cell 1 (7 Cols): Interactive Question Difficulty Multiplier Calculator */}
          <div className="lg:col-span-7 surface-card p-5 sm:p-6 bg-[#111827] flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#38BDF8]">
                01. QUESTION DIFFICULTY MULTIPLIERS
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                Harder problems earn higher XP &amp; Raid Boss critical strikes.
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Logging 30 JEE Advanced problems awards 3.5x the XP of basic drills. Test the live XP calculator below:
              </p>
            </div>

            <div className="p-4 rounded-[16px] bg-[#080C16] border-2 border-[#334155] space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(diffMultipliers) as Array<keyof typeof diffMultipliers>).map((key) => {
                  const item = diffMultipliers[key];
                  const active = selectedDiffTier === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDiffTier(key)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#2563EB] border-[#38BDF8] text-white -translate-y-0.5'
                          : 'bg-[#111827] border-[#334155] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <div className="font-mono text-sm font-extrabold" style={{ color: active ? '#FACC15' : item.color }}>
                        {item.mult.toFixed(1)}x XP
                      </div>
                      <div className="text-xs font-display font-bold text-white mt-0.5">
                        {item.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#1E293B]">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#94A3B8]">Problems Solved:</span>
                  <div className="flex items-center gap-1.5">
                    {[10, 20, 40, 60].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setQuestionCountSim(count)}
                        className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold cursor-pointer ${
                          questionCountSim === count
                            ? 'bg-[#FACC15] text-[#020617]'
                            : 'bg-[#111827] text-slate-300 border border-[#334155]'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="font-mono tabular-nums text-right">
                  <span className="text-xs text-[#94A3B8] mr-2">Session Payout:</span>
                  <span className="text-lg font-extrabold text-[#4ADE80]">
                    +{calculatedQuestionXp} XP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Cell 2 (5 Cols): Interactive Cohort-Normalized Mock Percentiles */}
          <div className="lg:col-span-5 surface-card p-5 sm:p-6 bg-[#162033] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#FACC15]">
                02. FAIR COHORT NORMALIZATION
              </div>
              <h3 className="text-xl font-display font-bold text-white">
                Allen &amp; Modulus ranks calibrated on one scale.
              </h3>
              <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                Raw ranks are converted into normalized cohort percentiles so a 450-student batch and a 90-student batch compete fairly.
              </p>
            </div>

            <div className="p-4 rounded-[16px] bg-[#080C16] border-2 border-[#334155] space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCohortExample('allen')}
                  className={`py-2 px-3 rounded-xl font-display font-bold text-xs border-2 cursor-pointer ${
                    selectedCohortExample === 'allen'
                      ? 'bg-[#2563EB] text-white border-[#38BDF8]'
                      : 'bg-[#111827] text-[#94A3B8] border-[#334155]'
                  }`}
                >
                  Allen Batch (450)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCohortExample('modulus')}
                  className={`py-2 px-3 rounded-xl font-display font-bold text-xs border-2 cursor-pointer ${
                    selectedCohortExample === 'modulus'
                      ? 'bg-[#8B5CF6] text-white border-[#C4B5FD]'
                      : 'bg-[#111827] text-[#94A3B8] border-[#334155]'
                  }`}
                >
                  Modulus Batch (90)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#111827] border border-[#1E293B] flex items-center justify-between font-mono tabular-nums">
                <div>
                  <div className="text-[11px] text-[#94A3B8]">Raw Test Rank</div>
                  <div className="text-base font-extrabold text-white">
                    {selectedCohortExample === 'allen' ? 'Rank #15 / 450' : 'Rank #3 / 90'}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#38BDF8]" />
                <div className="text-right">
                  <div className="text-[11px] text-[#94A3B8]">Normalized Output</div>
                  <div className="text-base font-extrabold text-[#FACC15]">
                    96.7%ile · +268 XP
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Cell 3 (4 Cols): Tactical Warfare & 12h Bush Ambush */}
          <div className="lg:col-span-4 surface-card p-5 bg-[#111827] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#C4B5FD]">
                03. TACTICAL WARFARE HUB
              </div>
              <h3 className="text-lg font-display font-bold text-white">
                1v1 Quickdraw Duels &amp; 12h Bush Ambush
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Wager XP in 45-minute 1v1 focus sprints, plant a 12-hour overtake ambush on the rival ahead of you, or deploy an Iron Dome shield.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#080C16] border-2 border-[#8B5CF6]/50 flex items-center justify-between text-xs font-mono">
              <span className="text-[#C4B5FD]">Overtake Bounty</span>
              <span className="font-extrabold text-[#4ADE80]">+75 XP BONUS</span>
            </div>
          </div>

          {/* Bento Cell 4 (4 Cols): Tuition Faculty & 2x Homework Speed Boost */}
          <div className="lg:col-span-4 surface-card p-5 bg-[#111827] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#4ADE80]">
                04. FACULTY GRADING PORTAL
              </div>
              <h3 className="text-lg font-display font-bold text-white">
                2.0x Tuition Homework Speed Boost
              </h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                Physics, Chemistry, and Math faculty post assignments directly. Uploading verified working before the deadline doubles problem XP.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#080C16] border-2 border-[#22C55E]/50 flex items-center justify-between text-xs font-mono">
              <span className="text-[#4ADE80]">Verified Submission</span>
              <span className="font-extrabold text-[#FACC15]">2.0x MULTIPLIER</span>
            </div>
          </div>

          {/* Bento Cell 5 (4 Cols): Hall of Champions & Saturday Reveal */}
          <div className="lg:col-span-4 surface-card p-5 bg-[#2563EB] text-white flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-[#FACC15]">
                05. SATURDAY PODIUM CEREMONY
              </div>
              <h3 className="text-lg font-display font-bold text-white">
                Weekly Hall of Champions Archive
              </h3>
              <p className="text-xs text-[#E0F2FE] leading-relaxed">
                When the Friday night blackout lifts, the top 3 scholars are crowned in an animated podium ceremony and permanently recorded in the Hall of Champions.
              </p>
            </div>
            <button
              type="button"
              onClick={enterGuestDemoMode}
              className="arcade-btn-canary w-full py-2.5 px-4 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Preview Podium in Sandbox</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE 6-SYSTEM WALKTHROUGH DECK */}
      <section id="interactive-showcase-section" className="surface-card overflow-hidden">
        <div className="bg-[#162033] border-b-4 border-[#020617] px-5 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">
              Inspect All 6 Arena Modules
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              Select any system below to see its live rules, telemetry rates, and squad mechanics.
            </p>
          </div>
          <button
            type="button"
            onClick={enterGuestDemoMode}
            className="arcade-btn-canary px-4 py-2.5 text-xs whitespace-nowrap shrink-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>Launch Demo Sandbox</span>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* 6 Tactile Module Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {SHOWCASE_FEATURES.map((feat) => {
              const Icon = feat.icon;
              const isSelected = feat.id === activeShowcaseTab;
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => setActiveShowcaseTab(feat.id)}
                  className={`p-3 rounded-[16px] text-left border-2 border-b-4 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#2563EB] border-[#38BDF8] border-b-[#1E3A8A] text-white -translate-y-0.5'
                      : 'bg-[#0B1120] border-[#334155] border-b-[#020617] text-[#94A3B8] hover:text-white hover:border-[#475569]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-[#080C16]/80 border border-white/15 flex items-center justify-center">
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isSelected ? '#FACC15' : feat.accent }}
                    />
                  </div>
                  <div className="text-xs font-display font-bold leading-snug whitespace-nowrap truncate">
                    {feat.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Animated Module Detail Panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFeature.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-[18px] bg-[#0B1120] border-2 border-[#334155] border-b-4 border-b-[#020617] p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
            >
              <div className="lg:col-span-6 space-y-4">
                <h3 className="text-lg sm:text-2xl font-display font-bold text-white leading-snug">
                  {currentFeature.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
                  {currentFeature.summary}
                </p>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  {currentFeature.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-[14px] bg-[#111827] border-2 border-[#1E293B] border-b-4 border-b-[#020617]"
                    >
                      <div className="text-[10px] font-mono uppercase text-[#94A3B8] truncate">
                        {m.label}
                      </div>
                      <div className={`text-sm sm:text-base font-mono tabular-nums font-extrabold mt-0.5 ${m.color}`}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-2.5">
                {currentFeature.previewItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[16px] bg-[#111827] border-2 border-[#334155] border-b-4 border-b-[#020617] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`px-2.5 py-1.5 rounded-xl border-2 font-mono text-xs font-extrabold shrink-0 ${item.highlight}`}
                      >
                        {item.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-display font-bold text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] truncate">{item.tag}</div>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-200 text-right shrink-0 hidden sm:block">
                      {item.stat}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 6. DEDICATED TACTILE PIN & REGISTRATION COMMAND VAULT */}
      <section
        id="arcade-vault-section"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch scroll-mt-20"
      >
        {/* Left 5 Columns: Access Guide & Security Status */}
        <div className="lg:col-span-5 surface-card p-5 sm:p-6 bg-[#111827] flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Ready to enter the Arena?
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              Returning scholars can dial their 4-digit PIN directly. Once verified, this device remembers your session so you log in automatically on future visits.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="p-3.5 rounded-[16px] bg-[#0B1120] border-2 border-[#334155] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#22C55E]/20 border border-[#22C55E] flex items-center justify-center text-[#4ADE80] shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-display font-bold text-white">
                    Instant Device Auto-Login
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Existing scholars stay signed in across browser reloads and mobile PWA launches.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#0B1120] border-2 border-[#334155] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#2563EB]/20 border border-[#38BDF8] flex items-center justify-center text-[#38BDF8] shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-display font-bold text-white">
                    Progressive Brute-Force Shield
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Protected by server-enforced rate limits (30s cooldown after 4 failed tries, 2m after 6, 10m after 8).
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-[16px] bg-[#0B1120] border-2 border-[#334155] flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#FACC15]/20 border border-[#FACC15] flex items-center justify-center text-[#FACC15] shrink-0 mt-0.5">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-display font-bold text-white">
                    New Scholar Registration
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    New to the squad? Switch the vault tab to Sign Up and choose your 4-digit PIN for Admin approval.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-[#1E293B] space-y-2.5">
            <button
              type="button"
              onClick={enterGuestDemoMode}
              className="arcade-btn-cobalt w-full min-h-[46px] px-4 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#FACC15] shrink-0" />
              <span>Explore as Guest in Demo Sandbox</span>
            </button>
          </div>
        </div>

        {/* Right 7 Columns: The 4-Mode Tactile PIN & Sign-Up Vault */}
        <motion.div
          animate={
            vaultHighlightPulse
              ? { scale: [1, 1.015, 1], borderColor: ['#334155', '#22C55E', '#334155'] }
              : {}
          }
          transition={{ duration: 0.6 }}
          className="lg:col-span-7 surface-card overflow-hidden flex flex-col justify-between"
        >
          <div>
            {/* Vault Header */}
            <div className="bg-[#162033] border-b-4 border-[#020617] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-[#020617] border-2 border-[#020617] flex items-center justify-center font-bold shrink-0">
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-display font-bold text-white leading-tight">
                    {tuitionVaultCategory === 'signup'
                      ? 'New Scholar Registration'
                      : tuitionVaultCategory === 'admin'
                      ? 'Admin Security Console'
                      : tuitionVaultCategory === 'teachers'
                      ? 'Tuition Faculty Portal'
                      : 'Scholar PIN Vault'}
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    {tuitionVaultCategory === 'signup'
                      ? 'Create a strong 4-digit PIN for your profile'
                      : 'Dial 4-digit PIN on keypad or keyboard'}
                  </p>
                </div>
              </div>

              <span className="font-mono text-[11px] font-bold text-[#4ADE80] shrink-0">
                4-TRY SHIELD ACTIVE
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* 4-Mode Tactile Switcher: Sign In | Sign Up | Faculty | Admin */}
              <div className="grid grid-cols-4 p-1.5 bg-[#080C16] rounded-[16px] border-2 border-[#1E293B] gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTuitionVaultCategory('students');
                    setLoginTarget('');
                    setPinInput('');
                    setLoginError('');
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    tuitionVaultCategory === 'students'
                      ? 'bg-[#2563EB] text-white border-2 border-[#38BDF8]'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTuitionVaultCategory('signup');
                    setPinInput('');
                    setLoginError('');
                    setSignUpError('');
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    tuitionVaultCategory === 'signup'
                      ? 'bg-[#22C55E] text-[#020617] border-2 border-[#020617]'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                  <span>Sign Up</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTuitionVaultCategory('teachers');
                    setLoginTarget('teacher_');
                    setPinInput('');
                    setLoginError('');
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    tuitionVaultCategory === 'teachers'
                      ? 'bg-[#8B5CF6] text-white border-2 border-[#C4B5FD]'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span>Faculty</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTuitionVaultCategory('admin');
                    setLoginTarget('admin');
                    setPinInput('');
                    setLoginError('');
                  }}
                  className={`min-h-[40px] px-2 py-1.5 rounded-[10px] text-xs font-display font-bold whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    tuitionVaultCategory === 'admin'
                      ? 'bg-[#FACC15] text-[#020617] border-2 border-[#020617]'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span>Admin</span>
                </button>
              </div>

              {tuitionVaultCategory === 'signup' ? (
                signUpPendingApprovalName ? (
                  <div className="p-5 rounded-[16px] bg-[#0B1120] border-2 border-[#38BDF8] border-b-4 border-b-[#020617] space-y-3.5 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/20 border-2 border-[#22C55E] flex items-center justify-center mx-auto text-[#4ADE80]">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-display font-bold text-white">
                        Profile Queued for Admin Approval
                      </h4>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">
                        Your scholar request for{' '}
                        <strong className="text-[#38BDF8]">{signUpPendingApprovalName}</strong> has been sent. Once the Admin approves and calibrates your starting XP, your 4-digit PIN will unlock your dashboard automatically.
                      </p>
                    </div>
                    <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSignUpPendingApprovalName(null);
                          setTuitionVaultCategory('students');
                        }}
                        className="arcade-btn-lime w-full sm:w-auto px-5 py-2.5 text-xs cursor-pointer"
                      >
                        Back to Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignUpPendingApprovalName(null)}
                        className="arcade-key w-full sm:w-auto px-4 py-2.5 text-xs font-bold cursor-pointer"
                      >
                        Register Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePublicSignUp} className="space-y-3.5">
                    <div className="p-3 rounded-[14px] bg-[#0B1120] border-2 border-[#2563EB] text-xs text-[#E0F2FE] flex items-start gap-2">
                      <Shield className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                      <span>
                        New accounts require Admin approval before first login. Choose a strong 4-digit PIN (repeating or sequential PINs like 1111 or 1234 are blocked).
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                        Scholar Name *
                      </label>
                      <input
                        type="text"
                        value={signUpName}
                        onChange={(e) => {
                          setSignUpName(e.target.value);
                          setSignUpError('');
                        }}
                        placeholder="e.g. Aryan"
                        maxLength={28}
                        className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[14px] bg-[#080C16] border-2 border-[#334155] focus:border-[#38BDF8] text-sm text-white placeholder:text-slate-400 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                          Coaching / Batch
                        </label>
                        <input
                          type="text"
                          value={signUpInstitute}
                          onChange={(e) => setSignUpInstitute(e.target.value)}
                          placeholder="e.g. Allen / Modulus"
                          maxLength={24}
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[14px] bg-[#080C16] border-2 border-[#334155] focus:border-[#38BDF8] text-sm text-white placeholder:text-slate-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                          4-Digit Secret PIN *
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={signUpPin}
                          onChange={(e) => {
                            setSignUpPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setSignUpError('');
                          }}
                          placeholder="e.g. 4829"
                          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-[14px] bg-[#080C16] border-2 border-[#334155] focus:border-[#38BDF8] text-sm text-white font-mono tabular-nums tracking-widest placeholder:tracking-normal placeholder:text-slate-400 outline-none"
                        />
                      </div>
                    </div>

                    {pinStrengthHint && signUpPin.length > 0 && (
                      <div className="p-2.5 rounded-[12px] bg-[#FACC15]/15 border-2 border-[#FACC15] text-xs text-[#FEF08A] flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-[#FACC15] shrink-0" />
                        <span>{pinStrengthHint}</span>
                      </div>
                    )}

                    {signUpError && (
                      <div className="p-2.5 rounded-[12px] bg-[#F43F5E]/15 border-2 border-[#F43F5E] text-xs text-[#FECDD3] font-bold">
                        {signUpError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSigningUp}
                      className="arcade-btn-lime w-full min-h-[48px] py-3 px-4 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>{isSigningUp ? 'Transmitting Request...' : 'Submit Scholar Registration'}</span>
                    </button>
                  </form>
                )
              ) : (
                <>
                  {/* Brute-Force Lockout Banner */}
                  {isLocked && (
                    <div className="p-3 rounded-[14px] bg-[#F43F5E]/20 border-2 border-[#F43F5E] text-xs text-white flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-[#F43F5E] shrink-0" />
                        <span className="font-semibold">
                          Brute-Force Shield Active · Keypad Locked
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#020617] font-mono tabular-nums font-extrabold text-[#FACC15] shrink-0">
                        {formatCooldown(lockoutSecondsRemaining)}
                      </span>
                    </div>
                  )}

                  {!isLocked && failedAttemptsCount > 0 && (
                    <div className="px-3 py-2 rounded-[12px] bg-[#FACC15]/15 border border-[#FACC15]/50 text-[11px] text-[#FEF08A] flex items-center justify-between gap-2 font-mono">
                      <span>Security Rate-Limiter Active</span>
                      <span className="font-bold text-[#FACC15]">
                        {remainingTriesBeforeCooldown}{' '}
                        {remainingTriesBeforeCooldown === 1 ? 'try' : 'tries'} before cooldown
                      </span>
                    </div>
                  )}

                  {(tuitionVaultCategory === 'students' || tuitionVaultCategory === 'teachers') && (
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                        {tuitionVaultCategory === 'teachers'
                          ? 'Faculty Name (Optional)'
                          : 'Scholar Name (Optional / Or Dial 4-Digit PIN Directly)'}
                      </label>
                      <input
                        type="text"
                        value={signInNameInput}
                        onChange={(e) => {
                          setSignInNameInput(e.target.value);
                          setLoginError('');
                        }}
                        placeholder={
                          tuitionVaultCategory === 'teachers'
                            ? 'Enter teacher name or dial 4-digit faculty PIN'
                            : 'Type your name or dial your 4-digit PIN below'
                        }
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-[14px] bg-[#080C16] border-2 border-[#334155] focus:border-[#38BDF8] text-xs sm:text-sm text-white placeholder:text-slate-400 outline-none"
                      />
                    </div>
                  )}

                  {tuitionVaultCategory === 'admin' && (
                    <div className="w-full p-3 rounded-[14px] flex items-center justify-between border-2 bg-[#FACC15]/10 border-[#FACC15] text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FACC15] text-[#020617] border-2 border-[#020617] flex items-center justify-center font-bold shrink-0">
                          <Shield className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <div className="font-display font-bold text-xs sm:text-sm text-white">
                            Administrator Master Vault
                          </div>
                          <div className="text-[11px] text-[#FEF08A]">
                            Protected by progressive brute-force rate limiting
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4-Digit Tactile PIN Readout Display */}
                  <div className="py-3.5 px-4 rounded-[16px] bg-[#080C16] border-2 border-[#334155] border-b-4 border-b-[#020617] flex flex-col items-center justify-center space-y-2">
                    <div className="flex items-center justify-center gap-3.5 py-1">
                      {[0, 1, 2, 3].map((idx) => {
                        const filled = pinInput.length > idx;
                        return (
                          <div
                            key={idx}
                            className={`w-11 h-12 rounded-[12px] border-2 flex items-center justify-center font-mono text-lg font-extrabold transition-all duration-150 ${
                              filled
                                ? tuitionVaultCategory === 'admin'
                                  ? 'bg-[#FACC15] text-[#020617] border-[#020617] border-b-4 border-b-[#A16207] -translate-y-0.5'
                                  : tuitionVaultCategory === 'teachers'
                                  ? 'bg-[#8B5CF6] text-white border-[#C4B5FD] border-b-4 border-b-[#4C1D95] -translate-y-0.5'
                                  : 'bg-[#2563EB] text-white border-[#38BDF8] border-b-4 border-b-[#1E3A8A] -translate-y-0.5'
                                : 'bg-[#111827] border-[#334155] text-slate-500'
                            }`}
                          >
                            {filled ? '●' : ''}
                          </div>
                        );
                      })}
                    </div>

                    {loginError ? (
                      <div className="text-xs text-[#F43F5E] font-bold text-center px-2">
                        {loginError}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#94A3B8] font-mono text-center">
                        {isVerifyingPin
                          ? 'VERIFYING CREDENTIALS...'
                          : isLocked
                          ? `LOCKED / WAIT ${formatCooldown(lockoutSecondsRemaining)}`
                          : tuitionVaultCategory === 'admin'
                          ? 'ENTER 4-DIGIT ADMIN PIN'
                          : tuitionVaultCategory === 'teachers'
                          ? 'ENTER 4-DIGIT FACULTY PIN'
                          : signInNameInput.trim()
                          ? `SCHOLAR: ${signInNameInput.trim().toUpperCase()}`
                          : 'DIAL 4-DIGIT PIN ON KEYPAD OR KEYBOARD'}
                      </div>
                    )}
                  </div>

                  {/* Tactile 3D Arcade Keypad (>= 48px targets) */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={isLocked || isVerifyingPin}
                        onClick={() => handlePinInputChange(pinInput + String(num))}
                        className="arcade-key min-h-[48px] h-12 text-lg font-extrabold font-mono tabular-nums cursor-pointer disabled:opacity-40"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={isVerifyingPin}
                      onClick={() => {
                        setPinInput('');
                        setLoginError('');
                      }}
                      className="arcade-key min-h-[48px] h-12 text-xs font-mono font-extrabold text-[#FACC15] cursor-pointer disabled:opacity-40"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      disabled={isLocked || isVerifyingPin}
                      onClick={() => handlePinInputChange(pinInput + '0')}
                      className="arcade-key min-h-[48px] h-12 text-lg font-extrabold font-mono tabular-nums cursor-pointer disabled:opacity-40"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={isVerifyingPin}
                      onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                      aria-label="Delete digit"
                      className="arcade-key min-h-[48px] h-12 text-xs font-mono font-extrabold text-[#F43F5E] cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Delete className="w-4 h-4" />
                      <span>DEL</span>
                    </button>
                  </div>

                  {/* Mobile Quick Actions */}
                  <div className="pt-2 border-t-2 border-[#1E293B] flex flex-col gap-2">
                    <PWAInstallButton
                      isInstallable={pwa.isInstallable}
                      isInstalled={pwa.isInstalled}
                      isMobileDevice={pwa.isMobileDevice}
                      onInstallClick={() => pwa.triggerInstall()}
                      variant="login"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* 7. QUIET FOOTER WITH CREATOR INSTAGRAM LINK */}
      <footer className="surface-card p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-sm font-display font-bold text-white">
            JEE Grind Arena
          </div>
          <div className="text-xs text-[#94A3B8] mt-0.5">
            Tactile competitive study sanctuary · Automatic device login for returning scholars
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://www.instagram.com/s.ai.0717/"
            target="_blank"
            rel="noopener noreferrer"
            className="arcade-btn-violet px-4 py-2 text-xs whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer no-underline"
          >
            <span>Instagram · @s.ai.0717</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="arcade-key px-3.5 py-2 text-xs font-display font-bold text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Back to Top
          </button>
        </div>
      </footer>
    </div>
  );
};
