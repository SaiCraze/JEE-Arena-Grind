import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Swords,
  Crown,
  Link as LinkIcon,
  Shield,
  Zap,
  Volume2,
  EyeOff,
  FileSearch,
  Edit3,
  Lock,
  Flame,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Users,
  Sparkles,
  Skull
} from 'lucide-react';
import {
  OffensiveActionType,
  AuditRecord,
  QuickdrawDuel,
  RobinHoodAmbush,
  HostagePact
} from '../types/warfare';
import { TargetCandidate, RecentTargetSession } from './TargetLockModal';
import {
  BLACKOUT_SHOP_MESSAGE,
  BLACKOUT_TOOLTIP_MESSAGE,
  CYCLE_4_START_MS
} from '../services/blackoutService';

interface WarfareHubProps {
  currentUser: (TargetCandidate & {
    curseUntil?: number | null;
    curseStudyMinsLogged?: number;
    soundHornPending?: boolean;
    soundHornBy?: string | null;
    gulagRangeActive?: boolean;
    gulagPenanceMinsLogged?: number;
  }) | null;
  allPlayers: Array<
    TargetCandidate & {
      todayStudyMins: number;
      todayXpGenerated: number;
      gulagState?: boolean;
      curseUntil?: number | null;
      soundHornPending?: boolean;
    }
  >;
  recentSessionsLast2h: RecentTargetSession[];
  audits: AuditRecord[];
  duels: QuickdrawDuel[];
  ambushes: RobinHoodAmbush[];
  hostagePacts: HostagePact[];
  isBlackoutActive: boolean;
  isEffectiveAdmin: boolean;
  onOpenTargetLock: (
    actionType: OffensiveActionType,
    actionLabel: string,
    baseCostXp: number,
    preselectedTargetId?: string,
    duelDuration?: number,
    duelWager?: number
  ) => void;
  onBuyBountyShield: () => Promise<void>;
  onSendHostagePactInvite: (partnerId: string) => Promise<void>;
  onAcceptHostagePact: (pactId: string) => Promise<void>;
  onDeclineOrBreakHostagePact: (pactId: string, isBreakActive: boolean) => Promise<void>;
  onTriggerMidnightSettlementCheck: () => Promise<void>;
  onToggleSimulateFridayBlackout?: () => Promise<void>;
  declaredRivalId?: string | null;
  declaredRivalName?: string | null;
  lastTacticalActionWeekKey?: string | null;
  currentWeekKey?: string;
  weeklyDutyPending?: boolean;
  isWeekday?: boolean;
  onDeclareRival?: (rivalId: string) => Promise<void>;
  initialSubTab?: 'shop' | 'duels' | 'robin_hood' | 'hostage' | 'rivalry';
  onCollapse?: () => void;
}

