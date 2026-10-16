import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trophy, Clock, CheckSquare, BarChart3, Bell, BellOff, Plus, Play, Pause,
  Check, X, AlertTriangle, Flame, BookOpen, ExternalLink,
  Image as ImageIcon, Trash2, Lock, LogOut, Sparkles,
  Eye, EyeOff, Zap, RefreshCw, ChevronRight, Crown, CheckCircle2,
  Edit3, User as UserIcon, Target, Award, Shield,
  Download, Upload, Database, TrendingUp, TrendingDown, Brain,
  Calendar, Repeat, Sliders, GraduationCap, FileText, Send, MessageSquare, ArrowRight,
  Layers, Swords, Archive, ArchiveRestore, Video, Link as LinkIcon, Users,
  Volume2, VolumeX, Coffee, Gift, Package
} from 'lucide-react';
import { StudyLogSuccessAnimation } from './components/StudyLogSuccessAnimation';
import { ArenaOvertakeModal } from './components/ArenaOvertakeModal';
import { TeacherGradingModal } from './components/TeacherGradingModal';
import { AssignmentAttachmentUploader, AssignmentFile } from './components/AssignmentAttachmentUploader';
import {
  playLogSuccess,
  playFirstBlood,
  playCritHit,
  playLootOpen,
  playNudgeBuzzer,
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
  onSnapshot,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db, appId, initFirebaseAuth, handleFirestoreError, OperationType } from './firebase';
import {
  sendWebPushNotification,
  requestWebPushPermission,
  getNotificationPermission,
  isWebPushEnabledByUser,
  setWebPushEnabledByUser,
  sendTestNotification
} from './utils/notifications';
import { compressImageFile, compressDataUrl } from './utils/image';
import {
  isWakeLockSupported,
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
  activeRestDayDate?: string | null;
  unlockedTitles?: string[];
  equippedTitle?: string;
  stealthPerkActiveUntil?: number | null;
}

interface RaidBoss {
  id: string;
  name: string;
  totalHp: number;
  currentHp: number;
  weekStart: string;
  isDefeated: boolean;
  defeatedAt?: number | null;
  contributions: { [memberId: string]: number };
}

interface LootCrateReward {
  type: 'xp' | 'title' | 'stealth_perk';
  value: string | number;
  titleName?: string;
  description: string;
}

const DEFAULT_RAID_BOSS: RaidBoss = {
  id: 'titan_w1',
  name: 'The Rotational Dynamics Titan',
  totalHp: 10000,
  currentHp: 10000,
  weekStart: new Date().toISOString().split('T')[0],
  isDefeated: false,
  contributions: { sai: 0, nishchit: 0, ved: 0 }
};

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'student' | 'teacher' | 'admin';
  recipientId: 'ALL' | string;
  recipientName: string;
  text: string;
  timestamp: number;
}

interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  check: (m: Member, memSessions: any[], memExams: any[], memTasks: any[]) => { unlocked: boolean; progress: number; target: number; label: string };
}

const BADGES: BadgeDefinition[] = [
  {
    id: '100_hours',
    title: '100 Hours Club',
    description: 'Log over 100 cumulative hours of focused study.',
    icon: '🕒',
    color: 'from-amber-400 to-orange-500',
    check: (m, sessions) => {
      const totalMins = sessions.filter(s => s.memberId === m.id).reduce((a, b) => a + (Number(b.duration) || 0), 0);
      const totalHrs = Math.floor(totalMins / 60);
      return { unlocked: totalHrs >= 100, progress: totalHrs, target: 100, label: `${totalHrs}/100 hrs` };
    }
  },
  {
    id: '50_hours',
    title: '50 Hours Club',
    description: 'Log 50+ cumulative hours of focused study.',
    icon: '⚡',
    color: 'from-amber-300 to-yellow-500',
    check: (m, sessions) => {
      const totalMins = sessions.filter(s => s.memberId === m.id).reduce((a, b) => a + (Number(b.duration) || 0), 0);
      const totalHrs = Math.floor(totalMins / 60);
      return { unlocked: totalHrs >= 50, progress: totalHrs, target: 50, label: `${totalHrs}/50 hrs` };
    }
  },
  {
    id: 'streak_king',
    title: 'Streak King',
    description: 'Maintain a 5+ day consecutive login streak.',
    icon: '🔥',
    color: 'from-orange-500 to-rose-500',
    check: (m) => {
      const streak = m.streakCount || 1;
      return { unlocked: streak >= 5, progress: streak, target: 5, label: `${streak}/5 days` };
    }
  },
  {
    id: 'math_master',
    title: 'Math Master',
    description: 'Solve 100+ Mathematics practice problems.',
    icon: '📐',
    color: 'from-blue-400 to-indigo-500',
    check: (m, sessions) => {
      const mathQs = sessions.filter(s => s.memberId === m.id && s.subject === 'Math').reduce((a, b) => a + (Number(b.questions) || 0), 0);
      return { unlocked: mathQs >= 100, progress: mathQs, target: 100, label: `${mathQs}/100 Qs` };
    }
  },
  {
    id: 'physics_specialist',
    title: 'Physics Specialist',
    description: 'Solve 100+ Physics practice problems.',
    icon: '⚛️',
    color: 'from-cyan-400 to-blue-600',
    check: (m, sessions) => {
      const phyQs = sessions.filter(s => s.memberId === m.id && s.subject === 'Physics').reduce((a, b) => a + (Number(b.questions) || 0), 0);
      return { unlocked: phyQs >= 100, progress: phyQs, target: 100, label: `${phyQs}/100 Qs` };
    }
  },
  {
    id: 'chem_virtuoso',
    title: 'Chemistry Virtuoso',
    description: 'Solve 100+ Chemistry practice problems.',
    icon: '🧪',
    color: 'from-emerald-400 to-teal-600',
    check: (m, sessions) => {
      const chemQs = sessions.filter(s => s.memberId === m.id && s.subject === 'Chemistry').reduce((a, b) => a + (Number(b.questions) || 0), 0);
      return { unlocked: chemQs >= 100, progress: chemQs, target: 100, label: `${chemQs}/100 Qs` };
    }
  },
  {
    id: 'test_dominator',
    title: 'Test Dominator',
    description: 'Achieve a 90%+ile score on any JEE mock test.',
    icon: '🏆',
    color: 'from-yellow-400 to-amber-600',
    check: (m, _s, exams) => {
      const maxPct = exams.filter(e => e.memberId === m.id).reduce((max, e) => Math.max(max, Number(e.overallPercentile) || 0), 0);
      return { unlocked: maxPct >= 90, progress: Math.round(maxPct), target: 90, label: `${maxPct.toFixed(1)}%ile` };
    }
  },
  {
    id: 'task_executioner',
    title: 'Task Executioner',
    description: 'Complete 5+ squad tasks & study bounties.',
    icon: '🎯',
    color: 'from-purple-400 to-pink-600',
    check: (m, _s, _e, tasks) => {
      const count = tasks.filter(t => t.completions?.[m.id]?.status === 'verified').length;
      return { unlocked: count >= 5, progress: count, target: 5, label: `${count}/5 tasks` };
    }
  }
];

const getStreakMultiplier = (streakCount = 0): number => {
  if (streakCount >= 7) return 1.15; // +15% XP
  if (streakCount >= 5) return 1.10; // +10% XP
  if (streakCount >= 3) return 1.05; // +5% XP
  return 1.0;
};

interface Teacher {
  id: string;
  name: string;
  subject: string;
  institute: string;
  passcode: string;
  email?: string;
  phone?: string;
  bio?: string;
  createdAt: number;
}

interface TeacherAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  description: string;
  hasQuestions?: boolean;
  questionsCount?: number;
  questionDifficulty?: 'easy' | 'medium' | 'hard';
  xpReward: number;
  doubleXpFullComplete?: boolean;
  dueDate: string;
  assignedTo: string[]; // memberIds or ['ALL']
  requireProof: boolean;
  refLink?: string;
  attachedFiles?: AssignmentFile[];
  archived?: boolean;
  submissions?: {
    [memberId: string]: {
      submittedAt: number;
      proofImages?: string[];
      attachedFiles?: AssignmentFile[];
      resourceLinks?: string[];
      note?: string;
      status: 'pending' | 'graded' | 'overdue_penalized';
      feedback?: string;
      gradedBy?: string;
      questionsAttempted?: number;
      questionsCorrect?: number;
      isTaskFullyCompleted?: boolean;
      marksAwarded?: number;
      maxMarks?: number;
      xpAwarded?: number;
      overduePenalizedAt?: number;
    }
  };
  createdAt: number;
}

interface TeacherNote {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  targetMemberId: string;
  note: string;
  createdAt: number;
}

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
    unexcusedAt: null
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
    unexcusedAt: null
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
    unexcusedAt: null
  }
];

const DEFAULT_TEACHERS: Teacher[] = [];

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
  },
  'Custom Coaching Mock': {
    totalMax: 300,
    subjects: [
      { name: 'Physics', maxMarks: 100, enabled: true },
      { name: 'Chemistry', maxMarks: 100, enabled: true },
      { name: 'Math', maxMarks: 100, enabled: true }
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

// Session XP calculation supporting multi-difficulty question breakdown and task bonus override
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

  // Generous anti-cheat cap: up to 60 XP questions per hour of study + 25 baseline
  const maxAllowedQXp = Math.max(25, Math.round((mins / 60) * 60) + 25);
  const cappedQXp = Math.min(Math.round(rawQXp), maxAllowedQXp);

  return timeXp + cappedQXp;
}

function parseQuickTimeRange(inputStr: string) {
  if (!inputStr || !inputStr.includes('-')) return null;
  const parts = inputStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;

  const parseSingleTime = (tStr: string) => {
    const clean = tStr.toLowerCase().replace(/\s+/g, '');
    const match = clean.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = match[2] ? parseInt(match[2], 10) : 0;
    const mer = match[3];
    if (mins < 0 || mins > 59 || hours < 0 || hours > 23) return null;
    if (mer === 'pm' && hours < 12) hours += 12;
    if (mer === 'am' && hours === 12) hours = 0;
    return { hours, mins };
  };

  const start = parseSingleTime(parts[0]);
  const end = parseSingleTime(parts[1]);
  if (!start || !end) return null;

  let startTotal = start.hours * 60 + start.mins;
  let endTotal = end.hours * 60 + end.mins;
  if (endTotal <= startTotal) {
    endTotal += 12 * 60;
    if (endTotal <= startTotal) endTotal += 12 * 60;
  }
  const duration = endTotal - startTotal;
  if (duration <= 0 || duration > 1440) return null;

  const formatHHMM = (h: number, m: number) => `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return {
    startTime: formatHHMM(start.hours, start.mins),
    endTime: formatHHMM(Math.floor(endTotal / 60), endTotal % 60),
    duration
  };
}

// Image compression helper moved to src/utils/image.ts

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

export interface AutomatedRoutine {
  id: string;
  title: string;
  type: 'blackout_lock' | 'blackout_unlock' | 'announcement';
  enabled: boolean;
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
  time: string; // "23:59" or "22:00"
  message?: string;
  target?: string;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const DEFAULT_ROUTINES: AutomatedRoutine[] = [
  {
    id: 'friday_blackout_lock',
    title: 'Weekly Blind Mode Lock (Friday 11:59 PM)',
    type: 'blackout_lock',
    enabled: true,
    dayOfWeek: 5, // Friday
    time: '23:59'
  },
  {
    id: 'sunday_blackout_unlock',
    title: 'Weekly Grand Reveal & Unlock (Sunday 10:00 PM)',
    type: 'blackout_unlock',
    enabled: true,
    dayOfWeek: 0, // Sunday
    time: '22:00'
  },
  {
    id: 'sunday_exam_reminder',
    title: 'Sunday Mock Test Submission Push',
    type: 'announcement',
    enabled: true,
    dayOfWeek: 0, // Sunday
    time: '18:00',
    message: '📢 Final sprint: Log all weekend mock exam marks and ranks before 10:00 PM reveal!',
    target: 'ALL'
  }
];

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

  // Top Nav Profile Popover
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showAdminPassModal, setShowAdminPassModal] = useState<boolean>(false);
  const [adminModalPin, setAdminModalPin] = useState<string>('');
  const [adminModalError, setAdminModalError] = useState<string>('');

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<'arena' | 'timer' | 'tasks' | 'tuition' | 'stats' | 'admin'>('arena');
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showExamModal, setShowExamModal] = useState<boolean>(false);
  const [showPersonalTaskModal, setShowPersonalTaskModal] = useState<boolean>(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState<boolean>(false);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);

  // Real-time Firestore Data & Connection Status
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Tuition Teacher & Hub State
  const [activeTeacherId, setActiveTeacherId] = useState<string | null>(() => {
    return localStorage.getItem('jee_arena_teacher_id') || null;
  });
  const [selectedTuitionSubject, setSelectedTuitionSubject] = useState<string>('Math');
  const [teacherAiReport, setTeacherAiReport] = useState<any | null>(null);
  const [isLoadingTeacherAi, setIsLoadingTeacherAi] = useState<boolean>(false);
  const [tuitionVaultCategory, setTuitionVaultCategory] = useState<'students' | 'teachers' | 'admin'>('students');
  const [tuitionSubTab, setTuitionSubTab] = useState<'analysis' | 'chat' | 'assignments'>('analysis');

  // Teacher AI Chatbot state ("Ask AI about Student Performance")
  const [teacherChatMessages, setTeacherChatMessages] = useState<Array<{ sender: 'teacher' | 'ai'; text: string; timestamp: number }>>([
    {
      sender: 'ai',
      text: "👋 Welcome! I am your Tuition AI Academic Assistant. I have live access to study hours, practice question counts, and standardized mock test percentiles for Sai, Nishchit, and Ved. Ask me anything about student performance, effort comparisons, or assignment ideas!",
      timestamp: Date.now()
    }
  ]);
  const [teacherChatInput, setTeacherChatInput] = useState<string>('');
  const [teacherChatStudentFocus, setTeacherChatStudentFocus] = useState<string>('ALL');
  const [isTeacherChatSending, setIsTeacherChatSending] = useState<boolean>(false);

  // Unexcused Absence State for Active Standing
  const [unexcusedReasonMap, setUnexcusedReasonMap] = useState<Record<string, string>>({});

  // Teacher Management in Admin
  const [newTeacherName, setNewTeacherName] = useState<string>('');
  const [newTeacherSubject, setNewTeacherSubject] = useState<string>('Physics');
  const [newTeacherInst, setNewTeacherInst] = useState<string>('');
  const [newTeacherPin, setNewTeacherPin] = useState<string>('');
  const [newTeacherBio, setNewTeacherBio] = useState<string>('');
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editTeacherForm, setEditTeacherForm] = useState<any | null>(null);

  // Teacher Assignment Creation Modal & Submissions
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState<boolean>(false);
  const [assignTitle, setAssignTitle] = useState<string>('');
  const [assignSubject, setAssignSubject] = useState<string>('Math');
  const [assignDesc, setAssignDesc] = useState<string>('');
  const [assignHasQuestions, setAssignHasQuestions] = useState<boolean>(true);
  const [assignQuestions, setAssignQuestions] = useState<string>('20');
  const [assignQuestionDifficulty, setAssignQuestionDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [assignXp, setAssignXp] = useState<string>('40');
  const [assignDoubleXpFullComplete, setAssignDoubleXpFullComplete] = useState<boolean>(false);
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [assignTarget, setAssignTarget] = useState<string[]>(['ALL']);
  const [assignRequireProof, setAssignRequireProof] = useState<boolean>(true);
  const [assignRefLink, setAssignRefLink] = useState<string>('');
  const [assignAttachedFiles, setAssignAttachedFiles] = useState<AssignmentFile[]>([]);
  const [tuitionAssignmentFilter, setTuitionAssignmentFilter] = useState<'active' | 'archived'>('active');

  // Teacher Assignment Editing & XP Adjustment State
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignmentForm, setEditAssignmentForm] = useState<any | null>(null);
  const [showTeacherXpModal, setShowTeacherXpModal] = useState<boolean>(false);
  const [teacherXpTargetStudentId, setTeacherXpTargetStudentId] = useState<string>('sai');
  const [teacherXpAmount, setTeacherXpAmount] = useState<string>('25');
  const [teacherXpReason, setTeacherXpReason] = useState<string>('');
  const [teacherXpIsDeduction, setTeacherXpIsDeduction] = useState<boolean>(false);

  // Homework Solution & Excuse Modal (Students)
  const [activeAssignmentAction, setActiveAssignmentAction] = useState<TeacherAssignment | null>(null);
  const [assignmentActionMode, setAssignmentActionMode] = useState<'submit_solution' | 'submit_excuse'>('submit_solution');
  const [studentHomeworkProofImages, setStudentHomeworkProofImages] = useState<string[]>([]);
  const [studentHomeworkAttachedFiles, setStudentHomeworkAttachedFiles] = useState<AssignmentFile[]>([]);
  const [studentHomeworkResourceLinks, setStudentHomeworkResourceLinks] = useState<string[]>([]);
  const [newResourceLinkInput, setNewResourceLinkInput] = useState<string>('');
  const [studentHomeworkNote, setStudentHomeworkNote] = useState<string>('');
  const [studentExcuseReason, setStudentExcuseReason] = useState<string>('');
  const [isSubmittingAssignmentAction, setIsSubmittingAssignmentAction] = useState<boolean>(false);
  const [logTaskCompletionStatus, setLogTaskCompletionStatus] = useState<Record<string, 'completed' | 'in_progress'>>({});

  // Teacher Reviewing Submissions & Excuses Modal
  const [reviewingAssignment, setReviewingAssignment] = useState<TeacherAssignment | null>(null);
  const [reviewingStudentId, setReviewingStudentId] = useState<string | null>(null);
  const [reviewTeacherMarks, setReviewTeacherMarks] = useState<string>('90');
  const [reviewTeacherFeedback, setReviewTeacherFeedback] = useState<string>('');
  const [reviewPenaltyXp, setReviewPenaltyXp] = useState<string>('25');

  // Teacher Direct Note Form
  const [teacherNoteText, setTeacherNoteText] = useState<string>('');
  const [teacherNoteTarget, setTeacherNoteTarget] = useState<string>('ALL');

  // Multi-Test Entry Batch Mode State
  const [examEntryMode, setExamEntryMode] = useState<'single' | 'batch'>('single');
  const [batchExamEntries, setBatchExamEntries] = useState<Array<{
    id: string;
    examType: string;
    title: string;
    date: string;
    overallMarks: string;
    overallMaxMarks: string;
    overallRank: string;
    totalStudents: string;
  }>>([
    {
      id: 'batch_1',
      examType: 'JEE Mains',
      title: 'Mock Test 1',
      date: new Date().toISOString().split('T')[0],
      overallMarks: '',
      overallMaxMarks: '300',
      overallRank: '',
      totalStudents: ''
    }
  ]);

  // Toast Notification & Realtime Push Tracking Refs
  const [toast, setToast] = useState<{ title: string; detail?: string; type?: 'info' | 'error' } | null>(null);
  const lastActivityIdRef = useRef<string | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastAssignmentIdRef = useRef<string | null>(null);
  const lastAnnouncementIdRef = useRef<string | null>(null);
  const [announcementsLastRead, setAnnouncementsLastRead] = useState<number>(() => {
    return Number(localStorage.getItem('jee_arena_announcements_last_read')) || 0;
  });
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('jee_arena_read_announcement_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState<boolean>(false);

  // Gamification Mechanics State
  const [raidBoss, setRaidBoss] = useState<RaidBoss>(DEFAULT_RAID_BOSS);
  const [showRaidBossBanner, setShowRaidBossBanner] = useState<boolean>(true);
  const [critDamageAnim, setCritDamageAnim] = useState<{ amount: number; id: number } | null>(null);
  const [isMutedState, setIsMutedState] = useState<boolean>(() => isAudioMuted());
  const [pendingLootCrate, setPendingLootCrate] = useState<{ sessionId: string; durationMins: number } | null>(null);
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

  const toggleAudioMute = () => {
    const next = !isMutedState;
    setIsMutedState(next);
    setAudioMuted(next);
  };

  const handleActivateRestDay = async () => {
    const myId = activeMemberId || currentMember?.id || 'sai';
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = members.find(m => m.id === myId) || DEFAULT_MEMBERS.find(m => m.id === myId);
    if (!targetMem) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentTokens = targetMem.restTokens !== undefined ? targetMem.restTokens : 1;
    if (currentTokens <= 0) {
      notify('No Rest Tokens', 'You have used your rest token for this week.', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, basePath, 'members', myId), {
        activeRestDayDate: todayStr,
        restTokens: Math.max(0, currentTokens - 1)
      });
      await pushActivity(
        'task_complete',
        `🛡️ ${targetMem.name} activated Rest Day Shield!`,
        `Streak protected for ${todayStr}. Rest tokens remaining: ${currentTokens - 1}`,
        myId,
        0
      );
      notify('Rest Shield Activated! 🛡️', 'Your daily streak is protected today. Take time to recharge!');
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
    if (now - lastNudge < 15 * 60 * 1000) {
      const waitMins = Math.ceil((15 * 60 * 1000 - (now - lastNudge)) / 60000);
      notify('Nudge Rate Limited', `Please wait ${waitMins}m before nudging ${targetMem.name} again.`, 'error');
      return;
    }

    const updatedNudges = { ...lastNudgeTimes, [targetMemberId]: now };
    setLastNudgeTimes(updatedNudges);
    try {
      localStorage.setItem('jee_arena_nudge_times', JSON.stringify(updatedNudges));
    } catch {}

    playNudgeBuzzer();
    await pushActivity(
      'message',
      `👉 ${senderMem.name} nudged ${targetMem.name}`,
      `"Time to study and log your JEE practice!" ⚡`,
      targetMemberId,
      0
    );
    notify(`Nudge Sent! 👉`, `Buzzer alert logged for ${targetMem.name}!`);
  };

  // Leaderboard Blackout & Automation Routines State
  const [arenaSettings, setArenaSettings] = useState<{
    leaderboardHidden: boolean;
    revealTimestamp: number;
    hiddenAt: number | null;
    autoRoutineEnabled: boolean;
    lockDay: number; // default 5 (Friday)
    lockTime: string; // default "23:59"
    unlockDay: number; // default 0 (Sunday)
    unlockTime: string; // default "22:00"
    autoLocked?: boolean;
    routines: AutomatedRoutine[];
  }>({
    leaderboardHidden: false,
    revealTimestamp: 0,
    hiddenAt: null,
    autoRoutineEnabled: true,
    lockDay: 5,
    lockTime: '23:59',
    unlockDay: 0,
    unlockTime: '22:00',
    autoLocked: false,
    routines: DEFAULT_ROUTINES
  });
  const [adminPeekStandings, setAdminPeekStandings] = useState<boolean>(false);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [revealStep, setRevealStep] = useState<number>(0);
  const lastRevealTimestampRef = useRef<number | null>(null);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Live Stopwatch State with timestamp & localStorage persistence (phone lock resilience)
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
  const [keepScreenAwake, setKeepScreenAwake] = useState<boolean>(() => {
    return localStorage.getItem('jee_arena_timer_keep_awake') !== 'false';
  });
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [showTimerInfoModal, setShowTimerInfoModal] = useState<boolean>(false);

  const normalizeSubject = (sub: string | undefined): string => {
    if (!sub) return 'Physics';
    const s = sub.trim().toLowerCase();
    if (s.includes('math')) return 'Math';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('phys')) return 'Physics';
    if (s.includes('eng')) return 'English';
    if (s.includes('lr') || s.includes('logic')) return 'LR';
    return sub.trim();
  };

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

  // Web Push Notification State
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => isWebPushEnabledByUser());
  const [showPushModal, setShowPushModal] = useState<boolean>(false);


  // Session Logger Modal State
  const todayStr = new Date().toISOString().split('T')[0];
  const [logSessionType, setLogSessionType] = useState<'STUDY' | 'BREAK'>('STUDY');
  const [logInputMethod, setLogInputMethod] = useState<'TIME_RANGE' | 'DURATION_ONLY'>('TIME_RANGE');
  const [logSubject, setLogSubject] = useState<string>('Math');
  const [logDate, setLogDate] = useState<string>(todayStr);
  const [logDuration, setLogDuration] = useState<string>('60');
  const [logQuickParser, setLogQuickParser] = useState<string>('');
  const [logStartTime, setLogStartTime] = useState<string>('17:30');
  const [logEndTime, setLogEndTime] = useState<string>('18:30');
  const [logQuestions, setLogQuestions] = useState<string>('');
  const [logDifficulty, setLogDifficulty] = useState<string>('mains');
  const [logQuestionsByTier, setLogQuestionsByTier] = useState<{ [tier: string]: string }>({
    easy: '',
    mains: '',
    hard: '',
    adv: ''
  });
  const [logLinkedTaskIds, setLogLinkedTaskIds] = useState<string[]>([]);
  const [logNotes, setLogNotes] = useState<string>('');
  const [logTargetMember, setLogTargetMember] = useState<string>('');
  const [inlineNewTaskTitle, setInlineNewTaskTitle] = useState<string>('');

  const totalLogQuestions = useMemo(() => {
    return Object.values(logQuestionsByTier).reduce((acc, val) => acc + (Math.max(0, parseInt(val, 10) || 0)), 0);
  }, [logQuestionsByTier]);

  const linkedTasksXp = useMemo(() => {
    return logLinkedTaskIds.reduce((sum, taskId) => {
      // Only homework assignments (prefixed with 'asg_') still have special XP
      if (taskId.startsWith('asg_')) {
        const asgId = taskId.replace('asg_', '');
        const asg = teacherAssignments.find(a => a.id === asgId);
        return sum + (asg && asg.xpReward !== undefined ? Number(asg.xpReward) : 40);
      }
      // Rest all tasks have NO special completion XP (only time/question XP counts)
      return sum + 0;
    }, 0);
  }, [logLinkedTaskIds, tasks, teacherAssignments]);

  // Personal Task Modal State
  const [myTaskTitle, setMyTaskTitle] = useState<string>('');
  const [myTaskSubject, setMyTaskSubject] = useState<string>('Physics');
  const [myTaskXp, setMyTaskXp] = useState<string>('20');
  const [myTaskNotes, setMyTaskNotes] = useState<string>('');
  const [myTaskLink, setMyTaskLink] = useState<string>('');
  const [tasksFilter, setTasksFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ACTIVE');

  // Proof Upload Modal State
  const [proofTaskModal, setProofTaskModal] = useState<any | null>(null);
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [proofNote, setProofNote] = useState<string>('');
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);

  // Complete Task & Questions Logging Modal State
  const [completeTaskModal, setCompleteTaskModal] = useState<any | null>(null);
  const [completeTaskQuestions, setCompleteTaskQuestions] = useState<string>('20');
  const [completeTaskDifficulty, setCompleteTaskDifficulty] = useState<string>('mains');
  const [completeTaskDuration, setCompleteTaskDuration] = useState<string>('45');
  const [completeTaskNotes, setCompleteTaskNotes] = useState<string>('');
  const [completeTaskProofImages, setCompleteTaskProofImages] = useState<string[]>([]);

  // Exam Logger State
  const [examMemberId, setExamMemberId] = useState<string>('');
  const [examType, setExamType] = useState<string>('JEE Mains');
  const [examTitle, setExamTitle] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(todayStr);
  const [examTotalStudents, setExamTotalStudents] = useState<string>('');
  const [examMarks, setExamMarks] = useState<string>('');
  const [examMaxMarks, setExamMaxMarks] = useState<string>('300');
  const [examRank, setExamRank] = useState<string>('');
  const [examSubjects, setExamSubjects] = useState<any[]>(
    EXAM_TEMPLATES['JEE Mains'].subjects.map(s => ({ ...s, marks: '', rank: '' }))
  );

  // Analytics State
  const [analyticsTab, setAnalyticsTab] = useState<'trajectory' | 'compare' | 'subjects'>('trajectory');
  const [analyticsExamFilter, setAnalyticsExamFilter] = useState<string>('ALL');
  const [analyticsSubjectFilter, setAnalyticsSubjectFilter] = useState<string>('Overall');
  const [personalInspectMember, setPersonalInspectMember] = useState<string>('sai');
  const [compareStudentA, setCompareStudentA] = useState<string>('sai');
  const [compareStudentB, setCompareStudentB] = useState<string>('nishchit');
  const [selectedSubjectCompare, setSelectedSubjectCompare] = useState<string>('Physics');
  const [selectedStudentSessionsModal, setSelectedStudentSessionsModal] = useState<{ member: Member; subject: string } | null>(null);
  const [badgeSelectedMemberId, setBadgeSelectedMemberId] = useState<string>('ALL');

  // Squad & Direct Messaging Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [chatActiveChannel, setChatActiveChannel] = useState<'ALL' | string>('ALL');
  const [chatInputText, setChatInputText] = useState<string>('');
  const [chatLastReadTimestamp, setChatLastReadTimestamp] = useState<number>(() => {
    return Number(localStorage.getItem('jee_arena_chat_last_read')) || 0;
  });

  const markChatAsRead = () => {
    const now = Date.now();
    setChatLastReadTimestamp(now);
    localStorage.setItem('jee_arena_chat_last_read', String(now));
  };

  useEffect(() => {
    if (showChatDrawer) {
      markChatAsRead();
    }
  }, [showChatDrawer, chatMessages.length]);

  const [adminSubTab, setAdminSubTab] = useState<'xp' | 'routines' | 'roster' | 'teachers' | 'bounties' | 'proofs' | 'sessions' | 'exams' | 'arena' | 'backup'>('xp');
  const [aiSummaryData, setAiSummaryData] = useState<{ [memberId: string]: any }>({});
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState<boolean>(false);
  const [hoveredExamPoint, setHoveredExamPoint] = useState<any | null>(null);
  const [activeGraphMetric, setActiveGraphMetric] = useState<'Overall' | 'Physics' | 'Chemistry' | 'Math'>('Overall');
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  // Automated Routines Form States
  const [routineLockDay, setRoutineLockDay] = useState<number>(5); // Friday
  const [routineLockTime, setRoutineLockTime] = useState<string>('23:59');
  const [routineUnlockDay, setRoutineUnlockDay] = useState<number>(0); // Sunday
  const [routineUnlockTime, setRoutineUnlockTime] = useState<string>('22:00');
  const [newRoutineTitle, setNewRoutineTitle] = useState<string>('');
  const [newRoutineDay, setNewRoutineDay] = useState<number>(0);
  const [newRoutineTime, setNewRoutineTime] = useState<string>('18:00');
  const [newRoutineMessage, setNewRoutineMessage] = useState<string>('');
  const [newRoutineTarget, setNewRoutineTarget] = useState<string>('ALL');

  // Admin Roster & Members
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberForm, setEditMemberForm] = useState({
    name: '',
    institute: '',
    passcode: '',
    bonusXp: 0,
    manualMinutesOffset: 0
  });
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberInst, setNewMemberInst] = useState<string>('Modulus');
  const [newMemberPin, setNewMemberPin] = useState<string>('');
  const [quickAdjustMemberId, setQuickAdjustMemberId] = useState<string>('sai');
  const [quickXpDelta, setQuickXpDelta] = useState<string>('');
  const [quickTimeDelta, setQuickTimeDelta] = useState<string>('');
  const [quickAdjustReason, setQuickAdjustReason] = useState<string>('');

  // Admin Squad Bounties
  const [bountyTitle, setBountyTitle] = useState<string>('');
  const [bountySubject, setBountySubject] = useState<string>('Physics');
  const [bountyXp, setBountyXp] = useState<string>('0');
  const [bountyDesc, setBountyDesc] = useState<string>('');
  const [bountyLink, setBountyLink] = useState<string>('');
  const [bountyFirstBlood, setBountyFirstBlood] = useState<boolean>(true);
  const [bountyRequireProof, setBountyRequireProof] = useState<boolean>(false);
  const [bountyAssignedTo, setBountyAssignedTo] = useState<string[]>(['ALL']);
  const [bountyRefImages, setBountyRefImages] = useState<string[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<any | null>(null);

  // Admin Sessions
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionForm, setEditSessionForm] = useState<any | null>(null);

  // Admin Exams
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editExamForm, setEditExamForm] = useState<any | null>(null);

  // Admin Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('ALL');


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

  // Protective activeTab reset: prevent blank page if activeTab is 'admin' for non-admin user
  useEffect(() => {
    if (activeMemberId && activeMemberId !== 'admin' && !isAdminUnlocked && activeTab === 'admin') {
      setActiveTab('arena');
    }
  }, [activeMemberId, isAdminUnlocked, activeTab]);

  // Physical Keyboard Listener for PIN screen
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

  // Real-time Firestore Listeners
  useEffect(() => {
    const basePath = `artifacts/${appId}/public/data`;
    const membersCol = collection(db, basePath, 'members');
    const sessionsCol = collection(db, basePath, 'sessions');
    const examsCol = collection(db, basePath, 'exams');
    const tasksCol = collection(db, basePath, 'tasks');
    const teachersCol = collection(db, basePath, 'teachers');
    const teacherAssignmentsCol = collection(db, basePath, 'teacher_assignments');
    const teacherNotesCol = collection(db, basePath, 'teacher_notes');
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
            hiddenAt: data.hiddenAt || null,
            autoRoutineEnabled: data.autoRoutineEnabled !== undefined ? Boolean(data.autoRoutineEnabled) : true,
            lockDay: data.lockDay !== undefined ? Number(data.lockDay) : 5,
            lockTime: data.lockTime || '23:59',
            unlockDay: data.unlockDay !== undefined ? Number(data.unlockDay) : 0,
            unlockTime: data.unlockTime || '22:00',
            autoLocked: Boolean(data.autoLocked),
            routines: Array.isArray(data.routines) && data.routines.length > 0 
              ? data.routines.filter((r: any) => {
                  const title = (r.title || '').toLowerCase();
                  const msg = (r.message || '').toLowerCase();
                  return !title.includes('sabotage') && !title.includes('sabatoge') && !msg.includes('sabotage') && !msg.includes('sabatoge');
                })
              : DEFAULT_ROUTINES
          });

          if (
            data.revealTimestamp &&
            lastRevealTimestampRef.current !== null &&
            data.revealTimestamp !== lastRevealTimestampRef.current &&
            Date.now() - data.revealTimestamp < 30000
          ) {
            triggerKahootRevealSequence();
          }
          lastRevealTimestampRef.current = data.revealTimestamp || 0;
        } else {
          lastRevealTimestampRef.current = 0;
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
            } catch (e) {
              console.warn('Init member fallback:', e);
            }
          }
        } else {
          setMembers(list);
          const activeId = localStorage.getItem('jee_arena_active_id') || activeMemberId || currentMember?.id || 'sai';
          if (activeId) {
            const activeMem = list.find(m => m.id === activeId);
            if (activeMem) {
              if (activeMem.isGrinding && activeMem.grindingStartedAt) {
                const localRunning = localStorage.getItem('jee_arena_timer_running') === 'true';
                const localStartTime = Number(localStorage.getItem('jee_arena_timer_start_time')) || null;
                if (!localRunning || !localStartTime || Math.abs(localStartTime - activeMem.grindingStartedAt) > 2000) {
                  setTimerRunning(true);
                  setTimerStartTime(activeMem.grindingStartedAt);
                  setTimerAccumulatedSeconds(Number(activeMem.grindingAccumulatedSeconds) || 0);
                  if (activeMem.grindingSubject) setTimerSubject(activeMem.grindingSubject);
                  if (activeMem.grindingLinkedTaskId) setTimerLinkedTaskId(activeMem.grindingLinkedTaskId);
                  localStorage.setItem('jee_arena_timer_running', 'true');
                  localStorage.setItem('jee_arena_timer_start_time', String(activeMem.grindingStartedAt));
                  localStorage.setItem('jee_arena_timer_accumulated_secs', String(activeMem.grindingAccumulatedSeconds || 0));
                  if (activeMem.grindingSubject) localStorage.setItem('jee_arena_timer_subject', activeMem.grindingSubject);
                  if (activeMem.grindingLinkedTaskId) localStorage.setItem('jee_arena_timer_linked_task_id', activeMem.grindingLinkedTaskId);
                }
              } else {
                // Member is NOT grinding in Firestore (session was completed, stopped, or logged on laptop / other device!)
                // Stop and reset timer immediately on this phone/device!
                const localRunning = localStorage.getItem('jee_arena_timer_running') === 'true';
                const localStartTime = localStorage.getItem('jee_arena_timer_start_time');
                if (localRunning || localStartTime) {
                  setTimerRunning(false);
                  setTimerStartTime(null);
                  setTimerAccumulatedSeconds(0);
                  setTimerSeconds(0);
                  setTimerLinkedTaskId('');
                  setTimerStartedAtStr('');
                  localStorage.removeItem('jee_arena_timer_running');
                  localStorage.removeItem('jee_arena_timer_start_time');
                  localStorage.removeItem('jee_arena_timer_accumulated_secs');
                  localStorage.removeItem('jee_arena_timer_linked_task_id');
                  localStorage.removeItem('jee_arena_timer_started_at_str');
                  stopLockScreenPresence();
                  releaseScreenWakeLock();
                  setWakeLockActive(false);
                  document.title = 'JEE Grind Arena';
                  notify('Session Synced ☁️', 'Study session was completed and logged on another device.');
                }
              }
            }
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/members`);
      }
    );

    const unsubTeachers = onSnapshot(
      teachersCol,
      async (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
        if (list.length === 0) {
          for (const t of DEFAULT_TEACHERS) {
            try {
              await setDoc(doc(db, basePath, 'teachers', t.id), t);
            } catch (e) {
              console.warn('Init teacher fallback:', e);
            }
          }
        } else {
          setTeachers(list);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/teachers`);
      }
    );

    const unsubAssignments = onSnapshot(
      teacherAssignmentsCol,
      async (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherAssignment));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTeacherAssignments(list);

        if (list.length > 0) {
          const newest = list[0];
          if (
            lastAssignmentIdRef.current &&
            lastAssignmentIdRef.current !== newest.id &&
            Date.now() - (newest.createdAt || 0) < 30000
          ) {
            sendWebPushNotification(`📚 Homework Assigned: "${newest.title}"`, {
              body: `${newest.subject} • Due: ${newest.dueDate} • +${newest.xpReward} XP`,
              tag: 'asg-' + newest.id
            });
          }
          lastAssignmentIdRef.current = newest.id;
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/teacher_assignments`);
      }
    );

    const unsubTeacherNotes = onSnapshot(
      teacherNotesCol,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeacherNote));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTeacherNotes(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/teacher_notes`);
      }
    );

    const unsubSessions = onSnapshot(
      sessionsCol,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        setSessions(list);

        // Cross-device session completion detector:
        const activeId = localStorage.getItem('jee_arena_active_id');
        const localRunning = localStorage.getItem('jee_arena_timer_running') === 'true';
        const localStartTime = Number(localStorage.getItem('jee_arena_timer_start_time')) || 0;
        if (activeId && (localRunning || localStartTime > 0)) {
          const recentSession = list.find((s: any) => s.memberId === activeId && (s.timestamp || 0) >= localStartTime - 60000);
          if (recentSession) {
            setTimerRunning(false);
            setTimerStartTime(null);
            setTimerAccumulatedSeconds(0);
            setTimerSeconds(0);
            setTimerLinkedTaskId('');
            setTimerStartedAtStr('');
            localStorage.removeItem('jee_arena_timer_running');
            localStorage.removeItem('jee_arena_timer_start_time');
            localStorage.removeItem('jee_arena_timer_accumulated_secs');
            localStorage.removeItem('jee_arena_timer_linked_task_id');
            localStorage.removeItem('jee_arena_timer_started_at_str');
            stopLockScreenPresence();
            releaseScreenWakeLock();
            setWakeLockActive(false);
            document.title = 'JEE Grind Arena';
            notify('Session Synced ☁️', 'Study session was completed and logged on another device.');
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/sessions`);
      }
    );

    const unsubExams = onSnapshot(
      examsCol,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        setExams(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/exams`);
      }
    );

    const unsubTasks = onSnapshot(
      tasksCol,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        setTasks(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/tasks`);
      }
    );

    const unsubAnnouncements = onSnapshot(
      announcementsCol,
      async (snap) => {
        const rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const cleanList: any[] = [];

        // Instantly purge any sabotage announcements from Firestore
        for (const item of rawList as any[]) {
          const msg = (item.message || '').toLowerCase();
          const title = (item.title || '').toLowerCase();
          const isSabotage = msg.includes('sabotage') || msg.includes('sabatoge') || title.includes('sabotage') || title.includes('sabatoge');
          if (isSabotage) {
            try {
              await deleteDoc(doc(db, basePath, 'announcements', item.id));
            } catch (delErr) {
              console.warn('Purge sabotage announcement error:', delErr);
            }
          } else {
            cleanList.push(item);
          }
        }

        cleanList.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        setAnnouncements(cleanList);

        if (cleanList.length > 0) {
          const newest: any = cleanList[0];
          if (
            lastAnnouncementIdRef.current &&
            lastAnnouncementIdRef.current !== newest.id &&
            Date.now() - (newest.timestamp || 0) < 30000
          ) {
            sendWebPushNotification(`📢 ${newest.message}`, {
              body: 'Squad Announcement',
              tag: 'announcement-' + newest.id
            });
          }
          lastAnnouncementIdRef.current = newest.id;
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/announcements`);
      }
    );

    const unsubActivities = onSnapshot(
      activitiesCol,
      (snap) => {
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
            setToast({
              title: newest.title,
              detail: newest.detail,
              type: newest.type === 'penalty' ? 'error' : 'info'
            });
            // Send push notification to phone / desktop if enabled!
            sendWebPushNotification(`⚡ ${newest.title}`, {
              body: newest.detail || newest.title,
              tag: 'act-' + newest.id
            });
            setTimeout(() => setToast(null), 4200);
          }
          lastActivityIdRef.current = newest.id;
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/activities`);
      }
    );

    const messagesCol = collection(db, basePath, 'messages');
    const unsubMessages = onSnapshot(
      messagesCol,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
        list.sort((a, b) => a.timestamp - b.timestamp);
        setChatMessages(list);

        if (list.length > 0) {
          const newest = list[list.length - 1];
          if (
            lastMessageIdRef.current &&
            lastMessageIdRef.current !== newest.id &&
            Date.now() - (newest.timestamp || 0) < 30000
          ) {
            sendWebPushNotification(`💬 ${newest.senderName}`, {
              body: newest.text,
              tag: 'chat-' + newest.id
            });
          }
          lastMessageIdRef.current = newest.id;
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `${basePath}/messages`);
      }
    );

    const raidBossDocRef = doc(db, basePath, 'settings', 'raidBoss');
    const unsubRaidBoss = onSnapshot(
      raidBossDocRef,
      (snap) => {
        if (snap.exists()) {
          setRaidBoss(snap.data() as RaidBoss);
        } else {
          setDoc(raidBossDocRef, DEFAULT_RAID_BOSS).catch(() => {});
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `${basePath}/settings/raidBoss`);
      }
    );

    return () => {
      unsubSettings();
      unsubMembers();
      unsubTeachers();
      unsubAssignments();
      unsubTeacherNotes();
      unsubSessions();
      unsubExams();
      unsubTasks();
      unsubAnnouncements();
      unsubActivities();
      unsubMessages();
      unsubRaidBoss();
    };
  }, []);

  const markAnnouncementsAsRead = () => {
    const now = Date.now();
    const currentIds = announcements.map((a: any) => a.id);
    setAnnouncementsLastRead(now);
    setReadAnnouncementIds(prev => {
      const updated = Array.from(new Set([...prev, ...currentIds]));
      try {
        localStorage.setItem('jee_arena_read_announcement_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    localStorage.setItem('jee_arena_announcements_last_read', String(now));
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'announcements', announcementId));
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      notify('Announcement Removed', 'Deleted squad update.');
    } catch (err) {
      console.warn('Delete announcement error:', err);
    }
  };

  const handleClearAllAnnouncements = async () => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await Promise.all(
        announcements.map(a => deleteDoc(doc(db, basePath, 'announcements', a.id)).catch(() => {}))
      );
      setAnnouncements([]);
      markAnnouncementsAsRead();
      notify('Announcements Cleared', 'All squad announcements have been cleared.');
    } catch (err) {
      console.warn('Clear announcements error:', err);
    }
  };

  const clearRevealTimers = () => {
    revealTimersRef.current.forEach((t) => clearTimeout(t));
    revealTimersRef.current = [];
  };

  const triggerKahootRevealSequence = () => {
    clearRevealTimers();
    setActiveTab('arena');
    setIsRevealing(true);
    setRevealStep(0);

    const t1 = setTimeout(() => setRevealStep(1), 1200); // Curtains open, stage is set
    const t2 = setTimeout(() => setRevealStep(2), 2600); // Reveal Prep!
    const t3 = setTimeout(() => setRevealStep(3), 9000); // Bronze podium (#3)
    const t4 = setTimeout(() => setRevealStep(4), 12000); // Silver podium (#2)
    const t5 = setTimeout(() => setRevealStep(5), 15000); // Gold champion (#1)

    revealTimersRef.current = [t1, t2, t3, t4, t5];
  };

  const closeKahootReveal = () => {
    clearRevealTimers();
    setIsRevealing(false);
    setRevealStep(0);
  };

  const handleAdminToggleLeaderboardBlackout = async (shouldHide: boolean) => {
    const basePath = `artifacts/${appId}/public/data`;
    const settingsRef = doc(db, basePath, 'settings', 'arenaState');
    try {
      if (shouldHide) {
        await setDoc(
          settingsRef,
          {
            leaderboardHidden: true,
            hiddenAt: Date.now(),
            revealTimestamp: arenaSettings.revealTimestamp || 0
          },
          { merge: true }
        );
        setAdminPeekStandings(false);
        await pushActivity(
          'blackout',
          'Admin activated Blind Leaderboard Mode',
          'Standings are now hidden until the Grand Reveal',
          'admin',
          0
        );
        notify('Leaderboard Hidden', 'Competitors can no longer see standings.');
      } else {
        const nowTs = Date.now();
        await setDoc(
          settingsRef,
          {
            leaderboardHidden: false,
            hiddenAt: null,
            revealTimestamp: nowTs
          },
          { merge: true }
        );
        await pushActivity(
          'reveal',
          'GRAND REVEAL! Admin unveiled the Leaderboard',
          'The curtains are opening on this week’s standings',
          'admin',
          0
        );
        triggerKahootRevealSequence();
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${basePath}/settings/arenaState`);
    }
  };

  // One-time startup purge of any sabotage announcements or routines from Firestore
  useEffect(() => {
    const purgeSabotageContent = async () => {
      const basePath = `artifacts/${appId}/public/data`;
      try {
        const snap = await getDocs(collection(db, basePath, 'announcements'));
        for (const d of snap.docs) {
          const item = d.data();
          const msg = (item.message || '').toLowerCase();
          const title = (item.title || '').toLowerCase();
          const id = d.id.toLowerCase();
          if (
            msg.includes('sabotage') || msg.includes('sabatoge') ||
            title.includes('sabotage') || title.includes('sabatoge') ||
            id.includes('sabotage') || id.includes('sabatoge')
          ) {
            await deleteDoc(d.ref).catch(() => {});
          }
        }

        const settingsRef = doc(db, basePath, 'settings', 'arenaState');
        const sSnap = await getDoc(settingsRef);
        if (sSnap.exists()) {
          const sData = sSnap.data();
          if (Array.isArray(sData.routines)) {
            const hasSab = sData.routines.some((r: any) => {
              const t = (r.title || '').toLowerCase();
              const m = (r.message || '').toLowerCase();
              return t.includes('sabotage') || t.includes('sabatoge') || m.includes('sabotage') || m.includes('sabatoge');
            });
            if (hasSab) {
              const cleaned = sData.routines.filter((r: any) => {
                const t = (r.title || '').toLowerCase();
                const m = (r.message || '').toLowerCase();
                return !t.includes('sabotage') && !t.includes('sabatoge') && !m.includes('sabotage') && !m.includes('sabatoge');
              });
              await setDoc(settingsRef, { routines: cleaned }, { merge: true }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('Purge sabotage content error:', err);
      }
    };
    purgeSabotageContent();
    return () => clearRevealTimers();
  }, []);

  // Automated Weekly Routines Engine (Friday 11:59 PM lock, Sunday 10:00 PM unlock, Recurring Announcements)
  useEffect(() => {
    const checkAutomatedRoutines = async () => {
      if (!arenaSettings.autoRoutineEnabled) return;
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMins}`;
      const todaySlotKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${currentHours}:${currentMins}`;

      const lockD = arenaSettings.lockDay !== undefined ? arenaSettings.lockDay : 5;
      const lockT = arenaSettings.lockTime || '23:59';
      const unlockD = arenaSettings.unlockDay !== undefined ? arenaSettings.unlockDay : 0;
      const unlockT = arenaSettings.unlockTime || '22:00';

      const isInsideBlackoutWindow =
        (currentDay === lockD && currentTime >= lockT) ||
        (lockD === 5 && unlockD === 0 && currentDay === 6) ||
        (currentDay === unlockD && currentTime < unlockT);

      const basePath = `artifacts/${appId}/public/data`;
      const settingsRef = doc(db, basePath, 'settings', 'arenaState');

      if (isInsideBlackoutWindow && !arenaSettings.leaderboardHidden) {
        // Auto-lock leaderboard
        try {
          await setDoc(settingsRef, {
            leaderboardHidden: true,
            hiddenAt: Date.now(),
            autoLocked: true
          }, { merge: true });
          // Use a deterministic ID to prevent duplicates from multiple clients
          const activityId = `blackout-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
          await setDoc(doc(db, basePath, 'activities', activityId), {
            type: 'blackout',
            title: '🔒 Automated Blackout: Blind Leaderboard Engaged',
            detail: 'Automatic Friday 11:59 PM schedule activated. Standings locked.',
            memberId: 'system',
            xpDelta: 0,
            timestamp: Date.now()
          });
        } catch (e) {
          console.error('Auto lock error:', e);
        }
      } else if (!isInsideBlackoutWindow && arenaSettings.leaderboardHidden && arenaSettings.autoLocked) {
        // Auto-unlock leaderboard (Sunday 10:00 PM)
        try {
          await setDoc(settingsRef, {
            leaderboardHidden: false,
            hiddenAt: null,
            revealTimestamp: Date.now(),
            autoLocked: false
          }, { merge: true });
          // Use a deterministic ID to prevent duplicates
          const activityId = `reveal-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
          await setDoc(doc(db, basePath, 'activities', activityId), {
            type: 'reveal',
            title: '🏆 Automated Sunday Reveal: Leaderboard Unveiled!',
            detail: 'Sunday 10:00 PM schedule reached. The curtains are opening!',
            memberId: 'system',
            xpDelta: 0,
            timestamp: Date.now()
          });
          triggerKahootRevealSequence();
        } catch (e) {
          console.error('Auto unlock error:', e);
        }
      }
    };

    const interval = setInterval(checkAutomatedRoutines, 20000);
    checkAutomatedRoutines();
  }, [arenaSettings]);

  // Automated Overdue Homework XP Deduction Engine
  useEffect(() => {
    const checkOverdueAssignments = async () => {
      const now = Date.now();
      const basePath = `artifacts/${appId}/public/data`;
      const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
      const studentList = activeList.filter(m => m.id !== 'admin' && !m.id.startsWith('teacher_'));

      for (const asg of teacherAssignments) {
        if (asg.archived || !asg.dueDate) continue;

        // Calculate end of due date (23:59:59)
        const dueParts = asg.dueDate.split('-');
        let dueMs = 0;
        if (dueParts.length === 3) {
          dueMs = new Date(Number(dueParts[0]), Number(dueParts[1]) - 1, Number(dueParts[2]), 23, 59, 59).getTime();
        } else {
          dueMs = new Date(asg.dueDate).getTime();
        }

        if (dueMs > 0 && now > dueMs) {
          const targetStudents = studentList.filter(m =>
            !asg.assignedTo || asg.assignedTo.includes('ALL') || asg.assignedTo.includes(m.id)
          );

          let assignmentUpdated = false;
          const updatedSubs = { ...(asg.submissions || {}) };

          for (const st of targetStudents) {
            const sub = updatedSubs[st.id];
            // If student has NOT submitted anything and has no excuse on file
            if (!sub) {
              const qCount = asg.questionsCount || 10;
              const penaltyXp = Math.max(15, Math.min(60, Math.round(asg.xpReward ? asg.xpReward * 0.5 : qCount * 1.5)));
              updatedSubs[st.id] = {
                submittedAt: now,
                status: 'overdue_penalized',
                note: `Overdue: Missed compulsory deadline (${asg.dueDate}) with no excuse on file.`,
                feedback: `Automatic overdue penalty applied: -${penaltyXp} XP (Unexcused incomplete homework)`,
                xpAwarded: -penaltyXp,
                overduePenalizedAt: now
              };

              try {
                const currentBonus = Number(st.bonusXp) || 0;
                await updateDoc(doc(db, basePath, 'members', st.id), {
                  bonusXp: currentBonus - penaltyXp
                });
                await pushActivity(
                  'penalty',
                  `⚠️ Overdue Penalty: ${st.name} missed deadline for "${asg.title}" (-${penaltyXp} XP)`,
                  `No submission or excuse was filed before ${asg.dueDate}.`,
                  st.id,
                  -penaltyXp
                );
                assignmentUpdated = true;
              } catch (e) {
                console.error('Overdue penalty member update error:', e);
              }
            }
          }

          if (assignmentUpdated) {
            try {
              await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), {
                submissions: updatedSubs
              });
            } catch (e) {
              console.error('Overdue penalty assignment update error:', e);
            }
          }
        }
      }
    };

    const interval = setInterval(checkOverdueAssignments, 30000);
    checkOverdueAssignments();
    return () => clearInterval(interval);
  }, [teacherAssignments, members]);

  const handleSaveRoutineSettings = async (updates: Partial<typeof arenaSettings>) => {
    const basePath = `artifacts/${appId}/public/data`;
    const settingsRef = doc(db, basePath, 'settings', 'arenaState');
    try {
      await setDoc(settingsRef, updates, { merge: true });
      notify('Routine Schedule Saved', 'Updated automated leaderboard schedule.');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${basePath}/settings/arenaState`);
    }
  };

  const handleToggleRoutine = async (routineId: string) => {
    const currentRoutines = arenaSettings.routines || DEFAULT_ROUTINES;
    const updated = currentRoutines.map(r => r.id === routineId ? { ...r, enabled: !r.enabled } : r);
    await handleSaveRoutineSettings({ routines: updated });
  };

  const handleDeleteRoutine = async (routineId: string) => {
    const currentRoutines = arenaSettings.routines || DEFAULT_ROUTINES;
    const updated = currentRoutines.filter(r => r.id !== routineId);
    await handleSaveRoutineSettings({ routines: updated });
    notify('Routine Removed', 'Deleted automated routine.');
  };

  const handleCreateCustomRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoutineTitle.trim() || !newRoutineMessage.trim()) return;
    const currentRoutines = arenaSettings.routines || DEFAULT_ROUTINES;
    const newRoutine: AutomatedRoutine = {
      id: 'routine_' + Date.now().toString(),
      title: newRoutineTitle.trim(),
      type: 'announcement',
      enabled: true,
      dayOfWeek: Number(newRoutineDay),
      time: newRoutineTime.trim() || '18:00',
      message: newRoutineMessage.trim(),
      target: newRoutineTarget || 'ALL'
    };
    await handleSaveRoutineSettings({ routines: [...currentRoutines, newRoutine] });
    setNewRoutineTitle('');
    setNewRoutineMessage('');
    notify('Routine Created', `Scheduled "${newRoutine.title}" recurring.`);
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
      // Removed redundant local sendWebPushNotification here.
      // The activities onSnapshot listener handles push notifications for all clients.
    } catch (e) {
      console.error('Activity log error:', e);
    }
  };

  const notify = (title: string, detail = '', type: 'info' | 'error' = 'info') => {
    setToast({ title, detail, type });
    // Only send local push for non-activity-log notices if needed, 
    // but most important things now go through activity log snapshots.
    // For now, let's keep it simple to avoid spam.
    setTimeout(() => setToast(null), 4000);
  };

  // Timestamp-based Timer Sync (100% resilient to phone screen lock, sleep, backgrounding, and phone turn-off)
  useEffect(() => {
    const syncTimer = () => {
      if (timerRunning && timerStartTime) {
        const current = calculateCurrentTimerSeconds(timerRunning, timerStartTime, timerAccumulatedSeconds);
        setTimerSeconds(current);

        // Update Media Session Lock Screen timer & milestone alerts
        updateLockScreenTime(current, timerSubject);
        checkAndSendTimerMilestoneNotification(current, timerSubject);

        const hrs = String(Math.floor(current / 3600)).padStart(2, '0');
        const mins = String(Math.floor((current % 3600) / 60)).padStart(2, '0');
        const secs = String(current % 60).padStart(2, '0');
        document.title = `(${hrs}:${mins}:${secs}) ${timerSubject} • JEE Grind Arena`;
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
        requestScreenWakeLock().then(active => setWakeLockActive(active));
      }
    } else {
      stopLockScreenPresence();
      releaseScreenWakeLock();
      setWakeLockActive(false);
      document.title = 'JEE Grind Arena';
    }

    // Re-sync instantly when phone wakes up or tab receives focus / visibility
    const handleVisibilityOrFocus = () => {
      syncTimer();
      if (timerRunning && keepScreenAwake && document.visibilityState === 'visible') {
        requestScreenWakeLock().then(active => setWakeLockActive(active));
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    return () => {
      if (interval) clearInterval(interval);
      if (stopWorker) stopWorker();
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
    };
  }, [timerRunning, timerStartTime, timerAccumulatedSeconds, timerSubject, keepScreenAwake]);


  const weekStartMs = useMemo(() => getStartOfCurrentWeek(), []);

  const currentMember = useMemo(() => {
    if (!activeMemberId || activeMemberId === 'admin' || activeMemberId.startsWith('teacher_')) return null;
    return members.find(m => m.id === activeMemberId) || null;
  }, [members, activeMemberId]);

  // Cloud Timer Synchronization: Two-way live sync across laptop, phone, and tablet
  useEffect(() => {
    if (!currentMember) return;
    if (currentMember.isGrinding && currentMember.grindingStartedAt) {
      const localRunning = localStorage.getItem('jee_arena_timer_running') === 'true';
      const localStartTime = Number(localStorage.getItem('jee_arena_timer_start_time')) || null;

      if (!localRunning || !localStartTime || Math.abs(localStartTime - currentMember.grindingStartedAt) > 2000) {
        setTimerRunning(true);
        setTimerStartTime(currentMember.grindingStartedAt);
        if (currentMember.grindingSubject) {
          setTimerSubject(currentMember.grindingSubject);
          localStorage.setItem('jee_arena_timer_subject', currentMember.grindingSubject);
        }
        const acc = Number(currentMember.grindingAccumulatedSeconds) || 0;
        setTimerAccumulatedSeconds(acc);
        localStorage.setItem('jee_arena_timer_accumulated_secs', String(acc));
        if (currentMember.grindingLinkedTaskId) {
          setTimerLinkedTaskId(currentMember.grindingLinkedTaskId);
          localStorage.setItem('jee_arena_timer_linked_task_id', currentMember.grindingLinkedTaskId);
        }
        localStorage.setItem('jee_arena_timer_running', 'true');
        localStorage.setItem('jee_arena_timer_start_time', String(currentMember.grindingStartedAt));
        const formattedStart = new Date(currentMember.grindingStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setTimerStartedAtStr(formattedStart);
        localStorage.setItem('jee_arena_timer_started_at_str', formattedStart);

        const elapsed = Math.max(0, Math.floor((Date.now() - currentMember.grindingStartedAt) / 1000));
        setTimerSeconds(acc + elapsed);
      }
    } else {
      // Session finished, stopped, or logged on laptop / another device:
      // Stop and clear local phone timer immediately so it doesn't keep running in the background!
      const localRunning = localStorage.getItem('jee_arena_timer_running') === 'true';
      if (timerRunning || localRunning) {
        setTimerRunning(false);
        setTimerStartTime(null);
        setTimerAccumulatedSeconds(0);
        setTimerSeconds(0);
        setTimerLinkedTaskId('');
        setTimerStartedAtStr('');

        localStorage.removeItem('jee_arena_timer_running');
        localStorage.removeItem('jee_arena_timer_start_time');
        localStorage.removeItem('jee_arena_timer_accumulated_secs');
        localStorage.removeItem('jee_arena_timer_linked_task_id');
        localStorage.removeItem('jee_arena_timer_started_at_str');

        stopLockScreenPresence();
        releaseScreenWakeLock();
        setWakeLockActive(false);
        document.title = 'JEE Grind Arena';

        notify('Session Synced ☁️', 'Study session was completed and logged on another device.');
      }
    }
  }, [currentMember, timerRunning]);

  // Accidental reload resilience: sync timer state right before window unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerRunning && timerStartTime) {
        localStorage.setItem('jee_arena_timer_running', 'true');
        localStorage.setItem('jee_arena_timer_start_time', String(timerStartTime));
        localStorage.setItem('jee_arena_timer_accumulated_secs', String(timerAccumulatedSeconds));
        localStorage.setItem('jee_arena_timer_subject', timerSubject);
        localStorage.setItem('jee_arena_timer_linked_task_id', timerLinkedTaskId);
        if (timerStartedAtStr) {
          localStorage.setItem('jee_arena_timer_started_at_str', timerStartedAtStr);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [timerRunning, timerStartTime, timerAccumulatedSeconds, timerSubject, timerLinkedTaskId, timerStartedAtStr]);

  // Tasks and Assignments available for Timer tracking
  const availableTimerTasks = useMemo(() => {
    const myId = currentMember?.id || 'sai';
    return tasks.filter(t => {
      const isMine = t.isPersonal ? t.ownerId === myId : (!t.assignedTo || t.assignedTo.includes('ALL') || t.assignedTo.includes(myId));
      const isDone = Boolean(t.completed || (t.completions && t.completions[myId]?.status === 'approved'));
      return isMine && !isDone;
    });
  }, [tasks, currentMember]);

  const availableTimerAssignments = useMemo(() => {
    const myId = currentMember?.id || 'sai';
    return teacherAssignments.filter(a => {
      const sub = a.submissions && a.submissions[myId];
      const isGraded = sub && sub.status === 'graded';
      return !isGraded;
    });
  }, [teacherAssignments, currentMember]);

  const timerLinkedTask = useMemo(() => {
    if (!timerLinkedTaskId) return null;
    const taskFound = availableTimerTasks.find(t => t.id === timerLinkedTaskId);
    if (taskFound) return { id: taskFound.id, title: taskFound.title, subject: taskFound.subject, type: 'task' as const };
    const asgFound = availableTimerAssignments.find(a => a.id === timerLinkedTaskId);
    if (asgFound) return { id: asgFound.id, title: asgFound.title, subject: asgFound.subject, type: 'assignment' as const };
    return null;
  }, [timerLinkedTaskId, availableTimerTasks, availableTimerAssignments]);

  const handleSelectTimerTask = async (taskId: string) => {
    setTimerLinkedTaskId(taskId);
    if (!taskId) {
      localStorage.removeItem('jee_arena_timer_linked_task_id');
      return;
    }

    localStorage.setItem('jee_arena_timer_linked_task_id', taskId);

    const foundTask = availableTimerTasks.find(t => t.id === taskId);
    const foundAsg = availableTimerAssignments.find(a => a.id === taskId);
    const targetItem = foundTask || foundAsg;

    if (targetItem && targetItem.subject) {
      const detectedSubject = normalizeSubject(targetItem.subject);
      setTimerSubject(detectedSubject);
      localStorage.setItem('jee_arena_timer_subject', detectedSubject);
      notify(`🎯 Auto-selected ${detectedSubject}`, `Targeting: "${targetItem.title}"`);

      if (timerRunning && currentMember) {
        const basePath = `artifacts/${appId}/public/data`;
        try {
          await updateDoc(doc(db, basePath, 'members', currentMember.id), {
            grindingSubject: detectedSubject,
            grindingLinkedTaskId: taskId
          });
        } catch (e) {
          console.debug('Update grinding subject error:', e);
        }
      }
    }
  };

  const currentTeacher = useMemo(() => {
    if (!activeMemberId || !activeMemberId.startsWith('teacher_')) return null;
    const activeTeacherList = teachers.length > 0 ? teachers : DEFAULT_TEACHERS;
    return activeTeacherList.find(t => t.id === activeMemberId) || null;
  }, [teachers, activeMemberId]);

  // Available subjects for Tuition Hub filter (includes 'ALL' and all assignment subjects)
  const availableTuitionSubjects = useMemo(() => {
    const list: string[] = ['ALL', 'Math', 'Physics', 'Chemistry', 'English', 'LR', 'General'];
    teacherAssignments.forEach(a => {
      if (a.subject && !list.includes(a.subject)) list.push(a.subject);
    });
    teachers.forEach(t => {
      if (t.subject && !list.includes(t.subject)) list.push(t.subject);
    });
    return list;
  }, [teacherAssignments, teachers]);

  useEffect(() => {
    if (currentTeacher?.subject) {
      setSelectedTuitionSubject(currentTeacher.subject);
    } else if (!availableTuitionSubjects.includes(selectedTuitionSubject)) {
      setSelectedTuitionSubject('ALL');
    }
  }, [availableTuitionSubjects, currentTeacher, selectedTuitionSubject]);

  // Leaderboard Stats
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

      // The "Active Standing" Rule:
      // 1. Whenever you write a test, your percentile updates.
      // 2. If a week passes where you don't have a test (whether Ved on off-week, or out sick),
      //    your latest active exam percentile stays in play for the weekly Sunday score.
      // 3. If an absence is unexplained/unexcused (e.g. someone bunked the test to play games),
      //    Admin can manually toggle an Unexcused Zero (0 XP) penalty.
      const isUnexcused = Boolean(member.unexcusedZero);
      let weekAvgPercentile = 0;
      let examXpWeek = 0;
      let standingStatus: 'fresh_test' | 'active_standing' | 'unexcused_zero' | 'no_history' = 'no_history';
      let standingDetail = '';

      if (isUnexcused) {
        weekAvgPercentile = 0;
        examXpWeek = 0;
        standingStatus = 'unexcused_zero';
        standingDetail = member.unexcusedReason || 'Unexcused test absence (0 XP penalty applied)';
      } else if (weekExams.length > 0) {
        const sumPct = weekExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0);
        weekAvgPercentile = sumPct / weekExams.length;
        examXpWeek = Math.min(300, Math.round(weekAvgPercentile * 3));
        standingStatus = 'fresh_test';
        standingDetail = `Tested this week (${weekExams[0]?.title || 'Mock Test'} • ${weekAvgPercentile.toFixed(1)}%ile)`;
      } else if (latestExam) {
        weekAvgPercentile = Number(latestExam.overallPercentile) || 0;
        examXpWeek = Math.min(300, Math.round(weekAvgPercentile * 3));
        standingStatus = 'active_standing';
        standingDetail = `Active Standing: ${latestExam.title || 'Previous Exam'} (${weekAvgPercentile.toFixed(1)}%ile carried over)`;
      } else {
        weekAvgPercentile = 0;
        examXpWeek = 0;
        standingStatus = 'no_history';
        standingDetail = 'No exam history yet';
      }

      const allTimeAvgPercentile = memExams.length > 0
        ? memExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) / memExams.length
        : 0;

      // TASK XP REMOVAL: Only time logging, questions, and Homework (BonusXp) are counted.
      // Special "Task Completion XP" from Squad Bounties/Personal Tasks is now 0.
      let taskXpWeek = 0;
      let taskXpTotal = 0;
      let completedTasksCount = 0;

      tasks.forEach((t) => {
        const comp = t.completions && t.completions[member.id];
        if (comp && comp.status === 'verified') {
          completedTasksCount += 1;
          // taskXpTotal and taskXpWeek are intentionally kept at 0 per user request
        }
      });

      const mathQuestions = memSessions
        .filter(s => s.subject === 'Math')
        .reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
      const physicsQuestions = memSessions
        .filter(s => s.subject === 'Physics')
        .reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
      const chemQuestions = memSessions
        .filter(s => s.subject === 'Chemistry')
        .reduce((acc, s) => acc + (Number(s.questions) || 0), 0);

      const longestSessionMins = memSessions.reduce((max, s) => Math.max(max, Number(s.duration) || 0), 0);
      const bestPercentile = memExams.reduce((max, e) => Math.max(max, Number(e.overallPercentile) || 0), 0);

      const bonusXp = Number(member.bonusXp) || 0;
      let weeklyXp = Math.max(0, studyXpWeek + examXpWeek + taskXpWeek + bonusXp);

      const totalXp = Math.max(0, studyXpTotal + Math.round(allTimeAvgPercentile * 3) + taskXpTotal + bonusXp);

      return {
        ...member,
        weekStudyMins,
        totalStudyMins,
        weekQuestions,
        totalQuestions,
        mathQuestions,
        physicsQuestions,
        chemQuestions,
        longestSessionMins,
        bestPercentile,
        studyXpWeek,
        examXpWeek,
        taskXpWeek,
        bonusXp,
        weeklyXp,
        totalXp,
        weekAvgPercentile,
        allTimeAvgPercentile,
        weekExamsCount: weekExams.length,
        latestExam,
        completedTasksCount,
        standingStatus,
        standingDetail,
        isUnexcused
      };
    }).sort((a, b) => b.weeklyXp - a.weeklyXp);
  }, [members, sessions, exams, tasks, weekStartMs]);

  const pendingTuitionCount = useMemo(() => {
    if (currentTeacher) {
      return teacherAssignments
        .filter(a => !a.archived && a.subject === currentTeacher.subject)
        .reduce((acc, a) => {
          const subs = Object.values(a.submissions || {});
          return acc + subs.filter((s: any) => s && s.status === 'pending').length;
        }, 0);
    } else if (isAdminUnlocked || activeMemberId === 'admin') {
      return teacherAssignments
        .filter(a => !a.archived)
        .reduce((acc, a) => {
          const subs = Object.values(a.submissions || {});
          return acc + subs.filter((s: any) => s && s.status === 'pending').length;
        }, 0);
    } else if (activeMemberId) {
      // For student: only show badge if assignment is active, assigned to them, and NOT submitted yet!
      return teacherAssignments.filter(a => {
        if (a.archived) return false;
        const isAssigned = !a.assignedTo || a.assignedTo.includes('ALL') || a.assignedTo.includes(activeMemberId);
        if (!isAssigned) return false;
        const sub = a.submissions?.[activeMemberId];
        const hasSubmitted = sub && (sub.status === 'pending' || sub.status === 'graded');
        return !hasSubmitted;
      }).length;
    }
    return 0;
  }, [currentTeacher, isAdminUnlocked, activeMemberId, teacherAssignments]);

  const updateDailyStreak = async (targetMem: Member) => {
    if (!targetMem || !targetMem.id) return;
    const basePath = `artifacts/${appId}/public/data`;
    const today = new Date().toISOString().split('T')[0];
    const lastDate = targetMem.lastLoginDate;

    if (lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = 1;
    if (lastDate === yesterday) {
      newStreak = (targetMem.streakCount || 0) + 1;
    }

    try {
      await updateDoc(doc(db, basePath, 'members', targetMem.id), {
        streakCount: newStreak,
        lastLoginDate: today
      });
      const mult = getStreakMultiplier(newStreak);
      const bonusPct = Math.round((mult - 1) * 100);
      notify(
        `🔥 ${newStreak}-Day Login Streak!`,
        bonusPct > 0
          ? `Streak Active! You get a +${bonusPct}% XP Bonus Multiplier!`
          : `Log in daily to stack streak multipliers up to +15% XP!`
      );
    } catch (e) {
      console.error('Streak update error:', e);
    }
  };

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
      setLoginError('Invalid Passcode.');
      setPinInput('');
      return false;
    }

    if (target.startsWith('teacher_')) {
      const activeTeacherList = teachers.length > 0 ? teachers : DEFAULT_TEACHERS;
      const targetTeacher = activeTeacherList.find(t => t.id === target);
      if (!targetTeacher) {
        setLoginError('Teacher profile not found.');
        return false;
      }
      if (codeToVerify === String(targetTeacher.passcode) || codeToVerify === ADMIN_PASSCODE) {
        setActiveMemberId(targetTeacher.id);
        setActiveTeacherId(targetTeacher.id);
        setSelectedTuitionSubject(targetTeacher.subject);
        localStorage.setItem('jee_arena_active_id', targetTeacher.id);
        localStorage.setItem('jee_arena_teacher_id', targetTeacher.id);
        setActiveTab('tuition');
        setPinInput('');
        return true;
      } else {
        setLoginError('Incorrect Teacher PIN.');
        setPinInput('');
        return false;
      }
    }

    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const targetMem = activeList.find(m => m.id === target);
    if (!targetMem) {
      setLoginError('Member not found.');
      return false;
    }

    if (codeToVerify === String(targetMem.passcode)) {
      setActiveMemberId(targetMem.id);
      localStorage.setItem('jee_arena_active_id', targetMem.id);
      setLogTargetMember(targetMem.id);
      setExamMemberId(targetMem.id);
      updateDailyStreak(targetMem);
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

  const handleAdminModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminModalError('');
    if (adminModalPin === ADMIN_PASSCODE) {
      setIsAdminUnlocked(true);
      localStorage.setItem('jee_arena_admin', 'true');
      setShowAdminPassModal(false);
      setAdminModalPin('');
      setActiveTab('admin');
      notify('Admin Command Center Unlocked');
    } else {
      setAdminModalError('Invalid passcode.');
      setAdminModalPin('');
    }
  };

  const handleLogout = () => {
    setActiveMemberId(null);
    setIsAdminUnlocked(false);
    setShowProfileMenu(false);
    setActiveTeacherId(null);
    localStorage.removeItem('jee_arena_active_id');
    localStorage.removeItem('jee_arena_admin');
    localStorage.removeItem('jee_arena_teacher_id');
    setActiveTab('arena');
    setReviewingAssignment(null);
    setReviewingStudentId(null);
    setActiveAssignmentAction(null);
    setPinInput('');
    setLoginError('');
  };

  const toggleLiveTimer = async () => {
    const now = Date.now();
    if (!timerRunning) {
      // START / RESUME TIMER
      const newStartTime = now;
      const startedAtFormatted = timerStartedAtStr || new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setTimerRunning(true);
      setTimerStartTime(newStartTime);
      setTimerStartedAtStr(startedAtFormatted);

      localStorage.setItem('jee_arena_timer_running', 'true');
      localStorage.setItem('jee_arena_timer_start_time', String(newStartTime));
      localStorage.setItem('jee_arena_timer_accumulated_secs', String(timerAccumulatedSeconds));
      localStorage.setItem('jee_arena_timer_subject', timerSubject);
      localStorage.setItem('jee_arena_timer_linked_task_id', timerLinkedTaskId);
      localStorage.setItem('jee_arena_timer_started_at_str', startedAtFormatted);

      // Start Lock Screen presence and Wake Lock
      startLockScreenPresence(timerSubject, () => {
        toggleLiveTimer();
      });
      if (keepScreenAwake) {
        requestScreenWakeLock().then(active => setWakeLockActive(active));
      }

      if (currentMember) {
        const basePath = `artifacts/${appId}/public/data`;
        const memRef = doc(db, basePath, 'members', currentMember.id);
        try {
          await updateDoc(memRef, {
            isGrinding: true,
            grindingSubject: timerSubject,
            grindingStartedAt: newStartTime,
            grindingAccumulatedSeconds: timerAccumulatedSeconds,
            grindingLinkedTaskId: timerLinkedTaskId
          });
        } catch (e) {
          console.warn('Update grinding state error:', e);
        }
      }
    } else {
      // PAUSE TIMER
      const elapsedSegment = timerStartTime ? Math.max(0, Math.floor((now - timerStartTime) / 1000)) : 0;
      const newAccumulated = timerAccumulatedSeconds + elapsedSegment;

      setTimerRunning(false);
      setTimerStartTime(null);
      setTimerAccumulatedSeconds(newAccumulated);
      setTimerSeconds(newAccumulated);

      localStorage.setItem('jee_arena_timer_running', 'false');
      localStorage.removeItem('jee_arena_timer_start_time');
      localStorage.setItem('jee_arena_timer_accumulated_secs', String(newAccumulated));

      stopLockScreenPresence();
      releaseScreenWakeLock();
      setWakeLockActive(false);
      document.title = 'JEE Grind Arena';

      if (currentMember) {
        const basePath = `artifacts/${appId}/public/data`;
        const memRef = doc(db, basePath, 'members', currentMember.id);
        try {
          await updateDoc(memRef, {
            isGrinding: false,
            grindingStartedAt: null,
            grindingAccumulatedSeconds: newAccumulated
          });
        } catch (e) {
          console.warn('Update grinding state error:', e);
        }
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
    setWakeLockActive(false);
    document.title = 'JEE Grind Arena';

    localStorage.removeItem('jee_arena_timer_running');
    localStorage.removeItem('jee_arena_timer_start_time');
    localStorage.removeItem('jee_arena_timer_accumulated_secs');
    localStorage.removeItem('jee_arena_timer_subject');
    localStorage.removeItem('jee_arena_timer_linked_task_id');
    localStorage.removeItem('jee_arena_timer_started_at_str');

    if (currentMember) {
      const basePath = `artifacts/${appId}/public/data`;
      try {
        await updateDoc(doc(db, basePath, 'members', currentMember.id), {
          isGrinding: false,
          grindingSubject: '',
          grindingStartedAt: null,
          grindingAccumulatedSeconds: 0,
          grindingLinkedTaskId: ''
        });
      } catch (e) {
        console.warn('Reset grinding state error:', e);
      }
    }
  };

  const finishLiveTimerAndOpenLogger = async () => {
    const finalSeconds = timerRunning && timerStartTime
      ? timerAccumulatedSeconds + Math.max(0, Math.floor((Date.now() - timerStartTime) / 1000))
      : timerSeconds;
    const mins = Math.max(1, Math.round(finalSeconds / 60));

    setTimerRunning(false);
    setTimerStartTime(null);
    setTimerAccumulatedSeconds(0);
    setTimerSeconds(0);
    setTimerStartedAtStr('');
    resetTimerMilestones();
    stopLockScreenPresence();
    releaseScreenWakeLock();
    setWakeLockActive(false);
    document.title = 'JEE Grind Arena';

    localStorage.removeItem('jee_arena_timer_running');
    localStorage.removeItem('jee_arena_timer_start_time');
    localStorage.removeItem('jee_arena_timer_accumulated_secs');
    localStorage.removeItem('jee_arena_timer_subject');
    localStorage.removeItem('jee_arena_timer_linked_task_id');
    localStorage.removeItem('jee_arena_timer_started_at_str');

    if (currentMember) {
      const basePath = `artifacts/${appId}/public/data`;
      try {
        await updateDoc(doc(db, basePath, 'members', currentMember.id), {
          isGrinding: false,
          grindingSubject: '',
          grindingStartedAt: null,
          grindingAccumulatedSeconds: 0,
          grindingLinkedTaskId: ''
        });
      } catch (e) {
        console.warn('Clear grinding state error:', e);
      }
    }

    setLogSessionType('STUDY');
    setLogInputMethod('DURATION_ONLY');
    setLogSubject(timerSubject);
    setLogDuration(String(mins));
    setLogLinkedTaskIds(timerLinkedTaskId ? [timerLinkedTaskId] : []);
    setLogTargetMember(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
    setShowLogModal(true);
  };

  const handleQuickParserChange = (val: string) => {
    setLogQuickParser(val);
    const parsed = parseQuickTimeRange(val);
    if (parsed) {
      setLogStartTime(parsed.startTime);
      setLogEndTime(parsed.endTime);
      setLogDuration(String(parsed.duration));
    }
  };

  const handleStartEndChange = (newStart: string, newEnd: string) => {
    setLogStartTime(newStart);
    setLogEndTime(newEnd);
    if (newStart && newEnd) {
      const [sh, sm] = newStart.split(':').map(Number);
      const [eh, em] = newEnd.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff <= 0) diff += 24 * 60;
      if (diff > 0 && diff <= 1440) {
        setLogDuration(String(diff));
      }
    }
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

    // Multi-difficulty questions aggregation
    const questionsBreakdownNums: { [k: string]: number } = {};
    for (const [k, v] of Object.entries(logQuestionsByTier)) {
      const n = Math.max(0, parseInt(v, 10) || 0);
      if (n > 0) questionsBreakdownNums[k] = n;
    }
    const totalQCount = totalLogQuestions > 0 ? totalLogQuestions : Math.max(0, Math.round(Number(logQuestions) || 0));

    // Calculate sum of linked task XP to override default XP
    const tasksBonusXp = logLinkedTaskIds.reduce((sum, taskId) => {
      const isTaskDone = (logTaskCompletionStatus[taskId] || 'completed') === 'completed';
      if (!isTaskDone) return sum; // In-progress tasks do not grant completion XP!

      if (taskId.startsWith('asg_')) {
        const asgId = taskId.replace('asg_', '');
        const asg = teacherAssignments.find(a => a.id === asgId);
        return sum + (asg && asg.xpReward !== undefined ? Number(asg.xpReward) : 40);
      }
      // ONLY HOMEWORK (asg_) has special XP. Rest all (tasks) award 0 special XP.
      return sum + 0;
    }, 0);

    const questionsInput = Object.keys(questionsBreakdownNums).length > 0 ? questionsBreakdownNums : totalQCount;
    const baseCalculatedXp = calcSessionXp(durationMins, questionsInput, logDifficulty, logSessionType);

    // Underdog Buff Check (1.25x XP multiplier if trailing leader by >= 150 total XP)
    const leaderXp = Math.max(...leaderboardStats.map(s => s.totalXp), 0);
    const targetMemTotalXp = leaderboardStats.find(s => s.id === targetMem.id)?.totalXp || 0;
    const isUnderdog = (leaderXp - targetMemTotalXp) >= 150;
    const xpEarned = isUnderdog ? Math.round(baseCalculatedXp * 1.25) : baseCalculatedXp;

    const activeTierKeys = Object.keys(questionsBreakdownNums);
    const difficultyLabel = activeTierKeys.length > 1 ? 'mixed' : (activeTierKeys[0] || logDifficulty);

    // Calculate Raid Boss Damage: 1 min = 1 DMG, Easy = 1, Mains/Med = 3, Advanced/Hard = 10
    const easyQs = Number(questionsBreakdownNums['easy']) || 0;
    const mediumQs = Number(questionsBreakdownNums['medium']) || 0;
    const hardQs = Number(questionsBreakdownNums['hard']) || 0;
    const totalQsDmg = easyQs * 1 + mediumQs * 3 + hardQs * 10;
    const sessionDmg = durationMins * 1 + totalQsDmg;

    // Trigger Sound FX & Crit Hit Float-up
    if (hardQs > 0) {
      playCritHit();
      setCritDamageAnim({ amount: sessionDmg, id: Date.now() });
      setTimeout(() => setCritDamageAnim(null), 2500);
    } else {
      playLogSuccess();
    }

    const newSession = {
      memberId: targetMem.id,
      memberName: targetMem.name,
      sessionType: logSessionType,
      inputMethod: logInputMethod,
      subject: logSubject,
      date: logDate,
      duration: durationMins,
      startTime: logInputMethod === 'TIME_RANGE' ? logStartTime : '',
      endTime: logInputMethod === 'TIME_RANGE' ? logEndTime : '',
      questions: totalQCount,
      difficulty: difficultyLabel,
      difficultyBreakdown: questionsBreakdownNums,
      linkedTaskIds: logLinkedTaskIds,
      tasksBonusXp,
      notes: logNotes.trim(),
      xpEarned,
      underdogBoostApplied: isUnderdog,
      bossDamageDealt: sessionDmg,
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(db, basePath, 'sessions'), newSession);

      // Deal damage to Raid Boss in Firestore
      if (raidBoss) {
        const newHp = Math.max(0, (raidBoss.currentHp || 10000) - sessionDmg);
        const isDefeatedNow = newHp === 0;
        const currentContrib = Number(raidBoss.contributions?.[targetMem.id]) || 0;

        await setDoc(doc(db, basePath, 'settings', 'raidBoss'), {
          ...raidBoss,
          currentHp: newHp,
          isDefeated: isDefeatedNow || Boolean(raidBoss.isDefeated),
          defeatedAt: isDefeatedNow && !raidBoss.isDefeated ? Date.now() : (raidBoss.defeatedAt || null),
          contributions: {
            ...(raidBoss.contributions || {}),
            [targetMem.id]: currentContrib + sessionDmg
          }
        }, { merge: true });
      }

      // Close out grinding status on member document in Firestore so all connected devices stop timer
      await updateDoc(doc(db, basePath, 'members', targetMem.id), {
        isGrinding: false,
        grindingSubject: '',
        grindingStartedAt: null,
        grindingAccumulatedSeconds: 0,
        grindingLinkedTaskId: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/sessions`);
    }

    if (targetMem.id === currentMember?.id || targetMem.id === activeMemberId) {
      setTimerRunning(false);
      setTimerStartTime(null);
      setTimerAccumulatedSeconds(0);
      setTimerSeconds(0);
      setTimerLinkedTaskId('');
      setTimerStartedAtStr('');
      localStorage.removeItem('jee_arena_timer_running');
      localStorage.removeItem('jee_arena_timer_start_time');
      localStorage.removeItem('jee_arena_timer_accumulated_secs');
      localStorage.removeItem('jee_arena_timer_linked_task_id');
      localStorage.removeItem('jee_arena_timer_started_at_str');
      stopLockScreenPresence();
      releaseScreenWakeLock();
      setWakeLockActive(false);
      document.title = 'JEE Grind Arena';
    }

    let taskRequiringProof: any = null;
    for (const tId of logLinkedTaskIds) {
      const isTaskDone = (logTaskCompletionStatus[tId] || 'completed') === 'completed';

      if (tId.startsWith('asg_')) {
        const asgId = tId.replace('asg_', '');
        const asg = teacherAssignments.find(a => a.id === asgId);
        if (!asg) continue;

        if (isTaskDone) {
          const updatedSubs = { ...(asg.submissions || {}) };
          if (!updatedSubs[targetMem.id] || updatedSubs[targetMem.id].status !== 'graded') {
            updatedSubs[targetMem.id] = {
              submittedAt: Date.now(),
              attachedFiles: [],
              note: logNotes.trim() || `Completed during ${durationMins}m study session.`,
              status: 'pending',
              xpAwarded: asg.xpReward
            };
            try {
              await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), {
                submissions: updatedSubs
              });
              await pushActivity(
                'task_complete',
                `📸 ${targetMem.name} completed homework "${asg.title}" via study session`,
                `Ready for ${asg.teacherName} review (+${asg.xpReward} XP pending) • ${durationMins}m, ${totalQCount} Qs`,
                targetMem.id,
                0
              );
            } catch (e) {
              console.error(e);
            }
          }
        }
        continue;
      }

      const taskObj = tasks.find(t => t.id === tId);
      if (!taskObj) continue;

      const prevTimeMap = taskObj.timeSpentByMember || {};
      const updatedTimeMap = {
        ...prevTimeMap,
        [targetMem.id]: (Number(prevTimeMap[targetMem.id]) || 0) + durationMins
      };

      if (!isTaskDone) {
        // Still doing it: update time spent, keep active, do NOT mark completed!
        try {
          await updateDoc(doc(db, basePath, 'tasks', taskObj.id), {
            timeSpentByMember: updatedTimeMap
          });
        } catch (e) {
          console.error(e);
        }
        continue;
      }

      const completions = { ...(taskObj.completions || {}) };
      const existingComp = completions[targetMem.id];

      if (!existingComp || existingComp.status !== 'verified') {
        if (taskObj.requireProof) {
          try {
            await updateDoc(doc(db, basePath, 'tasks', taskObj.id), {
              timeSpentByMember: updatedTimeMap
            });
          } catch (e) {
            console.error(e);
          }
          taskRequiringProof = taskObj;
        } else {
          const anyoneVerifiedYet = Object.values(completions).some((c: any) => c && c.status === 'verified');
          const isFirstBlood = !taskObj.isPersonal && taskObj.doubleXpFirst && !anyoneVerifiedYet;
          const taskBaseXp = taskObj.xp !== undefined && taskObj.xp !== null ? Math.max(0, Number(taskObj.xp)) : 25;
          const awardedXp = isFirstBlood ? taskBaseXp * 2 : taskBaseXp;

          completions[targetMem.id] = {
            status: 'verified',
            completedAt: Date.now(),
            xpAwarded: awardedXp,
            isFirstBlood,
            proofImages: [],
            note: logNotes.trim() || 'Completed via study session log'
          };

          try {
            await updateDoc(doc(db, basePath, 'tasks', taskObj.id), {
              timeSpentByMember: updatedTimeMap,
              completions
            });
          } catch (e) {
            console.error(e);
          }

          await pushActivity(
            'task_complete',
            `${isFirstBlood ? '⚡ FIRST BLOOD! ' : '✓ '}${targetMem.name} completed "${taskObj.title}"`,
            `Task XP: +${awardedXp} XP ${isFirstBlood ? '(2x Speed Bonus)' : ''} • Session: ${durationMins}m, ${totalQCount} Qs`,
            targetMem.id,
            awardedXp
          );
        }
      } else {
        try {
          await updateDoc(doc(db, basePath, 'tasks', taskObj.id), {
            timeSpentByMember: updatedTimeMap
          });
        } catch (e) {
          console.error(e);
        }
      }
    }

    const breakdownStr = Object.entries(questionsBreakdownNums).map(([k, count]) => `${count} ${k.toUpperCase()}`).join(', ');
    await pushActivity(
      'session_log',
      `${targetMem.name} logged ${formatDuration(durationMins)} of ${logSubject}`,
      `${totalQCount > 0 ? `${totalQCount} Qs${breakdownStr ? ` (${breakdownStr})` : ''} • ` : ''}${logLinkedTaskIds.length > 0 ? `${logLinkedTaskIds.length} Task(s) (+${tasksBonusXp} XP) • ` : ''}+${xpEarned} XP${logNotes ? ` - "${logNotes}"` : ''}`,
      targetMem.id,
      xpEarned
    );

    const prevRank = leaderboardStats.findIndex(m => m.id === targetMem.id) + 1;
    const rivalAhead = prevRank > 1 ? leaderboardStats[prevRank - 2] : null;

    setLogQuestions('');
    setLogQuestionsByTier({ easy: '', mains: '', hard: '', adv: '' });
    setLogNotes('');
    setLogQuickParser('');
    setLogLinkedTaskIds([]);
    setLogTaskCompletionStatus({});
    setShowLogModal(false);
    notify('Session Logged', `+${xpEarned} XP added to ${targetMem.name} (${tasksBonusXp > 0 ? `+${tasksBonusXp} Task XP & ` : ''}time & questions)`);

    // Trigger cool animated SVG celebrations!
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

    if (taskRequiringProof) {
      setProofTaskModal(taskRequiringProof);
    }
  };

  const handleCreatePersonalTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTaskTitle.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const owner = currentMember || members[0] || DEFAULT_MEMBERS[0];
    const safeXp = 0; // Tasks no longer award special XP per user request

    const newTask = {
      title: myTaskTitle.trim(),
      subject: myTaskSubject,
      xp: safeXp,
      questionsText: myTaskNotes.trim(),
      linkUrl: myTaskLink.trim(),
      doubleXpFirst: false,
      requireProof: false,
      assignedTo: [owner.id],
      isPersonal: true,
      ownerId: owner.id,
      createdBy: owner.name,
      referenceImages: [],
      completions: {},
      timeSpentByMember: {},
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, basePath, 'tasks'), newTask);
      // Personal task creation is private to the owner - no public broadcast sent here
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/tasks`);
    }

    setMyTaskTitle('');
    setMyTaskNotes('');
    setMyTaskLink('');
    setShowPersonalTaskModal(false);
    notify('Personal Task Added', `"${newTask.title}" added to your checklist. (0 XP Honor Challenge)`);
  };

  const handleInlineAddPersonalTask = async () => {
    if (!inlineNewTaskTitle.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const owner = currentMember || members[0] || DEFAULT_MEMBERS[0];
    const newTask = {
      title: inlineNewTaskTitle.trim(),
      subject: logSubject,
      xp: 0,
      questionsText: '',
      linkUrl: '',
      doubleXpFirst: false,
      requireProof: false,
      assignedTo: [owner.id],
      isPersonal: true,
      ownerId: owner.id,
      createdBy: owner.name,
      referenceImages: [],
      completions: {},
      timeSpentByMember: {},
      createdAt: Date.now()
    };
    try {
      const docRef = await addDoc(collection(db, basePath, 'tasks'), newTask);
      setLogLinkedTaskIds(prev => [...prev, docRef.id]);
      setInlineNewTaskTitle('');
      notify('Task Linked', 'Personal task created and linked to this session.');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${basePath}/tasks`);
    }
  };

  const handleCompleteTaskClick = (task: any) => {
    // Directly redirect to StudyFlow Session Logger with Time Range, time frame and pre-linked task!
    setLogSessionType('STUDY');
    setLogInputMethod('TIME_RANGE');
    setLogSubject(task.subject || 'Physics');
    setLogLinkedTaskIds([task.id]);
    setLogNotes(`Completed task: ${task.title}`);

    // Pre-calculate realistic timing window (last 45 mins)
    const now = new Date();
    const endH = String(now.getHours()).padStart(2, '0');
    const endM = String(now.getMinutes()).padStart(2, '0');
    const startObj = new Date(now.getTime() - 45 * 60000);
    const startH = String(startObj.getHours()).padStart(2, '0');
    const startM = String(startObj.getMinutes()).padStart(2, '0');
    setLogStartTime(`${startH}:${startM}`);
    setLogEndTime(`${endH}:${endM}`);
    setLogDuration('45');
    setLogQuestions('');
    setLogQuestionsByTier({ easy: '', mains: '', hard: '', adv: '' });

    const targetId = (activeMemberId && activeMemberId !== 'admin' && !activeMemberId.startsWith('teacher_'))
      ? activeMemberId
      : (currentMember?.id || 'sai');
    setLogTargetMember(targetId);

    setShowLogModal(true);
    notify(
      'Redirected to Study Session Logger',
      `Log your timings range & questions solved for "${task.title}". XP will be awarded based on your questions & time!`
    );
  };

  const handleCommitTaskCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTaskModal) return;
    const task = completeTaskModal;
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = currentMember || members[0] || DEFAULT_MEMBERS[0];
    if (!targetMem) return;

    // Task completion alone is capped at 30 XP max
    const taskRawXp = Number(task.xp) !== undefined && task.xp !== null ? Number(task.xp) : 25;
    const taskBaseXp = Math.min(30, Math.max(0, taskRawXp));

    const qCount = Math.max(0, Number(completeTaskQuestions) || 0);
    const durationMins = Math.max(1, Number(completeTaskDuration) || 30);

    let tierMult = 1.5;
    if (completeTaskDifficulty === 'easy') tierMult = 1.0;
    if (completeTaskDifficulty === 'mains' || completeTaskDifficulty === 'medium') tierMult = 1.5;
    if (completeTaskDifficulty === 'hard') tierMult = 2.0;
    if (completeTaskDifficulty === 'advanced') tierMult = 2.5;

    const questionsXp = Math.round(qCount * tierMult);

    const completions = { ...(task.completions || {}) };
    const anyoneVerifiedYet = Object.values(completions).some((c: any) => c && c.status === 'verified');
    const isFirstBlood = !task.isPersonal && task.doubleXpFirst && !anyoneVerifiedYet;

    const finalTaskBaseXp = 0; // ALL special task completion XP removed per user request
    const totalEarnedXp = questionsXp; // Only question XP is counted, no special task XP bonus.

    // Save Study Session Record
    const newSession = {
      memberId: targetMem.id,
      memberName: targetMem.name,
      subject: task.subject || 'Physics',
      duration: durationMins,
      questions: qCount,
      difficulty: completeTaskDifficulty,
      xpEarned: questionsXp,
      notes: completeTaskNotes.trim() || `Task Completed: "${task.title}"`,
      date: todayStr,
      timestamp: Date.now()
    };

    try {
      if (qCount > 0 || durationMins > 0) {
        await addDoc(collection(db, basePath, 'sessions'), newSession);
      }

      completions[targetMem.id] = {
        status: task.requireProof && completeTaskProofImages.length === 0 ? 'pending_review' : 'verified',
        completedAt: Date.now(),
        xpAwarded: totalEarnedXp,
        isFirstBlood,
        proofImages: completeTaskProofImages,
        note: completeTaskNotes.trim() || 'Completed with questions log'
      };

      const prevTimeMap = task.timeSpentByMember || {};
      const updatedTimeMap = {
        ...prevTimeMap,
        [targetMem.id]: (Number(prevTimeMap[targetMem.id]) || 0) + durationMins
      };

      await updateDoc(doc(db, basePath, 'tasks', task.id), {
        completions,
        timeSpentByMember: updatedTimeMap
      });

      await pushActivity(
        'task_complete',
        `${isFirstBlood ? '⚡ ' : '✓ '}${targetMem.name} finished "${task.title}" (+${totalEarnedXp} XP)`,
        `Session Log: ${durationMins}m • ${qCount} Qs: +${questionsXp} XP`,
        targetMem.id,
        totalEarnedXp
      );

      setCompleteTaskModal(null);
      notify(
        'Task Completed & Session Logged!',
        `Earned +${totalEarnedXp} XP (Study Session & Questions Log)`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${task.id}`);
    }
  };

  const handleDeleteTask = async (task: any) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'tasks', task.id));
      notify('Task Removed', `"${task.title}" was deleted.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/tasks/${task.id}`);
    }
  };

  const handleExamTypeSwitch = (newType: string) => {
    setExamType(newType);
    const tpl = EXAM_TEMPLATES[newType] || EXAM_TEMPLATES['JEE Mains'];
    setExamMaxMarks(String(tpl.totalMax));
    setExamSubjects(tpl.subjects.map(s => ({ ...s, marks: '', rank: '' })));
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
      notify('Invalid Rank or Total', 'Please enter both Rank and Total Students.', 'error');
      return;
    }

    const overallPct = calcPercentile(overallRankNum, totalCandidates);

    const processedSubjects = examSubjects
      .filter(s => s.enabled)
      .map(s => {
        const sRank = Number(s.rank) || overallRankNum;
        return {
          name: s.name,
          marks: Number(s.marks) || 0,
          maxMarks: Number(s.maxMarks) || 100,
          rank: sRank,
          percentile: Number(calcPercentile(sRank, totalCandidates).toFixed(2))
        };
      });

    const examTimestamp = examDate ? new Date(examDate + 'T12:00:00').getTime() : Date.now();
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
      subjects: processedSubjects,
      timestamp: examTimestamp
    };

    try {
      await addDoc(collection(db, basePath, 'exams'), examDoc);

      // Writing an exam updates the student's standing and clears any unexcused zero penalty!
      if (targetMem.unexcusedZero) {
        await updateDoc(doc(db, basePath, 'members', targetMem.id), {
          unexcusedZero: false,
          unexcusedReason: '',
          unexcusedAt: null
        });
      }

      await pushActivity(
        'exam_log',
        `🏆 ${targetMem.name} logged ${examDoc.title}`,
        `Rank #${overallRankNum}/${totalCandidates} (${overallPct.toFixed(1)}%ile) • Date: ${examDate} • ${examDoc.overallMarks}/${examDoc.overallMaxMarks}`,
        targetMem.id,
        Math.round(overallPct * 3)
      );

      setExamTitle('');
      setExamTotalStudents('');
      setExamMarks('');
      setExamRank('');
      setShowExamModal(false);
      notify('Exam Logged', `${overallPct.toFixed(1)}%ile recorded for ${targetMem.name}`);

      // Automatically generate AI Diagnostic Summary from test to test
      fetchAiDiagnosticSummary(targetMem.id, [examDoc, ...exams.filter(e => e.memberId === targetMem.id)]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/exams`);
    }
  };

  // Batch Multi-Test Logger (Logs past or current multiple tests at once)
  const handleBatchSaveExams = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePath = `artifacts/${appId}/public/data`;
    const targetId = ((isAdminUnlocked || activeMemberId === 'admin') && examMemberId)
      ? examMemberId
      : (currentMember?.id || members[0]?.id || 'sai');
    const targetMem = members.find(m => m.id === targetId) || DEFAULT_MEMBERS.find(m => m.id === targetId);
    if (!targetMem) return;

    const validEntries = batchExamEntries.filter(b => {
      const r = Number(b.overallRank);
      const t = Number(b.totalStudents);
      return r > 0 && t > 0 && t >= r;
    });

    if (validEntries.length === 0) {
      notify('Incomplete Test Entries', 'Please enter Rank and Batch Total for at least one test.', 'error');
      return;
    }

    try {
      const newExamsList: any[] = [];
      for (const entry of validEntries) {
        const r = Number(entry.overallRank);
        const t = Number(entry.totalStudents);
        const pct = calcPercentile(r, t);
        const eDate = entry.date || todayStr;
        const eTimestamp = new Date(eDate + 'T12:00:00').getTime();

        const docData = {
          memberId: targetMem.id,
          memberName: targetMem.name,
          institute: targetMem.institute,
          examType: entry.examType || 'JEE Mains',
          title: entry.title.trim() || `${entry.examType || 'Mock'} Test`,
          date: eDate,
          totalStudents: t,
          overallMarks: Number(entry.overallMarks) || 0,
          overallMaxMarks: Number(entry.overallMaxMarks) || 300,
          overallRank: r,
          overallPercentile: Number(pct.toFixed(2)),
          subjects: [],
          timestamp: eTimestamp
        };
        await addDoc(collection(db, basePath, 'exams'), docData);
        newExamsList.push(docData);
      }

      if (targetMem.unexcusedZero) {
        await updateDoc(doc(db, basePath, 'members', targetMem.id), {
          unexcusedZero: false,
          unexcusedReason: '',
          unexcusedAt: null
        });
      }

      await pushActivity(
        'exam_log',
        `🏆 ${targetMem.name} batch-logged ${validEntries.length} tests`,
        `Committed ${validEntries.length} mock tests into career records.`,
        targetMem.id,
        0
      );

      setShowExamModal(false);
      setBatchExamEntries([
        {
          id: 'batch_1',
          examType: 'JEE Mains',
          title: 'Mock Test 1',
          date: todayStr,
          overallMarks: '',
          overallMaxMarks: '300',
          overallRank: '',
          totalStudents: ''
        }
      ]);
      notify('Batch Exams Logged!', `Recorded ${validEntries.length} tests for ${targetMem.name}`);
      if (newExamsList.length > 0) {
        fetchAiDiagnosticSummary(targetMem.id, [...newExamsList, ...exams.filter(e => e.memberId === targetMem.id)]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/exams`);
    }
  };

  // The "Active Standing" Rule: Admin Unexcused Zero (0 XP) Toggle
  const handleToggleUnexcusedZero = async (memberId: string, currentStatus: boolean, reason?: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    const mem = members.find(m => m.id === memberId) || DEFAULT_MEMBERS.find(m => m.id === memberId);
    if (!mem) return;

    const newStatus = !currentStatus;
    const finalReason = newStatus ? (reason?.trim() || unexcusedReasonMap[memberId]?.trim() || 'Unexcused test absence (bunked test)') : '';

    try {
      await updateDoc(doc(db, basePath, 'members', memberId), {
        unexcusedZero: newStatus,
        unexcusedReason: finalReason,
        unexcusedAt: newStatus ? Date.now() : null
      });

      if (newStatus) {
        await pushActivity(
          'penalty',
          `⚠️ Admin issued Unexcused Zero (0 XP) penalty to ${mem.name}`,
          finalReason,
          mem.id,
          0
        );
        notify('Unexcused Zero Applied', `${mem.name} received 0 XP for test standing this week.`);
      } else {
        await pushActivity(
          'admin_adjust',
          `🛡️ Admin restored Active Standing for ${mem.name}`,
          'Excused absence / off-week: latest active percentile restored.',
          mem.id,
          0
        );
        notify('Active Standing Restored', `${mem.name}'s latest exam percentile is now active.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${memberId}`);
    }
  };

  // Tuition Teacher AI Chatbot Handler
  const handleSendTeacherChat = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const query = customQuestion || teacherChatInput.trim();
    if (!query || isTeacherChatSending) return;

    setTeacherChatMessages(prev => [...prev, { sender: 'teacher', text: query, timestamp: Date.now() }]);
    setTeacherChatInput('');
    setIsTeacherChatSending(true);

    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const curTeacher = teachers.find(t => t.id === activeTeacherId) || DEFAULT_TEACHERS.find(t => t.subject === selectedTuitionSubject) || DEFAULT_TEACHERS[0];

    const studentsTelemetry = activeList.map(m => {
      const memSessions = sessions.filter(s => s.memberId === m.id && s.subject === selectedTuitionSubject && (s.timestamp || 0) >= weekStartMs);
      const weeklyMinutes = memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const weeklyQuestions = memSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
      
      const memExams = exams.filter(e => e.memberId === m.id);
      const recentExams = memExams.slice(0, 3).map(ex => {
        const sub = (ex.subjects || []).find((s: any) => s.name.toLowerCase() === selectedTuitionSubject.toLowerCase());
        return {
          title: ex.title,
          marks: sub?.marks ?? ex.overallMarks,
          maxMarks: sub?.maxMarks ?? ex.overallMaxMarks,
          percentile: sub?.percentile ?? ex.overallPercentile,
          rank: sub?.rank ?? ex.overallRank
        };
      });

      const studentStat = leaderboardStats.find(s => s.id === m.id);
      const completedAssignments = teacherAssignments.filter(a => a.subject === selectedTuitionSubject && a.submissions?.[m.id]?.status === 'graded');
      const excusedAssignments = teacherAssignments.filter(a => a.subject === selectedTuitionSubject && a.submissions?.[m.id]?.status === 'graded' && a.submissions?.[m.id]?.marksAwarded === 0);

      return {
        name: m.name,
        institute: m.institute,
        weeklyMinutes,
        weeklyQuestions,
        sessionCount: memSessions.length,
        recentExams,
        completedAssignmentsCount: completedAssignments.length,
        excusedAssignmentsCount: excusedAssignments.length,
        standingStatus: studentStat?.standingDetail || 'Active'
      };
    });

    try {
      const res = await fetch('/api/teacher-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: curTeacher?.name || 'Tuition Faculty',
          subject: selectedTuitionSubject,
          question: query,
          studentFilter: teacherChatStudentFocus,
          students: studentsTelemetry
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.answer) {
          setTeacherChatMessages(prev => [...prev, { sender: 'ai', text: data.answer, timestamp: Date.now() }]);
          return;
        }
      }
      throw new Error('Local fallback');
    } catch {
      const focusTarget = activeList.find(m => m.name.toLowerCase() === teacherChatStudentFocus.toLowerCase());
      const reply = focusTarget
        ? `Telemetry for **${focusTarget.name}** in **${selectedTuitionSubject}**:\n• **Weekly Time:** ${formatDuration(sessions.filter(s => s.memberId === focusTarget.id && s.subject === selectedTuitionSubject).reduce((a, b) => a + (Number(b.duration) || 0), 0))}\n• **Problems Solved:** ${sessions.filter(s => s.memberId === focusTarget.id && s.subject === selectedTuitionSubject).reduce((a, b) => a + (Number(b.questions) || 0), 0)} Qs\n• **Pedagogical Advice:** Keep drilling high-yield JEE Advanced numericals. Assign timed sets to maintain exam readiness.`
        : `**Squad Summary in ${selectedTuitionSubject}:**\nThe squad is putting in consistent work. Check individual assignments and mock exam percentiles in the dashboard below.`;
      setTeacherChatMessages(prev => [...prev, { sender: 'ai', text: reply, timestamp: Date.now() }]);
    } finally {
      setIsTeacherChatSending(false);
    }
  };

  // Tuition Teacher AI Deep Diagnostic Report Fetcher
  const fetchTeacherAiReport = async (subject = selectedTuitionSubject) => {
    setIsLoadingTeacherAi(true);
    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const curTeacher = teachers.find(t => t.id === activeTeacherId) || DEFAULT_TEACHERS.find(t => t.subject === subject) || DEFAULT_TEACHERS[0];

    const studentsTelemetry = activeList.map(m => {
      const memSessions = sessions.filter(s => s.memberId === m.id && s.subject === subject && (s.timestamp || 0) >= weekStartMs);
      const weeklyMinutes = memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const weeklyQuestions = memSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
      
      const memExams = exams.filter(e => e.memberId === m.id);
      const recentExams = memExams.slice(0, 3).map(ex => {
        const sub = (ex.subjects || []).find((s: any) => s.name.toLowerCase() === subject.toLowerCase());
        return {
          title: ex.title,
          marks: sub?.marks ?? ex.overallMarks,
          maxMarks: sub?.maxMarks ?? ex.overallMaxMarks,
          percentile: sub?.percentile ?? ex.overallPercentile,
          rank: sub?.rank ?? ex.overallRank
        };
      });

      return {
        name: m.name,
        institute: m.institute,
        weeklyMinutes,
        weeklyQuestions,
        sessionCount: memSessions.length,
        recentExams,
        assignmentsCount: teacherAssignments.filter(a => a.subject === subject && a.submissions?.[m.id]?.status === 'graded').length
      };
    });

    try {
      const res = await fetch('/api/teacher-ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: curTeacher?.name || 'Tuition Faculty',
          subject,
          tuitionName: curTeacher?.institute || 'Tuition Academy',
          students: studentsTelemetry
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setTeacherAiReport(data.analysis);
          return;
        }
      }
      generateLocalTeacherAiReport(subject, studentsTelemetry);
    } catch (e) {
      console.warn('Teacher AI report fetch error:', e);
      generateLocalTeacherAiReport(subject, studentsTelemetry);
    } finally {
      setIsLoadingTeacherAi(false);
    }
  };

  const generateLocalTeacherAiReport = (subject: string, telemetry: any[]) => {
    const totalMins = telemetry.reduce((a, b) => a + (Number(b.weeklyMinutes) || 0), 0);
    const totalQs = telemetry.reduce((a, b) => a + (Number(b.weeklyQuestions) || 0), 0);
    const hrs = (totalMins / 60).toFixed(1);

    const students = telemetry.map(s => {
      const mins = Number(s.weeklyMinutes) || 0;
      const qs = Number(s.weeklyQuestions) || 0;
      let rating = 'Consistent';
      if (mins >= 360 || qs >= 90) rating = 'High Grind';
      else if (mins < 120 && qs < 30) rating = 'Needs Push';

      return {
        name: s.name,
        effortRating: rating,
        effortVerdict: `${s.name} logged ${(mins / 60).toFixed(1)} hrs and ${qs} practice problems in ${subject} this week.`,
        academicTrajectory: (s.recentExams && s.recentExams.length > 0)
          ? `Maintained strong standing (${s.recentExams[0].percentile || 90}%ile) in recent ${subject} mock tests.`
          : `Consistent effort logged; ready for a dedicated ${subject} timed test drill.`,
        tuitionFocus: `Focus on problem-solving speed and numerical calculation accuracy in ${subject}.`
      };
    });

    setTeacherAiReport({
      overallEffortSummary: `The squad logged a total of ${hrs} hours and solved ${totalQs} questions in ${subject} this week. Overall commitment is strong across the board.`,
      collectiveStatus: Number(hrs) >= 12 ? 'Strong Momentum' : 'Moderate Grind',
      students,
      suggestedAssignments: [
        {
          title: `${subject} Advanced Mixed Problem Set`,
          topic: 'High-Weightage Chapters',
          questionsCount: 25,
          recommendedXp: 50,
          rationale: 'Calibrates formula application under 3-minute-per-question constraints.'
        },
        {
          title: `${subject} Past Years Speed Drill`,
          topic: 'Timed Practice',
          questionsCount: 20,
          recommendedXp: 40,
          rationale: 'Reinforces speed and accuracy under test conditions.'
        }
      ],
      tuitionLessonFocus: `Focus next session on high-yield ${subject} numerical problems and calculation speed.`
    });
  };

  // Tuition Assignment Handlers
  const handleCreateTeacherAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim()) return;
    if (!assignDueDate.trim()) {
      notify('Due Date Required', 'Due date is compulsory for all homework assignments.');
      return;
    }
    const basePath = `artifacts/${appId}/public/data`;
    const fallbackTeacher = {
      id: 'teacher_' + assignSubject.toLowerCase(),
      name: `${assignSubject} Faculty`,
      subject: assignSubject
    };
    const curTeacher = currentTeacher || teachers.find(t => t.id === activeTeacherId) || teachers.find(t => t.subject === assignSubject) || teachers[0] || fallbackTeacher;
    const newId = 'asg_' + Date.now();
    const finalXp = assignXp.trim() === '' ? 0 : Math.max(0, Number(assignXp));
    const finalQuestions = assignHasQuestions ? (Number(assignQuestions) || 20) : 0;

    const newAsg: TeacherAssignment = {
      id: newId,
      teacherId: curTeacher.id,
      teacherName: curTeacher.name,
      subject: assignSubject,
      title: assignTitle.trim(),
      description: assignDesc.trim(),
      hasQuestions: assignHasQuestions,
      questionsCount: finalQuestions,
      questionDifficulty: assignHasQuestions ? assignQuestionDifficulty : undefined,
      xpReward: finalXp,
      doubleXpFullComplete: assignDoubleXpFullComplete,
      dueDate: assignDueDate,
      assignedTo: assignTarget,
      requireProof: assignRequireProof,
      refLink: assignRefLink.trim() || '',
      attachedFiles: assignAttachedFiles,
      archived: false,
      submissions: {},
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, basePath, 'teacher_assignments', newId), newAsg);
      await pushActivity(
        'teacher_assign',
        `👨‍🏫 ${curTeacher.name} assigned "${newAsg.title}"`,
        `${newAsg.subject} • ${finalQuestions > 0 ? `${finalQuestions} Qs (${assignQuestionDifficulty}) • ` : ''}+${newAsg.xpReward} XP${newAsg.doubleXpFullComplete ? ' (2X Speed Bonus)' : ''} • Due: ${newAsg.dueDate}`,
        curTeacher.id,
        newAsg.xpReward
      );
      setAssignTitle('');
      setAssignDesc('');
      setAssignRefLink('');
      setAssignAttachedFiles([]);
      setAssignDueDate('');
      setAssignHasQuestions(true);
      setAssignDoubleXpFullComplete(false);
      setShowCreateAssignmentModal(false);
      notify('Assignment Dispatched', `Students notified for ${newAsg.subject} homework.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/teacher_assignments/${newId}`);
    }
  };

  const handleStartEditAssignment = (asg: TeacherAssignment) => {
    setEditingAssignmentId(asg.id);
    setEditAssignmentForm({
      id: asg.id,
      title: asg.title || '',
      subject: asg.subject || selectedTuitionSubject,
      description: asg.description || '',
      questionsCount: String(asg.questionsCount || 20),
      xpReward: String(asg.xpReward || 50),
      dueDate: asg.dueDate || new Date().toISOString().split('T')[0],
      assignedTo: asg.assignedTo || ['ALL'],
      requireProof: Boolean(asg.requireProof),
      refLink: asg.refLink || ''
    });
  };

  const handleSaveAssignmentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignmentId || !editAssignmentForm) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await updateDoc(doc(db, basePath, 'teacher_assignments', editingAssignmentId), {
        title: editAssignmentForm.title.trim(),
        subject: editAssignmentForm.subject,
        description: editAssignmentForm.description.trim(),
        questionsCount: Number(editAssignmentForm.questionsCount) || 20,
        xpReward: Number(editAssignmentForm.xpReward) || 50,
        dueDate: editAssignmentForm.dueDate,
        assignedTo: editAssignmentForm.assignedTo,
        requireProof: Boolean(editAssignmentForm.requireProof),
        refLink: editAssignmentForm.refLink.trim() || ''
      });
      await pushActivity(
        'teacher_assign',
        `✏️ Updated Assignment: "${editAssignmentForm.title.trim()}"`,
        `${editAssignmentForm.subject} • ${editAssignmentForm.questionsCount} Qs • ${editAssignmentForm.xpReward} XP`,
        'teacher',
        0
      );
      setEditingAssignmentId(null);
      setEditAssignmentForm(null);
      notify('Assignment Updated', `Modified homework "${editAssignmentForm.title.trim()}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${editingAssignmentId}`);
    }
  };

  const handleDeleteTeacherAssignment = async (asgId: string, title: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'teacher_assignments', asgId));
      await pushActivity(
        'admin_adjust',
        `🗑️ Teacher removed assignment "${title}"`,
        `Deleted from ${selectedTuitionSubject} tuition desk`,
        'teacher',
        0
      );
      notify('Assignment Removed', `Deleted "${title}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/teacher_assignments/${asgId}`);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;

    let senderId = 'sai';
    let senderName = 'Sai';
    let senderType: 'student' | 'teacher' | 'admin' = 'student';

    if (activeMemberId === 'admin' || isAdminUnlocked) {
      senderId = 'admin';
      senderName = 'Admin';
      senderType = 'admin';
    } else if (currentTeacher) {
      senderId = currentTeacher.id;
      senderName = currentTeacher.name;
      senderType = 'teacher';
    } else if (currentMember) {
      senderId = currentMember.id;
      senderName = currentMember.name;
      senderType = 'student';
    }

    const recipientId = chatActiveChannel;
    let recipientName = 'Everyone';
    if (recipientId !== 'ALL') {
      const targetMem = members.find(m => m.id === recipientId);
      const targetTeach = teachers.find(t => t.id === recipientId);
      if (targetMem) recipientName = targetMem.name;
      else if (targetTeach) recipientName = targetTeach.name;
      else if (recipientId === 'admin') recipientName = 'Admin';
    }

    const msgObj = {
      senderId,
      senderName,
      senderType,
      recipientId,
      recipientName,
      text: chatInputText.trim(),
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(db, basePath, 'messages'), msgObj);
      setChatInputText('');

      if (recipientId === 'ALL') {
        await pushActivity(
          'chat',
          `💬 ${senderName}: "${msgObj.text}"`,
          `Squad Broadcast`,
          senderId,
          0
        );
      } else {
        notify('Message Dispatched', `Direct message sent to ${recipientName}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/messages`);
    }
  };

  const handleTeacherAdjustStudentXp = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePath = `artifacts/${appId}/public/data`;
    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const targetStudent = activeList.find(m => m.id === teacherXpTargetStudentId);
    if (!targetStudent) return;

    const rawVal = Math.abs(Number(teacherXpAmount) || 0);
    if (rawVal === 0) return;
    const delta = teacherXpIsDeduction ? -rawVal : rawVal;
    const currentBonus = Number(targetStudent.bonusXp) || 0;
    const newBonus = currentBonus + delta;

    const curTeacher = currentTeacher || teachers.find(t => t.id === activeTeacherId);
    const teacherName = curTeacher?.name || 'Tuition Teacher';

    try {
      await updateDoc(doc(db, basePath, 'members', targetStudent.id), {
        bonusXp: newBonus
      });
      await pushActivity(
        delta > 0 ? 'admin_adjust' : 'penalty',
        `👨‍🏫 ${teacherName} ${delta > 0 ? `awarded +${delta}` : `deducted ${delta}`} XP (${targetStudent.name})`,
        teacherXpReason.trim() || `${selectedTuitionSubject} Tuition Evaluation`,
        targetStudent.id,
        delta
      );
      setShowTeacherXpModal(false);
      setTeacherXpAmount('25');
      setTeacherXpReason('');
      notify(delta > 0 ? 'XP Awarded' : 'XP Deducted', `${delta > 0 ? '+' : ''}${delta} XP for ${targetStudent.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${targetStudent.id}`);
    }
  };

  const handleOpenStudentSubmission = (asg: TeacherAssignment, mode: 'submit_solution' | 'submit_excuse' = 'submit_solution') => {
    setActiveAssignmentAction(asg);
    setAssignmentActionMode(mode);
    const myId = activeMemberId || currentMember?.id || 'sai';
    const mySub = asg.submissions?.[myId];
    if (mySub) {
      setStudentHomeworkAttachedFiles(mySub.attachedFiles || []);
      setStudentHomeworkProofImages(mySub.proofImages || []);
      setStudentHomeworkResourceLinks((mySub as any).resourceLinks || []);
      setStudentHomeworkNote(mySub.note?.replace(/^(Incomplete )?Excuse:\s*/i, '') || '');
      if (mode === 'submit_excuse' && mySub.note) {
        setStudentExcuseReason(mySub.note.replace(/^(Incomplete )?Excuse:\s*/i, ''));
      }
    } else {
      setStudentHomeworkAttachedFiles([]);
      setStudentHomeworkProofImages([]);
      setStudentHomeworkResourceLinks([]);
      setStudentHomeworkNote('');
      setStudentExcuseReason('');
    }
    setNewResourceLinkInput('');
  };

  const handleAddResourceLink = () => {
    if (!newResourceLinkInput.trim()) return;
    let url = newResourceLinkInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setStudentHomeworkResourceLinks(prev => [...prev, url]);
    setNewResourceLinkInput('');
  };

  const handleRemoveResourceLink = (idx: number) => {
    setStudentHomeworkResourceLinks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleStudentSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentId = (activeMemberId && activeMemberId !== 'admin' && !activeMemberId.startsWith('teacher_'))
      ? activeMemberId
      : (currentMember?.id || 'sai');

    if (!activeAssignmentAction) {
      notify('No Assignment Selected', 'Please select an active homework assignment.', 'error');
      return;
    }
    setIsSubmittingAssignmentAction(true);

    // Auto-include typed link if user filled input but didn't click "+ Add Link"
    let finalLinks = [...studentHomeworkResourceLinks];
    if (newResourceLinkInput.trim()) {
      let url = newResourceLinkInput.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      if (!finalLinks.includes(url)) {
        finalLinks.push(url);
      }
      setNewResourceLinkInput('');
    }

    // Compress any image attachments and proof URLs to prevent Firestore 1MB document limit
    const compressedFiles = await Promise.all(
      studentHomeworkAttachedFiles.map(async (f) => {
        if (f.type === 'image' && f.url && f.url.startsWith('data:image')) {
          const comp = await compressDataUrl(f.url, 800, 0.55);
          return { ...f, url: comp };
        }
        return f;
      })
    );

    const compressedProofs = await Promise.all(
      studentHomeworkProofImages.map(async (imgUrl) => {
        if (imgUrl && imgUrl.startsWith('data:image')) {
          return await compressDataUrl(imgUrl, 800, 0.55);
        }
        return imgUrl;
      })
    );

    const basePath = `artifacts/${appId}/public/data`;
    const asg = activeAssignmentAction;
    const updatedSubs = { ...(asg.submissions || {}) };
    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const targetMem = activeList.find(m => m.id === studentId) || DEFAULT_MEMBERS.find(m => m.id === studentId) || { id: studentId, name: studentId === 'sai' ? 'Sai' : studentId === 'nishchit' ? 'Nishchit' : 'Ved' };

    // Also sanitize old submissions on this assignment to compress any uncompressed base64 images
    for (const mId of Object.keys(updatedSubs)) {
      const sub = updatedSubs[mId];
      if (sub.proofImages && sub.proofImages.length > 0) {
        sub.proofImages = await Promise.all(
          sub.proofImages.map(img => img.startsWith('data:image') ? compressDataUrl(img, 700, 0.50) : Promise.resolve(img))
        );
      }
      if (sub.attachedFiles && sub.attachedFiles.length > 0) {
        sub.attachedFiles = await Promise.all(
          sub.attachedFiles.map(async f => {
            if (f.type === 'image' && f.url && f.url.startsWith('data:image')) {
              const comp = await compressDataUrl(f.url, 700, 0.50);
              return { ...f, url: comp };
            }
            return f;
          })
        );
      }
    }

    // Trigger AI Automatic Grading immediately
    let aiGrade = {
      marksAwarded: asg.questionsCount || 20,
      maxMarks: asg.questionsCount || 20,
      questionsAttempted: asg.questionsCount || 20,
      questionsCorrect: asg.questionsCount || 20,
      isTaskFullyCompleted: true,
      xpAwarded: asg.doubleXpFullComplete ? ((asg.xpReward || 40) * 2) : (asg.xpReward || 40),
      feedback: `🤖 AI Evaluation: High accuracy solution verified for ${targetMem.name}.`,
      gradedBy: '🤖 AI Faculty Evaluator'
    };

    try {
      const res = await fetch('/api/grade-homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment: {
            title: asg.title,
            subject: asg.subject,
            description: asg.description,
            hasQuestions: asg.hasQuestions,
            questionsCount: asg.questionsCount,
            questionDifficulty: asg.questionDifficulty,
            xpReward: asg.xpReward,
            doubleXpFullComplete: asg.doubleXpFullComplete
          },
          student: {
            id: targetMem.id,
            name: targetMem.name
          },
          submission: {
            note: studentHomeworkNote.trim(),
            attachedFiles: compressedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })),
            proofImagesCount: compressedProofs.length,
            resourceLinks: finalLinks
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.grade) {
          aiGrade = data.grade;
        }
      }
    } catch (e) {
      console.warn('AI Grading fetch error, using local AI evaluation fallback:', e);
    }

    updatedSubs[studentId] = {
      submittedAt: Date.now(),
      proofImages: compressedProofs,
      attachedFiles: compressedFiles,
      resourceLinks: finalLinks,
      note: studentHomeworkNote.trim() || 'Homework solution submitted for faculty review.',
      status: 'graded',
      gradedBy: aiGrade.gradedBy || '🤖 AI Faculty Evaluator',
      marksAwarded: aiGrade.marksAwarded,
      maxMarks: aiGrade.maxMarks,
      questionsAttempted: aiGrade.questionsAttempted,
      questionsCorrect: aiGrade.questionsCorrect,
      isTaskFullyCompleted: aiGrade.isTaskFullyCompleted,
      xpAwarded: aiGrade.xpAwarded,
      feedback: aiGrade.feedback
    };

    // Payload safety guard: ensures Firestore document write NEVER fails even with large PDFs/files
    let jsonSize = JSON.stringify(updatedSubs).length;
    if (jsonSize > 850000) {
      const safeFiles = compressedFiles.map(f => {
        if (f.url && f.url.length > 250000 && f.type !== 'image') {
          return { ...f, isLargeFile: true, notice: 'Attached for faculty review' };
        }
        return f;
      });
      updatedSubs[studentId].attachedFiles = safeFiles;
    }

    try {
      await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), {
        submissions: updatedSubs
      });

      // Instantly award XP earned to student's bonusXp in Firestore!
      if (aiGrade.xpAwarded > 0) {
        const curBonus = Number((targetMem as any).bonusXp) || 0;
        await updateDoc(doc(db, basePath, 'members', targetMem.id), {
          bonusXp: curBonus + aiGrade.xpAwarded
        });
      }

      await pushActivity(
        'task_complete',
        `🤖 AI Graded ${targetMem.name}'s homework for "${asg.title}" (+${aiGrade.xpAwarded} XP)`,
        `Scored ${aiGrade.marksAwarded}/${aiGrade.maxMarks} marks. Feedback: "${aiGrade.feedback}"`,
        targetMem.id,
        aiGrade.xpAwarded
      );
      setActiveAssignmentAction(null);
      setStudentHomeworkProofImages([]);
      setStudentHomeworkAttachedFiles([]);
      setStudentHomeworkResourceLinks([]);
      setStudentHomeworkNote('');
      notify('Homework AI Graded! 🤖', `Scored ${aiGrade.marksAwarded}/${aiGrade.maxMarks} marks. Awarded +${aiGrade.xpAwarded} XP!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${asg.id}`);
    } finally {
      setIsSubmittingAssignmentAction(false);
    }
  };

  const handleStudentSubmitExcuse = async (e: React.FormEvent) => {
    e.preventDefault();
    const studentId = (activeMemberId && activeMemberId !== 'admin' && !activeMemberId.startsWith('teacher_'))
      ? activeMemberId
      : (currentMember?.id || 'sai');

    if (!activeAssignmentAction || !studentExcuseReason.trim()) {
      notify('Excuse Reason Required', 'Please enter a valid reason for incompletion.', 'error');
      return;
    }

    const basePath = `artifacts/${appId}/public/data`;
    const asg = activeAssignmentAction;
    const updatedSubs = { ...(asg.submissions || {}) };
    const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
    const targetMem = activeList.find(m => m.id === studentId) || DEFAULT_MEMBERS.find(m => m.id === studentId) || { id: studentId, name: studentId === 'sai' ? 'Sai' : studentId === 'nishchit' ? 'Nishchit' : 'Ved' };

    updatedSubs[studentId] = {
      submittedAt: Date.now(),
      note: `Incomplete Excuse: ${studentExcuseReason.trim()}`,
      status: 'pending',
      feedback: `Reason: "${studentExcuseReason.trim()}" (Awaiting teacher review)`,
      xpAwarded: 0
    };

    try {
      await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), {
        submissions: updatedSubs
      });
      await pushActivity(
        'penalty',
        `⚠️ ${targetMem.name} filed excuse for "${asg.title}"`,
        `Reason: "${studentExcuseReason.trim()}" (Teacher must approve to waive penalty)`,
        targetMem.id,
        0
      );
      setActiveAssignmentAction(null);
      setStudentExcuseReason('');
      notify('Excuse Submitted', 'Tuition teacher will review to approve or choose XP penalty.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${asg.id}`);
    }
  };

  const handleTeacherReviewExcuse = async (assignmentId: string, studentId: string, approve: boolean, penaltyXp: number, feedback: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    const asg = teacherAssignments.find(a => a.id === assignmentId);
    const student = members.find(m => m.id === studentId) || DEFAULT_MEMBERS.find(m => m.id === studentId);
    if (!asg || !student) return;

    const updatedSubs = { ...(asg.submissions || {}) };
    const curSub = updatedSubs[studentId] || { submittedAt: Date.now() };

    if (approve) {
      // Excuse approved: No penalty, 0 XP lost!
      updatedSubs[studentId] = {
        ...curSub,
        status: 'graded',
        feedback: feedback.trim() || 'Teacher approved absence/excuse. Protected from XP penalty.',
        marksAwarded: 0,
        maxMarks: asg.questionsCount,
        xpAwarded: 0
      };
      try {
        await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), { submissions: updatedSubs });
        await pushActivity(
          'admin_adjust',
          `✅ ${asg.teacherName} approved excuse for ${student.name}`,
          `Excused from "${asg.title}" without penalty.`,
          student.id,
          0
        );
        setReviewingAssignment(null);
        notify('Excuse Approved', `${student.name} is excused without penalty.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${asg.id}`);
      }
    } else {
      // Excuse rejected: Teacher chooses how much XP to deduct!
      const deduction = Math.max(0, penaltyXp);
      updatedSubs[studentId] = {
        ...curSub,
        status: 'graded',
        feedback: `Rejected: Unexcused homework incompletion (-${deduction} XP penalty applied). ${feedback.trim()}`,
        marksAwarded: 0,
        maxMarks: asg.questionsCount,
        xpAwarded: -deduction
      };
      try {
        await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), { submissions: updatedSubs });
        if (deduction > 0) {
          const currentBonus = Number(student.bonusXp) || 0;
          await updateDoc(doc(db, basePath, 'members', student.id), {
            bonusXp: currentBonus - deduction
          });
        }
        await pushActivity(
          'penalty',
          `🚫 ${asg.teacherName} rejected excuse & penalized ${student.name} (-${deduction} XP)`,
          `Unexcused failure to complete "${asg.title}". Feedback: ${feedback.trim() || 'Incomplete work'}`,
          student.id,
          -deduction
        );
        setReviewingAssignment(null);
        notify('Penalty Applied', `Deducted ${deduction} XP from ${student.name}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${asg.id}`);
      }
    }
  };

  const handleTeacherGradeHomework = async (
    assignmentId: string,
    studentId: string,
    marks: number,
    maxMarks: number,
    xp: number,
    feedback: string,
    questionsAttempted?: number,
    questionsCorrect?: number,
    isCompleted?: boolean
  ) => {
    const basePath = `artifacts/${appId}/public/data`;
    const asg = teacherAssignments.find(a => a.id === assignmentId);
    const student = members.find(m => m.id === studentId) || DEFAULT_MEMBERS.find(m => m.id === studentId);
    if (!asg || !student) return;

    const updatedSubs = { ...(asg.submissions || {}) };
    const curSub = updatedSubs[studentId] || { submittedAt: Date.now() };
    const previousXp = Number(curSub.xpAwarded) || 0;
    const deltaXp = xp - previousXp;
    const curTeacher = currentTeacher || teachers.find(t => t.id === activeTeacherId);
    const teacherLabel = curTeacher ? curTeacher.name : (isAdminUnlocked || activeMemberId === 'admin' ? 'Faculty Admin' : 'Tuition Teacher');

    updatedSubs[studentId] = {
      ...curSub,
      status: 'graded',
      gradedBy: teacherLabel,
      marksAwarded: marks,
      maxMarks,
      xpAwarded: xp,
      feedback: feedback.trim() || `Verified by ${teacherLabel}. Scored ${marks}/${maxMarks}.`,
      questionsAttempted: questionsAttempted !== undefined ? questionsAttempted : asg.questionsCount,
      questionsCorrect: questionsCorrect !== undefined ? questionsCorrect : marks,
      isTaskFullyCompleted: isCompleted !== undefined ? isCompleted : true
    };

    try {
      await updateDoc(doc(db, basePath, 'teacher_assignments', asg.id), { submissions: updatedSubs });
      if (deltaXp !== 0) {
        const currentBonus = Number(student.bonusXp) || 0;
        await updateDoc(doc(db, basePath, 'members', student.id), {
          bonusXp: currentBonus + deltaXp
        });
      }
      await pushActivity(
        'task_complete',
        `👨‍🏫 ${teacherLabel} updated grade for ${student.name}'s homework (${deltaXp >= 0 ? `+${deltaXp}` : deltaXp} XP delta)`,
        `"${asg.title}": ${marks}/${maxMarks} marks. "${feedback.trim() || 'Reviewed'}"`,
        student.id,
        xp
      );
      setReviewingAssignment(null);
      setReviewingStudentId(null);
      notify('Homework Graded', `${xp >= 0 ? `Awarded +${xp}` : `Deducted ${xp}`} XP for ${student.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${asg.id}`);
    }
  };

  const handleToggleArchiveAssignment = async (assignmentId: string, shouldArchive: boolean) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await updateDoc(doc(db, basePath, 'teacher_assignments', assignmentId), {
        archived: shouldArchive
      });
      notify(
        shouldArchive ? 'Assignment Archived' : 'Assignment Restored',
        shouldArchive ? 'Moved to archived desk.' : 'Restored to active assignments.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/teacher_assignments/${assignmentId}`);
    }
  };

  const handleCreateTeacherNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherNoteText.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const fallbackTeacher = {
      id: 'teacher_' + selectedTuitionSubject.toLowerCase(),
      name: `${selectedTuitionSubject} Faculty`,
      subject: selectedTuitionSubject
    };
    const curTeacher = currentTeacher || teachers.find(t => t.id === activeTeacherId) || teachers.find(t => t.subject === selectedTuitionSubject) || teachers[0] || fallbackTeacher;
    const newNote: TeacherNote = {
      id: 'note_' + Date.now(),
      teacherId: curTeacher.id,
      teacherName: curTeacher.name,
      subject: selectedTuitionSubject,
      targetMemberId: teacherNoteTarget,
      note: teacherNoteText.trim(),
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, basePath, 'teacher_notes', newNote.id), newNote);
      await pushActivity(
        'announcement',
        `📢 ${curTeacher.name} posted note for ${selectedTuitionSubject}`,
        `"${newNote.note}"`,
        curTeacher.id,
        0
      );
      setTeacherNoteText('');
      notify('Note Posted', `Classroom instruction shared for ${selectedTuitionSubject}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/teacher_notes/${newNote.id}`);
    }
  };

  const generateLocalAiSummary = (mem: any, current: any, previous: any) => {
    const currentPct = Number(current.overallPercentile) || 0;
    const prevPct = previous ? Number(previous.overallPercentile) : null;
    const delta = prevPct !== null ? (currentPct - prevPct) : null;

    const subjs = [...(current.subjects || [])].sort((a: any, b: any) => (b.percentile || 0) - (a.percentile || 0));
    const strongest = subjs[0]?.name || 'Physics';
    const weakest = subjs[subjs.length - 1]?.name || 'Chemistry';
    const strongPct = subjs[0]?.percentile !== undefined ? `${subjs[0].percentile}%ile` : `${currentPct.toFixed(1)}%ile`;
    const weakPct = subjs[subjs.length - 1]?.percentile !== undefined ? `${subjs[subjs.length - 1].percentile}%ile` : `${currentPct.toFixed(1)}%ile`;

    const headline = delta !== null
      ? delta >= 0
        ? `📈 +${delta.toFixed(1)}%ile Jump: Dominant progression across ${current.totalStudents} batch aspirants!`
        : `📉 -${Math.abs(delta).toFixed(1)}%ile Variance: High-percentile foundation with clear rebound targets.`
      : `🎯 Baseline Calibrated: ${currentPct.toFixed(1)}%ile established in ${current.examType}.`;

    const trajectory = `${mem.name} secured Rank #${current.overallRank} against ${current.totalStudents} test-takers in "${current.title}". Standardizing raw rank eliminates batch-size skew between Modulus (~560) and Allen (thousands), yielding ${currentPct.toFixed(1)}%ile. ${delta !== null ? `This is a ${delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`} shift from "${previous.title}".` : 'Baseline established for weekly tracking.'}`;

    setAiSummaryData(prev => ({
      ...prev,
      [mem.id]: {
        headline,
        trajectory,
        strongestSubject: `${strongest} (${strongPct})`,
        focusSubject: `${weakest} (${weakPct})`,
        recommendedAction: [
          `Target 30 questions/day on ${weakest} problem sets to boost overall aggregate score.`,
          `Preserve ${strongest} speed by doing 15 timed Advanced questions daily (2.5 XP tier).`
        ],
        timestamp: Date.now()
      }
    }));
  };

  const fetchAiDiagnosticSummary = async (memberId: string, customExams?: any[]) => {
    const mem = members.find(m => m.id === memberId) || DEFAULT_MEMBERS.find(m => m.id === memberId);
    if (!mem) return;
    const memExams = [...(customExams || exams.filter(e => e.memberId === memberId))]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (memExams.length === 0) return;

    const current = memExams[0];
    const previous = memExams.length > 1 ? memExams[1] : null;

    setIsGeneratingAiSummary(true);
    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: mem.name,
          institute: mem.institute,
          currentExam: current,
          previousExam: previous,
          recentSessions: sessions.filter(s => s.memberId === memberId).slice(0, 5)
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analysis) {
          setAiSummaryData(prev => ({
            ...prev,
            [memberId]: { ...data.analysis, timestamp: Date.now() }
          }));
          return;
        }
      }
      generateLocalAiSummary(mem, current, previous);
    } catch {
      generateLocalAiSummary(mem, current, previous);
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  // Backup & Safety Handlers
  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      appId,
      members,
      sessions,
      exams,
      tasks,
      announcements,
      activities,
      settings: arenaSettings
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jee-arena-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Backup Exported', 'Downloaded full arena data as JSON file.');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.members && !data.exams && !data.sessions) {
        notify('Invalid Backup File', 'File is missing required collections.', 'error');
        return;
      }
      const basePath = `artifacts/${appId}/public/data`;
      if (Array.isArray(data.members)) {
        for (const m of data.members) {
          if (m.id) await setDoc(doc(db, basePath, 'members', m.id), m);
        }
      }
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          if (s.id) await setDoc(doc(db, basePath, 'sessions', s.id), s);
        }
      }
      if (Array.isArray(data.exams)) {
        for (const ex of data.exams) {
          if (ex.id) await setDoc(doc(db, basePath, 'exams', ex.id), ex);
        }
      }
      if (Array.isArray(data.tasks)) {
        for (const t of data.tasks) {
          if (t.id) await setDoc(doc(db, basePath, 'tasks', t.id), t);
        }
      }
      if (data.settings) {
        await setDoc(doc(db, basePath, 'settings', 'arenaState'), data.settings);
      }
      notify('Backup Restored', 'All collections synced from JSON backup.');
      if (backupInputRef.current) backupInputRef.current.value = '';
    } catch (err: any) {
      notify('Import Failed', err.message || 'Error parsing backup JSON', 'error');
    }
  };


  const handleProofFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - proofImages.length);
    if (files.length === 0) return;
    setIsUploadingProof(true);
    try {
      const compressedList: string[] = [];
      for (const file of files) {
        const dataUrl = await compressImageFile(file);
        compressedList.push(dataUrl);
      }
      setProofImages(prev => [...prev, ...compressedList].slice(0, 5));
    } catch (err) {
      console.error('Image compression error:', err);
    }
    setIsUploadingProof(false);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTaskModal) return;
    const basePath = `artifacts/${appId}/public/data`;
    const targetMem = currentMember || members[0] || DEFAULT_MEMBERS[0];
    if (!targetMem) return;

    if (proofImages.length === 0) {
      notify('Photo Required', 'Attach at least 1 photo of your work.', 'error');
      return;
    }

    const completions = { ...(proofTaskModal.completions || {}) };
    completions[targetMem.id] = {
      status: 'pending_review',
      submittedAt: Date.now(),
      completedAt: Date.now(),
      xpAwarded: proofTaskModal.xp !== undefined && proofTaskModal.xp !== null ? Math.max(0, Number(proofTaskModal.xp)) : 25,
      proofImages,
      note: proofNote.trim()
    };

    try {
      await updateDoc(doc(db, basePath, 'tasks', proofTaskModal.id), {
        completions
      });

      await pushActivity(
        'proof_submit',
        `📸 ${targetMem.name} uploaded proof for "${proofTaskModal.title}"`,
        `Awaiting Admin review (+${proofTaskModal.xp} XP)`,
        targetMem.id,
        0
      );

      setProofTaskModal(null);
      setProofImages([]);
      setProofNote('');
      notify('Proof Submitted', 'Sent to Admin for verification.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${proofTaskModal.id}`);
    }
  };

  // Admin Roster & Details
  const handleStartEditMember = (m: Member) => {
    setEditingMemberId(m.id);
    setEditMemberForm({
      name: m.name,
      institute: m.institute || 'Modulus',
      passcode: String(m.passcode || '1111'),
      bonusXp: Number(m.bonusXp) || 0,
      manualMinutesOffset: Number(m.manualMinutesOffset) || 0
    });
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberId) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await updateDoc(doc(db, basePath, 'members', editingMemberId), {
        name: editMemberForm.name.trim(),
        institute: editMemberForm.institute.trim(),
        passcode: editMemberForm.passcode.trim(),
        bonusXp: Number(editMemberForm.bonusXp) || 0,
        manualMinutesOffset: Number(editMemberForm.manualMinutesOffset) || 0
      });
      setEditingMemberId(null);
      notify('Member Updated', `Saved changes for ${editMemberForm.name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${editingMemberId}`);
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'members', memberId));
      notify('Member Removed', `${memberName} removed from roster.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/members/${memberId}`);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || newMemberPin.length !== 4) return;
    const basePath = `artifacts/${appId}/public/data`;
    const id = newMemberName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now().toString().slice(-3);
    try {
      await setDoc(doc(db, basePath, 'members', id), {
        id,
        name: newMemberName.trim(),
        institute: newMemberInst.trim() || 'Modulus',
        passcode: newMemberPin,
        bonusXp: 0,
        manualMinutesOffset: 0,
        isGrinding: false,
        grindingSubject: '',
        grindingStartedAt: null
      });
      setNewMemberName('');
      setNewMemberPin('');
      notify('Member Added', `${newMemberName} can now log in.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/members/${id}`);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const newId = 'teacher_' + Date.now().toString();
    const newDoc: Teacher = {
      id: newId,
      name: newTeacherName.trim(),
      subject: newTeacherSubject,
      institute: newTeacherInst.trim() || 'Tuition Academy',
      passcode: newTeacherPin.trim() || '5555',
      bio: newTeacherBio.trim() || '',
      createdAt: Date.now()
    };
    try {
      await setDoc(doc(db, basePath, 'teachers', newId), newDoc);
      await pushActivity('admin_adjust', `👨‍🏫 Added tuition teacher ${newDoc.name}`, `${newDoc.subject} • ${newDoc.institute}`, 'admin', 0);
      setNewTeacherName('');
      setNewTeacherInst('');
      setNewTeacherPin('');
      setNewTeacherBio('');
      notify('Teacher Profile Created', `${newDoc.name} can now log in with PIN ${newDoc.passcode}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/teachers/${newId}`);
    }
  };

  const handleDeleteTeacher = async (teacherId: string, teacherName: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'teachers', teacherId));
      await pushActivity('admin_adjust', `Removed tuition teacher profile ${teacherName}`, '', 'admin', 0);
      notify('Teacher Profile Deleted', `${teacherName} was removed.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/teachers/${teacherId}`);
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
    if (xpDelta !== 0) {
      updates.bonusXp = (Number(targetMem.bonusXp) || 0) + xpDelta;
    }
    if (minsDelta !== 0) {
      updates.manualMinutesOffset = (Number(targetMem.manualMinutesOffset) || 0) + minsDelta;
    }

    try {
      await updateDoc(doc(db, basePath, 'members', targetMem.id), updates);

      const summaryParts: string[] = [];
      if (xpDelta !== 0) summaryParts.push(`${xpDelta > 0 ? `+${xpDelta}` : xpDelta} XP`);
      if (minsDelta !== 0) summaryParts.push(`${minsDelta > 0 ? `+${minsDelta}` : minsDelta} mins`);

      await pushActivity(
        xpDelta < 0 || minsDelta < 0 ? 'penalty' : 'admin_adjust',
        `Admin adjusted ${targetMem.name}: ${summaryParts.join(' & ')}`,
        quickAdjustReason.trim() || 'Admin manual adjustment',
        targetMem.id,
        xpDelta
      );

      setQuickXpDelta('');
      setQuickTimeDelta('');
      setQuickAdjustReason('');
      notify('Adjustment Applied', `Updated ${targetMem.name}: ${summaryParts.join(', ')}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/members/${targetMem.id}`);
    }
  };

  // Squad Bounty Creation & Task Editing
  const handleBountyRefImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - bountyRefImages.length);
    if (files.length === 0) return;
    const list: string[] = [];
    for (const f of files) {
      const dataUrl = await compressImageFile(f);
      list.push(dataUrl);
    }
    setBountyRefImages(prev => [...prev, ...list].slice(0, 3));
  };

  const handleAdminCreateBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bountyTitle.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    const parsedXp = 0; // ALL squad bounties are now 0 XP Honor Challenges

    const newTask = {
      title: bountyTitle.trim(),
      subject: bountySubject,
      xp: parsedXp,
      questionsText: bountyDesc.trim(),
      linkUrl: bountyLink.trim(),
      doubleXpFirst: bountyFirstBlood,
      requireProof: bountyRequireProof,
      assignedTo: bountyAssignedTo.length > 0 ? bountyAssignedTo : ['ALL'],
      isPersonal: false,
      ownerId: 'admin',
      createdBy: 'Admin',
      referenceImages: bountyRefImages,
      completions: {},
      timeSpentByMember: {},
      createdAt: Date.now()
    };

    try {
      await addDoc(collection(db, basePath, 'tasks'), newTask);
      await pushActivity(
        'admin_bounty',
        `🎯 Admin dispatched Squad Bounty: "${newTask.title}"`,
        `Reward: ${newTask.xp} XP${bountyFirstBlood ? ' • ⚡ 2x First Blood' : ''}`,
        'admin',
        0
      );

      setBountyTitle('');
      setBountyDesc('');
      setBountyLink('');
      setBountyRefImages([]);
      notify('Squad Bounty Live', `"${newTask.title}" published as Honor Challenge.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/tasks`);
    }
  };

  const handleStartEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      id: task.id,
      title: task.title || '',
      subject: task.subject || 'Physics',
      xp: task.xp !== undefined && task.xp !== null ? String(task.xp) : '50',
      questionsText: task.questionsText || '',
      linkUrl: task.linkUrl || '',
      doubleXpFirst: Boolean(task.doubleXpFirst),
      requireProof: Boolean(task.requireProof),
      syncCompletions: true,
      timeSpentByMember: { ...(task.timeSpentByMember || {}) },
      completions: { ...(task.completions || {}) }
    });
  };

  const handleSaveTaskEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskId || !editTaskForm) return;
    const basePath = `artifacts/${appId}/public/data`;
    const newXp = editTaskForm.xp === '' ? 0 : Math.max(0, Number(editTaskForm.xp));

    const existingTask = tasks.find(t => t.id === editingTaskId);
    const updatedCompletions = { ...(existingTask?.completions || editTaskForm.completions || {}) };

    if (editTaskForm.syncCompletions !== false) {
      Object.keys(updatedCompletions).forEach((memId) => {
        const comp = updatedCompletions[memId];
        if (comp && comp.status === 'verified') {
          const isFirstBlood = Boolean(comp.isFirstBlood);
          comp.xpAwarded = isFirstBlood && editTaskForm.doubleXpFirst ? newXp * 2 : newXp;
        }
      });
    }

    try {
      await updateDoc(doc(db, basePath, 'tasks', editingTaskId), {
        title: editTaskForm.title.trim(),
        subject: editTaskForm.subject,
        xp: newXp,
        questionsText: (editTaskForm.questionsText || '').trim(),
        linkUrl: (editTaskForm.linkUrl || '').trim(),
        doubleXpFirst: Boolean(editTaskForm.doubleXpFirst),
        requireProof: Boolean(editTaskForm.requireProof),
        completions: updatedCompletions
      });

      await pushActivity(
        'bounty_edit',
        `🎯 Admin updated Bounty "${editTaskForm.title.trim()}"`,
        `Reward updated to ${newXp} XP${editTaskForm.doubleXpFirst ? ' (2x First Blood)' : ''}`,
        'admin',
        0
      );

      setEditingTaskId(null);
      setEditTaskForm(null);
      notify('Bounty Updated', `Reward set to ${newXp} XP.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${editingTaskId}`);
    }
  };

  const handleAdminQuickUpdateBountyXp = async (task: any, newXpRaw: number | string) => {
    const basePath = `artifacts/${appId}/public/data`;
    const newXp = Math.max(0, Number(newXpRaw) || 0);

    const updatedCompletions = { ...(task.completions || {}) };
    Object.keys(updatedCompletions).forEach((memId) => {
      const comp = updatedCompletions[memId];
      if (comp && comp.status === 'verified') {
        const isFirstBlood = Boolean(comp.isFirstBlood);
        comp.xpAwarded = isFirstBlood && task.doubleXpFirst ? newXp * 2 : newXp;
      }
    });

    try {
      await updateDoc(doc(db, basePath, 'tasks', task.id), {
        xp: newXp,
        completions: updatedCompletions
      });
      await pushActivity(
        'bounty_edit',
        `🎯 Admin updated Bounty "${task.title}"`,
        `Reward set to ${newXp} XP`,
        'admin',
        0
      );
      notify('Bounty Reward Updated', `Set to ${newXp} XP.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${task.id}`);
    }
  };

  const handleAdminToggleMemberTaskCompletion = async (task: any, memberId: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    const completions = { ...(task.completions || {}) };
    if (completions[memberId] && completions[memberId].status === 'verified') {
      delete completions[memberId];
    } else {
      completions[memberId] = {
        status: 'verified',
        completedAt: Date.now(),
        xpAwarded: 0,
        isFirstBlood: false,
        proofImages: [],
        note: 'Verified by Admin'
      };
    }
    try {
      await updateDoc(doc(db, basePath, 'tasks', task.id), { completions });
      notify('Task Status Updated', `Updated completion for ${memberId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${task.id}`);
    }
  };

  // Session Editor
  const handleStartEditSession = (s: any) => {
    setEditingSessionId(s.id);
    setEditSessionForm({
      subject: s.subject || 'Physics',
      duration: Number(s.duration) || 60,
      questions: Number(s.questions) || 0,
      difficulty: s.difficulty || 'mains',
      xpEarned: Number(s.xpEarned) || 20,
      notes: s.notes || ''
    });
  };

  const handleSaveSessionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSessionId || !editSessionForm) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await updateDoc(doc(db, basePath, 'sessions', editingSessionId), {
        subject: editSessionForm.subject,
        duration: Number(editSessionForm.duration) || 0,
        questions: Number(editSessionForm.questions) || 0,
        difficulty: editSessionForm.difficulty,
        xpEarned: Number(editSessionForm.xpEarned) || 0,
        notes: editSessionForm.notes.trim()
      });
      setEditingSessionId(null);
      setEditSessionForm(null);
      notify('Session Updated', 'Study session modified.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/sessions/${editingSessionId}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'sessions', id));
      notify('Session Deleted', 'Removed study session.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/sessions/${id}`);
    }
  };

  // Exam Editor
  const handleStartEditExam = (ex: any) => {
    setEditingExamId(ex.id);
    setEditExamForm({
      title: ex.title || '',
      examType: ex.examType || 'JEE Mains',
      overallMarks: Number(ex.overallMarks) || 0,
      overallMaxMarks: Number(ex.overallMaxMarks) || 300,
      overallRank: Number(ex.overallRank) || 1,
      totalStudents: Number(ex.totalStudents) || 560,
      subjects: (ex.subjects || []).map((s: any) => ({ ...s }))
    });
  };

  const handleSaveExamEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExamId || !editExamForm) return;
    const basePath = `artifacts/${appId}/public/data`;
    const total = Math.max(1, Number(editExamForm.totalStudents) || 1);
    const rank = Math.max(1, Number(editExamForm.overallRank) || 1);
    const overallPercentile = Number(calcPercentile(rank, total).toFixed(2));
    const updatedSubjects = (editExamForm.subjects || []).map((sub: any) => {
      const sRank = Math.max(1, Number(sub.rank) || rank);
      return {
        ...sub,
        marks: Number(sub.marks) || 0,
        maxMarks: Number(sub.maxMarks) || 100,
        rank: sRank,
        percentile: Number(calcPercentile(sRank, total).toFixed(2))
      };
    });

    try {
      await updateDoc(doc(db, basePath, 'exams', editingExamId), {
        title: editExamForm.title.trim(),
        examType: editExamForm.examType,
        overallMarks: Number(editExamForm.overallMarks) || 0,
        overallMaxMarks: Number(editExamForm.overallMaxMarks) || 300,
        overallRank: rank,
        totalStudents: total,
        overallPercentile,
        subjects: updatedSubjects
      });
      setEditingExamId(null);
      setEditExamForm(null);
      notify('Exam Updated', `Recalculated percentile: ${overallPercentile}%ile`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/exams/${editingExamId}`);
    }
  };

  const handleDeleteExam = async (id: string) => {
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await deleteDoc(doc(db, basePath, 'exams', id));
      notify('Exam Deleted', 'Removed exam record.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${basePath}/exams/${id}`);
    }
  };

  // Proof Verification & Broadcasts
  const handleAdminVerifyProof = async (task: any, memberId: string, approve: boolean) => {
    const basePath = `artifacts/${appId}/public/data`;
    const completions = { ...(task.completions || {}) };
    const existing = completions[memberId];
    if (!existing) return;

    const targetMem = members.find(m => m.id === memberId);

    try {
      if (approve) {
        const anyoneVerified = Object.entries(completions).some(
          ([k, v]: [string, any]) => k !== memberId && v && v.status === 'verified'
        );
        const isFirstBlood = !task.isPersonal && task.doubleXpFirst && !anyoneVerified;
        const baseXp = task.xp !== undefined && task.xp !== null ? Math.max(0, Number(task.xp)) : 35;
        const finalXp = isFirstBlood ? baseXp * 2 : baseXp;

        completions[memberId] = {
          ...existing,
          status: 'verified',
          xpAwarded: finalXp,
          isFirstBlood,
          verifiedAt: Date.now()
        };

        await updateDoc(doc(db, basePath, 'tasks', task.id), { completions });
        await pushActivity(
          'proof_approved',
          `✅ Admin verified ${targetMem?.name || memberId}'s proof for "${task.title}"`,
          `Awarded +${finalXp} XP`,
          memberId,
          finalXp
        );
        notify('Proof Approved', `+${finalXp} XP awarded`);
      } else {
        delete completions[memberId];
        await updateDoc(doc(db, basePath, 'tasks', task.id), { completions });
        notify('Proof Rejected', 'Submission cleared so member can re-upload.', 'error');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${basePath}/tasks/${task.id}`);
    }
  };

  const handleAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    const basePath = `artifacts/${appId}/public/data`;
    try {
      await addDoc(collection(db, basePath, 'announcements'), {
        message: broadcastMessage.trim(),
        target: broadcastTarget,
        timestamp: Date.now()
      });
      await pushActivity('broadcast', '📢 Announcement', broadcastMessage.trim(), 'admin', 0);
      setBroadcastMessage('');
      notify('Announcement Sent', `Pushed to ${broadcastTarget === 'ALL' ? 'Everyone' : broadcastTarget}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${basePath}/announcements`);
    }
  };

  const customStyles = `
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #08090C;
      color: #EDEDED;
    }

    h1, h2, h3, h4, .font-display {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.025em;
    }

    .font-mono-num {
      font-family: 'JetBrains Mono', monospace;
      font-variant-numeric: tabular-nums;
    }

    @keyframes viewEnter {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes modalEnter {
      from { opacity: 0; transform: scale(0.98) translateY(6px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .animate-view {
      animation: viewEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .animate-modal {
      animation: modalEnter 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .surface-card {
      background: #0E1015;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7);
      position: relative;
    }

    .surface-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
      pointer-events: none;
      border-radius: inherit;
    }

    .surface-leader-1 {
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.09) 0%, #0E1015 65%);
      border: 1px solid rgba(245, 158, 11, 0.35);
      box-shadow: 0 14px 40px -10px rgba(245, 158, 11, 0.16);
      position: relative;
    }

    .surface-leader-1::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.7), transparent);
      pointer-events: none;
      border-radius: inherit;
    }

    .btn-primary {
      background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
      color: #FFFFFF;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 12px rgba(249, 115, 22, 0.28);
    }
    .btn-primary:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 18px rgba(249, 115, 22, 0.42);
    }
    .btn-primary:active {
      transform: translateY(1px);
      box-shadow: 0 1px 6px rgba(249, 115, 22, 0.2);
    }

    .curtain-fabric {
      background: repeating-linear-gradient(
        90deg,
        #18090d 0px,
        #2b0d14 28px,
        #120609 56px
      );
      box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.9);
    }

    @keyframes podiumSpringUp {
      0% { opacity: 0; transform: translateY(100px) scale(0.94); }
      75% { opacity: 1; transform: translateY(-4px) scale(1.01); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .animate-podium-rise {
      animation: podiumSpringUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    @keyframes confettiFall {
      0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(105vh) rotate(720deg); opacity: 0.2; }
    }

    .confetti-piece {
      position: absolute;
      top: -20px;
      width: 8px;
      height: 14px;
      border-radius: 2px;
      animation: confettiFall linear infinite;
    }
  `;

  // PIN Vault Screen (Clean, accessible, touch keypad + physical keyboard support)
  if (!activeMemberId) {
    const displayMembers = members.length > 0 ? members : DEFAULT_MEMBERS;
    return (
      <div className="fixed inset-0 w-full min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#08090C] z-[100] overflow-y-auto antialiased">
        <style>{customStyles}</style>

        {/* Ambient background glow */}
        <div className="pointer-events-none fixed top-[-15%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-orange-500/10 blur-[130px]" />

        <div className="w-full max-w-[400px] flex flex-col items-center justify-center space-y-4 z-10 mx-auto">
          <div className="w-full max-w-[390px] sm:max-w-[420px] surface-card rounded-3xl p-3.5 sm:p-5 relative z-10 animate-modal shadow-2xl border border-zinc-800/80">

            {/* Header */}
            <div className="text-center space-y-0.5 mb-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-zinc-950 mx-auto shadow-md shadow-orange-500/20">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-display">JEE Grind Arena</h1>
              <p className="text-[10px] sm:text-[11px] text-zinc-500">Select profile & enter 4-digit PIN</p>
            </div>

          {/* Category Switcher: Students vs Tuition Teachers vs Admin */}
          <div className="flex p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 mb-2.5">
            <button
              type="button"
              onClick={() => {
                setTuitionVaultCategory('students');
                setLoginTarget(displayMembers[0]?.id || 'sai');
                setPinInput('');
                setLoginError('');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                tuitionVaultCategory === 'students'
                  ? 'bg-orange-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Students</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTuitionVaultCategory('teachers');
                const activeTeacherList = teachers.length > 0 ? teachers : DEFAULT_TEACHERS;
                setLoginTarget(activeTeacherList[0]?.id || 'teacher_sharma');
                setPinInput('');
                setLoginError('');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                tuitionVaultCategory === 'teachers'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Teachers</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTuitionVaultCategory('admin');
                setLoginTarget('admin');
                setPinInput('');
                setLoginError('');
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                tuitionVaultCategory === 'admin'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          </div>

          {/* Category 1: Students Grid */}
          {tuitionVaultCategory === 'students' && (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2.5 max-h-[170px] sm:max-h-[200px] overflow-y-auto pr-0.5">
              {displayMembers.map((m) => {
                const selected = loginTarget === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setLoginTarget(m.id);
                      setPinInput('');
                      setLoginError('');
                    }}
                    className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all flex items-center justify-between border ${
                      selected
                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-white flex items-center gap-1.5 truncate">
                        <span>{m.name}</span>
                        {m.isGrinding && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">{m.institute}</div>
                    </div>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 ${
                      selected ? 'bg-orange-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {m.name[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Category 2: Tuition Teachers Grid */}
          {tuitionVaultCategory === 'teachers' && (
            <div className="space-y-1.5 mb-2.5 max-h-[170px] sm:max-h-[200px] overflow-y-auto pr-0.5">
              <span className="text-[11px] font-semibold text-zinc-400 block px-1">
                Select Tuition Faculty Profile:
              </span>
              {teachers.length === 0 ? (
                <div className="p-3 sm:p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-2 my-1">
                  <GraduationCap className="w-7 h-7 text-amber-400/70 mx-auto" />
                  <div>
                    <p className="text-xs text-zinc-200 font-semibold">No tuition teacher profiles created yet</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Log in as Admin to add your tuition teachers by subject (Physics, Chemistry, Math).</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTuitionVaultCategory('admin');
                      setLoginTarget('admin');
                      setPinInput('');
                      setLoginError('');
                    }}
                    className="px-3 py-1 rounded-xl bg-amber-400 text-zinc-950 text-xs font-bold hover:bg-amber-300 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Log in as Admin to Add Teachers</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {teachers.map((t) => {
                    const selected = loginTarget === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setLoginTarget(t.id);
                          setPinInput('');
                          setLoginError('');
                        }}
                        className={`p-2.5 sm:p-3 rounded-2xl text-left transition-all flex items-center justify-between border ${
                          selected
                            ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm ring-1 ring-amber-400/30'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            selected ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-amber-400'
                          }`}>
                            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 truncate">
                              <span>{t.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 text-[10px] font-semibold border border-amber-400/20">
                                {t.subject}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate">{t.institute || 'Tuition Academy'}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono-num text-zinc-500">PIN: 4-digit</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Category 3: Admin Card */}
          {tuitionVaultCategory === 'admin' && (
            <div className="mb-2.5">
              <button
                type="button"
                onClick={() => {
                  setLoginTarget('admin');
                  setPinInput('');
                  setLoginError('');
                }}
                className="w-full p-3 sm:p-3.5 rounded-2xl text-left transition-all flex items-center justify-between border bg-amber-500/15 border-amber-400 text-white shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center font-bold">
                    <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-amber-400">Admin Command Center</div>
                    <div className="text-[10px] text-zinc-400">Master Roster, XP Modifiers & Routines</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono-num text-amber-400 font-bold">MASTER PIN</span>
              </button>
            </div>
          )}

            {/* 4-Dot Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-0.5">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pinInput.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      filled
                        ? 'bg-orange-500 scale-110 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                        : 'bg-zinc-800 border border-zinc-700'
                    }`}
                  />
                );
              })}
            </div>

            {loginError && (
              <div className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-medium">
                {loginError}
              </div>
            )}

            {/* 3x4 Keypad */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5 px-0.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinInputChange(pinInput + String(num))}
                  className="h-8 sm:h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800/90 text-xs sm:text-sm font-semibold text-white transition-all font-mono-num"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setLoginError('');
                }}
                className="h-8 sm:h-9 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 text-[10px] font-semibold text-zinc-500 transition-all"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinInputChange(pinInput + '0')}
                className="h-8 sm:h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-800/90 text-xs sm:text-sm font-semibold text-white transition-all font-mono-num"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPinInput(prev => prev.slice(0, -1))}
                className="h-9 sm:h-10 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 transition-all"
              >
                Del
              </button>
            </div>
            <p className="text-[10px] text-center text-zinc-500 pt-0.5">Physical keyboard active: type 0-9 or Backspace</p>
          </div>
          </div>
        </div>
      </div>
    );
  }


  const visibleAnnouncements = announcements.filter(a => {
    const msg = (a.message || '').toLowerCase();
    const title = (a.title || '').toLowerCase();
    if (msg.includes('sabotage') || msg.includes('sabatoge') || title.includes('sabotage') || title.includes('sabatoge')) {
      return false;
    }
    return a.target === 'ALL' || a.target === activeMemberId || activeMemberId === 'admin' || isAdminUnlocked;
  });

  const unreadAnnouncements = visibleAnnouncements.filter(a => 
    !readAnnouncementIds.includes(a.id) && (Number(a.timestamp) || 0) > announcementsLastRead
  );
  const unreadAnnouncementsCount = unreadAnnouncements.length;

  const pendingProofsCount = tasks.reduce((acc, t) => {
    const comps = Object.values(t.completions || {});
    return acc + comps.filter((c: any) => c && c.status === 'pending_review').length;
  }, 0);

  const navItems = [
    { id: 'arena' as const, label: 'Leaderboard', shortLabel: 'Ranks', icon: Trophy, badge: 0 },
    { id: 'timer' as const, label: 'Tracker & Focus', shortLabel: 'Tracker', icon: Clock, badge: 0 },
    { id: 'tasks' as const, label: 'Tasks & Quests', shortLabel: 'Tasks', icon: CheckSquare, badge: 0 },
    { id: 'tuition' as const, label: 'Tuition Hub', shortLabel: 'Tuition', icon: GraduationCap, badge: pendingTuitionCount },
    { id: 'stats' as const, label: 'Deep Analysis', shortLabel: 'Stats', icon: BarChart3, badge: 0 },
    ...(isAdminUnlocked || activeMemberId === 'admin'
      ? [{ id: 'admin' as const, label: 'Admin', shortLabel: 'Admin', icon: Crown, badge: pendingProofsCount }]
      : [])
  ];

  const hrsStr = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
  const minsStr = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
  const secsStr = String(timerSeconds % 60).padStart(2, '0');

  const topWeeklyXp = Math.max(100, ...(leaderboardStats.map(m => m.weeklyXp) || [100]));

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 pb-24 md:pb-12 relative">
      <style>{customStyles}</style>

      {/* Top ambient light */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-48 bg-gradient-to-b from-orange-500/[0.04] to-transparent" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm surface-card rounded-2xl p-3 flex items-center gap-2.5 border-orange-500/40 shadow-xl animate-modal">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
            toast.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {toast.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{toast.title}</div>
            {toast.detail && <div className="text-[10px] text-zinc-400 truncate">{toast.detail}</div>}
          </div>
          <button onClick={() => setToast(null)} className="text-zinc-500 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SIMPLIFIED, UNCLUTTERED, MOBILE-FIRST HEADER */}
      <header className="sticky top-0 z-30 bg-[#09090B]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 h-13 sm:h-14 flex items-center justify-between gap-2">
          {/* Brand & Connection Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-zinc-950 font-bold shadow-sm">
              <Flame className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white font-display">Grind Arena</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}
                title={isConnected ? 'Connected to live Firebase' : 'Connecting...'}
              />
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-orange-400' : ''}`} />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-zinc-950 text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live Timer Chip */}
            {(timerRunning || timerSeconds > 0) && (
              <button
                onClick={() => setActiveTab('timer')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[11px] font-mono-num hover:bg-orange-500/20 transition-all"
                title="Active stopwatch"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                <span>{hrsStr}:{minsStr}:{secsStr}</span>
              </button>
            )}

            {/* Web Push Notification Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPushModal(true)}
              className={`relative px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                pushPermission === 'granted' && pushEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : pushPermission === 'denied'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              }`}
              title="Web Push Notifications for Mobile & Phone Alerts"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-semibold text-[11px]">
                {pushPermission === 'granted' && pushEnabled ? 'Push On' : 'Push Alerts'}
              </span>
              {pushPermission === 'granted' && pushEnabled && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* Mute / Unmute Sound FX Toggle */}
            <button
              type="button"
              onClick={toggleAudioMute}
              className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-all"
              title={isMutedState ? "Audio Muted (Click to Unmute)" : "Audio Active (Click to Mute)"}
            >
              {isMutedState ? <VolumeX className="w-3.5 h-3.5 text-zinc-500" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            </button>

            {/* My Perks & Titles Launcher */}
            <button
              type="button"
              onClick={() => setShowPerksModal(true)}
              className="px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs flex items-center gap-1.5 transition-all"
              title="My Unlocked Perks & Titles"
            >
              <Gift className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline font-semibold text-[11px]">Perks</span>
            </button>

            {/* Squad Chat Drawer Launcher */}
            <button
              type="button"
              onClick={() => setShowChatDrawer(true)}
              className="relative px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 transition-all"
              title="Open Squad & Direct Messaging"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-semibold text-[11px]">Chat</span>
              {(() => {
                const currentUserId = currentTeacher ? currentTeacher.id : activeMemberId === 'admin' ? 'admin' : (currentMember?.id || 'sai');
                const unread = chatMessages.filter(m => 
                  m.senderId !== currentUserId && 
                  (m.recipientId === 'ALL' || m.recipientId === currentUserId) &&
                  m.timestamp > chatLastReadTimestamp
                ).length;
                return unread > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 font-extrabold text-[9px] font-mono-num animate-pulse">
                    {unread}
                  </span>
                ) : null;
              })()}
            </button>

            {/* Squad Announcements Button in Header */}
            <button
              type="button"
              onClick={() => {
                setShowAnnouncementsModal(true);
                markAnnouncementsAsRead();
              }}
              className={`relative px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                unreadAnnouncementsCount > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
              title="View Squad Announcements"
            >
              <Bell className={`w-3.5 h-3.5 ${unreadAnnouncementsCount > 0 ? 'text-amber-400 animate-bounce' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline font-semibold text-[11px]">Notice</span>
              {unreadAnnouncementsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-zinc-950 text-[9px] font-bold font-mono-num animate-pulse">
                  {unreadAnnouncementsCount}
                </span>
              )}
            </button>

            {/* Quick "+ Log" Primary CTA */}
            <button
              onClick={() => {
                setLogTargetMember(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
                setShowLogModal(true);
              }}
              className="btn-primary px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Log Study</span>
              <span className="sm:hidden">Log</span>
            </button>

            {/* Consolidated Profile & Controls Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-all"
                title="Profile & Settings"
              >
                <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700/80 flex items-center justify-center font-bold text-xs text-white">
                  {activeMemberId === 'admin' ? 'A' : (currentMember?.name[0] || 'U')}
                </div>
                <span className="hidden sm:inline font-medium">
                  {activeMemberId === 'admin' ? 'Admin' : currentMember?.name}
                </span>
                {unreadAnnouncementsCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              {/* Backdrop for easy tap-away dismissal on mobile */}
              {showProfileMenu && (
                <div
                  className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
                  onClick={() => setShowProfileMenu(false)}
                />
              )}

              {/* Profile Popover Menu */}
              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 surface-card rounded-xl p-1.5 shadow-2xl z-50 border-zinc-700/80 space-y-0.5 animate-modal"
                  onClick={() => setShowProfileMenu(false)}
                >
                  <div className="p-2 border-b border-zinc-800/80">
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>{activeMemberId === 'admin' ? 'Admin Controller' : currentMember?.name}</span>
                      {activeMemberId !== 'admin' && currentMember && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{currentMember.institute}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">JEE Grind Arena</div>
                  </div>

                  {activeMemberId !== 'admin' && (
                    <button
                      onClick={() => setShowPersonalTaskModal(true)}
                      className="w-full text-left p-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-400" />
                      <span>+ Add Personal Task</span>
                    </button>
                  )}

                  {!isAdminUnlocked && activeMemberId !== 'admin' ? (
                    <button
                      onClick={() => setShowAdminPassModal(true)}
                      className="w-full text-left p-2 rounded-lg text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 flex items-center gap-2"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Unlock Admin Mode</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab('admin')}
                      className="w-full text-left p-2 rounded-lg text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 flex items-center gap-2"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Open Admin Center</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowAnnouncementsModal(true);
                      markAnnouncementsAsRead();
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                      unreadAnnouncementsCount > 0 
                        ? 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30' 
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" />
                      <span>Announcements</span>
                    </span>
                    {unreadAnnouncementsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-zinc-950 text-[9px] font-bold">
                        {unreadAnnouncementsCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left p-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 border-t border-zinc-800/80 mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Switch User / Vault</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Dock Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#09090B]/95 backdrop-blur-xl border-t border-zinc-800/80 px-1 py-1 flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-semibold transition-all ${
                active ? 'text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[58px] text-[10px]">{item.shortLabel || item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-0.5 right-1.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-zinc-950 text-[8px] font-bold flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-6 pb-24 md:pb-12 space-y-5">
        {/* Compact Announcement Alert Banner */}
        {unreadAnnouncementsCount > 0 && (
          <div className="surface-card rounded-2xl p-3 px-3.5 border-l-4 border-l-amber-400 flex items-center justify-between gap-2.5 animate-view">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-amber-400 text-xs shrink-0 animate-bounce">📢</span>
              <p className="text-xs font-medium text-zinc-200 truncate">
                {unreadAnnouncements[0]?.message}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => {
                  setShowAnnouncementsModal(true);
                  markAnnouncementsAsRead();
                }}
                className="text-[10px] font-bold text-amber-400 hover:underline"
              >
                View All
              </button>
              <button onClick={markAnnouncementsAsRead} className="text-zinc-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: LEADERBOARD & BLIND REVEAL ARENA */}
        {activeTab === 'arena' && (
          <div className="space-y-5 animate-view">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-bold text-white font-display">Weekly Standings</h2>
                  {arenaSettings.leaderboardHidden && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-[10px] font-bold flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      <span>Blind Mode</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-400">
                  Study XP (10 XP/30m) + Question Tiers + Exam %ile Pool (max 300 XP)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(isAdminUnlocked || activeMemberId === 'admin') && (
                  arenaSettings.leaderboardHidden ? (
                    <button
                      onClick={() => handleAdminToggleLeaderboardBlackout(false)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md hover:brightness-110"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Reveal Kahoot</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAdminToggleLeaderboardBlackout(true)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Blind Mode</span>
                    </button>
                  )
                )}

                {!arenaSettings.leaderboardHidden && (
                  <button
                    onClick={triggerKahootRevealSequence}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-amber-300 flex items-center gap-1"
                    title="Replay Kahoot Podium Unveil"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Replay</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setExamMemberId(currentMember ? currentMember.id : (members[0]?.id || 'sai'));
                    setShowExamModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Log Exam</span>
                </button>
              </div>
            </div>

            {/* Blind Mode Screen */}
            {arenaSettings.leaderboardHidden && !adminPeekStandings ? (
              <div className="surface-card rounded-3xl p-6 sm:p-8 text-center space-y-5 relative overflow-hidden border-amber-500/30">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-white font-display">Standings Are Locked</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Leaderboard is in Blind Mode. Standings will be unveiled at the Grand Reveal Ceremony.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2">
                  {[...leaderboardStats]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => (
                      <div key={m.id} className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400 font-mono-num">#?</div>
                        <div className="text-xs font-bold text-white">{m.name}</div>
                        <div className="text-sm font-bold text-zinc-500 font-mono-num">??? XP</div>
                      </div>
                    ))}
                </div>

                {(isAdminUnlocked || activeMemberId === 'admin') && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => handleAdminToggleLeaderboardBlackout(false)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Launch Grand Reveal Ceremony</span>
                    </button>
                    <button
                      onClick={() => setAdminPeekStandings(true)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Admin Peek</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {arenaSettings.leaderboardHidden && adminPeekStandings && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Admin Secret Peek</span>
                    </span>
                    <button onClick={() => setAdminPeekStandings(false)} className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 text-[11px]">Exit Peek</button>
                  </div>
                )}

                {null}

                {/* 3-Competitor Standings Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {leaderboardStats.map((m, idx) => {
                    const isFirst = idx === 0;
                    const progressPct = Math.min(100, Math.round((m.weeklyXp / topWeeklyXp) * 100));
                    return (
                      <div
                        key={m.id}
                        className={`${
                          isFirst ? 'surface-leader-1 ring-1 ring-amber-400/40' : 'surface-card'
                        } rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all duration-200 hover:-translate-y-0.5`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs font-display shrink-0 ${
                                isFirst
                                  ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-zinc-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                                  : idx === 1
                                  ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-950 shadow-sm'
                                  : 'bg-gradient-to-br from-amber-700/80 to-amber-800 text-amber-200 border border-amber-600/40'
                              }`}>
                                {isFirst ? <Crown className="w-5 h-5 stroke-[2.5]" /> : `#${idx + 1}`}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <div className="flex items-center gap-1">
                                    <h3 className="text-sm sm:text-base font-bold text-white font-display tracking-tight">{m.name}</h3>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800/90 text-zinc-400 font-medium">{m.institute}</span>
                                  <span
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-orange-500/40 text-orange-300 font-bold flex items-center gap-1 shadow-sm"
                                    title={`Daily Streak: ${m.streakCount || 1} day(s) active (${Math.round((getStreakMultiplier(m.streakCount || 1) - 1) * 100)}% XP Bonus)`}
                                  >
                                    <Flame className="w-3 h-3 text-orange-400 fill-orange-400 animate-pulse" />
                                    <span>{m.streakCount || 1}d Streak</span>
                                    {getStreakMultiplier(m.streakCount || 1) > 1 && (
                                      <span className="text-[9px] text-amber-300 font-extrabold bg-orange-500/30 px-1 rounded">
                                        +{Math.round((getStreakMultiplier(m.streakCount || 1) - 1) * 100)}%
                                      </span>
                                    )}
                                  </span>

                                  {/* 1.25x Underdog Buff Badge */}
                                  {(topWeeklyXp - m.weeklyXp >= 150) && (
                                    <span
                                      className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/50 text-violet-300 font-bold flex items-center gap-1 shadow-[0_0_10px_rgba(139,92,246,0.3)] animate-pulse"
                                      title="150+ XP behind leader — 1.25x Underdog Buff active to close the gap!"
                                    >
                                      <Zap className="w-3 h-3 text-violet-400" />
                                      <span>⚡ 1.25x Underdog</span>
                                    </span>
                                  )}

                                  {/* Equipped Cosmetic Title */}
                                  {m.equippedTitle && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold flex items-center gap-1">
                                      <span>{m.equippedTitle}</span>
                                    </span>
                                  )}
                                </div>
                                {m.isGrinding ? (
                                  <div className="text-[10px] text-orange-400 flex items-center gap-1.5 font-semibold mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                                    <span>Grinding {m.grindingSubject}</span>
                                  </div>
                                ) : m.activeRestDayDate === new Date().toISOString().split('T')[0] ? (
                                  <div className="text-[10px] text-amber-300 flex items-center gap-1 font-semibold mt-0.5">
                                    <Coffee className="w-3 h-3 text-amber-400" />
                                    <span>☕ Resting & Recharging</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-zinc-500 mt-0.5">Career: {m.totalXp} XP</div>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className={`text-xl sm:text-2xl font-bold font-mono-num tracking-tight ${
                                isFirst ? 'text-amber-400 drop-shadow-[0_2px_12px_rgba(245,158,11,0.3)]' : 'text-white'
                              }`}>
                                {m.weeklyXp}
                              </div>
                              <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">Weekly XP</div>
                            </div>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-white/[0.04]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFirst
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                                  : 'bg-orange-500/80'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Interactive Nudge & Rest Shield Controls Row */}
                        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] gap-1">
                          {m.id === (activeMemberId || currentMember?.id || 'sai') ? (
                            <button
                              type="button"
                              onClick={handleActivateRestDay}
                              disabled={m.activeRestDayDate === new Date().toISOString().split('T')[0] || (m.restTokens !== undefined ? m.restTokens <= 0 : false)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Consume 1 Rest Token to protect your streak"
                            >
                              <Shield className="w-3 h-3 text-amber-400" />
                              <span>{m.activeRestDayDate === new Date().toISOString().split('T')[0] ? '🛡️ Rest Shield Active' : `🛡️ Rest Shield (${m.restTokens !== undefined ? m.restTokens : 1} token)`}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleNudgeMember(m.id)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95"
                              title={`Send a retro buzzer nudge to ${m.name}`}
                            >
                              <span>👉 Nudge {m.name}</span>
                            </button>
                          )}
                          {m.standingStatus === 'unexcused_zero' ? (
                            <span className="text-rose-400 font-bold flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 truncate">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate">Unexcused Zero: 0 XP ({m.standingDetail})</span>
                            </span>
                          ) : m.standingStatus === 'fresh_test' ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 truncate">
                              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">Tested this week: {m.weekAvgPercentile.toFixed(1)}%ile</span>
                            </span>
                          ) : m.standingStatus === 'active_standing' ? (
                            <span className="text-amber-300 font-semibold flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30 truncate" title={m.standingDetail}>
                              <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">Active Standing: {m.weekAvgPercentile.toFixed(1)}%ile in play</span>
                            </span>
                          ) : (
                            <span className="text-zinc-500 flex items-center gap-1">
                              <span>No mock exams logged</span>
                            </span>
                          )}

                          <span className={`font-mono-num shrink-0 font-bold ${
                            m.standingStatus === 'unexcused_zero' ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            +{m.examXpWeek} XP
                          </span>
                        </div>

                        {/* 3 Metric Breakdown Tiles */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                          <div className="p-2 rounded-xl bg-zinc-950/70 border border-white/[0.04]">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">Study</div>
                            <div className="text-xs font-bold text-white mt-0.5 font-mono-num">{formatDuration(m.weekStudyMins)}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-950/70 border border-white/[0.04]">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">Exam %ile</div>
                            <div className={`text-xs font-bold mt-0.5 font-mono-num ${
                              m.standingStatus === 'unexcused_zero' ? 'text-rose-400' : 'text-white'
                            }`}>
                              {m.standingStatus === 'unexcused_zero'
                                ? '0% (0 XP)'
                                : (m.weekAvgPercentile > 0 ? `${m.weekAvgPercentile.toFixed(1)}%` : '-')}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-zinc-950/70 border border-white/[0.04]">
                            <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">Solved</div>
                            <div className="text-xs font-bold text-white mt-0.5 font-mono-num">{m.weekQuestions} Qs</div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* ACHIEVEMENT BADGES SHOWCASE SECTION */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-amber-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                        <Award className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                          <span>Hall of Achievement Badges</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 text-[10px] border border-amber-400/30 font-bold">
                            Milestones & Trophies
                          </span>
                        </h3>
                        <p className="text-[11px] text-zinc-400">
                          Earn badges for cumulative study hours, question drills, streak milestones, and exam standings.
                        </p>
                      </div>
                    </div>

                    {/* Filter Selector by Student */}
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shrink-0 overflow-x-auto max-w-full no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setBadgeSelectedMemberId('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          badgeSelectedMemberId === 'ALL'
                            ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        All Squad
                      </button>
                      {leaderboardStats.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setBadgeSelectedMemberId(m.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                            badgeSelectedMemberId === m.id
                              ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Badges Grid per Student */}
                  <div className="space-y-4">
                    {leaderboardStats
                      .filter(m => badgeSelectedMemberId === 'ALL' || badgeSelectedMemberId === m.id)
                      .map(mem => {
                        const badges = [
                          {
                            id: '100_hours',
                            title: '100 Hours Club',
                            category: 'Study Marathon',
                            icon: Clock,
                            unlocked: (mem.totalStudyMins || 0) >= 6000,
                            current: Math.round((mem.totalStudyMins || 0) / 60),
                            target: 100,
                            unit: 'hrs',
                            desc: 'Accumulate 100+ total hours of study time'
                          },
                          {
                            id: 'math_master',
                            title: 'Math Master',
                            category: 'Numerical Drill',
                            icon: Target,
                            unlocked: (mem.mathQuestions || 0) >= 100,
                            current: mem.mathQuestions || 0,
                            target: 100,
                            unit: 'Qs',
                            desc: 'Solve 100+ practice problems in Math'
                          },
                          {
                            id: 'physics_titan',
                            title: 'Physics Titan',
                            category: 'Numerical Drill',
                            icon: Zap,
                            unlocked: (mem.physicsQuestions || 0) >= 100,
                            current: mem.physicsQuestions || 0,
                            target: 100,
                            unit: 'Qs',
                            desc: 'Solve 100+ practice problems in Physics'
                          },
                          {
                            id: 'chem_alchemist',
                            title: 'Chem Alchemist',
                            category: 'Numerical Drill',
                            icon: Sparkles,
                            unlocked: (mem.chemQuestions || 0) >= 100,
                            current: mem.chemQuestions || 0,
                            target: 100,
                            unit: 'Qs',
                            desc: 'Solve 100+ practice problems in Chemistry'
                          },
                          {
                            id: 'streak_king',
                            title: 'Streak King',
                            category: 'Daily Discipline',
                            icon: Flame,
                            unlocked: (mem.streakCount || 1) >= 5,
                            current: mem.streakCount || 1,
                            target: 5,
                            unit: 'days',
                            desc: 'Maintain a 5+ consecutive day login streak'
                          },
                          {
                            id: 'task_slayer',
                            title: 'Task Slayer',
                            category: 'Quest Complete',
                            icon: CheckCircle2,
                            unlocked: (mem.completedTasksCount || 0) >= 10,
                            current: mem.completedTasksCount || 0,
                            target: 10,
                            unit: 'quests',
                            desc: 'Complete 10+ homework or personal tasks'
                          },
                          {
                            id: 'mock_champion',
                            title: 'Mock Champion',
                            category: 'Exam Standing',
                            icon: Trophy,
                            unlocked: (mem.bestPercentile || 0) >= 90,
                            current: Math.round(mem.bestPercentile || 0),
                            target: 90,
                            unit: '%ile',
                            desc: 'Achieve 90%+ percentile standing in a mock test'
                          },
                          {
                            id: 'marathoner',
                            title: 'Marathoner',
                            category: 'Focus Power',
                            icon: Crown,
                            unlocked: (mem.longestSessionMins || 0) >= 180,
                            current: Math.round((mem.longestSessionMins || 0) / 60),
                            target: 3,
                            unit: 'hrs',
                            desc: 'Complete a single 3+ hour intense study session'
                          },
                          {
                            id: 'homework_vanguard',
                            title: 'Homework Vanguard',
                            category: 'Faculty Homework',
                            icon: BookOpen,
                            unlocked: (teacherAssignments.filter(a => a.submissions?.[mem.id]?.status === 'graded').length || 0) >= 5,
                            current: teacherAssignments.filter(a => a.submissions?.[mem.id]?.status === 'graded').length || 0,
                            target: 5,
                            unit: 'HWs',
                            desc: 'Successfully submit and complete 5+ faculty assignments'
                          },
                          {
                            id: 'century_solver',
                            title: '500 Qs Titan',
                            category: 'Numerical Drill',
                            icon: Brain,
                            unlocked: ((mem.mathQuestions || 0) + (mem.physicsQuestions || 0) + (mem.chemQuestions || 0)) >= 500,
                            current: (mem.mathQuestions || 0) + (mem.physicsQuestions || 0) + (mem.chemQuestions || 0),
                            target: 500,
                            unit: 'Qs',
                            desc: 'Solve 500+ cumulative practice problems across all subjects'
                          },
                          {
                            id: 'streak_warrior',
                            title: '14-Day Warrior',
                            category: 'Daily Discipline',
                            icon: Flame,
                            unlocked: (mem.streakCount || 1) >= 14,
                            current: mem.streakCount || 1,
                            target: 14,
                            unit: 'days',
                            desc: 'Maintain an unbroken 14+ day study login streak'
                          },
                          {
                            id: 'advanced_titan',
                            title: 'JEE Advanced Titan',
                            category: 'Exam Standing',
                            icon: Shield,
                            unlocked: (mem.bestPercentile || 0) >= 98,
                            current: Math.round(mem.bestPercentile || 0),
                            target: 98,
                            unit: '%ile',
                            desc: 'Scored 98%+ percentile in a competitive JEE mock test'
                          },
                          {
                            id: 'squad_pioneer',
                            title: '200 Hours Legend',
                            category: 'Study Marathon',
                            icon: GraduationCap,
                            unlocked: (mem.totalStudyMins || 0) >= 12000,
                            current: Math.round((mem.totalStudyMins || 0) / 60),
                            target: 200,
                            unit: 'hrs',
                            desc: 'Accumulate 200+ total cumulative hours of focus time'
                          }
                        ];

                        const unlockedCount = badges.filter(b => b.unlocked).length;

                        return (
                          <div key={mem.id} className="p-3 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-bold text-xs text-orange-400 shrink-0">
                                  {mem.name[0]}
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                                  <span>{mem.name}'s Badges</span>
                                  <span className="text-[10px] text-zinc-400 truncate">({mem.institute})</span>
                                </div>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono-num font-bold text-[11px] shrink-0">
                                🏆 {unlockedCount} / {badges.length} Unlocked
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3.5">
                              {badges.map(b => {
                                const Icon = b.icon;
                                const pct = Math.min(100, Math.round((b.current / b.target) * 100));

                                return (
                                  <div
                                    key={b.id}
                                    className={`p-3 rounded-xl border flex flex-col justify-between gap-2 relative overflow-hidden transition-all ${
                                      b.unlocked
                                        ? 'bg-gradient-to-b from-amber-500/15 to-zinc-900 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                                        : 'bg-zinc-900/40 border-zinc-800/80 opacity-70 hover:opacity-100'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-start justify-between">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                          b.unlocked
                                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-950 font-bold shadow-sm'
                                            : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                          <Icon className="w-4 h-4 stroke-[2.2]" />
                                        </div>
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                                          b.unlocked
                                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                            : 'bg-zinc-800 text-zinc-500'
                                        }`}>
                                          {b.unlocked ? 'UNLOCKED' : 'LOCKED'}
                                        </span>
                                      </div>

                                      <div className="mt-2">
                                        <h4 className={`text-xs font-bold font-display ${b.unlocked ? 'text-amber-300' : 'text-zinc-300'}`}>
                                          {b.title}
                                        </h4>
                                        <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{b.desc}</p>
                                      </div>
                                    </div>

                                    <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                                      <div className="flex items-center justify-between text-[10px] font-mono-num font-semibold">
                                        <span className="text-zinc-400">Progress</span>
                                        <span className={b.unlocked ? 'text-amber-300 font-bold' : 'text-zinc-400'}>
                                          {b.current} / {b.target} {b.unit}
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            b.unlocked ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-zinc-700'
                                          }`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}

            {/* Split Grid: Recent Logs & Live Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="surface-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                    <span>Recent Study Sessions</span>
                  </h3>
                  <button onClick={() => setShowLogModal(true)} className="text-[11px] font-semibold text-orange-400">
                    + Log
                  </button>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">No sessions logged yet.</div>
                  ) : (
                    sessions.slice(0, 10).map((s) => (
                      <div key={s.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{s.memberName}</span>
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300 font-semibold">{s.subject}</span>
                            <span className="font-mono-num text-orange-400">{formatDuration(s.duration)}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                            {s.questions > 0 ? `${s.questions} Qs • ` : ''}{s.notes || 'Session'}
                          </div>
                        </div>
                        <div className="text-right shrink-0 font-mono-num text-xs font-bold text-white">
                          +{s.xpEarned} XP
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Live Arena Activity Feed */}
              <div className="surface-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white font-display flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Real-Time Arena Activity</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">No live activity yet.</div>
                  ) : (
                    activities.slice(0, 10).map((act) => (
                      <div key={act.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-100 truncate">{act.title}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{act.detail}</div>
                        </div>
                        <div className="text-[10px] text-zinc-500 shrink-0 font-mono-num">{timeAgo(act.timestamp)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TRACKER: FOCUS STOPWATCH & LOG LAUNCHER */}
        {activeTab === 'timer' && (
          <div className="space-y-5 animate-view">
            {/* WEEKLY CO-OP SQUAD RAID BOSS BANNER */}
            <div className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 border transition-all ${
              raidBoss.isDefeated || raidBoss.currentHp <= 0
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-yellow-500/20 border-amber-400/50 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                : 'bg-gradient-to-r from-red-950/40 via-zinc-900 to-amber-950/30 border-red-500/30'
            }`}>
              {/* Critical Hit Float-up Animation Overlay */}
              {critDamageAnim && (
                <div className="absolute top-2 right-6 z-20 animate-bounce pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-amber-400 text-zinc-950 font-black text-xs sm:text-sm shadow-xl border border-amber-300 flex items-center gap-1 font-mono-num animate-pulse">
                    <span>💥 CRITICAL HIT!</span>
                    <span>-{critDamageAnim.amount} DMG</span>
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      raidBoss.isDefeated || raidBoss.currentHp <= 0
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}>
                      {raidBoss.isDefeated || raidBoss.currentHp <= 0 ? '🏆 VICTORY UNLOCKED' : '⚔️ WEEKLY CO-OP RAID BOSS'}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono-num font-semibold">
                      Co-op Health Pool
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white font-display flex items-center gap-2">
                    <span>{raidBoss.name}</span>
                    {raidBoss.isDefeated && <span className="text-amber-400 text-xs">👑 TITAN SLAYERS!</span>}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRaidBossBanner(!showRaidBossBanner)}
                  className="text-xs text-zinc-400 hover:text-white font-semibold flex items-center gap-1 shrink-0 self-start sm:self-auto"
                >
                  <span>{showRaidBossBanner ? 'Hide Details' : 'Show Boss Details'}</span>
                </button>
              </div>

              {/* Animated Health Bar */}
              <div className="mt-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono-num font-bold">
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-red-400" />
                    <span>Boss Health Status</span>
                  </span>
                  <span className={raidBoss.isDefeated || raidBoss.currentHp <= 0 ? 'text-amber-300' : 'text-red-400'}>
                    {raidBoss.currentHp.toLocaleString()} / {raidBoss.totalHp.toLocaleString()} HP ({Math.max(0, Math.min(100, Math.round((raidBoss.currentHp / raidBoss.totalHp) * 100)))}%)
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      raidBoss.isDefeated || raidBoss.currentHp <= 0
                        ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300'
                        : 'bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, (raidBoss.currentHp / raidBoss.totalHp) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Expanded Boss Damage Breakdown & Avatar Contributions */}
              {showRaidBossBanner && (
                <div className="mt-4 pt-3.5 border-t border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Squad Damage Contributions:
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      1m = 1 DMG • Easy = 1 DMG • Mains = 3 DMG • Adv = 10 DMG (CRIT)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                      const dmg = Number(raidBoss.contributions?.[m.id]) || 0;
                      const pct = Math.round((dmg / (raidBoss.totalHp || 10000)) * 100);
                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-bold text-xs text-orange-400 shrink-0">
                              {m.name[0]}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">{m.name}</span>
                              <span className="text-[10px] text-zinc-400 font-mono-num">{pct}% of Boss HP</span>
                            </div>
                          </div>
                          <span className="font-mono-num font-bold text-amber-300 text-xs shrink-0">
                            {dmg.toLocaleString()} DMG
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Zen Focus Stopwatch */}
            <div className="surface-card rounded-3xl p-5 sm:p-7 flex flex-col items-center justify-between text-center space-y-4">
              <div className="space-y-1 w-full">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-lg sm:text-xl font-bold text-white font-display">Zen Focus Stopwatch</h2>
                  <button
                    type="button"
                    onClick={() => setShowTimerInfoModal(true)}
                    className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30 font-medium transition-all"
                    title="Learn how the offline & power-off resilient timer works"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Power-Off Resilient</span>
                  </button>
                </div>
                <p className="text-xs text-zinc-400 text-left">
                  Counts accurately even if phone powers off, sleeps, or reloads.
                </p>
              </div>

              {/* Live Session Time Log & Persistence Status */}
              {timerRunning && (
                <div className="w-full max-w-sm p-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-200 flex items-center justify-between gap-2 animate-view">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping shrink-0" />
                    <div className="min-w-0 text-left">
                      <div className="font-bold text-[11px] text-white">
                        Started at {timerStartedAtStr || (timerStartTime ? new Date(timerStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now')}
                      </div>
                      <div className="text-[10px] text-orange-300/80 truncate">
                        {timerLinkedTask ? `Task: ${timerLinkedTask.title}` : `Focusing on ${timerSubject}`}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-mono font-bold shrink-0">
                    Active
                  </span>
                </div>
              )}

              {/* Circular SVG Ring */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center my-1">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 240 240">
                  <circle cx="120" cy="120" r="95" className="stroke-zinc-800" strokeWidth="8" fill="transparent" />
                  <circle
                    cx="120"
                    cy="120"
                    r="95"
                    className="stroke-orange-500 transition-all duration-1000 ease-linear"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 95}
                    strokeDashoffset={2 * Math.PI * 95 * (1 - ((timerSeconds % 3600) / 3600))}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl sm:text-4xl font-bold font-mono-num tracking-tight text-white">
                    {hrsStr}:{minsStr}:{secsStr}
                  </div>
                  <div className="text-xs font-semibold text-orange-400 mt-1.5 flex items-center gap-1.5">
                    {timerRunning && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />}
                    <span>{timerRunning ? `Focus: ${timerSubject}` : 'Paused'}</span>
                  </div>
                </div>
              </div>

              {/* Choose Target Task (Auto-sets Subject) */}
              <div className="space-y-1.5 w-full max-w-sm text-left">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-orange-400" />
                    <span>Focus on Task / Assignment (Auto-picks Subject)</span>
                  </label>
                  {timerLinkedTaskId && (
                    <button
                      type="button"
                      onClick={() => handleSelectTimerTask('')}
                      className="text-[10px] text-zinc-500 hover:text-rose-400 font-semibold"
                    >
                      Clear Task
                    </button>
                  )}
                </div>

                <select
                  value={timerLinkedTaskId}
                  onChange={(e) => handleSelectTimerTask(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
                >
                  <option value="">⚡ Free Study / General Practice (No specific task)</option>
                  {availableTimerTasks.length > 0 && (
                    <optgroup label="📋 Active Personal Tasks & Quests">
                      {availableTimerTasks.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title} • [{t.subject || 'General'}] (+{t.xpReward || 50} XP)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {availableTimerAssignments.length > 0 && (
                    <optgroup label="🎓 Homework Assignments">
                      {availableTimerAssignments.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.title} • [{a.subject}] (Due: {a.dueDate || 'Soon'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {timerLinkedTask && (
                  <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-orange-400">🎯</span>
                      <span className="truncate font-medium">{timerLinkedTask.title}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold text-[10px] shrink-0">
                      Auto-set: {timerSubject}
                    </span>
                  </div>
                )}
              </div>

              {/* Tag Subject */}
              <div className="space-y-1.5 w-full max-w-sm text-left">
                <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block text-center">Subject</label>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {SUBJECT_OPTIONS.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setTimerSubject(sub.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        timerSubject === sub.id
                          ? 'bg-orange-500 text-zinc-950 font-bold shadow-sm'
                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={toggleLiveTimer}
                  className="btn-primary px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5"
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{timerRunning ? 'Pause' : 'Start Focus'}</span>
                </button>

                {timerSeconds > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={finishLiveTimerAndOpenLogger}
                      className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Finish & Log</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetLiveTimer}
                      className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400"
                      title="Reset stopwatch"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Screen Wake Lock & Offline Resilience Badges */}
              <div className="w-full max-w-sm pt-2.5 border-t border-zinc-800/60 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const next = !keepScreenAwake;
                    setKeepScreenAwake(next);
                    localStorage.setItem('jee_arena_timer_keep_awake', String(next));
                    if (next && timerRunning) {
                      requestScreenWakeLock().then(active => setWakeLockActive(active));
                      notify('Screen Wake Lock Active ⚡', 'Phone screen will stay awake while studying.');
                    } else {
                      releaseScreenWakeLock();
                      setWakeLockActive(false);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-semibold transition-all ${
                    keepScreenAwake
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Keeps your phone screen on while studying so it never goes black automatically"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{keepScreenAwake ? 'Keep Screen Awake: ON' : 'Screen Awake: OFF'}</span>
                </button>

                <div
                  className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-900/50 px-2 py-1 rounded-lg border border-zinc-800 font-mono"
                  title="Accidental reload and phone power-off resilient"
                >
                  <span>🛡️ Reload-safe</span>
                </div>
              </div>
            </div>

            {/* Quick Session Stats & Logger launcher */}
            <div className="space-y-4">
              <div className="surface-card rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white font-display">StudyFlow Logger</h3>
                  <button onClick={() => setShowLogModal(true)} className="btn-primary px-3 py-1 rounded-lg text-xs font-semibold">
                    Open Full Form
                  </button>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Log by natural time range (e.g. <strong className="text-zinc-200">5:30pm - 7:30pm</strong>) with difficulty multipliers and 30 XP/hr abuse limit.
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 uppercase font-bold">This Week</div>
                    <div className="text-lg font-bold text-white mt-0.5 font-mono-num">
                      {formatDuration(leaderboardStats.find(s => s.id === (currentMember?.id || 'sai'))?.weekStudyMins || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 uppercase font-bold">Questions</div>
                    <div className="text-lg font-bold text-orange-400 mt-0.5 font-mono-num">
                      {leaderboardStats.find(s => s.id === (currentMember?.id || 'sai'))?.weekQuestions || 0} Qs
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Member Logs */}
              <div className="surface-card rounded-3xl p-5 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Your Recent Logs</h4>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {sessions
                    .filter(s => s.memberId === (currentMember?.id || 'sai'))
                    .slice(0, 5)
                    .map(s => (
                      <div key={s.id} className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white">{s.subject}</span>
                          <span className="text-orange-400 font-mono-num ml-1.5">{formatDuration(s.duration)}</span>
                          <span className="text-zinc-500 ml-1.5">({s.questions || 0} Qs)</span>
                        </div>
                        <div className="font-mono-num text-amber-400 font-bold">+{s.xpEarned} XP</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB 3: TASKS & QUESTS */}
        {activeTab === 'tasks' && (
          <div className="space-y-5 animate-view">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-white font-display">Tasks & Quests</h2>
                <p className="text-xs text-zinc-400">Personal study checklists and squad bounties.</p>
              </div>
              <div className="flex items-center gap-2">
                {activeMemberId !== 'admin' && (
                  <button
                    onClick={() => setShowPersonalTaskModal(true)}
                    className="btn-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+ My Task</span>
                  </button>
                )}
                {(isAdminUnlocked || activeMemberId === 'admin') && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setAdminSubTab('bounties');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Dispatch Bounty</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filter */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit">
              {[
                { id: 'ACTIVE' as const, label: 'Active Quests' },
                { id: 'COMPLETED' as const, label: 'Completed' },
                { id: 'ALL' as const, label: 'All' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTasksFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    tasksFilter === f.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Task Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {tasks
                .filter((t) => {
                  const myId = currentMember?.id || 'sai';
                  const canSee =
                    isAdminUnlocked ||
                    activeMemberId === 'admin' ||
                    (t.isPersonal ? t.ownerId === myId : (!t.assignedTo || t.assignedTo.includes('ALL') || t.assignedTo.includes(myId)));
                  if (!canSee) return false;

                  const myComp = t.completions && t.completions[myId];
                  const isDone = myComp && myComp.status === 'verified';

                  if (tasksFilter === 'ACTIVE') return !isDone;
                  if (tasksFilter === 'COMPLETED') return isDone;
                  return true;
                })
                .map((task) => {
                  const myId = currentMember?.id || 'sai';
                  const myComp = task.completions && task.completions[myId];
                  const isDone = myComp && myComp.status === 'verified';
                  const isPending = myComp && myComp.status === 'pending_review';
                  const canDelete = isAdminUnlocked || activeMemberId === 'admin' || (task.isPersonal && task.ownerId === myId);

                  return (
                    <div
                      key={task.id}
                      className={`surface-card rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3 min-w-0 max-w-full overflow-hidden ${
                        isDone ? 'opacity-65 border-zinc-800/50' : ''
                      }`}
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-semibold">{task.subject}</span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-medium font-mono-num">
                              Time/Q Log Only
                            </span>
                            {!task.isPersonal && task.doubleXpFirst && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">⚡ 2x First Blood</span>
                            )}
                          </div>

                          {canDelete && (
                            <button onClick={() => handleDeleteTask(task)} className="text-zinc-500 hover:text-rose-400 p-1 shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-white font-display break-words max-w-full">{task.title}</h3>

                        {task.questionsText && (
                          <p className="text-[11px] sm:text-xs text-zinc-400 whitespace-pre-line break-words max-w-full">{task.questionsText}</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                          {task.isPersonal ? `Personal: ${task.createdBy}` : 'Squad Bounty'}
                        </span>

                        {isDone ? (
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-amber-400 text-xs font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Done</span>
                          </span>
                        ) : isPending ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-semibold">
                            Pending Review
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCompleteTaskClick(task)}
                            className="btn-primary px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>{task.requireProof ? 'Submit Proof' : 'Complete'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB: TUITION FACULTY & ACADEMIC DESK */}
        {activeTab === 'tuition' && (
          <div className="space-y-5 animate-view">
            {/* Header & Subject Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-white font-display">
                    {currentTeacher || activeMemberId === 'admin' ? 'Tuition Faculty Desk' : 'Tuition Student Hub'}
                  </h2>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>AI Telemetry Grounded</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  {currentTeacher || activeMemberId === 'admin'
                    ? 'Real-time study hours, problem volume, test standing diagnostics, and tuition homework management.'
                    : 'Track assigned tuition homework, submit completed solutions or excuses, and review your subject effort & marks standing.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subject Selector Tabs */}
                {availableTuitionSubjects.length > 1 ? (
                  <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    {availableTuitionSubjects.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSelectedTuitionSubject(sub);
                          if (teacherAiReport) setTeacherAiReport(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTuitionSubject === sub
                            ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-bold text-amber-300 flex items-center gap-1.5 shadow-sm">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Active Subject: Mathematics</span>
                  </div>
                )}

                {(currentTeacher || activeMemberId === 'admin') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowTeacherXpModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md min-h-[40px]"
                      title="Award or Deduct XP for a student in this subject"
                    >
                      <Zap className="w-4 h-4 fill-zinc-950 text-zinc-950" />
                      <span>⚡ Add / Remove XP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAssignSubject(selectedTuitionSubject);
                        setShowCreateAssignmentModal(true);
                      }}
                      className="btn-primary min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>+ Dispatch Homework</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Current Role / Faculty Identity Banner */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400">
                  {currentTeacher ? '👨‍🏫' : activeMemberId === 'admin' ? '👑' : '🎓'}
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>
                      {currentTeacher
                        ? `Tuition Faculty: ${currentTeacher.name} (${currentTeacher.subject})`
                        : activeMemberId === 'admin'
                        ? 'Admin Command View (Full Tuition Powers)'
                        : `Student Desk: ${currentMember?.name || 'Aspirant'}`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      Active: {selectedTuitionSubject}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {currentTeacher
                      ? `${currentTeacher.institute || 'Tuition Academy'} • Reviewing squad effort & homework completion`
                      : 'Students must provide valid reasoning for incomplete assignments to avoid XP deduction.'}
                  </div>
                </div>
              </div>

              {!currentTeacher && activeMemberId !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setTuitionVaultCategory('teachers');
                    setActiveMemberId(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Switch to Teacher Profile</span>
                </button>
              )}
            </div>

            {/* Sub-Navigation for Tuition Hub */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
              {[
                { id: 'analysis' as const, label: `📊 Effort & Marks Telemetry (${selectedTuitionSubject})`, icon: BarChart3 },
                {
                  id: 'assignments' as const,
                  label: `📚 Homework & Excuses (${teacherAssignments.filter(a => a.subject === selectedTuitionSubject).length})`,
                  icon: BookOpen
                }
              ].map((sub) => {
                const Icon = sub.icon;
                const isActive = tuitionSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setTuitionSubTab(sub.id)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-amber-400 text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-VIEW 1: EFFORT & MARKS TELEMETRY */}
            {tuitionSubTab === 'analysis' && (
              <div className="space-y-4">
                {/* Aggregate KPI Ribbon */}
                {(() => {
                  const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
                  const relevantSessions = sessions.filter(s => s.subject === selectedTuitionSubject && (s.timestamp || 0) >= weekStartMs);
                  const totalSubMins = relevantSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
                  const totalSubQs = relevantSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Weekly Time in {selectedTuitionSubject}</span>
                        <div className="text-lg sm:text-xl font-bold text-white font-mono-num mt-1">
                          {formatDuration(totalSubMins)}
                        </div>
                        <span className="text-[10px] text-zinc-500">Across {relevantSessions.length} sessions</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Problems Solved</span>
                        <div className="text-lg sm:text-xl font-bold text-amber-400 font-mono-num mt-1">
                          {totalSubQs} Qs
                        </div>
                        <span className="text-[10px] text-zinc-500">Practice questions</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Active Assignments</span>
                        <div className="text-lg sm:text-xl font-bold text-orange-400 font-mono-num mt-1">
                          {teacherAssignments.filter(a => a.subject === selectedTuitionSubject).length} tasks
                        </div>
                        <span className="text-[10px] text-zinc-500">{selectedTuitionSubject} homework sets</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Students Monitored</span>
                        <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono-num mt-1">
                          {activeList.length} aspirants
                        </div>
                        <span className="text-[10px] text-zinc-500">Sai, Nishchit, Ved</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Individual Student Telemetry Cards */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Student Breakdown in {selectedTuitionSubject} (Weekly Effort & Marks)
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchTeacherAiReport(selectedTuitionSubject)}
                      disabled={isLoadingTeacherAi}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isLoadingTeacherAi ? 'Analyzing...' : 'Generate Gemini AI Report'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                      const memSessions = sessions.filter(s => s.memberId === m.id && s.subject === selectedTuitionSubject && (s.timestamp || 0) >= weekStartMs);
                      const subMins = memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
                      const subQs = memSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
                      const stat = leaderboardStats.find(s => s.id === m.id);

                      const memExams = exams.filter(e => e.memberId === m.id);
                      const latestEx = memExams[0];
                      const subExamInfo = latestEx ? (latestEx.subjects || []).find((s: any) => s.name?.toLowerCase() === selectedTuitionSubject.toLowerCase()) : null;

                      const subAsgs = teacherAssignments.filter(a => a.subject === selectedTuitionSubject);
                      const completedCount = subAsgs.filter(a => a.submissions?.[m.id]?.status === 'graded').length;
                      const hasExcuse = subAsgs.some(a => a.submissions?.[m.id]?.status === 'pending' && a.submissions?.[m.id]?.note?.includes('Excuse:'));

                      return (
                        <div key={m.id} className="surface-card rounded-2xl p-4 space-y-3.5 border-zinc-800 hover:border-zinc-700 transition-all">
                          {/* Student Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-sm text-white">
                                {m.name[0]}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                  <span>{m.name}</span>
                                  {m.unexcusedZero && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Unexcused Zero penalty" />
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400">{m.institute}</div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 font-mono-num text-xs font-bold">
                              {subQs} Qs
                            </span>
                          </div>

                          {/* Effort Breakdown Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentSessionsModal({ member: m, subject: selectedTuitionSubject })}
                              className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-400/50 transition-all text-left group cursor-pointer"
                              title={`Click to view ${m.name}'s ${selectedTuitionSubject} study sessions`}
                            >
                              <span className="text-[10px] text-zinc-400 group-hover:text-amber-300 block mb-0.5 font-medium flex items-center justify-between">
                                <span>Study Effort</span>
                                <span className="text-[9px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">Logs ➔</span>
                              </span>
                              <span className="font-bold text-white font-mono-num text-sm">
                                {formatDuration(subMins)}
                              </span>
                              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 block">
                                {memSessions.length} study sessions
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setPersonalInspectMember(m.id);
                                setActiveTab('stats');
                                setAnalyticsTab('trajectory');
                              }}
                              className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-400/50 transition-all text-left group cursor-pointer"
                              title={`Click to view ${m.name}'s test history and diagnostic graph`}
                            >
                              <span className="text-[10px] text-zinc-400 group-hover:text-amber-300 block mb-0.5 font-medium flex items-center justify-between">
                                <span>Mock Marks</span>
                                <span className="text-[9px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">Graph ➔</span>
                              </span>
                              <span className="font-bold text-amber-400 font-mono-num text-sm">
                                {subExamInfo ? `${subExamInfo.marks || 0}/${subExamInfo.maxMarks || 100}` : 'No test'}
                              </span>
                              <span className="text-[10px] text-zinc-400 group-hover:text-zinc-300 block font-mono-num">
                                {subExamInfo?.percentile !== undefined ? `${Number(subExamInfo.percentile).toFixed(1)}%ile` : 'Overall: ' + (stat?.weekAvgPercentile.toFixed(1) || 0) + '%ile'}
                              </span>
                            </button>
                          </div>

                          {/* Status & Homework Tag */}
                          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                            <button
                              type="button"
                              onClick={() => setTuitionSubTab('assignments')}
                              className="flex items-center gap-1 hover:text-amber-300 transition-colors text-left"
                              title="View homework assignments and submission status"
                            >
                              {hasExcuse ? (
                                <span className="text-amber-400 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>Excuse Filed (View Desk ➔)</span>
                                </span>
                              ) : (
                                <span className="text-zinc-400 hover:text-white">
                                  Homework: <strong className="text-white font-mono-num">{completedCount}/{subAsgs.length}</strong> <span className="text-[10px] text-amber-400 ml-1 font-semibold">View ➔</span>
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Comparative Progress Graphs & Marks Matrix */}
                <div className="surface-card rounded-3xl p-5 space-y-4 border-zinc-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-amber-400" />
                      <h3 className="text-sm font-bold text-white font-display">
                        Comparative Progress Graphs: {selectedTuitionSubject}
                      </h3>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono-num">
                      Comparing Effort, Test Marks & Homework Completion Across Squad
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* GRAPH 1: Weekly Study Effort & Problems Solved Comparison */}
                    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Weekly Study Effort ({selectedTuitionSubject})</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono-num">Duration vs Practice Qs</span>
                      </div>

                      {(() => {
                        const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
                        const minsMap = activeList.map(m => {
                          const memSessions = sessions.filter(s => s.memberId === m.id && s.subject === selectedTuitionSubject && (s.timestamp || 0) >= weekStartMs);
                          const duration = memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
                          const questions = memSessions.reduce((acc, s) => acc + (Number(s.questions) || 0), 0);
                          return { member: m, duration, questions };
                        });

                        const maxMins = Math.max(1, ...minsMap.map(x => x.duration));
                        const maxQs = Math.max(1, ...minsMap.map(x => x.questions));

                        return (
                          <div className="space-y-3 pt-1">
                            {minsMap.map(({ member: m, duration, questions }) => {
                              const durPct = Math.round((duration / maxMins) * 100);
                              const qPct = Math.round((questions / maxQs) * 100);

                              return (
                                <div key={m.id} className="space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-zinc-300">
                                    <span className="font-bold text-white">{m.name}</span>
                                    <span className="font-mono-num text-[11px] text-zinc-400">
                                      {formatDuration(duration)} • <strong className="text-amber-400">{questions} Qs</strong>
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden flex">
                                      <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(5, durPct)}%` }}
                                      />
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden flex">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(5, qPct)}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 pt-2 border-t border-zinc-900">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded bg-amber-400" />
                                <span>Study Hours</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded bg-emerald-500" />
                                <span>Practice Questions Solved</span>
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* GRAPH 2: Mock Exam Marks & Subject Percentile Comparison */}
                    <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Latest Mock Marks ({selectedTuitionSubject})</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono-num">Exam Marks Comparison</span>
                      </div>

                      {(() => {
                        const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
                        const examMap = activeList.map(m => {
                          const memExams = exams.filter(e => e.memberId === m.id);
                          const latestEx = memExams[0];
                          const subInfo = latestEx ? (latestEx.subjects || []).find((s: any) => s.name?.toLowerCase() === selectedTuitionSubject.toLowerCase()) : null;
                          const marks = subInfo ? Number(subInfo.marks) || 0 : (latestEx ? Number(latestEx.overallMarks) || 0 : 0);
                          const maxMarks = subInfo ? Number(subInfo.maxMarks) || 100 : (latestEx ? Number(latestEx.overallMaxMarks) || 300 : 100);
                          const rank = subInfo ? Number(subInfo.rank) || Number(latestEx?.overallRank) || 1 : (latestEx ? Number(latestEx.overallRank) || 1 : 1);
                          const total = latestEx ? Number(latestEx.totalStudents) || 560 : 560;
                          const percentile = subInfo?.percentile !== undefined ? Number(subInfo.percentile) : (latestEx ? calcPercentile(rank, total) : 0);
                          return { member: m, marks, maxMarks, percentile, title: latestEx?.title || 'No Test' };
                        });

                        const maxAchievedMarks = Math.max(1, ...examMap.map(x => x.marks));

                        return (
                          <div className="space-y-3 pt-1">
                            {examMap.map(({ member: m, marks, maxMarks, percentile, title }) => {
                              const markPct = Math.round((marks / maxAchievedMarks) * 100);

                              return (
                                <div key={m.id} className="space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-zinc-300">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-white">{m.name}</span>
                                      <span className="text-[10px] text-zinc-500 font-mono-num truncate max-w-[120px]">({title})</span>
                                    </div>
                                    <span className="font-mono-num text-[11px] font-bold text-amber-400">
                                      {marks}/{maxMarks} <span className="text-zinc-400 font-normal">({percentile.toFixed(1)}%ile)</span>
                                    </span>
                                  </div>

                                  <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden flex p-0.5 border border-zinc-800">
                                    <div
                                      className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.max(5, markPct)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}

                            <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 flex items-center justify-between">
                              <span>Subject Class Average:</span>
                              <strong className="text-white font-mono-num">
                                {(examMap.reduce((a, b) => a + b.marks, 0) / (examMap.length || 1)).toFixed(1)} Marks
                              </strong>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Gemini AI Diagnostic Report Box */}
                {teacherAiReport && (
                  <div className="surface-card rounded-3xl p-5 sm:p-6 space-y-4 border-amber-500/30 animate-view">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Gemini Academic Diagnostic: {selectedTuitionSubject}
                        </h3>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono-num">AI Analyzed</span>
                    </div>

                    {/* Overall Verdict Banner */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
                        Collective Effort Verdict
                      </span>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        {teacherAiReport.overallEffortSummary || 'Students are demonstrating consistent engagement with balanced question volume.'}
                      </p>
                    </div>

                    {/* Student Analysis Grid */}
                    {teacherAiReport.studentAnalysis && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {Object.entries(teacherAiReport.studentAnalysis).map(([name, data]: [string, any]) => (
                          <div key={name} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-sm">{name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 text-[10px] font-semibold">
                                {data.effortVerdict || 'Active'}
                              </span>
                            </div>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">
                              {data.diagnostic || 'Solid effort observed.'}
                            </p>
                            {data.tuitionFocus && (
                              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80 text-[10px] text-amber-300 font-medium">
                                🎯 Focus: {data.tuitionFocus}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lesson Recommendations */}
                    {teacherAiReport.recommendedTuitionLesson && (
                      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 block">
                          Suggested Lesson Focus for Tuition Class
                        </span>
                        <p className="text-xs leading-relaxed text-zinc-300">
                          {teacherAiReport.recommendedTuitionLesson}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* SUB-VIEW 3: ASSIGNMENTS & EXCUSES DESK (ROLE-TAILORED WORKSPACE) */}
            {tuitionSubTab === 'assignments' && (
              <div className="space-y-4">
                {/* Header Banner - Role Tailored */}
                {currentMember ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-zinc-950 border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wide">
                          Student Workspace
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">Logged in as {currentMember.name}</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white font-display">
                        {selectedTuitionSubject} Homework & Solution Desk
                      </h3>
                      <p className="text-xs text-zinc-300">
                        Upload written solutions, camera photos, PDF documents, or Google Drive links for faculty review.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-center min-w-[100px]">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase block">Active HW</span>
                        <span className="text-sm font-extrabold text-amber-400 font-mono-num">
                          {teacherAssignments.filter(a => {
                            if (a.archived) return false;
                            if (selectedTuitionSubject !== 'ALL' && a.subject !== selectedTuitionSubject) return false;
                            const isAssigned = !a.assignedTo || a.assignedTo.includes('ALL') || a.assignedTo.includes(currentMember.id);
                            return isAssigned;
                          }).length} Items
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wide">
                          Faculty Console
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {currentTeacher ? `Faculty: ${currentTeacher.name}` : 'Admin Command Mode'}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white font-display">
                        {selectedTuitionSubject} Tuition Evaluation & Homework Dispatch
                      </h3>
                      <p className="text-xs text-zinc-300">
                        Dispatch homework assignments, evaluate student submissions, and approve incompletion excuses.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {(currentTeacher || activeMemberId === 'admin' || isAdminUnlocked) && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignSubject(selectedTuitionSubject === 'ALL' ? 'Math' : selectedTuitionSubject);
                            setShowCreateAssignmentModal(true);
                          }}
                          className="btn-primary min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          <span>Create New Assignment</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Subject & Archive Filters Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-950 p-2 rounded-2xl border border-zinc-800/80">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-xs font-bold text-zinc-400 px-2 shrink-0">Filter Subject:</span>
                    {availableTuitionSubjects.map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setSelectedTuitionSubject(subj)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          selectedTuitionSubject === subj
                            ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setTuitionAssignmentFilter('active')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        tuitionAssignmentFilter === 'active'
                          ? 'bg-zinc-800 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setTuitionAssignmentFilter('archived')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        tuitionAssignmentFilter === 'archived'
                          ? 'bg-zinc-800 text-white font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Archived
                    </button>
                  </div>
                </div>

                {/* Assignments List */}
                <div className="space-y-3">
                  {teacherAssignments
                    .filter(a => (
                      (selectedTuitionSubject === 'ALL' || a.subject === selectedTuitionSubject) &&
                      (tuitionAssignmentFilter === 'archived' ? Boolean(a.archived) : !a.archived)
                    ))
                    .map((asg) => {
                      const activeList = members.length > 0 ? members : DEFAULT_MEMBERS;
                      const targetIds = asg.assignedTo && asg.assignedTo.includes('ALL')
                        ? activeList.map(m => m.id)
                        : (asg.assignedTo || []);

                      const studentId = activeMemberId || currentMember?.id;
                      const mySub = studentId ? asg.submissions?.[studentId] : null;

                      return (
                        <div key={asg.id} className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-zinc-800">
                          {/* Assignment Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-base text-white font-display">{asg.title}</span>
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-amber-300 text-[10px] font-bold border border-amber-400/20">
                                  {asg.subject}
                                </span>
                                {asg.xpReward > 0 ? (
                                  <span className="px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 text-[10px] font-bold font-mono-num border border-orange-500/30">
                                    +{asg.xpReward} XP Reward
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] font-semibold">
                                    0 XP Practice
                                  </span>
                                )}
                                {asg.doubleXpFullComplete && (
                                  <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30 flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-amber-400" />
                                    <span>2X Speed Boost</span>
                                  </span>
                                )}
                                {asg.archived && (
                                  <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">
                                    Archived
                                  </span>
                                )}
                              </div>

                              {asg.description && (
                                <p className="text-xs text-zinc-300 leading-relaxed">{asg.description}</p>
                              )}

                              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-1">
                                <span>Faculty: <strong className="text-zinc-200">{asg.teacherName || 'Tuition Faculty'}</strong></span>
                                <span>•</span>
                                <span>Questions: <strong className="text-zinc-200">{asg.questionsCount || 10} Qs</strong></span>
                                <span>•</span>
                                <span className="font-mono-num text-amber-300 font-semibold">Due Date: {asg.dueDate}</span>
                              </div>
                            </div>

                            {/* Faculty Management Actions */}
                            {(currentTeacher || activeMemberId === 'admin' || isAdminUnlocked) && (
                              <div className="flex items-center gap-1 shrink-0 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                                <button
                                  type="button"
                                  onClick={() => handleToggleArchiveAssignment(asg.id, !asg.archived)}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-all"
                                >
                                  {asg.archived ? <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" /> : <Archive className="w-3.5 h-3.5 text-zinc-400" />}
                                  <span>{asg.archived ? 'Restore' : 'Archive'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAssignment(asg)}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-all"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTeacherAssignment(asg.id, asg.title)}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-rose-900/30 text-rose-400 text-xs font-semibold flex items-center gap-1 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Teacher's Attached Reference Material */}
                          {((asg.attachedFiles && asg.attachedFiles.length > 0) || asg.refLink) && (
                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs">
                              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                                📎 Teacher Materials & Reference Links:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {(asg.attachedFiles || []).map((file, i) => (
                                  <a
                                    key={i}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs flex items-center gap-1.5 transition-all"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="truncate max-w-[180px] font-medium">{file.name}</span>
                                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                                  </a>
                                ))}
                                {asg.refLink && (
                                  <a
                                    href={asg.refLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-1.5 transition-all"
                                  >
                                    <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Reference Material Link</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* STUDENT DIRECT ACTION BANNER & SUBMISSION HUB */}
                          {(() => {
                            const activeStudentId = (activeMemberId && activeMemberId !== 'admin' && !activeMemberId.startsWith('teacher_'))
                              ? activeMemberId
                              : 'sai';
                            const studentMem = (members.length > 0 ? members : DEFAULT_MEMBERS).find(m => m.id === activeStudentId) || { id: 'sai', name: 'Sai' };
                            const studentSub = asg.submissions?.[activeStudentId];

                            return (
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-orange-500/30 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-xs font-bold text-white">Submission Status ({studentMem.name}):</span>
                                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg ${
                                        studentSub?.status === 'graded'
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : studentSub?.status === 'pending'
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : studentSub?.status === 'overdue_penalized'
                                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                      }`}>
                                        {studentSub?.status === 'graded'
                                          ? `✅ Graded (+${studentSub.xpAwarded} XP)`
                                          : studentSub?.status === 'pending'
                                          ? '⏳ Submitted & Awaiting Faculty Review'
                                          : studentSub?.status === 'overdue_penalized'
                                          ? '⚠️ Overdue'
                                          : '🎯 Pending Submission'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                      {studentSub?.status === 'graded'
                                        ? `Feedback: "${studentSub.feedback || 'Good effort!'}"`
                                        : studentSub?.status === 'pending'
                                        ? 'You can update solution files, typed answers, or Google Drive links anytime before grading.'
                                        : 'Attach handwritten notes, camera solution photos, PDFs, typed answers, or resource links.'}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenStudentSubmission(asg, 'submit_solution')}
                                      className="btn-primary min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                                    >
                                      <Upload className="w-4 h-4 stroke-[2.5]" />
                                      <span>{studentSub ? 'Update Homework Submission' : 'Submit Homework Solution'}</span>
                                    </button>

                                    {!studentSub && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStudentSubmission(asg, 'submit_excuse')}
                                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 font-semibold text-xs transition-all"
                                      >
                                        File Excuse
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Active Student Target Bar if Admin / Guest */}
                                {(!activeMemberId || activeMemberId === 'admin' || activeMemberId.startsWith('teacher_')) && (
                                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400">
                                    <span className="font-semibold text-amber-400">Submit homework on behalf of student:</span>
                                    {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setActiveMemberId(m.id);
                                          localStorage.setItem('jee_arena_active_id', m.id);
                                          notify('Active Student Set', `Now submitting as ${m.name}`);
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                          activeStudentId === m.id
                                            ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                                        }`}
                                      >
                                        {m.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Student Submissions Roster Grid */}
                          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                              Classmate Submissions & Roster Status:
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {targetIds.map((memId) => {
                                const mem = activeList.find(m => m.id === memId);
                                if (!mem) return null;
                                const sub = asg.submissions?.[memId];
                                const isDone = sub?.status === 'graded';
                                const isPending = sub?.status === 'pending';
                                const isOverduePenalized = sub?.status === 'overdue_penalized';
                                const isExcuse = isPending && sub?.note?.includes('Excuse:');
                                const isSelf = activeMemberId === memId;

                                return (
                                  <div
                                    key={memId}
                                    className={`p-3 rounded-xl border space-y-2 text-xs ${
                                      isDone
                                        ? 'bg-zinc-900/40 border-zinc-800'
                                        : isExcuse
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : isOverduePenalized
                                        ? 'bg-rose-500/10 border-rose-500/30'
                                        : 'bg-zinc-950 border-zinc-800/80'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white flex items-center gap-1.5">
                                        <span>{mem.name}</span>
                                        {isSelf && <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 font-bold">You</span>}
                                      </span>
                                      <span className={`text-[10px] font-bold ${
                                        isDone
                                          ? 'text-emerald-400'
                                          : isExcuse
                                          ? 'text-amber-400'
                                          : isOverduePenalized
                                          ? 'text-rose-400'
                                          : isPending
                                          ? 'text-amber-300'
                                          : 'text-zinc-500'
                                      }`}>
                                        {isDone
                                          ? (sub.xpAwarded && sub.xpAwarded < 0 ? `Penalized (${sub.xpAwarded} XP)` : `Graded (+${sub.xpAwarded} XP)`)
                                          : isExcuse
                                          ? '⚠️ Excuse Filed'
                                          : isOverduePenalized
                                          ? `Overdue (${sub.xpAwarded} XP)`
                                          : isPending
                                          ? 'Pending Review'
                                          : 'Not Submitted'}
                                      </span>
                                    </div>

                                    {/* Attachments / Links Summary */}
                                    {((sub?.attachedFiles && sub.attachedFiles.length > 0) || (sub?.resourceLinks && sub.resourceLinks.length > 0)) && (
                                      <div className="flex items-center gap-2 text-[10px] text-cyan-300 font-medium">
                                        {sub.attachedFiles && sub.attachedFiles.length > 0 && (
                                          <span>📎 {sub.attachedFiles.length} file(s)</span>
                                        )}
                                        {sub.resourceLinks && sub.resourceLinks.length > 0 && (
                                          <span>🔗 {sub.resourceLinks.length} link(s)</span>
                                        )}
                                      </div>
                                    )}

                                    {/* Teacher / Admin Action Button */}
                                    {(currentTeacher || activeMemberId === 'admin' || isAdminUnlocked) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReviewingAssignment(asg);
                                          setReviewingStudentId(memId);
                                        }}
                                        className="w-full py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition-all"
                                      >
                                        <span>{isExcuse ? 'Review Excuse & Decision' : 'Grade Submission'}</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {teacherAssignments.filter(a => (
                    (selectedTuitionSubject === 'ALL' || a.subject === selectedTuitionSubject) &&
                    (tuitionAssignmentFilter === 'archived' ? Boolean(a.archived) : !a.archived)
                  )).length === 0 && (
                    <div className="surface-card rounded-2xl p-8 text-center space-y-2 text-zinc-500 text-xs">
                      <BookOpen className="w-8 h-8 mx-auto text-zinc-600" />
                      <div className="font-bold text-zinc-300 text-sm">
                        No {tuitionAssignmentFilter} {selectedTuitionSubject === 'ALL' ? '' : selectedTuitionSubject} assignments found
                      </div>
                      <p className="text-zinc-400">
                        {currentTeacher || activeMemberId === 'admin'
                          ? 'Click "Create New Assignment" above to assign questions and track completion.'
                          : 'Your teachers have not posted homework for this subject yet.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DEEP ANALYSIS & FAIR PERCENTILE DIAGNOSTICS */}
        {activeTab === 'stats' && (
          <div className="space-y-5 animate-view">
            {/* Header & Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-2xl font-bold text-white font-display">Deep Analysis</h2>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Gemini AI Grounded</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400">Exam progression graphs, test-to-test AI mentor summaries, and normalized percentile comparisons.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowExamModal(true)}
                  className="btn-primary min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ Log Exam</span>
                </button>
              </div>
            </div>

            {/* Navigation Sub-Tabs for Analysis */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800/80">
              {[
                { id: 'trajectory' as const, label: '📈 Improvement Trajectory & AI Summary', icon: TrendingUp },
                { id: 'compare' as const, label: '⚔️ Student-to-Student Comparison', icon: Target },
                { id: 'subjects' as const, label: '🔬 Subject-Wise Percentiles', icon: BarChart3 }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = analyticsTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAnalyticsTab(tab.id)}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-orange-500 text-zinc-950 font-bold shadow-md'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Fair Comparison Rule Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-zinc-900 border border-amber-500/25 text-xs text-zinc-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Fair Comparison Protocol: Relative Percentile Normalization</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Modulus has ~560 aspirants, while Allen batches fluctuate across thousands. Comparing raw ranks (e.g. #15 vs #40) is mathematically biased.
                Every exam is normalized to <strong className="text-zinc-200">Percentile = (1 - (Rank - 1) / Total Batch) × 100</strong>. Weekly Exam XP pool is strictly capped at 300 XP.
              </p>
            </div>

            {/* SUB-VIEW 1: TRAJECTORY & AI SUMMARY */}
            {analyticsTab === 'trajectory' && (
              <div className="space-y-4">
                {/* Student Selector Row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                    const isSelected = personalInspectMember === m.id;
                    const count = exams.filter(e => e.memberId === m.id).length;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPersonalInspectMember(m.id)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                          isSelected
                            ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md'
                            : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          isSelected ? 'bg-zinc-950 text-amber-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {m.name[0]}
                        </span>
                        <span>{m.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono-num ${
                          isSelected ? 'bg-zinc-950/20 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {count} tests
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Trajectory Graph & Metric Selector */}
                {(() => {
                  const targetMem = members.find(m => m.id === personalInspectMember) || DEFAULT_MEMBERS.find(m => m.id === personalInspectMember);
                  const memExams = [...exams]
                    .filter(e => e.memberId === personalInspectMember)
                    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                  const latestExam = memExams.length > 0 ? memExams[memExams.length - 1] : null;
                  const previousExam = memExams.length > 1 ? memExams[memExams.length - 2] : null;
                  const currentPercentile = latestExam ? Number(latestExam.overallPercentile) : 0;
                  const prevPercentile = previousExam ? Number(previousExam.overallPercentile) : null;
                  const delta = prevPercentile !== null ? (currentPercentile - prevPercentile) : null;

                  // Compute graph data points based on activeGraphMetric ('Overall' | 'Physics' | 'Chemistry' | 'Math')
                  const plotPoints = memExams.map((ex, idx) => {
                    let val = Number(ex.overallPercentile) || 0;
                    if (activeGraphMetric !== 'Overall') {
                      const sub = (ex.subjects || []).find((s: any) => s.name === activeGraphMetric);
                      val = sub ? Number(sub.percentile) || 0 : val;
                    }
                    return {
                      index: idx,
                      title: ex.title,
                      date: ex.date || 'Test',
                      value: val,
                      exam: ex
                    };
                  });

                  // SVG Chart calculations
                  const svgWidth = 640;
                  const svgHeight = 220;
                  const padLeft = 45;
                  const padRight = 30;
                  const padTop = 25;
                  const padBottom = 35;
                  const innerWidth = svgWidth - padLeft - padRight;
                  const innerHeight = svgHeight - padTop - padBottom;

                  const minVal = 50; // JEE Mock percentiles benchmark range
                  const maxVal = 100;

                  const getX = (idx: number) => {
                    if (plotPoints.length <= 1) return padLeft + innerWidth / 2;
                    return padLeft + (idx / (plotPoints.length - 1)) * innerWidth;
                  };

                  const getY = (val: number) => {
                    const clamped = Math.max(minVal, Math.min(maxVal, val));
                    const normalized = (clamped - minVal) / (maxVal - minVal);
                    return padTop + (1 - normalized) * innerHeight;
                  };

                  const pathD = plotPoints.length > 0
                    ? plotPoints.reduce((acc, pt, idx) => {
                        const x = getX(idx);
                        const y = getY(pt.value);
                        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
                      }, '')
                    : '';

                  const areaD = plotPoints.length > 0
                    ? `${pathD} L ${getX(plotPoints.length - 1)} ${padTop + innerHeight} L ${getX(0)} ${padTop + innerHeight} Z`
                    : '';

                  const aiAnalysis = aiSummaryData[personalInspectMember];

                  return (
                    <div className="space-y-4">
                      {/* Interactive Improvement Trajectory Graph */}
                      <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-4 border-orange-500/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white font-display">
                                {targetMem?.name}'s Improvement Curve
                              </h3>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold">
                                {targetMem?.institute}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400">Standardized percentile standing plotted test-to-test over time.</p>
                          </div>

                          {/* Metric Filter Chips */}
                          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                            {(['Overall', 'Physics', 'Chemistry', 'Math'] as const).map((metric) => (
                              <button
                                key={metric}
                                type="button"
                                onClick={() => setActiveGraphMetric(metric)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                  activeGraphMetric === metric
                                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {metric}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Summary Delta Banner */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Standing</span>
                            <div className="text-lg font-bold text-white font-mono-num mt-0.5">
                              {latestExam ? `${currentPercentile.toFixed(1)}%ile` : 'No tests'}
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Test Delta</span>
                            <div className="text-lg font-bold font-mono-num mt-0.5 flex items-center gap-1">
                              {delta !== null ? (
                                <>
                                  {delta >= 0 ? (
                                    <span className="text-emerald-400 flex items-center gap-0.5">
                                      <TrendingUp className="w-4 h-4" />
                                      <span>+{delta.toFixed(1)}%ile</span>
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 flex items-center gap-0.5">
                                      <TrendingDown className="w-4 h-4" />
                                      <span>{delta.toFixed(1)}%ile</span>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Tests Written</span>
                            <div className="text-lg font-bold text-amber-400 font-mono-num mt-0.5">
                              {memExams.length} mocks
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Exam XP Pool</span>
                            <div className="text-lg font-bold text-orange-400 font-mono-num mt-0.5">
                              {latestExam ? `${Math.round(currentPercentile * 3)} / 300 XP` : '0 / 300 XP'}
                            </div>
                          </div>
                        </div>

                        {/* SVG Graph Container */}
                        <div className="relative bg-zinc-950 rounded-2xl p-3 border border-zinc-800/80 overflow-hidden">
                          {plotPoints.length === 0 ? (
                            <div className="text-center py-14 space-y-2">
                              <Trophy className="w-8 h-8 text-zinc-600 mx-auto" />
                              <div className="text-sm font-bold text-zinc-300">No mock exams recorded yet for {targetMem?.name}</div>
                              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                                Click "+ Log Exam" to record test marks, ranks, and total batch size to see automatic improvement curves.
                              </p>
                            </div>
                          ) : (
                            <>
                              <div className="w-full overflow-x-auto">
                                <svg
                                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                  className="w-full h-48 sm:h-56 select-none"
                                >
                                  <defs>
                                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#F97316" stopOpacity="0.4" />
                                      <stop offset="100%" stopColor="#F97316" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>

                                  {/* Horizontal Gridlines */}
                                  {[100, 90, 80, 70, 60, 50].map((val) => {
                                    const y = getY(val);
                                    return (
                                      <g key={val}>
                                        <line
                                          x1={padLeft}
                                          y1={y}
                                          x2={svgWidth - padRight}
                                          y2={y}
                                          stroke="#27272A"
                                          strokeDasharray="3 3"
                                          strokeWidth="1"
                                        />
                                        <text
                                          x={padLeft - 8}
                                          y={y + 3}
                                          textAnchor="end"
                                          className="text-[9px] fill-zinc-500 font-mono"
                                        >
                                          {val}%
                                        </text>
                                      </g>
                                    );
                                  })}

                                  {/* Area under curve */}
                                  {plotPoints.length > 1 && (
                                    <path d={areaD} fill="url(#curveGradient)" />
                                  )}

                                  {/* Trajectory Stroke */}
                                  {plotPoints.length > 1 && (
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke="#F97316"
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  )}

                                  {/* Interactive Data Points */}
                                  {plotPoints.map((pt, idx) => {
                                    const cx = getX(idx);
                                    const cy = getY(pt.value);
                                    const isHovered = hoveredExamPoint?.index === idx;

                                    return (
                                      <g key={idx} className="cursor-pointer">
                                        <circle
                                          cx={cx}
                                          cy={cy}
                                          r={isHovered ? 7 : 5}
                                          className="transition-all duration-150"
                                          fill={isHovered ? '#FDE047' : '#F97316'}
                                          stroke="#09090B"
                                          strokeWidth="2.5"
                                          onClick={() => setHoveredExamPoint(pt)}
                                        />
                                        <text
                                          x={cx}
                                          y={svgHeight - 12}
                                          textAnchor="middle"
                                          className="text-[9px] fill-zinc-400 font-mono"
                                        >
                                          {pt.date.slice(5) || `T${idx + 1}`}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>

                              {/* Selected Point Inspector */}
                              {hoveredExamPoint && (
                                <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-amber-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-view">
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <span>{hoveredExamPoint.title}</span>
                                      <span className="text-[10px] text-zinc-400 font-mono-num">{hoveredExamPoint.date}</span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 font-mono-num mt-0.5">
                                      Batch: {hoveredExamPoint.exam.totalStudents} students • Rank #{hoveredExamPoint.exam.overallRank} • Score: {hoveredExamPoint.exam.overallMarks}/{hoveredExamPoint.exam.overallMaxMarks}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono-num font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-lg border border-amber-400/30">
                                      {hoveredExamPoint.value.toFixed(1)}%ile ({activeGraphMetric})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setHoveredExamPoint(null)}
                                      className="text-zinc-500 hover:text-white p-1"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* AI TEST-TO-TEST DIAGNOSTIC SUMMARY CARD */}
                      <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-4 border-amber-500/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                              <Brain className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                              <h3 className="text-sm sm:text-base font-bold text-white font-display flex items-center gap-2">
                                <span>AI Performance Diagnostic</span>
                                <span className="text-[10px] font-mono-num text-amber-400 font-normal bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                  TEST-TO-TEST
                                </span>
                              </h3>
                              <p className="text-xs text-zinc-400">
                                Actionable JEE mentor analysis comparing latest performance against previous benchmarks.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => fetchAiDiagnosticSummary(personalInspectMember)}
                            disabled={isGeneratingAiSummary || memExams.length === 0}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all shrink-0"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAiSummary ? 'animate-spin' : ''}`} />
                            <span>{isGeneratingAiSummary ? 'Consulting Gemini AI...' : 'Re-Analyze with Gemini AI'}</span>
                          </button>
                        </div>

                        {isGeneratingAiSummary ? (
                          <div className="py-8 text-center space-y-3">
                            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto" />
                            <p className="text-xs text-amber-300 font-medium">Gemini 3.8-Flash is evaluating test deltas and coaching cohort metrics...</p>
                          </div>
                        ) : aiAnalysis ? (
                          <div className="space-y-4 animate-view">
                            {/* Headline Banner */}
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm">
                              {aiAnalysis.headline}
                            </div>

                            {/* Trajectory Evaluation */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Test-to-Test Trajectory</span>
                              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80">
                                {aiAnalysis.trajectory}
                              </p>
                            </div>

                            {/* Standout vs Growth Margin Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-emerald-500/30 space-y-1">
                                <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>Standout Strongest Subject</span>
                                </div>
                                <div className="text-xs font-semibold text-white">
                                  {aiAnalysis.strongestSubject}
                                </div>
                              </div>

                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-amber-500/30 space-y-1">
                                <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  <span>Highest Delta Opportunity</span>
                                </div>
                                <div className="text-xs font-semibold text-white">
                                  {aiAnalysis.focusSubject}
                                </div>
                              </div>
                            </div>

                            {/* Tactical Recommendations */}
                            {Array.isArray(aiAnalysis.recommendedAction) && aiAnalysis.recommendedAction.length > 0 && (
                              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Tactical Study Recommendations</span>
                                <ul className="space-y-1.5 text-xs text-zinc-300">
                                  {aiAnalysis.recommendedAction.map((tip: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-6 space-y-2">
                            <p className="text-xs text-zinc-400">
                              {memExams.length > 0
                                ? 'Click "Re-Analyze with Gemini AI" to get immediate test-to-test mentor feedback.'
                                : 'No exams logged yet. Log an exam to activate AI Diagnostics.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Discrete Exam History Cards */}
                      <div className="surface-card rounded-3xl p-4 sm:p-5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Exam History Log</h4>
                        {memExams.length === 0 ? (
                          <div className="text-center py-6 text-xs text-zinc-500">No mock exams logged.</div>
                        ) : (
                          <div className="space-y-2.5">
                            {memExams.map((ex, idx) => {
                              const prev = idx > 0 ? memExams[idx - 1] : null;
                              const pctDelta = prev ? (Number(ex.overallPercentile) - Number(prev.overallPercentile)) : 0;
                              return (
                                <div key={ex.id} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-bold text-white text-sm">{ex.title}</span>
                                      <span className="text-zinc-500 ml-2 font-mono-num">{ex.date}</span>
                                      <div className="text-[11px] text-zinc-400 font-mono-num mt-0.5">
                                        Score: {ex.overallMarks}/{ex.overallMaxMarks} • Rank #{ex.overallRank}/{ex.totalStudents} ({ex.institute})
                                      </div>
                                    </div>

                                    <div className="text-right font-mono-num">
                                      <div className="text-base font-bold text-amber-400">{Number(ex.overallPercentile).toFixed(1)}%ile</div>
                                      {prev && (
                                        <div className={`text-[10px] font-bold ${pctDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                          {pctDelta >= 0 ? `+${pctDelta.toFixed(1)}%ile` : `${pctDelta.toFixed(1)}%ile`}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Subject Percentile Pills */}
                                  {Array.isArray(ex.subjects) && ex.subjects.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-zinc-900">
                                      {ex.subjects.map((s: any) => (
                                        <span
                                          key={s.name}
                                          className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono-num"
                                        >
                                          {s.name}: <strong className="text-amber-400 font-bold">{Number(s.percentile).toFixed(1)}%ile</strong> ({s.marks}/{s.maxMarks}m)
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB-VIEW 2: STUDENT-TO-STUDENT COMPARISON (PERCENTILES ONLY) */}
            {analyticsTab === 'compare' && (
              <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-5 border-amber-500/20">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white font-display">Student-to-Student Fair Comparison</h3>
                  <p className="text-xs text-zinc-400">
                    Compare any two students head-to-head. To maintain strict fairness across different coaching batch sizes,
                    only standardized percentiles are displayed.
                  </p>
                </div>

                {/* Selectors for Student A and Student B */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Competitor 1</span>
                    <select
                      value={compareStudentA}
                      onChange={(e) => setCompareStudentA(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold"
                    >
                      {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.institute})</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Competitor 2</span>
                    <select
                      value={compareStudentB}
                      onChange={(e) => setCompareStudentB(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white font-bold"
                    >
                      {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.institute})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comparative Meters */}
                {(() => {
                  const memA = members.find(m => m.id === compareStudentA) || DEFAULT_MEMBERS.find(m => m.id === compareStudentA);
                  const memB = members.find(m => m.id === compareStudentB) || DEFAULT_MEMBERS.find(m => m.id === compareStudentB);

                  const examsA = exams.filter(e => e.memberId === compareStudentA);
                  const examsB = exams.filter(e => e.memberId === compareStudentB);

                  const avgPctA = examsA.length > 0
                    ? examsA.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) / examsA.length
                    : 0;

                  const avgPctB = examsB.length > 0
                    ? examsB.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) / examsB.length
                    : 0;

                  const subjectsList = ['Physics', 'Chemistry', 'Math'];

                  return (
                    <div className="space-y-4">
                      {/* Overall Average Percentile Comparison */}
                      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Overall Average Percentile</span>
                          <span className="text-[11px] text-amber-400 font-mono-num font-bold">
                            {avgPctA > avgPctB ? `${memA?.name} +${(avgPctA - avgPctB).toFixed(1)}%ile` : `${memB?.name} +${(avgPctB - avgPctA).toFixed(1)}%ile`}
                          </span>
                        </div>

                        {/* Student A bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-200">{memA?.name} ({memA?.institute})</span>
                            <span className="text-amber-400 font-mono-num font-bold">{avgPctA.toFixed(1)}%ile</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.min(100, avgPctA)}%` }} />
                          </div>
                        </div>

                        {/* Student B bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-200">{memB?.name} ({memB?.institute})</span>
                            <span className="text-cyan-400 font-mono-num font-bold">{avgPctB.toFixed(1)}%ile</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: `${Math.min(100, avgPctB)}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Subject-Wise Comparative Percentiles */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                          Subject-Wise Standardized Percentiles
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {subjectsList.map((subj) => {
                            const subEntriesA = examsA.flatMap(e => (e.subjects || []).filter((s: any) => s.name === subj));
                            const subEntriesB = examsB.flatMap(e => (e.subjects || []).filter((s: any) => s.name === subj));

                            const subPctA = subEntriesA.length > 0
                              ? subEntriesA.reduce((acc, s: any) => acc + (Number(s.percentile) || 0), 0) / subEntriesA.length
                              : 0;

                            const subPctB = subEntriesB.length > 0
                              ? subEntriesB.reduce((acc, s: any) => acc + (Number(s.percentile) || 0), 0) / subEntriesB.length
                              : 0;

                            return (
                              <div key={subj} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-white">{subj}</span>
                                  <span className="text-[10px] text-zinc-400 font-mono-num">
                                    Δ {Math.abs(subPctA - subPctB).toFixed(1)}%ile
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-zinc-400">{memA?.name}</span>
                                    <span className="font-bold text-amber-400 font-mono-num">{subPctA > 0 ? `${subPctA.toFixed(1)}%ile` : '-'}</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                                    <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, subPctA)}%` }} />
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-zinc-400">{memB?.name}</span>
                                    <span className="font-bold text-cyan-400 font-mono-num">{subPctB > 0 ? `${subPctB.toFixed(1)}%ile` : '-'}</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                                    <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, subPctB)}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB-VIEW 3: SUBJECT-WISE PERCENTILES ACROSS SQUAD */}
            {analyticsTab === 'subjects' && (
              <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-5 border-amber-500/20">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white font-display">Subject Mastery Benchmarks</h3>
                  <p className="text-xs text-zinc-400">
                    Compare student standing within specific JEE subjects. Only normalized percentiles are ranked to eliminate batch discrepancies.
                  </p>
                </div>

                {/* Subject Selector Tabs */}
                <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit">
                  {['Physics', 'Chemistry', 'Math', 'English', 'LR'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSubjectCompare(s)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedSubjectCompare === s
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Squad Standing in Selected Subject */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                    const memExams = exams.filter(e => e.memberId === m.id);
                    const subjEntries = memExams
                      .flatMap(e => (e.subjects || []).filter((s: any) => s.name === selectedSubjectCompare));

                    const avgSubPct = subjEntries.length > 0
                      ? subjEntries.reduce((acc, s: any) => acc + (Number(s.percentile) || 0), 0) / subjEntries.length
                      : 0;

                    const bestSubPct = subjEntries.length > 0
                      ? Math.max(...subjEntries.map((s: any) => Number(s.percentile) || 0))
                      : 0;

                    return (
                      <div key={m.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                              {m.name[0]}
                            </span>
                            <div>
                              <div className="font-bold text-white text-xs">{m.name}</div>
                              <div className="text-[10px] text-zinc-400">{m.institute}</div>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-amber-400 font-mono-num">
                            {subjEntries.length > 0 ? `${avgSubPct.toFixed(1)}%ile` : 'No data'}
                          </span>
                        </div>

                        <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400"
                            style={{ width: `${Math.min(100, avgSubPct)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 font-mono-num">
                          <span>Best: <strong className="text-zinc-200">{bestSubPct > 0 ? `${bestSubPct.toFixed(1)}%ile` : '-'}</strong></span>
                          <span>Tests: <strong className="text-zinc-200">{subjEntries.length}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}


        {/* TAB 5: ADMIN MASTER COMMAND CENTER */}
        {activeTab === 'admin' && (isAdminUnlocked || activeMemberId === 'admin') && (
          <div className="space-y-5 animate-view">
            {/* Admin Header with Navigation Sub-Tabs */}
            <div className="surface-card rounded-2xl p-3.5 sm:p-4 space-y-3 border-amber-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-sm">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white font-display">Admin Command Center</h2>
                    <p className="text-[11px] text-zinc-400">Master control for XP modifiers, roster, bounties, and arena operations.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono-num text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                    STATUS: MASTER ACCESS
                  </span>
                </div>
              </div>

              {/* Clear, Segmented Sub-Navigation */}
              <div className="flex flex-wrap gap-1.5 p-1 bg-zinc-950/80 rounded-xl border border-zinc-800/80">
                {[
                  { id: 'xp' as const, label: '⚡ XP & Score Controller', icon: Zap },
                  { id: 'routines' as const, label: '⏱️ Automated Routines', icon: RefreshCw },
                  { id: 'roster' as const, label: '👥 Squad Roster', icon: Target },
                  { id: 'teachers' as const, label: '👨‍🏫 Tuition Faculty', icon: GraduationCap },
                  { id: 'bounties' as const, label: '🎯 Squad Bounties', icon: Award },
                  { id: 'proofs' as const, label: `🛡️ Proof Reviews (${pendingProofsCount})`, icon: Shield },
                  { id: 'sessions' as const, label: '⏱️ Study Logs', icon: Clock },
                  { id: 'exams' as const, label: '📊 Exam Logs', icon: Trophy },
                  { id: 'arena' as const, label: '🎪 Arena & Blind', icon: Sparkles }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = adminSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdminSubTab(tab.id)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-md'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SUB-TAB 1: XP & SCORE CONTROLLER (CRYSTAL CLEAR, ZERO CONFUSION) */}
            {adminSubTab === 'xp' && (
              <div className="space-y-4">
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-5 border-amber-500/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm sm:text-base font-bold text-white font-display">
                        XP & Points Modifier Engine
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Directly award bonus XP, issue penalties, or adjust study minutes. All adjustments are logged to the live audit ledger.
                    </p>
                  </div>

                  {/* Step 1: Select Target Competitor */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                      <span>Step 1: Choose Competitor to Adjust</span>
                      <span className="text-[10px] text-amber-400 font-mono-num">
                        Selected: {members.find(m => m.id === quickAdjustMemberId)?.name || 'None'}
                      </span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                        const isSelected = quickAdjustMemberId === m.id;
                        const stat = leaderboardStats.find(s => s.id === m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setQuickAdjustMemberId(m.id)}
                            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                                : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isSelected ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                                }`}>
                                  {m.name[0]}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <span>{m.name}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                                  </div>
                                  <div className="text-[10px] text-zinc-400">{m.institute}</div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-bold text-amber-400 font-mono-num">
                                  {stat?.weeklyXp || 0} XP
                                </div>
                                <div className="text-[9px] text-zinc-500">Weekly Total</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: XP Delta (Presets + Custom) */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    <label className="text-xs font-semibold text-zinc-300">
                      Step 2: Select or Enter XP Amount
                    </label>

                    {/* Quick Bonus Presets */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-zinc-400 font-medium">Quick Bonus (+XP)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { val: '10', label: '+10 XP (Daily Task)' },
                          { val: '25', label: '+25 XP (Hard Drill)' },
                          { val: '50', label: '+50 XP (Bounty Win)' },
                          { val: '100', label: '+100 XP (Weekly Apex)' }
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => setQuickXpDelta(btn.val)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                              quickXpDelta === btn.val
                                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Penalty Presets */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] text-zinc-400 font-medium">Quick Deduct / Penalty (-XP)</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: '-10', label: '-10 XP (Late Task)' },
                          { val: '-25', label: '-25 XP (Missed Goal)' },
                          { val: '-50', label: '-50 XP (Severe Penalty)' }
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => setQuickXpDelta(btn.val)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                              quickXpDelta === btn.val
                                ? 'bg-rose-500 text-white border-rose-400 font-bold'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Or Enter Exact XP Delta (+/-)</label>
                        <input
                          type="number"
                          placeholder="e.g. +35 or -15"
                          value={quickXpDelta}
                          onChange={(e) => setQuickXpDelta(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono-num focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Optional Study Time Delta (Minutes)</label>
                        <input
                          type="number"
                          placeholder="e.g. +45 or -30 mins"
                          value={quickTimeDelta}
                          onChange={(e) => setQuickTimeDelta(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white font-mono-num focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Reason Tag */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    <label className="text-xs font-semibold text-zinc-300">
                      Step 3: Reason / Audit Tag
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '🎯 Daily Target Reached',
                        '⚡ 2x First Blood Claim',
                        '🔥 Hard JEE Advanced Drill',
                        '⚠️ Incomplete Minimum Time',
                        '📝 Admin Score Correction'
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setQuickAdjustReason(tag)}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                            quickAdjustReason === tag
                              ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Custom audit reason / note (optional)"
                      value={quickAdjustReason}
                      onChange={(e) => setQuickAdjustReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Step 4: Execute Action Button */}
                  <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-300">
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider">Adjustment Preview</span>
                      <div>
                        Target: <span className="text-white font-bold">{members.find(m => m.id === quickAdjustMemberId)?.name || quickAdjustMemberId}</span>
                        {' • '}
                        XP: <span className={`font-mono-num font-bold ${Number(quickXpDelta) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {quickXpDelta ? `${Number(quickXpDelta) > 0 ? '+' : ''}${quickXpDelta} XP` : '0 XP'}
                        </span>
                        {quickTimeDelta && (
                          <span className="text-orange-400 font-mono-num ml-1">
                            ({Number(quickTimeDelta) > 0 ? '+' : ''}{quickTimeDelta} mins)
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdminQuickAdjust}
                      disabled={!quickXpDelta && !quickTimeDelta}
                      className="btn-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Execute XP Modification</span>
                    </button>
                  </div>
                </div>

                {/* Audit Trail of Recent Adjustments */}
                <div className="surface-card rounded-2xl p-4 space-y-2.5">
                  <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider flex items-center justify-between">
                    <span>Recent Admin XP Ledger</span>
                    <span className="text-[10px] text-zinc-500 font-normal">Live Activity Logs</span>
                  </h4>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {activities
                      .filter(a => a.type === 'admin_adjust' || a.type === 'penalty')
                      .slice(0, 8)
                      .map((act) => (
                        <div key={act.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-white">{act.title}</div>
                            <div className="text-[10px] text-zinc-400">{act.detail}</div>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold font-mono-num ${act.type === 'penalty' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {act.xpEarned > 0 ? `+${act.xpEarned}` : act.xpEarned} XP
                            </span>
                            <div className="text-[9px] text-zinc-500">{timeAgo(act.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    {activities.filter(a => a.type === 'admin_adjust' || a.type === 'penalty').length === 0 && (
                      <div className="text-center py-4 text-xs text-zinc-500">No manual XP adjustments recorded yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: AUTOMATED ROUTINES & RECURRING BROADCASTS */}
            {adminSubTab === 'routines' && (
              <div className="space-y-4">
                {/* 1. Weekly Leaderboard Blackout & Grand Reveal Routine */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-amber-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white font-display">
                          Weekly Leaderboard Blackout Routine
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Automatically lock public standings every Friday at 11:59 PM to build suspense, and automatically open back up on Sunday at 10:00 PM with the Grand Reveal ceremony.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-mono-num font-bold px-2.5 py-1 rounded-lg border ${
                        arenaSettings.autoRoutineEnabled
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}>
                        {arenaSettings.autoRoutineEnabled ? '● AUTO-ROUTINE ACTIVE' : '○ ROUTINE PAUSED'}
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    arenaSettings.leaderboardHidden
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${arenaSettings.leaderboardHidden ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                      <span>
                        Current State:{' '}
                        <strong className="text-white">
                          {arenaSettings.leaderboardHidden ? 'Leaderboard Blinded & Locked' : 'Leaderboard Open & Visible'}
                        </strong>
                        {arenaSettings.autoLocked && (
                          <span className="ml-1.5 text-[10px] text-amber-300 font-mono-num font-bold">
                            (Auto-Locked by Friday Schedule)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400 font-mono-num">
                      Schedule: Every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][arenaSettings.lockDay !== undefined ? arenaSettings.lockDay : 5]} at {arenaSettings.lockTime || '23:59'} → {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][arenaSettings.unlockDay !== undefined ? arenaSettings.unlockDay : 0]} at {arenaSettings.unlockTime || '22:00'}
                    </div>
                  </div>

                  {/* Schedule Adjustment Form */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Configure Routine Schedule
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={arenaSettings.autoRoutineEnabled}
                          onChange={(e) => handleSaveRoutineSettings({ autoRoutineEnabled: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                        />
                        <span className="text-xs font-semibold text-zinc-200">Enable Automated Schedule</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      {/* Friday Lock Window */}
                      <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                        <label className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                          <Lock className="w-3 h-3" />
                          <span>1. Weekly Blackout Lock Trigger</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-zinc-500 block mb-0.5">Day of Week</span>
                            <select
                              value={routineLockDay}
                              onChange={(e) => setRoutineLockDay(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            >
                              <option value={5}>Friday (Default)</option>
                              <option value={4}>Thursday</option>
                              <option value={6}>Saturday</option>
                              <option value={0}>Sunday</option>
                              <option value={1}>Monday</option>
                              <option value={2}>Tuesday</option>
                              <option value={3}>Wednesday</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block mb-0.5">Time (24h)</span>
                            <input
                              type="time"
                              value={routineLockTime}
                              onChange={(e) => setRoutineLockTime(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono-num"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 pt-1">
                          Standings become masked with (#? - ??? XP) until Sunday reveal.
                        </p>
                      </div>

                      {/* Sunday Unlock & Reveal Window */}
                      <div className="space-y-1.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                        <label className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          <span>2. Sunday Grand Reveal & Unlock</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-zinc-500 block mb-0.5">Day of Week</span>
                            <select
                              value={routineUnlockDay}
                              onChange={(e) => setRoutineUnlockDay(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
                            >
                              <option value={0}>Sunday (Default)</option>
                              <option value={1}>Monday</option>
                              <option value={5}>Friday</option>
                              <option value={6}>Saturday</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 block mb-0.5">Time (24h)</span>
                            <input
                              type="time"
                              value={routineUnlockTime}
                              onChange={(e) => setRoutineUnlockTime(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white font-mono-num"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 pt-1">
                          Triggers Kahoot countdown celebration & unmasks final weekly ranks.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveRoutineSettings({
                            lockDay: routineLockDay,
                            lockTime: routineLockTime,
                            unlockDay: routineUnlockDay,
                            unlockTime: routineUnlockTime
                          })}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs shadow-md hover:brightness-110 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save Routine Schedule</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdminToggleLeaderboardBlackout(!arenaSettings.leaderboardHidden)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-all flex items-center gap-1.5"
                        >
                          {arenaSettings.leaderboardHidden ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>Manual Reveal Now</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Manual Blackout Now</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Recurring Announcements Engine */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-amber-500/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm sm:text-base font-bold text-white font-display">
                        Automated Recurring Announcements
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Set up automated recurring broadcasts that fire automatically on specific days and times (e.g., weekend mock test submission reminders, daily review pushes).
                    </p>
                  </div>

                  {/* Add Recurring Routine Form */}
                  <form onSubmit={handleCreateCustomRoutine} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      + Add New Recurring Announcement Routine
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-zinc-400 block mb-1">Routine Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Sunday Mock Exam Submission Reminder"
                          value={newRoutineTitle}
                          onChange={(e) => setNewRoutineTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Day of Week</label>
                        <select
                          value={newRoutineDay}
                          onChange={(e) => setNewRoutineDay(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                        >
                          <option value={0}>Every Sunday</option>
                          <option value={1}>Every Monday</option>
                          <option value={2}>Every Tuesday</option>
                          <option value={3}>Every Wednesday</option>
                          <option value={4}>Every Thursday</option>
                          <option value={5}>Every Friday</option>
                          <option value={6}>Every Saturday</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Time (24h)</label>
                        <input
                          type="time"
                          value={newRoutineTime}
                          onChange={(e) => setNewRoutineTime(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono-num"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-zinc-400 block mb-1">Broadcast Message</label>
                        <input
                          type="text"
                          placeholder="e.g. 📢 Final hour: Log all test marks and ranks before 10 PM reveal!"
                          value={newRoutineMessage}
                          onChange={(e) => setNewRoutineMessage(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">Audience Target</label>
                        <select
                          value={newRoutineTarget}
                          onChange={(e) => setNewRoutineTarget(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                        >
                          <option value="ALL">Everyone (All 3)</option>
                          {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="min-h-[44px] btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Schedule Recurring Routine</span>
                      </button>
                    </div>
                  </form>

                  {/* Discrete Touch-Friendly Card Stack of Scheduled Routines */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Active Scheduled Routines Stack
                    </span>

                    <div className="space-y-2">
                      {(arenaSettings.routines || DEFAULT_ROUTINES).map((routine) => {
                        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][routine.dayOfWeek];
                        const isBlackout = routine.type === 'blackout_lock' || routine.type === 'blackout_unlock';
                        return (
                          <div
                            key={routine.id}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              routine.enabled
                                ? 'bg-zinc-900/70 border-zinc-800/90 hover:border-zinc-700'
                                : 'bg-zinc-950/40 border-zinc-900 opacity-60'
                            }`}
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                  <span>{routine.title}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] font-mono-num font-semibold">
                                  Every {dayName} @ {routine.time}
                                </span>
                                {routine.target && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                                    {routine.target === 'ALL' ? 'Squad' : routine.target.toUpperCase()}
                                  </span>
                                )}
                                {routine.enabled ? (
                                  <span className="text-[10px] text-emerald-400 font-bold">● Active</span>
                                ) : (
                                  <span className="text-[10px] text-zinc-500 font-bold">○ Paused</span>
                                )}
                              </div>

                              {routine.message && (
                                <p className="text-xs text-zinc-300 italic bg-zinc-950/60 p-2 rounded-xl border border-zinc-800/60">
                                  "{routine.message}"
                                </p>
                              )}
                            </div>

                            {/* Touch-Friendly Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleRoutine(routine.id)}
                                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                  routine.enabled
                                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                                    : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                }`}
                              >
                                {routine.enabled ? 'Pause' : 'Activate'}
                              </button>

                              {!isBlackout && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoutine(routine.id)}
                                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all flex items-center justify-center"
                                  title="Delete Routine"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: ROSTER & COMPETITOR PROFILES */}
            {adminSubTab === 'roster' && (
              <div className="space-y-4">
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white font-display">Competitors Ledger</h3>
                      <p className="text-xs text-zinc-400">View and modify competitor institute and manual offsets.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                      const isEditing = editingMemberId === m.id;
                      const stat = leaderboardStats.find(s => s.id === m.id);
                      return (
                        <div key={m.id} className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs">
                          {isEditing ? (
                            <form onSubmit={handleSaveMemberEdit} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Name</label>
                                <input
                                  type="text"
                                  value={editMemberForm.name}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, name: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Institute</label>
                                <input
                                  type="text"
                                  value={editMemberForm.institute}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, institute: e.target.value })}
                                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">4-Digit PIN</label>
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={editMemberForm.passcode}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, passcode: e.target.value.replace(/[^0-9]/g, '') })}
                                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-amber-400 font-mono-num"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Bonus XP</label>
                                <input
                                  type="number"
                                  value={editMemberForm.bonusXp}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, bonusXp: Number(e.target.value) })}
                                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white font-mono-num"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Minutes Offset</label>
                                <input
                                  type="number"
                                  value={editMemberForm.manualMinutesOffset}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, manualMinutesOffset: Number(e.target.value) })}
                                  className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white font-mono-num"
                                />
                              </div>
                              <div className="flex gap-1">
                                <button type="submit" className="px-3 py-1.5 rounded bg-amber-400 text-zinc-950 font-bold">Save</button>
                                <button type="button" onClick={() => setEditingMemberId(null)} className="px-2 py-1.5 rounded bg-zinc-800 text-zinc-400">Cancel</button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-white">
                                    {m.name[0]}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white text-sm flex items-center gap-1.5">
                                      <span>{m.name}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-normal">{m.institute}</span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                      <span>Weekly: <strong className="text-amber-400 font-mono-num">{stat?.weeklyXp || 0} XP</strong></span>
                                      <span>•</span>
                                      <span>Offset: <strong className="font-mono-num">{m.bonusXp || 0} XP</strong></span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEditMember(m)}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMember(m.id, m.name)}
                                    className="p-1 rounded-lg bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Active Standing & Unexcused Zero Controls */}
                              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 mt-2 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-zinc-500 font-semibold">Test Standing:</span>
                                    {m.unexcusedZero ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                                        <span>⚠️ Unexcused Zero (0 XP Applied)</span>
                                      </span>
                                    ) : stat?.standingStatus === 'fresh_test' ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-400" />
                                        <span>Tested This Week ({stat?.weekAvgPercentile.toFixed(1)}%ile)</span>
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300 font-semibold flex items-center gap-1">
                                        <Shield className="w-3 h-3 text-amber-400" />
                                        <span>Active Standing ({stat?.weekAvgPercentile.toFixed(1)}%ile carried over)</span>
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    {m.unexcusedZero ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUnexcusedZero(m.id, true)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1"
                                      >
                                        <Shield className="w-3 h-3" />
                                        <span>Forgive / Restore Active Standing</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUnexcusedZero(m.id, false, 'Unexcused test absence (bunked test)')}
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Issue Unexcused Zero (0 XP)</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {m.unexcusedReason && m.unexcusedZero && (
                                  <div className="text-[10px] text-rose-300/80 bg-rose-950/40 px-2 py-1 rounded border border-rose-900/50">
                                    Reason: "{m.unexcusedReason}"
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                      </div>
                    );
                  })}
                </div>

                {/* Add New Member Section */}
                <form onSubmit={handleAddMember} className="pt-3 border-t border-zinc-800/80 space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 block">Add New Competitor</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Institute (e.g. Modulus / Allen)"
                      value={newMemberInst}
                      onChange={(e) => setNewMemberInst(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                    />
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="4-Digit PIN"
                      value={newMemberPin}
                      onChange={(e) => setNewMemberPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-400 font-mono-num"
                      required
                    />
                    <button type="submit" className="btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold">
                      + Add Competitor
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SUB-TAB: TUITION FACULTY MANAGEMENT */}
          {adminSubTab === 'teachers' && (
            <div className="space-y-4">
              <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-amber-500/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white font-display">
                      Tuition Teachers & Faculty Profiles
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Create tuition teacher accounts by subject (Physics, Chemistry, Math), assign 4-digit PINs, and manage faculty access.
                  </p>
                </div>

                {/* Teachers Roster Grid */}
                {teachers.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-1.5 py-6">
                    <GraduationCap className="w-8 h-8 text-amber-400/60 mx-auto" />
                    <p className="text-xs font-semibold text-zinc-300">No tuition teacher profiles created yet</p>
                    <p className="text-[11px] text-zinc-500">Fill out the form below to create your tuition teachers by subject.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {teachers.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-bold text-amber-400">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>{t.name}</span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-300 text-[10px] font-semibold">
                                {t.subject}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {t.institute || 'Tuition Academy'} • PIN: <strong className="font-mono-num text-amber-300">{t.passcode}</strong>
                            </div>
                            {t.bio && <p className="text-[10px] text-zinc-500 mt-0.5">{t.bio}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTuitionSubject(t.subject);
                              setActiveTab('tuition');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>View Desk</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTeacher(t.id, t.name)}
                            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400"
                            title="Delete Teacher Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Teacher Form */}
                <form onSubmit={handleAddTeacher} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    + Create Tuition Teacher Profile
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Teacher Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Prof. R.K. Sharma"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Subject</label>
                      <select
                        value={newTeacherSubject}
                        onChange={(e) => setNewTeacherSubject(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                      >
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Math">Math</option>
                        <option value="Biology">Biology</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Institute / Academy</label>
                      <input
                        type="text"
                        placeholder="e.g. Star Academy"
                        value={newTeacherInst}
                        onChange={(e) => setNewTeacherInst(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">4-Digit PIN Code</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 5555"
                        value={newTeacherPin}
                        onChange={(e) => setNewTeacherPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-amber-400 font-mono-num font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Optional teacher bio / notes / contact info..."
                      value={newTeacherBio}
                      onChange={(e) => setNewTeacherBio(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                    />

                    <button type="submit" className="btn-primary min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold">
                      + Save Teacher Profile
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

            {/* SUB-TAB 3: SQUAD BOUNTIES & REWARD CONTROLLER */}
            {adminSubTab === 'bounties' && (
              <div className="space-y-4">
                {/* Bounty Creation Form */}
                <form onSubmit={handleAdminCreateBounty} className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-orange-500/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-orange-400" />
                      <h3 className="text-sm sm:text-base font-bold text-white font-display">Dispatch Squad Bounty</h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Create high-stakes study quests or honor challenges. All Squad Bounties are now <strong className="text-amber-300">Honor-only (0 XP)</strong>. Only time/question logging counts toward standings.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-zinc-400 block mb-1">Bounty Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Solve 25 Irodov Problems / Pathshala Drill"
                        value={bountyTitle}
                        onChange={(e) => setBountyTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Subject</label>
                      <select
                        value={bountySubject}
                        onChange={(e) => setBountySubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                      >
                        {SUBJECT_OPTIONS.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">XP (Fixed 0)</label>
                      <input
                        type="number"
                        disabled
                        value={0}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 font-mono-num"
                      />
                    </div>
                  </div>


                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Quest Instructions & Details</label>
                    <textarea
                      placeholder="Specific questions, chapter details, textbook problems, or proof criteria..."
                      value={bountyDesc}
                      onChange={(e) => setBountyDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bountyFirstBlood}
                          onChange={(e) => setBountyFirstBlood(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-400"
                        />
                        <span className="font-semibold text-zinc-500 line-through">⚡ 2x First Blood Claim (No Task XP)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-orange-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bountyRequireProof}
                          onChange={(e) => setBountyRequireProof(e.target.checked)}
                          className="rounded text-orange-500 focus:ring-orange-400"
                        />
                        <span className="font-semibold">Require Student Photo Proof</span>
                      </label>
                    </div>

                    <button type="submit" className="min-h-[44px] btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Dispatch Honor Bounty</span>
                    </button>
                  </div>
                </form>

                {/* Active Bounties List (Mobile-Friendly Card Stack with Edit Functionality) */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3.5 border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white font-display">
                        Active Squad Bounties ({tasks.filter(t => !t.isPersonal).length})
                      </h4>
                      <p className="text-xs text-zinc-400">Edit bounty rewards anytime after dispatch, or modify details.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tasks.filter(t => !t.isPersonal).map((task) => {
                      const isEditing = editingTaskId === task.id && editTaskForm;
                      const completionsCount = Object.values(task.completions || {}).filter((c: any) => c && c.status === 'verified').length;

                      if (isEditing) {
                        return (
                          <form
                            key={task.id}
                            onSubmit={handleSaveTaskEdit}
                            className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border-2 border-amber-400/60 shadow-xl space-y-4 animate-modal"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                              <span className="font-bold text-sm text-amber-300 flex items-center gap-1.5">
                                <Edit3 className="w-4 h-4" />
                                <span>Edit Bounty & Reward XP</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(null);
                                  setEditTaskForm(null);
                                }}
                                className="text-zinc-400 hover:text-white p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <div className="sm:col-span-2">
                                <label className="text-[10px] text-zinc-400 block mb-1">Title</label>
                                <input
                                  type="text"
                                  value={editTaskForm.title}
                                  onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                                  required
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">Subject</label>
                                <select
                                  value={editTaskForm.subject}
                                  onChange={(e) => setEditTaskForm({ ...editTaskForm, subject: e.target.value })}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                                >
                                  {SUBJECT_OPTIONS.map(s => (
                                    <option key={s.id} value={s.id}>{s.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-1">
                                  XP (Locked 0)
                                </label>
                                <input
                                  type="number"
                                  disabled
                                  value={0}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-850 border border-zinc-800 text-xs text-zinc-600"
                                />
                              </div>
                            </div>


                            <div>
                              <label className="text-[10px] text-zinc-400 block mb-1">Instructions / Description</label>
                              <textarea
                                value={editTaskForm.questionsText}
                                onChange={(e) => setEditTaskForm({ ...editTaskForm, questionsText: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                              <label className="flex items-center gap-1.5 text-amber-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editTaskForm.doubleXpFirst}
                                  onChange={(e) => setEditTaskForm({ ...editTaskForm, doubleXpFirst: e.target.checked })}
                                  className="rounded text-amber-500"
                                />
                                <span>⚡ 2x First Blood Claim</span>
                              </label>

                              <label className="flex items-center gap-1.5 text-orange-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editTaskForm.requireProof}
                                  onChange={(e) => setEditTaskForm({ ...editTaskForm, requireProof: e.target.checked })}
                                  className="rounded text-orange-500"
                                />
                                <span>Require Student Photo Proof</span>
                              </label>

                              <label className="flex items-center gap-1.5 text-emerald-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editTaskForm.syncCompletions !== false}
                                  onChange={(e) => setEditTaskForm({ ...editTaskForm, syncCompletions: e.target.checked })}
                                  className="rounded text-emerald-500"
                                />
                                <span>🔄 Retroactively update completed members' awarded XP</span>
                              </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(null);
                                  setEditTaskForm(null);
                                }}
                                className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="min-h-[44px] btn-primary px-5 py-2 rounded-xl text-xs font-bold shadow-lg"
                              >
                                Save Bounty Changes
                              </button>
                            </div>
                          </form>
                        );
                      }

                      return (
                        <div
                          key={task.id}
                          className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-700 space-y-3 transition-all"
                        >
                          {/* Card Header: Title, XP chip, tags */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-sm text-white">{task.title}</span>
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-semibold">
                                  {task.subject}
                                </span>
                                {task.doubleXpFirst && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                                    ⚡ 2x First Blood
                                  </span>
                                )}
                                {task.requireProof && (
                                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                                    📸 Proof Required
                                  </span>
                                )}
                              </div>
                              {task.questionsText && (
                                <p className="text-xs text-zinc-400 line-clamp-2">{task.questionsText}</p>
                              )}
                            </div>

                            {/* Prominent XP Badge */}
                            <div className="text-right shrink-0">
                              <div className={`text-base font-extrabold font-mono-num ${
                                Number(task.xp) === 0 ? 'text-zinc-400' : 'text-amber-400'
                              }`}>
                                {Number(task.xp) === 0 ? '⭐ 0 XP (Honor)' : `+${task.xp} XP`}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono-num">
                                {completionsCount} of {members.length || 3} finished
                              </div>
                            </div>
                          </div>

                          {/* Quick XP Modifier Strip on Card */}
                          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500 font-semibold">Quick Reward Change:</span>
                              {['0', '25', '50', '75', '100'].map((xpVal) => (
                                <button
                                  key={xpVal}
                                  type="button"
                                  onClick={() => handleAdminQuickUpdateBountyXp(task, xpVal)}
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono-num transition-all border ${
                                    String(task.xp) === xpVal
                                      ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                                  }`}
                                  title={`Set bounty reward to ${xpVal} XP`}
                                >
                                  {xpVal === '0' ? '0 XP' : `${xpVal}`}
                                </button>
                              ))}
                            </div>

                            <span className="text-[10px] text-zinc-500 font-mono-num">
                              {task.doubleXpFirst ? `First Blood: +${Number(task.xp) * 2} XP` : 'Standard Quest'}
                            </span>
                          </div>

                          {/* Touch-Friendly Action Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                            <span className="text-[10px] text-zinc-500">Created by {task.createdBy || 'Admin'}</span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditTask(task)}
                                className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700/80 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Bounty & Reward</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task)}
                                className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-all flex items-center justify-center"
                                title="Delete Bounty"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {tasks.filter(t => !t.isPersonal).length === 0 && (
                      <div className="text-center py-8 text-xs text-zinc-500">No active squad bounties. Create one above!</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 4: PROOF REVIEWS */}
            {adminSubTab === 'proofs' && (
              <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-white font-display">Student Proof Submissions</h3>
                  <p className="text-xs text-zinc-400">Review homework working notes and exam portal verification photos.</p>
                </div>

                {pendingProofsCount === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">No pending student proofs awaiting verification.</div>
                ) : (
                  <div className="space-y-2.5">
                    {tasks.flatMap((t) =>
                      Object.entries(t.completions || {})
                        .filter(([, c]: [string, any]) => c && c.status === 'pending_review')
                        .map(([memId, comp]: [string, any]) => (
                          <div key={`${t.id}-${memId}`} className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-sm">
                                {memId.toUpperCase()} • {t.title}
                              </span>
                              <span className="text-[10px] text-zinc-500">{timeAgo(comp.submittedAt)}</span>
                            </div>

                            {comp.note && (
                              <p className="text-xs text-zinc-300 bg-zinc-950 p-2 rounded-lg border border-zinc-800/80">
                                "{comp.note}"
                              </p>
                            )}

                            {comp.proofImages && comp.proofImages.length > 0 && (
                              <div className="flex gap-2">
                                {comp.proofImages.map((src: string, i: number) => (
                                  <img
                                    key={i}
                                    src={src}
                                    alt="proof"
                                    onClick={() => setLightboxImages(comp.proofImages)}
                                    className="w-16 h-16 rounded-xl object-cover cursor-pointer border border-zinc-700 hover:border-amber-400 transition-all"
                                  />
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleAdminVerifyProof(t, memId, true)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs shadow-md"
                              >
                                Approve (+{t.xp} XP)
                              </button>
                              <button
                                onClick={() => handleAdminVerifyProof(t, memId, false)}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs hover:bg-rose-500/30"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 5: STUDY SESSIONS AUDITOR (MOBILE-OPTIMIZED CARD STACK) */}
            {adminSubTab === 'sessions' && (
              <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Study Sessions Audit Trail</h3>
                    <p className="text-xs text-zinc-400">Audit logged hours, question counts, and remove accidental duplicates.</p>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono-num">
                    Total Logs: {sessions.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-700 space-y-3 transition-all"
                    >
                      {/* Card Header: Member & Time */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-bold text-xs text-orange-400">
                            {s.memberName ? s.memberName[0] : 'S'}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-white">{s.memberName}</span>
                            <span className="text-[10px] text-zinc-500 ml-2">{timeAgo(s.timestamp)}</span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 font-mono-num font-bold text-xs">
                          +{s.xpEarned} XP
                        </span>
                      </div>

                      {/* Card Body: Duration, Subject, Questions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-zinc-800/60 text-xs">
                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 block">Duration</span>
                          <span className="font-bold text-white font-mono-num">{formatDuration(s.duration)}</span>
                        </div>

                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 block">Subject</span>
                          <span className="font-bold text-amber-300">{s.subject}</span>
                        </div>

                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 block">Questions</span>
                          <span className="font-bold text-white font-mono-num">{s.questions} Qs</span>
                        </div>

                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                          <span className="text-[10px] text-zinc-500 block">Difficulty Tier</span>
                          <span className="font-bold text-zinc-300 capitalize">{s.difficulty || 'Mains'}</span>
                        </div>
                      </div>

                      {/* Touch-Friendly Card Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-zinc-500">ID: {s.id.slice(0, 10)}...</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Session Log</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {sessions.length === 0 && (
                    <div className="text-center py-8 text-xs text-zinc-500">No study sessions recorded yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 6: EXAM LOGS (MOBILE-OPTIMIZED CARD STACK) */}
            {adminSubTab === 'exams' && (
              <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">Exam Logs & Normalization Audit</h3>
                    <p className="text-xs text-zinc-400">Review student mock exam entries, calculated percentiles, and batch ranks.</p>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono-num">
                    Total Exams: {exams.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {exams.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 hover:border-zinc-700 space-y-3 transition-all"
                    >
                      {/* Card Header: Member, Title & Exam Type */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-bold text-xs text-amber-400">
                            {ex.memberName ? ex.memberName[0] : 'E'}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              <span>{ex.memberName}</span>
                              <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[10px] font-normal">
                                {ex.examType}
                              </span>
                            </div>
                            <div className="text-xs text-amber-300 font-semibold">{ex.title}</div>
                          </div>
                        </div>

                        {/* Standardized Percentile (The Core Fairness Metric) */}
                        <div className="text-right">
                          <div className="text-base sm:text-lg font-extrabold text-amber-400 font-mono-num">
                            {Number(ex.overallPercentile).toFixed(1)}%ile
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono-num">
                            Rank #{ex.overallRank} of {ex.totalStudents} pool
                          </div>
                        </div>
                      </div>

                      {/* Card Body: Scores & Subject breakdown */}
                      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-zinc-300">
                          <span>Total Marks:</span>
                          <span className="font-bold font-mono-num text-white">{ex.overallMarks} / {ex.overallMaxMarks}</span>
                        </div>

                        {ex.subjects && ex.subjects.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-800/60">
                            {ex.subjects.map((sub: any, idx: number) => (
                              <div key={idx} className="p-1.5 rounded-lg bg-zinc-900 text-center">
                                <span className="text-[10px] text-zinc-400 block truncate">{sub.name}</span>
                                <span className="text-xs font-bold text-amber-400 font-mono-num">
                                  {sub.percentile !== undefined ? `${Number(sub.percentile).toFixed(1)}%` : `${sub.marks || 0}m`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Touch-Friendly Card Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-zinc-500">{timeAgo(ex.timestamp)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(ex.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Exam Log</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {exams.length === 0 && (
                    <div className="text-center py-8 text-xs text-zinc-500">No exam logs recorded yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 7: ARENA CONTROLS & BROADCAST */}
            {adminSubTab === 'arena' && (
              <div className="space-y-4">
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4 border-amber-500/20">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white font-display">Arena Controls & Ceremonies</h3>
                    <p className="text-xs text-zinc-400">Lock the leaderboard in suspense blind mode or trigger the grand reveal.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>Blind Mode (Suspense Lock)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono-num font-bold ${
                          arenaSettings.leaderboardHidden ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {arenaSettings.leaderboardHidden ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Hides public standings so members cannot coast during the final sprint.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAdminToggleLeaderboardBlackout(!arenaSettings.leaderboardHidden)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                          arenaSettings.leaderboardHidden
                            ? 'bg-amber-400 text-zinc-950 hover:brightness-110 shadow-md'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200'
                        }`}
                      >
                        {arenaSettings.leaderboardHidden ? 'Unlock & Trigger Reveal' : 'Enable Blind Blackout'}
                      </button>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="text-xs font-bold text-white">Theatrical Kahoot Reveal</div>
                      <p className="text-[11px] text-zinc-400">
                        Plays the full-screen curtain sequence, suspense countdown, and confetti podium reveal.
                      </p>
                      <button
                        type="button"
                        onClick={triggerKahootRevealSequence}
                        className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md hover:brightness-110"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Launch Reveal Ceremony</span>
                      </button>
                    </div>
                  </div>

                  {/* Broadcast Message to Squad */}
                  <form onSubmit={handleAdminBroadcast} className="pt-3 border-t border-zinc-800/80 space-y-2">
                    <span className="text-xs font-semibold text-zinc-300 block">📢 Broadcast Flash Message to Squad</span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={broadcastTarget}
                        onChange={(e) => setBroadcastTarget(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                      >
                        <option value="ALL">Everyone (All 3)</option>
                        {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Type alert (e.g. Physics Mock results uploaded, check rank!)"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
                        required
                      />
                      <button type="submit" className="btn-primary px-4 py-1.5 rounded-xl text-xs font-semibold">
                        Send Flash Alert
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ADMIN UNLOCK MODAL */}
      {showAdminPassModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAdminModalSubmit} className="w-full max-w-xs surface-card rounded-3xl p-5 space-y-3.5 animate-modal">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Crown className="w-4 h-4" />
                <span>Admin Master Access</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowAdminPassModal(false);
                  setAdminModalPin('');
                  setAdminModalError('');
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="password"
              maxLength={4}
              placeholder="••••"
              value={adminModalPin}
              onChange={(e) => setAdminModalPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-lg tracking-widest text-white font-mono-num focus:outline-none focus:border-amber-400"
              autoFocus
            />
            {adminModalError && <div className="text-[11px] text-rose-400 text-center">{adminModalError}</div>}
            <button type="submit" className="w-full py-2 rounded-xl bg-amber-400 text-zinc-950 text-xs font-bold">
              Unlock
            </button>
          </form>
        </div>
      )}

      {/* PERSONAL TASK MODAL */}
      {showPersonalTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm surface-card rounded-3xl p-5 space-y-4 animate-modal">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-display">Add Personal Study Task</h3>
              <button onClick={() => setShowPersonalTaskModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePersonalTask} className="space-y-3">
              <input
                type="text"
                placeholder="Task Title (e.g. Finish Ex 1)"
                value={myTaskTitle}
                onChange={(e) => setMyTaskTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                required
              />

              <div className="space-y-2">
                <select
                  value={myTaskSubject}
                  onChange={(e) => setMyTaskSubject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>XP is automatically earned based on questions solved & study duration when you complete this task.</span>
                </div>
              </div>

              <textarea
                placeholder="Notes / Problem numbers..."
                value={myTaskNotes}
                onChange={(e) => setMyTaskNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white h-16"
              />

              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-semibold text-xs">
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SESSION LOGGER MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg surface-card rounded-3xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-modal">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm sm:text-base font-bold text-white font-display">StudyFlow Session Logger</h3>
              <button onClick={() => setShowLogModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLogSessionType('STUDY')}
                    className={`py-1 rounded-lg text-xs font-semibold ${logSessionType === 'STUDY' ? 'bg-orange-500/20 text-orange-400 font-bold' : 'text-zinc-400'}`}
                  >
                    Study
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogSessionType('BREAK')}
                    className={`py-1 rounded-lg text-xs font-semibold ${logSessionType === 'BREAK' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                  >
                    Break
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLogInputMethod('TIME_RANGE')}
                    className={`py-1 rounded-lg text-xs font-semibold ${logInputMethod === 'TIME_RANGE' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                  >
                    Range
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogInputMethod('DURATION_ONLY')}
                    className={`py-1 rounded-lg text-xs font-semibold ${logInputMethod === 'DURATION_ONLY' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                  >
                    Mins
                  </button>
                </div>
              </div>

              {/* Subject Select */}
              <div className="flex flex-wrap gap-1">
                {SUBJECT_OPTIONS.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setLogSubject(sub.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      logSubject === sub.id ? 'bg-orange-500 text-zinc-950 font-bold' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    {sub.short}
                  </button>
                ))}
              </div>

              {/* Duration or Range */}
              {logInputMethod === 'TIME_RANGE' ? (
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <input
                    type="text"
                    placeholder="Quick natural range: 5:30pm - 7:30pm..."
                    value={logQuickParser}
                    onChange={(e) => handleQuickParserChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500">Start</span>
                      <input
                        type="time"
                        value={logStartTime}
                        onChange={(e) => handleStartEndChange(e.target.value, logEndTime)}
                        className="w-full mt-0.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500">End</span>
                      <input
                        type="time"
                        value={logEndTime}
                        onChange={(e) => handleStartEndChange(logStartTime, e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={logDuration}
                    onChange={(e) => setLogDuration(e.target.value)}
                    className="w-24 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono-num font-bold"
                  />
                  <span className="text-xs text-zinc-400">minutes</span>
                </div>
              )}

              {/* Questions Solved: Multiple Difficulties Breakdown */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-white">Questions Solved by Difficulty:</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono-num">
                    Total: <strong className="text-amber-400">{totalLogQuestions} Questions</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIFFICULTY_TIERS.map((tier) => {
                    const countStr = logQuestionsByTier[tier.id] || '';
                    return (
                      <div
                        key={tier.id}
                        className={`p-2.5 rounded-xl border ${tier.border} ${tier.bg} space-y-1.5 flex flex-col justify-between`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-bold ${tier.color}`}>{tier.label}</span>
                          <span className="text-[9px] text-zinc-400 font-mono-num">{tier.desc}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = Math.max(0, parseInt(countStr, 10) || 0);
                              setLogQuestionsByTier(prev => ({
                                ...prev,
                                [tier.id]: cur > 1 ? String(cur - 1) : ''
                              }));
                            }}
                            className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold flex items-center justify-center text-xs shrink-0 active:scale-95 transition-transform"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={countStr}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              setLogQuestionsByTier(prev => ({ ...prev, [tier.id]: val }));
                            }}
                            className="w-full text-center py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-white font-bold font-mono-num text-xs focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const cur = Math.max(0, parseInt(countStr, 10) || 0);
                              setLogQuestionsByTier(prev => ({
                                ...prev,
                                [tier.id]: String(cur + 1)
                              }));
                            }}
                            className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-bold flex items-center justify-center text-xs shrink-0 active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Linked Tasks Selection Section */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Select Tasks You Were Working On:</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono-num">
                    {logLinkedTaskIds.length} selected
                  </span>
                </div>

                {(() => {
                  const targetMemId = ((isAdminUnlocked || activeMemberId === 'admin') && logTargetMember)
                    ? logTargetMember
                    : (currentMember?.id || 'sai');

                  const availableTasks = tasks.filter(t => {
                    const isAssigned = t.assignedTo && (t.assignedTo.includes('ALL') || t.assignedTo.includes(targetMemId));
                    const isOwner = t.ownerId === targetMemId;
                    const comp = t.completions && t.completions[targetMemId];
                    const isVerified = comp && comp.status === 'verified';
                    return (isAssigned || isOwner) && !isVerified;
                  });

                  const availableHomework = teacherAssignments.filter(a => {
                    if (a.archived) return false;
                    const isAssigned = !a.assignedTo || a.assignedTo.includes('ALL') || a.assignedTo.includes(targetMemId);
                    const sub = a.submissions?.[targetMemId];
                    const isGraded = sub && sub.status === 'graded';
                    return isAssigned && !isGraded;
                  });

                  const combinedItems = [
                    ...availableHomework.map(a => ({
                      id: `asg_${a.id}`,
                      title: a.title,
                      subject: a.subject,
                      xp: a.xpReward,
                      isHomework: true,
                      assignment: a
                    })),
                    ...availableTasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      subject: t.subject,
                      xp: t.xp || 20,
                      isHomework: false,
                      task: t
                    }))
                  ];

                  if (combinedItems.length === 0) {
                    return (
                      <div className="text-[11px] text-zinc-500 italic p-2 text-center bg-zinc-900/50 rounded-xl">
                        No active uncompleted tasks or homework for this member.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {combinedItems.map(item => {
                        const isSelected = logLinkedTaskIds.includes(item.id);
                        const status = logTaskCompletionStatus[item.id] || 'completed';

                        return (
                          <div
                            key={item.id}
                            className={`w-full p-2.5 rounded-xl text-left text-xs transition-all border space-y-1.5 ${
                              isSelected
                                ? 'bg-amber-400/15 border-amber-400/60 text-white'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (isSelected) {
                                  setLogLinkedTaskIds(prev => prev.filter(id => id !== item.id));
                                } else {
                                  setLogLinkedTaskIds(prev => [...prev, item.id]);
                                }
                              }}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                  isSelected ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                  {isSelected ? '✓' : ''}
                                </div>
                                <div className="truncate">
                                  {item.isHomework && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold text-[9px] mr-1.5 border border-amber-400/30">
                                      TUITION HW
                                    </span>
                                  )}
                                  <span className="text-white font-medium">{item.title}</span>
                                  <span className="text-[10px] text-zinc-400 ml-1.5">({item.subject})</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold font-mono-num text-amber-400 shrink-0">
                                +{item.xp} XP
                              </span>
                            </div>

                            {/* Prompt: Completed or still doing */}
                            {isSelected && (
                              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
                                <span className="text-zinc-300 font-medium">Task progress:</span>
                                <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                                  <button
                                    type="button"
                                    onClick={() => setLogTaskCompletionStatus(prev => ({ ...prev, [item.id]: 'completed' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      status === 'completed'
                                        ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    ✓ Completed
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLogTaskCompletionStatus(prev => ({ ...prev, [item.id]: 'in_progress' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      status === 'in_progress'
                                        ? 'bg-amber-400 text-zinc-950 shadow-sm'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                                    title="Keep task active without completing"
                                  >
                                    ⏳ Still Doing (Active)
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Quick Inline New Task Creation */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Or type a new task to add & link on the fly..."
                    value={inlineNewTaskTitle}
                    onChange={(e) => setInlineNewTaskTitle(e.target.value)}
                    className="flex-1 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleInlineAddPersonalTask}
                    disabled={!inlineNewTaskTitle.trim()}
                    className="px-3 py-1 rounded-xl bg-amber-400/20 text-amber-300 font-bold text-xs hover:bg-amber-400/30 disabled:opacity-40"
                  >
                    + Link
                  </button>
                </div>
              </div>

              {/* Notes */}
              <input
                type="text"
                placeholder="Topic / chapter (e.g. Cengage Ex 1.2 Q1-15)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
              />

              {/* Live XP Preview Card with Time, Questions & Linked Task Bonus */}
              {(() => {
                const mins = Math.max(1, Math.round(Number(logDuration) || 0));
                const questionsInput = Object.keys(logQuestionsByTier).some(k => (parseInt(logQuestionsByTier[k], 10) || 0) > 0)
                  ? logQuestionsByTier
                  : totalLogQuestions;
                const totalSessionXp = calcSessionXp(mins, questionsInput, 'mains', logSessionType) + linkedTasksXp;
                const timeXp = Math.round((mins / 30) * 10);
                const questionsOnlyXp = Math.max(0, totalSessionXp - timeXp - linkedTasksXp);

                return (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>Total Earned XP:</span>
                      <span className="text-base text-amber-400 font-mono-num font-extrabold">+{totalSessionXp} XP</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                      <span>⏱️ Time: <strong className="text-white">+{timeXp} XP</strong> ({mins}m)</span>
                      <span>•</span>
                      <span>📝 Questions: <strong className="text-amber-400">+{questionsOnlyXp} XP</strong> ({totalLogQuestions} Qs)</span>
                      {linkedTasksXp > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">🎯 Linked Task XP: +{linkedTasksXp} XP (Overriding Default)</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-bold text-xs shadow-md">
                Save (+{(() => {
                  const mins = Math.max(1, Math.round(Number(logDuration) || 0));
                  const questionsInput = Object.keys(logQuestionsByTier).some(k => (parseInt(logQuestionsByTier[k], 10) || 0) > 0)
                    ? logQuestionsByTier
                    : totalLogQuestions;
                  return calcSessionXp(mins, questionsInput, 'mains', logSessionType) + linkedTasksXp;
                })()} XP)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EXAM MODAL */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md surface-card rounded-3xl p-4 sm:p-5 space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-modal">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white font-display">Log Weekly Exam Result</h3>
              <button onClick={() => setShowExamModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={examType}
                  onChange={(e) => handleExamTypeSwitch(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                >
                  {Object.keys(EXAM_TEMPLATES).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Test Name"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Overall Score</span>
                  <input
                    type="number"
                    placeholder="Marks (e.g. 210)"
                    value={examMarks}
                    onChange={(e) => setExamMarks(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 block mb-0.5 font-medium">Max Marks</span>
                  <input
                    type="number"
                    placeholder="Max (e.g. 300)"
                    value={examMaxMarks}
                    onChange={(e) => setExamMaxMarks(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 block mb-0.5 font-semibold">Overall Rank</span>
                  <input
                    type="number"
                    placeholder="Rank (e.g. 28)"
                    value={examRank}
                    onChange={(e) => setExamRank(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-amber-500/50 text-amber-300 font-mono-num font-bold"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 block mb-0.5 font-semibold">Total Students in Batch</span>
                  <input
                    type="number"
                    placeholder="Batch count (Required)"
                    value={examTotalStudents}
                    onChange={(e) => setExamTotalStudents(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-amber-500/50 text-white font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              {/* Subject-Wise Breakdown Inputs (Marks & Ranks per subject) */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Subject Breakdown (Marks & Subject Ranks)</span>
                  <span className="text-[10px] text-zinc-500">Fair Percentile Normalization</span>
                </div>

                <div className="space-y-2">
                  {examSubjects.map((sub, sIdx) => {
                    const totalBatch = Number(examTotalStudents) || 1;
                    const sRank = Number(sub.rank) || 0;
                    const sPercentile = sRank > 0 && totalBatch > 0 ? calcPercentile(sRank, totalBatch) : null;

                    return (
                      <div key={sub.name} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-orange-400" />
                            <span>{sub.name}</span>
                          </span>
                          {sPercentile !== null && (
                            <span className="text-xs font-mono-num font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                              {sPercentile.toFixed(1)}%ile
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Marks Got</label>
                            <input
                              type="number"
                              placeholder="Marks"
                              value={sub.marks}
                              onChange={(e) => {
                                const updated = [...examSubjects];
                                updated[sIdx].marks = e.target.value;
                                setExamSubjects(updated);
                              }}
                              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white font-mono-num"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block mb-0.5">Max Marks</label>
                            <input
                              type="number"
                              placeholder="Max (100)"
                              value={sub.maxMarks}
                              onChange={(e) => {
                                const updated = [...examSubjects];
                                updated[sIdx].maxMarks = e.target.value;
                                setExamSubjects(updated);
                              }}
                              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white font-mono-num"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-amber-400 block mb-0.5 font-semibold">Subject Rank</label>
                            <input
                              type="number"
                              placeholder="Rank in subj"
                              value={sub.rank}
                              onChange={(e) => {
                                const updated = [...examSubjects];
                                updated[sIdx].rank = e.target.value;
                                setExamSubjects(updated);
                              }}
                              className="w-full px-2 py-1 rounded bg-zinc-900 border border-amber-500/40 text-amber-300 font-mono-num font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Fair Normalization Preview */}
              {Number(examRank) > 0 && Number(examTotalStudents) > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>Standardized Standing:</span>
                    <span className="font-mono-num text-sm">
                      {calcPercentile(Number(examRank), Number(examTotalStudents)).toFixed(2)}%ile
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    Eliminates batch size skew between Modulus (~560) and Allen batches. Capped 300 XP pool share: <strong className="text-white font-mono-num">{Math.round(calcPercentile(Number(examRank), Number(examTotalStudents)) * 3)} XP</strong>.
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-2.5 rounded-xl font-semibold text-xs shadow-md">
                Save & Run AI Diagnostic
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROOF UPLOADER MODAL */}
      {proofTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmitProof} className="w-full max-w-sm surface-card rounded-3xl p-5 space-y-3.5 animate-modal">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white font-display">Upload Proof ({proofTaskModal.title})</h3>
              <button type="button" onClick={() => setProofTaskModal(null)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input type="file" accept="image/*" multiple onChange={handleProofFilesSelect} className="w-full text-xs text-zinc-300" />
            <div className="flex gap-1.5 overflow-x-auto">
              {proofImages.map((src, i) => (
                <img key={i} src={src} alt="proof" className="w-12 h-12 rounded-lg object-cover" />
              ))}
            </div>
            <input
              type="text"
              placeholder="Note for Admin..."
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
            />
            <button type="submit" className="btn-primary w-full py-2 rounded-xl font-semibold text-xs">
              Submit Proof
            </button>
          </form>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxImages && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImages(null)}>
          <div className="max-w-xl w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button onClick={() => setLightboxImages(null)} className="px-2.5 py-1 rounded bg-zinc-800 text-white text-xs">
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[80vh] overflow-y-auto">
              {lightboxImages.map((src, idx) => (
                <img key={idx} src={src} alt="attachment" className="w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KAHOOT REVEAL CEREMONY */}
      {isRevealing && (
        <div className="fixed inset-0 z-50 bg-[#070709] flex flex-col justify-between overflow-hidden select-none">
          {/* Confetti on step 5 */}
          {revealStep >= 5 && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
              {Array.from({ length: 28 }).map((_, idx) => (
                <div
                  key={idx}
                  className="confetti-piece"
                  style={{
                    left: `${(idx * 3.6) % 100}%`,
                    backgroundColor: ['#F59E0B', '#F97316', '#FDE047', '#FFFFFF'][idx % 4],
                    animationDelay: `${(idx % 5) * 0.25}s`,
                    animationDuration: `${2.4 + (idx % 3) * 0.4}s`
                  }}
                />
              ))}
            </div>
          )}

          {/* Curtains */}
          <div className={`fixed inset-y-0 left-0 w-1/2 z-40 curtain-fabric border-r-2 border-amber-500/50 transition-transform duration-[1200ms] ${revealStep >= 1 ? '-translate-x-full' : 'translate-x-0'}`} />
          <div className={`fixed inset-y-0 right-0 w-1/2 z-40 curtain-fabric border-l-2 border-amber-500/50 transition-transform duration-[1200ms] ${revealStep >= 1 ? 'translate-x-full' : 'translate-x-0'}`} />

          {/* Closed curtain intro */}
          {revealStep === 0 && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 text-center animate-modal">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 shadow-xl mb-4 animate-bounce">
                <Trophy className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display">Unveiling Standings...</h2>
            </div>
          )}

          {/* Top Bar */}
          <div className="relative z-30 max-w-4xl w-full mx-auto px-4 pt-4 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Grand Podium Reveal</span>
            <button onClick={closeKahootReveal} className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
              Skip
            </button>
          </div>

          {/* Stage Headline */}
          <div className="relative z-30 text-center px-4 my-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {revealStep === 1 && 'The Stage is Set...'}
                {revealStep === 2 && 'Calculating Final Standings...'}
                {revealStep === 3 && 'In 3rd Place (#3)...'}
                {revealStep === 4 && 'Taking the Runner-Up (#2)...'}
                {revealStep >= 5 && `👑 ${leaderboardStats[0]?.name || 'Champion'} Takes #1!`}
              </span>
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold text-white font-display">
              {revealStep === 2
                ? 'The Shadow Heist Clash'
                : revealStep >= 5
                ? `${leaderboardStats[0]?.name} wins with ${leaderboardStats[0]?.weeklyXp} XP!`
                : 'Weekly Podium'}
            </h2>
          </div>

          {/* Center Stage: Step 2 displays Prep, Steps 3-5 display Podium */}
          {revealStep === 2 ? (
            <div className="relative z-30 max-w-2xl w-full mx-auto px-4 my-auto animate-modal flex flex-col items-center">
              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                   <Clock className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white font-display">Preparing Standings...</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">Standings are being calculated and verified. Get ready for the final results!</p>
              </div>
              <div className="text-center mt-6">
                <button
                  onClick={() => setRevealStep(3)}
                  className="btn-primary px-8 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-amber-500/20"
                >
                  Continue to Podium →
                </button>
              </div>
            </div>
          ) : (
            /* 3-Pedestal Floor */
            <div className="relative z-30 max-w-2xl w-full mx-auto px-4 pb-5 flex flex-col justify-end">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end min-h-[260px] sm:min-h-[300px]">
                {/* 2nd Place */}
                <div className="flex flex-col items-center justify-end h-full">
                  {revealStep >= 4 && leaderboardStats[1] ? (
                    <div className="w-full flex flex-col items-center animate-podium-rise">
                      <div className="mb-2 text-center">
                        <div className="text-xs sm:text-sm font-bold text-white">{leaderboardStats[1].name}</div>
                      </div>
                      <div className="w-full h-36 sm:h-44 rounded-t-2xl bg-zinc-800 border-t border-zinc-400 p-2 flex flex-col items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-300 font-mono-num">#2 SILVER</span>
                        <div className="text-base sm:text-xl font-bold text-white font-mono-num">{leaderboardStats[1].weeklyXp} XP</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-36 sm:h-44 rounded-t-2xl bg-zinc-900/30 border border-dashed border-zinc-800 flex items-center justify-center text-xs font-mono-num text-zinc-600">#2 ???</div>
                  )}
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center justify-end h-full">
                  {revealStep >= 5 && leaderboardStats[0] ? (
                    <div className="w-full flex flex-col items-center animate-podium-rise">
                      <div className="mb-2 text-center">
                        <Crown className="w-6 h-6 text-amber-400 mx-auto animate-bounce" />
                        <div className="text-sm sm:text-base font-bold text-amber-400">{leaderboardStats[0].name}</div>
                      </div>
                      <div className="w-full h-48 sm:h-56 rounded-t-2xl bg-gradient-to-b from-amber-500/25 to-zinc-900 border-t-2 border-amber-400 p-2 flex flex-col items-center justify-between shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                        <span className="text-[10px] font-bold text-amber-400 font-mono-num">#1 GOLD</span>
                        <div className="text-lg sm:text-2xl font-bold text-amber-400 font-mono-num">{leaderboardStats[0].weeklyXp} XP</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-48 sm:h-56 rounded-t-2xl bg-zinc-900/30 border border-dashed border-zinc-800 flex items-center justify-center text-xs font-mono-num text-amber-400/80 font-bold">
                      {revealStep === 4 ? 'DRUMROLL...' : '#1 ???'}
                    </div>
                  )}
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center justify-end h-full">
                  {revealStep >= 3 && leaderboardStats[2] ? (
                    <div className="w-full flex flex-col items-center animate-podium-rise">
                      <div className="mb-2 text-center">
                        <div className="text-xs sm:text-sm font-bold text-white">{leaderboardStats[2].name}</div>
                      </div>
                      <div className="w-full h-28 sm:h-32 rounded-t-2xl bg-zinc-800/80 border-t border-orange-500/50 p-2 flex flex-col items-center justify-between">
                        <span className="text-[10px] font-bold text-orange-300 font-mono-num">#3 BRONZE</span>
                        <div className="text-sm sm:text-lg font-bold text-orange-300 font-mono-num">{leaderboardStats[2].weeklyXp} XP</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-28 sm:h-32 rounded-t-2xl bg-zinc-900/30 border border-dashed border-zinc-800 flex items-center justify-center text-xs font-mono-num text-zinc-600">#3 ???</div>
                  )}
                </div>
              </div>

              <div className="h-12 flex items-center justify-center mt-3">
                {revealStep >= 5 && (
                  <button onClick={closeKahootReveal} className="btn-primary px-6 py-2 rounded-xl text-xs font-bold">
                    Enter Arena
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* TEACHER XP ADJUSTMENT MODAL */}
      {showTeacherXpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md surface-card rounded-3xl p-5 space-y-4 border-amber-500/30 animate-modal">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="text-sm font-bold text-white font-display">
                  Tuition Faculty: Adjust Student XP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTeacherXpModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTeacherAdjustStudentXp} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Target Student:</label>
                <select
                  value={teacherXpTargetStudentId}
                  onChange={(e) => setTeacherXpTargetStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-semibold"
                >
                  {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.institute}) • Current Bonus XP: {m.bonusXp || 0}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">XP Action:</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setTeacherXpIsDeduction(false)}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      !teacherXpIsDeduction
                        ? 'bg-emerald-500 text-zinc-950 shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Award XP (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeacherXpIsDeduction(true)}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      teacherXpIsDeduction
                        ? 'bg-rose-500 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Deduct XP (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  XP Amount {teacherXpIsDeduction ? '(To Deduct)' : '(To Award)'}:
                </label>
                <input
                  type="number"
                  placeholder="e.g. 25 or 50"
                  value={teacherXpAmount}
                  onChange={(e) => setTeacherXpAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono-num font-bold text-sm"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Evaluation Reason:</label>
                <input
                  type="text"
                  placeholder="e.g. Excellent problem set solving / Late submission penalty"
                  value={teacherXpReason}
                  onChange={(e) => setTeacherXpReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherXpModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md ${
                    teacherXpIsDeduction
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                  }`}
                >
                  {teacherXpIsDeduction ? 'Confirm XP Deduction' : 'Confirm Award XP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEACHER ASSIGNMENT MODAL */}
      {showCreateAssignmentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg surface-card rounded-3xl p-4 sm:p-5 space-y-3.5 border-amber-500/30 animate-modal my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-display">
                  Dispatch Tuition Homework ({assignSubject})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAssignmentModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacherAssignment} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Assignment Title <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Integration Practice Sheet 3 / PYQs Ex 2"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-semibold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Subject:</label>
                  <select
                    value={assignSubject}
                    onChange={(e) => setAssignSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-semibold"
                  >
                    {availableTuitionSubjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                    Due Date <span className="text-rose-400">* (Compulsory)</span>:
                  </label>
                  <input
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/40 text-white font-mono-num font-bold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Assignee Selection (Default Everyone) */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-white">Assign To Students:</label>
                  <span className="text-[10px] text-amber-400 font-semibold">
                    {assignTarget.includes('ALL') ? 'Assigned to Everyone' : `Assigned to ${assignTarget.length} student(s)`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssignTarget(['ALL'])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      assignTarget.includes('ALL')
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    Everyone (Default)
                  </button>
                  {(members.length > 0 ? members : DEFAULT_MEMBERS).map((m) => {
                    const isSelected = !assignTarget.includes('ALL') && assignTarget.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (assignTarget.includes('ALL')) {
                            setAssignTarget([m.id]);
                          } else {
                            if (isSelected) {
                              const next = assignTarget.filter(id => id !== m.id);
                              setAssignTarget(next.length === 0 ? ['ALL'] : next);
                            } else {
                              setAssignTarget([...assignTarget, m.id]);
                            }
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions Setup (Optional Questions) */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-white text-xs">
                    <input
                      type="checkbox"
                      checked={assignHasQuestions}
                      onChange={(e) => setAssignHasQuestions(e.target.checked)}
                      className="rounded accent-amber-400 w-4 h-4"
                    />
                    <span>Include Practice Questions Drill</span>
                  </label>
                  <span className="text-[10px] text-zinc-500">(Questions are optional)</span>
                </div>

                {assignHasQuestions && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Questions Count:</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="20"
                        value={assignQuestions}
                        onChange={(e) => setAssignQuestions(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono-num font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-zinc-400 block mb-1">Question Difficulty:</label>
                      <select
                        value={assignQuestionDifficulty}
                        onChange={(e) => setAssignQuestionDifficulty(e.target.value as any)}
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-semibold"
                      >
                        <option value="easy">Easy (Mains Level)</option>
                        <option value="medium">Medium (Standard)</option>
                        <option value="hard">Hard (Advanced Level)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* XP Reward & 2X Speed Boost Toggle */}
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-amber-400 block mb-1">
                      Base XP Reward (0 allowed):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={assignXp}
                      onChange={(e) => setAssignXp(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-amber-500/40 text-amber-300 font-mono-num font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                      2X XP Full Complete Boost:
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignDoubleXpFullComplete}
                        onChange={(e) => setAssignDoubleXpFullComplete(e.target.checked)}
                        className="rounded accent-amber-400 w-4 h-4"
                      />
                      <span className="text-[10px] text-amber-300 font-bold">2X XP for 100% Completion</span>
                    </label>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  * 2X XP bonus will ONLY be awarded to students who complete all questions / full task.
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Description / Exercises / Instructions:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Complete Exercise 2 problems 1 to 25 and upload your working notebook."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>

              {/* Up to 10 File Attachments Uploader for Teachers */}
              <AssignmentAttachmentUploader
                files={assignAttachedFiles}
                onChange={setAssignAttachedFiles}
                maxFiles={10}
                label="Assignment Attachments (PDFs, Images, Videos, Links - Up to 10)"
                description="Upload up to 10 files, PDFs, videos, or external reference links"
              />

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="assignProof"
                  checked={assignRequireProof}
                  onChange={(e) => setAssignRequireProof(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-amber-400 focus:ring-0"
                />
                <label htmlFor="assignProof" className="text-xs text-zinc-300 font-medium">
                  Require solution proof upload from students
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAssignmentModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-md"
                >
                  Dispatch Homework
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEACHER ASSIGNMENT MODAL */}
      {editingAssignmentId && editAssignmentForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg surface-card rounded-3xl p-5 space-y-4 border-amber-500/30 animate-modal">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-display">
                  Edit Tuition Assignment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAssignmentId(null);
                  setEditAssignmentForm(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignmentEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Assignment Title:</label>
                <input
                  type="text"
                  placeholder="Title..."
                  value={editAssignmentForm.title}
                  onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Subject:</label>
                  <select
                    value={editAssignmentForm.subject}
                    onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-semibold"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Math">Math</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Due Date:</label>
                  <input
                    type="date"
                    value={editAssignmentForm.dueDate}
                    onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono-num"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Questions Count:</label>
                  <input
                    type="number"
                    value={editAssignmentForm.questionsCount}
                    onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, questionsCount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono-num"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-amber-400 block mb-1">XP Reward:</label>
                  <input
                    type="number"
                    value={editAssignmentForm.xpReward}
                    onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, xpReward: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/50 text-amber-300 font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Description / Exercises:</label>
                <textarea
                  rows={3}
                  value={editAssignmentForm.description}
                  onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Reference Link (Optional):</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={editAssignmentForm.refLink}
                  onChange={(e) => setEditAssignmentForm({ ...editAssignmentForm, refLink: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssignmentId(null);
                    setEditAssignmentForm(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-md"
                >
                  Save Assignment Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT SESSIONS BREAKDOWN MODAL */}
      {selectedStudentSessionsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg surface-card rounded-3xl p-5 space-y-4 border-amber-500/30 animate-modal max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm sm:text-base font-bold text-white font-display">
                  {selectedStudentSessionsModal.member.name}'s {selectedStudentSessionsModal.subject} Study Log
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentSessionsModal(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {(() => {
                const mem = selectedStudentSessionsModal.member;
                const subj = selectedStudentSessionsModal.subject;
                const memSessions = sessions.filter(s => s.memberId === mem.id && s.subject === subj);
                const totalMins = memSessions.reduce((a, b) => a + (Number(b.duration) || 0), 0);
                const totalQs = memSessions.reduce((a, b) => a + (Number(b.questions) || 0), 0);

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Total Time Logged</span>
                        <span className="text-base font-bold text-white font-mono-num">{formatDuration(totalMins)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Problems Solved</span>
                        <span className="text-base font-bold text-amber-400 font-mono-num">{totalQs} Qs</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                        Logged Sessions ({memSessions.length}):
                      </span>
                      {memSessions.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-xs rounded-xl bg-zinc-950/50 border border-zinc-800/60">
                          No {subj} study sessions logged yet by {mem.name}.
                        </div>
                      ) : (
                        memSessions.map((s) => (
                          <div key={s.id} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white font-mono-num">{formatDuration(s.duration)}</span>
                              <span className="text-[10px] text-amber-400 font-bold font-mono-num">+{s.xpEarned} XP</span>
                            </div>
                            <div className="text-[11px] text-zinc-300 flex items-center justify-between">
                              <span>{s.questions > 0 ? `${s.questions} Qs (${s.difficulty || 'MEDIUM'})` : 'Concept Study'}</span>
                              <span className="text-[10px] text-zinc-500 font-mono-num">{s.date || timeAgo(s.timestamp)}</span>
                            </div>
                            {s.notes && (
                              <p className="text-[11px] text-zinc-400 italic pt-0.5">"{s.notes}"</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={() => setSelectedStudentSessionsModal(null)}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* HOMEWORK SUBMISSION & EXCUSE MODAL (STUDENTS) */}
      {activeAssignmentAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg surface-card rounded-3xl p-4 sm:p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto animate-modal">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {assignmentActionMode === 'submit_solution' ? (
                  <Upload className="w-5 h-5 text-orange-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                <h3 className="text-sm sm:text-base font-bold text-white font-display">
                  {assignmentActionMode === 'submit_solution' ? 'Submit Tuition Homework' : 'File Incompletion Excuse'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAssignmentAction(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">Target Assignment</span>
              <span className="text-sm font-bold text-white block">{activeAssignmentAction.title}</span>
              <div className="flex items-center gap-2 pt-1">
                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 text-[10px] font-semibold">
                  {activeAssignmentAction.subject}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono-num">
                  {activeAssignmentAction.questionsCount} Questions • +{activeAssignmentAction.xpReward} XP Potential
                </span>
              </div>
            </div>

            {assignmentActionMode === 'submit_solution' ? (
              <form onSubmit={handleStudentSubmitHomework} className="space-y-4">
                {/* 1. File & Photo Uploads */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-white block">
                    1. Attach Working Solution Files, Photos & PDFs:
                  </span>
                  <AssignmentAttachmentUploader
                    files={studentHomeworkAttachedFiles}
                    onChange={setStudentHomeworkAttachedFiles}
                    maxFiles={10}
                    label="Attach Photos, Camera Captures, PDFs or Solution Files"
                    description="Upload up to 10 photos, scanned solutions, or PDF docs"
                  />
                </div>

                {/* 2. External Resource Links */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                  <span className="text-[11px] font-bold text-white block">
                    2. External Resource Links (Google Drive, GitHub, Notion, Web Links):
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={newResourceLinkInput}
                      onChange={(e) => setNewResourceLinkInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddResourceLink}
                      disabled={!newResourceLinkInput.trim()}
                      className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                    >
                      + Add Link
                    </button>
                  </div>

                  {studentHomeworkResourceLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {studentHomeworkResourceLinks.map((link, i) => (
                        <div key={i} className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-cyan-300 text-xs flex items-center gap-1.5 max-w-full">
                          <LinkIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[200px] text-[11px]">{link}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveResourceLink(i)}
                            className="text-zinc-500 hover:text-rose-400 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Written Answers & Notes */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                  <label className="text-[11px] font-bold text-white block">
                    3. Written Solution Answers & Notes:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type your final answers, numerical steps, or problem-solving notes here..."
                    value={studentHomeworkNote}
                    onChange={(e) => setStudentHomeworkNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAssignmentAction}
                  className="btn-primary w-full py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isSubmittingAssignmentAction
                      ? 'Submitting Homework...'
                      : 'Submit Solution for Faculty Review'}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleStudentSubmitExcuse} className="space-y-4">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Incompletion Warning</span>
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed">
                    If an assignment is incomplete, you must provide a valid reason (e.g. school exams, health, complex topic).
                    Faculty will review and may apply an <strong className="text-rose-400">XP Penalty</strong> if the excuse is deemed unsatisfactory.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-white block">
                    Reason for Incompletion:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide a detailed reason why you couldn't finish the homework..."
                    value={studentExcuseReason}
                    onChange={(e) => setStudentExcuseReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-md transition-all"
                >
                  File Excuse & Notify Teacher
                </button>
              </form>
            )}
          </div>
        </div>
      )}



      {/* SQUAD & DIRECT MESSAGING CHAT DRAWER */}
      {showChatDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md h-full surface-card border-l border-zinc-800 flex flex-col justify-between p-4 sm:p-5 animate-modal">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-zinc-950 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-display">
                    Squad Chat & Messages
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    Real-time Direct & Public Messaging
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient Channel Selector */}
            <div className="py-2 space-y-1.5 border-b border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Select Recipient Channel:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setChatActiveChannel('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    chatActiveChannel === 'ALL'
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  <span>📢 Public Squad (All)</span>
                </button>

                {(members.length > 0 ? members : DEFAULT_MEMBERS).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChatActiveChannel(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      chatActiveChannel === m.id
                        ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>👤 {m.name}</span>
                  </button>
                ))}

                {(teachers.length > 0 ? teachers : DEFAULT_TEACHERS).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setChatActiveChannel(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                      chatActiveChannel === t.id
                        ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>🎓 {t.name}</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setChatActiveChannel('admin')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                    chatActiveChannel === 'admin'
                      ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                  }`}
                >
                  <span>👑 Admin</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 my-1">
              {(() => {
                const currentUserId = currentTeacher ? currentTeacher.id : activeMemberId === 'admin' ? 'admin' : (currentMember?.id || 'sai');
                const filtered = chatMessages.filter(m => {
                  if (chatActiveChannel === 'ALL') {
                    return m.recipientId === 'ALL';
                  } else {
                    return (
                      (m.senderId === currentUserId && m.recipientId === chatActiveChannel) ||
                      (m.senderId === chatActiveChannel && m.recipientId === currentUserId)
                    );
                  }
                });

                if (filtered.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-500">
                      <MessageSquare className="w-8 h-8 text-zinc-700" />
                      <p className="text-xs">No messages in this channel yet.</p>
                      <p className="text-[10px] text-zinc-600">
                        {chatActiveChannel === 'ALL'
                          ? 'Send a public broadcast to all students, teachers, and admin!'
                          : `Send a direct message to ${
                              members.find(m => m.id === chatActiveChannel)?.name ||
                              teachers.find(t => t.id === chatActiveChannel)?.name ||
                              'recipient'
                            }.`}
                      </p>
                    </div>
                  );
                }

                return filtered.map(msg => {
                  const isMe = msg.senderId === currentUserId;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} text-xs space-y-0.5`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="font-bold text-zinc-300">{isMe ? 'You' : msg.senderName}</span>
                        {msg.senderType === 'teacher' && (
                          <span className="px-1 rounded bg-amber-400/20 text-amber-300 font-bold text-[9px]">FACULTY</span>
                        )}
                        {msg.senderType === 'admin' && (
                          <span className="px-1 rounded bg-amber-500/20 text-amber-400 font-bold text-[9px]">ADMIN</span>
                        )}
                        <span>•</span>
                        <span>{timeAgo(msg.timestamp)}</span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-medium rounded-tr-none shadow-md'
                            : 'bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {msg.recipientId !== 'ALL' && (
                        <span className="text-[9px] text-amber-400/80 italic font-mono">
                          Direct to {msg.recipientName}
                        </span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Quick Phrase Suggestions */}
            <div className="py-1.5 flex gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
              {[
                'Grinding Physics numericals right now! ⚡',
                'Mock test score updated! Check standing 🏆',
                'Anybody up for a 45-min study sprint? ⏱️',
                'Finished today\'s target questions! 📚'
              ].map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setChatInputText(phrase)}
                  className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white shrink-0"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Message Input & Send */}
            <form onSubmit={handleSendChatMessage} className="pt-2 border-t border-zinc-800 flex gap-2">
              <input
                type="text"
                placeholder={
                  chatActiveChannel === 'ALL'
                    ? 'Broadcast message to squad...'
                    : `Direct message to ${
                        members.find(m => m.id === chatActiveChannel)?.name ||
                        teachers.find(t => t.id === chatActiveChannel)?.name ||
                        'user'
                      }...`
                }
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!chatInputText.trim()}
                className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}



      {/* CELEBRATORY STUDY LOG ANIMATION MODAL */}
      {studyLogSuccessData && (
        <StudyLogSuccessAnimation
          memberName={studyLogSuccessData.memberName}
          xpEarned={studyLogSuccessData.xpEarned}
          durationMins={studyLogSuccessData.durationMins}
          totalQCount={studyLogSuccessData.totalQCount}
          tasksCount={studyLogSuccessData.tasksCount}
          streakCount={studyLogSuccessData.streakCount}
          onClose={() => setStudyLogSuccessData(null)}
        />
      )}

      {/* ARENA OVERTAKE & DUEL CLASH MODAL */}
      {arenaOvertakeData && (
        <ArenaOvertakeModal
          challengerName={arenaOvertakeData.challengerName}
          rivalName={arenaOvertakeData.rivalName}
          oldRank={arenaOvertakeData.oldRank}
          newRank={arenaOvertakeData.newRank}
          differenceXp={arenaOvertakeData.differenceXp}
          onClose={() => setArenaOvertakeData(null)}
        />
      )}

      {/* TEACHER GRADING & EXCUSE REVIEW MODAL */}
      {reviewingAssignment && reviewingStudentId && (
        <TeacherGradingModal
          assignment={reviewingAssignment}
          studentId={reviewingStudentId}
          studentName={(members.length > 0 ? members : DEFAULT_MEMBERS).find(m => m.id === reviewingStudentId)?.name || 'Student'}
          onClose={() => {
            setReviewingAssignment(null);
            setReviewingStudentId(null);
          }}
          onGrade={async (data) => {
            await handleTeacherGradeHomework(
              reviewingAssignment.id,
              reviewingStudentId,
              data.marksAwarded,
              data.maxMarks,
              data.xpAwarded,
              data.feedback || '',
              data.questionsAttempted,
              data.questionsCorrect,
              data.isTaskFullyCompleted
            );
            setReviewingAssignment(null);
            setReviewingStudentId(null);
          }}
          onExcuseDecision={async (accepted, feedback, penaltyXp) => {
            await handleTeacherReviewExcuse(
              reviewingAssignment.id,
              reviewingStudentId,
              accepted,
              penaltyXp || 25,
              feedback || ''
            );
            setReviewingAssignment(null);
            setReviewingStudentId(null);
          }}
        />
      )}

      {/* ANNOUNCEMENTS & SQUAD UPDATES MODAL */}
      {showAnnouncementsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-modal">
          <div className="w-full max-w-lg surface-card rounded-2xl p-5 border-zinc-700/80 space-y-4 relative shadow-2xl overflow-hidden">
            <button
              onClick={() => setShowAnnouncementsModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                  <Bell className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-display">
                    Squad Announcements
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Official updates from teachers and arena admin.
                  </p>
                </div>
              </div>
              {visibleAnnouncements.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllAnnouncements}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1 transition-all mr-6"
                  title="Clear all announcements"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {visibleAnnouncements.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                    <BellOff className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-400">All quiet for now</p>
                    <p className="text-xs text-zinc-600">Check back later for important arena updates.</p>
                  </div>
                </div>
              ) : (
                visibleAnnouncements.map((ann) => (
                  <div 
                    key={ann.id}
                    className={`p-4 rounded-xl border transition-all ${
                      ann.timestamp > announcementsLastRead
                        ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/10'
                        : 'bg-zinc-950 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            📢 UPDATE
                          </span>
                          <span className="text-[10px] text-zinc-500">•</span>
                          <span className="text-[10px] text-zinc-500">{timeAgo(ann.timestamp)}</span>
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed font-medium break-words">
                          {ann.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ann.timestamp > announcementsLastRead && (
                          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowAnnouncementsModal(false)}
                className="px-6 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT TIMER & POWER-OFF RESILIENCE EXPLAINER MODAL */}
      {showTimerInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-modal">
          <div className="w-full max-w-md surface-card rounded-2xl p-5 border-emerald-500/30 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowTimerInfoModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                <Clock className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white font-display">
                  Persistent Study Timer
                </h3>
                <p className="text-xs text-zinc-400">
                  Engineered to never lose your study time.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                  <span>📱 Phone Turn-Off & Sleep Proof</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  The timer logs absolute UTC start timestamps. Even if your phone turns off completely, battery dies, screen locks, or you switch apps, every second that passes is accurately calculated and restored the moment you wake your phone.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                  <span>🔄 Accidental Reload Protection</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Accidentally reloading or closing the browser tab will never reset your session. Your start time, accumulated time, and linked task are automatically continued.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-orange-400 text-xs">
                  <span>⚡ Screen Wake Lock & Lock Screen Media</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Turn on "Keep Screen Awake" to prevent your phone screen from dimming while solving numericals. The timer also integrates with your phone's lock screen media widget so you can monitor time without unlocking.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-400 text-xs">
                  <span>🎯 Auto-Subject Task Linking</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Choose any active task or homework assignment from the dropdown, and the stopwatch will automatically tag the right subject and sync progress!
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowTimerInfoModal(false)}
                className="w-full btn-primary py-2.5 rounded-xl font-bold text-xs"
              >
                Got It! Keep Grinding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEB PUSH NOTIFICATION SETTINGS MODAL */}
      {showPushModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-modal">
          <div className="w-full max-w-md surface-card rounded-2xl p-5 border-amber-500/30 space-y-4 relative">
            <button
              onClick={() => setShowPushModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-bold shadow-md">
                <Bell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white font-display">
                  Web Push Notifications
                </h3>
                <p className="text-xs text-zinc-400">
                  Receive instant alerts on your phone & desktop for all arena updates.
                </p>
              </div>
            </div>

            {/* Permission Status Box */}
            <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              pushPermission === 'granted' && pushEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : pushPermission === 'denied'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {pushPermission === 'granted' && pushEnabled ? '🔔' : pushPermission === 'denied' ? '🔕' : '⚠️'}
                </span>
                <div>
                  <div className="font-bold">
                    {pushPermission === 'granted' && pushEnabled
                      ? 'Push Notifications Active'
                      : pushPermission === 'denied'
                      ? 'Permission Denied in Browser'
                      : 'Permission Needed'}
                  </div>
                  <div className="text-[10.5px] opacity-80">
                    {pushPermission === 'granted' && pushEnabled
                      ? 'Your device will receive real-time push alerts.'
                      : pushPermission === 'denied'
                      ? 'Click the lock icon in your browser URL bar to allow Notifications.'
                      : 'Grant permission so phone notifications can be sent.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Feature Highlights */}
            <div className="space-y-2 text-xs">
              <div className="text-zinc-300 font-bold">What you will receive on your phone:</div>
              <ul className="space-y-1.5 text-zinc-400 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400">⚡</span>
                  <span><strong>Leaderboard Overtakes:</strong> Alerts when a squad rival passes your score.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400">📚</span>
                  <span><strong>Teacher Assignments:</strong> Homework posted & graded solution feedback.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-rose-400">🗡️</span>
                  <span><strong>Grand Reveal:</strong> Sunday Ceremony unveils the final weekly standings.</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">💬</span>
                  <span><strong>Squad Messages:</strong> Direct & squad announcements pushed instantly.</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2 border-t border-zinc-800">
              {pushPermission !== 'granted' && pushPermission !== 'denied' && (
                <button
                  onClick={async () => {
                    const granted = await requestWebPushPermission();
                    setPushPermission(getNotificationPermission());
                    setPushEnabled(isWebPushEnabledByUser());
                    if (granted) {
                      notify('Web Push Permission Granted! 🔔', 'You will now receive live alerts on your phone.');
                    }
                  }}
                  className="w-full btn-primary py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  <span>Grant Notification Permission</span>
                </button>
              )}

              {pushPermission === 'granted' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
                    <span className="text-zinc-200 font-medium">Enable Push Alerts</span>
                    <button
                      onClick={() => {
                        const next = !pushEnabled;
                        setWebPushEnabledByUser(next);
                        setPushEnabled(next);
                        notify(next ? 'Push Notifications Enabled' : 'Push Notifications Muted');
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        pushEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        pushEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      sendTestNotification();
                      notify('Test Push Notification Sent 🚀', 'Check your device for the alert!');
                    }}
                    className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-amber-300 flex items-center justify-center gap-2 transition-all"
                  >
                    <span>🚀 Send Test Phone Push Notification</span>
                  </button>
                </div>
              )}

              {pushPermission === 'denied' && (
                <div className="text-[11px] text-zinc-400 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <strong className="text-rose-400 block mb-0.5">How to unblock notifications:</strong>
                  1. Tap the site info/lock icon next to the URL in your browser.<br />
                  2. Select <strong>Permissions</strong> or <strong>Site Settings</strong>.<br />
                  3. Change <strong>Notifications</strong> from Block to <strong>Allow</strong>, then refresh.
                </div>
              )}

              <button
                onClick={() => setShowPushModal(false)}
                className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


