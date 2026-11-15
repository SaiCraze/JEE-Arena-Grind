import React, { useState, useEffect } from 'react';
import { Swords, Clock, Trophy, AlertTriangle, Check, X, Flame } from 'lucide-react';
import { QuickdrawDuel } from '../types/warfare';

interface QuickdrawDuelArenaModalProps {
  currentUserId: string;
  incomingDuel: QuickdrawDuel | null;
  activeDuel: QuickdrawDuel | null;
  isBlackoutActive: boolean;
  onAcceptDuel: (duel: QuickdrawDuel) => Promise<void>;
  onDeclineDuel: (duel: QuickdrawDuel) => Promise<void>;
  onClaimDuelVictory: (duel: QuickdrawDuel) => Promise<void>;
  onForfeitDuel: (duel: QuickdrawDuel) => Promise<void>;
}

export const QuickdrawDuelArenaModal: React.FC<QuickdrawDuelArenaModalProps> = ({
  currentUserId,
  incomingDuel,
  activeDuel,
  isBlackoutActive,
  onAcceptDuel,
  onDeclineDuel,
  onClaimDuelVictory,
  onForfeitDuel
}) => {
  const [inviteRemainingSecs, setInviteRemainingSecs] = useState<number>(600);
  const [sprintElapsedSecs, setSprintElapsedSecs] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const onDeclineDuelRef = React.useRef(onDeclineDuel);
  useEffect(() => { onDeclineDuelRef.current = onDeclineDuel; }, [onDeclineDuel]);

  const onClaimDuelVictoryRef = React.useRef(onClaimDuelVictory);
  useEffect(() => { onClaimDuelVictoryRef.current = onClaimDuelVictory; }, [onClaimDuelVictory]);

  // Incoming challenge 10-minute expiry timer
  useEffect(() => {
    if (!incomingDuel || incomingDuel.status !== 'pending') return;
    const expTs = incomingDuel.expiresAt || incomingDuel.inviteExpiresAt || incomingDuel.createdAt + 10 * 60 * 1000;
    let handled = false;

    const tick = () => {
      const rem = Math.max(0, Math.floor((expTs - Date.now()) / 1000));
      setInviteRemainingSecs(rem);
      if (rem <= 0 && !handled) {
        handled = true;
        onDeclineDuelRef.current(incomingDuel);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [incomingDuel?.id, incomingDuel?.status]);

  // Simultaneous live focus sprint timer
  useEffect(() => {
    if (!activeDuel || activeDuel.status !== 'active') return;
    const startTs = activeDuel.acceptedAt || activeDuel.startedAt || activeDuel.createdAt;
    const targetSecs = Math.max(60, activeDuel.durationMins * 60);
    let handled = false;

    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startTs) / 1000));
      setSprintElapsedSecs(elapsed);
      if (elapsed >= targetSecs && !activeDuel.winnerId && !handled) {
        handled = true;
        onClaimDuelVictoryRef.current(activeDuel);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [activeDuel?.id, activeDuel?.status]);

  if (incomingDuel && incomingDuel.status === 'pending') {
    const mins = String(Math.floor(inviteRemainingSecs / 60)).padStart(2, '0');
    const secs = String(inviteRemainingSecs % 60).padStart(2, '0');

    return (
      <div className="fixed inset-0 z-[220] bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-md surface-card rounded-3xl p-6 space-y-5 border-2 border-sky-400 shadow-[0_0_60px_rgba(56,189,248,0.28)] animate-modal">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                  1v1 Quickdraw Callout
                </span>
                <h3 className="text-lg font-black text-white font-display">
                  Incoming Focus Duel Challenge!
                </h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono-num font-bold">
              {mins}:{secs}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs text-slate-200 leading-relaxed">
            <p className="text-sm font-bold text-white">
              User <span className="text-sky-300">{incomingDuel.challengerName}</span> has called you out for a{' '}
              <span className="text-amber-300 font-mono-num">{incomingDuel.durationMins}m</span> Quickdraw Duel for{' '}
              <span className="text-emerald-300 font-mono-num">{incomingDuel.wagerXp} XP</span>. Accept / Decline (Expires in {mins}:{secs}).
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Total Escrow Pot:</span>
              <strong className="text-emerald-400 font-mono-num text-sm">{incomingDuel.wagerXp * 2} XP</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onDeclineDuel(incomingDuel);
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="py-3 px-4 rounded-2xl bg-white/[0.06] hover:bg-rose-500/15 border border-white/15 hover:border-rose-500/35 text-xs font-bold text-slate-300 hover:text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
              <span>Decline</span>
            </button>

            <button
              type="button"
              disabled={isProcessing || isBlackoutActive}
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onAcceptDuel(incomingDuel);
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/25 transition-all"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Accept ({incomingDuel.wagerXp} XP)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeDuel && activeDuel.status === 'active') {
    const targetSecs = Math.max(60, activeDuel.durationMins * 60);
    const remainingSecs = Math.max(0, targetSecs - sprintElapsedSecs);
    const remMins = String(Math.floor(remainingSecs / 60)).padStart(2, '0');
    const remSecs = String(remainingSecs % 60).padStart(2, '0');
    const progressPct = Math.min(100, Math.round((sprintElapsedSecs / targetSecs) * 100));

    return (
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-[180] w-[92vw] max-w-sm surface-card rounded-3xl p-4 sm:p-5 border-2 border-sky-400/70 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-3.5 animate-modal">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
              1v1 Quickdraw Sprint Live
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-mono-num font-black">
            Pot: {activeDuel.escrowPot} XP
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 bg-black/50 p-3 rounded-2xl border border-white/10">
          <div className="text-left">
            <div className="text-xs font-extrabold text-white">{activeDuel.challengerName}</div>
            <div className="text-[10px] text-slate-400">Challenger</div>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-300 font-black text-xs">
            VS
          </div>
          <div className="text-right">
            <div className="text-xs font-extrabold text-white">{activeDuel.opponentName}</div>
            <div className="text-[10px] text-slate-400">Defender</div>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-3xl font-black font-mono-num text-white tracking-tight">
            {remMins}:{remSecs}
          </div>
          <div className="text-[10px] text-slate-400">
            Zero pauses allowed. First to complete {activeDuel.durationMins}m claims {activeDuel.escrowPot} XP!
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onForfeitDuel(activeDuel)}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-extrabold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Give Up (Forfeit {activeDuel.escrowPot} XP Pot)</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
