import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  AlertTriangle,
  Shield,
  Search,
  Crown,
  Flame,
  Swords,
  Lock,
  X,
  TrendingDown,
  Clock,
  FileText
} from 'lucide-react';
import { OffensiveActionType } from '../types/warfare';

export interface TargetCandidate {
  id: string;
  name: string;
  institute: string;
  rank: number;
  weeklyXp: number;
  bountyShieldUntil?: number | null;
  hijackedTitle?: string | null;
  hijackedUntil?: number | null;
}

export interface RecentTargetSession {
  id: string;
  memberId: string;
  memberName: string;
  subject: string;
  duration: number;
  questions: number;
  xpEarned: number;
  timestamp: number;
  notes?: string;
}

interface TargetLockModalProps {
  isOpen: boolean;
  actionType: OffensiveActionType | null;
  actionLabel: string;
  baseCostXp: number;
  attacker: TargetCandidate | null;
  allPlayers: TargetCandidate[];
  recentSessionsLast2h: RecentTargetSession[];
  initialTargetId?: string;
  initialDuelDuration?: number;
  initialDuelWager?: number;
  isBlackoutActive: boolean;
  onClose: () => void;
  onConfirmAttack: (payload: {
    actionType: OffensiveActionType;
    targetUserId: string;
    targetUserName: string;
    costXp: number;
    hijackCustomTitle?: string;
    auditSession?: RecentTargetSession;
    duelDurationMins?: number;
    duelWagerXp?: number;
  }) => Promise<void>;
}

