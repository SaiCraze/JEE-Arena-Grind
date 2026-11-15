import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, CheckCircle2, Flame, Sparkles, BookOpen, Target, Award, Shield } from 'lucide-react';
import { playStudyLogSuccessChime } from '../utils/soundEffects';

export interface StudyLogSuccessData {
  xpEarned: number;
  subject?: string;
  durationMins: number;
  solvedQuestions?: number;
  attemptedQuestions?: number;
  totalQCount?: number;
  tasksCount?: number;
  memberName: string;
  streakCount?: number;
  streakMultiplier?: number;
}

interface StudyLogSuccessAnimationProps {
  data?: StudyLogSuccessData | null;
  onComplete?: () => void;
  memberName?: string;
  xpEarned?: number;
  durationMins?: number;
  totalQCount?: number;
  tasksCount?: number;
  streakCount?: number;
  subject?: string;
  onClose?: () => void;
}

export const StudyLogSuccessAnimation: React.FC<StudyLogSuccessAnimationProps> = (props) => {
  const [displayXp, setDisplayXp] = useState(0);

  const handleDismiss = props.onClose || props.onComplete || (() => {});
  const data: StudyLogSuccessData | null = props.data ?? (props.memberName !== undefined ? {
    memberName: props.memberName,
    xpEarned: props.xpEarned ?? 0,
    durationMins: props.durationMins ?? 0,
    solvedQuestions: props.totalQCount ?? 0,
    totalQCount: props.totalQCount ?? 0,
    tasksCount: props.tasksCount,
    streakCount: props.streakCount,
    subject: props.subject || 'Focused Study'
  } : null);

  useEffect(() => {
    if (!data) return;

    playStudyLogSuccessChime();

    const target = Math.max(0, data.xpEarned);
    if (target === 0) {
      setDisplayXp(0);
    } else {
      const duration = 900;
      const startTime = performance.now();
      let rafId: number;

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplayXp(Math.round(eased * target));
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        }
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }
  }, [data?.xpEarned, data?.memberName]);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3100);
    return () => clearTimeout(timer);
  }, [data?.memberName]);

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const particles = Array.from({ length: 18 }).map((_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const distance = 115 + (i % 3) * 40;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      scale: 0.6 + (i % 3) * 0.25,
      color: i % 3 === 0 ? '#10B981' : i % 3 === 1 ? '#06B6D4' : '#F59E0B',
      delay: (i % 4) * 0.05
    };
  });

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-[#05070E]/88 backdrop-blur-xl cursor-pointer select-none overflow-hidden"
        >
          {/* Ambient Radial Aura */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.7, 1.25, 1.1], opacity: [0, 0.55, 0.3] }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="pointer-events-none absolute w-[440px] h-[440px] rounded-full bg-gradient-to-tr from-emerald-500/30 via-cyan-500/25 to-amber-400/20 blur-[90px]"
          />

          {/* Expanding Shockwave Rings */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0.9 }}
            animate={{ scale: 2.3, opacity: 0 }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
            className="pointer-events-none absolute w-52 h-52 rounded-full border-2 border-emerald-400/50"
          />
          <motion.div
            initial={{ scale: 0.3, opacity: 0.7 }}
            animate={{ scale: 1.85, opacity: 0 }}
            transition={{ duration: 1.15, delay: 0.12, ease: 'easeOut' }}
            className="pointer-events-none absolute w-52 h-52 rounded-full border border-cyan-300/40"
          />

          {/* Particle Sparks */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: p.x,
                y: p.y,
                scale: [0, p.scale, 0],
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: 1.15,
                delay: 0.08 + p.delay,
                ease: [0.16, 1, 0.3, 1]
              }}
              style={{ backgroundColor: p.color }}
              className="pointer-events-none absolute w-2.5 h-2.5 rounded-full shadow-[0_0_14px_currentColor]"
            />
          ))}

          {/* Central Celebration Card */}
          <motion.div
            initial={{ scale: 0.82, y: 28, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: -16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#0E1528] via-[#090E1C] to-[#060913] border border-emerald-500/45 p-6 text-center shadow-[0_28px_80px_rgba(16,185,129,0.28)] overflow-hidden"
          >
            {/* Shimmer Sweep */}
            <motion.div
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 1.4, delay: 0.2, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-300/10 to-transparent skew-x-12"
            />

            {/* Top Emblem */}
            <motion.div
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.08 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 p-0.5 mx-auto shadow-[0_0_32px_rgba(16,185,129,0.5)]"
            >
              <div className="w-full h-full rounded-[14px] bg-[#060913] flex items-center justify-center relative">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 stroke-[2.5]" />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-[14px] border border-dashed border-emerald-400/35"
                />
              </div>
            </motion.div>

            {/* Header Pill */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold tracking-wider uppercase"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Focus Session Recorded</span>
            </motion.div>

            {/* Title */}
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-1.5 text-xl font-extrabold text-white font-display tracking-tight"
            >
              Outstanding Work, {data.memberName}!
            </motion.h3>

            {/* Animated XP Counter */}
            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.25 }}
              className="my-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-amber-500/15 border border-emerald-400/35 shadow-inner"
            >
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce" />
                <span className="text-4xl font-black font-mono-num tracking-tight bg-gradient-to-r from-emerald-200 via-cyan-300 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(16,185,129,0.45)]">
                  +{displayXp} XP
                </span>
              </div>
              <div className="text-[11px] text-emerald-200/80 font-medium mt-0.5">
                Credited to Guild Standings & Raid Boss Strike
              </div>
            </motion.div>

            {/* Session Telemetry Pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34 }}
              className="grid grid-cols-3 gap-2 text-left"
            >
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-cyan-400" />
                  <span>Subject</span>
                </div>
                <div className="text-xs font-bold text-white truncate mt-0.5">{data.subject}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-emerald-400" />
                  <span>Duration</span>
                </div>
                <div className="text-xs font-bold text-white font-mono-num mt-0.5">
                  {formatMins(data.durationMins)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Target className="w-3 h-3 text-amber-400" />
                  <span>Solved</span>
                </div>
                <div className="text-xs font-bold text-emerald-400 font-mono-num mt-0.5">
                  {data.solvedQuestions} Qs
                </div>
              </div>
            </motion.div>

            {/* Active Streak Bonus Badge */}
            {data.streakCount && data.streakCount > 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.44 }}
                className="mt-3 py-1.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 inline-flex items-center gap-1.5 text-xs font-bold text-amber-300"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{data.streakCount}-Day Streak Active</span>
                {data.streakMultiplier && data.streakMultiplier > 1 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-200 text-[10px] font-mono-num">
                    {data.streakMultiplier.toFixed(2)}x Boost
                  </span>
                )}
              </motion.div>
            ) : null}

            <div className="mt-4 text-[10px] text-slate-500">Tap anywhere to continue</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
