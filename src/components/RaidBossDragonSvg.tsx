import React from 'react';
import { Swords, Sparkles, ShieldAlert, X } from 'lucide-react';

interface RaidBossDragonSvgProps {
  bossId: string;
  bossName: string;
  bossSubtitle?: string;
  currentHp: number;
  totalHp: number;
  isHurt: boolean;
  hurtDamage?: number | null;
  isDefeated: boolean;
}

export const BOSS_THEMES: Record<string, {
  primary: string;
  secondary: string;
  eyeColor: string;
  auraClass: string;
  badgeText: string;
}> = {
  backlog_leviathan: {
    primary: '#F97316',
    secondary: '#DC2626',
    eyeColor: '#FDE047',
    auraClass: 'from-orange-500/20 via-rose-600/10 to-transparent',
    badgeText: 'Ancient Wyrm of Unfinished Chapters'
  },
  procrastination_demon: {
    primary: '#E11D48',
    secondary: '#9F1239',
    eyeColor: '#38BDF8',
    auraClass: 'from-rose-500/20 via-amber-600/10 to-transparent',
    badgeText: 'Arch-Fiend of Delayed Starts'
  },
  silly_mistake_specter: {
    primary: '#F59E0B',
    secondary: '#B45309',
    eyeColor: '#EF4444',
    auraClass: 'from-amber-500/20 via-orange-600/10 to-transparent',
    badgeText: 'Phantom of Calculation Traps'
  },
  sleep_deprivation_phantom: {
    primary: '#10B981',
    secondary: '#047857',
    eyeColor: '#F43F5E',
    auraClass: 'from-emerald-500/20 via-teal-600/10 to-transparent',
    badgeText: 'Wraith of Late-Night Fatigue'
  },
  formula_amnesia_golem: {
    primary: '#3B82F6',
    secondary: '#1D4ED8',
    eyeColor: '#FBBF24',
    auraClass: 'from-blue-500/20 via-cyan-600/10 to-transparent',
    badgeText: 'Colossus of Forgotten Identities'
  }
};