export const TargetLockModal: React.FC<TargetLockModalProps> = ({
  isOpen,
  actionType,
  actionLabel,
  baseCostXp,
  attacker,
  allPlayers = [],
  recentSessionsLast2h = [],
  initialTargetId = '',
  initialDuelDuration = 45,
  initialDuelWager = 100,
  isBlackoutActive,
  onClose,
  onConfirmAttack
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargetId);
  const [hijackTitle, setHijackTitle] = useState<string>('Nap Champion');
  const [selectedAuditSessionId, setSelectedAuditSessionId] = useState<string>('');
  const [duelDuration, setDuelDuration] = useState<number>(initialDuelDuration);
  const [duelWagerInput, setDuelWagerInput] = useState<string>(String(initialDuelWager));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safePlayers = Array.isArray(allPlayers) ? allPlayers : [];
  const safeRecentSessions = Array.isArray(recentSessionsLast2h) ? recentSessionsLast2h : [];

  const rivals = useMemo(() => {
    if (!attacker) return [];
    const list = safePlayers.filter(p => p.id !== attacker.id);
    if (actionType === 'robin_hood_ambush') {
      // Robin Hood Ambush can only target Rank #1 (The Crowned Tyrant)
      return list.filter(p => p.rank === 1);
    }
    return list;
  }, [safePlayers, attacker, actionType]);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setHijackTitle('Nap Champion');
    setDuelDuration(initialDuelDuration || 45);
    setDuelWagerInput(String(initialDuelWager || 100));
    if (actionType === 'robin_hood_ambush') {
      const king = safePlayers.find(p => p.rank === 1 && p.id !== attacker?.id);
      setSelectedTargetId(king ? king.id : '');
    } else if (initialTargetId && initialTargetId !== attacker?.id) {
      setSelectedTargetId(initialTargetId);
    } else {
      setSelectedTargetId('');
    }
  }, [isOpen, actionType, initialTargetId, initialDuelDuration, initialDuelWager]);

  const filteredRivals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rivals;
    return rivals.filter(
      r => r.name.toLowerCase().includes(q) || r.institute.toLowerCase().includes(q)
    );
  }, [rivals, searchQuery]);

  const selectedTarget = useMemo(() => {
    return rivals.find(r => r.id === selectedTargetId) || null;
  }, [rivals, selectedTargetId]);

  const targetRecentSessions = useMemo(() => {
    if (!selectedTarget) return [];
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    return safeRecentSessions.filter(
      s => s.memberId === selectedTarget.id && (Number(s.timestamp) || 0) >= twoHoursAgo
    );
  }, [safeRecentSessions, selectedTarget]);

  useEffect(() => {
    if (actionType === 'audit_badge') {
      const firstId = targetRecentSessions.length > 0 ? targetRecentSessions[0].id : '';
      setSelectedAuditSessionId(prev => (prev === firstId ? prev : firstId));
    }
  }, [actionType, targetRecentSessions]);

  const effectiveCostXp = useMemo(() => {
    if (actionType === 'quickdraw_duel') {
      return Math.max(20, Math.round(Number(duelWagerInput) || 0));
    }
    return baseCostXp;
  }, [actionType, baseCostXp, duelWagerInput]);

  // Calculate Attacker's current rank (#X) and projected rank (#Y) after spending effectiveCostXp
  const rankProjection = useMemo(() => {
    if (!attacker) return { currentRank: 1, projectedRank: 1, nextXp: 0 };
    const currentRank = attacker.rank;
    const nextXp = Math.max(0, attacker.weeklyXp - effectiveCostXp);

    const simulated = safePlayers.map(p => ({
      id: p.id,
      xp: p.id === attacker.id ? nextXp : p.weeklyXp
    }));
    simulated.sort((a, b) => b.xp - a.xp);
    const projectedRank = simulated.findIndex(p => p.id === attacker.id) + 1;
    return {
      currentRank,
      projectedRank: Math.max(1, projectedRank),
      nextXp
    };
  }, [attacker, safePlayers, effectiveCostXp]);

  if (!isOpen || !actionType || !attacker) return null;

  const isShieldProtectedAction =
    actionType === 'audit_badge' ||
    actionType === 'quickdraw_duel' ||
    actionType === 'robin_hood_ambush';

  const isTargetShielded = Boolean(
    isShieldProtectedAction &&
    selectedTarget?.bountyShieldUntil &&
    selectedTarget.bountyShieldUntil > Date.now()
  );

  const hasEnoughXp = attacker.weeklyXp >= effectiveCostXp;
  const targetHasEnoughDuelXp =
    actionType !== 'quickdraw_duel' ||
    Boolean(selectedTarget && selectedTarget.weeklyXp >= effectiveCostXp);

  const selectedAuditSession = targetRecentSessions.find(s => s.id === selectedAuditSessionId) || null;

  const canConfirm = Boolean(
    !isBlackoutActive &&
    selectedTarget &&
    hasEnoughXp &&
    targetHasEnoughDuelXp &&
    !isTargetShielded &&
    (actionType !== 'name_hijack' || hijackTitle.trim().length >= 2) &&
    (actionType !== 'audit_badge' || selectedAuditSession)
  );

  const handleConfirm = async () => {
    if (!canConfirm || !selectedTarget || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmAttack({
        actionType,
        targetUserId: selectedTarget.id,
        targetUserName: selectedTarget.name,
        costXp: effectiveCostXp,
        hijackCustomTitle: actionType === 'name_hijack' ? hijackTitle.trim() : undefined,
        auditSession: actionType === 'audit_badge' ? (selectedAuditSession || undefined) : undefined,
        duelDurationMins: actionType === 'quickdraw_duel' ? duelDuration : undefined,
        duelWagerXp: actionType === 'quickdraw_duel' ? effectiveCostXp : undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg surface-card rounded-3xl p-5 sm:p-6 space-y-5 border border-rose-500/40 shadow-[0_24px_80px_rgba(244,63,94,0.22)] my-auto max-h-[92dvh] overflow-y-auto animate-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400">
                Explicit Target Lock Protocol
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white font-display">
                {actionLabel}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Deliberate Rival Target Picker (No Auto-Assign or Random Rolls) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              1. Select Target Rival {actionType === 'robin_hood_ambush' ? '(Rank #1 Tyrant Only)' : ''}
            </label>
            <span className="text-[10px] font-mono-num text-slate-400">
              Your Balance: <strong className="text-emerald-400">{attacker.weeklyXp} XP</strong> (Rank #{attacker.rank})
            </span>
          </div>

          {rivals.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search active rival by username or batch..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {filteredRivals.length === 0 ? (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center text-xs text-slate-400">
              {actionType === 'robin_hood_ambush' && attacker.rank === 1
                ? 'You are currently Rank #1 (The Crowned Tyrant). You cannot ambush yourself.'
                : 'No matching rivals found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredRivals.map((rival) => {
                const isSelected = selectedTargetId === rival.id;
                const shieldActive = Boolean(
                  rival.bountyShieldUntil && rival.bountyShieldUntil > Date.now()
                );
                return (
                  <button
                    key={rival.id}
                    type="button"
                    onClick={() => setSelectedTargetId(rival.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                        : 'bg-black/45 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl font-display font-black text-xs flex items-center justify-center shrink-0 ${
                          rival.rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : isSelected
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {rival.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                          <span>{rival.name}</span>
                          {rival.rank === 1 && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                          {shieldActive && (
                            <span title="Bounty Shield Active">
                              <Shield className="w-3 h-3 text-cyan-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-num">
                          Rank #{rival.rank} • {rival.institute}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold font-mono-num text-sky-300">
                        {rival.weeklyXp} XP
                      </div>
                      {isSelected && (
                        <span className="text-[9px] uppercase tracking-wider font-bold text-rose-300">
                          LOCKED
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action-Specific Configuration */}
        {actionType === 'name_hijack' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
              2. Hijacked Display Title (24h Duration)
            </label>
            <input
              type="text"
              maxLength={28}
              value={hijackTitle}
              onChange={(e) => setHijackTitle(e.target.value)}
              placeholder="e.g. Nap Champion"
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-rose-400"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Nap Champion', 'Backlog Collector', 'Procrastination CEO', 'Theory Tourist', 'Formula Forgetter'].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHijackTitle(preset)}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[10px] text-slate-300 cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              Cleanse rule: Target can cleanse this early by logging a verified 60-minute uninterrupted study session.
            </p>
          </div>
        )}

        {actionType === 'audit_badge' && selectedTarget && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
              2. Select Session Logged in Last 2 Hours ({targetRecentSessions.length} Eligible)
            </label>
            {targetRecentSessions.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                {selectedTarget.name} has not logged any study sessions in the last 2 hours. Pick another rival or wait for a fresh log.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {targetRecentSessions.map((sess) => {
                  const isSel = selectedAuditSessionId === sess.id;
                  const minsAgo = Math.max(1, Math.round((Date.now() - sess.timestamp) / 60000));
                  return (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => setSelectedAuditSessionId(sess.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                        isSel
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-bold text-white">{sess.subject}</span>
                        <span className="font-mono-num text-emerald-300">{sess.duration}m</span>
                        <span className="text-[10px] text-slate-400">({minsAgo}m ago)</span>
                      </div>
                      <span className="font-mono-num font-extrabold text-amber-300">
                        +{sess.xpEarned} XP at stake
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {actionType === 'quickdraw_duel' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Sprint Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuelDuration(mins)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold font-mono-num cursor-pointer transition-all ${
                      duelDuration === mins
                        ? 'bg-sky-400 text-slate-950 border-sky-300'
                        : 'bg-black/50 border-white/15 text-slate-300 hover:text-white'
                    }`}
                  >
                    {mins} Mins
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                XP Wager (Escrow Pot: {effectiveCostXp * 2} XP)
              </label>
              <input
                type="number"
                min={20}
                max={1000}
                step={10}
                value={duelWagerInput}
                onChange={(e) => setDuelWagerInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono-num focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>
        )}

        {actionType === 'robin_hood_ambush' && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-1.5 text-xs">
            <div className="font-extrabold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Robin Hood Ambush Terms &amp; Midnight Settlement</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-300 leading-relaxed">
              <li>
                • <strong className="text-emerald-300">If You Win (Your Today Mins &gt; King&apos;s Today Mins):</strong> Your 50 XP Entry Fee is refunded AND you siphon <strong>20% of the King&apos;s XP earned today</strong> (minimum +25 XP stolen) at Midnight!
              </li>
              <li>
                • <strong className="text-rose-300">If King Defends (King&apos;s Mins &gt;= Your Mins):</strong> The King keeps all their XP and claims your <strong>50 XP Entry Fee as Royal Tribute</strong>!
              </li>
              <li>
                • <strong className="text-amber-200">Limit:</strong> Max 1 Ambush per challenger per day.
              </li>
            </ul>
          </div>
        )}

        {/* Target Lock Sheet & Cost-Consequence Preview */}
        {selectedTarget && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/15 via-black/70 to-black/80 border border-rose-500/40 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white font-display font-black text-base flex items-center justify-center shadow-lg">
                  {selectedTarget.name[0]}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                    Target Locked
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>{selectedTarget.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-xs font-mono-num text-amber-300">
                      Rank #{selectedTarget.rank}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Target Live XP
                </div>
                <div className="text-base font-black font-mono-num text-sky-300">
                  {selectedTarget.weeklyXp.toLocaleString()} XP
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/60 border border-rose-500/30 text-xs text-slate-200 leading-relaxed">
              <div className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>
                  Targeting <strong className="text-white">{selectedTarget.name}</strong> with{' '}
                  <strong className="text-rose-300">{actionLabel}</strong>. This will deduct{' '}
                  <strong className="text-amber-300 font-mono-num">{effectiveCostXp} XP</strong> from your balance and drop your rank from{' '}
                  <strong className="text-white font-mono-num">#{rankProjection.currentRank}</strong> to{' '}
                  <strong className="text-rose-400 font-mono-num">#{rankProjection.projectedRank}</strong>.
                </p>
              </div>
            </div>

            {isTargetShielded && (
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs text-cyan-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  {selectedTarget.name} is protected by an active 24h Bounty Shield! Audits, Duels, and Ambushes are deflected.
                </span>
              </div>
            )}

            {!hasEnoughXp && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Insufficient spendable XP! You need {effectiveCostXp} XP, but your live balance is {attacker.weeklyXp} XP.
                </span>
              </div>
            )}

            {hasEnoughXp && !targetHasEnoughDuelXp && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {selectedTarget.name} only has {selectedTarget.weeklyXp} XP and cannot match a {effectiveCostXp} XP wager.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer Confirm Button */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
          >
            Abort
          </button>
          <button
            type="button"
            disabled={!canConfirm || isSubmitting}
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              canConfirm && !isSubmitting
                ? 'bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white shadow-lg shadow-rose-600/30 cursor-pointer active:scale-98'
                : 'bg-white/[0.06] border border-white/10 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Executing...'
                : selectedTarget
                ? `Confirm Attack on ${selectedTarget.name}`
                : 'Select a Target to Lock'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
