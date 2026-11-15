import React, { useEffect, useState } from 'react';
import { Crown, Flame, Swords, Trophy, Zap, ArrowUpRight, Sparkles, ShieldAlert, X } from 'lucide-react';
import { playOvertakeVictorySound, playOvertakeWarningSound } from '../utils/soundEffects';

export interface ArenaOvertakeEvent {
  type: 'OVERTAKE_VICTORY' | 'OVERTAKEN_WARNING';
  newRank: number;
  oldRank: number;
  actorName: string;
  actorId: string;
  rivalName: string;
  rivalId: string;
  actorXp: number;
  rivalXp: number;
  xpGap: number;
  scopeLabel: string;
}

interface ArenaOvertakeModalProps {
  event?: ArenaOvertakeEvent | null;
  challengerName?: string;
  rivalName?: string;
  oldRank?: number;
  newRank?: number;
  differenceXp?: number;
  onClose: () => void;
  onJumpToTracker?: () => void;
}

export const ArenaOvertakeModal: React.FC<ArenaOvertakeModalProps> = (props) => {
  const { onClose, onJumpToTracker } = props;
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const event: ArenaOvertakeEvent | null = props.event ?? (props.challengerName ? {
    type: 'OVERTAKE_VICTORY',
    newRank: props.newRank ?? 1,
    oldRank: props.oldRank ?? 2,
    actorName: props.challengerName,
    actorId: 'challenger',
    rivalName: props.rivalName ?? 'Rival',
    rivalId: 'rival',
    actorXp: props.differenceXp ?? 0,
    rivalXp: 0,
    xpGap: props.differenceXp ?? 10,
    scopeLabel: 'Arena Standings'
  } : null);

  useEffect(() => {
    if (!event) return;
    setStage(0);

    if (event.type === 'OVERTAKE_VICTORY') {
      playOvertakeVictorySound();
    } else {
      playOvertakeWarningSound();
    }

    const t1 = setTimeout(() => setStage(1), 400);
    const t2 = setTimeout(() => setStage(2), 1150);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [event?.actorName, event?.newRank]);

  if (!event) return null;

  const isVictory = event.type === 'OVERTAKE_VICTORY';
  const rankBadgeText = event.newRank === 1 ? '#1 SOVEREIGN' : `#${event.newRank} STANDING`;

  return (
    <div className="fixed inset-0 z-[90] bg-[#05070E]/92 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto select-none">
      {/* Ambient Radial Aura */}
      <div
        className={`pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[150px] opacity-30 transition-all duration-700 ${
          isVictory ? 'bg-emerald-500' : 'bg-rose-600'
        }`}
      />

      {/* Confetti / Sparks on Victory */}
      {isVictory && stage >= 1 && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          {Array.from({ length: 28 }).map((_, i) => {
            const left = (i * 37) % 100;
            const delay = (i % 7) * 0.14;
            const duration = 2.4 + (i % 4) * 0.45;
            const colors = ['#10B981', '#06B6D4', '#F59E0B', '#34D399', '#A855F7'];
            const color = colors[i % colors.length];
            return (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  left: `${left}%`,
                  backgroundColor: color,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`
                }}
              />
            );
          })}
        </div>
      )}

      {/* Main Modal Container */}
      <div
        className={`w-full max-w-md rounded-3xl bg-[#090E1C] border p-6 sm:p-7 text-center space-y-5 relative z-10 shadow-2xl animate-modal overflow-hidden ${
          isVictory
            ? 'border-emerald-400/50 shadow-[0_0_65px_rgba(16,185,129,0.28)]'
            : 'border-rose-500/50 shadow-[0_0_65px_rgba(244,63,94,0.3)]'
        }`}
      >
        {/* Top Glowing Accent Bar */}
        <div
          className={`absolute top-0 inset-x-0 h-1.5 ${
            isVictory
              ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400'
              : 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600'
          }`}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Status Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border mx-auto mt-1">
          {isVictory ? (
            <div className="flex items-center gap-1.5 text-emerald-300 bg-emerald-500/15 border-emerald-400/40 px-3 py-1 rounded-full border">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Guild Position Seized · {event.scopeLabel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-300 bg-rose-500/15 border-rose-500/40 px-3 py-1 rounded-full border animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Position Breached · {event.scopeLabel}</span>
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
            {isVictory ? (
              <>
                You Overtook <span className="text-emerald-400">{event.rivalName}</span>!
              </>
            ) : (
              <>
                <span className="text-rose-400">{event.actorName}</span> Just Overtook You!
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {isVictory
              ? `Relentless scholarly momentum! Your study session propelled you past ${event.rivalName} into ${rankBadgeText}.`
              : `${event.actorName} logged a surge of XP and pushed you down to #${event.newRank}. Reclaim your rank now!`}
          </p>
        </div>

        {/* Animated Rank Swap Stage */}
        <div className="relative p-5 rounded-2xl bg-[#050811] border border-slate-800/90 overflow-hidden">
          <div className="grid grid-cols-11 items-center gap-2">
            {/* Left Card: Overtaker */}
            <div
              className={`col-span-5 p-3.5 rounded-2xl border transition-all duration-700 transform ${
                stage >= 1 ? 'translate-y-0 scale-105' : 'translate-y-4 opacity-60 scale-95'
              } ${
                isVictory
                  ? 'bg-gradient-to-b from-emerald-500/20 to-slate-900/90 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                  : 'bg-gradient-to-b from-rose-500/20 to-slate-900/90 border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.2)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950 flex items-center gap-1">
                  {event.newRank === 1 || !isVictory ? <Crown className="w-3 h-3 stroke-[2.5]" /> : <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />}
                  <span>#{isVictory ? event.newRank : event.oldRank}</span>
                </span>
                <Flame className="w-4 h-4 text-emerald-400 fill-emerald-400 animate-bounce" />
              </div>
              <div className="text-left">
                <div className="text-sm font-extrabold text-white truncate">
                  {isVictory ? 'You (' + event.actorName + ')' : event.actorName}
                </div>
                <div className="text-base font-extrabold font-mono-num text-emerald-300 mt-0.5">
                  {event.actorXp.toLocaleString()} XP
                </div>
              </div>
            </div>

            {/* Center VS Icon */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 shadow-lg">
                <Swords className="w-4 h-4" />
              </div>
            </div>

            {/* Right Card: Overtaken Rival */}
            <div
              className={`col-span-5 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/90 transition-all duration-700 transform ${
                stage >= 1 ? 'translate-y-1 opacity-80 scale-95' : 'translate-y-0 scale-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  #{isVictory ? event.oldRank : event.newRank}
                </span>
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-300 truncate">
                  {isVictory ? event.rivalName : 'You (' + event.rivalName + ')'}
                </div>
                <div className="text-base font-bold font-mono-num text-slate-400 mt-0.5">
                  {event.rivalXp.toLocaleString()} XP
                </div>
              </div>
            </div>
          </div>

          {/* XP Margin Strip */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">
              {isVictory ? 'Current Lead Margin:' : 'XP Needed to Reclaim Rank:'}
            </span>
            <span
              className={`font-mono-num font-extrabold px-2.5 py-0.5 rounded-lg ${
                isVictory
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isVictory ? `+${Math.max(1, event.xpGap)} XP Ahead` : `${Math.max(1, event.xpGap + 1)} XP to Overtake`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {!isVictory && onJumpToTracker && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onJumpToTracker();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg hover:brightness-110 transition-all cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Counter-Attack (Start Focus)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isVictory
                ? 'btn-primary shadow-lg'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>{isVictory ? 'Defend the Throne' : 'Acknowledge'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
