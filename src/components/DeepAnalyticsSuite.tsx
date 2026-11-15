import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Clock,
  Target,
  Trophy,
  Zap,
  Flame,
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Activity,
  Swords,
  Award,
  Sparkles,
  BookOpen,
  UserCheck,
  ArrowUpRight
} from 'lucide-react';
import { CYCLE_4_START_MS } from '../services/blackoutService';

interface DeepAnalyticsSuiteProps {
  mode: 'individual' | 'telemetry' | 'cycles';
  members: any[];
  leaderboardStats: any[];
  sessions: any[];
  exams: any[];
  tasks: any[];
  currentUserId: string;
  isBlackoutActive: boolean;
  isAdminPeeking: boolean;
  selectedScholarId: string;
  onSelectScholarId: (id: string) => void;
  onOpenDossier?: (id: string) => void;
  onJumpToCompareWith?: (ids: string[]) => void;
}

type TimeframeWindow = '7d' | '14d' | '30d' | 'cycle_4' | 'cycle_3' | 'lifetime';

const CYCLE_1_START = new Date('2026-10-12T00:00:00').getTime();
const CYCLE_2_START = new Date('2026-10-19T00:00:00').getTime();
const CYCLE_3_START = new Date('2026-10-26T00:00:00').getTime();

const formatMins = (mins: number) => {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
};

const getSessionTimestampMs = (s: any): number => {
  const ts = Number(s?.timestamp);
  if (ts && ts > 0) return ts;
  if (typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
    const parsed = new Date(`${s.date}T12:00:00`).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
};

const getSessionDateKey = (s: any): string => {
  if (typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
    return s.date;
  }
  const ts = getSessionTimestampMs(s);
  if (ts > 0) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
};

function filterSessionsByWindow(allSessions: any[], scholarId: string | 'ALL', timeframe: TimeframeWindow) {
  const nowMs = Date.now();
  return (allSessions || []).filter((s) => {
    if (!s || s.sessionType === 'BREAK') return false;
    if (scholarId !== 'ALL' && s.memberId !== scholarId) return false;
    const ts = getSessionTimestampMs(s);

    if (timeframe === '7d') return ts >= nowMs - 7 * 24 * 3600 * 1000;
    if (timeframe === '14d') return ts >= nowMs - 14 * 24 * 3600 * 1000;
    if (timeframe === '30d') return ts >= nowMs - 30 * 24 * 3600 * 1000;
    if (timeframe === 'cycle_4') return ts >= CYCLE_4_START_MS;
    if (timeframe === 'cycle_3') return ts >= CYCLE_3_START && ts < CYCLE_4_START_MS;
    return true;
  });
}

function computeScholarTelemetryBundle(
  targetSessions: any[],
  allScholarSessions: any[],
  scholarExams: any[],
  statObj: any,
  divisorFactor = 1
) {
  let totalMins = 0;
  let totalSolved = 0;
  let totalAttempted = 0;
  let totalSessionXp = 0;
  let longestBlockMins = 0;

  const tierCounts = { easy: 0, mains: 0, hard: 0, adv: 0 };
  const tierAttempted = { easy: 0, mains: 0, hard: 0, adv: 0 };

  const circadian = {
    morning: { label: 'Morning Sprint (05:00 - 11:59)', short: 'Morning', mins: 0, qs: 0, xp: 0, count: 0 },
    afternoon: { label: 'Afternoon Core (12:00 - 16:59)', short: 'Afternoon', mins: 0, qs: 0, xp: 0, count: 0 },
    evening: { label: 'Evening Grind (17:00 - 21:59)', short: 'Evening', mins: 0, qs: 0, xp: 0, count: 0 },
    night: { label: 'Midnight Raider (22:00 - 04:59)', short: 'Late Night', mins: 0, qs: 0, xp: 0, count: 0 }
  };

  const endurance = {
    micro: { label: 'Short Drill (<45m)', count: 0, mins: 0 },
    standard: { label: 'Standard Block (45m - 89m)', count: 0, mins: 0 },
    deep: { label: 'Deep Focus (90m - 149m)', count: 0, mins: 0 },
    marathon: { label: 'Marathon Grind (150m+)', count: 0, mins: 0 }
  };

  const dayOfWeekStats = [
    { day: 'Sun', mins: 0, qs: 0, sessions: 0 },
    { day: 'Mon', mins: 0, qs: 0, sessions: 0 },
    { day: 'Tue', mins: 0, qs: 0, sessions: 0 },
    { day: 'Wed', mins: 0, qs: 0, sessions: 0 },
    { day: 'Thu', mins: 0, qs: 0, sessions: 0 },
    { day: 'Fri', mins: 0, qs: 0, sessions: 0 },
    { day: 'Sat', mins: 0, qs: 0, sessions: 0 }
  ];

  const bySubject: Record<
    string,
    {
      mins: number;
      solved: number;
      attempted: number;
      xp: number;
      sessions: number;
      hardAdv: number;
      easy: number;
      mains: number;
      hard: number;
      adv: number;
      avgExamPct: number;
      bestExamPct: number;
      examsCount: number;
    }
  > = {
    Physics: { mins: 0, solved: 0, attempted: 0, xp: 0, sessions: 0, hardAdv: 0, easy: 0, mains: 0, hard: 0, adv: 0, avgExamPct: 0, bestExamPct: 0, examsCount: 0 },
    Chemistry: { mins: 0, solved: 0, attempted: 0, xp: 0, sessions: 0, hardAdv: 0, easy: 0, mains: 0, hard: 0, adv: 0, avgExamPct: 0, bestExamPct: 0, examsCount: 0 },
    Math: { mins: 0, solved: 0, attempted: 0, xp: 0, sessions: 0, hardAdv: 0, easy: 0, mains: 0, hard: 0, adv: 0, avgExamPct: 0, bestExamPct: 0, examsCount: 0 }
  };

  targetSessions.forEach((s) => {
    const dur = Math.max(0, Number(s.duration) || 0);
    const solved =
      s.solvedQuestions !== undefined
        ? Math.max(0, Number(s.solvedQuestions) || 0)
        : Math.max(0, Number(s.questions) || 0);
    const att = Math.max(0, Number(s.attemptedQuestions) || 0);
    const xp = Math.max(0, Number(s.xpEarned) || 0);

    totalMins += dur;
    totalSolved += solved;
    totalAttempted += att;
    totalSessionXp += xp;
    if (dur > longestBlockMins) longestBlockMins = dur;

    let eCnt = 0;
    let mCnt = 0;
    let hCnt = 0;
    let aCnt = 0;

    if (s.difficultyBreakdown && typeof s.difficultyBreakdown === 'object') {
      eCnt = Math.max(0, Number(s.difficultyBreakdown.easy) || 0);
      mCnt = Math.max(0, Number(s.difficultyBreakdown.mains) || 0);
      hCnt = Math.max(0, Number(s.difficultyBreakdown.hard) || 0);
      aCnt = Math.max(0, Number(s.difficultyBreakdown.adv) || 0);
    } else {
      const diff = (s.difficulty || 'mains').toLowerCase();
      if (diff === 'easy') eCnt = solved;
      else if (diff === 'hard') hCnt = solved;
      else if (diff === 'adv' || diff === 'advanced') aCnt = solved;
      else mCnt = solved;
    }

    tierCounts.easy += eCnt;
    tierCounts.mains += mCnt;
    tierCounts.hard += hCnt;
    tierCounts.adv += aCnt;
    const sessionHardAdv = hCnt + aCnt;

    if (s.attemptedBreakdown && typeof s.attemptedBreakdown === 'object') {
      tierAttempted.easy += Math.max(0, Number(s.attemptedBreakdown.easy) || 0);
      tierAttempted.mains += Math.max(0, Number(s.attemptedBreakdown.mains) || 0);
      tierAttempted.hard += Math.max(0, Number(s.attemptedBreakdown.hard) || 0);
      tierAttempted.adv += Math.max(0, Number(s.attemptedBreakdown.adv) || 0);
    } else if (att > 0) {
      const diff = (s.difficulty || 'mains').toLowerCase();
      if (diff === 'easy') tierAttempted.easy += att;
      else if (diff === 'hard') tierAttempted.hard += att;
      else if (diff === 'adv' || diff === 'advanced') tierAttempted.adv += att;
      else tierAttempted.mains += att;
    }

    // Circadian & Day of week
    let hour = 14;
    const ts = getSessionTimestampMs(s);
    if (typeof s.startTime === 'string' && s.startTime.includes(':')) {
      const parsedHr = parseInt(s.startTime.split(':')[0], 10);
      if (!isNaN(parsedHr)) hour = parsedHr;
    } else if (ts > 0) {
      hour = new Date(ts).getHours();
    }

    if (ts > 0) {
      const dow = new Date(ts).getDay();
      if (dayOfWeekStats[dow]) {
        dayOfWeekStats[dow].mins += dur;
        dayOfWeekStats[dow].qs += solved;
        dayOfWeekStats[dow].sessions += 1;
      }
    }

    if (hour >= 5 && hour < 12) {
      circadian.morning.mins += dur;
      circadian.morning.qs += solved;
      circadian.morning.xp += xp;
      circadian.morning.count += 1;
    } else if (hour >= 12 && hour < 17) {
      circadian.afternoon.mins += dur;
      circadian.afternoon.qs += solved;
      circadian.afternoon.xp += xp;
      circadian.afternoon.count += 1;
    } else if (hour >= 17 && hour < 22) {
      circadian.evening.mins += dur;
      circadian.evening.qs += solved;
      circadian.evening.xp += xp;
      circadian.evening.count += 1;
    } else {
      circadian.night.mins += dur;
      circadian.night.qs += solved;
      circadian.night.xp += xp;
      circadian.night.count += 1;
    }

    if (dur < 45) {
      endurance.micro.count += 1;
      endurance.micro.mins += dur;
    } else if (dur < 90) {
      endurance.standard.count += 1;
      endurance.standard.mins += dur;
    } else if (dur < 150) {
      endurance.deep.count += 1;
      endurance.deep.mins += dur;
    } else {
      endurance.marathon.count += 1;
      endurance.marathon.mins += dur;
    }

    const subjKey =
      s.subject === 'Physics' || s.subject === 'Chemistry' || s.subject === 'Math'
        ? s.subject
        : 'Physics';
    bySubject[subjKey].mins += dur;
    bySubject[subjKey].solved += solved;
    bySubject[subjKey].attempted += att;
    bySubject[subjKey].xp += xp;
    bySubject[subjKey].sessions += 1;
    bySubject[subjKey].hardAdv += sessionHardAdv;
    bySubject[subjKey].easy += eCnt;
    bySubject[subjKey].mains += mCnt;
    bySubject[subjKey].hard += hCnt;
    bySubject[subjKey].adv += aCnt;
  });

  // Populate exam stats per subject
  (['Physics', 'Chemistry', 'Math'] as const).forEach((subj) => {
    const exSubs = (scholarExams || []).flatMap((e) =>
      (e.subjects || []).filter((es: any) => (es.name || '').toLowerCase() === subj.toLowerCase())
    );
    bySubject[subj].examsCount = exSubs.length;
    bySubject[subj].avgExamPct =
      exSubs.length > 0
        ? Math.round((exSubs.reduce((a, b: any) => a + (Number(b.percentile) || 0), 0) / exSubs.length) * 10) / 10
        : 0;
    bySubject[subj].bestExamPct =
      exSubs.length > 0
        ? Math.round(Math.max(...exSubs.map((es: any) => Number(es.percentile) || 0)) * 10) / 10
        : 0;
  });

  const normMins = Math.round(totalMins / Math.max(1, divisorFactor));
  const normSolved = Math.round(totalSolved / Math.max(1, divisorFactor));
  const normAttempted = Math.round(totalAttempted / Math.max(1, divisorFactor));
  const normSessionXp = Math.round(totalSessionXp / Math.max(1, divisorFactor));

  const totalHours = totalMins / 60;
  const questionsPerHour = totalHours > 0 ? Math.round((totalSolved / totalHours) * 10) / 10 : 0;
  const minsPerQuestion = totalSolved > 0 ? Math.round((totalMins / totalSolved) * 10) / 10 : 0;
  const xpPerHour = totalHours > 0 ? Math.round((totalSessionXp / totalHours) * 10) / 10 : 0;
  const accuracyRate =
    totalSolved + totalAttempted > 0
      ? Math.round((totalSolved / (totalSolved + totalAttempted)) * 100)
      : totalSolved > 0
      ? 100
      : 0;
  const hardAdvTotal = tierCounts.hard + tierCounts.adv;
  const rigorIndexPct = totalSolved > 0 ? Math.round((hardAdvTotal / totalSolved) * 100) : 0;
  const deepWorkSessionsCount = Math.round((endurance.deep.count + endurance.marathon.count) / Math.max(1, divisorFactor));
  const deepWorkMinsShare =
    totalMins > 0 ? Math.round(((endurance.deep.mins + endurance.marathon.mins) / totalMins) * 100) : 0;

  // 28-day & 14-day daily series
  const dailySeries28: Array<{
    dateKey: string;
    shortDate: string;
    dayLabel: string;
    isWeekend: boolean;
    mins: number;
    questions: number;
    xp: number;
    physicsMins: number;
    chemMins: number;
    mathMins: number;
  }> = [];

  const baseNow = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(baseNow.getFullYear(), baseNow.getMonth(), baseNow.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;
    const dayIdx = d.getDay();
    const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIdx];

    const daySessions = (allScholarSessions || []).filter((s) => {
      if (!s || s.sessionType === 'BREAK') return false;
      return getSessionDateKey(s) === key;
    });

    const dMins = Math.round(daySessions.reduce((a, b) => a + (Number(b.duration) || 0), 0) / Math.max(1, divisorFactor));
    const dQs = Math.round(
      daySessions.reduce(
        (a, b) =>
          a + (b.solvedQuestions !== undefined ? Number(b.solvedQuestions) : Number(b.questions) || 0),
        0
      ) / Math.max(1, divisorFactor)
    );
    const dXp = Math.round(daySessions.reduce((a, b) => a + (Number(b.xpEarned) || 0), 0) / Math.max(1, divisorFactor));
    const pMins = Math.round(
      daySessions
        .filter((s) => s.subject === 'Physics')
        .reduce((a, b) => a + (Number(b.duration) || 0), 0) / Math.max(1, divisorFactor)
    );
    const cMins = Math.round(
      daySessions
        .filter((s) => s.subject === 'Chemistry')
        .reduce((a, b) => a + (Number(b.duration) || 0), 0) / Math.max(1, divisorFactor)
    );
    const mMins = Math.round(
      daySessions
        .filter((s) => s.subject === 'Math')
        .reduce((a, b) => a + (Number(b.duration) || 0), 0) / Math.max(1, divisorFactor)
    );

    dailySeries28.push({
      dateKey: key,
      shortDate,
      dayLabel,
      isWeekend: dayIdx === 0 || dayIdx === 6,
      mins: dMins,
      questions: dQs,
      xp: dXp,
      physicsMins: pMins,
      chemMins: cMins,
      mathMins: mMins
    });
  }

  const dailySeries = dailySeries28.slice(-14);
  const activeDaysLast14 = dailySeries.filter((d) => d.mins > 0).length;
  const activeDaysLast28 = dailySeries28.filter((d) => d.mins > 0).length;
  const peakDay = [...dailySeries28].sort((a, b) => b.mins - a.mins)[0] || null;

  const weekdayDays = dailySeries28.filter((d) => !d.isWeekend);
  const weekendDays = dailySeries28.filter((d) => d.isWeekend);
  const avgWeekdayMins =
    weekdayDays.length > 0
      ? Math.round(weekdayDays.reduce((a, b) => a + b.mins, 0) / weekdayDays.length)
      : 0;
  const avgWeekendMins =
    weekendDays.length > 0
      ? Math.round(weekendDays.reduce((a, b) => a + b.mins, 0) / weekendDays.length)
      : 0;

  const circadianEntries = Object.entries(circadian).map(([key, val]) => ({
    key,
    ...val,
    mins: Math.round(val.mins / Math.max(1, divisorFactor)),
    qs: Math.round(val.qs / Math.max(1, divisorFactor)),
    xp: Math.round(val.xp / Math.max(1, divisorFactor)),
    count: Math.round(val.count / Math.max(1, divisorFactor)),
    qPerHr: val.mins > 0 ? Math.round((val.qs / (val.mins / 60)) * 10) / 10 : 0
  }));
  const peakCircadian =
    [...circadianEntries].sort((a, b) => b.mins - a.mins)[0] || circadianEntries[0];

  const avgExamPercentile =
    scholarExams.length > 0
      ? Math.round(
          (scholarExams.reduce((a, b) => a + (Number(b.overallPercentile) || 0), 0) / scholarExams.length) * 10
        ) / 10
      : Number(statObj?.allTimeAvgPercentile || statObj?.weekAvgPercentile) || 0;

  const peakExamPercentile =
    scholarExams.length > 0
      ? Math.round(Math.max(...scholarExams.map((e) => Number(e.overallPercentile) || 0)) * 10) / 10
      : avgExamPercentile;

  // 6-Axis Radar Scores (Normalized 0 to 100)
  const radar = {
    volume: Math.min(100, Math.round((normMins / 1800) * 100)), // 30h benchmark = 100
    speed: Math.min(100, Math.round((questionsPerHour / 22) * 100)), // 22 Qs/hr = 100
    accuracy: Math.min(100, Math.max(0, accuracyRate)),
    rigor: Math.min(100, Math.round((rigorIndexPct / 45) * 100)), // 45% Hard/Adv share = 100
    mockStanding: Math.min(100, Math.round(avgExamPercentile)),
    consistency: Math.min(100, Math.round(((activeDaysLast14 / 14) * 65) + ((deepWorkMinsShare / 100) * 35)))
  };

  return {
    totalMins: normMins,
    totalSolved: normSolved,
    totalAttempted: normAttempted,
    totalSessionXp: normSessionXp,
    longestBlockMins,
    sessionsCount: Math.round(targetSessions.length / Math.max(1, divisorFactor)),
    questionsPerHour,
    minsPerQuestion,
    xpPerHour,
    accuracyRate,
    rigorIndexPct,
    hardAdvTotal: Math.round(hardAdvTotal / Math.max(1, divisorFactor)),
    deepWorkSessionsCount,
    deepWorkMinsShare,
    tierCounts: {
      easy: Math.round(tierCounts.easy / Math.max(1, divisorFactor)),
      mains: Math.round(tierCounts.mains / Math.max(1, divisorFactor)),
      hard: Math.round(tierCounts.hard / Math.max(1, divisorFactor)),
      adv: Math.round(tierCounts.adv / Math.max(1, divisorFactor))
    },
    tierAttempted,
    circadianEntries,
    peakCircadian,
    endurance,
    dayOfWeekStats: dayOfWeekStats.map((d) => ({
      ...d,
      mins: Math.round(d.mins / Math.max(1, divisorFactor)),
      qs: Math.round(d.qs / Math.max(1, divisorFactor))
    })),
    bySubject: {
      Physics: {
        ...bySubject.Physics,
        mins: Math.round(bySubject.Physics.mins / Math.max(1, divisorFactor)),
        solved: Math.round(bySubject.Physics.solved / Math.max(1, divisorFactor)),
        xp: Math.round(bySubject.Physics.xp / Math.max(1, divisorFactor)),
        hardAdv: Math.round(bySubject.Physics.hardAdv / Math.max(1, divisorFactor))
      },
      Chemistry: {
        ...bySubject.Chemistry,
        mins: Math.round(bySubject.Chemistry.mins / Math.max(1, divisorFactor)),
        solved: Math.round(bySubject.Chemistry.solved / Math.max(1, divisorFactor)),
        xp: Math.round(bySubject.Chemistry.xp / Math.max(1, divisorFactor)),
        hardAdv: Math.round(bySubject.Chemistry.hardAdv / Math.max(1, divisorFactor))
      },
      Math: {
        ...bySubject.Math,
        mins: Math.round(bySubject.Math.mins / Math.max(1, divisorFactor)),
        solved: Math.round(bySubject.Math.solved / Math.max(1, divisorFactor)),
        xp: Math.round(bySubject.Math.xp / Math.max(1, divisorFactor)),
        hardAdv: Math.round(bySubject.Math.hardAdv / Math.max(1, divisorFactor))
      }
    },
    dailySeries,
    dailySeries28,
    activeDaysLast14,
    activeDaysLast28,
    avgWeekdayMins,
    avgWeekendMins,
    peakDay,
    avgExamPercentile,
    peakExamPercentile,
    examsCount: scholarExams.length,
    radar
  };
}