export const WarfareHub: React.FC<WarfareHubProps> = ({
  currentUser = null,
  allPlayers = [],
  recentSessionsLast2h = [],
  audits = [],
  duels = [],
  ambushes = [],
  hostagePacts = [],
  isBlackoutActive = false,
  isEffectiveAdmin = false,
  declaredRivalId = null,
  declaredRivalName = null,
  lastTacticalActionWeekKey = null,
  currentWeekKey,
  weeklyDutyPending = false,
  isWeekday = true,
  onDeclareRival,
  onOpenTargetLock,
  onBuyBountyShield,
  onSendHostagePactInvite,
  onAcceptHostagePact,
  onDeclineOrBreakHostagePact,
  onTriggerMidnightSettlementCheck,
  onToggleSimulateFridayBlackout,
  initialSubTab = 'shop',
  onCollapse
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'shop' | 'duels' | 'robin_hood' | 'hostage' | 'rivalry'>(initialSubTab);
  const [duelOpponentId, setDuelOpponentId] = useState<string>('');
  const [duelDurationMins, setDuelDurationMins] = useState<number>(45);
  const [duelWagerXp, setDuelWagerXp] = useState<number>(100);
  const [selectedPactPartnerId, setSelectedPactPartnerId] = useState<string>('');
  const [selectedRivalIdToLock, setSelectedRivalIdToLock] = useState<string>(declaredRivalId || '');
  const [isLockingRival, setIsLockingRival] = useState<boolean>(false);
  const [isBuyingShield, setIsBuyingShield] = useState<boolean>(false);

  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const safePlayers = Array.isArray(allPlayers) ? allPlayers : [];

  const kingPlayer = useMemo(() => {
    return safePlayers.find(p => p.rank === 1) || safePlayers[0] || null;
  }, [safePlayers]);

  const rivals = useMemo(() => {
    if (!currentUser) return safePlayers;
    return safePlayers.filter(p => p.id !== currentUser.id);
  }, [safePlayers, currentUser]);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayAmbushes = useMemo(() => {
    return (Array.isArray(ambushes) ? ambushes : []).filter(a => a.dateKey === todayKey);
  }, [ambushes, todayKey]);

  const pastAmbushes = useMemo(() => {
    return (Array.isArray(ambushes) ? ambushes : [])
      .filter(a => a.dateKey !== todayKey)
      .slice(0, 8);
  }, [ambushes, todayKey]);

  const myActivePact = useMemo(() => {
    if (!currentUser) return null;
    return (
      (Array.isArray(hostagePacts) ? hostagePacts : []).find(
        p =>
          (p.status === 'active' || p.status === 'pending') &&
          ((p.partnerAId || p.memberAId) === currentUser.id ||
            (p.partnerBId || p.memberBId) === currentUser.id)
      ) || null
    );
  }, [hostagePacts, currentUser]);

  const isBeforeMondayReset = Date.now() < CYCLE_4_START_MS;

  const shopItems = [
    {
      id: 'name_hijack' as const,
      title: 'Name Hijack',
      cost: 300,
      icon: Edit3,
      accent: 'text-amber-300 border-amber-400/35 bg-amber-500/10',
      description:
        'Pick a target player and rename their display title on the leaderboard for 24h (e.g., "Nap Champion").',
      cleanseRule: 'Cleanse rule: Target can cleanse early by logging a verified 60-min uninterrupted study session.'
    },
    {
      id: 'ui_flashbang' as const,
      title: 'UI Flashbang / Curse',
      cost: 400,
      icon: Sparkles,
      accent: 'text-pink-300 border-pink-400/40 bg-pink-500/15',
      description:
        'Force an obnoxious "Curse Mode" (hot-pink palette + Comic Sans) on your target client for 24h.',
      cleanseRule: 'Cleanse rule: Lifts automatically after 24h or once target logs 45 study minutes.'
    },
    {
      id: 'audit_badge' as const,
      title: 'The Audit Badge',
      cost: 250,
      icon: FileSearch,
      accent: 'text-sky-300 border-sky-400/35 bg-sky-500/10',
      description:
        'Pick a rival session logged in the last 2 hours. Starts a 10-minute timer on their client to upload notebook/tablet proof.',
      cleanseRule: 'Consequence: If they fail or ignore it, that session XP is stripped and awarded to you!'
    },
    {
      id: 'sound_horn' as const,
      title: 'Sound Horn',
      cost: 200,
      icon: Volume2,
      accent: 'text-orange-300 border-orange-400/35 bg-orange-500/10',
      description:
        'Arm a stadium airhorn trap on a target. Blasts an obnoxious airhorn on their screen the next time they finish a timer.',
      cleanseRule: 'Trigger: Detonates automatically on target next timer completion.'
    }
  ];

  const shieldActiveRemainingHrs = useMemo(() => {
    if (!currentUser?.bountyShieldUntil || currentUser.bountyShieldUntil <= Date.now()) return 0;
    return Math.max(1, Math.ceil((currentUser.bountyShieldUntil - Date.now()) / (3600 * 1000)));
  }, [currentUser?.bountyShieldUntil]);

  return (
    <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-5 relative overflow-hidden">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Swords className="w-3 h-3" />
              <span>Social Warfare &amp; High-Stakes Arena</span>
            </span>
            {isBeforeMondayReset ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[10px] font-bold font-mono-num">
                Monday 12:00 AM (11/2/2026) 0-XP Reset Scheduled
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                Sprint 4 Live (Started Nov 2, 12:00 AM at 0 XP)
              </span>
            )}
            {isBlackoutActive && (
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-600 text-zinc-200 text-[10px] font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Friday Blackout Lockdown</span>
              </span>
            )}
            {isWeekday && currentUser && currentUser.id !== 'admin' && !currentUser.id.startsWith('teacher_') && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  weeklyDutyPending
                    ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300 animate-pulse'
                    : 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-300'
                }`}
              >
                {weeklyDutyPending ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Mon-Fri Duty Pending</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Tactical Duty Cleared {declaredRivalName ? `(Rival: ${declaredRivalName})` : ''}</span>
                  </>
                )}
              </span>
            )}
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white font-display tracking-tight">
            1v1 Rivalries, XP Black Market, Duels, Robin Hood Tax &amp; Blood Pacts
          </h3>
          <p className="text-xs text-slate-400">
            Live leaderboard XP is your spendable currency. Squad rules require choosing a 1v1 rival or using tactical warfare at least once between Monday and Friday.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/10 shrink-0">
          {[
            { id: 'rivalry' as const, label: '1v1 Rivalry', icon: Target, isAlert: weeklyDutyPending },
            { id: 'shop' as const, label: 'XP Shop', icon: ShoppingBag },
            { id: 'duels' as const, label: '1v1 Quickdraw', icon: Swords },
            { id: 'robin_hood' as const, label: 'Robin Hood Tax', icon: Crown },
            { id: 'hostage' as const, label: 'Hostage Links', icon: LinkIcon }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  active
                    ? 'bg-white text-slate-950 shadow-sm'
                    : tab.isAlert
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30 hover:bg-amber-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.isAlert && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
              </button>
            );
          })}
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
              title="Collapse Warfare Drawer"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {/* Active Player Balance & Status Strip */}
      {currentUser && (
        <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-slate-950 font-black font-display text-sm flex items-center justify-center">
              {currentUser.name[0]}
            </div>
            <div>
              <div className="text-xs font-extrabold text-white flex items-center gap-2">
                <span>{currentUser.name}</span>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-num text-sky-300">
                  {isBlackoutActive ? 'Rank #CLASSIFIED' : `Rank #${currentUser.rank}`}
                </span>
                {currentUser.gulagRangeActive && (
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-300 flex items-center gap-1">
                    <Skull className="w-3 h-3" />
                    <span>GULAG PENANCE ({currentUser.gulagPenanceMinsLogged || 0}/45m)</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Spendable Balance:{' '}
                <strong className="text-emerald-400 font-mono-num">
                  {currentUser.weeklyXp.toLocaleString()} XP
                </strong>
                {myActivePact && myActivePact.status === 'active' && (
                  <span className="ml-2 text-rose-300 font-semibold">
                    • 1.5x Blood Pact Multiplier Active
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isEffectiveAdmin && onToggleSimulateFridayBlackout && (
              <button
                type="button"
                onClick={onToggleSimulateFridayBlackout}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-bold text-amber-300 cursor-pointer"
                title="Admin: Toggle Friday Blackout Simulation"
              >
                {isBlackoutActive ? 'Exit Blackout Sim' : 'Simulate Friday Blackout'}
              </button>
            )}
            {isEffectiveAdmin && (
              <button
                type="button"
                onClick={onTriggerMidnightSettlementCheck}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-bold text-sky-300 cursor-pointer"
                title="Admin: Settle Daily Robin Hood Tax & Hostage Quotas"
              >
                Settle Daily Quotas
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 0: 1V1 RIVALRY (MANDATORY MON-FRI SQUAD PROTOCOL) */}
      {activeSubTab === 'rivalry' && (
        <div className="space-y-4">
          {/* Mon-Fri Mandatory Warfare Protocol Info Banner */}
          {currentUser && currentUser.id !== 'admin' && !currentUser.id.startsWith('teacher_') ? (
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                weeklyDutyPending
                  ? 'bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-orange-500/15 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                  : 'bg-emerald-500/10 border-emerald-400/30'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      weeklyDutyPending ? 'bg-amber-400 text-slate-950 font-black' : 'bg-emerald-400 text-slate-950 font-black'
                    }`}
                  >
                    {weeklyDutyPending ? <AlertTriangle className="w-5 h-5 stroke-[2.5]" /> : <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
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
                        {weeklyDutyPending ? 'Mandatory Mon-Fri Tactical Duty Pending' : 'Weekly Tactical Duty Cleared'}
                      </span>
                      {currentWeekKey && (
                        <span className="text-[10px] font-mono-num text-slate-400">Week {currentWeekKey}</span>
                      )}
                    </div>
                    <h4 className="text-base font-black text-white font-display mt-0.5">
                      {weeklyDutyPending
                        ? 'Compulsory Action: Lock a 1v1 Rival or engage in tactical warfare'
                        : `Tactical duty completed! ${declaredRivalName ? `(1v1 Rival: ${declaredRivalName})` : ''}`}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                      Squad regulations require every scholar to choose a 1v1 Rival or execute at least one tactical action (XP Black Market, Robin Hood Ambush, Quickdraw Duel, or Blood Pact) between Monday and Friday.
                    </p>
                  </div>
                </div>

                {/* 1-Click Fast Declare Rival Form */}
                <div className="p-3 rounded-xl bg-black/60 border border-white/10 shrink-0 w-full sm:w-auto min-w-[280px] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1 text-sky-300">
                      <Target className="w-3 h-3" />
                      <span>Lock 1v1 Weekly Rival</span>
                    </span>
                    <span className="text-emerald-400 font-mono-num">0 XP Cost</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRivalIdToLock || rivals[0]?.id || ''}
                      onChange={(e) => setSelectedRivalIdToLock(e.target.value)}
                      disabled={isLockingRival}
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
                      disabled={isLockingRival || (!selectedRivalIdToLock && !rivals[0]?.id)}
                      onClick={async () => {
                        const targetId = selectedRivalIdToLock || rivals[0]?.id;
                        if (!targetId || !onDeclareRival) return;
                        setIsLockingRival(true);
                        try {
                          await onDeclareRival(targetId);
                        } finally {
                          setIsLockingRival(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-sm disabled:opacity-40"
                    >
                      {isLockingRival ? 'Locking...' : 'Lock Rival'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-500/10 border border-sky-400/30 space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-sky-300 uppercase tracking-widest">
                <Target className="w-4 h-4 text-sky-400" />
                <span>Admin Observer View: Squad 1v1 Rivalries &amp; Weekly Mon-Fri Compliance</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                As the Arena Administrator, you are exempt from rival declarations and tactical commitments. Use the matrix below to monitor student competitor rivalries and weekly Mon-Fri compliance.
              </p>
            </div>
          )}

          {/* Active 1v1 Matchup Spotlight */}
          {declaredRivalId && (() => {
            const rival = safePlayers.find(p => p.id === declaredRivalId);
            if (!rival) return null;
            const myXp = currentUser?.weeklyXp || 0;
            const rivalXp = rival.weeklyXp || 0;
            const xpDiff = myXp - rivalXp;
            const myStudyMins = safePlayers.find(p => p.id === currentUser?.id)?.todayStudyMins || 0;
            const rivalStudyMins = rival.todayStudyMins || 0;

            return (
              <div className="p-5 rounded-3xl bg-gradient-to-br from-sky-500/10 via-slate-900 to-black border border-sky-400/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-400 text-slate-950 font-black flex items-center justify-center font-display text-base">
                      ⚔️
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">
                        Designated 1v1 Nemesis Match
                      </div>
                      <h4 className="text-lg font-black text-white font-display">
                        You vs. {rival.name}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono-num font-bold border ${
                        xpDiff >= 0
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                      }`}
                    >
                      {xpDiff >= 0 ? `+${xpDiff} XP Ahead` : `${Math.abs(xpDiff)} XP Behind`}
                    </span>
                  </div>
                </div>

                {/* Head-to-Head Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Your Standing ({currentUser?.name})</span>
                      <span className="font-mono-num text-sky-300">Rank #{currentUser?.rank}</span>
                    </div>
                    <div className="text-2xl font-black font-mono-num text-white">
                      {myXp} <span className="text-xs font-normal text-slate-400">XP</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Today: <strong className="text-emerald-400 font-mono-num">{myStudyMins}m</strong> study logged
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Rival Standing ({rival.name})</span>
                      <span className="font-mono-num text-sky-300">Rank #{rival.rank}</span>
                    </div>
                    <div className="text-2xl font-black font-mono-num text-white">
                      {rivalXp} <span className="text-xs font-normal text-slate-400">XP</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Today: <strong className="text-emerald-400 font-mono-num">{rivalStudyMins}m</strong> study logged
                    </div>
                  </div>
                </div>

                {/* Direct Action Trigger Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBlackoutActive}
                    onClick={() => {
                      onOpenTargetLock('quickdraw_duel', 'Quickdraw Duel', 100, rival.id, 45, 100);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Challenge {rival.name} to 45m Duel (100 XP)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBlackoutActive}
                    onClick={() => {
                      onOpenTargetLock('sound_horn', 'Sound Horn', 200, rival.id);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-violet-400" />
                    <span>Arm Sound Horn (200 XP)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBlackoutActive}
                    onClick={() => {
                      onOpenTargetLock('audit_badge', 'Audit Badge', 250, rival.id);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSearch className="w-4 h-4 text-amber-400" />
                    <span>Audit Study Session (250 XP)</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Squad Rivalry Overview Table */}
          <div className="p-4 sm:p-5 rounded-3xl bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-white font-display">
                Squad Rivalry Matrix &amp; Weekly Compliance
              </h4>
              <span className="text-[10px] text-slate-400">
                Active Sprint Competitors ({safePlayers.length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {safePlayers.map((player) => {
                const rivalName = (player as any).declaredRivalName;
                const dutyDone = (player as any).lastTacticalActionWeekKey === currentWeekKey || Boolean(rivalName);
                const isMe = currentUser?.id === player.id;

                return (
                  <div
                    key={player.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      isMe
                        ? 'bg-sky-500/10 border-sky-400/35 ring-1 ring-sky-400/20'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>#{player.rank} {player.name}</span>
                        {isMe && (
                          <span className="text-[9px] font-bold text-sky-300 px-1 py-0.2 rounded bg-sky-500/20">
                            YOU
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          dutyDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : isWeekday
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {dutyDone ? 'Duty Cleared' : isWeekday ? 'Duty Pending' : 'Pending'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      {rivalName ? (
                        <span className="text-sky-300 font-semibold flex items-center gap-1">
                          <Target className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>Rival: <strong>{rivalName}</strong></span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No rival locked yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: THE XP SHOP */}
      {activeSubTab === 'shop' && (
        <div className="space-y-4">
          {isBlackoutActive && (
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700 text-center space-y-1">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center justify-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>{BLACKOUT_SHOP_MESSAGE}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                All sabotage purchases, offensive items, and shields are locked until Saturday 00:00 Midnight Reveal.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shopItems.map((item) => {
              const Icon = item.icon;
              const canAfford = Boolean(currentUser && currentUser.weeklyXp >= item.cost);
              const disabled = isBlackoutActive || !currentUser;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-black/45 border border-white/10 hover:border-white/20 flex flex-col justify-between gap-3.5 transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.accent}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white font-display">{item.title}</h4>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Explicit Target Selection
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 font-mono-num text-xs font-black text-amber-300">
                        {item.cost} XP
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                    <p className="text-[10.5px] text-slate-400 bg-white/[0.03] p-2 rounded-xl border border-white/[0.06]">
                      {item.cleanseRule}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    title={isBlackoutActive ? BLACKOUT_SHOP_MESSAGE : `Select a target rival for ${item.title}`}
                    onClick={() => onOpenTargetLock(item.id, item.title, item.cost)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                      disabled
                        ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                        : canAfford
                        ? 'bg-white hover:bg-slate-100 text-slate-950 cursor-pointer shadow-sm active:scale-98'
                        : 'bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 cursor-pointer'
                    }`}
                  >
                    {isBlackoutActive ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>{BLACKOUT_SHOP_MESSAGE}</span>
                      </>
                    ) : (
                      <>
                        <Target className="w-3.5 h-3.5" />
                        <span>Select Target ({item.cost} XP)</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}

            {/* Item 5: Bounty Shield (Self-Targeted, 500 XP) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-black/50 to-black/60 border border-cyan-400/35 flex flex-col justify-between gap-3.5">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white font-display">Bounty Shield</h4>
                      <span className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold">
                        Self-Targeted Defense
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 font-mono-num text-xs font-black text-cyan-200">
                    500 XP
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed">
                  Grants 24-hour personal immunity from The Audit Badge, 1v1 Quickdraw Duels, and Robin Hood Ambushes.
                </p>
                <p className="text-[10.5px] text-cyan-200/80 bg-black/40 p-2 rounded-xl border border-cyan-400/20">
                  Auto-Pause Protocol: Remaining shield duration automatically pauses during Friday Blackout.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  isBlackoutActive ||
                  !currentUser ||
                  currentUser.weeklyXp < 500 ||
                  shieldActiveRemainingHrs > 0 ||
                  isBuyingShield
                }
                title={isBlackoutActive ? BLACKOUT_SHOP_MESSAGE : 'Activate 24h Bounty Shield (500 XP)'}
                onClick={async () => {
                  setIsBuyingShield(true);
                  try {
                    await onBuyBountyShield();
                  } finally {
                    setIsBuyingShield(false);
                  }
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  isBlackoutActive
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                    : shieldActiveRemainingHrs > 0
                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 cursor-default'
                    : currentUser && currentUser.weeklyXp >= 500
                    ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer shadow-lg shadow-cyan-500/20'
                    : 'bg-white/[0.06] border border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>
                  {isBlackoutActive
                    ? BLACKOUT_SHOP_MESSAGE
                    : shieldActiveRemainingHrs > 0
                    ? `Shield Active (${shieldActiveRemainingHrs}h left)`
                    : 'Activate Bounty Shield (500 XP)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 1V1 QUICKDRAW DUELS */}
      {activeSubTab === 'duels' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Real-Time Focus Sprints
                </span>
                <h4 className="text-base font-extrabold text-white font-display">
                  Dispatch 1v1 Quickdraw Callout
                </h4>
              </div>
              <Swords className="w-5 h-5 text-sky-400" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Select a rival, sprint duration, and XP wager. Both wagers lock into an <code className="text-emerald-300 font-mono">escrowPot</code>. First player to complete the timer without pausing or aborting wins <strong className="text-white">2x wager</strong>!
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Target Opponent
                </label>
                <select
                  value={duelOpponentId}
                  onChange={(e) => setDuelOpponentId(e.target.value)}
                  disabled={isBlackoutActive}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="">Select Rival on Target Lock Screen...</option>
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rank #{r.rank} • {r.weeklyXp} XP)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Sprint Duration
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[45, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={isBlackoutActive}
                        onClick={() => setDuelDurationMins(m)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono-num border cursor-pointer ${
                          duelDurationMins === m
                            ? 'bg-sky-400 text-slate-950 border-sky-300'
                            : 'bg-black/40 border-white/10 text-slate-300'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    XP Wager (Pot: {duelWagerXp * 2} XP)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={1000}
                    step={10}
                    disabled={isBlackoutActive}
                    value={duelWagerXp}
                    onChange={(e) => setDuelWagerXp(Math.max(20, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-xs text-white font-mono-num"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isBlackoutActive || !currentUser}
                title={isBlackoutActive ? BLACKOUT_TOOLTIP_MESSAGE : 'Lock Target for Quickdraw Duel'}
                onClick={() =>
                  onOpenTargetLock(
                    'quickdraw_duel',
                    `${duelDurationMins}m Quickdraw Duel`,
                    duelWagerXp,
                    duelOpponentId,
                    duelDurationMins,
                    duelWagerXp
                  )
                }
                className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  isBlackoutActive || !currentUser
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-sky-400 to-cyan-300 hover:from-sky-300 hover:to-cyan-200 text-slate-950 cursor-pointer shadow-lg shadow-sky-500/20'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>
                  {isBlackoutActive
                    ? 'Quickdraw Duels Disabled (Friday Blackout)'
                    : `Open Target Lock (${duelWagerXp} XP Wager)`}
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-white font-display">
                Active &amp; Recent Quickdraw Sprints ({duels.length})
              </h4>
              <span className="text-[10px] font-mono-num text-slate-400">
                10-min Challenge Expiry • 2x Wager Escrow Pot
              </span>
            </div>

            {duels.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No Quickdraw Duels initiated yet. Call out a rival to start a simultaneous focus sprint!
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {duels.slice(0, 12).map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{d.challengerName}</span>
                        <span className="text-sky-400 font-black">VS</span>
                        <span>{d.opponentName}</span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono-num text-amber-300">
                          {d.durationMins}m Sprint
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Escrow Pot: <strong className="text-emerald-400 font-mono-num">{d.escrowPot} XP</strong> ({d.wagerXp} XP each)
                        {d.winReason && ` • ${d.winReason}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {d.status === 'pending' && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[10px] font-bold">
                          Awaiting Response
                        </span>
                      )}
                      {d.status === 'active' && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[10px] font-bold animate-pulse">
                          LIVE SPRINT
                        </span>
                      )}
                      {d.status === 'completed' && (
                        <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/35 text-sky-300 text-[10px] font-bold">
                          Winner: {d.winnerName} (+{d.escrowPot} XP)
                        </span>
                      )}
                      {d.status === 'forfeited' && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[10px] font-bold">
                          Forfeit: {d.winnerName} (+{d.escrowPot} XP)
                        </span>
                      )}
                      {(d.status === 'declined' || d.status === 'expired') && (
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px]">
                          {d.status === 'expired' ? 'Expired (Refunded)' : 'Declined (Refunded)'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: THE ROBIN HOOD TAX (RANK #1 KING'S BOUNTY) */}
      {activeSubTab === 'robin_hood' && (
        <div className="space-y-4">
          {/* Step-by-Step Rules & Anti-Abuse Protections Banner */}
          <div className="p-4 rounded-2xl bg-black/55 border border-amber-400/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <span>How The Robin Hood Tax Works (Daily Rank #1 Bounty)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-bold text-amber-200 font-mono-num">
                Auto-Settles Daily at 00:00 Midnight
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <div className="font-extrabold text-white flex items-center justify-between">
                  <span>1. Pay 50 XP Entry Tribute</span>
                  <span className="text-[10px] font-mono-num text-amber-300">-50 XP Now</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Any scholar ranked #2 or lower can pay 50 XP from their live weekly balance to declare an Ambush on the Rank #1 King for today.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <div className="font-extrabold text-white flex items-center justify-between">
                  <span>2. Out-Study The King Today</span>
                  <span className="text-[10px] font-mono-num text-sky-300">Today&apos;s Mins</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Compare total study minutes logged today (00:00 to 23:59). You must log strictly more minutes than the King today to win.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <div className="font-extrabold text-white flex items-center justify-between">
                  <span>3. Midnight Siphon or Tribute</span>
                  <span className="text-[10px] font-mono-num text-emerald-300">20% Siphon</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-emerald-300">Win:</strong> Get your 50 XP back + steal <strong>20% of the King&apos;s Today XP</strong> (min 25 XP).{' '}
                  <strong className="text-rose-300">Lose/Tie:</strong> King claims your <strong>+50 XP Tribute</strong>!
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/25 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Anti-Spam &amp; Fair Play Safeguards:</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-300">
                <span>• <strong>Max 1 Ambush/Day</strong> per challenger</span>
                <span>• <strong>Only Today&apos;s XP</strong> is taxed (never total bank)</span>
                <span>• Failed attacks <strong>feed +50 XP to the King</strong></span>
                <span>• King can equip a <strong>24h Bounty Shield</strong></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-black/60 to-black/70 border border-amber-400/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                      Rank #1 King&apos;s Bounty
                    </span>
                    <h4 className="text-base font-black text-white font-display flex items-center gap-1.5">
                      <span>Crowned Tyrant: {isBlackoutActive ? 'CLASSIFIED' : kingPlayer?.name || 'Leader'}</span>
                      {!isBlackoutActive && kingPlayer?.bountyShieldUntil && kingPlayer.bountyShieldUntil > Date.now() && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[9px] font-bold">
                          SHIELDED
                        </span>
                      )}
                    </h4>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono-num text-xs font-extrabold">
                  50 XP Entry
                </span>
              </div>

              {(() => {
                const kingMins = kingPlayer?.todayStudyMins || 0;
                const kingTodayXp = kingPlayer?.todayXpGenerated || 0;
                const projectedSteal = Math.max(25, Math.round(kingTodayXp * 0.2));
                const myPlayer = currentUser ? safePlayers.find(p => p.id === currentUser.id) : null;
                const myMins = myPlayer?.todayStudyMins || 0;
                const maxBarMins = Math.max(60, kingMins, myMins);
                const isMeKing = Boolean(currentUser && kingPlayer && currentUser.id === kingPlayer.id);
                const minsDiff = myMins - kingMins;
                const kingShielded = Boolean(
                  kingPlayer?.bountyShieldUntil && kingPlayer.bountyShieldUntil > Date.now()
                );

                return (
                  <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-3 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">King&apos;s Study Today</div>
                        <div className="text-sm font-black text-white font-mono-num mt-0.5">
                          {isBlackoutActive ? 'CLASSIFIED' : `${kingMins}m`}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="text-[10px] text-slate-400">King&apos;s XP Today</div>
                        <div className="text-sm font-black text-sky-300 font-mono-num mt-0.5">
                          {isBlackoutActive ? 'CLASSIFIED' : `${kingTodayXp} XP`}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30">
                        <div className="text-[10px] text-emerald-300 font-bold">20% Siphon Pool</div>
                        <div className="text-sm font-black text-emerald-400 font-mono-num mt-0.5">
                          {isBlackoutActive ? 'CLASSIFIED' : `+${projectedSteal} XP`}
                        </div>
                      </div>
                    </div>

                    {!isBlackoutActive && currentUser && !isMeKing && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-semibold">
                            Your Study Today vs. {kingPlayer?.name}:
                          </span>
                          <span
                            className={`font-mono-num font-bold ${
                              minsDiff > 0 ? 'text-emerald-400' : 'text-amber-300'
                            }`}
                          >
                            {minsDiff > 0
                              ? `You lead by +${minsDiff}m!`
                              : `Need ${Math.abs(minsDiff) + 1}m more to take the lead`}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-mono-num">
                              <span className="text-slate-300">You ({currentUser.name})</span>
                              <span className="text-white font-bold">{myMins} mins</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  minsDiff > 0 ? 'bg-emerald-400' : 'bg-sky-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.round((myMins / maxBarMins) * 100))}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] font-mono-num">
                              <span className="text-amber-300">King ({kingPlayer?.name})</span>
                              <span className="text-amber-300 font-bold">{kingMins} mins</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-amber-400 transition-all"
                                style={{ width: `${Math.min(100, Math.round((kingMins / maxBarMins) * 100))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {kingShielded && !isBlackoutActive && (
                      <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-[11px] text-cyan-200 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          {kingPlayer?.name} has an active 24h Bounty Shield! New Robin Hood Ambushes are blocked until the shield expires.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                disabled={
                  isBlackoutActive ||
                  !currentUser ||
                  !kingPlayer ||
                  currentUser.id === kingPlayer.id ||
                  Boolean(kingPlayer.bountyShieldUntil && kingPlayer.bountyShieldUntil > Date.now()) ||
                  todayAmbushes.some(a => a.ambusherId === currentUser.id)
                }
                title={isBlackoutActive ? BLACKOUT_TOOLTIP_MESSAGE : 'Declare Robin Hood Ambush on the Rank #1 King'}
                onClick={() =>
                  kingPlayer &&
                  onOpenTargetLock('robin_hood_ambush', 'Robin Hood Ambush (King Bounty)', 50, kingPlayer.id)
                }
                className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  isBlackoutActive ||
                  !currentUser ||
                  !kingPlayer ||
                  currentUser.id === kingPlayer.id ||
                  Boolean(kingPlayer?.bountyShieldUntil && kingPlayer.bountyShieldUntil > Date.now()) ||
                  todayAmbushes.some(a => a.ambusherId === currentUser.id)
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/20'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>
                  {isBlackoutActive
                    ? 'Robin Hood Ambush Disabled (Friday Blackout)'
                    : currentUser?.id === kingPlayer?.id
                    ? 'You Are The Crowned Tyrant (#1)'
                    : kingPlayer?.bountyShieldUntil && kingPlayer.bountyShieldUntil > Date.now()
                    ? `${kingPlayer.name} Protected by 24h Bounty Shield`
                    : todayAmbushes.some(a => a.ambusherId === currentUser?.id)
                    ? 'Ambush Already Declared Today (Max 1/Day)'
                    : `Declare Ambush on ${kingPlayer?.name || 'The King'} (50 XP)`}
                </span>
              </button>
            </div>

            <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white font-display">
                    Today&apos;s Active &amp; Settled Ambushes ({todayAmbushes.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Live study minutes are compared until 23:59 and settled automatically at Midnight.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/30 text-[11px] font-mono-num font-bold text-amber-300">
                  Today&apos;s Tribute Pot: {todayAmbushes.length * 50} XP
                </span>
              </div>

              {todayAmbushes.length === 0 ? (
                <div className="py-8 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-1">
                  <div className="text-xs font-bold text-slate-300">
                    No Robin Hood Ambushes declared today ({todayKey}).
                  </div>
                  <div className="text-[11px] text-slate-500">
                    If you think you will study more minutes than {kingPlayer?.name || 'the King'} today, pay 50 XP on the left to launch an ambush!
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayAmbushes.map((amb) => {
                    const ambusherStat = safePlayers.find(p => p.id === amb.ambusherId);
                    const kingStat = safePlayers.find(p => p.id === amb.kingId);
                    const ambMins =
                      amb.status === 'active'
                        ? ambusherStat?.todayStudyMins || 0
                        : amb.ambusherMins ?? (ambusherStat?.todayStudyMins || 0);
                    const kMins =
                      amb.status === 'active'
                        ? kingStat?.todayStudyMins || 0
                        : amb.kingMins ?? (kingStat?.todayStudyMins || 0);
                    const kTodayXp = kingStat?.todayXpGenerated || 0;
                    const projectedSteal = Math.max(25, Math.round(kTodayXp * 0.2));
                    const isWinning = ambMins > kMins;
                    const maxCompare = Math.max(60, ambMins, kMins);

                    return (
                      <div
                        key={amb.id}
                        className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>🏹 {amb.ambusherName}</span>
                            <span className="text-slate-400 text-[11px]">ambushing</span>
                            <span className="flex items-center gap-1 text-amber-300">
                              <Crown className="w-3.5 h-3.5 text-amber-400" />
                              {amb.kingName}
                            </span>
                          </div>

                          <div>
                            {amb.status === 'active' ? (
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                  isWinning
                                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                    : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                                }`}
                              >
                                {isWinning
                                  ? `Ambusher Leading (+${ambMins - kMins}m • Projected +${projectedSteal} XP Steal)`
                                  : `King Defending (+${kMins - ambMins}m • +50 XP Tribute to King)`}
                              </span>
                            ) : amb.status === 'ambusher_won' || amb.status === 'won' ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                                Settled: {amb.ambusherName} Siphoned +{amb.xpSiphoned || amb.siphonedXp || 25} XP (+50 XP Refunded)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                                Settled: King {amb.kingName} Defended (+50 XP Tribute)
                              </span>
                            )}
                          </div>
                        </div>

                        {!isBlackoutActive && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <div className="p-2 rounded-xl bg-black/45 border border-white/[0.06] space-y-1">
                              <div className="flex justify-between text-[10.5px] font-mono-num">
                                <span className="text-slate-300">{amb.ambusherName} (Challenger)</span>
                                <span className="text-white font-bold">{ambMins}m</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isWinning ? 'bg-emerald-400' : 'bg-sky-400'}`}
                                  style={{ width: `${Math.min(100, Math.round((ambMins / maxCompare) * 100))}%` }}
                                />
                              </div>
                            </div>

                            <div className="p-2 rounded-xl bg-black/45 border border-white/[0.06] space-y-1">
                              <div className="flex justify-between text-[10.5px] font-mono-num">
                                <span className="text-amber-300">{amb.kingName} (King)</span>
                                <span className="text-amber-300 font-bold">{kMins}m</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-400"
                                  style={{ width: `${Math.min(100, Math.round((kMins / maxCompare) * 100))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Past Ambush History Ledger */}
              {pastAmbushes.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                      Recent Ambush History &amp; Outcomes
                    </h5>
                    <span className="text-[10px] text-slate-500 font-mono-num">
                      Last {pastAmbushes.length} Recorded
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {pastAmbushes.map((amb) => {
                      const won = amb.status === 'ambusher_won' || amb.status === 'won';
                      const isPendingPast = amb.status === 'active';
                      return (
                        <div
                          key={amb.id}
                          className="p-2.5 rounded-xl bg-black/40 border border-white/[0.07] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-mono-num text-[10px]">
                              {amb.dateKey}
                            </span>
                            <span className="text-white font-semibold">
                              {amb.ambusherName} vs. King {amb.kingName}
                            </span>
                            {(amb.ambusherMins !== undefined || amb.kingMins !== undefined) && (
                              <span className="text-slate-400 font-mono-num text-[10px]">
                                ({amb.ambusherMins ?? 0}m vs {amb.kingMins ?? 0}m)
                              </span>
                            )}
                          </div>
                          <div>
                            {isPendingPast ? (
                              <span className="text-amber-300 font-bold text-[10px]">
                                Settling...
                              </span>
                            ) : won ? (
                              <span className="text-emerald-300 font-bold font-mono-num text-[10px]">
                                🏹 Ambusher Siphoned +{amb.xpSiphoned || amb.siphonedXp || 25} XP
                              </span>
                            ) : (
                              <span className="text-rose-300 font-bold font-mono-num text-[10px]">
                                👑 King Defended (+50 XP Tribute)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HOSTAGE LINKS (SOUL-BOUND DUO STREAKS) */}
      {activeSubTab === 'hostage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-500/15 via-black/60 to-black/70 border border-rose-500/35 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">
                    Soul-Bound Duo Streaks
                  </span>
                  <h4 className="text-base font-black text-white font-display">
                    5-Day Blood Pact (1.5x XP)
                  </h4>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 font-mono-num text-xs font-black">
                1.5x Buff
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Bind your fate with a squad partner for 5 days. Both partners earn a <strong className="text-emerald-300">1.5x XP multiplier</strong> on all study blocks, but <strong className="text-white">both must log at least 2 hours (120 mins) daily</strong>.
            </p>

            <div className="p-3 rounded-xl bg-black/60 border border-rose-500/30 text-[11px] text-slate-300 space-y-1">
              <div className="font-bold text-rose-300">Failure &amp; Gulag Protocol:</div>
              <p>
                If either partner misses their 120m daily quota before midnight: the 1.5x multiplier breaks, <strong className="text-rose-300">both lose 100 XP</strong>, and both avatars enter the <strong className="text-white">Gulag State</strong> (cracked/grayscale badge) until a 45-minute penance session is cleared.
              </p>
            </div>

            {!myActivePact ? (
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Select Partner for 5-Day Blood Pact
                </label>
                <select
                  value={selectedPactPartnerId}
                  onChange={(e) => setSelectedPactPartnerId(e.target.value)}
                  disabled={isBlackoutActive}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-xs text-white focus:outline-none focus:border-rose-400"
                >
                  <option value="">Choose Squad Partner...</option>
                  {rivals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.institute})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isBlackoutActive || !currentUser || !selectedPactPartnerId}
                  title={
                    isBlackoutActive
                      ? 'No new Hostage Links can be created or broken on Friday Blackout.'
                      : 'Send 5-Day Blood Pact Invitation'
                  }
                  onClick={() => selectedPactPartnerId && onSendHostagePactInvite(selectedPactPartnerId)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                    isBlackoutActive || !currentUser || !selectedPactPartnerId
                      ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white cursor-pointer shadow-lg shadow-rose-500/25'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>
                    {isBlackoutActive
                      ? 'Pact Creation Locked (Friday Blackout)'
                      : 'Send 5-Day Blood Pact Invite'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-black/60 border border-rose-400/40 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    {myActivePact.partnerAName || myActivePact.memberAName} &amp;{' '}
                    {myActivePact.partnerBName || myActivePact.memberBName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                    {myActivePact.status === 'active'
                      ? `Day ${myActivePact.daysCompleted + 1} / ${myActivePact.targetDays || myActivePact.totalDays || 5} (1.5x Active)`
                      : 'Pending Partner Acceptance'}
                  </span>
                </div>

                {myActivePact.status === 'pending' &&
                  (myActivePact.partnerBId || myActivePact.memberBId) === currentUser?.id && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBlackoutActive}
                        onClick={() => onAcceptHostagePact(myActivePact.id)}
                        className="flex-1 py-2 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        Accept Blood Pact
                      </button>
                      <button
                        type="button"
                        disabled={isBlackoutActive}
                        onClick={() => onDeclineOrBreakHostagePact(myActivePact.id, false)}
                        className="px-3 py-2 rounded-xl bg-white/10 text-slate-300 font-bold text-xs cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-black/50 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-white font-display">
                Active Soul-Bound Blood Pacts ({hostagePacts.length})
              </h4>
              <span className="text-[10px] font-mono-num text-slate-400">
                Daily Threshold: 120 mins (2h) per partner
              </span>
            </div>

            {hostagePacts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No Blood Pacts forged yet. Pair up with a squadmate to unlock the 1.5x XP multiplier!
              </div>
            ) : (
              <div className="space-y-3">
                {hostagePacts.map((pact) => {
                  const idA = pact.partnerAId || pact.memberAId;
                  const idB = pact.partnerBId || pact.memberBId;
                  const nameA = pact.partnerAName || pact.memberAName || 'Partner A';
                  const nameB = pact.partnerBName || pact.memberBName || 'Partner B';
                  const totalDays = pact.targetDays || pact.totalDays || 5;
                  const pA = safePlayers.find(p => p.id === idA);
                  const pB = safePlayers.find(p => p.id === idB);
                  const minsA = pA?.todayStudyMins || 0;
                  const minsB = pB?.todayStudyMins || 0;
                  const quotaMins = pact.dailyMinMinutes || 120;

                  return (
                    <div
                      key={pact.id}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-extrabold text-white flex items-center gap-2">
                          <span>{nameA}</span>
                          <LinkIcon className="w-3.5 h-3.5 text-rose-400" />
                          <span>{nameB}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            pact.status === 'active'
                              ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300'
                              : pact.status === 'broken' || pact.status === 'broken_gulag'
                              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                              : 'bg-amber-500/15 border border-amber-400/40 text-amber-300'
                          }`}
                        >
                          {pact.status === 'active'
                            ? `1.5x Active • Day ${pact.daysCompleted + 1}/${totalDays}`
                            : pact.status === 'broken' || pact.status === 'broken_gulag'
                            ? 'PACT BROKEN (-100 XP & GULAG)'
                            : 'Invite Pending'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-300">{nameA} Today</span>
                            <span className="font-mono-num font-bold text-white">
                              {minsA} / {quotaMins}m
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                minsA >= quotaMins ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.round((minsA / quotaMins) * 100))}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-300">{nameB} Today</span>
                            <span className="font-mono-num font-bold text-white">
                              {minsB} / {quotaMins}m
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                minsB >= quotaMins ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                              style={{ width: `${Math.min(100, Math.round((minsB / quotaMins) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {pact.brokenReason && (
                        <div className="text-[11px] text-rose-300 font-medium">
                          {pact.brokenReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
