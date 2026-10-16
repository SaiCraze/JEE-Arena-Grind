import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Clock, CheckSquare, BarChart3, Bell, Plus, Play, Pause,
  Check, X, AlertTriangle, Flame, BookOpen, ExternalLink,
  Trash2, Lock, LogOut, Sparkles, Eye, EyeOff, Zap, RefreshCw,
  Crown, CheckCircle2, User as UserIcon, Target, Award, Shield,
  Calendar, Send, MessageSquare, Swords,
  Volume2, VolumeX, Coffee, Gift, Package, Sliders
} from 'lucide-react';
import { StudyLogSuccessAnimation } from './components/StudyLogSuccessAnimation';
import { ArenaOvertakeModal } from './components/ArenaOvertakeModal';
import { RaidBossDragonSvg, BossEntranceModal } from './components/RaidBossDragonSvg';
import { ArenaGuideModal } from './components/ArenaGuideModal';
import {
  playLogSuccess,
  playCritHit,
  playLootOpen,
  playNudgeBuzzer,
  playBossEntrance,
  isAudioMuted,
  setAudioMuted
} from './utils/audio';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, appId, initFirebaseAuth, handleFirestoreError, OperationType } from './firebase';
import {
  sendWebPushNotification,
  getNotificationPermission,
  isWebPushEnabledByUser
} from './utils/notifications';
import { compressImageFile, compressDataUrl } from './utils/image';
import {
  requestScreenWakeLock,
  releaseScreenWakeLock,
  startLockScreenPresence,
  updateLockScreenTime,
  stopLockScreenPresence,
  createBackgroundWorker,
  checkAndSendTimerMilestoneNotification,
  resetTimerMilestones
} from './utils/timerEngine';

const ADMIN_PASSCODE = '0717';
// Monday, October 19, 2026 at 00:00:00 IST
const RAID_LAUNCH_EPOCH_MS = new Date('2026-10-19T00:00:00+05:30').getTime();

interface Member {
  id: string;
  name: string;
  institute: string;
  passcode: string;
  bonusXp: number;
  manualMinutesOffset: number;
  isGrinding: boolean;
  grindingSubject: string;
  grindingStartedAt: number | null;
  grindingAccumulatedSeconds?: number;
  grindingLinkedTaskId?: string;
  unexcusedZero?: boolean;
  unexcusedReason?: string;
  unexcusedAt?: number | null;
  streakCount?: number;
  lastLoginDate?: string | null;
  restTokens?: number;
  lastRestTokenWeek?: string | null;
  activeRestDayDate?: string | null;
  unlockedTitles?: string[];
  equippedTitle?: string;
  stealthPerkActiveUntil?: number | null;
  deferredExamDebt?: boolean;
}

interface RaidBoss {
  id: string;
  name: string;
  subtitle?: string;
  totalHp: number;
  currentHp: number;
  weekStart: string;
  isDefeated: boolean;
  defeatedAt?: number | null;
  contributions: { [memberId: string]: number };
  enabled?: boolean;
  manualOverrideActive?: boolean;
  standbyMode?: boolean;
  lastWeekFailedPenaltyActive?: boolean;
  unveilTimestamp?: number;
}

interface LootCrateReward {
  type: 'xp' | 'title' | 'stealth_perk';
  value: string | number;
  titleName?: string;
  description: string;
}

const UNIVERSAL_RAID_BOSSES = [
  {
    id: 'backlog_leviathan',
    name: 'The Backlog Leviathan',
    subtitle: 'Universal JEE Co-op Dragon. Feeds on unfinished chapters and pending DPPs.',
    totalHp: 10000
  },
  {
    id: 'procrastination_demon',
    name: 'The Procrastination Demon',
    subtitle: 'Universal JEE Co-op Dragon. Feeds on delayed study sessions and distractions.',
    totalHp: 10000
  },
  {
    id: 'silly_mistake_specter',
    name: 'The Silly Mistake Specter',
    subtitle: 'Universal JEE Co-op Dragon. Feeds on calculation traps and sign errors.',
    totalHp: 12000
  },
  {
    id: 'sleep_deprivation_phantom',
    name: 'The Burnout & Fatigue Phantom',
    subtitle: 'Universal JEE Co-op Dragon. Feeds on late-night slumps and brain fog.',
    totalHp: 9500
  },
  {
    id: 'formula_amnesia_golem',
    name: 'The Formula Amnesia Golem',
    subtitle: 'Universal JEE Co-op Dragon. Feeds on unrevised notes and forgotten identities.',
    totalHp: 11000
  }
];

const RARE_LOOT_TITLES = [
  'The Speed Demon',
  'Quantum Solver',
  'Allen / Modulus Crusher',
  'Leviathan Slayer',
  'Irodov Conqueror',
  'Rank 1 Vanguard',
  'Iron Will Grinder'
];

const DEFAULT_RAID_BOSS: RaidBoss = {
  id: 'backlog_leviathan',
  name: 'The Backlog Leviathan',
  subtitle: 'Universal JEE Co-op Dragon. Feeds on unfinished chapters and pending DPPs.',
  totalHp: 10000,
  currentHp: 10000,
  weekStart: '2026-10-19',
  isDefeated: false,
  contributions: { sai: 0, nishchit: 0, ved: 0 },
  enabled: true,
  manualOverrideActive: false,
  standbyMode: true,
  lastWeekFailedPenaltyActive: false,
  unveilTimestamp: 0
};

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'student' | 'admin';
  recipientId: 'ALL' | string;
  recipientName: string;
  text: string;
  timestamp: number;
}

const getStreakMultiplier = (streakCount = 0): number => {
  if (streakCount >= 365) return 5.0;
  if (streakCount >= 180) return 4.0;
  if (streakCount >= 90) return 3.0;
  if (streakCount >= 30) return 2.0;
  if (streakCount >= 14) return 1.5;
  if (streakCount >= 10) return 1.25;
  if (streakCount >= 7) return 1.15;
  if (streakCount >= 3) return 1.05;
  return 1.0;
};

const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'sai',
    name: 'Sai',
    institute: 'Modulus',
    passcode: '1111',
    bonusXp: 0,
    manualMinutesOffset: 0,
    isGrinding: false,
    grindingSubject: '',
    grindingStartedAt: null,
    unexcusedZero: false,
    unexcusedReason: '',
    unexcusedAt: null,
    restTokens: 1,
    unlockedTitles: [],
    equippedTitle: '',
    deferredExamDebt: false
  },
  {
    id: 'nishchit',
    name: 'Nishchit',
    institute: 'Modulus',
    passcode: '2222',
    bonusXp: 0,
    manualMinutesOffset: 0,
    isGrinding: false,
    grindingSubject: '',
    grindingStartedAt: null,
    unexcusedZero: false,
    unexcusedReason: '',
    unexcusedAt: null,
    restTokens: 1,
    unlockedTitles: [],
    equippedTitle: '',
    deferredExamDebt: false
  },
  {
    id: 'ved',
    name: 'Ved',
    institute: 'Allen',
    passcode: '3333',
    bonusXp: 0,
    manualMinutesOffset: 0,
    isGrinding: false,
    grindingSubject: '',
    grindingStartedAt: null,
    unexcusedZero: false,
    unexcusedReason: '',
    unexcusedAt: null,
    restTokens: 1,
    unlockedTitles: [],
    equippedTitle: '',
    deferredExamDebt: false
  }
];

const SUBJECT_OPTIONS = [
  { id: 'Math', label: 'Mathematics', short: 'Math' },
  { id: 'Physics', label: 'Physics', short: 'Physics' },
  { id: 'Chemistry', label: 'Chemistry', short: 'Chem' },
  { id: 'English', label: 'English', short: 'Eng' },
  { id: 'LR', label: 'Logical Reasoning', short: 'LR' },
  { id: 'General', label: 'General / Mock', short: 'Gen' }
];

interface ExamTemplateSubject {
  name: string;
  maxMarks: number;
  enabled: boolean;
}

const EXAM_TEMPLATES: Record<string, { totalMax: number; subjects: ExamTemplateSubject[] }> = {
  'JEE Mains': {
    totalMax: 300,
    subjects: [
      { name: 'Physics', maxMarks: 100, enabled: true },
      { name: 'Chemistry', maxMarks: 100, enabled: true },
      { name: 'Math', maxMarks: 100, enabled: true }
    ]
  },
  'JEE Advanced Paper 1': {
    totalMax: 180,
    subjects: [
      { name: 'Physics', maxMarks: 60, enabled: true },
      { name: 'Chemistry', maxMarks: 60, enabled: true },
      { name: 'Math', maxMarks: 60, enabled: true }
    ]
  },
  'JEE Advanced Paper 2': {
    totalMax: 180,
    subjects: [
      { name: 'Physics', maxMarks: 60, enabled: true },
      { name: 'Chemistry', maxMarks: 60, enabled: true },
      { name: 'Math', maxMarks: 60, enabled: true }
    ]
  },
  'BITSAT': {
    totalMax: 390,
    subjects: [
      { name: 'Physics', maxMarks: 90, enabled: true },
      { name: 'Chemistry', maxMarks: 90, enabled: true },
      { name: 'Math', maxMarks: 120, enabled: true },
      { name: 'English', maxMarks: 30, enabled: true },
      { name: 'LR', maxMarks: 60, enabled: true }
    ]
  }
};

