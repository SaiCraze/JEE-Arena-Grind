import React, { useEffect, useState } from 'react';
import { Sparkles, Flame, CheckCircle, ArrowRight } from 'lucide-react';
import { playCelebrationSound } from '../utils/soundEffects';

interface StudyLogSuccessAnimationProps {
  memberName: string;
  xpEarned: number;
  durationMins: number;
  totalQCount: number;
  tasksCount?: number;
  streakCount?: number;
  onClose: () => void;
}

export const StudyLogSuccessAnimation: React.FC<StudyLogSuccessAnimationProps> = ({
  memberName,
  xpEarned,
  durationMins,
  totalQCount,
  tasksCount = 0,
  streakCount = 1,
  onClose
}) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    playCelebrationSound();
    const t = setTimeout(() => setPulse(true), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-modal">
      <div className="w-full max-w-sm rounded-3xl bg-[#0C0D14] border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.25)] p-5 text-center relative overflow-hidden flex flex-col items-center">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 inset-x-0 h-32 bg-gradient-to-b from-orange-500/30 to-transparent pointer-events-none" />

        {/* Floating animated sparkles & confetti particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"
              style={{
                top: `${15 + (i * 17) % 70}%`,
                left: `${10 + (i * 23) % 80}%`,
                animationDelay: `${(i % 5) * 0.2}s`,
                animationDuration: `${1.2 + (i % 3) * 0.4}s`
              }}
            />
          ))}
        </div>

        {/* Animated Scholar Mascot SVG */}
        <div className="w-36 h-36 relative my-1">
          <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            <defs>
              <linearGradient id="fireGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#EA580C" />
                <stop offset="60%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#FDE047" />
              </linearGradient>

              <radialGradient id="auraGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glowing Aura Ring */}
            <circle cx="80" cy="80" r="65" fill="url(#auraGlow)" className="animate-pulse" />

            {/* Floating Energy Swirls */}
            <circle
              cx="80"
              cy="80"
              r="55"
              fill="none"
              stroke="#FDBA74"
              strokeWidth="2"
              strokeDasharray="12 8"
              opacity="0.6"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 80 80"
                to="360 80 80"
                dur="8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Mascot Body: Floating Scholar Flame Character */}
            <g
              style={{
                transform: pulse ? 'translateY(-6px)' : 'translateY(0px)',
                transition: 'transform 0.8s ease-in-out'
              }}
            >
              {/* Flame hair/crest */}
              <path
                d="M 80,25 C 95,45 105,65 95,85 C 90,95 85,95 80,95 C 75,95 70,95 65,85 C 55,65 65,45 80,25 Z"
                fill="url(#fireGrad)"
              />

              {/* Head / Face */}
              <circle cx="80" cy="72" r="26" fill="#18181B" stroke="#F97316" strokeWidth="2.5" />

              {/* Cool Study Glasses */}
              <rect x="63" y="65" width="14" height="10" rx="3" fill="#09090B" stroke="#FBBF24" strokeWidth="2" />
              <rect x="83" y="65" width="14" height="10" rx="3" fill="#09090B" stroke="#FBBF24" strokeWidth="2" />
              <line x1="77" y1="70" x2="83" y2="70" stroke="#FBBF24" strokeWidth="2" />

              {/* Cheerful Smile */}
              <path d="M 74,84 Q 80,90 86,84" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />

              {/* Open Study Book below */}
              <path
                d="M 50,110 Q 80,105 80,120 Q 80,105 110,110 L 115,128 Q 80,120 80,135 Q 80,120 45,128 Z"
                fill="#27272A"
                stroke="#F97316"
                strokeWidth="2"
              />
              <line x1="80" y1="120" x2="80" y2="135" stroke="#F97316" strokeWidth="2" />

              {/* Floating Star Badge */}
              <polygon
                points="80,15 84,23 93,24 86,30 88,39 80,34 72,39 74,30 67,24 76,23"
                fill="#FDE047"
                stroke="#D97706"
                strokeWidth="1"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 80 27"
                  to="360 80 27"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </polygon>
            </g>
          </svg>
        </div>

        {/* Dynamic Earned XP Callout */}
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SESSION LOCKED & VERIFIED</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-mono-num tracking-tight mt-1">
            +{xpEarned} <span className="text-orange-400 font-display text-2xl font-bold">XP</span>
          </h2>
          <p className="text-xs text-zinc-300 font-medium">Well done, {memberName}! Progress banked.</p>
        </div>

        {/* Stats Pill Matrix */}
        <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-3 border-t border-zinc-800 text-left text-xs z-10">
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 font-semibold">Time</div>
            <div className="text-xs font-bold text-white font-mono-num">{durationMins}m</div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 font-semibold">Questions</div>
            <div className="text-xs font-bold text-white font-mono-num">{totalQCount} Qs</div>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="text-[10px] text-zinc-400 font-semibold">Streak</div>
            <div className="text-xs font-bold text-orange-400 font-mono-num flex items-center gap-1">
              <Flame className="w-3 h-3 fill-orange-400" />
              <span>{streakCount}d</span>
            </div>
          </div>
        </div>

        {tasksCount > 0 && (
          <div className="w-full mt-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-semibold flex items-center justify-center gap-1.5 z-10">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{tasksCount} Squad Bounty Completed!</span>
          </div>
        )}

        {/* Primary Dismiss Button */}
        <button
          onClick={onClose}
          className="btn-primary w-full mt-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg relative z-10"
        >
          <span>Return to Grind</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
