import React, { useEffect } from 'react';
import { Trophy, Swords, Sparkles, ArrowRight, X } from 'lucide-react';
import { playDuelClashSound } from '../utils/soundEffects';

interface ArenaOvertakeModalProps {
  challengerName: string;
  rivalName: string;
  oldRank: number;
  newRank: number;
  differenceXp: number;
  onClose: () => void;
}

export const ArenaOvertakeModal: React.FC<ArenaOvertakeModalProps> = ({
  challengerName,
  rivalName,
  oldRank,
  newRank,
  differenceXp,
  onClose
}) => {
  useEffect(() => {
    playDuelClashSound();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-modal">
      <div className="w-full max-w-sm rounded-3xl bg-[#090A10] border border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.25)] p-5 text-center relative overflow-hidden flex flex-col items-center">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 inset-x-0 h-32 bg-gradient-to-b from-amber-500/25 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-zinc-500 hover:text-white rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Badge Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold mb-2">
          <Trophy className="w-3.5 h-3.5" />
          <span>PODIUM RANK OVERTAKE!</span>
        </div>

        {/* Dynamic Clashing Swords SVG */}
        <div className="w-36 h-32 relative my-2">
          <svg viewBox="0 0 160 140" className="w-full h-full drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            <defs>
              <linearGradient id="bladeGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id="bladeSilver" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>

            {/* Spark explosion center */}
            <g transform="translate(80, 70)">
              <circle cx="0" cy="0" r="14" fill="#FEF08A" opacity="0.8" className="animate-ping" />
              <line x1="-15" y1="-15" x2="-25" y2="-25" stroke="#FBBF24" strokeWidth="3" />
              <line x1="15" y1="-15" x2="25" y2="-25" stroke="#FBBF24" strokeWidth="3" />
              <line x1="-15" y1="15" x2="-25" y2="25" stroke="#FBBF24" strokeWidth="3" />
              <line x1="15" y1="15" x2="25" y2="25" stroke="#FBBF24" strokeWidth="3" />
            </g>

            {/* Sword 1 (Challenger Gold Sword from Left) */}
            <g
              transform="translate(45, 95) rotate(-35)"
              className="transition-transform duration-500"
            >
              {/* Pommel & Hilt */}
              <circle cx="0" cy="25" r="4" fill="#D97706" />
              <rect x="-10" y="18" width="20" height="4" rx="2" fill="#FBBF24" />
              {/* Blade */}
              <polygon points="-4,18 0,-60 4,18" fill="url(#bladeGold)" stroke="#FFFFFF" strokeWidth="1" />
            </g>

            {/* Sword 2 (Rival Silver Sword from Right) */}
            <g
              transform="translate(115, 95) rotate(35)"
              className="transition-transform duration-500"
            >
              {/* Pommel & Hilt */}
              <circle cx="0" cy="25" r="4" fill="#475569" />
              <rect x="-10" y="18" width="20" height="4" rx="2" fill="#94A3B8" />
              {/* Blade */}
              <polygon points="-4,18 0,-60 4,18" fill="url(#bladeSilver)" stroke="#FFFFFF" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* Head-to-Head Rank Upgrade Callout */}
        <div className="flex items-center justify-center gap-4 my-2">
          <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center min-w-[70px]">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase">Old Rank</div>
            <div className="text-lg font-extrabold text-zinc-400 font-mono-num">#{oldRank}</div>
          </div>

          <div className="flex items-center justify-center text-amber-400">
            <ArrowRight className="w-5 h-5 stroke-[3] animate-pulse" />
          </div>

          <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-center min-w-[70px] shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <div className="text-[10px] text-amber-300 font-semibold uppercase">New Rank</div>
            <div className="text-xl font-extrabold text-amber-400 font-mono-num">#{newRank}</div>
          </div>
        </div>

        {/* Overtake Description */}
        <div className="mt-2 space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-white font-display">
            {challengerName} defeated {rivalName}!
          </h3>
          <p className="text-xs text-zinc-300">
            Pushed ahead on the leaderboard by{' '}
            <span className="text-amber-400 font-mono-num font-bold">+{differenceXp} XP</span>.
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={onClose}
          className="btn-primary w-full mt-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg"
        >
          <span>Claim Ground in Arena</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
