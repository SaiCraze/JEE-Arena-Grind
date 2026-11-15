import React, { useMemo, useState } from 'react';
import {
  X, Trophy, Clock, Target, Award, Shield, Zap, Flame,
  TrendingUp, TrendingDown, BookOpen, CheckCircle2, AlertTriangle,
  BarChart3, Sparkles, ArrowRight, Layers, Edit3, Trash2
} from 'lucide-react';

interface ScholarDossierModalProps {
  member: any;
  rank: number;
  allMembersStats?: any[];
  allSessions?: any[];
  sessions?: any[];
  allExams?: any[];
  exams?: any[];
  allTasks?: any[];
  tasks?: any[];
  badges?: any[];
  sprintHistory?: any[];
  canManageLogs?: boolean;
  onEditSession?: (session: any) => void;
  onDeleteSession?: (sessionId: string) => void;
  onEditExam?: (exam: any) => void;
  onDeleteExam?: (examId: string) => void;
  onClose: () => void;
  onCompareWithSquad: (memberId: string) => void;
}

function formatMins(mins: number) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export const ScholarDossierModal: React.FC<ScholarDossierModalProps> = ({
  member,
  rank,
  allSessions,
  sessions,
  allExams,
  exams,
  allTasks,
  tasks,
  badges = [],
  sprintHistory = [],
  canManageLogs = true,
  onEditSession,
  onDeleteSession,
  onEditExam,
  onDeleteExam,
  onClose,
  onCompareWithSquad
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'subjects' | 'logs' | 'achievements'>('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1d' | '3d' | '7d' | '14d' | '30d' | '90d' | 'lifetime' | 'custom'>('lifetime');
  const [customDaysInput, setCustomDaysInput] = useState<string>('5');

  const safeSessions = useMemo(() => allSessions || sessions || [], [allSessions, sessions]);
  const safeExams = useMemo(() => allExams || exams || [], [allExams, exams]);
  const safeTasks = useMemo(() => allTasks || tasks || [], [allTasks, tasks]);
  const safeBadges = useMemo(() => badges || [], [badges]);

  const analytics = useMemo(() => {
    if (!member) return null;

    const memSessions = safeSessions.filter(
      (s) => s && s.memberId === member.id && s.sessionType !== 'BREAK'
    );
    const memExams = safeExams.filter((e) => e && e.memberId === member.id);

    // Subject aggregation (Study + Exams)
    const coreSubjects = ['Physics', 'Chemistry', 'Math'];
    const extraSubjects = Array.from(
      new Set(
        memSessions
          .map((s) => (s.subject || 'Physics').trim())
          .filter((sub) => !coreSubjects.includes(sub))
      )
    );
    const subjectNames = [...coreSubjects, ...extraSubjects];

    const subjectStats = subjectNames.map((subj) => {
      const subSessions = memSessions.filter(
        (s) => (s.subject || '').toLowerCase() === subj.toLowerCase()
      );
      const mins = subSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const solved = subSessions.reduce(
        (acc, s) =>
          acc +
          (s.solvedQuestions !== undefined
            ? Number(s.solvedQuestions)
            : Number(s.questions) || 0),
        0
      );
      const attempted = subSessions.reduce(
        (acc, s) => acc + (Number(s.attemptedQuestions) || 0),
        0
      );
      const xp = subSessions.reduce((acc, s) => acc + (Number(s.xpEarned) || 0), 0);
      const totalQs = solved + attempted;
      const accuracy = totalQs > 0 ? Math.round((solved / totalQs) * 100) : solved > 0 ? 100 : 0;

      // Exam subject percentile
      const examSubEntries = memExams.flatMap((e) =>
        (e.subjects || []).filter(
          (es: any) => (es.name || '').toLowerCase() === subj.toLowerCase()
        )
      );
      const avgExamPct =
        examSubEntries.length > 0
          ? examSubEntries.reduce((acc, es: any) => acc + (Number(es.percentile) || 0), 0) /
            examSubEntries.length
          : 0;

      // Composite mastery score to determine Best & Worst subject
      const compositeScore =
        xp * 1.4 + mins * 0.6 + solved * 1.8 + (avgExamPct > 0 ? avgExamPct * 2.2 : 0);

      return {
        subject: subj,
        sessionsCount: subSessions.length,
        mins,
        hours: +(mins / 60).toFixed(1),
        solved,
        attempted,
        accuracy,
        xp,
        avgExamPct,
        examCount: examSubEntries.length,
        compositeScore
      };
    });

    // Best Subject (among subjects with activity, or top core subject)
    const activeSubjects = subjectStats.filter((s) => s.mins > 0 || s.solved > 0 || s.avgExamPct > 0);
    const sortedByBest = [...(activeSubjects.length > 0 ? activeSubjects : subjectStats)].sort(
      (a, b) => b.compositeScore - a.compositeScore
    );
    const bestSubject = sortedByBest[0] || subjectStats[0];

    // Worst Subject (focus primarily on core JEE subjects Physics/Chemistry/Math so a neglected core subject is flagged)
    const coreStats = subjectStats.filter((s) => coreSubjects.includes(s.subject));
    const sortedCoreWorst = [...coreStats].sort((a, b) => a.compositeScore - b.compositeScore);
    const worstSubject =
      sortedCoreWorst.find((s) => s.subject !== bestSubject?.subject) ||
      sortedCoreWorst[0] ||
      subjectStats[subjectStats.length - 1];

    // Overall Exam Percentile & Best Type of Exam (JEE Mains vs JEE Advanced vs Custom/Practice)
    const avgPercentile =
      memExams.length > 0
        ? memExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) / memExams.length
        : Number(member.weekAvgPercentile) || 0;

    const peakPercentile =
      memExams.length > 0
        ? Math.max(...memExams.map((e) => Number(e.overallPercentile) || 0))
        : avgPercentile;

    // Group exams by examType
    const examTypeMap: Record<string, { count: number; sumPct: number; bestPct: number }> = {};
    memExams.forEach((e) => {
      const t = e.examType || (e.title?.toLowerCase().includes('adv') ? 'JEE Advanced' : 'JEE Mains');
      if (!examTypeMap[t]) examTypeMap[t] = { count: 0, sumPct: 0, bestPct: 0 };
      const pct = Number(e.overallPercentile) || 0;
      examTypeMap[t].count += 1;
      examTypeMap[t].sumPct += pct;
      examTypeMap[t].bestPct = Math.max(examTypeMap[t].bestPct, pct);
    });

    // Also inspect problem difficulty breakdown from sessions if no exams logged
    let mainsSolved = 0;
    let advSolved = 0;
    let easySolved = 0;
    memSessions.forEach((s) => {
      if (s.difficultyBreakdown) {
        easySolved += Number(s.difficultyBreakdown.easy) || 0;
        mainsSolved += Number(s.difficultyBreakdown.mains) || 0;
        advSolved +=
          (Number(s.difficultyBreakdown.hard) || 0) + (Number(s.difficultyBreakdown.adv) || 0);
      } else {
        const q = Number(s.questions) || 0;
        if (s.difficulty === 'adv' || s.difficulty === 'hard') advSolved += q;
        else if (s.difficulty === 'easy') easySolved += q;
        else mainsSolved += q;
      }
    });

    let bestExamType = 'JEE Mains';
    let bestExamTypeDetail = 'Standardized Mock Format';
    const examTypeEntries = Object.entries(examTypeMap).map(([type, data]) => ({
      type,
      avgPct: data.sumPct / data.count,
      bestPct: data.bestPct,
      count: data.count
    }));

    if (examTypeEntries.length > 0) {
      examTypeEntries.sort((a, b) => b.avgPct - a.avgPct);
      bestExamType = examTypeEntries[0].type;
      bestExamTypeDetail = `${examTypeEntries[0].avgPct.toFixed(1)}%ile avg across ${examTypeEntries[0].count} test(s)`;
    } else if (advSolved > mainsSolved && advSolved > 0) {
      bestExamType = 'JEE Advanced Tier';
      bestExamTypeDetail = `${advSolved} Advanced/Hard problems solved`;
    } else if (mainsSolved > 0) {
      bestExamType = 'JEE Mains Tier';
      bestExamTypeDetail = `${mainsSolved} Mains-level problems solved`;
    } else {
      bestExamType = 'Concept Foundation';
      bestExamTypeDetail = `${member.totalQuestions || 0} total practice questions`;
    }

    // Overall Study Metrics
    const totalMins = Number(member.totalStudyMins) || 0;
    const totalQuestions = Number(member.totalQuestions) || 0;
    const totalSolved = memSessions.reduce(
      (acc, s) =>
        acc +
        (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
      0
    );
    const totalAttempted = memSessions.reduce(
      (acc, s) => acc + (Number(s.attemptedQuestions) || 0),
      0
    );
    const overallSolveAccuracy =
      totalSolved + totalAttempted > 0
        ? Math.round((totalSolved / (totalSolved + totalAttempted)) * 100)
        : totalQuestions > 0
        ? 100
        : 0;
    const avgSessionMins =
      memSessions.length > 0 ? Math.round(totalMins / memSessions.length) : totalMins;

    // Generate Pros (Strengths) & Cons (Growth Areas)
    const pros: string[] = [];
    const cons: string[] = [];

    if (bestSubject && (bestSubject.mins > 0 || bestSubject.solved > 0 || bestSubject.avgExamPct > 0)) {
      pros.push(
        `Strongest command in ${bestSubject.subject} (${formatMins(bestSubject.mins)} studied, ${bestSubject.solved} Qs solved${
          bestSubject.avgExamPct > 0 ? `, ${bestSubject.avgExamPct.toFixed(1)}%ile` : ''
        }).`
      );
    }
    if (overallSolveAccuracy >= 75 && totalQuestions >= 15) {
      pros.push(
        `High problem-solving precision with ${overallSolveAccuracy}% solve rate across ${totalQuestions} questions.`
      );
    }
    if (avgPercentile >= 85) {
      pros.push(
        `Strong normalized exam standing averaging ${avgPercentile.toFixed(1)}%ile (Peak: ${peakPercentile.toFixed(1)}%ile).`
      );
    }
    if ((member.streakCount || 1) >= 2) {
      pros.push(
        `Consistent ${member.streakCount}d active study streak maintaining momentum multiplier.`
      );
    }
    if (avgSessionMins >= 45) {
      pros.push(
        `Deep-focus endurance averaging ${avgSessionMins} minutes per study session.`
      );
    }
    if ((member.raidDamageContributed || 0) >= 150) {
      pros.push(
        `Heavy Co-Op Raid vanguard contributing ${member.raidDamageContributed} HP boss damage.`
      );
    }
    // Evaluate historical sprint placements for this scholar across Weeks 1, 2, 3
    const historicalPlacements = (sprintHistory || [])
      .map((sp: any) => {
        const st = Array.isArray(sp.standings)
          ? sp.standings.find(
              (r: any) =>
                r.id === member.id ||
                (r.name && member.name && r.name.toLowerCase() === member.name.toLowerCase())
            )
          : null;
        if (!st) return null;
        return {
          sprintId: sp.id,
          sprintNumber: sp.sprintNumber,
          sprintTitle: sp.sprintTitle,
          dateRange: sp.dateRange,
          rank: Number(st.rank) || 0,
          xp: Number(st.xp) || 0,
          studyMins: Number(st.studyMins) || 0,
          questions: Number(st.questions) || 0,
          title: st.title || ''
        };
      })
      .filter(Boolean) as Array<{
        sprintId: string;
        sprintNumber: number;
        sprintTitle: string;
        dateRange: string;
        rank: number;
        xp: number;
        studyMins: number;
        questions: number;
        title: string;
      }>;

    const championships = historicalPlacements.filter((h) => h.rank === 1);
    const podiums = historicalPlacements.filter((h) => h.rank >= 1 && h.rank <= 3);

    if (championships.length > 0) {
      pros.unshift(
        `Crowned #1 Weekly Champion in ${championships
          .map((c) => `Week ${c.sprintNumber} (${c.xp} XP)`)
          .join(', ')}.`
      );
    } else if (podiums.length > 0) {
      pros.unshift(
        `Historical Podium Finisher: ${podiums
          .map((p) => `#${p.rank} in Week ${p.sprintNumber} (${p.xp} XP)`)
          .join(', ')}.`
      );
    }

    if (pros.length === 0) {
      pros.push(`Active contender on the JEE Quant Index (${member.totalXp || 0} Career XP).`);
      pros.push(`Best suited for ${bestExamType} problem sets.`);
    }

    // Cons / Growth Opportunities
    if (worstSubject) {
      if (worstSubject.mins === 0 && worstSubject.solved === 0 && worstSubject.avgExamPct === 0) {
        cons.push(
          `Zero logged study time or practice questions in ${worstSubject.subject} — high priority syllabus gap.`
        );
      } else {
        cons.push(
          `Lowest relative volume in ${worstSubject.subject} (${formatMins(worstSubject.mins)}, ${worstSubject.solved} Qs${
            worstSubject.avgExamPct > 0 ? `, ${worstSubject.avgExamPct.toFixed(1)}%ile` : ''
          }) compared to ${bestSubject.subject}.`
        );
      }
    }
    if (memExams.length === 0) {
      cons.push(
        `No weekly mock exams logged yet — missing up to +300 Weekly Exam XP pool.`
      );
    } else if (avgPercentile < 85) {
      cons.push(
        `Room to push mock test standing (${avgPercentile.toFixed(1)}%ile) past the 90%ile tier via timed mock drills.`
      );
    }
    if (advSolved < 15) {
      cons.push(
        `Low JEE Advanced / Hard tier problem volume (${advSolved} Qs) — add 10–15 Advanced PYQs per week.`
      );
    }
    if (avgSessionMins > 0 && avgSessionMins < 40) {
      cons.push(
        `Short average session blocks (${avgSessionMins}m) — extending blocks to 60–90m unlocks Loot Crates & deeper retention.`
      );
    }
    if (cons.length === 0) {
      cons.push(
        `Maintain balanced subject rotation between ${bestSubject?.subject || 'Physics'} and ${worstSubject?.subject || 'Chemistry'}.`
      );
    }

    // Evaluate Badges
    const evaluatedBadges = safeBadges.map((b) => {
      const status = typeof b.check === 'function'
        ? b.check(member, safeSessions, safeExams, safeTasks)
        : { unlocked: false, progress: 0, target: 1, label: '0/1' };
      return { ...b, ...status };
    });

    // Multi-Timeframe Study Breakdown (1d, 3d, 7d, 14d, 30d, 90d, lifetime, custom)
    const nowMs = Date.now();
    const todayDateStr = new Date(nowMs).toISOString().split('T')[0];
    const manualOffsetMins = Number(member.manualMinutesOffset) || 0;

    const getSessionTs = (s: any): number => {
      const ts = Number(s.timestamp);
      if (ts && ts > 0) return ts;
      if (s.date) {
        const parsed = new Date(`${s.date}T12:00:00`).getTime();
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    };

    const computeWindowStats = (days: number | null) => {
      if (days === null) {
        const mins = Math.max(0, memSessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0) + manualOffsetMins);
        const solved = memSessions.reduce(
          (acc, s) => acc + (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
          0
        );
        const attempted = memSessions.reduce((acc, s) => acc + (Number(s.attemptedQuestions) || 0), 0);
        const xp = memSessions.reduce((acc, s) => acc + (Number(s.xpEarned) || 0), 0);
        const distinctDays = Math.max(
          1,
          new Set(memSessions.map((s) => s.date || new Date(getSessionTs(s)).toISOString().split('T')[0])).size
        );
        return {
          mins,
          solved,
          attempted,
          questions: solved + attempted,
          xp,
          sessionsCount: memSessions.length,
          avgPerDayMins: Math.round(mins / distinctDays),
          bySubject: subjectNames.map((subj) => {
            const subList = memSessions.filter((s) => (s.subject || '').toLowerCase() === subj.toLowerCase());
            return {
              subject: subj,
              mins: subList.reduce((acc, s) => acc + (Number(s.duration) || 0), 0),
              solved: subList.reduce(
                (acc, s) => acc + (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
                0
              ),
              sessionsCount: subList.length
            };
          })
        };
      }

      const safeDays = Math.max(1, days);
      const cutoffMs = nowMs - safeDays * 24 * 60 * 60 * 1000;
      const cutoffDateObj = new Date(nowMs - (safeDays - 1) * 24 * 60 * 60 * 1000);
      const cutoffDateStr = cutoffDateObj.toISOString().split('T')[0];

      const filtered = memSessions.filter((s) => {
        const ts = getSessionTs(s);
        if (safeDays === 1 && s.date === todayDateStr) return true;
        if (s.date && s.date >= cutoffDateStr) return true;
        return ts >= cutoffMs;
      });

      const rawMins = filtered.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
      const mins = safeDays >= 7 ? Math.max(0, rawMins + manualOffsetMins) : Math.max(0, rawMins);
      const solved = filtered.reduce(
        (acc, s) => acc + (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
        0
      );
      const attempted = filtered.reduce((acc, s) => acc + (Number(s.attemptedQuestions) || 0), 0);
      const xp = filtered.reduce((acc, s) => acc + (Number(s.xpEarned) || 0), 0);

      return {
        mins,
        solved,
        attempted,
        questions: solved + attempted,
        xp,
        sessionsCount: filtered.length,
        avgPerDayMins: Math.round(mins / safeDays),
        bySubject: subjectNames.map((subj) => {
          const subList = filtered.filter((s) => (s.subject || '').toLowerCase() === subj.toLowerCase());
          return {
            subject: subj,
            mins: subList.reduce((acc, s) => acc + (Number(s.duration) || 0), 0),
            solved: subList.reduce(
              (acc, s) => acc + (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
              0
            ),
            sessionsCount: subList.length
          };
        })
      };
    };

    const customDaysNum = Math.max(1, Math.min(3650, parseInt(customDaysInput, 10) || 5));
    const timeframes = {
      '1d': computeWindowStats(1),
      '3d': computeWindowStats(3),
      '7d': computeWindowStats(7),
      '14d': computeWindowStats(14),
      '30d': computeWindowStats(30),
      '90d': computeWindowStats(90),
      lifetime: computeWindowStats(null),
      custom: computeWindowStats(customDaysNum)
    };

    return {
      memSessions,
      memExams,
      subjectStats,
      bestSubject,
      worstSubject,
      avgPercentile,
      peakPercentile,
      bestExamType,
      bestExamTypeDetail,
      examTypeEntries,
      overallSolveAccuracy,
      avgSessionMins,
      totalMins,
      totalQuestions,
      pros,
      cons,
      evaluatedBadges,
      timeframes,
      customDaysNum,
      historicalPlacements,
      championships,
      podiums
    };
  }, [member, safeSessions, safeExams, safeTasks, safeBadges, sprintHistory, customDaysInput]);

  if (!member || !analytics) return null;

  const unlockedCount = analytics.evaluatedBadges.filter((b) => b.unlocked).length;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-y-auto animate-view"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl surface-card rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 sm:my-auto max-h-[92dvh] overflow-y-auto border-t sm:border border-sky-400/30 shadow-[0_28px_70px_rgba(0,0,0,0.95)] animate-modal pb-8 sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Bottom-Sheet Grab Handle Pill */}
        <div className="sm:hidden flex justify-center -mt-1 pb-1">
          <div className="w-11 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Top Dossier Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b border-white/10">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-b from-sky-400 to-cyan-500 text-slate-950 font-extrabold text-base sm:text-lg font-display flex items-center justify-center shadow-[0_0_24px_rgba(56,189,248,0.35)] shrink-0">
                #{rank}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h2 className="text-base sm:text-xl font-extrabold text-white font-display truncate">
                    {member.name}
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    {member.institute} · {member.weeklyMiniTitle || 'Scholar'}
                  </span>
                  {member.equippedTitle && (
                    <span className="text-[11px] text-sky-300 font-semibold">
                      · ★ {member.equippedTitle}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-slate-300 mt-1 font-mono-num">
                  <span>
                    Career: <strong className="text-sky-400">{member.totalXp} XP</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Sprint: <strong className="text-white">{member.weeklyXp} XP</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Streak: <strong className="text-cyan-300">{member.streakCount || 1}d</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Accuracy: <strong className="text-emerald-400">{analytics.overallSolveAccuracy}%</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white shrink-0 cursor-pointer"
              aria-label="Close dossier"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => onCompareWithSquad(member.id)}
              className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Compare with Squad</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Key Highlight Cards: Best Subject, Worst Subject, Avg Percentile, Best Exam Type */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/[0.07] border border-emerald-500/25 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold flex items-center justify-between">
              <span>Best Subject</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm sm:text-lg font-extrabold text-white font-display truncate">
              {analytics.bestSubject?.subject || 'Physics'}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 font-mono-num truncate">
              {formatMins(analytics.bestSubject?.mins || 0)} · {analytics.bestSubject?.solved || 0} Qs
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-500/[0.07] border border-rose-500/25 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-rose-300 font-bold flex items-center justify-between">
              <span>Needs Focus</span>
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-sm sm:text-lg font-extrabold text-white font-display truncate">
              {analytics.worstSubject?.subject || 'Chemistry'}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 font-mono-num truncate">
              {formatMins(analytics.worstSubject?.mins || 0)} · {analytics.worstSubject?.solved || 0} Qs
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-sky-500/[0.07] border border-sky-500/25 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-sky-300 font-bold flex items-center justify-between">
              <span>Avg Percentile</span>
              <Target className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-sm sm:text-lg font-extrabold text-white font-mono-num">
              {analytics.avgPercentile > 0 ? `${analytics.avgPercentile.toFixed(1)}%ile` : 'No Mocks'}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 font-mono-num truncate">
              {analytics.peakPercentile > 0
                ? `Peak: ${analytics.peakPercentile.toFixed(1)}%ile (${analytics.memExams.length} tests)`
                : 'Log mock test to calibrate'}
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-500/[0.08] border border-indigo-400/25 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold flex items-center justify-between">
              <span>Best Exam Type</span>
              <Trophy className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-sm sm:text-lg font-extrabold text-white font-display truncate">
              {analytics.bestExamType}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 truncate">
              {analytics.bestExamTypeDetail}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs inside Modal */}
        <div className="flex items-center gap-1 p-1 bg-black/50 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview' as const, label: 'Pros & Study', fullLabel: 'Pros, Cons & Summary' },
            { id: 'subjects' as const, label: 'Subjects & Exams', fullLabel: 'Subjects & Exam Format' },
            { id: 'logs' as const, label: `Logs (${analytics.memSessions.length + analytics.memExams.length})`, fullLabel: `Study & Exam Logs (${analytics.memSessions.length + analytics.memExams.length})` },
            { id: 'achievements' as const, label: `Badges (${unlockedCount}/${analytics.evaluatedBadges.length})`, fullLabel: `Achievements (${unlockedCount}/${analytics.evaluatedBadges.length})` }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveSection(t.id)}
              className={`flex-1 min-w-fit py-2 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeSection === t.id
                  ? 'bg-white text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="sm:hidden">{t.label}</span>
              <span className="hidden sm:inline">{t.fullLabel}</span>
            </button>
          ))}
        </div>

        {/* SECTION 1: PROS, CONS & STUDY OVERVIEW */}
        {activeSection === 'overview' && (
          <div className="space-y-4 animate-view">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pros Card */}
              <div className="p-4 rounded-2xl bg-black/45 border border-emerald-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Strengths &amp; Pros</span>
                  </span>
                  <span className="text-[10px] font-mono-num text-emerald-400">VERIFIED METRICS</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
                  {analytics.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold mt-0.5">+</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons Card */}
              <div className="p-4 rounded-2xl bg-black/45 border border-rose-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Weaknesses &amp; Growth Areas</span>
                  </span>
                  <span className="text-[10px] font-mono-num text-rose-400">ACTIONABLE DELTAS</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-200 leading-relaxed">
                  {analytics.cons.map((con, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold mt-0.5">−</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Historical Weekly Sprint Records (Weeks 1, 2 & 3 Official Results) */}
            {analytics.historicalPlacements && analytics.historicalPlacements.length > 0 && (
              <div className="p-4 rounded-2xl bg-black/45 border border-amber-400/25 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Official Historical Weekly Sprint Record (Weeks 1–3)</span>
                  </span>
                  <span className="text-[10px] font-mono-num text-slate-400">
                    {analytics.championships.length}x Champion · {analytics.podiums.length}x Podium
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {analytics.historicalPlacements.map((hp) => {
                    const isGold = hp.rank === 1;
                    const isSilver = hp.rank === 2;
                    const isBronze = hp.rank === 3;
                    return (
                      <div
                        key={hp.sprintId}
                        className={`p-3 rounded-xl border space-y-1.5 ${
                          isGold
                            ? 'bg-amber-500/12 border-amber-400/40'
                            : isSilver
                            ? 'bg-zinc-900/90 border-zinc-600/70'
                            : isBronze
                            ? 'bg-orange-500/10 border-orange-400/35'
                            : 'bg-white/[0.03] border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                            Week {hp.sprintNumber}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono-num font-black ${
                              isGold
                                ? 'bg-amber-400 text-slate-950'
                                : isSilver
                                ? 'bg-zinc-300 text-slate-950'
                                : isBronze
                                ? 'bg-orange-400/25 text-orange-200 border border-orange-400/40'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {isGold ? '🥇 #1 GOLD' : isSilver ? '🥈 #2 SILVER' : isBronze ? '🥉 #3 BRONZE' : `#${hp.rank}`}
                          </span>
                        </div>
                        <div className="text-sm font-black text-white font-mono-num">
                          {hp.xp} XP
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono-num flex items-center justify-between">
                          <span>{hp.studyMins > 0 ? formatMins(hp.studyMins) : hp.dateRange}</span>
                          {hp.questions > 0 && <span>{hp.questions} Qs</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact Capsule Study Duration Selector */}
            {(() => {
              const activeTf = analytics.timeframes[selectedTimeframe] || analytics.timeframes.lifetime;
              return (
                <div className="p-3 rounded-2xl bg-black/45 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mr-1">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>Study:</span>
                    </span>
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-black/60 border border-white/10">
                      {([
                        { id: '1d' as const, label: '1D' },
                        { id: '3d' as const, label: '3D' },
                        { id: '7d' as const, label: '7D' },
                        { id: '14d' as const, label: '14D' },
                        { id: '30d' as const, label: '1M' },
                        { id: 'lifetime' as const, label: 'Life' }
                      ]).map((tf) => {
                        const isSel = selectedTimeframe === tf.id;
                        return (
                          <button
                            key={tf.id}
                            type="button"
                            onClick={() => setSelectedTimeframe(tf.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              isSel
                                ? 'bg-sky-400 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {tf.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-white/10">
                      <input
                        type="number"
                        min={1}
                        max={3650}
                        value={customDaysInput}
                        onChange={(e) => {
                          setCustomDaysInput(e.target.value);
                          setSelectedTimeframe('custom');
                        }}
                        className="w-9 bg-transparent text-[10px] text-white font-mono-num text-center focus:outline-none"
                        title="Custom days"
                      />
                      <span className="text-[9.5px] text-slate-400">d</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono-num">
                    <span className="px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/35 text-white font-extrabold">
                      {formatMins(activeTf.mins)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-sky-300 font-bold">
                      {activeTf.questions} Qs
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-emerald-300 font-bold">
                      {formatMins(activeTf.avgPerDayMins)}/d
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* SECTION 2: SUBJECT & EXAM BREAKDOWN */}
        {activeSection === 'subjects' && (
          <div className="space-y-4 animate-view">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analytics.subjectStats.map((st) => {
                const isBest = st.subject === analytics.bestSubject?.subject;
                const isWorst = st.subject === analytics.worstSubject?.subject;
                const maxMins = Math.max(60, ...analytics.subjectStats.map((x) => x.mins));
                const barPct = Math.min(100, Math.round((st.mins / maxMins) * 100));

                return (
                  <div
                    key={st.subject}
                    className={`p-4 rounded-2xl bg-black/45 border space-y-2.5 ${
                      isBest
                        ? 'border-emerald-500/35'
                        : isWorst
                        ? 'border-rose-500/30'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-display">{st.subject}</span>
                        {isBest && (
                          <span className="text-[10px] text-emerald-300 font-semibold">· Best Subject</span>
                        )}
                        {isWorst && !isBest && (
                          <span className="text-[10px] text-rose-300 font-semibold">· Needs Focus</span>
                        )}
                      </div>
                      <span className="text-xs font-mono-num font-bold text-sky-400">
                        {st.xp} XP
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isBest
                            ? 'bg-emerald-400'
                            : isWorst
                            ? 'bg-rose-400'
                            : 'bg-sky-400'
                        }`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 font-mono-num pt-1">
                      <div>
                        <span className="text-slate-500 block text-[9.5px]">STUDY TIME</span>
                        <strong className="text-white">{formatMins(st.mins)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9.5px]">SOLVED (RATE)</span>
                        <strong className="text-white">
                          {st.solved} Qs ({st.accuracy}%)
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9.5px]">EXAM %ILE</span>
                        <strong className="text-sky-300">
                          {st.avgExamPct > 0 ? `${st.avgExamPct.toFixed(1)}%` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Exam Type Performance Summary */}
            <div className="p-4 rounded-2xl bg-black/45 border border-white/10 space-y-2.5">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <span>Performance by Exam Format (Mains vs Advanced)</span>
                <span className="text-[11px] text-sky-400 font-mono-num">
                  Best Format: {analytics.bestExamType}
                </span>
              </div>
              {analytics.examTypeEntries.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No formal mock exams logged yet. Best format ({analytics.bestExamType}) inferred from {analytics.totalQuestions} solved practice questions.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {analytics.examTypeEntries.map((et) => (
                    <div
                      key={et.type}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{et.type}</div>
                        <div className="text-[10px] text-slate-400 font-mono-num">
                          {et.count} test(s) · Peak {et.bestPct.toFixed(1)}%ile
                        </div>
                      </div>
                      <div className="text-sm font-extrabold text-sky-400 font-mono-num">
                        {et.avgPct.toFixed(1)}%ile
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2.5: STUDY & EXAM LOGS (SELF-SERVICE EDIT & DELETE) */}
        {activeSection === 'logs' && (
          <div className="space-y-4 animate-view">
            {/* Mock Exam History */}
            <div className="p-4 rounded-2xl bg-black/45 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Logged Mock Exams ({analytics.memExams.length})</span>
                </span>
                {canManageLogs && (
                  <span className="text-[10px] text-slate-400">Click Edit or Delete to modify</span>
                )}
              </div>
              {analytics.memExams.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No mock exams logged yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {analytics.memExams.map((ex: any) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{ex.title}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-300">{ex.examType || 'JEE Mains'}</span>
                          <span className="text-[10px] text-slate-400 font-mono-num">{ex.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-num mt-0.5">
                          Score: <strong className="text-white">{ex.overallMarks}/{ex.overallMaxMarks}</strong> · Rank #{ex.overallRank}/{ex.totalStudents} · <strong className="text-amber-400">{Number(ex.overallPercentile || 0).toFixed(1)}%ile</strong>
                        </div>
                      </div>
                      {canManageLogs && (onEditExam || onDeleteExam) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {onEditExam && (
                            <button
                              type="button"
                              onClick={() => onEditExam(ex)}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          )}
                          {onDeleteExam && (
                            <button
                              type="button"
                              onClick={() => onDeleteExam(ex.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Study Sessions History */}
            <div className="p-4 rounded-2xl bg-black/45 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Logged Study Sessions ({analytics.memSessions.length})</span>
                </span>
                {canManageLogs && (
                  <span className="text-[10px] text-slate-400">Self-service edit &amp; delete enabled</span>
                )}
              </div>
              {analytics.memSessions.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No study sessions logged yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {analytics.memSessions.map((s: any) => {
                    const solvedVal = s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : (Number(s.questions) || 0);
                    const attemptedVal = Number(s.attemptedQuestions) || 0;
                    return (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-300 font-bold text-[11px]">
                              {s.subject}
                            </span>
                            <span className="font-mono-num font-bold text-white">{formatMins(s.duration)}</span>
                            <span className="text-emerald-400 font-mono-num font-semibold">+{s.xpEarned} XP</span>
                            {s.date && <span className="text-[10px] text-slate-500 font-mono-num">{s.date}</span>}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 truncate">
                            <span>{solvedVal} Solved{attemptedVal > 0 ? ` · ${attemptedVal} Attempted` : ''} ({s.difficulty || 'mains'})</span>
                            {s.notes && <span className="text-slate-400"> · {s.notes}</span>}
                          </div>
                        </div>
                        {canManageLogs && (onEditSession || onDeleteSession) && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onEditSession && (
                              <button
                                type="button"
                                onClick={() => onEditSession(s)}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                            {onDeleteSession && (
                              <button
                                type="button"
                                onClick={() => onDeleteSession(s.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
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

        {/* SECTION 3: ACHIEVEMENTS & BADGES */}
        {activeSection === 'achievements' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-view">
            {analytics.evaluatedBadges.map((b) => {
              const pct = Math.min(100, Math.round((b.progress / Math.max(1, b.target)) * 100));
              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    b.unlocked
                      ? 'bg-sky-500/[0.08] border-sky-400/35'
                      : 'bg-black/40 border-white/[0.07] opacity-70'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/15 flex items-center justify-center text-lg shrink-0">
                    {b.icon}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{b.title}</span>
                      <span
                        className={`text-[10px] font-mono-num font-bold ${
                          b.unlocked ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {b.unlocked ? 'UNLOCKED' : b.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{b.description}</p>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          b.unlocked ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
