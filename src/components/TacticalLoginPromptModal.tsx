import React, { useState } from 'react';
import {
  Swords,
  Crown,
  Link as LinkIcon,
  ShoppingBag,
  Shield,
  Flame,
  Clock,
  Target,
  Zap,
  Volume2,
  FileSearch,
  Edit3,
  Lock,
  Check,
  X,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Users
} from 'lucide-react';
import {
  OffensiveActionType,
  QuickdrawDuel,
  HostagePact,
  RobinHoodAmbush,
  AuditRecord
} from '../types/warfare';
import { TargetCandidate } from './TargetLockModal';
import { BLACKOUT_SHOP_DISABLED_MSG } from '../services/blackoutService';

interface TacticalLoginPromptModalProps {
  isOpen: boolean;
  currentUser: (TargetCandidate & {
    todayStudyMins?: number;
    gulagState?: boolean;
    curseUntil?: number | null;
  }) | null;
  allPlayers: Array<
    TargetCandidate & {
      todayStudyMins?: number;
      todayXpGenerated?: number;
      gulagState?: boolean;
    }
  >;
  duels: QuickdrawDuel[];
  hostagePacts: HostagePact[];
  ambushes: RobinHoodAmbush[];
  audits: AuditRecord[];
  isBlackoutActive: boolean;
  weeklyDutyPending?: boolean;
  isWeekday?: boolean;
  currentWeekKey?: string;
  currentDeclaredRivalId?: string | null;
  currentDeclaredRivalName?: string | null;
  onDeclareRival?: (rivalId: string) => Promise<void>;
  onClose: () => void;
  onSelectOffensiveAction: (
    actionType: OffensiveActionType,
    preselectedTargetId?: string,
    duelDurationMins?: number,
    duelWagerXp?: number
  ) => void;
  onBuyBountyShield: () => Promise<void>;
  onSendHostagePactInvite: (partnerId: string) => Promise<void>;
  onAcceptHostagePact: (pactId: string) => Promise<void>;
  onDeclineHostagePact: (pactId: string) => Promise<void>;
  onAcceptDuel: (duel: QuickdrawDuel) => Promise<void>;
  onDeclineDuel: (duel: QuickdrawDuel) => Promise<void>;
  onStartFocusTimerNow: () => void;
  onOpenLogSessionModal: () => void;
  onOpenCombinedStudyRoom?: () => void;
}

