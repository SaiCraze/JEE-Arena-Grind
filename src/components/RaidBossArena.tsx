import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Zap, Trophy, Flame, Sparkles, Crosshair, RefreshCw, ChevronRight, Award, Activity, Shield, Lock } from 'lucide-react';
import { playBossHitSound, playVictoryFanfare } from '../utils/soundEffects';

export interface RaidBossDefinition {
  id: string;
  name: string;
  title: string;
  lore: string;
  baseHp: number;
  defaultHp: number;
  weakness: string;
  accentColor: string;
  coreColor: string;
  secondaryColor: string;
  rewardXp: number;
  rewardTitle: string;
}

export const RAID_BOSS_ROSTER: RaidBossDefinition[] = [
  {
    id: 'backlog_leviathan',
    name: 'THE BACKLOG LEVIATHAN',
    title: 'Devourer of Unwatched Lectures & Unsolved Sheets',
    lore: 'An abyssal cyber-dreadnought forged from postponed chapters. Every verified study minute and solved problem shatters its containment armor.',
    baseHp: 2000,
    defaultHp: 2000,
    weakness: '2x Damage from 45m+ Deep Work & PYQs',
    accentColor: '#38bdf8',
    coreColor: '#6366f1',
    secondaryColor: '#0ea5e9',
    rewardXp: 50,
    rewardTitle: 'Leviathan Slayer',
  },
  {
    id: 'procrastination_demon',
    name: 'CHRONOS THE STAGNANT',
    title: 'Arch-Weaver of Infinite Distraction Loops',
    lore: 'Feeds on fragmented focus and half-finished schedules. Sustained Pomodoro blocks sever its temporal anchors.',
    baseHp: 2800,
    defaultHp: 2800,
    weakness: 'Crushed by Unbroken Study Streaks',
    accentColor: '#a855f7',
    coreColor: '#ec4899',
    secondaryColor: '#8b5cf6',
    rewardXp: 65,
    rewardTitle: 'Breaker of Chronos',
  },
  {
    id: 'negative_marking_hydra',
    name: 'THE ATTRITION HYDRA',
    title: 'Multi-Headed Sentinel of -1 Trap Options',
    lore: 'Where one careless calculation error occurs, two more heads materialize. Only surgical accuracy and high question volume can cauterize its core.',
    baseHp: 3600,
    defaultHp: 3600,
    weakness: 'Heavy Bonus Damage from Mock Tests & High Qs',
    accentColor: '#10b981',
    coreColor: '#14b8a6',
    secondaryColor: '#059669',
    rewardXp: 80,
    rewardTitle: 'Hydra Vanquisher',
  },
  {
    id: 'silly_mistake_specter',
    name: 'NULL-PHASE WRAITH',
    title: 'Phantom of Sign Flips & Misread Constants',
    lore: 'Lurks in the final step of a 10-minute derivation. High-focus problem sets lock its phase shifts and vaporize its hull.',
    baseHp: 4500,
    defaultHp: 4500,
    weakness: 'Destroyed by High-Accuracy Problem Solving',
    accentColor: '#60a5fa',
    coreColor: '#818cf8',
    secondaryColor: '#3b82f6',
    rewardXp: 100,
    rewardTitle: 'Wraith Exorcist',
  },
  {
    id: 'organic_labyrinth_wyrm',
    name: 'THE SINGULARITY WYRM',
    title: 'Apex Guardian of Multi-Concept Synthesis',
    lore: 'The ultimate syllabus construct combining Electro-Mechanics, Calculus, and Stereochemistry. Defeating it cements immortal squad prestige.',
    baseHp: 6000,
    defaultHp: 6000,
    weakness: 'All-Out Squad Assault (Minutes + Questions)',
    accentColor: '#f43f5e',
    coreColor: '#a855f7',
    secondaryColor: '#e11d48',
    rewardXp: 150,
    rewardTitle: 'Sovereign of the Labyrinth',
  }
];