export const RaidBossDragonSvg: React.FC<RaidBossDragonSvgProps> = ({
  bossId,
  currentHp,
  totalHp,
  isHurt,
  hurtDamage,
  isDefeated
}) => {
  const theme = BOSS_THEMES[bossId] || BOSS_THEMES.backlog_leviathan;
  const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / (totalHp || 10000)) * 100)));
  const isEnraged = hpPercent > 0 && hpPercent <= 35;

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-2 select-none overflow-hidden">
      <style>{`
        @keyframes dragonFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.015); }
        }
        @keyframes wingFlapLeft {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-6deg) translateY(-3px); }
        }
        @keyframes wingFlapRight {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(6deg) translateY(-3px); }
        }
        @keyframes dragonHurtShake {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(2.2) saturate(2); }
          20% { transform: translate(-10px, -4px) rotate(-5deg) scale(0.95); }
          40% { transform: translate(10px, 3px) rotate(5deg) scale(1.04); }
          60% { transform: translate(-7px, 2px) rotate(-3deg) scale(0.97); }
          80% { transform: translate(6px, -2px) rotate(2deg) scale(1.01); }
          100% { transform: translate(0, 0) rotate(0deg) scale(1); filter: brightness(1); }
        }
        @keyframes slashStrike {
          0% { stroke-dashoffset: 300; opacity: 1; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes damagePop {
          0% { opacity: 0; transform: translateY(10px) scale(0.8); }
          25% { opacity: 1; transform: translateY(-8px) scale(1.1); }
          80% { opacity: 1; transform: translateY(-18px) scale(1); }
          100% { opacity: 0; transform: translateY(-26px) scale(0.9); }
        }
        .dragon-idle {
          animation: dragonFloat 3.6s ease-in-out infinite;
        }
        .dragon-hurt {
          animation: dragonHurtShake 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97) forwards;
        }
        .wing-left {
          transform-origin: 130px 95px;
          animation: wingFlapLeft 3.6s ease-in-out infinite;
        }
        .wing-right {
          transform-origin: 190px 95px;
          animation: wingFlapRight 3.6s ease-in-out infinite;
        }
        .slash-line {
          stroke-dasharray: 300;
          animation: slashStrike 0.55s ease-out forwards;
        }
        .dmg-badge {
          animation: damagePop 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Ambient radial backlight */}
      <div
        className={`pointer-events-none absolute inset-0 bg-radial ${theme.auraClass} opacity-60 blur-2xl transition-all duration-500 ${
          isHurt ? 'scale-125 opacity-95' : isEnraged ? 'animate-pulse opacity-85' : ''
        }`}
      />

      {/* Floating Damage Hit Counter */}
      {isHurt && hurtDamage && (
        <div className="dmg-badge absolute top-2 z-20 px-3.5 py-1 rounded-full bg-rose-600 text-white font-mono-num font-extrabold text-xs sm:text-sm shadow-xl border border-white/30 flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" />
          <span>-{hurtDamage.toLocaleString()} HP</span>
        </div>
      )}

      {/* Main Dragon SVG Canvas */}
      <div className={`relative z-10 ${isDefeated ? 'opacity-35 grayscale' : isHurt ? 'dragon-hurt' : 'dragon-idle'}`}>
        <svg
          viewBox="0 0 320 165"
          className="w-64 sm:w-80 h-36 sm:h-44 overflow-visible drop-shadow-[0_12px_24px_rgba(0,0,0,0.75)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`dragonGrad-${bossId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isHurt ? '#EF4444' : theme.primary} />
              <stop offset="100%" stopColor={isHurt ? '#991B1B' : theme.secondary} />
            </linearGradient>
            <linearGradient id="slashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* LEFT DRAGON WING */}
          <g className="wing-left">
            <path
              d="M132 92 L22 32 L42 74 L12 88 L54 112 L38 136 L128 114 Z"
              fill={`url(#dragonGrad-${bossId})`}
              fillOpacity="0.85"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
            />
            <path
              d="M130 92 L42 74 M128 100 L54 112"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          {/* RIGHT DRAGON WING */}
          <g className="wing-right">
            <path
              d="M188 92 L298 32 L278 74 L308 88 L266 112 L282 136 L192 114 Z"
              fill={`url(#dragonGrad-${bossId})`}
              fillOpacity="0.85"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.5"
            />
            <path
              d="M190 92 L278 74 M192 100 L266 112"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>

          {/* DRAGON ARMORED TORSO & NECK */}
          <path
            d="M126 142 L118 96 L142 68 L160 60 L178 68 L202 96 L194 142 L160 154 Z"
            fill="#14151A"
            stroke={`url(#dragonGrad-${bossId})`}
            strokeWidth="2"
          />
          {/* Glowing Core Rib Plates */}
          <path
            d="M140 98 L160 108 L180 98 M142 114 L160 124 L178 114 M146 130 L160 138 L174 130"
            stroke={isHurt ? '#FCA5A5' : theme.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* DRAGON CROWN & HORNS */}
          <path
            d="M135 54 L104 14 L128 38 L145 44 Z"
            fill={`url(#dragonGrad-${bossId})`}
          />
          <path
            d="M185 54 L216 14 L192 38 L175 44 Z"
            fill={`url(#dragonGrad-${bossId})`}
          />
          <path
            d="M160 22 L152 44 L168 44 Z"
            fill={theme.eyeColor}
          />

          {/* DRAGON SKULL / HEAD */}
          <path
            d="M130 56 L146 40 L174 40 L190 56 L184 84 L160 98 L136 84 Z"
            fill="#181920"
            stroke={`url(#dragonGrad-${bossId})`}
            strokeWidth="2.2"
          />

          {/* DRAGON EYES (X eyes when defeated, slit when hurt, glowing otherwise) */}
          {isDefeated ? (
            <>
              <path d="M142 62 L150 70 M150 62 L142 70" stroke="#71717A" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M170 62 L178 70 M178 62 L170 70" stroke="#71717A" strokeWidth="2.5" strokeLinecap="round" />
            </>
          ) : isHurt ? (
            <>
              <path d="M139 65 L153 69 L142 72" stroke="#FEF08A" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M181 65 L167 69 L178 72" stroke="#FEF08A" strokeWidth="2.8" strokeLinecap="round" />
            </>
          ) : (
            <>
              <polygon points="140,63 153,67 143,72" fill={theme.eyeColor} />
              <polygon points="180,63 167,67 177,72" fill={theme.eyeColor} />
            </>
          )}

          {/* JAW FANGS */}
          <path
            d="M146 84 L150 92 L155 86 L160 94 L165 86 L170 92 L174 84"
            stroke="#F4F4F5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* ANIMATED ATTACK SLASH OVERLAY WHEN HURT */}
          {isHurt && (
            <g>
              <path
                className="slash-line"
                d="M45 25 L275 140"
                stroke="url(#slashGrad)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                className="slash-line"
                d="M265 25 L55 140"
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="160" cy="82" r="28" stroke="#FDE047" strokeWidth="2" strokeDasharray="6 6" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

interface BossEntranceModalProps {
  bossId: string;
  bossName: string;
  bossSubtitle?: string;
  totalHp: number;
  onClose: () => void;
}

export const BossEntranceModal: React.FC<BossEntranceModalProps> = ({
  bossId,
  bossName,
  bossSubtitle,
  totalHp,
  onClose
}) => {
  const theme = BOSS_THEMES[bossId] || BOSS_THEMES.backlog_leviathan;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#111216] border border-white/15 p-6 sm:p-8 text-center space-y-5 shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>New Co-op Raid Boss Unveiled</span>
        </div>

        <RaidBossDragonSvg
          bossId={bossId}
          bossName={bossName}
          currentHp={totalHp}
          totalHp={totalHp}
          isHurt={false}
          isDefeated={false}
        />

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-zinc-400">{theme.badgeText}</div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
            {bossName}
          </h2>
          {bossSubtitle && (
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              {bossSubtitle}
            </p>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-around text-xs">
          <div>
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Boss Armour</div>
            <div className="text-base font-extrabold text-orange-400 font-mono-num mt-0.5">
              {totalHp.toLocaleString()} HP
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <div className="text-zinc-500 text-[10px] uppercase font-bold">Raid Window</div>
            <div className="text-xs font-bold text-white mt-0.5">
              Mon 12:00 AM to Sun 6:00 PM
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-extrabold text-xs tracking-wide transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Enter the Arena & Begin the Raid</span>
        </button>
      </div>
    </div>
  );
};