export const TacticalLoginPromptModal: React.FC<TacticalLoginPromptModalProps> = ({
  isOpen,
  currentUser,
  allPlayers = [],
  duels = [],
  hostagePacts = [],
  ambushes = [],
  audits = [],
  isBlackoutActive,
  weeklyDutyPending = false,
  isWeekday = true,
  currentWeekKey,
  currentDeclaredRivalId,
  currentDeclaredRivalName,
  onDeclareRival,
  onClose,
  onSelectOffensiveAction,
  onBuyBountyShield,
  onSendHostagePactInvite,
  onAcceptHostagePact,
  onDeclineHostagePact,
  onAcceptDuel,
  onDeclineDuel,
  onStartFocusTimerNow,
  onOpenLogSessionModal,
  onOpenCombinedStudyRoom
}) => {
  const [selectedRivalForDuel, setSelectedRivalForDuel] = useState<string>('');
  const [selectedDuelDuration, setSelectedDuelDuration] = useState<number>(45);
  const [selectedDuelWager, setSelectedDuelWager] = useState<number>(100);
  const [selectedPactPartner, setSelectedPactPartner] = useState<string>('');
  const [isSendingPact, setIsSendingPact] = useState<boolean>(false);
  const [selectedWeeklyRival, setSelectedWeeklyRival] = useState<string>(currentDeclaredRivalId || '');
  const [isDeclaringRival, setIsDeclaringRival] = useState<boolean>(false);
  const [showDutyWarning, setShowDutyWarning] = useState<boolean>(false);

  if (!isOpen || !currentUser || currentUser.id === 'admin' || currentUser.id.startsWith('teacher_')) return null;

  const safePlayers = Array.isArray(allPlayers) ? allPlayers : [];
  const rivals = safePlayers.filter(p => p.id !== currentUser.id);
  const kingPlayer = safePlayers.find(p => p.rank === 1) || safePlayers[0] || null;
  const isCurrentUserKing = kingPlayer?.id === currentUser.id;

  const pendingIncomingDuels = (Array.isArray(duels) ? duels : []).filter(
    d => d.status === 'pending' && d.opponentId === currentUser.id
  );

  const pendingIncomingPacts = (Array.isArray(hostagePacts) ? hostagePacts : []).filter(
    p => p.status === 'pending' && (p.partnerBId === currentUser.id || p.memberBId === currentUser.id)
  );

  const activeMyPact = (Array.isArray(hostagePacts) ? hostagePacts : []).find(
    p =>
      p.status === 'active' &&
      (p.partnerAId === currentUser.id ||
        p.memberAId === currentUser.id ||
        p.partnerBId === currentUser.id ||
        p.memberBId === currentUser.id)
  );

  const pendingAuditAgainstMe = (Array.isArray(audits) ? audits : []).find(
    a => a.status === 'pending' && a.targetUserId === currentUser.id
  );

  const nowD = new Date();
  const todayKey = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}-${String(nowD.getDate()).padStart(2, '0')}`;
  const alreadyAmbushedToday = (Array.isArray(ambushes) ? ambushes : []).some(
    a => a.dateKey === todayKey && a.ambusherId === currentUser.id
  );

  const effectiveDuelRivalId = selectedRivalForDuel || rivals[0]?.id || '';
  const effectivePactPartnerId = selectedPactPartner || rivals[0]?.id || '';

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-4xl surface-card rounded-3xl p-5 sm:p-7 border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.95)] space-y-5 my-auto max-h-[92dvh] overflow-y-auto animate-modal">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-emerald-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-sky-500/20 shrink-0">
              <Swords className="w-6 h-6 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] font-black uppercase tracking-widest text-sky-300">
                  Daily Tactical Briefing
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/[0.07] border border-white/15 text-[10px] font-mono-num font-bold text-slate-200">
                  Rank #{currentUser.rank} • {currentUser.weeklyXp} XP Balance
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
                Welcome back, {currentUser.name}. Choose Your Move:
              </h2>
              <p className="text-xs text-slate-400">
                Select a high-stakes action to launch right now, or jump straight into a focus session.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
            title="Close Briefing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MON-FRI MANDATORY TACTICAL PROTOCOL & 1V1 RIVAL DECLARATION BANNER */}
        {isWeekday && (
          <div
            className={`p-4 rounded-2xl border transition-all ${
              weeklyDutyPending
                ? 'bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-yellow-500/15 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                : 'bg-emerald-500/10 border-emerald-400/30'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    weeklyDutyPending
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-emerald-400 text-slate-950'
                  }`}
                >
                  {weeklyDutyPending ? (
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        weeklyDutyPending
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {weeklyDutyPending
                        ? 'Mandatory Mon-Fri Tactical Duty: Action Required'
                        : 'Mon-Fri Tactical Duty: Satisfied'}
                    </span>
                    {currentWeekKey && (
                      <span className="text-[10px] text-slate-400 font-mono-num">Sprint {currentWeekKey}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-white mt-0.5">
                    {weeklyDutyPending
                      ? 'Mon-Fri Squad Mandate: Choose a 1v1 Rival or launch tactical warfare'
                      : `Weekly tactical commitment cleared! ${currentDeclaredRivalName ? `(1v1 Rival: ${currentDeclaredRivalName})` : ''}`}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed mt-0.5">
                    {weeklyDutyPending
                      ? 'Squad protocol requires choosing an active 1v1 rival or using the XP Black Market, Robin Hood Tax, Quickdraw Duel, or Blood Pact at least once between Monday and Friday.'
                      : 'You have cleared your tactical duty for this week. You can update your rival or execute actions below anytime.'}
                  </p>
                </div>
              </div>

              {/* 1-Click Fast 1v1 Rival Lock (0 XP) */}
              <div className="p-3 rounded-xl bg-black/60 border border-white/10 shrink-0 w-full md:w-auto min-w-[280px] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1 text-sky-300">
                    <Target className="w-3 h-3" />
                    <span>Weekly 1v1 Rival Lock</span>
                  </span>
                  <span className="text-emerald-400 font-mono-num">0 XP Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedWeeklyRival || rivals[0]?.id || ''}
                    onChange={(e) => setSelectedWeeklyRival(e.target.value)}
                    disabled={isDeclaringRival}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/15 text-xs font-bold text-white focus:outline-none focus:border-sky-400"
                  >
                    {rivals.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.rank} {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isDeclaringRival || (!selectedWeeklyRival && !rivals[0]?.id)}
                    onClick={async () => {
                      const targetId = selectedWeeklyRival || rivals[0]?.id;
                      if (!targetId || !onDeclareRival) return;
                      setIsDeclaringRival(true);
                      try {
                        await onDeclareRival(targetId);
                        setShowDutyWarning(false);
                      } finally {
                        setIsDeclaringRival(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-sm disabled:opacity-40"
                  >
                    {isDeclaringRival ? 'Locking...' : 'Lock Rival'}
                  </button>
                </div>
                {currentDeclaredRivalName && (
                  <div className="text-[10px] text-sky-300 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Active Rival: <strong>{currentDeclaredRivalName}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {showDutyWarning && weeklyDutyPending && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Please declare your 1v1 Rival above or select an offensive warfare action (Duel, Ambush, Shop, or Blood Pact) to proceed.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Friday Blackout Notice if active */}
        {isBlackoutActive && (
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Friday Blackout Protocol in Effect
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {BLACKOUT_SHOP_DISABLED_MSG} Public ranks are CLASSIFIED / IN THE DARK until Saturday 00:00 when all Friday study hours convert to XP at once.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartFocusTimerNow();
              }}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer"
            >
              Lock In &amp; Start Timer
            </button>
          </div>
        )}

        {/* URGENT INCOMING ALERTS (Duels / Blood Pact Invites / Audits) */}
        {(pendingIncomingDuels.length > 0 || pendingIncomingPacts.length > 0 || pendingAuditAgainstMe) && (
          <div className="space-y-2.5">
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Urgent Incoming Challenges Requiring Your Response</span>
            </div>

            {pendingAuditAgainstMe && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-rose-200">
                    🕵️ {pendingAuditAgainstMe.auditorName} Audited Your {pendingAuditAgainstMe.sessionSubject} Session ({pendingAuditAgainstMe.sessionXp} XP at risk)!
                  </div>
                  <div className="text-[11px] text-rose-300/90">
                    Upload your rough notebook/tablet photo before the 10-minute timer expires!
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs cursor-pointer shrink-0"
                >
                  Upload Proof Now
                </button>
              </div>
            )}

            {pendingIncomingDuels.map(duel => (
              <div
                key={duel.id}
                className="p-3.5 rounded-2xl bg-sky-500/15 border border-sky-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-black text-white">
                    ⚔️ <span className="text-sky-300">{duel.challengerName}</span> called you out for a{' '}
                    <span className="text-amber-300 font-mono-num">{duel.durationMins}m</span> Quickdraw Duel!
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Wager: <strong className="text-emerald-300 font-mono-num">{duel.wagerXp} XP</strong> (Winner takes{' '}
                    <strong className="text-emerald-400 font-mono-num">{duel.escrowPot} XP</strong> pot)
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDeclineDuel(duel)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-xs font-bold text-slate-300 hover:text-rose-200 cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isBlackoutActive}
                    onClick={async () => {
                      await onAcceptDuel(duel);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Accept Duel ({duel.wagerXp} XP)
                  </button>
                </div>
              </div>
            ))}

            {pendingIncomingPacts.map(pact => {
              const inviterName = pact.partnerAName || pact.memberAName || 'Squadmate';
              return (
                <div
                  key={pact.id}
                  className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-black text-white">
                      🩸 <span className="text-rose-300">{inviterName}</span> invited you to a 5-Day Soul-Bound Blood Pact!
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Earn <strong>1.5x XP</strong> on all study blocks • 2h/day minimum quota each or both lose 100 XP &amp; enter the Gulag.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDeclineHostagePact(pact.id)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-xs font-bold text-slate-300 cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={isBlackoutActive}
                      onClick={async () => {
                        await onAcceptHostagePact(pact.id);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-400 hover:bg-rose-300 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      Accept Blood Pact (1.5x XP)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4-SYSTEM TACTICAL SELECTION GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CARD 1: 1v1 QUICKDRAW DUELS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-500/12 via-slate-900/90 to-slate-950 border border-sky-400/30 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-[10px] font-black uppercase tracking-wider text-sky-300 flex items-center gap-1">
                  <Swords className="w-3 h-3" />
                  <span>1v1 Quickdraw Sprint</span>
                </span>
                <span className="text-[11px] font-mono-num font-bold text-emerald-300">2x Escrow Pot</span>
              </div>

              <h3 className="text-base font-black text-white font-display">
                Call Out a Rival for a Focus Duel
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pick an opponent, duration (45m or 60m), and XP wager. First to finish uninterrupted takes the entire 2x Escrow Pot!
              </p>

              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Select Opponent
                  </label>
                  <select
                    value={effectiveDuelRivalId}
                    onChange={e => setSelectedRivalForDuel(e.target.value)}
                    disabled={isBlackoutActive}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-bold text-white focus:outline-none focus:border-sky-400"
                  >
                    {rivals.map(r => (
                      <option key={r.id} value={r.id}>
                        #{r.rank} {r.name} ({r.weeklyXp} XP • {r.institute})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Sprint Duration
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[45, 60].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setSelectedDuelDuration(mins)}
                          className={`py-1.5 rounded-lg text-xs font-mono-num font-bold border transition-all cursor-pointer ${
                            selectedDuelDuration === mins
                              ? 'bg-sky-400 text-slate-950 border-sky-300'
                              : 'bg-black/40 text-slate-300 border-white/10 hover:text-white'
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      XP Wager
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[50, 100, 200].map(w => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setSelectedDuelWager(w)}
                          className={`py-1.5 rounded-lg text-[11px] font-mono-num font-bold border transition-all cursor-pointer ${
                            selectedDuelWager === w
                              ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                              : 'bg-black/40 text-slate-300 border-white/10 hover:text-white'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isBlackoutActive || !effectiveDuelRivalId}
              onClick={() => {
                onClose();
                onSelectOffensiveAction(
                  'quickdraw_duel',
                  effectiveDuelRivalId,
                  selectedDuelDuration,
                  selectedDuelWager
                );
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-500/20"
            >
              <Target className="w-4 h-4" />
              <span>Lock Target &amp; Challenge ({selectedDuelWager * 2} XP Pot)</span>
            </button>
          </div>

          {/* CARD 2: ROBIN HOOD TAX (RANK #1 KING'S BOUNTY) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/12 via-slate-900/90 to-slate-950 border border-amber-400/30 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  <span>The Robin Hood Tax</span>
                </span>
                <span className="text-[11px] font-mono-num font-bold text-amber-300">50 XP Entry Tribute</span>
              </div>

              <h3 className="text-base font-black text-white font-display">
                {isCurrentUserKing
                  ? 'You Are The Crowned Tyrant (#1)!'
                  : `Ambush Rank #1 King (${kingPlayer?.name || 'Leader'})`}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isCurrentUserKing
                  ? 'Lower-ranked rivals can pay 50 XP to ambush your throne today. Out-study all ambushers to collect their 50 XP tributes, or equip a 24h Bounty Shield!'
                  : `Pay 50 XP to declare an Ambush on ${kingPlayer?.name || 'the King'}. Log more study minutes than the King today to siphon 20% of their daily XP at midnight!`}
              </p>

              {kingPlayer && (
                <div className="p-3 rounded-xl bg-black/50 border border-amber-400/25 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-300">Current Crowned Tyrant</div>
                    <div className="font-extrabold text-white text-sm">
                      #1 {kingPlayer.name} ({kingPlayer.weeklyXp} XP)
                    </div>
                  </div>
                  <div className="text-right font-mono-num">
                    <div className="text-[10px] text-slate-400">King Today</div>
                    <div className="text-xs font-bold text-emerald-400">{kingPlayer.todayStudyMins || 0} mins</div>
                  </div>
                </div>
              )}
            </div>

            {isCurrentUserKing ? (
              <button
                type="button"
                disabled={isBlackoutActive}
                onClick={async () => {
                  await onBuyBountyShield();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Shield className="w-4 h-4" />
                <span>Equip 24h King Bounty Shield (500 XP)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isBlackoutActive || alreadyAmbushedToday || !kingPlayer}
                onClick={() => {
                  if (!kingPlayer) return;
                  onClose();
                  onSelectOffensiveAction('robin_hood_ambush', kingPlayer.id);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Crown className="w-4 h-4" />
                <span>
                  {alreadyAmbushedToday
                    ? 'Ambush Already Active Today'
                    : `Target #1 ${kingPlayer?.name || 'King'} for Ambush (50 XP)`}
                </span>
              </button>
            )}
          </div>

          {/* CARD 3: HOSTAGE LINKS (SOUL-BOUND DUO STREAKS) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-500/12 via-slate-900/90 to-slate-950 border border-rose-400/30 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  <span>Soul-Bound Blood Pact</span>
                </span>
                <span className="text-[11px] font-mono-num font-bold text-rose-300">1.5x Study XP</span>
              </div>

              <h3 className="text-base font-black text-white font-display">
                {activeMyPact ? 'Active 5-Day Blood Pact in Progress' : 'Link Streaks with a Squad Partner'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Forge a 5-day Blood Pact: both earn <strong>1.5x XP</strong> on all study sessions, and both must log at least <strong>2 hours (120m)</strong> daily or both lose 100 XP &amp; enter the Gulag!
              </p>

              {activeMyPact ? (
                <div className="p-3 rounded-xl bg-black/50 border border-rose-400/30 text-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-rose-300">Soul-Bound Duo</div>
                    <div className="font-extrabold text-white">
                      {activeMyPact.partnerAName || activeMyPact.memberAName} &amp;{' '}
                      {activeMyPact.partnerBName || activeMyPact.memberBName}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 font-mono-num font-bold">
                    Day {activeMyPact.daysCompleted + 1}/{activeMyPact.targetDays || activeMyPact.totalDays || 5}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Choose Soul-Bound Partner
                  </label>
                  <select
                    value={effectivePactPartnerId}
                    onChange={e => setSelectedPactPartner(e.target.value)}
                    disabled={isBlackoutActive}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs font-bold text-white focus:outline-none focus:border-rose-400"
                  >
                    {rivals.map(r => (
                      <option key={r.id} value={r.id}>
                        #{r.rank} {r.name} ({r.todayStudyMins || 0}m logged today)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {activeMyPact ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartFocusTimerNow();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-400 hover:bg-rose-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Flame className="w-4 h-4" />
                <span>Grind 2h Daily Blood Pact Quota (1.5x XP)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isBlackoutActive || !effectivePactPartnerId || isSendingPact}
                onClick={async () => {
                  if (!effectivePactPartnerId) return;
                  setIsSendingPact(true);
                  try {
                    await onSendHostagePactInvite(effectivePactPartnerId);
                    onClose();
                  } finally {
                    setIsSendingPact(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-400 hover:bg-rose-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-500/20"
              >
                <LinkIcon className="w-4 h-4" />
                <span>Send 5-Day Blood Pact Proposal</span>
              </button>
            )}
          </div>

          {/* CARD 4: THE XP SHOP (BLACK MARKET SABOTAGES) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/12 via-slate-900/90 to-slate-950 border border-emerald-400/30 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                  <ShoppingBag className="w-3 h-3" />
                  <span>Black Market XP Shop</span>
                </span>
                <span className="text-[11px] font-mono-num font-bold text-slate-300">
                  Spend XP • Shift Rank
                </span>
              </div>

              <h3 className="text-base font-black text-white font-display">
                Deploy Tactical Sabotage or Defense
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pick an item below to open the Target Lock sheet, preview your rank change, and strike a specific rival:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={isBlackoutActive}
                  onClick={() => {
                    onClose();
                    onSelectOffensiveAction('name_hijack');
                  }}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 text-left transition-all cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-pink-400" />
                      <span>Name Hijack</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-emerald-300">300 XP</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Rename rival for 24h</div>
                </button>

                <button
                  type="button"
                  disabled={isBlackoutActive}
                  onClick={() => {
                    onClose();
                    onSelectOffensiveAction('ui_flashbang');
                  }}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 text-left transition-all cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>UI Flashbang</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-emerald-300">400 XP</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Hot-pink + Comic Sans</div>
                </button>

                <button
                  type="button"
                  disabled={isBlackoutActive}
                  onClick={() => {
                    onClose();
                    onSelectOffensiveAction('audit_badge');
                  }}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 text-left transition-all cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1">
                      <FileSearch className="w-3.5 h-3.5 text-sky-400" />
                      <span>Audit Badge</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-emerald-300">250 XP</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">10m notes proof check</div>
                </button>

                <button
                  type="button"
                  disabled={isBlackoutActive}
                  onClick={() => {
                    onClose();
                    onSelectOffensiveAction('sound_horn');
                  }}
                  className="p-2.5 rounded-xl bg-black/50 hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 text-left transition-all cursor-pointer disabled:opacity-40"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                      <span>Sound Horn</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-emerald-300">200 XP</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Airhorn next timer end</div>
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isBlackoutActive}
              onClick={async () => {
                await onBuyBountyShield();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Shield className="w-4 h-4" />
              <span>Activate 24h Self Bounty Shield (500 XP)</span>
            </button>
          </div>
        </div>

        {/* Bottom Direct Study Actions Bar */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onOpenCombinedStudyRoom && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCombinedStudyRoom();
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Study Together (Combined Lounge)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartFocusTimerNow();
              }}
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial"
            >
              <Clock className="w-4 h-4" />
              <span>Start Solo Timer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogSessionModal();
              }}
              className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Log Completed Session</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
              weeklyDutyPending && isWeekday
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 hover:bg-amber-500/25'
                : 'bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            {weeklyDutyPending && isWeekday ? (
              <>
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>Continue to Standings (Duty Pending)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Continue to Standings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