interface RaidBossProps {
  bossId?: string;
  bossMaxHp?: number;
  bossCurrentHp?: number;
  raidEnabled?: boolean;
  raidOverrideSchedule?: boolean;
  lastDamageHit?: {
    attackerName?: string;
    damage?: number;
    timestamp?: number;
  } | null;
  contributions?: Array<{
    id: string;
    name: string;
    institute?: string;
    damage: number;
  }>;
  isAdmin?: boolean;
  isBlackoutActive?: boolean;
  adminPeekStandings?: boolean;
  onOpenAdminBossControls?: () => void;
  bossState?: {
    name?: string;
    bossId?: string;
    level?: number;
    maxHp: number;
    currentHp: number;
    weekId: string;
    lastAttacker?: string;
    lastDamage?: number;
    damageMap?: Record<string, number>;
    contributors?: Record<string, number>;
    defeatedCount?: number;
  } | null;
  members?: Array<{
    id: string;
    name: string;
    avatar: string;
    color?: string;
  }>;
  soundEnabled?: boolean;
  onSpawnNextBoss?: (nextBossIndex: number, nextLevel: number) => void;
  onClaimVictoryXp?: (bossKey: string, xpAmount: number, mvpTitle?: string) => void;
  claimedBossKeys?: string[];
  currentUserId?: string;
  myPersonalXp?: number;
}