export const DeepAnalyticsSuite: React.FC<DeepAnalyticsSuiteProps> = ({
  mode,
  members = [],
  leaderboardStats = [],
  sessions = [],
  exams = [],
  tasks = [],
  currentUserId,
  isBlackoutActive,
  isAdminPeeking,
  selectedScholarId,
  onSelectScholarId,
  onOpenDossier,
  onJumpToCompareWith
}) => {
  const [timeframe, setTimeframe] = useState<TimeframeWindow>('lifetime');
  const [selectedDailyBarKey, setSelectedDailyBarKey] = useState<string | null>(null);
  const [cycleComparisonMetric, setCycleComparisonMetric] = useState<'xp' | 'mins' | 'questions' | 'examXp'>('xp');
  const [roiSubjectFilter, setRoiSubjectFilter] = useState<'Overall' | 'Physics' | 'Chemistry' | 'Math'>('Overall');
  const [compareTargetId, setCompareTargetId] = useState<string>('SQUAD_AVG');
  const [whatIfDailyHours, setWhatIfDailyHours] = useState<number>(4.5);
  const [whatIfQuestionsPerDay, setWhatIfQuestionsPerDay] = useState<number>(45);

  const canViewAll = !isBlackoutActive || isAdminPeeking;

  // For individual mode, ensure a specific scholar is always selected (never 'ALL')
  const defaultIndividualId =
    selectedScholarId && selectedScholarId !== 'ALL'
      ? selectedScholarId
      : currentUserId && currentUserId !== 'admin'
      ? currentUserId
      : members[0]?.id || 'utham_940';

  const effectiveScholarId =
    !canViewAll
      ? (currentUserId && currentUserId !== 'admin' && currentUserId !== 'guest'
          ? currentUserId
          : defaultIndividualId)
      : mode === 'individual'
      ? defaultIndividualId
      : selectedScholarId;

  // Filter sessions by selected scholar (or 'ALL' squad aggregate if allowed) and timeframe
  const filteredSessions = useMemo(
    () => filterSessionsByWindow(sessions, effectiveScholarId, timeframe),
    [sessions, effectiveScholarId, timeframe]
  );

  const scholarAllTimeSessions = useMemo(
    () =>
      (sessions || []).filter(
        (s) =>
          s &&
          s.sessionType !== 'BREAK' &&
          (effectiveScholarId === 'ALL' || s.memberId === effectiveScholarId)
      ),
    [sessions, effectiveScholarId]
  );

  const scholarExams = useMemo(
    () =>
      (exams || []).filter(
        (e) => e && (effectiveScholarId === 'ALL' || e.memberId === effectiveScholarId)
      ),
    [exams, effectiveScholarId]
  );

  const selectedScholarStat = useMemo(
    () => leaderboardStats.find((s) => s.id === effectiveScholarId) || leaderboardStats[0],
    [leaderboardStats, effectiveScholarId]
  );

  // Core behavioral & question efficiency telemetry for the primary selection
  const telemetryData = useMemo(
    () =>
      computeScholarTelemetryBundle(
        filteredSessions,
        scholarAllTimeSessions,
        scholarExams,
        selectedScholarStat,
        1
      ),
    [filteredSessions, scholarAllTimeSessions, scholarExams, selectedScholarStat]
  );

  // Comparison Target Bundle (either Squad Average or a Specific Rival Scholar)
  const comparisonBundle = useMemo(() => {
    const activeMembersCount = Math.max(1, members.length || 7);
    if (!canViewAll) {
      return {
        id: 'PERSONAL_BASELINE',
        name: 'Your Personal Baseline',
        institute: selectedScholarStat?.institute || 'Personal',
        stat: {
          weeklyXp: Number(selectedScholarStat?.weeklyXp) || 0,
          cycle3Xp: Number(selectedScholarStat?.cycle3Xp) || 0,
          cycle2Xp: Number(selectedScholarStat?.cycle2Xp) || 0,
          prevWeeklyXp: Number(selectedScholarStat?.prevWeeklyXp) || 0,
          totalXp: Number(selectedScholarStat?.totalXp) || 0
        },
        telemetry: telemetryData
      };
    }
    if (compareTargetId === 'SQUAD_AVG') {
      const allWindowSessions = filterSessionsByWindow(sessions, 'ALL', timeframe);
      const allLifetimeSessions = (sessions || []).filter((s) => s && s.sessionType !== 'BREAK');
      return {
        id: 'SQUAD_AVG',
        name: 'Squad Average',
        institute: 'All Scholars',
        stat: {
          weeklyXp: Math.round(
            leaderboardStats.reduce((a, b) => a + (Number(b.weeklyXp) || 0), 0) / activeMembersCount
          ),
          cycle3Xp: Math.round(
            leaderboardStats.reduce((a, b) => a + (Number(b.cycle3Xp) || 0), 0) / activeMembersCount
          ),
          cycle2Xp: Math.round(
            leaderboardStats.reduce((a, b) => a + (Number(b.cycle2Xp) || 0), 0) / activeMembersCount
          ),
          prevWeeklyXp: Math.round(
            leaderboardStats.reduce((a, b) => a + (Number(b.prevWeeklyXp) || 0), 0) / activeMembersCount
          ),
          totalXp: Math.round(
            leaderboardStats.reduce((a, b) => a + (Number(b.totalXp) || 0), 0) / activeMembersCount
          )
        },
        telemetry: computeScholarTelemetryBundle(
          allWindowSessions,
          allLifetimeSessions,
          exams || [],
          null,
          activeMembersCount
        )
      };
    }

    const rivalMem = members.find((m) => m.id === compareTargetId) || members[0];
    const rivalStat = leaderboardStats.find((s) => s.id === rivalMem?.id) || leaderboardStats[0];
    const rivalWindowSessions = filterSessionsByWindow(sessions, rivalMem?.id || '', timeframe);
    const rivalLifetimeSessions = (sessions || []).filter(
      (s) => s && s.sessionType !== 'BREAK' && s.memberId === rivalMem?.id
    );
    const rivalExams = (exams || []).filter((e) => e && e.memberId === rivalMem?.id);

    return {
      id: rivalMem?.id || 'rival',
      name: rivalMem?.name || 'Rival',
      institute: rivalMem?.institute || 'Squad',
      stat: rivalStat,
      telemetry: computeScholarTelemetryBundle(
        rivalWindowSessions,
        rivalLifetimeSessions,
        rivalExams,
        rivalStat,
        1
      )
    };
  }, [canViewAll, compareTargetId, members, leaderboardStats, sessions, exams, timeframe]);

  // Cycle-Over-Cycle & Study-to-Exam ROI Matrix Data
  const cycleAndRoiData = useMemo(() => {
    const visibleMembers = canViewAll
      ? leaderboardStats
      : leaderboardStats.filter((m) => m.id === currentUserId);

    const scholarRows = visibleMembers.map((stat) => {
      const memSessions = (sessions || []).filter(
        (s) => s && s.memberId === stat.id && s.sessionType !== 'BREAK'
      );
      const memExams = (exams || []).filter((e) => e && e.memberId === stat.id);

      const c1 = {
        xp: Number(stat.prevWeeklyXp) || 0,
        mins: Number(stat.prevWeekStudyMins) || 0,
        questions: Number(stat.prevWeekQuestions) || 0,
        examXp: Number(stat.prevWeekExamXp) || 0
      };
      const c2 = {
        xp: Number(stat.cycle2Xp) || 0,
        mins: Number(stat.cycle2StudyMins) || 0,
        questions: Number(stat.cycle2Questions) || 0,
        examXp: Number(stat.cycle2ExamXp) || 0
      };
      const c3 = {
        xp: Number(stat.cycle3Xp) || 0,
        mins: Number(stat.cycle3StudyMins) || 0,
        questions: Number(stat.cycle3Questions) || 0,
        examXp: Number(stat.cycle3ExamXp) || 0
      };
      const c4 = {
        xp: Number(stat.weeklyXp) || 0,
        mins: Number(stat.weekStudyMins) || 0,
        questions: Number(stat.weekQuestions) || 0,
        examXp: Number(stat.examXpWeek) || 0
      };

      const subjectRoi: Record<
        string,
        { mins: number; hours: number; questions: number; avgPct: number; bestPct: number; testsCount: number; qPerHr: number }
      > = {};

      (['Physics', 'Chemistry', 'Math'] as const).forEach((subj) => {
        const sLogs = memSessions.filter((s) => s.subject === subj);
        const sMins = sLogs.reduce((a, b) => a + (Number(b.duration) || 0), 0);
        const sQs = sLogs.reduce(
          (a, b) =>
            a + (b.solvedQuestions !== undefined ? Number(b.solvedQuestions) : Number(b.questions) || 0),
          0
        );
        const exEntries = memExams.flatMap((e) =>
          (e.subjects || []).filter((es: any) => es.name === subj)
        );
        const avgPct =
          exEntries.length > 0
            ? exEntries.reduce((a, b: any) => a + (Number(b.percentile) || 0), 0) / exEntries.length
            : 0;
        const bestPct =
          exEntries.length > 0
            ? Math.max(...exEntries.map((es: any) => Number(es.percentile) || 0))
            : 0;
        subjectRoi[subj] = {
          mins: sMins,
          hours: Math.round((sMins / 60) * 10) / 10,
          questions: sQs,
          avgPct,
          bestPct,
          testsCount: exEntries.length,
          qPerHr: sMins > 0 ? Math.round((sQs / (sMins / 60)) * 10) / 10 : 0
        };
      });

      const overallPcts = memExams.map((e) => Number(e.overallPercentile) || 0);
      const avgOverallPct =
        overallPcts.length > 0
          ? overallPcts.reduce((a, b) => a + b, 0) / overallPcts.length
          : 0;
      const variance =
        overallPcts.length > 1
          ? overallPcts.reduce((acc, v) => acc + Math.pow(v - avgOverallPct, 2), 0) / overallPcts.length
          : 0;
      const stdDevPct = Math.round(Math.sqrt(variance) * 10) / 10;

      const avgMarksPct =
        memExams.length > 0
          ? Math.round(
              (memExams.reduce(
                (acc, e) =>
                  acc +
                  ((Number(e.overallMarks) || 0) / Math.max(1, Number(e.overallMaxMarks) || 300)) *
                    100,
                0
              ) /
                memExams.length) *
                10
            ) / 10
          : 0;

      const totalSessionXp = memSessions.reduce((a, b) => a + (Number(b.xpEarned) || 0), 0);
      const durationXpEstimate = Math.round(((Number(stat.totalStudyMins) || 0) / 30) * 10);
      const questionXpEstimate = Math.max(0, totalSessionXp - durationXpEstimate);
      const examXpContribution = Math.round((Number(stat.allTimeAvgPercentile) || 0) * 3);
      const taskAndBonusXp = Math.max(
        0,
        (Number(stat.totalXp) || 0) - totalSessionXp - examXpContribution
      );

      return {
        id: stat.id,
        name: stat.name,
        institute: stat.institute,
        totalXp: Number(stat.totalXp) || 0,
        totalStudyMins: Number(stat.totalStudyMins) || 0,
        totalQuestions: Number(stat.totalQuestions) || 0,
        examsCount: memExams.length,
        avgOverallPct,
        stdDevPct,
        avgMarksPct,
        c1,
        c2,
        c3,
        c4,
        subjectRoi,
        attribution: {
          durationXp: durationXpEstimate,
          questionXp: questionXpEstimate,
          examXp: examXpContribution,
          taskAndBonusXp
        }
      };
    });

    return scholarRows;
  }, [leaderboardStats, sessions, exams, canViewAll, currentUserId]);

  // ============================================================================
  // MODE 0: DEDICATED INDIVIDUAL STUDENT COMMAND DASHBOARD (WITH HEAD-TO-HEAD COMPARE)
  // ============================================================================
  if (mode === 'individual') {
    const activeMemberObj =
      members.find((m) => m.id === effectiveScholarId) ||
      leaderboardStats.find((s) => s.id === effectiveScholarId) ||
      members[0];

    const sortedByCareerXp = [...leaderboardStats].sort(
      (a, b) => (Number(b.totalXp) || 0) - (Number(a.totalXp) || 0)
    );
    const careerRank = Math.max(1, sortedByCareerXp.findIndex((s) => s.id === effectiveScholarId) + 1);

    const sortedByCycle3 = [...leaderboardStats].sort(
      (a, b) => (Number(b.cycle3Xp) || 0) - (Number(a.cycle3Xp) || 0)
    );
    const cycle3Rank = Math.max(1, sortedByCycle3.findIndex((s) => s.id === effectiveScholarId) + 1);

    const sortedByActiveSprint = [...leaderboardStats].sort(
      (a, b) => (Number(b.displayXp) || 0) - (Number(a.displayXp) || 0)
    );
    const currentRankIdx = sortedByActiveSprint.findIndex((s) => s.id === effectiveScholarId);
    const currentSprintRank = currentRankIdx >= 0 ? currentRankIdx + 1 : 1;
    const nextRankAboveScholar =
      currentRankIdx > 0 ? sortedByActiveSprint[currentRankIdx - 1] : null;
    const rank1Scholar = sortedByActiveSprint[0] || null;

    const myDisplayXp = Number(selectedScholarStat?.displayXp || selectedScholarStat?.weeklyXp) || 0;
    const xpGapToNextRank = nextRankAboveScholar
      ? Math.max(1, Math.round((Number(nextRankAboveScholar.displayXp) || 0) - myDisplayXp + 1))
      : 0;
    const xpGapToFirst =
      rank1Scholar && rank1Scholar.id !== effectiveScholarId
        ? Math.max(1, Math.round((Number(rank1Scholar.displayXp) || 0) - myDisplayXp + 1))
        : 0;

    // SVG 6-Axis Radar Coordinates
    const radarAxes = [
      { key: 'volume' as const, label: 'Study Volume', angle: -90 },
      { key: 'speed' as const, label: 'Solve Speed', angle: -30 },
      { key: 'accuracy' as const, label: 'Accuracy %', angle: 30 },
      { key: 'rigor' as const, label: 'Hard/Adv Rigor', angle: 90 },
      { key: 'mockStanding' as const, label: 'Mock %ile', angle: 150 },
      { key: 'consistency' as const, label: 'Consistency', angle: 210 }
    ];
    const rCx = 140;
    const rCy = 135;
    const rMax = 88;

    const buildPolygonPoints = (rObj: typeof telemetryData.radar) =>
      radarAxes
        .map((ax) => {
          const val = Math.max(8, Math.min(100, rObj[ax.key] || 0));
          const rad = (ax.angle * Math.PI) / 180;
          const x = rCx + (val / 100) * rMax * Math.cos(rad);
          const y = rCy + (val / 100) * rMax * Math.sin(rad);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    const myPolygon = buildPolygonPoints(telemetryData.radar);
    const compPolygon = buildPolygonPoints(comparisonBundle.telemetry.radar);

    // Compute Automated Coaching Prescriptions for this Scholar
    const subjEntries = (['Physics', 'Chemistry', 'Math'] as const).map((s) => ({
      name: s,
      ...telemetryData.bySubject[s],
      sharePct:
        telemetryData.totalMins > 0
          ? Math.round((telemetryData.bySubject[s].mins / telemetryData.totalMins) * 100)
          : 33
    }));
    const strongestSubj = [...subjEntries].sort(
      (a, b) => b.mins + b.solved * 3 - (a.mins + a.solved * 3)
    )[0];
    const weakestSubj = [...subjEntries].sort(
      (a, b) => a.mins + a.solved * 3 - (b.mins + b.solved * 3)
    )[0];

    const inspectedDay =
      telemetryData.dailySeries28.find((d) => d.dateKey === selectedDailyBarKey) ||
      telemetryData.dailySeries28[telemetryData.dailySeries28.length - 1];

    // 14-Metric Head-to-Head Tale of the Tape
    const headToHeadRows = [
      {
        label: 'Study Volume (Selected Window)',
        myVal: telemetryData.totalMins,
        compVal: comparisonBundle.telemetry.totalMins,
        format: (v: number) => formatMins(v)
      },
      {
        label: 'Questions Solved',
        myVal: telemetryData.totalSolved,
        compVal: comparisonBundle.telemetry.totalSolved,
        format: (v: number) => `${v.toLocaleString()} Qs`
      },
      {
        label: 'Solving Velocity (Qs / Hour)',
        myVal: telemetryData.questionsPerHour,
        compVal: comparisonBundle.telemetry.questionsPerHour,
        format: (v: number) => `${v} Qs/hr`
      },
      {
        label: 'First-Pass Accuracy Rate',
        myVal: telemetryData.accuracyRate,
        compVal: comparisonBundle.telemetry.accuracyRate,
        format: (v: number) => `${v}%`
      },
      {
        label: 'Hard + JEE Advanced Questions',
        myVal: telemetryData.hardAdvTotal,
        compVal: comparisonBundle.telemetry.hardAdvTotal,
        format: (v: number) => `${v} Qs (${telemetryData.rigorIndexPct}%)`
      },
      {
        label: 'Deep Work Share (90m+ Blocks)',
        myVal: telemetryData.deepWorkMinsShare,
        compVal: comparisonBundle.telemetry.deepWorkMinsShare,
        format: (v: number) => `${v}%`
      },
      {
        label: 'Physics Study Volume',
        myVal: telemetryData.bySubject.Physics.mins,
        compVal: comparisonBundle.telemetry.bySubject.Physics.mins,
        format: (v: number) => formatMins(v)
      },
      {
        label: 'Chemistry Study Volume',
        myVal: telemetryData.bySubject.Chemistry.mins,
        compVal: comparisonBundle.telemetry.bySubject.Chemistry.mins,
        format: (v: number) => formatMins(v)
      },
      {
        label: 'Mathematics Study Volume',
        myVal: telemetryData.bySubject.Math.mins,
        compVal: comparisonBundle.telemetry.bySubject.Math.mins,
        format: (v: number) => formatMins(v)
      },
      {
        label: 'Normalized Mock Exam %ile',
        myVal: telemetryData.avgExamPercentile,
        compVal: comparisonBundle.telemetry.avgExamPercentile,
        format: (v: number) => (v > 0 ? `${v.toFixed(1)}%ile` : 'No Mocks')
      },
      {
        label: 'Week 3 (Blackout Reckoning) XP',
        myVal: Number(selectedScholarStat?.cycle3Xp) || 0,
        compVal: Number(comparisonBundle.stat?.cycle3Xp) || 0,
        format: (v: number) => `${v.toLocaleString()} XP`
      },
      {
        label: 'Week 2 (Shadow Heist) XP',
        myVal: Number(selectedScholarStat?.cycle2Xp) || 0,
        compVal: Number(comparisonBundle.stat?.cycle2Xp) || 0,
        format: (v: number) => `${v.toLocaleString()} XP`
      },
      {
        label: 'Week 1 (Kickoff) XP',
        myVal: Number(selectedScholarStat?.prevWeeklyXp) || 0,
        compVal: Number(comparisonBundle.stat?.prevWeeklyXp) || 0,
        format: (v: number) => `${v.toLocaleString()} XP`
      },
      {
        label: 'Cumulative All-Time Career XP',
        myVal: Number(selectedScholarStat?.totalXp) || 0,
        compVal: Number(comparisonBundle.stat?.totalXp) || 0,
        format: (v: number) => `${v.toLocaleString()} XP`
      }
    ];

    const myWinsCount = headToHeadRows.filter((r) => r.myVal > r.compVal).length;
    const compWinsCount = headToHeadRows.filter((r) => r.compVal > r.myVal).length;

    const maxDowMins = Math.max(30, ...telemetryData.dayOfWeekStats.map((d) => d.mins));

    return (
      <div className="space-y-5 animate-view">
        {/* TOP INDIVIDUAL SCHOLAR SELECTOR + TIMEFRAME + RIVAL COMPARISON BAR */}
        <div className="surface-card rounded-3xl p-4 sm:p-5 border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Individual Scholar Command Dashboard
                </span>
                <span className="text-[11px] text-slate-400">
                  Select any scholar below for their complete 360° telemetry &amp; head-to-head rival benchmarks
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white font-display flex items-center gap-2">
                <span>{activeMemberObj?.name || 'Scholar'}&apos;s Personal Performance Hub</span>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-sky-300 font-mono-num">
                  {activeMemberObj?.institute || 'Modulus'} • Career #{careerRank} • Week 3 #{cycle3Rank}
                </span>
              </h3>
            </div>

            {/* Timeframe Window Switcher */}
            <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 self-start lg:self-auto">
              {([
                { id: '7d' as const, label: '7D' },
                { id: '14d' as const, label: '14D' },
                { id: '30d' as const, label: '30D' },
                { id: 'cycle_4' as const, label: 'Week 4 (Live)' },
                { id: 'cycle_3' as const, label: 'Week 3' },
                { id: 'lifetime' as const, label: 'All-Time Career' }
              ]).map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    timeframe === tf.id
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Student Avatar Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {members.map((m) => {
              const mStat = leaderboardStats.find((s) => s.id === m.id);
              const locked = !canViewAll && m.id !== currentUserId;
              const isSelected = effectiveScholarId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    onSelectScholarId(m.id);
                    if (compareTargetId === m.id) {
                      setCompareTargetId('SQUAD_AVG');
                    }
                  }}
                  className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                    locked
                      ? 'bg-zinc-950/60 border-zinc-900 opacity-50 cursor-not-allowed'
                      : isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg cursor-pointer'
                      : 'bg-zinc-900/90 text-white border-zinc-800 hover:border-zinc-600 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                        isSelected ? 'bg-slate-950 text-amber-400' : 'bg-zinc-800 text-amber-300'
                      }`}
                    >
                      {(m.name || m.id || 'S')[0]}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono-num font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-slate-950/15 text-slate-950' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {m.institute}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-extrabold truncate">{m.name}</div>
                    <div
                      className={`text-[10px] font-mono-num ${
                        isSelected ? 'text-slate-900 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {locked
                        ? 'Sealed'
                        : `${formatMins(Number(mStat?.totalStudyMins) || 0)} • ${
                            Number(mStat?.totalXp) || 0
                          } XP`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compare Against Bar + Quick Actions */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 mr-1">
                <Swords className="w-3.5 h-3.5" />
                <span>Compare {activeMemberObj?.name} Against:</span>
              </span>
              <button
                type="button"
                onClick={() => setCompareTargetId('SQUAD_AVG')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  compareTargetId === 'SQUAD_AVG'
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                    : 'bg-zinc-900 text-slate-300 border-zinc-800 hover:text-white'
                }`}
              >
                Squad Average
              </button>
              {canViewAll &&
                members
                  .filter((m) => m.id !== effectiveScholarId)
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCompareTargetId(m.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        compareTargetId === m.id
                          ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                          : 'bg-zinc-900 text-slate-300 border-zinc-800 hover:text-white'
                      }`}
                    >
                      vs. {m.name}
                    </button>
                  ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onJumpToCompareWith && canViewAll && (
                <button
                  type="button"
                  onClick={() => {
                    const targetIds =
                      compareTargetId !== 'SQUAD_AVG'
                        ? [effectiveScholarId, compareTargetId]
                        : [
                            effectiveScholarId,
                            members.find((m) => m.id !== effectiveScholarId)?.id || 'ved'
                          ];
                    onJumpToCompareWith(targetIds);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Multi-Scholar Matrix</span>
                </button>
              )}
              {onOpenDossier && (
                <button
                  type="button"
                  onClick={() => onOpenDossier(effectiveScholarId)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-300" />
                  <span>Full Dossier Modal</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 8-CARD PERSONAL EXECUTIVE TELEMETRY STRIP (WITH RIVAL / SQUAD COMPARISON DELTAS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              title: 'Study Volume',
              value: formatMins(telemetryData.totalMins),
              sub: `${telemetryData.sessionsCount} blocks • Longest: ${formatMins(telemetryData.longestBlockMins)}`,
              delta: telemetryData.totalMins - comparisonBundle.telemetry.totalMins,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : '-'}${formatMins(Math.abs(d))} vs ${comparisonBundle.name}`,
              accent: 'text-white'
            },
            {
              title: 'Questions Solved',
              value: `${telemetryData.totalSolved.toLocaleString()} Qs`,
              sub: `${telemetryData.questionsPerHour} Qs/hr (${telemetryData.minsPerQuestion}m/Q)`,
              delta: telemetryData.totalSolved - comparisonBundle.telemetry.totalSolved,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d} Qs vs ${comparisonBundle.name}`,
              accent: 'text-sky-300'
            },
            {
              title: 'First-Pass Accuracy',
              value: `${telemetryData.accuracyRate}%`,
              sub: `${telemetryData.totalSolved} solved • ${telemetryData.totalAttempted} unsolved`,
              delta: telemetryData.accuracyRate - comparisonBundle.telemetry.accuracyRate,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d}% vs ${comparisonBundle.name}`,
              accent: 'text-emerald-400'
            },
            {
              title: 'Hard + JEE Adv Rigor',
              value: `${telemetryData.rigorIndexPct}% (${telemetryData.hardAdvTotal} Qs)`,
              sub: `${telemetryData.tierCounts.adv} Adv • ${telemetryData.tierCounts.hard} Hard`,
              delta: telemetryData.hardAdvTotal - comparisonBundle.telemetry.hardAdvTotal,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d} Hard/Adv Qs vs ${comparisonBundle.name}`,
              accent: 'text-amber-300'
            },
            {
              title: 'Deep Focus (90m+ Blocks)',
              value: `${telemetryData.deepWorkMinsShare}%`,
              sub: `${telemetryData.deepWorkSessionsCount} deep/marathon blocks`,
              delta: telemetryData.deepWorkMinsShare - comparisonBundle.telemetry.deepWorkMinsShare,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d}% share vs ${comparisonBundle.name}`,
              accent: 'text-violet-300'
            },
            {
              title: 'Mock Exam Standing',
              value:
                telemetryData.avgExamPercentile > 0
                  ? `${telemetryData.avgExamPercentile.toFixed(1)}%ile`
                  : 'No Mocks',
              sub: `Peak: ${
                telemetryData.peakExamPercentile > 0
                  ? `${telemetryData.peakExamPercentile.toFixed(1)}%ile`
                  : '-'
              } (${telemetryData.examsCount} tests)`,
              delta:
                Math.round((telemetryData.avgExamPercentile - comparisonBundle.telemetry.avgExamPercentile) * 10) /
                10,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}%ile vs ${comparisonBundle.name}`,
              accent: 'text-amber-400'
            },
            {
              title: 'Consistency & Rhythm',
              value: `${telemetryData.activeDaysLast14}/14 Days`,
              sub: `Weekday: ${formatMins(telemetryData.avgWeekdayMins)}/d • Wknd: ${formatMins(telemetryData.avgWeekendMins)}/d`,
              delta: telemetryData.activeDaysLast14 - comparisonBundle.telemetry.activeDaysLast14,
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d} active days vs ${comparisonBundle.name}`,
              accent: 'text-emerald-300'
            },
            {
              title: 'Career & Cycle XP',
              value: `${(Number(selectedScholarStat?.totalXp) || 0).toLocaleString()} XP`,
              sub: `W3: ${selectedScholarStat?.cycle3Xp || 0} • W2: ${selectedScholarStat?.cycle2Xp || 0} • W1: ${selectedScholarStat?.prevWeeklyXp || 0}`,
              delta:
                (Number(selectedScholarStat?.totalXp) || 0) -
                (Number(comparisonBundle.stat?.totalXp) || 0),
              deltaFmt: (d: number) => `${d >= 0 ? '+' : ''}${d} Career XP vs ${comparisonBundle.name}`,
              accent: 'text-sky-400'
            }
          ].map((card, i) => (
            <div
              key={i}
              className="surface-card rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between gap-1.5"
            >
              <div>
                <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
                  {card.title}
                </span>
                <div className={`text-lg sm:text-xl font-black font-mono-num mt-0.5 ${card.accent}`}>
                  {card.value}
                </div>
                <div className="text-[10.5px] text-slate-400 font-mono-num mt-0.5">{card.sub}</div>
              </div>
              <div
                className={`text-[10px] font-mono-num font-bold pt-1.5 border-t border-white/[0.06] ${
                  card.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {card.deltaFmt(card.delta)}
              </div>
            </div>
          ))}
        </div>

        {/* 6-AXIS MASTERY RADAR OVERLAY + PERSONAL COACHING DIAGNOSTICS & TARGET PACE CALCULATOR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: 6-Axis SVG Mastery Radar with Rival / Squad Overlay */}
          <div className="lg:col-span-5 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  6-Axis JEE Mastery Radar
                </h3>
                <p className="text-xs text-slate-400">
                  {activeMemberObj?.name} (Amber) overlaid against {comparisonBundle.name} (Emerald).
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                  {activeMemberObj?.name}
                </span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                  {comparisonBundle.name}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center bg-zinc-950 rounded-2xl border border-zinc-800/80 py-2">
              <svg viewBox="0 0 280 270" className="w-full max-w-[290px] h-64 select-none">
                {/* Concentric Hexagons */}
                {[25, 50, 75, 100].map((lvl) => {
                  const pts = radarAxes
                    .map((ax) => {
                      const rad = (ax.angle * Math.PI) / 180;
                      const x = rCx + (lvl / 100) * rMax * Math.cos(rad);
                      const y = rCy + (lvl / 100) * rMax * Math.sin(rad);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polygon
                      key={lvl}
                      points={pts}
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="1"
                      strokeDasharray={lvl === 100 ? undefined : '2 2'}
                    />
                  );
                })}

                {/* Axis Spokes & Labels */}
                {radarAxes.map((ax) => {
                  const rad = (ax.angle * Math.PI) / 180;
                  const x2 = rCx + rMax * Math.cos(rad);
                  const y2 = rCy + rMax * Math.sin(rad);
                  const lx = rCx + (rMax + 26) * Math.cos(rad);
                  const ly = rCy + (rMax + 18) * Math.sin(rad);
                  return (
                    <g key={ax.key}>
                      <line x1={rCx} y1={rCy} x2={x2} y2={y2} stroke="#27272a" strokeWidth="1" />
                      <text
                        x={lx}
                        y={ly}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[8.5px] fill-slate-300 font-bold"
                      >
                        {ax.label}
                      </text>
                    </g>
                  );
                })}

                {/* Comparison Target Polygon */}
                <polygon
                  points={compPolygon}
                  fill="rgba(52, 211, 153, 0.14)"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />

                {/* Selected Scholar Polygon */}
                <polygon
                  points={myPolygon}
                  fill="rgba(251, 191, 36, 0.25)"
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* 6-Axis Score Pills */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono-num">
              {radarAxes.map((ax) => {
                const myScore = telemetryData.radar[ax.key];
                const compScore = comparisonBundle.telemetry.radar[ax.key];
                const diff = myScore - compScore;
                return (
                  <div key={ax.key} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/80">
                    <div className="text-[9.5px] text-slate-400 font-sans truncate">{ax.label}</div>
                    <div className="flex items-center justify-between mt-0.5">
                      <strong className="text-amber-300">{myScore}/100</strong>
                      <span className={`text-[9.5px] ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Automated Personal Coaching Diagnostics & Target Overtake Simulator */}
          <div className="lg:col-span-7 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Personal Diagnostic Prescription &amp; What-If Pace Simulator
              </h3>
              <p className="text-xs text-slate-400">
                Actionable strengths, subject bottlenecks, and exact daily problem-solving targets for {activeMemberObj?.name}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 space-y-1">
                <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dominant Pillar &amp; Superpower</span>
                </div>
                <div className="text-xs font-bold text-white">
                  {strongestSubj.name} ({strongestSubj.sharePct}% Time • {formatMins(strongestSubj.mins)} • {strongestSubj.solved} Qs)
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Peak output during <strong>{telemetryData.peakCircadian?.short || 'Evening'}</strong> ({telemetryData.peakCircadian?.qPerHr || 0} Qs/hr). Overall accuracy stands at <strong>{telemetryData.accuracyRate}%</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-1">
                <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Highest-Leverage Growth Area</span>
                </div>
                <div className="text-xs font-bold text-white">
                  {weakestSubj.sharePct < 26
                    ? `${weakestSubj.name} Under-Allocated (${weakestSubj.sharePct}% of study time)`
                    : telemetryData.rigorIndexPct < 25
                    ? `Increase Hard & JEE Advanced Problem Share (${telemetryData.rigorIndexPct}%)`
                    : `Boost Deep Focus 90m+ Sittings (${telemetryData.deepWorkMinsShare}% share)`}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {weakestSubj.sharePct < 26
                    ? `Add +45m/day of ${weakestSubj.name} practice to prevent a 3-subject rank bottleneck in full-syllabus mocks.`
                    : `Shifting 15 daily questions from Mains to Hard/JEE Adv tier will boost XP yield by +38% per hour.`}
                </p>
              </div>
            </div>

            {/* Target Rank Overtake Calculator */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-extrabold text-sky-300 uppercase tracking-wider">
                  🎯 Live Rank Overtake &amp; Gap Calculator
                </span>
                <span className="text-[11px] font-mono-num text-slate-400">
                  {canViewAll ? (
                    <>Current Sprint Standing: <strong className="text-white">#{currentSprintRank} ({myDisplayXp} XP)</strong></>
                  ) : (
                    <>Your Active XP: <strong className="text-amber-300">{myDisplayXp} XP</strong> <span className="text-rose-400">(Ranks Sealed)</span></>
                  )}
                </span>
              </div>

              {!canViewAll ? (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Other scholars&apos; ranks, XP gaps, and standings are locked during Blackout until Admin Reveal.</span>
                </div>
              ) : nextRankAboveScholar ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                    <div className="text-[10px] text-slate-400">
                      To Overtake #{currentSprintRank - 1} ({nextRankAboveScholar.name} • +{xpGapToNextRank} XP gap):
                    </div>
                    <div className="font-mono-num font-bold text-emerald-300 mt-1">
                      {formatMins(Math.ceil((xpGapToNextRank / 10) * 30))} study OR {Math.ceil(xpGapToNextRank / 1.8)} Hard Qs OR {Math.ceil(xpGapToNextRank / 2.5)} Adv Qs
                    </div>
                  </div>
                  {rank1Scholar && rank1Scholar.id !== nextRankAboveScholar.id && (
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <div className="text-[10px] text-slate-400">
                        To Take #1 Crown ({rank1Scholar.name} • +{xpGapToFirst} XP gap):
                      </div>
                      <div className="font-mono-num font-bold text-amber-300 mt-1">
                        {formatMins(Math.ceil((xpGapToFirst / 10) * 30))} study OR {Math.ceil(xpGapToFirst / 1.8)} Hard Qs OR {Math.ceil(xpGapToFirst / 2.5)} Adv Qs
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-emerald-300 font-semibold">
                  👑 {activeMemberObj?.name} is currently holding #1 on the active board! Maintain +3h/day to defend the lead.
                </div>
              )}
            </div>

            {/* Interactive 7-Day What-If Pace Simulator */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-violet-400/25 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-extrabold text-violet-300 uppercase tracking-wider">
                  ⚡ 7-Day What-If Weekly XP Projector
                </span>
                <span className="text-xs font-mono-num font-black text-emerald-300">
                  Projected 7D Yield: +{Math.round(7 * ((whatIfDailyHours * 20) + (whatIfQuestionsPerDay * 1.45)))} XP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Daily Study Hours Target:</span>
                    <strong className="text-white font-mono-num">{whatIfDailyHours} hrs/day ({ whatIfDailyHours * 7 }h/wk)</strong>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.5}
                    value={whatIfDailyHours}
                    onChange={(e) => setWhatIfDailyHours(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Daily Solved Questions:</span>
                    <strong className="text-white font-mono-num">{whatIfQuestionsPerDay} Qs/day ({ whatIfQuestionsPerDay * 7 } Qs/wk)</strong>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={150}
                    step={5}
                    value={whatIfQuestionsPerDay}
                    onChange={(e) => setWhatIfQuestionsPerDay(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HEAD-TO-HEAD TALE OF THE TAPE: SELECTED STUDENT VS. RIVAL / SQUAD AVERAGE (Locked during Blackout) */}
        {canViewAll && (
          <div className="surface-card rounded-3xl p-4 sm:p-6 border border-emerald-400/25 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-base sm:text-lg font-bold text-white font-display">
                    Head-to-Head Tale of the Tape: {activeMemberObj?.name} vs. {comparisonBundle.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Direct side-by-side comparison across 14 study, rigor, subject, and historical cycle metrics.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono-num text-xs">
                <span className="px-3 py-1 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-300 font-bold">
                  {activeMemberObj?.name}: {myWinsCount} Leads
                </span>
                <span className="text-slate-500">vs</span>
                <span className="px-3 py-1 rounded-xl bg-emerald-400/15 border border-emerald-400/35 text-emerald-300 font-bold">
                  {comparisonBundle.name}: {compWinsCount} Leads
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {headToHeadRows.map((row, idx) => {
                const sum = Math.max(1, row.myVal + row.compVal);
                const myShare = row.myVal === 0 && row.compVal === 0 ? 50 : Math.round((row.myVal / sum) * 100);
                const myWinning = row.myVal >= row.compVal;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono-num">
                      <span className={myWinning ? 'text-amber-300 font-extrabold' : 'text-slate-300'}>
                        {row.format(row.myVal)}
                      </span>
                      <span className="text-[10.5px] font-sans font-bold text-slate-400">
                        {row.label}
                      </span>
                      <span className={!myWinning ? 'text-emerald-300 font-extrabold' : 'text-slate-300'}>
                        {row.format(row.compVal)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(6, Math.min(94, myShare))}%` }}
                        className="h-full bg-amber-400 transition-all duration-300"
                      />
                      <div
                        style={{ width: `${100 - Math.max(6, Math.min(94, myShare))}%` }}
                        className="h-full bg-emerald-400/80 transition-all duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBJECT-BY-SUBJECT DEEP DIAGNOSTIC CARDS FOR THIS SCHOLAR */}
        <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white font-display">
              {activeMemberObj?.name}&apos;s Subject-by-Subject Deep Breakdown (Physics · Chemistry · Math)
            </h3>
            <p className="text-xs text-slate-400">
              Granular study hours, solving speed, difficulty tier breakdown, and mock test conversion in each subject compared against {comparisonBundle.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['Physics', 'Chemistry', 'Math'] as const).map((subj) => {
              const data = telemetryData.bySubject[subj];
              const compData = comparisonBundle.telemetry.bySubject[subj];
              const timeShare =
                telemetryData.totalMins > 0
                  ? Math.round((data.mins / telemetryData.totalMins) * 100)
                  : 0;
              const speed =
                data.mins > 0 ? Math.round((data.solved / (data.mins / 60)) * 10) / 10 : 0;
              const subjAcc =
                data.solved + data.attempted > 0
                  ? Math.round((data.solved / (data.solved + data.attempted)) * 100)
                  : 100;
              const minsDelta = data.mins - compData.mins;

              return (
                <div
                  key={subj}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white font-display">{subj}</h4>
                      <span className="text-[11px] text-slate-400 font-mono-num">
                        {data.sessions} sessions • +{data.xp} XP
                      </span>
                    </div>
                    <div className="text-right font-mono-num">
                      <div className="text-base font-black text-amber-300">{timeShare}% share</div>
                      <div className={`text-[10px] font-bold ${minsDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {minsDelta >= 0 ? '+' : '-'}{formatMins(Math.abs(minsDelta))} vs {comparisonBundle.name}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-num">
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Study Time</span>
                      <strong className="text-white">{formatMins(data.mins)}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Solved Qs</span>
                      <strong className="text-emerald-300">{data.solved} Qs</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Solving Speed</span>
                      <strong className="text-sky-300">{speed} Qs/hr</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Mock Exam %ile</span>
                      <strong className="text-amber-300">
                        {data.avgExamPct > 0 ? `${data.avgExamPct}%ile` : 'No Mocks'}
                      </strong>
                    </div>
                  </div>

                  {/* Difficulty Tier Mini-Strip for this Subject */}
                  <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between text-[10.5px] font-mono-num">
                    <span className="text-emerald-300">Easy: {data.easy}</span>
                    <span className="text-sky-300">Mains: {data.mains}</span>
                    <span className="text-amber-300">Hard: {data.hard}</span>
                    <span className="text-rose-300 font-bold">Adv: {data.adv}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-1 border-t border-zinc-900">
                    <span>Accuracy: <strong className="text-white">{subjAcc}%</strong></span>
                    <span>Peak Mock: <strong className="text-amber-300">{data.bestExamPct > 0 ? `${data.bestExamPct}%ile` : '-'}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 28-DAY CONSISTENCY HEATMAP + DAY-OF-WEEK HABITS & CIRCADIAN RHYTHM */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 cols: 28-Day Consistency Heatmap Calendar */}
          <div className="lg:col-span-7 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  28-Day Study Consistency Heatmap
                </h3>
                <p className="text-xs text-slate-400">
                  Click any date cell to inspect {activeMemberObj?.name}&apos;s exact hours, questions, and subjects for that day.
                </p>
              </div>
              <span className="text-xs font-mono-num text-emerald-300 font-bold">
                {telemetryData.activeDaysLast28}/28 Active Days
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {telemetryData.dailySeries28.map((day) => {
                const isSel = inspectedDay?.dateKey === day.dateKey;
                const intensityClass =
                  day.mins === 0
                    ? 'bg-zinc-900/70 border-zinc-800/80 text-slate-500'
                    : day.mins < 90
                    ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
                    : day.mins < 180
                    ? 'bg-emerald-800/60 border-emerald-400/50 text-white'
                    : day.mins < 300
                    ? 'bg-emerald-500/40 border-emerald-300/70 text-white'
                    : 'bg-amber-400 text-slate-950 border-amber-200 font-black';

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDailyBarKey(day.dateKey)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${intensityClass} ${
                      isSel ? 'ring-2 ring-sky-400 scale-[1.03]' : 'hover:brightness-110'
                    }`}
                  >
                    <div className="text-[9px] font-bold opacity-80">{day.shortDate}</div>
                    <div className="text-[10.5px] font-mono-num font-extrabold mt-0.5">
                      {day.mins > 0 ? formatMins(day.mins) : '0m'}
                    </div>
                  </button>
                );
              })}
            </div>

            {inspectedDay && (
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-num">
                <div>
                  <strong className="text-white">{inspectedDay.dayLabel} ({inspectedDay.dateKey})</strong>
                  <span className="text-slate-400"> • {formatMins(inspectedDay.mins)} • {inspectedDay.questions} Qs (+{inspectedDay.xp} XP)</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-sky-300">P: {formatMins(inspectedDay.physicsMins)}</span>
                  <span className="text-emerald-300">C: {formatMins(inspectedDay.chemMins)}</span>
                  <span className="text-rose-300">M: {formatMins(inspectedDay.mathMins)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Day-of-Week Output (Mon-Sun) & Circadian Peak */}
          <div className="lg:col-span-5 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                Day-of-Week Rhythm (Sun - Sat)
              </h3>
              <p className="text-xs text-slate-400">
                Cumulative study volume by day of the week to identify coaching-day slumps vs. weekend surges.
              </p>
            </div>

            <div className="grid grid-cols-7 gap-1.5 items-end h-36 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80">
              {telemetryData.dayOfWeekStats.map((dow) => {
                const hPct = Math.max(6, Math.round((dow.mins / maxDowMins) * 100));
                return (
                  <div key={dow.day} className="flex flex-col items-center justify-end h-full gap-1">
                    <span className="text-[9px] font-mono-num text-slate-400">
                      {dow.mins > 0 ? formatMins(dow.mins) : '-'}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        style={{ height: `${hPct}%` }}
                        className="w-full max-w-[22px] rounded-t-md bg-gradient-to-t from-sky-500 to-amber-400"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-200">{dow.day}</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-300">Circadian Time-of-Day Velocity</div>
              <div className="grid grid-cols-2 gap-2">
                {telemetryData.circadianEntries.map((slot) => (
                  <div key={slot.key} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs">
                    <div className="text-[10px] text-slate-400 font-semibold">{slot.short}</div>
                    <div className="font-mono-num font-bold text-white mt-0.5">
                      {formatMins(slot.mins)} <span className="text-sky-300 text-[10.5px]">({slot.qPerHr} Q/h)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'telemetry') {
    const maxDailyMins = Math.max(60, ...telemetryData.dailySeries.map((d) => d.mins));
    const inspectedDay =
      telemetryData.dailySeries.find((d) => d.dateKey === selectedDailyBarKey) ||
      telemetryData.dailySeries[telemetryData.dailySeries.length - 1];

    const totalTierQs = Math.max(
      1,
      telemetryData.tierCounts.easy +
        telemetryData.tierCounts.mains +
        telemetryData.tierCounts.hard +
        telemetryData.tierCounts.adv
    );

    const maxCircadianMins = Math.max(
      30,
      ...telemetryData.circadianEntries.map((c) => c.mins)
    );

    return (
      <div className="space-y-5 animate-view">
        {/* Top Filter Control Bar: Scholar Selector + Timeframe Window */}
        <div className="surface-card rounded-3xl p-4 sm:p-5 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
              Deep Behavioral &amp; Question Efficiency Telemetry
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {canViewAll && (
                <button
                  type="button"
                  onClick={() => onSelectScholarId('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    effectiveScholarId === 'ALL'
                      ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-sm'
                      : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  All Squad Aggregate
                </button>
              )}
              {members.map((m) => {
                const locked = !canViewAll && m.id !== currentUserId;
                const active = effectiveScholarId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onSelectScholarId(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      locked
                        ? 'bg-zinc-950 text-zinc-600 border-zinc-900 cursor-not-allowed'
                        : active
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm cursor-pointer'
                        : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                    }`}
                  >
                    <span>{m.name}</span>
                    {locked && <Lock className="w-3 h-3 text-rose-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 self-start lg:self-auto">
            {([
              { id: '7d' as const, label: 'Last 7D' },
              { id: '14d' as const, label: 'Last 14D' },
              { id: '30d' as const, label: 'Last 30D' },
              { id: 'cycle_4' as const, label: 'Cycle 4' },
              { id: 'cycle_3' as const, label: 'Cycle 3' },
              { id: 'lifetime' as const, label: 'All-Time' }
            ]).map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeframe === tf.id
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6-Card High-Precision Executive KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Focused Study Volume</span>
            <div className="text-lg sm:text-xl font-black text-white font-mono-num">
              {formatMins(telemetryData.totalMins)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.sessionsCount} logged blocks
            </div>
          </div>

          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Solving Velocity</span>
            <div className="text-lg sm:text-xl font-black text-sky-300 font-mono-num">
              {telemetryData.questionsPerHour} Qs/hr
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.minsPerQuestion > 0 ? `${telemetryData.minsPerQuestion} mins / Q` : 'No Qs logged'}
            </div>
          </div>

          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Solve Accuracy Rate</span>
            <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono-num">
              {telemetryData.accuracyRate}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.totalSolved} solved · {telemetryData.totalAttempted} unsolved
            </div>
          </div>

          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Hard + JEE Adv Rigor</span>
            <div className="text-lg sm:text-xl font-black text-amber-400 font-mono-num">
              {telemetryData.rigorIndexPct}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.hardAdvTotal} Hard/Adv Qs solved
            </div>
          </div>

          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">Deep Work Ratio (90m+)</span>
            <div className="text-lg sm:text-xl font-black text-violet-300 font-mono-num">
              {telemetryData.deepWorkMinsShare}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.deepWorkSessionsCount} vault-eligible blocks
            </div>
          </div>

          <div className="surface-card rounded-2xl p-3.5 border border-white/10 space-y-1">
            <span className="text-[11px] text-slate-400 font-semibold block">XP Yield Efficiency</span>
            <div className="text-lg sm:text-xl font-black text-emerald-300 font-mono-num">
              {telemetryData.xpPerHour} XP/hr
            </div>
            <div className="text-[11px] text-slate-400 font-mono-num">
              {telemetryData.totalSessionXp.toLocaleString()} session XP
            </div>
          </div>
        </div>

        {/* 14-Day Daily Study Velocity & Subject Stack Chart */}
        <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white font-display">
                14-Day Daily Study Velocity &amp; Subject Stack
              </h3>
              <p className="text-xs text-slate-400">
                Click any day bar to inspect exact Physics, Chemistry, and Math study hours and question output for that date.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono-num text-slate-300">
              <span>
                Active Days: <strong className="text-emerald-400">{telemetryData.activeDaysLast14}/14</strong>
              </span>
              {telemetryData.peakDay && telemetryData.peakDay.mins > 0 && (
                <span>
                  Peak Day: <strong className="text-amber-300">{telemetryData.peakDay.shortDate} ({formatMins(telemetryData.peakDay.mins)})</strong>
                </span>
              )}
            </div>
          </div>

          {/* Interactive Bar Chart */}
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 sm:gap-2 pt-3 items-end h-44 px-2 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 p-3">
            {telemetryData.dailySeries.map((day) => {
              const totalPct = Math.max(4, Math.round((day.mins / maxDailyMins) * 100));
              const isSelected = inspectedDay?.dateKey === day.dateKey;
              const pShare = day.mins > 0 ? Math.round((day.physicsMins / day.mins) * 100) : 0;
              const cShare = day.mins > 0 ? Math.round((day.chemMins / day.mins) * 100) : 0;
              const mShare = Math.max(0, 100 - pShare - cShare);

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDailyBarKey(day.dateKey)}
                  className={`group flex flex-col items-center justify-end h-full gap-1.5 cursor-pointer rounded-xl p-1 transition-all ${
                    isSelected ? 'bg-white/[0.08] ring-1 ring-amber-400/50' : 'hover:bg-white/[0.04]'
                  }`}
                  title={`${day.dateKey}: ${formatMins(day.mins)} (${day.questions} Qs)`}
                >
                  <span className="text-[9.5px] font-mono-num text-slate-400 group-hover:text-white">
                    {day.mins > 0 ? formatMins(day.mins) : '-'}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[26px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all ${
                        day.mins === 0 ? 'bg-zinc-800/60 h-1.5' : ''
                      }`}
                      style={{ height: day.mins > 0 ? `${totalPct}%` : '6px' }}
                    >
                      {day.mins > 0 && (
                        <>
                          {mShare > 0 && (
                            <div style={{ height: `${mShare}%` }} className="w-full bg-rose-400" />
                          )}
                          {cShare > 0 && (
                            <div style={{ height: `${cShare}%` }} className="w-full bg-emerald-400" />
                          )}
                          {pShare > 0 && (
                            <div style={{ height: `${pShare}%` }} className="w-full bg-sky-400" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-center leading-tight">
                    <div className="text-[9.5px] font-bold text-slate-300">{day.dayLabel}</div>
                    <div className="text-[9px] font-mono-num text-slate-500">{day.shortDate}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Day Breakdown Footer */}
          {inspectedDay && (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-white font-mono-num">
                  {inspectedDay.dayLabel} · {inspectedDay.dateKey}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-num text-white font-semibold">
                  Total: <strong className="text-amber-300">{formatMins(inspectedDay.mins)}</strong>
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-num text-slate-300">
                  Questions: <strong className="text-emerald-400">{inspectedDay.questions} Qs</strong>
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-mono-num text-slate-300">
                  Yield: <strong className="text-sky-300">+{inspectedDay.xp} XP</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono-num">
                <span className="text-sky-300">
                  Physics: <strong>{formatMins(inspectedDay.physicsMins)}</strong>
                </span>
                <span className="text-emerald-300">
                  Chemistry: <strong>{formatMins(inspectedDay.chemMins)}</strong>
                </span>
                <span className="text-rose-300">
                  Math: <strong>{formatMins(inspectedDay.mathMins)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2-Column Deep Dive: Question Difficulty Pyramid + Circadian Rhythm & Endurance */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Question Difficulty Pyramid & Tiered Accuracy */}
          <div className="lg:col-span-6 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white font-display">
                Question Difficulty Pyramid &amp; Tiered Rigor
              </h3>
              <p className="text-xs text-slate-400">
                Distribution of solved and attempted questions across JEE difficulty multipliers.
              </p>
            </div>

            <div className="space-y-3">
              {([
                {
                  key: 'adv' as const,
                  label: 'JEE Advanced Tier (2.5x Solved · 1.1x Attempted)',
                  solved: telemetryData.tierCounts.adv,
                  attempted: telemetryData.tierAttempted.adv,
                  barColor: 'bg-rose-400',
                  textColor: 'text-rose-300'
                },
                {
                  key: 'hard' as const,
                  label: 'Hard Coaching Drill (1.8x Solved · 0.8x Attempted)',
                  solved: telemetryData.tierCounts.hard,
                  attempted: telemetryData.tierAttempted.hard,
                  barColor: 'bg-amber-400',
                  textColor: 'text-amber-300'
                },
                {
                  key: 'mains' as const,
                  label: 'JEE Mains Standard (1.2x Solved · 0.5x Attempted)',
                  solved: telemetryData.tierCounts.mains,
                  attempted: telemetryData.tierAttempted.mains,
                  barColor: 'bg-sky-400',
                  textColor: 'text-sky-300'
                },
                {
                  key: 'easy' as const,
                  label: 'Foundation / Warmup (0.8x Solved · 0.3x Attempted)',
                  solved: telemetryData.tierCounts.easy,
                  attempted: telemetryData.tierAttempted.easy,
                  barColor: 'bg-emerald-400',
                  textColor: 'text-emerald-300'
                }
              ]).map((tier) => {
                const sharePct = Math.round((tier.solved / totalTierQs) * 100);
                const tierAcc =
                  tier.solved + tier.attempted > 0
                    ? Math.round((tier.solved / (tier.solved + tier.attempted)) * 100)
                    : 100;

                return (
                  <div
                    key={tier.key}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className={`font-bold ${tier.textColor}`}>{tier.label}</span>
                      <span className="font-mono-num text-white font-extrabold">
                        {tier.solved} Qs ({sharePct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tier.barColor} transition-all duration-300`}
                        style={{ width: `${Math.min(100, Math.max(2, sharePct))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-num">
                      <span>Unsolved Attempts: {tier.attempted} Qs</span>
                      <span>Tier Accuracy: <strong className="text-slate-200">{tierAcc}%</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Circadian Productivity Rhythm & Session Endurance */}
          <div className="lg:col-span-6 surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white font-display">
                  Circadian Rhythm &amp; Endurance Profile
                </h3>
                {telemetryData.peakCircadian && telemetryData.peakCircadian.mins > 0 && (
                  <span className="text-[11px] font-mono-num text-emerald-300 font-semibold">
                    Peak Window: {telemetryData.peakCircadian.label.split(' (')[0]}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Time-of-day cognitive output and focus block length distribution.
              </p>
            </div>

            {/* Circadian 4-Block Bars */}
            <div className="space-y-2.5">
              {telemetryData.circadianEntries.map((slot) => {
                const widthPct = Math.round((slot.mins / maxCircadianMins) * 100);
                return (
                  <div
                    key={slot.key}
                    className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{slot.label}</span>
                      <span className="font-mono-num font-bold text-white">
                        {formatMins(slot.mins)} · <span className="text-sky-300">{slot.qPerHr} Qs/hr</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                        style={{ width: `${Math.min(100, widthPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10.5px] text-slate-400 font-mono-num">
                      <span>{slot.count} sessions logged</span>
                      <span>{slot.qs} Qs solved (+{slot.xp} XP)</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Endurance Block Breakdown */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-xs font-bold text-slate-300">
                Focus Block Endurance &amp; Supply Vault Qualification (90m+)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(telemetryData.endurance).map(([k, bucket]) => (
                  <div
                    key={k}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-0.5"
                  >
                    <div className="text-[10px] text-slate-400 truncate">{bucket.label}</div>
                    <div className="text-sm font-black text-white font-mono-num">
                      {bucket.count} blocks
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono-num">
                      {formatMins(bucket.mins)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PCM Triad Balance Matrix */}
        <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white font-display">
              Physics · Chemistry · Mathematics Allocation &amp; Efficiency Balance
            </h3>
            <p className="text-xs text-slate-400">
              Detects subject neglect early by comparing study time share, question volume, solving speed, and advanced rigor across all three JEE pillars.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['Physics', 'Chemistry', 'Math'] as const).map((subj) => {
              const data = telemetryData.bySubject[subj];
              const timeShare =
                telemetryData.totalMins > 0
                  ? Math.round((data.mins / telemetryData.totalMins) * 100)
                  : 0;
              const qShare =
                telemetryData.totalSolved > 0
                  ? Math.round((data.solved / telemetryData.totalSolved) * 100)
                  : 0;
              const speed =
                data.mins > 0 ? Math.round((data.solved / (data.mins / 60)) * 10) / 10 : 0;
              const subjAcc =
                data.solved + data.attempted > 0
                  ? Math.round((data.solved / (data.solved + data.attempted)) * 100)
                  : 100;
              const isUnderAllocated = telemetryData.totalMins >= 180 && timeShare < 22;

              return (
                <div
                  key={subj}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white font-display">{subj}</h4>
                      <span className="text-[11px] text-slate-400 font-mono-num">
                        {data.sessions} sessions · +{data.xp} XP
                      </span>
                    </div>
                    <span className="text-base font-black text-amber-300 font-mono-num">
                      {timeShare}% time
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        subj === 'Physics'
                          ? 'bg-sky-400'
                          : subj === 'Chemistry'
                          ? 'bg-emerald-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${Math.min(100, timeShare)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-num pt-1">
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Study Volume</span>
                      <strong className="text-white">{formatMins(data.mins)}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Solved Qs ({qShare}%)</span>
                      <strong className="text-emerald-300">{data.solved} Qs</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Solving Speed</span>
                      <strong className="text-sky-300">{speed} Qs/hr</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/70">
                      <span className="text-[10px] text-slate-400 block font-sans">Accuracy · Hard/Adv</span>
                      <strong className="text-amber-300">
                        {subjAcc}% · {data.hardAdv} Q
                      </strong>
                    </div>
                  </div>

                  {isUnderAllocated && (
                    <div className="text-[11px] text-amber-300 flex items-center gap-1.5 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Low allocation alert: {subj} is below 22% of total study time.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 2: CYCLE-OVER-CYCLE PROGRESSION & STUDY-TO-EXAM ROI MATRIX
  // ============================================================================
  const maxCycleMetricVal = Math.max(
    1,
    ...cycleAndRoiData.flatMap((r) => [
      r.c1[cycleComparisonMetric],
      r.c2[cycleComparisonMetric],
      r.c3[cycleComparisonMetric],
      r.c4[cycleComparisonMetric]
    ])
  );

  const formatCycleMetric = (val: number) => {
    if (cycleComparisonMetric === 'mins') return formatMins(val);
    if (cycleComparisonMetric === 'questions') return `${val} Qs`;
    return `${val} XP`;
  };

  return (
    <div className="space-y-5 animate-view">
      {/* Section 1: Longitudinal Cycle-Over-Cycle Progression Matrix (Cycle 1 -> Cycle 2 -> Cycle 3 -> Cycle 4) */}
      <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white font-display">
              Longitudinal Cycle-Over-Cycle Sprint Progression (Cycles 1 to 4)
            </h3>
            <p className="text-xs text-slate-400">
              Track week-over-week growth in total XP, study duration, solved questions, and normalized exam XP across every sprint cycle.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
            {([
              { id: 'xp' as const, label: 'Total XP' },
              { id: 'mins' as const, label: 'Study Time' },
              { id: 'questions' as const, label: 'Questions' },
              { id: 'examXp' as const, label: 'Exam XP' }
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setCycleComparisonMetric(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  cycleComparisonMetric === m.id
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Official Concluded Weekly Sprint Champions & Podium Strip (Weeks 1, 2 & 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            {
              week: 3,
              title: 'Sprint 3 (Blackout Reckoning)',
              dates: 'Oct 26 - Nov 1, 2026',
              reigning: true,
              gold: 'Utham (1605 XP)',
              silver: 'Ved (1536 XP)',
              bronze: 'Ananya (1506 XP)'
            },
            {
              week: 2,
              title: 'Sprint 2 (Shadow Heist Week)',
              dates: 'Oct 19 - Oct 25, 2026',
              reigning: false,
              gold: 'Sai (941 XP)',
              silver: 'Ananya (825 XP)',
              bronze: 'Utham (739 XP)'
            },
            {
              week: 1,
              title: 'Sprint 1 (Kickoff Week)',
              dates: 'Oct 12 - Oct 18, 2026',
              reigning: false,
              gold: 'Dharhas (628 XP)',
              silver: 'Ved (591 XP)',
              bronze: 'Sai (550 XP)'
            }
          ].map((sp) => (
            <div
              key={sp.week}
              className={`p-3 rounded-2xl border space-y-1.5 ${
                sp.reigning
                  ? 'bg-gradient-to-br from-amber-500/15 via-zinc-950 to-zinc-950 border-amber-400/40'
                  : 'bg-zinc-950 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={`font-extrabold uppercase tracking-wider ${
                    sp.reigning ? 'text-amber-300' : 'text-sky-300'
                  }`}
                >
                  {sp.reigning ? `👑 Week ${sp.week} Reigning Podium` : `🏆 Week ${sp.week} Official Result`}
                </span>
                <span className="text-slate-400 font-mono-num">{sp.dates}</span>
              </div>
              <div className="text-xs font-extrabold text-white">
                🥇 #1 {sp.gold}
              </div>
              <div className="text-[10.5px] text-slate-300 font-mono-num flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span>🥈 {sp.silver}</span>
                <span>🥉 {sp.bronze}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {(() => {
            const rankInCycle = (cycleKey: 'c1' | 'c2' | 'c3' | 'c4', memberId: string) => {
              const sorted = [...cycleAndRoiData].sort((a, b) => (b[cycleKey]?.xp || 0) - (a[cycleKey]?.xp || 0));
              const idx = sorted.findIndex((r) => r.id === memberId);
              if (idx < 0 || (sorted[idx]?.[cycleKey]?.xp || 0) <= 0) return null;
              return idx + 1;
            };

            return cycleAndRoiData.map((row) => {
              const c2Delta = row.c2[cycleComparisonMetric] - row.c1[cycleComparisonMetric];
              const c3Delta = row.c3[cycleComparisonMetric] - row.c2[cycleComparisonMetric];

              return (
                <div
                  key={row.id}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white text-slate-950 font-black font-display text-xs flex items-center justify-center">
                        {(row.name || row.id || 'S')[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex flex-wrap items-center gap-1.5">
                          <span>{row.name}</span>
                          {row.id === 'utham_940' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold">
                              👑 Week 3 Winner
                            </span>
                          )}
                          {row.id === 'sai' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-sky-300 font-bold">
                              🏆 Week 2 &amp; 4 Winner
                            </span>
                          )}
                          {row.id === 'dharhas_590' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/35 text-sky-300 font-bold">
                              🏆 Week 1 Winner
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.institute} · Career: {row.totalXp.toLocaleString()} XP ({formatMins(row.totalStudyMins)})
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
                      <span className="text-slate-400">
                        C1 → C2:{' '}
                        <strong className={c2Delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {c2Delta >= 0 ? '+' : ''}
                          {formatCycleMetric(c2Delta)}
                        </strong>
                      </span>
                      <span className="text-slate-400">
                        C2 → C3:{' '}
                        <strong className={c3Delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {c3Delta >= 0 ? '+' : ''}
                          {formatCycleMetric(c3Delta)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    {([
                      { key: 'c1', label: 'Cycle 1 (Oct 12 - 18)', data: row.c1, bar: 'bg-slate-400' },
                      { key: 'c2', label: 'Cycle 2 (Oct 19 - 25)', data: row.c2, bar: 'bg-sky-400' },
                      { key: 'c3', label: 'Cycle 3 (Oct 26 - Nov 1)', data: row.c3, bar: 'bg-amber-400' },
                      { key: 'c4', label: 'Cycle 4 (Active Sprint)', data: row.c4, bar: 'bg-emerald-400' }
                    ] as const).map((cyc) => {
                      const val = cyc.data[cycleComparisonMetric];
                      const pct = Math.round((val / maxCycleMetricVal) * 100);
                      const cycRank = rankInCycle(cyc.key, row.id);
                      return (
                        <div
                          key={cyc.key}
                          className={`p-3 rounded-xl bg-zinc-900/70 border space-y-1.5 ${
                            cycRank === 1 && cyc.key !== 'c4'
                              ? 'border-amber-400/45'
                              : 'border-zinc-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] gap-1">
                            <span className="text-slate-400 font-medium truncate">{cyc.label}</span>
                            {cycRank && (
                              <span
                                className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono-num font-bold shrink-0 ${
                                  cycRank === 1
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : cycRank === 2
                                    ? 'bg-zinc-700 text-zinc-200'
                                    : cycRank === 3
                                    ? 'bg-orange-500/20 text-orange-300'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {cycRank === 1 ? '🥇 #1' : cycRank === 2 ? '🥈 #2' : cycRank === 3 ? '🥉 #3' : `#${cycRank}`}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-black text-white font-mono-num">
                            {formatCycleMetric(val)}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cyc.bar}`}
                              style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono-num">
                            <span>{formatMins(cyc.data.mins)}</span>
                            <span>{cyc.data.questions} Qs</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Section 2: Study Input vs. Mock Exam Percentile ROI & Stability Matrix */}
      <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white font-display">
              Study Input vs. Mock Exam Output ROI &amp; Volatility Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Correlates study hours and solved question volume directly against normalized coaching test percentiles and test-to-test consistency.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
            {(['Overall', 'Physics', 'Chemistry', 'Math'] as const).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setRoiSubjectFilter(subj)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roiSubjectFilter === subj
                    ? 'bg-sky-400 text-slate-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] text-slate-400">
                <th className="py-3 px-3 font-semibold">Scholar</th>
                <th className="py-3 px-3 font-semibold font-mono-num">
                  {roiSubjectFilter} Study Time
                </th>
                <th className="py-3 px-3 font-semibold font-mono-num">
                  {roiSubjectFilter} Solved Qs
                </th>
                <th className="py-3 px-3 font-semibold font-mono-num">
                  Avg {roiSubjectFilter} %ile
                </th>
                <th className="py-3 px-3 font-semibold font-mono-num">
                  Avg Raw Score %
                </th>
                <th className="py-3 px-3 font-semibold font-mono-num">
                  Test Consistency (Std Dev)
                </th>
                <th className="py-3 px-3 font-semibold">Conversion Diagnostic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 font-mono-num">
              {cycleAndRoiData.map((row) => {
                const isOverall = roiSubjectFilter === 'Overall';
                const studyMins = isOverall
                  ? row.totalStudyMins
                  : row.subjectRoi[roiSubjectFilter]?.mins || 0;
                const solvedQs = isOverall
                  ? row.totalQuestions
                  : row.subjectRoi[roiSubjectFilter]?.questions || 0;
                const avgPct = isOverall
                  ? row.avgOverallPct
                  : row.subjectRoi[roiSubjectFilter]?.avgPct || 0;

                let diagnosticText = 'Balanced Input-to-Score Conversion';
                let diagnosticColor = 'text-sky-300';
                if (row.examsCount === 0) {
                  diagnosticText = 'No mock exams logged yet';
                  diagnosticColor = 'text-slate-500';
                } else if (avgPct >= 93 && studyMins >= 300) {
                  diagnosticText = 'Elite High-Volume & High-Percentile Conversion';
                  diagnosticColor = 'text-emerald-400';
                } else if (avgPct >= 92 && studyMins < 300) {
                  diagnosticText = 'High Test Efficiency (Strong %ile on lean hours)';
                  diagnosticColor = 'text-emerald-300';
                } else if (avgPct < 88 && studyMins >= 600) {
                  diagnosticText = 'High Effort · Increase Timed Mock Practice & Error Review';
                  diagnosticColor = 'text-amber-300';
                } else if (studyMins < 240) {
                  diagnosticText = 'Needs Higher Practice Volume to Lift Standing';
                  diagnosticColor = 'text-rose-300';
                }

                return (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-3 font-sans">
                      <div className="font-bold text-white">{row.name}</div>
                      <div className="text-[10px] text-slate-400">{row.institute}</div>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-white">
                      {formatMins(studyMins)}
                    </td>
                    <td className="py-3.5 px-3 text-emerald-300 font-bold">
                      {solvedQs.toLocaleString()} Qs
                    </td>
                    <td className="py-3.5 px-3 text-amber-300 font-extrabold">
                      {avgPct > 0 ? `${avgPct.toFixed(1)}%ile` : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-200">
                      {row.avgMarksPct > 0 ? `${row.avgMarksPct}%` : '-'}
                    </td>
                    <td className="py-3.5 px-3 text-slate-300">
                      {row.examsCount > 1 ? `±${row.stdDevPct}%ile` : '1 test'}
                    </td>
                    <td className={`py-3.5 px-3 font-sans font-semibold ${diagnosticColor}`}>
                      {diagnosticText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Career XP Source Attribution Ledger */}
      <div className="surface-card rounded-3xl p-4 sm:p-6 border border-white/10 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-white font-display">
            Career XP Source Attribution Breakdown
          </h3>
          <p className="text-xs text-slate-400">
            Deconstructs each scholar&apos;s cumulative XP into Study Duration XP, Tiered Question XP, Mock Exam Percentile XP, and Bounties/Warfare XP.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cycleAndRoiData.map((row) => {
            const total = Math.max(
              1,
              row.attribution.durationXp +
                row.attribution.questionXp +
                row.attribution.examXp +
                row.attribution.taskAndBonusXp
            );
            const dPct = Math.round((row.attribution.durationXp / total) * 100);
            const qPct = Math.round((row.attribution.questionXp / total) * 100);
            const ePct = Math.round((row.attribution.examXp / total) * 100);
            const bPct = Math.max(0, 100 - dPct - qPct - ePct);

            return (
              <div
                key={row.id}
                className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-white">{row.name}</div>
                    <div className="text-[11px] text-slate-400">{row.institute}</div>
                  </div>
                  <div className="text-base font-black text-white font-mono-num">
                    {row.totalXp.toLocaleString()} XP
                  </div>
                </div>

                {/* Stacked Attribution Bar */}
                <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden flex">
                  {dPct > 0 && <div style={{ width: `${dPct}%` }} className="h-full bg-sky-400" />}
                  {qPct > 0 && <div style={{ width: `${qPct}%` }} className="h-full bg-emerald-400" />}
                  {ePct > 0 && <div style={{ width: `${ePct}%` }} className="h-full bg-amber-400" />}
                  {bPct > 0 && <div style={{ width: `${bPct}%` }} className="h-full bg-violet-400" />}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-num">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                    <span className="text-sky-300 font-sans">Study Time</span>
                    <strong className="text-white">{row.attribution.durationXp} XP</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                    <span className="text-emerald-300 font-sans">Solved Qs</span>
                    <strong className="text-white">{row.attribution.questionXp} XP</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                    <span className="text-amber-300 font-sans">Mock Exams</span>
                    <strong className="text-white">{row.attribution.examXp} XP</strong>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                    <span className="text-violet-300 font-sans">Tasks &amp; Bonus</span>
                    <strong className="text-white">{row.attribution.taskAndBonusXp} XP</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