const DIFFICULTY_TIERS = [
  { id: 'easy', label: 'Easy / Drill', mult: 0.8, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', desc: '0.8x XP' },
  { id: 'mains', label: 'Mains / Medium', mult: 1.2, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', desc: '1.2x XP' },
  { id: 'hard', label: 'Hard Drill', mult: 1.8, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', desc: '1.8x XP' },
  { id: 'adv', label: 'JEE Advanced', mult: 2.5, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', desc: '2.5x XP' }
];

function getStartOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function calcPercentile(rank: number | string, totalStudents: number | string) {
  const r = Number(rank);
  const t = Number(totalStudents);
  if (!r || !t || t <= 0 || r <= 0) return 0;
  if (r > t) return 0;
  if (t === 1) return 100;
  return Math.max(0, Math.min(100, (1 - (r - 1) / t) * 100));
}

function calcSessionXp(
  durationMins: number | string,
  questionsOrBreakdown: number | string | { [key: string]: number | string } = 0,
  difficulty = 'mains',
  sessionType = 'STUDY'
) {
  if (sessionType !== 'STUDY') return 0;
  const mins = Math.max(0, Number(durationMins) || 0);
  const timeXp = Math.round((mins / 30) * 10);

  let rawQXp = 0;
  let totalQuestionsCount = 0;

  if (typeof questionsOrBreakdown === 'object' && questionsOrBreakdown !== null) {
    for (const [tierId, val] of Object.entries(questionsOrBreakdown)) {
      const count = Math.max(0, Number(val) || 0);
      totalQuestionsCount += count;
      const tierObj = DIFFICULTY_TIERS.find(d => d.id === tierId) || DIFFICULTY_TIERS[1];
      rawQXp += count * tierObj.mult;
    }
  } else {
    totalQuestionsCount = Math.max(0, Number(questionsOrBreakdown) || 0);
    const tier = DIFFICULTY_TIERS.find(d => d.id === difficulty) || DIFFICULTY_TIERS[1];
    rawQXp = totalQuestionsCount * tier.mult;
  }

  const maxAllowedQXp = Math.max(25, Math.round((mins / 60) * 60) + 25);
  const cappedQXp = Math.min(Math.round(rawQXp), maxAllowedQXp);
  return timeXp + cappedQXp;
}

function formatDuration(mins: number | string) {
  const m = Math.round(Number(mins) || 0);
  if (m <= 0) return '0m';
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  if (hrs === 0) return `${rem}m`;
  if (rem === 0) return `${hrs}h`;
  return `${hrs}h ${rem}m`;
}

function timeAgo(timestamp: number | null | undefined) {
  if (!timestamp) return 'Just now';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function App() {
  // Auth & Role State
  const [activeMemberId, setActiveMemberId] = useState<string | null>(() => {
    return localStorage.getItem('jee_arena_active_id') || null;
  });
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('jee_arena_admin') === 'true';
  });
  const [loginTarget, setLoginTarget] = useState<string>('sai');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [loginVaultCategory, setLoginVaultCategory] = useState<'students' | 'admin'>('students');

  // Top Nav Profile Menu & Guide Modal
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<'arena' | 'timer' | 'tasks' | 'stats' | 'admin'>('arena');
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showExamModal, setShowExamModal] = useState<boolean>(false);
  const [showPersonalTaskModal, setShowPersonalTaskModal] = useState<boolean>(false);

  // Real-time Firestore Data
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Toast & Realtime Refs
  const [toast, setToast] = useState<{ title: string; detail?: string; type?: 'info' | 'error' } | null>(null);
  const lastActivityIdRef = useRef<string | null>(null);
  const lastUnveilTimestampRef = useRef<number | null>(null);

  // Gamification & Dragon Raid Boss State
  const [raidBoss, setRaidBoss] = useState<RaidBoss>(DEFAULT_RAID_BOSS);
  const [dragonHurtState, setDragonHurtState] = useState<{ active: boolean; dmg: number | null }>({ active: false, dmg: null });
  const [showBossEntranceModal, setShowBossEntranceModal] = useState<boolean>(false);
  const [adminCustomMaxHp, setAdminCustomMaxHp] = useState<string>('10000');
  const [adminCustomCurrentHp, setAdminCustomCurrentHp] = useState<string>('10000');

  const [isMutedState, setIsMutedState] = useState<boolean>(() => isAudioMuted());
  const [pendingLootCrate, setPendingLootCrate] = useState<{ sessionId: string; durationMins: number; memberId: string } | null>(null);
  const [isLootCrateOpening, setIsLootCrateOpening] = useState<boolean>(false);
  const [unlockedLootReward, setUnlockedLootReward] = useState<LootCrateReward | null>(null);
  const [showPerksModal, setShowPerksModal] = useState<boolean>(false);
  const [lastNudgeTimes, setLastNudgeTimes] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('jee_arena_nudge_times') || '{}');
    } catch {
      return {};
    }
  });

  // Leaderboard Blind Mode & Reveal
  const [arenaSettings, setArenaSettings] = useState<{
    leaderboardHidden: boolean;
    revealTimestamp: number;
    hiddenAt: number | null;
  }>({
    leaderboardHidden: false,
    revealTimestamp: 0,
    hiddenAt: null
  });
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const lastRevealTimestampRef = useRef<number | null>(null);

  // Live Stopwatch State
  const [timerRunning, setTimerRunning] = useState<boolean>(() => {
    return localStorage.getItem('jee_arena_timer_running') === 'true';
  });
  const [timerStartTime, setTimerStartTime] = useState<number | null>(() => {
    const val = localStorage.getItem('jee_arena_timer_start_time');
    return val ? Number(val) : null;
  });
  const [timerAccumulatedSeconds, setTimerAccumulatedSeconds] = useState<number>(() => {
    const val = localStorage.getItem('jee_arena_timer_accumulated_secs');
    return val ? Number(val) : 0;
  });
  const [timerSubject, setTimerSubject] = useState<string>(() => {
    return localStorage.getItem('jee_arena_timer_subject') || 'Physics';
  });
  const [timerLinkedTaskId, setTimerLinkedTaskId] = useState<string>(() => {
    return localStorage.getItem('jee_arena_timer_linked_task_id') || '';
  });
  const [timerStartedAtStr, setTimerStartedAtStr] = useState<string>(() => {
    return localStorage.getItem('jee_arena_timer_started_at_str') || '';
  });
  const [keepScreenAwake] = useState<boolean>(() => {
    return localStorage.getItem('jee_arena_timer_keep_awake') !== 'false';
  });

  const calculateCurrentTimerSeconds = (
    running: boolean,
    startTime: number | null,
    accumulated: number
  ): number => {
    if (!running || !startTime) return accumulated;
    const elapsedSinceStart = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    return accumulated + elapsedSinceStart;
  };

  const [timerSeconds, setTimerSeconds] = useState<number>(() => {
    const running = localStorage.getItem('jee_arena_timer_running') === 'true';
    const startTime = Number(localStorage.getItem('jee_arena_timer_start_time')) || null;
    const accumulated = Number(localStorage.getItem('jee_arena_timer_accumulated_secs')) || 0;
    return calculateCurrentTimerSeconds(running, startTime, accumulated);
  });

  // Session Logger Modal State
  const todayStr = new Date().toISOString().split('T')[0];
  const [logSessionType, setLogSessionType] = useState<'STUDY' | 'BREAK'>('STUDY');
  const [logSubject, setLogSubject] = useState<string>('Math');
  const [logDate, setLogDate] = useState<string>(todayStr);
  const [logDuration, setLogDuration] = useState<string>('60');
  const [logDifficulty] = useState<string>('mains');
  const [logQuestionsByTier, setLogQuestionsByTier] = useState<{ [tier: string]: string }>({
    easy: '',
    mains: '',
    hard: '',
    adv: ''
  });
  const [logLinkedTaskIds, setLogLinkedTaskIds] = useState<string[]>([]);
  const [logNotes, setLogNotes] = useState<string>('');
  const [logTargetMember, setLogTargetMember] = useState<string>('');

  const totalLogQuestions = useMemo(() => {
    return Object.values(logQuestionsByTier).reduce((acc, val) => acc + (Math.max(0, parseInt(val, 10) || 0)), 0);
  }, [logQuestionsByTier]);

  // Personal Task Modal & Filter State
  const [myTaskTitle, setMyTaskTitle] = useState<string>('');
  const [myTaskSubject, setMyTaskSubject] = useState<string>('Physics');
  const [myTaskNotes, setMyTaskNotes] = useState<string>('');
  const [taskFilterTab, setTaskFilterTab] = useState<'ACTIVE' | 'COMPLETED' | 'ALL'>('ACTIVE');

  // Exam Logger State
  const [examMemberId, setExamMemberId] = useState<string>('');
  const [examType, setExamType] = useState<string>('JEE Mains');
  const [examTitle, setExamTitle] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(todayStr);
  const [examTotalStudents, setExamTotalStudents] = useState<string>('');
  const [examMarks, setExamMarks] = useState<string>('');
  const [examMaxMarks, setExamMaxMarks] = useState<string>('300');
  const [examRank, setExamRank] = useState<string>('');
  const [examSubjects] = useState<any[]>(
    EXAM_TEMPLATES['JEE Mains'].subjects.map(s => ({ ...s, marks: '', rank: '' }))
  );

  // Squad Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [chatActiveChannel] = useState<'ALL' | string>('ALL');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [chatLastReadTimestamp, setChatLastReadTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem('jee_arena_chat_last_read')) || 0;
  });

  // Admin Adjustments
  const [quickAdjustMemberId, setQuickAdjustMemberId] = useState<string>('sai');
  const [quickXpDelta, setQuickXpDelta] = useState<string>('');
  const [quickTimeDelta, setQuickTimeDelta] = useState<string>('');
  const [quickAdjustReason, setQuickAdjustReason] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');

  const [studyLogSuccessData, setStudyLogSuccessData] = useState<{
    memberName: string;
    xpEarned: number;
    durationMins: number;
    totalQCount: number;
    tasksCount?: number;
    streakCount?: number;
  } | null>(null);

  const [arenaOvertakeData, setArenaOvertakeData] = useState<{
    challengerName: string;
    rivalName: string;
    oldRank: number;
    newRank: number;
    differenceXp: number;
  } | null>(null);

  useEffect(() => {
    initFirebaseAuth();
  }, []);

  // Determine whether the Raid Boss is currently active:
  // 1. If Admin explicitly disabled the boss (`enabled === false`), it is OFF and hidden.
  // 2. If Admin enabled `manualOverrideActive`, it is LIVE immediately.
  // 3. Otherwise, it activates starting Monday, October 19, 2026 at 12:00 AM and runs Monday 12:00 AM through Sunday 6:00 PM (18:00).
  const isRaidActiveNow = useMemo(() => {
    if (raidBoss.enabled === false) return false;
    if (raidBoss.manualOverrideActive) return true;
    const now = Date.now();
    if (now < RAID_LAUNCH_EPOCH_MS) return false;
    const d = new Date(now);
    const day = d.getDay(); // 0 = Sunday
    const hr = d.getHours();
    // Active from Monday 00:00 until Sunday 18:00 (6:00 PM)
    if (day === 0 && hr >= 18) return false;
    return !raidBoss.standbyMode;
  }, [raidBoss]);

  const toggleAudioMute = () => {
    const next = !isMutedState;
    setIsMutedState(next);
    setAudioMuted(next);
  };

  const triggerDragonDamageAnimation = (dmgAmount: number) => {
    setDragonHurtState({ active: true, dmg: dmgAmount });
    playCritHit();
    setTimeout(() => {
      setDragonHurtState({ active: false, dmg: null });
    }, 1500);
  };

  // Physical Keyboard Listener for PIN Screen
  useEffect(() => {
    if (activeMemberId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setPinInput(prev => {
          const next = (prev + e.key).slice(0, 4);
          if (next.length === 4) {
            setTimeout(() => verifyPinCode(next, loginTarget), 100);
          }
          return next;
        });
      } else if (e.key === 'Backspace') {
        setPinInput(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPinInput('');
        setLoginError('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMemberId, loginTarget, members]);

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    const basePath = `artifacts/${appId}/public/data`;
    const membersCol = collection(db, basePath, 'members');
    const sessionsCol = collection(db, basePath, 'sessions');
    const examsCol = collection(db, basePath, 'exams');
    const tasksCol = collection(db, basePath, 'tasks');
    const announcementsCol = collection(db, basePath, 'announcements');
    const activitiesCol = collection(db, basePath, 'activities');
    const settingsDocRef = doc(db, basePath, 'settings', 'arenaState');

    const unsubSettings = onSnapshot(
      settingsDocRef,
      (snap) => {
        setIsConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          setArenaSettings({
            leaderboardHidden: Boolean(data.leaderboardHidden),
            revealTimestamp: Number(data.revealTimestamp) || 0,
            hiddenAt: data.hiddenAt || null
          });
          if (
            data.revealTimestamp &&
            lastRevealTimestampRef.current !== null &&
            data.revealTimestamp !== lastRevealTimestampRef.current &&
            Date.now() - data.revealTimestamp < 30000
          ) {
            setIsRevealing(true);
          }
          lastRevealTimestampRef.current = data.revealTimestamp || 0;
        }
      },
      (err) => {
        setIsConnected(false);
        handleFirestoreError(err, OperationType.GET, `${basePath}/settings/arenaState`);
      }
    );

    const unsubMembers = onSnapshot(
      membersCol,
      async (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Member));
        if (list.length === 0) {
          for (const m of DEFAULT_MEMBERS) {
            try {
              await setDoc(doc(db, basePath, 'members', m.id), m);
            } catch {}
          }
        } else {
          setMembers(list);
          const currentWeekIso = new Date(getStartOfCurrentWeek()).toISOString().split('T')[0];
          for (const m of list) {
            if (m.lastRestTokenWeek !== currentWeekIso) {
              updateDoc(doc(db, basePath, 'members', m.id), {
                restTokens: 1,
                lastRestTokenWeek: currentWeekIso
              }).catch(() => {});
            }
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${basePath}/members`)
    );

    const unsubSessions = onSnapshot(sessionsCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setSessions(list);
    });

    const unsubExams = onSnapshot(examsCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setExams(list);
    });

    const unsubTasks = onSnapshot(tasksCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      setTasks(list);
    });

    const unsubAnnouncements = onSnapshot(announcementsCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setAnnouncements(list);
    });

    const unsubActivities = onSnapshot(activitiesCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setActivities(list);
      if (list.length > 0) {
        const newest: any = list[0];
        if (
          lastActivityIdRef.current &&
          lastActivityIdRef.current !== newest.id &&
          Date.now() - (newest.timestamp || 0) < 30000
        ) {
          const currentId = localStorage.getItem('jee_arena_active_id');
          if (newest.type === 'nudge' && newest.memberId === currentId) {
            playNudgeBuzzer();
          }
          setToast({
            title: newest.title,
            detail: newest.detail,
            type: newest.type === 'penalty' ? 'error' : 'info'
          });
          sendWebPushNotification(newest.title, {
            body: newest.detail || newest.title,
            tag: 'act-' + newest.id
          });
          setTimeout(() => setToast(null), 4200);
        }
        lastActivityIdRef.current = newest.id;
      }
    });

    const messagesCol = collection(db, basePath, 'messages');
    const unsubMessages = onSnapshot(messagesCol, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
      list.sort((a, b) => a.timestamp - b.timestamp);
      setChatMessages(list);
    });

    const raidBossDocRef = doc(db, basePath, 'settings', 'raidBoss');
    const unsubRaidBoss = onSnapshot(raidBossDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RaidBoss;
        const normalized: RaidBoss = {
          ...DEFAULT_RAID_BOSS,
          ...data,
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : true
        };
        setRaidBoss(normalized);
        setAdminCustomMaxHp(String(normalized.totalHp || 10000));
        setAdminCustomCurrentHp(String(normalized.currentHp ?? 10000));

        // Trigger Dragon Boss Entrance Unveil Modal when a new unveilTimestamp arrives
        if (
          normalized.unveilTimestamp &&
          lastUnveilTimestampRef.current !== null &&
          normalized.unveilTimestamp !== lastUnveilTimestampRef.current &&
          Date.now() - normalized.unveilTimestamp < 30000
        ) {
          playBossEntrance();
          setShowBossEntranceModal(true);
        }
        lastUnveilTimestampRef.current = normalized.unveilTimestamp || 0;
      } else {
        setDoc(raidBossDocRef, DEFAULT_RAID_BOSS).catch(() => {});
      }
    });

    return () => {
      unsubSettings();
      unsubMembers();
      unsubSessions();
      unsubExams();
      unsubTasks();
      unsubAnnouncements();
      unsubActivities();
      unsubMessages();
      unsubRaidBoss();
    };
  }, []);

  // Automatic Monday Oct 19 Launch & Sunday 6:00 PM Deadline Watcher
  useEffect(() => {
    const checkRaidWindow = async () => {
      const now = Date.now();
      if (now < RAID_LAUNCH_EPOCH_MS) return;

      const d = new Date(now);
      const day = d.getDay(); // 1 = Monday, 0 = Sunday
      const hrs = d.getHours();
      const basePath = `artifacts/${appId}/public/data`;
      const raidRef = doc(db, basePath, 'settings', 'raidBoss');
      const currentWeekIso = new Date(getStartOfCurrentWeek()).toISOString().split('T')[0];

      // Auto-launch on Monday morning (from Oct 19 onwards)
      if (day === 1 && raidBoss.enabled !== false && (raidBoss.standbyMode || raidBoss.weekStart !== currentWeekIso)) {
        const nextBoss = UNIVERSAL_RAID_BOSSES[Math.floor(Math.random() * UNIVERSAL_RAID_BOSSES.length)];
        await setDoc(raidRef, {
          ...raidBoss,
          id: nextBoss.id,
          name: nextBoss.name,
          subtitle: nextBoss.subtitle,
          totalHp: nextBoss.totalHp,
          currentHp: nextBoss.totalHp,
          weekStart: currentWeekIso,
          isDefeated: false,
          defeatedAt: null,
          contributions: { sai: 0, nishchit: 0, ved: 0 },
          standbyMode: false,
          unveilTimestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }

      // Sunday 6:00 PM (18:00) Deadline Evaluation
      if (day === 0 && hrs >= 18 && isRaidActiveNow && !raidBoss.isDefeated && !raidBoss.lastWeekFailedPenaltyActive) {
        if ((raidBoss.currentHp || 0) > 0) {
          await handleTriggerRaidFailureEvaluation(true);
        }
      }
    };

    const timer = setInterval(checkRaidWindow, 30000);
    return () => clearInterval(timer);
  }, [raidBoss, isRaidActiveNow]);

  const notify = (title: string, detail = '', type: 'info' | 'error' = 'info') => {
    setToast({ title, detail, type });
    setTimeout(() => setToast(null), 4000);
  };

  const pushActivity = async (type: string, title: string, detail: string, memberId = '', xpDelta = 0) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await addDoc(collection(db, basePath, 'activities'), {
        type,
        title,
        detail,
        memberId,
        xpDelta,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Activity log error:', e);
    }
  };

  // Admin Raid Controls: Toggle Boss Enabled ON/OFF, Early Override, Select Boss, Custom HP
  const handleAdminToggleBossEnabled = async () => {
    const basePath = `artifacts/${appId}/public/data`;
    const nextEnabled = raidBoss.enabled === false ? true : false;
    try {
      await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
        ...raidBoss,
        enabled: nextEnabled
      }, { merge: true });
      notify(
        nextEnabled ? 'Raid Boss System Enabled' : 'Raid Boss Hidden & Disabled',
        nextEnabled ? 'Boss system is active.' : 'The Raid Boss card is now hidden from the Arena.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${basePath}/settings/raidBoss`);
    }
  };

  const handleToggleRaidAdminOverride = async () => {
    const basePath = `artifacts/${appId}/public/data`;
    const nextOverride = !raidBoss.manualOverrideActive;
    try {
      await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
        ...raidBoss,
        enabled: true,
        manualOverrideActive: nextOverride,
        standbyMode: !nextOverride,
        ...(nextOverride ? { unveilTimestamp: Date.now() } : {})
      }, { merge: true });
      notify(
        nextOverride ? 'Raid Boss Live in Arena' : 'Returned to Oct 19 Standby',
        nextOverride ? 'Unveiling Dragon Boss now.' : 'Boss hidden until Monday, October 19 launch.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${basePath}/settings/raidBoss`);
    }
  };

  const handleSwitchRaidBossTemplate = async (bossTemplateId: string) => {
    const tpl = UNIVERSAL_RAID_BOSSES.find(b => b.id === bossTemplateId);
    if (!tpl) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
        ...raidBoss,
        id: tpl.id,
        name: tpl.name,
        subtitle: tpl.subtitle,
        totalHp: tpl.totalHp,
        currentHp: tpl.totalHp,
        isDefeated: false,
        defeatedAt: null,
        contributions: { sai: 0, nishchit: 0, ved: 0 },
        unveilTimestamp: Date.now()
      }, { merge: true });
      setAdminCustomMaxHp(String(tpl.totalHp));
      setAdminCustomCurrentHp(String(tpl.totalHp));
      notify('New Dragon Boss Unveiled', `Switched to "${tpl.name}" (${tpl.totalHp.toLocaleString()} HP).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${basePath}/settings/raidBoss`);
    }
  };

  const handleAdminSaveCustomBossHp = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxHp = Math.max(100, Number(adminCustomMaxHp) || 10000);
    const curHp = Math.max(0, Math.min(maxHp, Number(adminCustomCurrentHp) || 0));
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
        ...raidBoss,
        totalHp: maxHp,
        currentHp: curHp,
        isDefeated: curHp === 0
      }, { merge: true });
      if (curHp < raidBoss.currentHp) {
        triggerDragonDamageAnimation(raidBoss.currentHp - curHp);
      }
      notify('Boss HP Updated', `Set HP to ${curHp.toLocaleString()} / ${maxHp.toLocaleString()}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${basePath}/settings/raidBoss`);
    }
  };

  const handleTriggerRaidFailureEvaluation = async (failed: boolean) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
        ...raidBoss,
        lastWeekFailedPenaltyActive: failed
      }, { merge: true });

      if (failed) {
        const weekStart = getStartOfCurrentWeek();
        const vedExamsThisWeek = exams.filter(e => e.memberId === 'ved' && (e.timestamp || 0) >= weekStart);
        if (vedExamsThisWeek.length === 0) {
          await updateDoc(doc(db, basePath, 'members', 'ved'), {
            deferredExamDebt: true
          });
        }
        await pushActivity(
          'penalty',
          'Method 1 Raid Penalty Active: Exam XP Pool Capped at 150 XP',
          `Squad did not defeat ${raidBoss.name} by Sunday 6:00 PM. Ved's alternating Allen schedule penalty carries over to his next test week.`,
          'admin',
          0
        );
        notify('Raid Penalty Active', 'Exam pool capped at 150 XP. Ved deferred debt synced.');
      } else {
        await updateDoc(doc(db, basePath, 'members', 'ved'), {
          deferredExamDebt: false
        });
        notify('Raid Penalty Cleared', 'Full 300 XP Exam Pool restored.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${basePath}/settings/raidBoss`);
    }
  };

  // Timestamp-based Stopwatch Sync
  useEffect(() => {
    const syncTimer = () => {
      if (timerRunning && timerStartTime) {
        const current = calculateCurrentTimerSeconds(timerRunning, timerStartTime, timerAccumulatedSeconds);
        setTimerSeconds(current);
        updateLockScreenTime(current, timerSubject);
        checkAndSendTimerMilestoneNotification(current, timerSubject);

        const hrs = String(Math.floor(current / 3600)).padStart(2, '0');
        const mins = String(Math.floor((current % 3600) / 60)).padStart(2, '0');
        const secs = String(current % 60).padStart(2, '0');
        document.title = `(${hrs}:${mins}:${secs}) ${timerSubject} | JEE Grind Arena`;
      } else {
        document.title = 'JEE Grind Arena';
      }
    };

    syncTimer();
    let interval: ReturnType<typeof setInterval> | null = null;
    let stopWorker: (() => void) | null = null;

    if (timerRunning) {
      interval = setInterval(syncTimer, 1000);
      stopWorker = createBackgroundWorker(syncTimer);
      startLockScreenPresence(timerSubject, () => {
        toggleLiveTimer();
      });
      if (keepScreenAwake) {
        requestScreenWakeLock();
      }
    } else {
      stopLockScreenPresence();
      releaseScreenWakeLock();
      document.title = 'JEE Grind Arena';
    }

    return () => {
      if (interval) clearInterval(interval);
      if (stopWorker) stopWorker();
    };
  }, [timerRunning, timerStartTime, timerAccumulatedSeconds, timerSubject, keepScreenAwake]);

  const weekStartMs = useMemo(() => getStartOfCurrentWeek(), []);

  const currentMember = useMemo(() => {
    if (!activeMemberId || activeMemberId === 'admin') return null;
    return members.find(m => m.id === activeMemberId) || null;
  }, [members, activeMemberId]);

  // Active, uncompleted, non-deleted tasks available for Focus Stopwatch & Logger
  const availableTimerTasks = useMemo(() => {
    const myId = currentMember?.id || 'sai';
    return tasks.filter((t) => {
      const isCompleted = Boolean(
        t.completed || (t.completions && t.completions[myId]?.status === 'verified')
      );
      if (isCompleted) return false;

      const isMine = t.isPersonal
        ? t.ownerId === myId
        : (!t.assignedTo || t.assignedTo.includes('ALL') || t.assignedTo.includes(myId));

      return isMine;
    });
  }, [tasks, currentMember]);

  // Automatically clear timerLinkedTaskId if the linked task gets completed or deleted
  useEffect(() => {
    if (timerLinkedTaskId) {
      const exists = availableTimerTasks.some(t => t.id === timerLinkedTaskId);
      if (!exists) {
        setTimerLinkedTaskId('');
        localStorage.removeItem('jee_arena_timer_linked_task_id');
      }
    }
  }, [availableTimerTasks, timerLinkedTaskId]);

  // Leaderboard Stats (Clean, zero algorithmic mini-titles, Method 1 Deferred Exam Debt intact)
  const leaderboardStats = useMemo(() => {
    const activeMembers = members.length > 0 ? members : DEFAULT_MEMBERS;

    return activeMembers.map((member) => {
      const memSessions = sessions.filter(s => s.memberId === member.id && s.sessionType !== 'BREAK');
      const weekSessions = memSessions.filter(s => (s.timestamp || 0) >= weekStartMs);

      const manualOffsetMins = Number(member.manualMinutesOffset) || 0;
      const rawTotalMins = memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const rawWeekMins = weekSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);

      const totalStudyMins = Math.max(0, rawTotalMins + manualOffsetMins);
      const weekStudyMins = Math.max(0, rawWeekMins + manualOffsetMins);

      const totalQuestions = memSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
      const weekQuestions = weekSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);

      const offsetXp = Math.round((manualOffsetMins / 30) * 10);
      const studyXpWeek = Math.max(0, weekSessions.reduce((acc, s) => acc + (Number(s.xpEarned) || 0), 0) + offsetXp);
      const studyXpTotal = Math.max(0, memSessions.reduce((acc, s) => acc + (Number(s.xpEarned) || 0), 0) + offsetXp);

      const memExams = exams.filter(e => e.memberId === member.id);
      const weekExams = memExams.filter(e => (e.timestamp || 0) >= weekStartMs);
      const latestExam = memExams[0] || null;

      const isRaidPenaltyForMember = Boolean(raidBoss.lastWeekFailedPenaltyActive) || (member.id === 'ved' && Boolean(member.deferredExamDebt));
      const maxExamXpCap = isRaidPenaltyForMember ? 150 : 300;
      const xpMultiplierPerPercentile = isRaidPenaltyForMember ? 1.5 : 3.0;

      const isUnexcused = Boolean(member.unexcusedZero);

      let weekAvgPercentile = 0;
      let examXpWeek = 0;
      let standingStatus: 'fresh_test' | 'active_standing' | 'unexcused_zero' | 'no_history' = 'no_history';
      let standingDetail = '';

      if (isUnexcused) {
        weekAvgPercentile = 0;
        examXpWeek = 0;
        standingStatus = 'unexcused_zero';
        standingDetail = member.unexcusedReason || 'Unexcused test absence (0 XP)';
      } else if (weekExams.length > 0) {
        const sumPct = weekExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0);
        weekAvgPercentile = sumPct / weekExams.length;
        examXpWeek = Math.min(maxExamXpCap, Math.round(weekAvgPercentile * xpMultiplierPerPercentile));
        standingStatus = 'fresh_test';
        standingDetail = `Tested this week (${weekExams[0]?.title || 'Mock Test'})`;
      } else if (latestExam) {
        weekAvgPercentile = Number(latestExam.overallPercentile) || 0;
        examXpWeek = Math.min(maxExamXpCap, Math.round(weekAvgPercentile * xpMultiplierPerPercentile));
        standingStatus = 'active_standing';
        standingDetail = `Active Standing: ${latestExam.title || 'Previous Exam'}`;
      } else {
        weekAvgPercentile = 0;
        examXpWeek = 0;
        standingStatus = 'no_history';
        standingDetail = 'No exam history yet';
      }

      const allTimeAvgPercentile = memExams.length > 0
        ? memExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) / memExams.length
        : 0;

      const bonusXp = Number(member.bonusXp) || 0;
      const weeklyXp = Math.max(0, studyXpWeek + examXpWeek + bonusXp);
      const totalXp = Math.max(0, studyXpTotal + Math.round(allTimeAvgPercentile * 3) + bonusXp);

      return {
        ...member,
        weekStudyMins,
        totalStudyMins,
        weekQuestions,
        totalQuestions,
        studyXpWeek,
        examXpWeek,
        maxExamXpCap,
        isRaidPenaltyForMember,
        bonusXp,
        weeklyXp,
        totalXp,
        weekAvgPercentile,
        allTimeAvgPercentile,
        latestExam,
        standingStatus,
        standingDetail
      };
    }).sort((a, b) => b.weeklyXp - a.weeklyXp);
  }, [members, sessions, exams, weekStartMs, raidBoss]);

  const verifyPinCode = (codeToVerify: string, target = loginTarget) => {
    setLoginError('');
    if (codeToVerify === ADMIN_PASSCODE) {
      setIsAdminUnlocked(true);
      localStorage.setItem('jee_arena_admin', 'true');
      if (target === 'admin') {
        setActiveMemberId('admin');
        localStorage.setItem('jee_arena_active_id', 'admin');
        setActiveTab('admin');
      } else {
        setActiveMemberId(target);
        localStorage.setItem('jee_arena_active_id', target);
        setLogTargetMember(target);
        setExamMemberId(target);
        setActiveTab('arena');
      }
      setPinInput('');
      return true;
    }

    if (target === 'admin') {
      setLoginError('Invalid Admin Passcode.');
      setPinInput('');
      return false;
    }

    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const targetMem = activeList.find(m => m.id === target);
    if (!targetMem) {
      setLoginError('Profile not found.');
      return false;
    }
    if (codeToVerify === String(targetMem.passcode)) {
      setActiveMemberId(targetMem.id);
      localStorage.setItem('jee_arena_active_id', targetMem.id);
      setLogTargetMember(targetMem.id);
      setExamMemberId(targetMem.id);
      setActiveTab('arena');
      setPinInput('');
      return true;
    } else {
      setLoginError('Incorrect 4-digit PIN.');
      setPinInput('');
      return false;
    }
  };

  const handlePinInputChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 4);
    setPinInput(clean);
    setLoginError('');
    if (clean.length === 4) {
      setTimeout(() => verifyPinCode(clean, loginTarget), 100);
    }
  };

  const handleLogout = () => {
    setActiveMemberId(null);
    setIsAdminUnlocked(false);
    setShowProfileMenu(false);
    localStorage.removeItem('jee_arena_active_id');
    localStorage.removeItem('jee_arena_admin');
    setActiveTab('arena');
    setPinInput('');
    setLoginError('');
  };

  const toggleLiveTimer = async () => {
    const now = Date.now();
    if (!timerRunning) {
      const startedAtFormatted = timerStartedAtStr || new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTimerRunning(true);
      setTimerStartTime(now);
      setTimerStartedAtStr(startedAtFormatted);
      localStorage.setItem('jee_arena_timer_running', 'true');
      localStorage.setItem('jee_arena_timer_start_time', String(now));
      localStorage.setItem('jee_arena_timer_accumulated_secs', String(timerAccumulatedSeconds));
      localStorage.setItem('jee_arena_timer_subject', timerSubject);

      if (currentMember) {
        const basePath = `artifacts/${appId}/public/data`;
        updateDoc(doc(db, basePath, 'members', currentMember.id), {
          isGrinding: true,
          grindingSubject: timerSubject,
          grindingStartedAt: now,
          grindingAccumulatedSeconds: timerAccumulatedSeconds
        }).catch(() => {});
      }
    } else {
      const elapsedSegment = timerStartTime ? Math.max(0, Math.floor((now - timerStartTime) / 1000)) : 0;
      const newAccumulated = timerAccumulatedSeconds + elapsedSegment;
      setTimerRunning(false);
      setTimerStartTime(null);
      setTimerAccumulatedSeconds(newAccumulated);
      setTimerSeconds(newAccumulated);
      localStorage.setItem('jee_arena_timer_running', 'false');
      localStorage.removeItem('jee_arena_timer_start_time');
      localStorage.setItem('jee_arena_timer_accumulated_secs', String(newAccumulated));

      if (currentMember) {
        const basePath = `artifacts/${appId}/public/data`;
        updateDoc(doc(db, basePath, 'members', currentMember.id), {
          isGrinding: false,
          grindingStartedAt: null,
          grindingAccumulatedSeconds: newAccumulated
        }).catch(() => {});
      }
    }
  };

  const resetLiveTimer = async () => {
    setTimerRunning(false);
    setTimerStartTime(null);
    setTimerAccumulatedSeconds(0);
    setTimerSeconds(0);
    setTimerStartedAtStr('');
    resetTimerMilestones();
    stopLockScreenPresence();
    releaseScreenWakeLock();
    document.title = 'JEE Grind Arena';
    localStorage.removeItem('jee_arena_timer_running');
    localStorage.removeItem('jee_arena_timer_start_time');
    localStorage.removeItem('jee_arena_timer_accumulated_secs');

    if (currentMember) {
      const basePath = `artifacts/${appId}/public/data`;
      updateDoc(doc(db, basePath, 'members', currentMember.id), {
        isGrinding: false,
        grindingSubject: '',
        grindingStartedAt: null,
        grindingAccumulatedSeconds: 0
      }).catch(() => {});
    }
  };

  const finishLiveTimerAndOpenLogger = async () => {
    const finalSeconds = timerRunning && timerStartTime
      ? timerAccumulatedSeconds + Math.max(0, Math.floor((Date.now() - timerStartTime) / 1000))
      : timerSeconds;
    const mins = Math.max(1, Math.round(finalSeconds / 60));

    await resetLiveTimer();
    setLogSessionType('STUDY');
    setLogSubject(timerSubject);
    setLogDuration(String(mins));
    setLogTargetMember(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
    setShowLogModal(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePath = `artifacts/${appId}/public/data`;
    const targetId = ((isAdminUnlocked || activeMemberId === 'admin') && logTargetMember)
      ? logTargetMember
      : (currentMember?.id || members[0]?.id || 'sai');
    const targetMem = members.find(m => m.id === targetId) || DEFAULT_MEMBERS.find(m => m.id === targetId);
    if (!targetMem) return;

    const durationMins = Math.max(1, Math.round(Number(logDuration) || 0));

    const questionsBreakdownNums: { [k: string]: number } = {};
    for (const [k, v] of Object.entries(logQuestionsByTier)) {
      const n = Math.max(0, parseInt(v, 10) || 0);
      if (n > 0) questionsBreakdownNums[k] = n;
    }

    const totalQCount = totalLogQuestions;
    const questionsInput = Object.keys(questionsBreakdownNums).length > 0 ? questionsBreakdownNums : totalQCount;
    const baseCalculatedXp = calcSessionXp(durationMins, questionsInput, logDifficulty, logSessionType);

    // Underdog Comeback Buff (1.25x XP if > 150 XP behind weekly leader)
    const leaderWeeklyXp = Math.max(...leaderboardStats.map(s => s.weeklyXp), 0);
    const targetMemWeeklyXp = leaderboardStats.find(s => s.id === targetMem.id)?.weeklyXp || 0;
    const isUnderdog = (leaderWeeklyXp - targetMemWeeklyXp) > 150;
    const xpEarned = isUnderdog ? Math.round(baseCalculatedXp * 1.25) : baseCalculatedXp;

    // Dragon Boss Damage Calculation
    const easyQs = Number(questionsBreakdownNums['easy']) || 0;
    const mainsQs = Number(questionsBreakdownNums['mains']) || 0;
    const hardQs = Number(questionsBreakdownNums['hard']) || 0;
    const advQs = Number(questionsBreakdownNums['adv']) || 0;
    const totalQsDmg = easyQs * 2 + mainsQs * 4 + hardQs * 8 + advQs * 12;
    const sessionDmg = logSessionType === 'STUDY' ? (durationMins * 2 + totalQsDmg) : 0;

    if (isRaidActiveNow && sessionDmg > 0) {
      triggerDragonDamageAnimation(sessionDmg);
    } else if (hardQs > 0 || advQs > 0) {
      playCritHit();
    } else {
      playLogSuccess();
    }

    const isStealthActive = Boolean(
      targetMem.stealthPerkActiveUntil && targetMem.stealthPerkActiveUntil > Date.now()
    );

    const newSession = {
      memberId: targetMem.id,
      memberName: targetMem.name,
      sessionType: logSessionType,
      subject: logSubject,
      date: logDate,
      duration: durationMins,
      questions: totalQCount,
      difficultyBreakdown: questionsBreakdownNums,
      notes: logNotes.trim(),
      xpEarned,
      underdogBoostApplied: isUnderdog,
      bossDamageDealt: isRaidActiveNow ? sessionDmg : 0,
      stealthLogged: isStealthActive,
      timestamp: Date.now()
    };

    try {
      const docRef = await addDoc(collection(db, basePath, 'sessions'), newSession);

      if (raidBoss && isRaidActiveNow && sessionDmg > 0) {
        const newHp = Math.max(0, (raidBoss.currentHp || 10000) - sessionDmg);
        const isDefeatedNow = newHp === 0;
        const currentContrib = Number(raidBoss.contributions?.[targetMem.id]) || 0;
        await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
          ...raidBoss,
          currentHp: newHp,
          isDefeated: isDefeatedNow || Boolean(raidBoss.isDefeated),
          defeatedAt: isDefeatedNow && !raidBoss.isDefeated ? Date.now() : (raidBoss.defeatedAt || null),
          lastWeekFailedPenaltyActive: isDefeatedNow ? false : raidBoss.lastWeekFailedPenaltyActive,
          contributions: {
            ...(raidBoss.contributions || {}),
            [targetMem.id]: currentContrib + sessionDmg
          }
        }, { merge: true });
      }

      await updateDoc(doc(db, basePath, 'members', targetMem.id), {
        isGrinding: false,
        grindingSubject: '',
        grindingStartedAt: null,
        grindingAccumulatedSeconds: 0,
        ...(isStealthActive ? { stealthPerkActiveUntil: null } : {})
      });

      if (logSessionType === 'STUDY' && durationMins >= 90) {
        setPendingLootCrate({
          sessionId: docRef.id,
          durationMins,
          memberId: targetMem.id
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/sessions`);
    }

    if (!isStealthActive) {
      await pushActivity(
        'session_log',
        `${targetMem.name} logged ${formatDuration(durationMins)} of ${logSubject}${isUnderdog ? ' (1.25x Underdog Buff)' : ''}`,
        `${totalQCount > 0 ? `${totalQCount} Qs | ` : ''}+${xpEarned} XP${isRaidActiveNow && sessionDmg > 0 ? ` | -${sessionDmg} Dragon HP` : ''}`,
        targetMem.id,
        xpEarned
      );
    }

    const prevRank = leaderboardStats.findIndex(m => m.id === targetMem.id) + 1;
    const rivalAhead = prevRank > 1 ? leaderboardStats[prevRank - 2] : null;

    setLogQuestionsByTier({ easy: '', mains: '', hard: '', adv: '' });
    setLogNotes('');
    setLogLinkedTaskIds([]);
    setShowLogModal(false);

    setStudyLogSuccessData({
      memberName: targetMem.name,
      xpEarned,
      durationMins,
      totalQCount,
      tasksCount: logLinkedTaskIds.length,
      streakCount: targetMem.streakCount || 1
    });

    const currentLeaderboardMem = leaderboardStats.find(m => m.id === targetMem.id);
    const currentWeeklyXp = currentLeaderboardMem ? currentLeaderboardMem.weeklyXp : 0;
    if (rivalAhead && (currentWeeklyXp + xpEarned) > rivalAhead.weeklyXp) {
      setTimeout(() => {
        setArenaOvertakeData({
          challengerName: targetMem.name,
          rivalName: rivalAhead.name,
          oldRank: prevRank,
          newRank: Math.max(1, prevRank - 1),
          differenceXp: xpEarned
        });
      }, 3500);
    }
  };

  const handleOpenLootCrate = async () => {
    if (!pendingLootCrate || isLootCrateOpening) return;
    setIsLootCrateOpening(true);
    playLootOpen();

    const myId = pendingLootCrate.memberId || activeMemberId || currentMember?.id || 'sai';
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = members.find(m => m.id === myId) || DEFAULT_MEMBERS.find(m => m.id === myId);

    setTimeout(async () => {
      const roll = Math.random();
      let reward: LootCrateReward;

      if (roll < 0.45) {
        const xpAmt = Math.random() < 0.5 ? 10 : 15;
        reward = {
          type: 'xp',
          value: xpAmt,
          description: `Instant +${xpAmt} Bonus XP added directly to your score.`
        };
        if (targetMem) {
          const curBonus = Number(targetMem.bonusXp) || 0;
          await updateDoc(doc(db, basePath, 'members', targetMem.id), {
            bonusXp: curBonus + xpAmt
          }).catch(() => {});
        }
      } else if (roll < 0.78) {
        const existingTitles = targetMem?.unlockedTitles || [];
        const availableTitles = RARE_LOOT_TITLES.filter(t => !existingTitles.includes(t));
        const chosenTitle = availableTitles.length > 0
          ? availableTitles[Math.floor(Math.random() * availableTitles.length)]
          : RARE_LOOT_TITLES[Math.floor(Math.random() * RARE_LOOT_TITLES.length)];

        reward = {
          type: 'title',
          value: chosenTitle,
          titleName: chosenTitle,
          description: `Unlocked Rare Title: "${chosenTitle}". Equipped on your card.`
        };
        if (targetMem) {
          const nextTitles = Array.from(new Set([...existingTitles, chosenTitle]));
          await updateDoc(doc(db, basePath, 'members', targetMem.id), {
            unlockedTitles: nextTitles,
            equippedTitle: chosenTitle
          }).catch(() => {});
        }
      } else {
        const untilTs = Date.now() + 12 * 60 * 60 * 1000;
        reward = {
          type: 'stealth_perk',
          value: untilTs,
          description: `12-Hour Stealth Perk Active. Your next study log will be hidden from the activity feed.`
        };
        if (targetMem) {
          await updateDoc(doc(db, basePath, 'members', targetMem.id), {
            stealthPerkActiveUntil: untilTs
          }).catch(() => {});
        }
      }

      setUnlockedLootReward(reward);
      setIsLootCrateOpening(false);
    }, 850);
  };

  const handleActivateRestDay = async () => {
    const myId = activeMemberId || currentMember?.id || 'sai';
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = members.find(m => m.id === myId) || DEFAULT_MEMBERS.find(m => m.id === myId);
    if (!targetMem) return;

    const currentTokens = targetMem.restTokens !== undefined ? targetMem.restTokens : 1;
    if (currentTokens <= 0) {
      notify('No Rest Tokens Left', 'You receive 1 Rest Token every Monday.', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, basePath, 'members', myId), {
        activeRestDayDate: todayStr,
        restTokens: Math.max(0, currentTokens - 1),
        lastLoginDate: todayStr
      });
      await pushActivity(
        'task_complete',
        `${targetMem.name} activated Rest Day Shield`,
        `Streak protected for ${todayStr}.`,
        myId,
        0
      );
      notify('Rest Shield Activated', 'Your streak is protected today.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${myId}`);
    }
  };

  const handleNudgeMember = async (targetMemberId: string) => {
    const senderId = activeMemberId || currentMember?.id || 'sai';
    if (senderId === targetMemberId) return;

    const senderMem = members.find(m => m.id === senderId) || DEFAULT_MEMBERS.find(m => m.id === senderId);
    const targetMem = members.find(m => m.id === targetMemberId) || DEFAULT_MEMBERS.find(m => m.id === targetMemberId);
    if (!senderMem || !targetMem) return;

    const now = Date.now();
    const lastNudge = lastNudgeTimes[targetMemberId] || 0;
    if (now - lastNudge < 5 * 60 * 1000) {
      const waitMins = Math.ceil((5 * 60 * 1000 - (now - lastNudge)) / 60000);
      notify('Nudge Cooldown', `Wait ${waitMins}m before buzzing ${targetMem.name} again.`, 'error');
      return;
    }

    const updatedNudges = { ...lastNudgeTimes, [targetMemberId]: now };
    setLastNudgeTimes(updatedNudges);
    try {
      localStorage.setItem('jee_arena_nudge_times', JSON.stringify(updatedNudges));
    } catch {}

    playNudgeBuzzer();
    await pushActivity(
      'nudge',
      `[${senderMem.institute} -> ${targetMem.institute}] ${senderMem.name} buzzed ${targetMem.name}`,
      'Time to lock in and drain the Dragon Boss HP bar.',
      targetMemberId,
      0
    );
    notify('Retro Buzzer Sent', `Alerted ${targetMem.name}`);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePath = `artifacts/${appId}/public/data`;
    const targetId = ((isAdminUnlocked || activeMemberId === 'admin') && examMemberId)
      ? examMemberId
      : (currentMember?.id || members[0]?.id || 'sai');
    const targetMem = members.find(m => m.id === targetId) || DEFAULT_MEMBERS.find(m => m.id === targetId);
    if (!targetMem) return;

    const totalCandidates = Number(examTotalStudents);
    const overallRankNum = Number(examRank);
    if (!totalCandidates || totalCandidates <= 0 || !overallRankNum || overallRankNum <= 0) {
      notify('Invalid Rank or Total', 'Enter both Rank and Total Students.', 'error');
      return;
    }

    const overallPct = calcPercentile(overallRankNum, totalCandidates);
    const isPenaltyCap = Boolean(raidBoss.lastWeekFailedPenaltyActive) || (targetMem.id === 'ved' && Boolean(targetMem.deferredExamDebt));
    const maxCap = isPenaltyCap ? 150 : 300;
    const examXpPreview = Math.min(maxCap, Math.round(overallPct * (isPenaltyCap ? 1.5 : 3)));

    const examDoc = {
      memberId: targetMem.id,
      memberName: targetMem.name,
      institute: targetMem.institute,
      examType,
      title: examTitle.trim() || `${examType} Test`,
      date: examDate,
      totalStudents: totalCandidates,
      overallMarks: Number(examMarks) || 0,
      overallMaxMarks: Number(examMaxMarks) || 300,
      overallRank: overallRankNum,
      overallPercentile: Number(overallPct.toFixed(2)),
      subjects: examSubjects,
      raidPenaltyCapped: isPenaltyCap,
      timestamp: examDate ? new Date(examDate + 'T12:00:00').getTime() : Date.now()
    };

    try {
      await addDoc(collection(db, basePath, 'exams'), examDoc);
      // Clear Ved's deferred exam debt once it has been applied to his test week
      if (targetMem.id === 'ved' && targetMem.deferredExamDebt) {
        await updateDoc(doc(db, basePath, 'members', 'ved'), {
          deferredExamDebt: false
        });
      }
      await pushActivity(
        'exam_log',
        `${targetMem.name} logged ${examDoc.title}`,
        `Rank #${overallRankNum}/${totalCandidates} (${overallPct.toFixed(1)}%ile) | +${examXpPreview} XP`,
        targetMem.id,
        examXpPreview
      );
      setExamTitle('');
      setExamTotalStudents('');
      setExamMarks('');
      setExamRank('');
      setShowExamModal(false);
      notify('Exam Logged', `${overallPct.toFixed(1)}%ile recorded (+${examXpPreview} XP)`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/exams`);
    }
  };

  const handleCreatePersonalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTaskTitle.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const owner = currentMember || members[0] || DEFAULT_MEMBERS[0];
    try {
      await addDoc(collection(db, basePath, 'tasks'), {
        title: myTaskTitle.trim(),
        subject: myTaskSubject,
        xp: 0,
        questionsText: myTaskNotes.trim(),
        isPersonal: true,
        ownerId: owner.id,
        createdBy: owner.name,
        completions: {},
        createdAt: Date.now()
      });
      setMyTaskTitle('');
      setMyTaskNotes('');
      setShowPersonalTaskModal(false);
      notify('Task Added', 'Added to your personal checklist.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/tasks`);
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle = 'Task') => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'tasks', taskId));
      if (timerLinkedTaskId === taskId) {
        setTimerLinkedTaskId('');
        localStorage.removeItem('jee_arena_timer_linked_task_id');
      }
      notify('Task Deleted', `Removed "${taskTitle}" from checklist.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/tasks/${taskId}`);
    }
  };

  const handleToggleTaskCompletion = async (task: any) => {
    const basePath = `artifacts/${appId}/public/data`;
    const myId = currentMember?.id || 'sai';
    const myName = currentMember?.name || 'Student';
    const isCompletedNow = !Boolean(
      task.completed || (task.completions && task.completions[myId]?.status === 'verified')
    );

    try {
      await updateDoc(doc(db, basePath, 'tasks', task.id), {
        completed: isCompletedNow,
        completions: {
          ...(task.completions || {}),
          [myId]: {
            status: isCompletedNow ? 'verified' : 'pending',
            completedBy: myName,
            timestamp: Date.now()
          }
        }
      });

      if (isCompletedNow && timerLinkedTaskId === task.id) {
        setTimerLinkedTaskId('');
        localStorage.removeItem('jee_arena_timer_linked_task_id');
      }

      notify(
        isCompletedNow ? 'Task Completed! ✅' : 'Task Reopened',
        `"${task.title}"`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${task.id}`);
    }
  };



  const handleAdminQuickAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = members.find(m => m.id === quickAdjustMemberId);
    if (!targetMem) return;
    const xpDelta = Number(quickXpDelta) || 0;
    const minsDelta = Number(quickTimeDelta) || 0;
    if (xpDelta === 0 && minsDelta === 0) return;

    const updates: any = {};
    if (xpDelta !== 0) updates.bonusXp = (Number(targetMem.bonusXp) || 0) + xpDelta;
    if (minsDelta !== 0) updates.manualMinutesOffset = (Number(targetMem.manualMinutesOffset) || 0) + minsDelta;

    try {
      await updateDoc(doc(db, basePath, 'members', targetMem.id), updates);
      await pushActivity(
        xpDelta < 0 ? 'penalty' : 'admin_adjust',
        `Admin adjusted ${targetMem.name}: ${xpDelta > 0 ? `+${xpDelta}` : xpDelta} XP`,
        quickAdjustReason.trim() || 'Manual adjustment',
        targetMem.id,
        xpDelta
      );
      setQuickXpDelta('');
      setQuickTimeDelta('');
      setQuickAdjustReason('');
      notify('Adjustment Saved', `Updated ${targetMem.name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${targetMem.id}`);
    }
  };

  const handleAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await addDoc(collection(db, basePath, 'announcements'), {
        message: broadcastMessage.trim(),
        target: 'ALL',
        timestamp: Date.now()
      });
      await pushActivity('broadcast', 'Squad Notice', broadcastMessage.trim(), 'admin', 0);
      setBroadcastMessage('');
      notify('Notice Sent', 'Broadcasted to all members.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/announcements`);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const senderId = activeMemberId === 'admin' ? 'admin' : (currentMember?.id || 'sai');
    const senderName = activeMemberId === 'admin' ? 'Admin' : (currentMember?.name || 'Sai');
    try {
      await addDoc(collection(db, basePath, 'messages'), {
        senderId,
        senderName,
        senderType: activeMemberId === 'admin' ? 'admin' : 'student',
        recipientId: chatActiveChannel,
        recipientName: 'Everyone',
        text: chatInputText.trim(),
        timestamp: Date.now()
      });
      setChatInputText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/messages`);
    }
  };

  const customStyles = `
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #09090B;
      color: #F4F4F5;
    }
    h1, h2, h3, h4, .font-display {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.025em;
    }
    .font-mono-num {
      font-family: 'JetBrains Mono', monospace;
      font-variant-numeric: tabular-nums;
    }
    .obsidian-card {
      background: #111216;
      border: 1px solid rgba(255, 255, 255, 0.07);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 16px 36px -12px rgba(0, 0, 0, 0.7);
    }
    .obsidian-card-gold {
      background: linear-gradient(180deg, rgba(249, 115, 22, 0.08) 0%, #111216 65%);
      border: 1px solid rgba(249, 115, 22, 0.35);
      box-shadow: inset 0 1px 0 rgba(249, 115, 22, 0.25), 0 18px 40px -12px rgba(249, 115, 22, 0.15);
    }
    .cta-orange {
      background: #F97316;
      color: #09090B;
      font-weight: 700;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cta-orange:hover {
      background: #FB923C;
      transform: translateY(-1px);
    }
    .cta-orange:active {
      transform: scale(0.98);
    }
  `;

  // PIN VAULT SCREEN
  if (!activeMemberId) {
    const displayMembers = members.length > 0 ? members : DEFAULT_MEMBERS;
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#09090B] antialiased">
        <style>{customStyles}</style>
        <div className="w-full max-w-[390px] obsidian-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-zinc-950 font-bold">
                <Flame className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white font-display">JEE Grind Arena</h1>
                <p className="text-[11px] text-zinc-400">Select profile and enter 4-digit PIN</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                setLoginVaultCategory('students');
                setLoginTarget(displayMembers[0]?.id || 'sai');
                setPinInput('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                loginVaultCategory === 'students' ? 'bg-orange-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Squad Roster
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginVaultCategory('admin');
                setLoginTarget('admin');
                setPinInput('');
              }}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                loginVaultCategory === 'admin' ? 'bg-orange-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Admin Console
            </button>
          </div>

          {loginVaultCategory === 'students' && (
            <div className="grid grid-cols-3 gap-2">
              {displayMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setLoginTarget(m.id);
                    setPinInput('');
                    setLoginError('');
                  }}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    loginTarget === m.id
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-zinc-950/70 border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-white">{m.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{m.institute}</div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 py-1">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  pinInput.length > idx ? 'bg-orange-500 scale-110' : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
            ))}
          </div>

          {loginError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center">
              {loginError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinInputChange(pinInput + String(num))}
                className="h-11 rounded-xl bg-zinc-950 hover:bg-zinc-900 active:scale-95 border border-white/5 text-sm font-bold text-white font-mono-num transition-all"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPinInput('')}
              className="h-11 rounded-xl bg-zinc-950/50 hover:bg-zinc-900 text-xs font-semibold text-zinc-500"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handlePinInputChange(pinInput + '0')}
              className="h-11 rounded-xl bg-zinc-950 hover:bg-zinc-900 active:scale-95 border border-white/5 text-sm font-bold text-white font-mono-num transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPinInput(prev => prev.slice(0, -1))}
              className="h-11 rounded-xl bg-zinc-950/50 hover:bg-zinc-900 text-xs font-semibold text-zinc-400"
            >
              Del
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'arena' as const, label: 'Arena', icon: Trophy },
    { id: 'timer' as const, label: 'Focus Timer', icon: Clock },
    { id: 'tasks' as const, label: 'Quests', icon: CheckSquare },
    { id: 'stats' as const, label: 'Analytics', icon: BarChart3 },
    ...(isAdminUnlocked || activeMemberId === 'admin'
      ? [{ id: 'admin' as const, label: 'Admin', icon: Crown }]
      : [])
  ];

  const hrsStr = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
  const minsStr = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
  const secsStr = String(timerSeconds % 60).padStart(2, '0');
  const topWeeklyXp = Math.max(100, ...(leaderboardStats.map(m => m.weeklyXp) || [100]));
  const bossHpPct = Math.max(0, Math.min(100, Math.round(((raidBoss.currentHp || 0) / (raidBoss.totalHp || 10000)) * 100)));

  return (
    <div className="min-h-[100dvh] bg-[#09090B] text-zinc-100 pb-24 md:pb-14">
      <style>{customStyles}</style>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm obsidian-card rounded-2xl p-3.5 flex items-center gap-3 border-orange-500/40">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{toast.title}</div>
            {toast.detail && <div className="text-[11px] text-zinc-400 truncate">{toast.detail}</div>}
          </div>
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Single-Line Precision Desktop Header (64px height) */}
      <header className="sticky top-0 z-30 h-16 bg-[#09090B]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-zinc-950 font-bold">
              <Flame className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-bold text-sm sm:text-base text-white font-display tracking-tight">
              Grind Arena
            </span>
          </div>

          {/* Center Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-white/[0.06]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-orange-400' : ''}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-2">
            {(timerRunning || timerSeconds > 0) && (
              <button
                type="button"
                onClick={() => setActiveTab('timer')}
                className="px-2.5 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-mono-num font-bold flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>{hrsStr}:{minsStr}:{secsStr}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setLogTargetMember(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
                setShowLogModal(true);
              }}
              className="cta-orange px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Log Study</span>
            </button>

            {/* Profile Button with Dropdown containing Arena Guide, Squad Chat, Sound FX */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/[0.08] text-xs font-semibold text-white transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center font-bold text-xs text-orange-300">
                  {activeMemberId === 'admin' ? 'A' : (currentMember?.name[0] || 'U')}
                </div>
                <span className="hidden sm:inline">
                  {activeMemberId === 'admin' ? 'Admin' : currentMember?.name}
                </span>
              </button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 obsidian-card rounded-2xl p-2 z-50 space-y-1 border border-white/10 shadow-2xl">
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <div className="text-xs font-bold text-white">
                        {activeMemberId === 'admin' ? 'Admin Controller' : currentMember?.name}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {activeMemberId === 'admin' ? 'Full Arena Access' : `${currentMember?.institute} Aspirant`}
                      </div>
                    </div>

                    {/* ARENA GUIDE & RULES BUTTON INSIDE PROFILE MENU */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowGuideModal(true);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 flex items-center justify-between transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-orange-400" />
                        <span>Arena Guide & Rules</span>
                      </span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-orange-500 text-zinc-950 font-extrabold">
                        NEW
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowChatDrawer(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      <span>Squad Comms & Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        toggleAudioMute();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        {isMutedState ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                        <span>Audio Sound FX</span>
                      </span>
                      <span className="text-[10px] font-mono-num text-zinc-500 uppercase">
                        {isMutedState ? 'Muted' : 'On'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowPerksModal(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2"
                    >
                      <Gift className="w-4 h-4 text-amber-400" />
                      <span>My Perks, Shield & Titles</span>
                    </button>

                    {(isAdminUnlocked || activeMemberId === 'admin') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveTab('admin');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 flex items-center gap-2"
                      >
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>Admin Command Center</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-white/[0.06] mt-1 pt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Switch Profile</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#09090B]/95 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all ${
                active ? 'text-orange-400 font-bold' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {activeTab === 'arena' && (
          <div className="space-y-6">
            {/* Top Bar: Title + Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
                  Weekly Squad Standings
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Study time (10 XP/30m), tiered question multipliers, and normalized mock test percentiles ({raidBoss.lastWeekFailedPenaltyActive ? '150 XP Raid Penalty Cap' : '300 XP Pool'}).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                  <span>Arena Guide</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExamMemberId(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
                    setShowExamModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-orange-500/30 text-xs font-bold text-orange-300 flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5 text-orange-400" />
                  <span>Log Exam</span>
                </button>
              </div>
            </div>

            {/* 3-Competitor Asymmetric Bento Podium Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {leaderboardStats.map((m, idx) => {
                const isFirst = idx === 0;
                const progressPct = Math.min(100, Math.round((m.weeklyXp / topWeeklyXp) * 100));
                const isUnderdogActive = (topWeeklyXp - m.weeklyXp) > 150;
                const colSpan = isFirst ? 'md:col-span-5' : 'md:col-span-3.5';

                return (
                  <div
                    key={m.id}
                    className={`${
                      isFirst ? 'md:col-span-4 obsidian-card-gold' : 'md:col-span-4 obsidian-card'
                    } rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all`}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs font-display shrink-0 ${
                            isFirst
                              ? 'bg-orange-500 text-zinc-950'
                              : idx === 1
                              ? 'bg-zinc-800 text-zinc-200 border border-white/10'
                              : 'bg-zinc-900 text-zinc-400 border border-white/5'
                          }`}>
                            {isFirst ? <Crown className="w-5 h-5 stroke-[2.2]" /> : `#${idx + 1}`}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-base font-bold text-white font-display">{m.name}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-white/5 text-zinc-400 font-medium">
                                {m.institute}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 text-orange-300 font-bold flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-400" />
                                <span>{m.streakCount || 1}d</span>
                              </span>
                            </div>

                            {/* Active Buffs & Equipped Loot Title (Zero algorithmic mini-titles) */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {isUnderdogActive && (
                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold"
                                  title="150+ XP behind weekly leader: 1.25x XP boost active"
                                >
                                  1.25x Underdog Buff
                                </span>
                              )}
                              {m.equippedTitle && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-zinc-200 font-semibold">
                                  {m.equippedTitle}
                                </span>
                              )}
                              {m.deferredExamDebt && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
                                  Deferred Exam Debt (150 XP Cap)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-2xl font-extrabold font-mono-num ${isFirst ? 'text-orange-400' : 'text-white'}`}>
                            {m.weeklyXp}
                          </div>
                          <div className="text-[10px] uppercase text-zinc-500 font-bold">Weekly XP</div>
                        </div>
                      </div>

                      {/* Clean Progress Track */}
                      <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFirst ? 'bg-orange-500' : 'bg-zinc-600'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* 3 Telemetry Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/[0.04]">
                        <div className="text-[10px] text-zinc-500 font-semibold">Study</div>
                        <div className="text-xs font-bold text-white font-mono-num mt-0.5">
                          {formatDuration(m.weekStudyMins)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/[0.04]">
                        <div className="text-[10px] text-zinc-500 font-semibold">Percentile</div>
                        <div className="text-xs font-bold text-white font-mono-num mt-0.5">
                          {m.weekAvgPercentile > 0 ? `${m.weekAvgPercentile.toFixed(1)}%` : '-'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/[0.04]">
                        <div className="text-[10px] text-zinc-500 font-semibold">Solved</div>
                        <div className="text-xs font-bold text-white font-mono-num mt-0.5">
                          {m.weekQuestions} Qs
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Rest Shield or Retro Buzzer Nudge */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                      {m.id === (activeMemberId || currentMember?.id || 'sai') ? (
                        <button
                          type="button"
                          onClick={handleActivateRestDay}
                          disabled={m.activeRestDayDate === todayStr || (m.restTokens !== undefined ? m.restTokens <= 0 : false)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <Shield className="w-3.5 h-3.5 text-orange-400" />
                          <span>
                            {m.activeRestDayDate === todayStr
                              ? 'Rest Shield Active'
                              : `Rest Shield (${m.restTokens !== undefined ? m.restTokens : 1} left)`}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleNudgeMember(m.id)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-orange-300 font-semibold text-xs flex items-center gap-1.5 active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-orange-400" />
                          <span>Nudge {m.name}</span>
                        </button>
                      )}

                      <span className="font-mono-num text-xs text-zinc-400">
                        Exam: <strong className="text-white">+{m.examXpWeek}</strong>/{m.maxExamXpCap} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CO-OP DRAGON RAID BOSS STAGE: COMPLETELY HIDDEN WHEN INACTIVE OR DISABLED */}
            {isRaidActiveNow && (
              <div className="obsidian-card rounded-2xl p-5 sm:p-6 border border-orange-500/30 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-bold uppercase">
                        Co-op Dragon Raid Active
                      </span>
                      <span className="text-xs text-zinc-400 font-mono-num">
                        Ends Sunday 6:00 PM
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-white font-display mt-1">
                      {raidBoss.name}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      {raidBoss.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playBossEntrance();
                        setShowBossEntranceModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-300"
                    >
                      Replay Boss Intro
                    </button>
                  </div>
                </div>

                {/* Animated SVG Dragon Perched Above the HP Bar */}
                <RaidBossDragonSvg
                  bossId={raidBoss.id}
                  bossName={raidBoss.name}
                  bossSubtitle={raidBoss.subtitle}
                  currentHp={raidBoss.currentHp}
                  totalHp={raidBoss.totalHp}
                  isHurt={dragonHurtState.active}
                  hurtDamage={dragonHurtState.dmg}
                  isDefeated={raidBoss.isDefeated}
                />

                {/* Shared Boss HP Bar */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono-num">
                    <span className="text-zinc-300 font-bold">
                      BOSS HP: <strong className="text-orange-400">{raidBoss.currentHp.toLocaleString()}</strong> / {raidBoss.totalHp.toLocaleString()} ({bossHpPct}%)
                    </span>
                    <span className="text-zinc-400">
                      {raidBoss.isDefeated ? 'DEFEATED (300 XP Exam Pool Unlocked)' : 'Survives past Sun 6PM -> 150 XP Exam Cap'}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-zinc-950 overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500"
                      style={{ width: `${bossHpPct}%` }}
                    />
                  </div>

                  {/* Squad Damage Contributions */}
                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    {(['sai', 'nishchit', 'ved'] as const).map((mId) => {
                      const memObj = members.find(m => m.id === mId) || DEFAULT_MEMBERS.find(m => m.id === mId);
                      const dmg = Number(raidBoss.contributions?.[mId]) || 0;
                      return (
                        <div key={mId} className="p-2.5 rounded-xl bg-zinc-950 border border-white/[0.05] flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{memObj?.name}</span>
                          <span className="text-xs font-mono-num text-orange-400 font-bold">{dmg.toLocaleString()} DMG</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Split Bento Row: Recent Study Sessions (7 cols) & Live Arena Feed (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 obsidian-card rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-orange-400" />
                    <span>Recent Study Sessions</span>
                  </h3>
                  <span className="text-[11px] text-zinc-400">90m+ session drops a Mystery Crate</span>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {sessions.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-xs">
                      No study sessions logged yet. Click "Log Study" to start.
                    </div>
                  ) : (
                    sessions.slice(0, 10).map((s) => (
                      <div key={s.id} className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05] flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{s.memberName}</span>
                            <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-[10px] text-zinc-300 font-semibold">
                              {s.subject}
                            </span>
                            <span className="text-zinc-400 font-mono-num">{formatDuration(s.duration)}</span>
                            {s.questions > 0 && (
                              <span className="text-orange-300 font-mono-num font-semibold">{s.questions} Qs</span>
                            )}
                            {s.bossDamageDealt > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono-num">
                                -{s.bossDamageDealt} HP
                              </span>
                            )}
                          </div>
                          {s.notes && <div className="text-[11px] text-zinc-400 truncate mt-1">"{s.notes}"</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-orange-400 font-mono-num">+{s.xpEarned} XP</div>
                          <div className="text-[10px] text-zinc-500">{timeAgo(s.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 obsidian-card rounded-2xl p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span>Live Telemetry Feed</span>
                  </h3>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {activities.length === 0 ? (
                    <div className="text-center py-10 text-zinc-500 text-xs">No recent events.</div>
                  ) : (
                    activities.slice(0, 10).map((act) => (
                      <div key={act.id} className="p-3 rounded-xl bg-zinc-950/80 border border-white/[0.05] flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-200">{act.title}</div>
                          {act.detail && <div className="text-[11px] text-zinc-400 mt-0.5">{act.detail}</div>}
                        </div>
                        <span className="text-[10px] text-zinc-500 shrink-0">{timeAgo(act.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FOCUS STOPWATCH */}
        {activeTab === 'timer' && (
          <div className="max-w-xl mx-auto obsidian-card rounded-2xl p-6 sm:p-10 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white font-display">Deep Focus Stopwatch</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Persists across phone lock screens. Sessions of 90+ minutes drop a Mystery Loot Crate.
              </p>
            </div>

            <div className="flex justify-center gap-2 flex-wrap">
              {SUBJECT_OPTIONS.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setTimerSubject(sub.id);
                    localStorage.setItem('jee_arena_timer_subject', sub.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    timerSubject === sub.id
                      ? 'bg-orange-500 text-zinc-950 border-orange-500 font-bold'
                      : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Linked Goal / Task Selector (Shows only active, uncompleted, non-deleted tasks) */}
            <div className="max-w-md mx-auto space-y-1.5 text-left pt-1">
              <label className="text-[11px] font-semibold text-zinc-400 block">
                Link Active Goal / Quest (Optional)
              </label>
              <select
                value={timerLinkedTaskId}
                onChange={(e) => {
                  const val = e.target.value;
                  setTimerLinkedTaskId(val);
                  localStorage.setItem('jee_arena_timer_linked_task_id', val);
                  const selectedTask = availableTimerTasks.find((t) => t.id === val);
                  if (selectedTask?.subject) {
                    setTimerSubject(selectedTask.subject);
                    localStorage.setItem('jee_arena_timer_subject', selectedTask.subject);
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
              >
                <option value="">-- General Study Session (No Linked Goal) --</option>
                {availableTimerTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.subject || 'General'}] {t.title}
                  </option>
                ))}
              </select>
              {timerLinkedTaskId && (
                <div className="text-[11px] text-orange-400 font-semibold flex items-center gap-1.5 pt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Stopwatch session linked to goal</span>
                </div>
              )}
            </div>

            <div className="py-6">
              <div className="text-5xl sm:text-7xl font-extrabold font-mono-num tracking-tight text-white">
                {hrsStr}:{minsStr}:{secsStr}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggleLiveTimer}
                className="cta-orange px-6 py-3 rounded-xl text-sm flex items-center gap-2"
              >
                {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{timerRunning ? 'Pause Session' : 'Start Focus'}</span>
              </button>
              {timerSeconds > 0 && (
                <>
                  <button
                    type="button"
                    onClick={finishLiveTimerAndOpenLogger}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Finish & Log</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetLiveTimer}
                    className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUESTS & CHECKLIST */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white font-display">Personal Study Checklist & Quests</h2>
                <p className="text-xs text-zinc-400">Organize your daily chapter targets and log study sessions against them.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex p-1 bg-zinc-950 rounded-xl border border-white/10 text-xs">
                  {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTaskFilterTab(filter)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        taskFilterTab === filter
                          ? 'bg-orange-500 text-zinc-950 font-bold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {filter === 'ACTIVE' ? 'Active' : filter === 'COMPLETED' ? 'Completed' : 'All'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPersonalTaskModal(true)}
                  className="cta-orange px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Task</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(() => {
                const myId = currentMember?.id || 'sai';
                const filteredTasks = tasks.filter((t) => {
                  const isCompleted = Boolean(
                    t.completed || (t.completions && t.completions[myId]?.status === 'verified')
                  );
                  if (taskFilterTab === 'ACTIVE') return !isCompleted;
                  if (taskFilterTab === 'COMPLETED') return isCompleted;
                  return true;
                });

                if (filteredTasks.length === 0) {
                  return (
                    <div className="obsidian-card rounded-2xl p-10 text-center text-zinc-500 text-xs col-span-full">
                      {taskFilterTab === 'ACTIVE'
                        ? 'No active tasks. Click "New Task" to add a study goal.'
                        : taskFilterTab === 'COMPLETED'
                        ? 'No completed tasks yet.'
                        : 'No tasks created yet.'}
                    </div>
                  );
                }

                return filteredTasks.map((t) => {
                  const isCompleted = Boolean(
                    t.completed || (t.completions && t.completions[myId]?.status === 'verified')
                  );

                  return (
                    <div
                      key={t.id}
                      className={`obsidian-card rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all ${
                        isCompleted ? 'border-emerald-500/30 opacity-80' : 'border-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleTaskCompletion(t)}
                          className={`mt-0.5 p-1 rounded-lg border transition-all shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                              : 'bg-zinc-950 border-white/10 text-zinc-500 hover:text-white'
                          }`}
                          title={isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-orange-400 font-bold">
                              {t.subject}
                            </span>
                            {isCompleted && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                                Completed
                              </span>
                            )}
                          </div>
                          <h4 className={`text-sm font-bold text-white mt-1 ${isCompleted ? 'line-through text-zinc-400' : ''}`}>
                            {t.title}
                          </h4>
                          {t.questionsText && <p className="text-xs text-zinc-400 mt-0.5 truncate">{t.questionsText}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogSubject(t.subject || 'Physics');
                              setLogLinkedTaskIds([t.id]);
                              setShowLogModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold"
                          >
                            Log Session
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t.id, t.title)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* TAB 5: ANALYTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="obsidian-card rounded-2xl p-5 space-y-4">
              <h2 className="text-xl font-bold text-white font-display">Career Telemetry & Exam Standings</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaderboardStats.map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-zinc-950 border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{m.name}</span>
                      <span className="text-xs text-zinc-400">{m.institute}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <div>
                        <div className="text-zinc-500 text-[10px]">Total Study</div>
                        <div className="font-mono-num font-bold text-white">{formatDuration(m.totalStudyMins)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">Total Questions</div>
                        <div className="font-mono-num font-bold text-white">{m.totalQuestions} Qs</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">Avg Percentile</div>
                        <div className="font-mono-num font-bold text-orange-400">
                          {m.allTimeAvgPercentile > 0 ? `${m.allTimeAvgPercentile.toFixed(1)}%` : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-[10px]">Career XP</div>
                        <div className="font-mono-num font-bold text-white">{m.totalXp} XP</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ADMIN COMMAND CENTER (Select Boss, Edit Boss HP, Turn Boss ON/OFF, Launch Override) */}
        {activeTab === 'admin' && (isAdminUnlocked || activeMemberId === 'admin') && (
          <div className="space-y-5">
            <div className="obsidian-card rounded-2xl p-5 sm:p-6 space-y-5 border border-orange-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                <div>
                  <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
                    <Crown className="w-5 h-5 text-orange-400" />
                    <span>Dragon Raid Boss Master Controls</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Scheduled for Monday, October 19, 2026 (12:00 AM) to Sunday 6:00 PM. Hide/Disable, pick a Boss, or customize HP.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAdminToggleBossEnabled}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      raidBoss.enabled !== false
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {raidBoss.enabled !== false ? 'Boss Enabled (Click to Turn OFF)' : 'Boss Disabled & Hidden (Click to Turn ON)'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 1. Select Boss Archetype */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-white/[0.06] space-y-2.5">
                  <div className="text-xs font-bold text-white">1. Select Dragon Boss & Trigger Unveil</div>
                  <div className="space-y-1.5">
                    {UNIVERSAL_RAID_BOSSES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSwitchRaidBossTemplate(b.id)}
                        className={`w-full p-2.5 rounded-xl text-left text-xs border flex items-center justify-between transition-all ${
                          raidBoss.id === b.id
                            ? 'bg-orange-500/15 border-orange-500 text-white font-bold'
                            : 'bg-zinc-900/70 border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate pr-2">{b.name}</span>
                        <span className="font-mono-num text-[10px] text-orange-400 shrink-0">{b.totalHp.toLocaleString()} HP</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Custom HP & Damage Test */}
                <form onSubmit={handleAdminSaveCustomBossHp} className="p-4 rounded-xl bg-zinc-950 border border-white/[0.06] space-y-3">
                  <div className="text-xs font-bold text-white">2. Configure Boss Max & Current HP</div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Max HP Pool</label>
                    <input
                      type="number"
                      min="100"
                      value={adminCustomMaxHp}
                      onChange={e => setAdminCustomMaxHp(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Current Remaining HP</label>
                    <input
                      type="number"
                      min="0"
                      value={adminCustomCurrentHp}
                      onChange={e => setAdminCustomCurrentHp(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white font-mono-num"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" className="cta-orange flex-1 py-2.5 rounded-xl text-xs">
                      Save Boss HP
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerDragonDamageAnimation(250)}
                      className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-rose-300"
                    >
                      Test Attack SVG
                    </button>
                  </div>
                </form>

                {/* 3. Schedule Override & Method 1 Penalty Controls */}
                <div className="p-4 rounded-xl bg-zinc-950 border border-white/[0.06] space-y-3">
                  <div className="text-xs font-bold text-white">3. Launch Schedule & Raid Penalty</div>
                  <p className="text-[11px] text-zinc-400">
                    Current visibility: <strong className="text-white">{isRaidActiveNow ? 'Visible in Arena' : 'Hidden (Awaiting Mon Oct 19 or Override)'}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleRaidAdminOverride}
                    className="w-full py-2.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 text-xs font-bold"
                  >
                    {raidBoss.manualOverrideActive ? 'Disable Override (Wait for Mon Oct 19)' : 'Force Show Boss Now (Early Test-Drive)'}
                  </button>

                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="text-[11px] text-zinc-400 font-semibold">Method 1 Deferred Exam Debt (150 XP Cap)</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerRaidFailureEvaluation(true)}
                        className="flex-1 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold"
                      >
                        Apply 150 XP Cap
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerRaidFailureEvaluation(false)}
                        className="flex-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold"
                      >
                        Restore 300 XP
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick XP Adjust & Squad Broadcast */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form onSubmit={handleAdminQuickAdjust} className="obsidian-card rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase">Manual XP / Study Time Modifier</h3>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={quickAdjustMemberId}
                    onChange={e => setQuickAdjustMemberId(e.target.value)}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                  >
                    {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="XP Delta"
                    value={quickXpDelta}
                    onChange={e => setQuickXpDelta(e.target.value)}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                  />
                  <input
                    type="number"
                    placeholder="Mins Delta"
                    value={quickTimeDelta}
                    onChange={e => setQuickTimeDelta(e.target.value)}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Reason for adjustment..."
                  value={quickAdjustReason}
                  onChange={e => setQuickAdjustReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                />
                <button type="submit" className="cta-orange w-full py-2.5 rounded-xl text-xs">
                  Apply Adjustment
                </button>
              </form>

              <form onSubmit={handleAdminBroadcast} className="obsidian-card rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase">Broadcast Squad Notice</h3>
                <input
                  type="text"
                  placeholder="Enter announcement message..."
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                />
                <button type="submit" className="cta-orange w-full py-2.5 rounded-xl text-xs">
                  Publish Broadcast
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* OFFICIAL ARENA GUIDE, RULES, FAIRNESS & CHANGELOG MODAL */}
      {showGuideModal && (
        <ArenaGuideModal onClose={() => setShowGuideModal(false)} />
      )}

      {/* ANIMATED DRAGON BOSS ENTRANCE UNVEIL MODAL */}
      {showBossEntranceModal && (
        <BossEntranceModal
          bossId={raidBoss.id}
          bossName={raidBoss.name}
          bossSubtitle={raidBoss.subtitle}
          totalHp={raidBoss.totalHp}
          onClose={() => setShowBossEntranceModal(false)}
        />
      )}

      {/* MYSTERY LOOT CRATE DROP MODAL */}
      {(pendingLootCrate || unlockedLootReward) && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md obsidian-card rounded-2xl p-6 text-center space-y-5 border border-orange-500/40">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-zinc-950 mx-auto">
              <Package className={`w-8 h-8 ${isLootCrateOpening ? 'animate-spin' : 'animate-bounce'}`} />
            </div>

            {!unlockedLootReward ? (
              <>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-orange-400 font-extrabold">90+ Minute Focus Milestone</div>
                  <h3 className="text-xl font-extrabold text-white font-display">Mystery Loot Crate Dropped</h3>
                  <p className="text-xs text-zinc-400">
                    You logged {pendingLootCrate?.durationMins} minutes of uninterrupted study. Unbox for Instant Bonus XP, a Rare Profile Title, or a 12-Hour Stealth Perk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLootCrate}
                  disabled={isLootCrateOpening}
                  className="cta-orange w-full py-3 rounded-xl text-xs"
                >
                  {isLootCrateOpening ? 'Unboxing Crate...' : 'Tap to Unbox Reward'}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase text-emerald-400 font-extrabold">Reward Claimed</div>
                  <h3 className="text-xl font-extrabold text-white font-display">
                    {unlockedLootReward.type === 'xp'
                      ? `+${unlockedLootReward.value} Instant Bonus XP`
                      : unlockedLootReward.type === 'title'
                      ? `Rare Title: ${unlockedLootReward.titleName}`
                      : '12-Hour Stealth Perk Activated'}
                  </h3>
                  <p className="text-xs text-zinc-300">{unlockedLootReward.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingLootCrate(null);
                    setUnlockedLootReward(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* PERKS & TITLES MODAL */}
      {showPerksModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md obsidian-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display">My Perks, Rest Shield & Titles</h3>
              <button onClick={() => setShowPerksModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {currentMember ? (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Weekly Rest Shield Token</div>
                    <div className="text-[11px] text-zinc-400">Protects your daily streak for 24 hours</div>
                  </div>
                  <span className="font-mono-num font-bold text-orange-400">
                    {currentMember.restTokens !== undefined ? currentMember.restTokens : 1} / 1
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">12-Hour Stealth Perk</div>
                    <div className="text-[11px] text-zinc-400">Hides your next study log from the live feed</div>
                  </div>
                  <span className="font-mono-num font-bold text-zinc-300">
                    {currentMember.stealthPerkActiveUntil && currentMember.stealthPerkActiveUntil > Date.now()
                      ? 'ACTIVE'
                      : 'Inactive'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400">Switch to a student profile to view personal perks.</div>
            )}
          </div>
        </div>
      )}

      {/* LOG STUDY SESSION MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSaveSession} className="w-full max-w-md obsidian-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display">Log Focused Study Session</h3>
              <button type="button" onClick={() => setShowLogModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Subject</label>
                <select
                  value={logSubject}
                  onChange={e => setLogSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                >
                  {SUBJECT_OPTIONS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Duration (Minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={logDuration}
                  onChange={e => setLogDuration(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                />
              </div>
            </div>

            {Number(logDuration) >= 90 && (
              <div className="p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[11px] font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 shrink-0" />
                <span>90+ minute session: unlocks a Mystery Loot Crate upon saving.</span>
              </div>
            )}

            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1.5">
                Questions Solved by Difficulty
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DIFFICULTY_TIERS.map(tier => (
                  <div key={tier.id} className="p-2.5 rounded-xl bg-zinc-950 border border-white/10">
                    <div className={`text-[10px] font-bold ${tier.color}`}>{tier.label} ({tier.desc})</div>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={logQuestionsByTier[tier.id] || ''}
                      onChange={e => setLogQuestionsByTier(prev => ({ ...prev, [tier.id]: e.target.value }))}
                      className="w-full mt-1 p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-xs text-white font-mono-num"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Topics & Session Notes</label>
              <input
                type="text"
                placeholder="e.g., Electrostatics PYQs, Definite Integration..."
                value={logNotes}
                onChange={e => setLogNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
              />
            </div>

            {availableTimerTasks.length > 0 && (
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">
                  Link Active Goal / Quest (Optional)
                </label>
                <select
                  value={logLinkedTaskIds[0] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLogLinkedTaskIds(val ? [val] : []);
                    const sel = availableTimerTasks.find((t) => t.id === val);
                    if (sel?.subject) {
                      setLogSubject(sel.subject);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                >
                  <option value="">-- No Linked Goal --</option>
                  {availableTimerTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.subject || 'General'}] {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" className="cta-orange w-full py-3 rounded-xl text-xs">
              Save Study Log
            </button>
          </form>
        </div>
      )}

      {/* LOG EXAM MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveExam} className="w-full max-w-md obsidian-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display">Log Coaching Mock Exam</h3>
              <button type="button" onClick={() => setShowExamModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Exam Title</label>
                <input
                  type="text"
                  placeholder="Major Test 4"
                  value={examTitle}
                  onChange={e => setExamTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Date</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Your Rank</label>
                <input
                  type="number"
                  placeholder="12"
                  value={examRank}
                  onChange={e => setExamRank(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Total Batch Students</label>
                <input
                  type="number"
                  placeholder="560"
                  value={examTotalStudents}
                  onChange={e => setExamTotalStudents(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Marks Scored</label>
                <input
                  type="number"
                  placeholder="215"
                  value={examMarks}
                  onChange={e => setExamMarks(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Max Marks</label>
                <input
                  type="number"
                  placeholder="300"
                  value={examMaxMarks}
                  onChange={e => setExamMaxMarks(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white font-mono-num"
                />
              </div>
            </div>

            <button type="submit" className="cta-orange w-full py-3 rounded-xl text-xs">
              Save Exam Result
            </button>
          </form>
        </div>
      )}

      {/* NEW PERSONAL TASK MODAL */}
      {showPersonalTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreatePersonalTask} className="w-full max-w-md obsidian-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-display">Add Personal Study Goal</h3>
              <button type="button" onClick={() => setShowPersonalTaskModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Task Title</label>
              <input
                type="text"
                placeholder="Complete Rotational Mechanics Exercise 2"
                value={myTaskTitle}
                onChange={e => setMyTaskTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Subject</label>
              <select
                value={myTaskSubject}
                onChange={e => setMyTaskSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
              >
                {SUBJECT_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1">Notes</label>
              <input
                type="text"
                placeholder="Questions 1 to 35"
                value={myTaskNotes}
                onChange={e => setMyTaskNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
              />
            </div>
            <button type="submit" className="cta-orange w-full py-3 rounded-xl text-xs">
              Create Goal
            </button>
          </form>
        </div>
      )}



      {/* SQUAD CHAT DRAWER */}
      {showChatDrawer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#111216] h-full flex flex-col border-l border-white/10 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white font-display">Squad Comms</h3>
              <button onClick={() => setShowChatDrawer(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {chatMessages.map(msg => (
                <div key={msg.id} className="p-3 rounded-xl bg-zinc-950 border border-white/5 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="font-bold text-orange-400">{msg.senderName}</span>
                    <span>{timeAgo(msg.timestamp)}</span>
                  </div>
                  <p className="text-zinc-200 mt-1">{msg.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChatMessage} className="pt-2 flex gap-2">
              <input
                type="text"
                value={chatInputText}
                onChange={e => setChatInputText(e.target.value)}
                placeholder="Message the squad..."
                className="flex-1 p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white"
              />
              <button type="submit" className="cta-orange px-4 rounded-xl text-xs">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {studyLogSuccessData && (
        <StudyLogSuccessAnimation
          {...studyLogSuccessData}
          onClose={() => setStudyLogSuccessData(null)}
        />
      )}

      {arenaOvertakeData && (
        <ArenaOvertakeModal
          {...arenaOvertakeData}
          onClose={() => setArenaOvertakeData(null)}
        />
      )}
    </div>
  );
}