export const RaidBossArena: React.FC<RaidBossProps> = ({
  bossId,
  bossMaxHp,
  bossCurrentHp,
  raidEnabled = true,
  lastDamageHit,
  contributions = [],
  isAdmin = false,
  isBlackoutActive = false,
  adminPeekStandings = false,
  onOpenAdminBossControls,
  bossState,
  members = [],
  soundEnabled = true,
  onSpawnNextBoss,
  onClaimVictoryXp,
  claimedBossKeys = [],
  currentUserId,
  myPersonalXp = 0,
}) => {
  const [isAttacking, setIsAttacking] = useState(false);
  const [floatingDamage, setFloatingDamage] = useState<number | null>(null);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const prevHpRef = useRef<number | null>(null);
  const prevMyDamageRef = useRef<number | null>(null);

  if (raidEnabled === false) return null;

  const isBlackoutSealed = Boolean(isBlackoutActive && !adminPeekStandings);

  const resolvedBossId = bossId || bossState?.bossId || 'backlog_leviathan';
  const rosterIndex = Math.max(0, RAID_BOSS_ROSTER.findIndex(b => b.id === resolvedBossId));
  const currentLevel = bossState?.level || (rosterIndex + 1);
  const activeBossDef =
    RAID_BOSS_ROSTER.find(b => b.id === resolvedBossId) ||
    RAID_BOSS_ROSTER[0];

  const rawMap = bossState?.damageMap || bossState?.contributors || {};
  const sortedContributors =
    contributions.length > 0
      ? [...contributions]
          .map(c => ({
            id: c.id,
            name: c.name,
            avatar: c.institute || '⚡',
            damage: Number(c.damage) || 0,
          }))
          .filter(c => c.damage > 0)
          .sort((a, b) => b.damage - a.damage)
      : Object.entries(rawMap)
          .map(([memberId, dmg]) => {
            const member = members.find(m => m.id === memberId);
            return {
              id: memberId,
              name: member?.name || memberId,
              avatar: member?.avatar || '⚡',
              damage: Number(dmg) || 0,
            };
          })
          .filter(c => c.damage > 0)
          .sort((a, b) => b.damage - a.damage);

  const myContribution = currentUserId
    ? sortedContributors.find(c => c.id === currentUserId) ||
      (() => {
        const fromProps = contributions.find(c => c.id === currentUserId);
        const fromMembers = members.find(m => m.id === currentUserId);
        return {
          id: currentUserId,
          name: fromProps?.name || fromMembers?.name || 'You',
          avatar: fromProps?.institute || fromMembers?.avatar || '⚡',
          damage: Number(fromProps?.damage ?? rawMap[currentUserId] ?? 0) || 0,
        };
      })()
    : null;
  const myDamage = myContribution?.damage || 0;

  const maxHp = bossMaxHp ?? bossState?.maxHp ?? activeBossDef.baseHp;
  const rawCurrentHp = bossCurrentHp ?? bossState?.currentHp ?? maxHp;
  const currentHp = isBlackoutSealed ? Math.max(0, maxHp - myDamage) : rawCurrentHp;
  const hpPercent = Math.max(0, Math.min(100, (currentHp / Math.max(1, maxHp)) * 100));
  const isDefeated = !isBlackoutSealed && rawCurrentHp <= 0;
  const isEnraged = !isBlackoutSealed && !isDefeated && hpPercent <= 35;

  const bossKey = `${bossState?.weekId || 'week'}_lvl_${currentLevel}_${activeBossDef.id}`;
  const hasClaimedVictory = claimedBossKeys.includes(bossKey);

  useEffect(() => {
    if (isBlackoutSealed) {
      if (prevMyDamageRef.current !== null && myDamage > prevMyDamageRef.current) {
        const dmg = myDamage - prevMyDamageRef.current;
        setIsAttacking(true);
        setFloatingDamage(dmg);
        if (soundEnabled) {
          playBossHitSound();
        }
        const timer = setTimeout(() => {
          setIsAttacking(false);
          setFloatingDamage(null);
        }, 1600);
        prevMyDamageRef.current = myDamage;
        return () => clearTimeout(timer);
      }
      prevMyDamageRef.current = myDamage;
      return;
    }

    if (prevHpRef.current !== null && rawCurrentHp < prevHpRef.current) {
      const dmg = prevHpRef.current - rawCurrentHp;
      setIsAttacking(true);
      setFloatingDamage(dmg);
      if (soundEnabled) {
        if (rawCurrentHp <= 0) {
          playVictoryFanfare();
        } else {
          playBossHitSound();
        }
      }

      const timer = setTimeout(() => {
        setIsAttacking(false);
        setFloatingDamage(null);
      }, 1600);
      prevHpRef.current = rawCurrentHp;
      return () => clearTimeout(timer);
    }
    prevHpRef.current = rawCurrentHp;
  }, [rawCurrentHp, myDamage, isBlackoutSealed, soundEnabled]);

  const latestAttackerName = isBlackoutSealed ? undefined : (lastDamageHit?.attackerName || bossState?.lastAttacker);
  const latestDamageVal = isBlackoutSealed ? undefined : (lastDamageHit?.damage ?? bossState?.lastDamage);

  const mvpId = sortedContributors[0]?.id;
  const isCurrentUserMvp = !isBlackoutSealed && Boolean(currentUserId && mvpId === currentUserId);
  const userContributed = Boolean(currentUserId && myDamage > 0);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden surface-card p-4 sm:p-7 mb-4 sm:mb-6 transition-all duration-500">
      {/* Subtle Top Rim Reflection */}
      <div
        className="absolute -top-36 left-1/2 -translate-x-1/2 w-[540px] h-52 rounded-full blur-[110px] opacity-25 pointer-events-none transition-colors duration-700"
        style={{ background: isDefeated ? '#10b981' : activeBossDef.accentColor }}
      />

      {/* Top Executive Telemetry Strip */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3.5 sm:pb-4 mb-4 sm:mb-5 border-b border-white/[0.07]">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-[0.14em] bg-white/[0.05] text-zinc-200 border border-white/10">
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            CO-OP RAID TELEMETRY • TIER {currentLevel}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-white/[0.03] text-zinc-400 border border-white/[0.07]">
            <Crosshair className="w-3 h-3 text-emerald-400" />
            {activeBossDef.weakness}
          </span>

          {isEnraged && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse">
              <Flame className="w-3 h-3" />
              CRITICAL PHASE (&lt;35% HP)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && onOpenAdminBossControls && (
            <button
              onClick={onOpenAdminBossControls}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-mono uppercase tracking-wider text-sky-300 transition-colors cursor-pointer"
            >
              <Shield className="w-3 h-3" />
              Configure Boss
            </button>
          )}
          <button
            onClick={() => setShowRosterModal(!showRosterModal)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-mono uppercase tracking-wider text-zinc-300 transition-colors cursor-pointer"
          >
            <Award className="w-3 h-3 text-sky-400" />
            {showRosterModal ? 'Hide Boss Matrix' : 'Boss Roster (5)'}
          </button>
        </div>
      </div>

      {/* Collapsible Boss Roster Matrix */}
      <AnimatePresence>
        {showRosterModal && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-5 sm:mb-6"
          >
            <div className="p-3.5 sm:p-4 rounded-2xl bg-black/50 border border-white/[0.07] grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {RAID_BOSS_ROSTER.map((b, idx) => {
                const isCurrent = b.id === activeBossDef.id;
                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-white/[0.06] border-white/25 shadow-lg'
                        : 'bg-white/[0.015] border-white/[0.05] opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-zinc-400 mb-1">
                      <span>STAGE 0{idx + 1}</span>
                      {isCurrent && <span className="text-emerald-400 font-bold">ACTIVE</span>}
                    </div>
                    <div className="text-xs font-display font-bold text-white truncate">{b.name}</div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-1">
                      Base: {b.baseHp.toLocaleString()} HP
                    </div>
                    <div className="text-[10px] font-mono text-sky-400 mt-0.5">
                      Bounty: +{b.rewardXp} XP
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Left Animated Holographic Boss SVG Chamber + Right Combat Telemetry */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
        {/* Left 5 Columns: High-Craft Animated SVG Boss Core Stage */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[240px] sm:max-w-[300px] aspect-square rounded-3xl bg-gradient-to-b from-white/[0.04] via-zinc-950/90 to-black/95 border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_25px_60px_rgba(0,0,0,0.85)] flex items-center justify-center p-3 sm:p-4 overflow-hidden group">
            {/* Subtle Diagnostic Grid Lines */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at center, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Corner HUD Reticles */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-white/25 pointer-events-none" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-white/25 pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-white/25 pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-white/25 pointer-events-none" />

            {/* Top Left Chamber Telemetry Label */}
            <div className="absolute top-3 left-3.5 flex items-center gap-1.5 text-[8.5px] sm:text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-400">
              <span
                className="w-1.5 h-1.5 rounded-full animate-ping"
                style={{ backgroundColor: isDefeated ? '#10b981' : activeBossDef.accentColor }}
              />
              {isDefeated ? 'CORE NEUTRALIZED' : isEnraged ? 'OVERDRIVE RESONANCE' : 'ENTITY LOCKED'}
            </div>

            {/* Bottom Right Integrity Readout */}
            <div className="absolute bottom-3 right-3.5 text-[9.5px] sm:text-[10px] font-mono font-bold tracking-wider text-zinc-300 bg-black/60 px-2.5 py-0.5 rounded-full border border-white/10">
              {isBlackoutSealed ? `YOUR DMG: ${myDamage.toLocaleString()}` : `${hpPercent.toFixed(1)}% INTEGRITY`}
            </div>

            {/* Floating Damage Popover */}
            <AnimatePresence>
              {floatingDamage !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.7 }}
                  animate={{ opacity: 1, y: -38, scale: 1.25 }}
                  exit={{ opacity: 0, y: -64, scale: 0.9 }}
                  className="absolute z-30 px-3.5 py-1.5 rounded-full bg-rose-500/90 text-white font-mono font-black text-base tracking-tight shadow-[0_0_30px_rgba(244,63,94,0.8)] border border-white/40 pointer-events-none"
                >
                  -{floatingDamage} HP!
                </motion.div>
              )}
            </AnimatePresence>

            {/* ULTRA-DETAILED ANIMATED SVG BOSS ENTITY */}
            <motion.div
              animate={
                isAttacking
                  ? {
                      x: [0, -10, 12, -8, 8, -4, 0],
                      y: [0, -6, 6, -4, 0],
                      scale: [1, 1.12, 0.92, 1.06, 1],
                      filter: [
                        'brightness(1) contrast(1)',
                        'brightness(2.2) contrast(1.4) drop-shadow(0 0 35px rgba(244,63,94,0.9))',
                        'brightness(1) contrast(1)',
                      ],
                    }
                  : isDefeated
                  ? {
                      scale: 0.84,
                      opacity: 0.45,
                      rotate: [0, 2, -2, 0],
                    }
                  : {
                      y: [0, -7, 0],
                      scale: isEnraged ? [1, 1.045, 1] : [1, 1.02, 1],
                    }
              }
              transition={
                isAttacking
                  ? { duration: 0.55 }
                  : { duration: isEnraged ? 1.8 : 3.4, repeat: Infinity, ease: 'easeInOut' }
              }
              className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center select-none"
            >
              <svg
                viewBox="0 0 260 260"
                className="w-full h-full overflow-visible"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <radialGradient id={`coreGlow_${activeBossDef.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="35%" stopColor={activeBossDef.accentColor} stopOpacity="0.85" />
                    <stop offset="75%" stopColor={activeBossDef.coreColor} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={activeBossDef.coreColor} stopOpacity="0" />
                  </radialGradient>

                  <linearGradient id={`armorGrad_${activeBossDef.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
                    <stop offset="45%" stopColor={activeBossDef.accentColor} stopOpacity="0.75" />
                    <stop offset="100%" stopColor="#09090b" stopOpacity="0.95" />
                  </linearGradient>

                  <linearGradient id={`wingGrad_${activeBossDef.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={activeBossDef.accentColor} stopOpacity="0.65" />
                    <stop offset="100%" stopColor={activeBossDef.coreColor} stopOpacity="0.1" />
                  </linearGradient>

                  <filter id="cyberGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* LAYER 1: Outer Counter-Rotating Orbital Telemetry Ring */}
                <g
                  style={{
                    transformOrigin: '130px 130px',
                    animation: `spin ${isEnraged ? '9s' : '18s'} linear infinite`,
                  }}
                >
                  <circle
                    cx="130"
                    cy="130"
                    r="116"
                    fill="none"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.2"
                    strokeOpacity="0.32"
                    strokeDasharray="18 10 4 10"
                  />
                  <circle
                    cx="130"
                    cy="14"
                    r="3.5"
                    fill="#ffffff"
                    filter="url(#cyberGlow)"
                  />
                  <circle
                    cx="130"
                    cy="246"
                    r="3.5"
                    fill={activeBossDef.accentColor}
                    filter="url(#cyberGlow)"
                  />
                  <polygon
                    points="130,6 126,16 134,16"
                    fill={activeBossDef.accentColor}
                    opacity="0.8"
                  />
                </g>

                {/* LAYER 2: Inner Reverse-Rotating Hexagonal Containment Matrix */}
                <g
                  style={{
                    transformOrigin: '130px 130px',
                    animation: `spin ${isEnraged ? '7s' : '14s'} linear infinite reverse`,
                  }}
                >
                  <circle
                    cx="130"
                    cy="130"
                    r="96"
                    fill="none"
                    stroke={activeBossDef.coreColor}
                    strokeWidth="1.5"
                    strokeOpacity="0.45"
                    strokeDasharray="40 20"
                  />
                  <polygon
                    points="130,38 210,84 210,176 130,222 50,176 50,84"
                    fill="none"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1"
                    strokeOpacity="0.22"
                  />
                </g>

                {/* LAYER 3: Ambient Core Energy Halo */}
                <circle
                  cx="130"
                  cy="130"
                  r={isEnraged ? '84' : '74'}
                  fill={`url(#coreGlow_${activeBossDef.id})`}
                />

                {/* LAYER 4: Articulated Mecha-Seraph Wings / Levitating Exoskeleton Blades */}
                <g filter="url(#cyberGlow)">
                  {/* Left Upper Wing Fin */}
                  <path
                    d="M 88 105 L 26 58 L 44 108 L 76 122 Z"
                    fill={`url(#wingGrad_${activeBossDef.id})`}
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.4"
                  />
                  {/* Right Upper Wing Fin */}
                  <path
                    d="M 172 105 L 234 58 L 216 108 L 184 122 Z"
                    fill={`url(#wingGrad_${activeBossDef.id})`}
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.4"
                  />
                  {/* Left Mid Tactical Blade */}
                  <path
                    d="M 82 130 L 18 126 L 38 152 L 84 146 Z"
                    fill={`url(#armorGrad_${activeBossDef.id})`}
                    stroke="#ffffff"
                    strokeOpacity="0.5"
                    strokeWidth="1.2"
                  />
                  {/* Right Mid Tactical Blade */}
                  <path
                    d="M 178 130 L 242 126 L 222 152 L 176 146 Z"
                    fill={`url(#armorGrad_${activeBossDef.id})`}
                    stroke="#ffffff"
                    strokeOpacity="0.5"
                    strokeWidth="1.2"
                  />
                  {/* Left Lower Thruster Fin */}
                  <path
                    d="M 94 158 L 42 204 L 72 196 L 106 172 Z"
                    fill={`url(#wingGrad_${activeBossDef.id})`}
                    stroke={activeBossDef.coreColor}
                    strokeWidth="1.3"
                  />
                  {/* Right Lower Thruster Fin */}
                  <path
                    d="M 166 158 L 218 204 L 188 196 L 154 172 Z"
                    fill={`url(#wingGrad_${activeBossDef.id})`}
                    stroke={activeBossDef.coreColor}
                    strokeWidth="1.3"
                  />
                </g>

                {/* LAYER 5: Central Armored Dreadnought Chassis & Crown Crest */}
                <g>
                  {/* Top Sovereign Spire */}
                  <polygon
                    points="130,36 112,78 130,68 148,78"
                    fill={`url(#armorGrad_${activeBossDef.id})`}
                    stroke="#ffffff"
                    strokeWidth="1.3"
                    strokeOpacity="0.7"
                  />
                  {/* Left & Right Crown Horns */}
                  <polygon
                    points="106,82 74,48 92,98"
                    fill="#18181b"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="154,82 186,48 168,98"
                    fill="#18181b"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.5"
                  />

                  {/* Main Octagonal Armored Core Hull */}
                  <polygon
                    points="130,68 176,94 184,142 156,188 130,204 104,188 76,142 84,94"
                    fill="#09090b"
                    stroke={`url(#armorGrad_${activeBossDef.id})`}
                    strokeWidth="2.5"
                  />

                  {/* Inner Faceted Armor Plating */}
                  <polygon
                    points="130,80 164,100 170,138 148,176 130,188 112,176 90,138 96,100"
                    fill={`url(#armorGrad_${activeBossDef.id})`}
                    opacity="0.35"
                  />

                  {/* Mandible / Lower Fang Guards */}
                  <polygon
                    points="102,174 88,214 116,192"
                    fill="#09090b"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.4"
                  />
                  <polygon
                    points="158,174 172,214 144,192"
                    fill="#09090b"
                    stroke={activeBossDef.accentColor}
                    strokeWidth="1.4"
                  />
                </g>

                {/* LAYER 6: Singularity Reactor Core & Optic Visors */}
                {!isDefeated ? (
                  <g filter="url(#cyberGlow)">
                    {/* Central Singularity Diamond Core */}
                    <polygon
                      points="130,118 146,142 130,168 114,142"
                      fill={isEnraged ? '#f43f5e' : activeBossDef.accentColor}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="130,126 139,142 130,158 121,142"
                      fill="#ffffff"
                    />

                    {/* Fierce Angular Cybernetic Eyes */}
                    <polygon
                      points="96,110 124,120 118,127 92,118"
                      fill={isEnraged ? '#fb7185' : '#ffffff'}
                    />
                    <polygon
                      points="164,110 136,120 142,127 168,118"
                      fill={isEnraged ? '#fb7185' : '#ffffff'}
                    />

                    {/* Forehead Telemetry Conduit */}
                    <line
                      x1="130"
                      y1="76"
                      x2="130"
                      y2="110"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                ) : (
                  /* Defeated Shattered Core Visor */
                  <g stroke="#10b981" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="98" y1="108" x2="118" y2="126" />
                    <line x1="118" y1="108" x2="98" y2="126" />
                    <line x1="142" y1="108" x2="162" y2="126" />
                    <line x1="162" y1="108" x2="142" y2="126" />
                    <polyline
                      points="112,155 124,144 134,158 148,142"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* LAYER 7: Kinetic Laser Slash Overlay When Attacked */}
                {isAttacking && (
                  <g filter="url(#cyberGlow)">
                    <line
                      x1="25"
                      y1="35"
                      x2="235"
                      y2="225"
                      stroke="#ffffff"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <line
                      x1="225"
                      y1="45"
                      x2="35"
                      y2="215"
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="130"
                      cy="130"
                      r="90"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="3"
                      strokeOpacity="0.9"
                    />
                  </g>
                )}
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Right 7 Columns: Boss Identity, Precision Health Bar & Squad Damage Telemetry */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-400 font-semibold">
                {activeBossDef.title}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
              {bossState?.name || activeBossDef.name}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {activeBossDef.lore}
            </p>
          </div>

          {/* Segmented Liquid-Glass Health Bar */}
          <div className="p-4 rounded-2xl bg-black/45 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                {isBlackoutSealed ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span>PERSONAL STRIKE METER (SQUAD HP SEALED)</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-sky-400" />
                    <span>ARMOR INTEGRITY</span>
                  </>
                )}
              </span>
              <div className="flex items-center gap-2">
                {isBlackoutSealed ? (
                  <>
                    <span className="text-emerald-400 font-bold text-sm">
                      {myDamage.toLocaleString()} DMG
                    </span>
                    <span className="text-zinc-500">(Your Hits Only)</span>
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold text-sm">
                      {currentHp.toLocaleString()}
                    </span>
                    <span className="text-zinc-500">/ {maxHp.toLocaleString()} HP</span>
                  </>
                )}
              </div>
            </div>

            <div className="relative w-full h-3.5 rounded-full bg-zinc-950 overflow-hidden p-0.5 border border-white/10">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${hpPercent}%` }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.8 }}
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: isDefeated
                    ? '#10b981'
                    : `linear-gradient(90deg, ${activeBossDef.coreColor}, ${activeBossDef.accentColor})`,
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.35)_50%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2.2s_infinite]" />
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                {isBlackoutSealed ? (
                  <span>
                    Blackout Active: <strong className="text-zinc-200">Only your personal damage ({myDamage.toLocaleString()} DMG) is visible</strong>
                  </span>
                ) : latestAttackerName ? (
                  <span>
                    Latest Strike: <strong className="text-white">{latestAttackerName}</strong>{' '}
                    <span className="text-emerald-400 font-semibold">(-{latestDamageVal || 0} HP)</span>
                  </span>
                ) : (
                  <span>Log a study block or problem set to deal direct kinetic damage</span>
                )}
              </div>
              <span className="text-zinc-400">
                1 Min = <strong className="text-zinc-200">1 DMG</strong> • 1 Solved Q = <strong className="text-zinc-200">3 DMG</strong>
              </span>
            </div>
          </div>

          {/* Squad Damage Leaderboard Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400">
              <span>{isBlackoutSealed ? 'PERSONAL STRIKE TELEMETRY (BLACKOUT)' : 'SQUAD STRIKE TELEMETRY'}</span>
              <span>MVP BOUNTY: &ldquo;{activeBossDef.rewardTitle}&rdquo;</span>
            </div>

            {isBlackoutSealed ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border bg-gradient-to-br from-sky-500/12 via-indigo-500/5 to-transparent border-sky-400/35 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none">{myContribution?.avatar || '⚡'}</span>
                      <span className="text-xs font-semibold text-white truncate">
                        {myContribution?.name || 'You'}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">
                      YOUR STATS ONLY
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xs font-bold text-amber-300">
                      {myPersonalXp.toLocaleString()} XP
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      {myDamage.toLocaleString()} DMG
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-white/[0.02] border-rose-500/25 flex items-center gap-2.5 text-xs text-zinc-400 font-mono">
                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>All other squadmates&apos; boss damage, XP gains &amp; analytics are locked until the Admin reveals the standings.</span>
                </div>
              </div>
            ) : sortedContributors.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400 font-mono text-center">
                No strikes recorded against this tier yet. First operative to log focus claims early MVP lead.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {sortedContributors.slice(0, 3).map((contributor, idx) => {
                  const share = Math.min(100, Math.round((contributor.damage / Math.max(1, maxHp - currentHp)) * 100));
                  const isMvp = idx === 0;
                  return (
                    <div
                      key={contributor.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        isMvp
                          ? 'bg-gradient-to-br from-sky-500/12 via-indigo-500/5 to-transparent border-sky-400/35 shadow-[0_8px_25px_rgba(56,189,248,0.12)]'
                          : 'bg-white/[0.025] border-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base leading-none">{contributor.avatar}</span>
                          <span className="text-xs font-semibold text-white truncate">
                            {contributor.name}
                          </span>
                        </div>
                        {isMvp && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">
                            MVP #1
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-xs font-bold text-emerald-400">
                          {contributor.damage.toLocaleString()} DMG
                        </span>
                        <span className="text-[10px] text-zinc-400">{share}% share</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Victory Bounty Claim & Next Tier Spawn Controls */}
          {isDefeated && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold">
                    TIER {currentLevel} BOSS VANQUISHED
                  </div>
                  <div className="text-xs text-zinc-300">
                    Squad Victory Bounty: <strong className="text-white">+{activeBossDef.rewardXp} XP</strong>
                    {isCurrentUserMvp && (
                      <span className="ml-1.5 text-sky-300 font-semibold">
                        + MVP Title &ldquo;{activeBossDef.rewardTitle}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onClaimVictoryXp && userContributed && !hasClaimedVictory && (
                  <button
                    onClick={() =>
                      onClaimVictoryXp(
                        bossKey,
                        activeBossDef.rewardXp,
                        isCurrentUserMvp ? activeBossDef.rewardTitle : undefined
                      )
                    }
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-display font-bold text-xs transition-all shadow-lg"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Claim +{activeBossDef.rewardXp} XP
                  </button>
                )}

                {hasClaimedVictory && (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-semibold">
                    Bounty Claimed
                  </span>
                )}

                {onSpawnNextBoss && (
                  <button
                    onClick={() => onSpawnNextBoss(rosterIndex + 1, currentLevel + 1)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/15 font-mono text-xs font-semibold transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                    Deploy Tier {currentLevel + 1}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
