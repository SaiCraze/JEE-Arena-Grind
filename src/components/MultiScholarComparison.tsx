import React, { useMemo, useState } from 'react';
import {
  BarChart3, Clock, Target, Trophy, Zap, Flame, CheckCircle2,
  AlertTriangle, BookOpen, Users, Layers, TrendingUp
} from 'lucide-react';

interface MultiScholarComparisonProps {
  members: any[];
  leaderboardStats?: any[];
  sessions: any[];
  exams: any[];
  selectedIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
  onInspectScholar?: (memberId: string) => void;
}

type CompareScope = 'all' | 'study' | 'exams' | 'subjects' | 'pros_cons';
type FocusMetricKey =
  | 'totalXp'
  | 'weeklyXp'
  | 'cycle3Xp'
  | 'cycle2Xp'
  | 'prevWeeklyXp'
  | 'totalStudyMins'
  | 'totalQuestions'
  | 'accuracy'
  | 'avgSessionMins'
  | 'streakCount'
  | 'avgPercentile'
  | 'raidDamage';

const SCHOLAR_PALETTE = [
  { bar: 'bg-sky-400', text: 'text-sky-400', border: 'border-sky-400/40', badge: 'bg-sky-500/15 text-sky-300' },
  { bar: 'bg-emerald-400', text: 'text-emerald-400', border: 'border-emerald-400/40', badge: 'bg-emerald-500/15 text-emerald-300' },
  { bar: 'bg-indigo-400', text: 'text-indigo-400', border: 'border-indigo-400/40', badge: 'bg-indigo-500/15 text-indigo-300' },
  { bar: 'bg-cyan-300', text: 'text-cyan-300', border: 'border-cyan-300/40', badge: 'bg-cyan-500/15 text-cyan-200' },
  { bar: 'bg-violet-400', text: 'text-violet-400', border: 'border-violet-400/40', badge: 'bg-violet-500/15 text-violet-300' },
  { bar: 'bg-teal-400', text: 'text-teal-400', border: 'border-teal-400/40', badge: 'bg-teal-500/15 text-teal-300' }
];

export const MultiScholarComparison: React.FC<MultiScholarComparisonProps> = ({
  members = [],
  leaderboardStats,
  sessions = [],
  exams = [],
  selectedIds = [],
  onChangeSelectedIds,
  onInspectScholar
}) => {
  const [compareScope, setCompareScope] = useState<CompareScope>('all');
  const [focusMetric, setFocusMetric] = useState<FocusMetricKey>('totalStudyMins');

  const safeStats = useMemo(
    () => leaderboardStats || members || [],
    [leaderboardStats, members]
  );

  const formatMins = (mins: number) => {
    const m = Math.max(0, Math.round(mins || 0));
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (h === 0) return `${rem}m`;
    if (rem === 0) return `${h}h`;
    return `${h}h ${rem}m`;
  };

  const toggleScholar = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // keep at least 1 selected
      onChangeSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      onChangeSelectedIds([...selectedIds, id]);
    }
  };

  const selectAllScholars = () => {
    onChangeSelectedIds(members.map((m) => m.id));
  };

  // Compute full study + exam profile for each selected scholar
  const profiles = useMemo(() => {
    const activeIds = selectedIds.length > 0 ? selectedIds : members.map((m) => m.id);
    return activeIds
      .map((id, idx) => {
        const mem = members.find((m) => m && m.id === id);
        if (!mem) return null;
        const stat = safeStats.find((s) => s && s.id === id) || mem;
        const memSessions = (sessions || []).filter((s) => s && s.memberId === id && s.sessionType !== 'BREAK');
        const memExams = (exams || []).filter((e) => e && e.memberId === id);

        const totalStudyMins = Number(stat.totalStudyMins) || 0;
        const weekStudyMins = Number(stat.weekStudyMins) || 0;
        const totalQuestions = Number(stat.totalQuestions) || 0;
        const weekQuestions = Number(stat.weekQuestions) || 0;

        const solved = memSessions.reduce(
          (acc, s) =>
            acc +
            (s.solvedQuestions !== undefined ? Number(s.solvedQuestions) : Number(s.questions) || 0),
          0
        );
        const attempted = memSessions.reduce(
          (acc, s) => acc + (Number(s.attemptedQuestions) || 0),
          0
        );
        const accuracy =
          solved + attempted > 0
            ? Math.round((solved / (solved + attempted)) * 100)
            : totalQuestions > 0
            ? 100
            : 0;

        const avgSessionMins =
          memSessions.length > 0 ? Math.round(totalStudyMins / memSessions.length) : 0;

        const avgPercentile =
          memExams.length > 0
            ? memExams.reduce((acc, e) => acc + (Number(e.overallPercentile) || 0), 0) /
              memExams.length
            : Number(stat.weekAvgPercentile) || 0;

        const peakPercentile =
          memExams.length > 0
            ? Math.max(...memExams.map((e) => Number(e.overallPercentile) || 0))
            : avgPercentile;

        // Subject breakdown (Study + Exam)
        const subjects = ['Physics', 'Chemistry', 'Math'];
        const subjectMap: Record<
          string,
          { mins: number; solved: number; xp: number; examPct: number; score: number }
        > = {};

        subjects.forEach((subj) => {
          const sList = memSessions.filter(
            (s) => (s.subject || '').toLowerCase() === subj.toLowerCase()
          );
          const mins = sList.reduce((a, b) => a + (Number(b.duration) || 0), 0);
          const q = sList.reduce(
            (a, b) =>
              a +
              (b.solvedQuestions !== undefined
                ? Number(b.solvedQuestions)
                : Number(b.questions) || 0),
            0
          );
          const xp = sList.reduce((a, b) => a + (Number(b.xpEarned) || 0), 0);
          const exSubs = memExams.flatMap((e) =>
            (e.subjects || []).filter(
              (es: any) => (es.name || '').toLowerCase() === subj.toLowerCase()
            )
          );
          const examPct =
            exSubs.length > 0
              ? exSubs.reduce((a, es: any) => a + (Number(es.percentile) || 0), 0) / exSubs.length
              : 0;
          subjectMap[subj] = {
            mins,
            solved: q,
            xp,
            examPct,
            score: xp * 1.4 + mins * 0.6 + q * 1.8 + examPct * 2
          };
        });

        const sortedSubjs = [...subjects].sort(
          (a, b) => (subjectMap[b]?.score || 0) - (subjectMap[a]?.score || 0)
        );
        const bestSubject = sortedSubjs[0] || 'Physics';
        const worstSubject = sortedSubjs[sortedSubjs.length - 1] || 'Chemistry';

        // Best Exam Type
        const typeCounts: Record<string, { sum: number; count: number }> = {};
        memExams.forEach((e) => {
          const t = e.examType || 'JEE Mains';
          if (!typeCounts[t]) typeCounts[t] = { sum: 0, count: 0 };
          typeCounts[t].sum += Number(e.overallPercentile) || 0;
          typeCounts[t].count += 1;
        });
        const bestExamType =
          Object.entries(typeCounts).sort(
            (a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count
          )[0]?.[0] || (stat.hardAdvQsThisWeek >= 15 ? 'JEE Advanced' : 'JEE Mains');

        return {
          id,
          name: mem.name,
          institute: mem.institute,
          palette: SCHOLAR_PALETTE[idx % SCHOLAR_PALETTE.length],
          totalXp: Number(stat.totalXp) || 0,
          weeklyXp: Number(stat.weeklyXp) || 0,
          cycle3Xp: Number(stat.cycle3Xp) || 0,
          cycle2Xp: Number(stat.cycle2Xp) || 0,
          prevWeeklyXp: Number(stat.prevWeeklyXp) || 0,
          totalStudyMins,
          weekStudyMins,
          totalQuestions,
          weekQuestions,
          sessionsCount: memSessions.length,
          accuracy,
          avgSessionMins,
          streakCount: Number(stat.streakCount) || 1,
          raidDamage: Number(stat.raidDamageContributed) || 0,
          avgPercentile,
          peakPercentile,
          examsCount: memExams.length,
          bestSubject,
          worstSubject,
          bestExamType,
          subjectMap
        };
      })
      .filter(Boolean) as any[];
  }, [members, safeStats, sessions, exams, selectedIds]);

  const metricDefinitions: Array<{
    key: FocusMetricKey;
    label: string;
    category: 'study' | 'exams';
    format: (v: number) => string;
  }> = [
    { key: 'totalStudyMins', label: 'Total Study Time', category: 'study', format: (v) => formatMins(v) },
    { key: 'totalQuestions', label: 'Questions Solved', category: 'study', format: (v) => `${v} Qs` },
    { key: 'totalXp', label: 'Career XP', category: 'study', format: (v) => `${v} XP` },
    { key: 'weeklyXp', label: 'Active Week 4 XP', category: 'study', format: (v) => `${v} XP` },
    { key: 'cycle3Xp', label: 'Week 3 (Cycle 3) XP', category: 'study', format: (v) => `${v} XP` },
    { key: 'cycle2Xp', label: 'Week 2 (Cycle 2) XP', category: 'study', format: (v) => `${v} XP` },
    { key: 'prevWeeklyXp', label: 'Week 1 (Cycle 1) XP', category: 'study', format: (v) => `${v} XP` },
    { key: 'accuracy', label: 'Solve Accuracy %', category: 'study', format: (v) => `${v}%` },
    { key: 'avgSessionMins', label: 'Avg Session Block', category: 'study', format: (v) => formatMins(v) },
    { key: 'streakCount', label: 'Active Streak', category: 'study', format: (v) => `${v}d` },
    { key: 'raidDamage', label: 'Boss Raid Damage', category: 'study', format: (v) => `${v} HP` },
    { key: 'avgPercentile', label: 'Avg Exam Percentile', category: 'exams', format: (v) => `${v.toFixed(1)}%ile` }
  ];

  const activeMetricDef =
    metricDefinitions.find((m) => m.key === focusMetric) || metricDefinitions[0];

  const maxFocusVal = Math.max(
    1,
    ...profiles.map((p) => Number(p[activeMetricDef.key]) || 0)
  );

  return (
    <div className="surface-card rounded-3xl p-4 sm:p-6 space-y-6 border border-white/10 animate-view">
      {/* Header & Multi-Student Selector */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Multi-Scholar Study &amp; Exam Comparison Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select 2, 3, 4, or all scholars and choose which study or exam dimensions to compare side-by-side.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={selectAllScholars}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Compare All ({members.length})
            </button>
          </div>
        </div>

        {/* Multi-Select Scholar Chips */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>1. Select Scholars to Compare ({profiles.length} selected)</span>
            <span className="text-[10px] text-slate-500">Click any scholar to toggle</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = selectedIds.includes(m.id);
              const stat = safeStats.find((s) => s && s.id === m.id) || m;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleScholar(m.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-400/50 text-white shadow-sm'
                      : 'bg-black/40 border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/20'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      isSelected ? 'bg-sky-400 text-slate-950' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {isSelected ? '✓' : m.name[0]}
                  </span>
                  <span>{m.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono-num">
                    {stat?.totalXp || 0} XP
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dimension Filter Bar: What to Compare */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400">
            2. Choose What to Compare
          </div>
          <div className="flex sm:flex-wrap gap-1.5 p-1 bg-black/50 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
            {[
              { id: 'all' as const, label: 'Full Spectrum (Study + Exams)' },
              { id: 'study' as const, label: 'Study Performance (Hours, Qs, Accuracy)' },
              { id: 'exams' as const, label: 'Mock Exams & Percentiles' },
              { id: 'subjects' as const, label: 'Subject-by-Subject Mastery' },
              { id: 'pros_cons' as const, label: 'Pros, Cons & Best Formats' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCompareScope(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  compareScope === tab.id
                    ? 'bg-white text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Metric Spotlight Visualizer */}
      {(compareScope === 'all' || compareScope === 'study' || compareScope === 'exams') && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-black/45 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Interactive Metric Bar Comparison
              </span>
              <p className="text-[11px] text-slate-400">
                Select any study or exam metric below to rank all {profiles.length} selected scholars.
              </p>
            </div>
            <div className="flex sm:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
              {metricDefinitions
                .filter((m) =>
                  compareScope === 'study'
                    ? m.category === 'study'
                    : compareScope === 'exams'
                    ? m.category === 'exams'
                    : true
                )
                .map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setFocusMetric(m.key)}
                    className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      focusMetric === m.key
                        ? 'bg-sky-400 text-slate-950 font-bold'
                        : 'bg-white/[0.05] text-slate-300 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {[...profiles]
              .sort(
                (a, b) =>
                  (Number(b[activeMetricDef.key]) || 0) - (Number(a[activeMetricDef.key]) || 0)
              )
              .map((p, rankIdx) => {
                const val = Number(p[activeMetricDef.key]) || 0;
                const widthPct = Math.max(4, Math.min(100, Math.round((val / maxFocusVal) * 100)));
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono-num text-slate-400 font-bold w-5">
                          #{rankIdx + 1}
                        </span>
                        <span className="font-bold text-white">{p.name}</span>
                        <span className="text-[10px] text-slate-400">({p.institute})</span>
                      </div>
                      <span className={`font-mono-num font-bold ${p.palette.text}`}>
                        {activeMetricDef.format(val)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${p.palette.bar}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* STUDY PERFORMANCE SIDE-BY-SIDE MATRIX */}
      {(compareScope === 'all' || compareScope === 'study') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Study Performance Breakdown Across Selected Scholars</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono-num">
              Hours · Questions · Solve Rate · Consistency
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                  <th className="py-3 px-4 font-semibold">Scholar</th>
                  <th className="py-3 px-3 font-semibold text-right">Total Study</th>
                  <th className="py-3 px-3 font-semibold text-right">Weekly Study</th>
                  <th className="py-3 px-3 font-semibold text-right">Solved Qs</th>
                  <th className="py-3 px-3 font-semibold text-right">Accuracy</th>
                  <th className="py-3 px-3 font-semibold text-right">Week 3 XP</th>
                  <th className="py-3 px-3 font-semibold text-right">Streak</th>
                  <th className="py-3 px-4 font-semibold text-right">Career XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] font-mono-num">
                {profiles.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onInspectScholar && onInspectScholar(p.id)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.institute}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white">
                      {formatMins(p.totalStudyMins)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {formatMins(p.weekStudyMins)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-sky-400">
                      {p.totalQuestions} Qs
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                      {p.accuracy}%
                    </td>
                    <td className="py-3 px-3 text-right text-amber-300 font-bold">
                      {p.cycle3Xp} XP
                    </td>
                    <td className="py-3 px-3 text-right text-cyan-300 font-bold">
                      {p.streakCount}d
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      {p.totalXp} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBJECT-WISE STUDY + EXAM COMPARISON */}
      {(compareScope === 'all' || compareScope === 'subjects' || compareScope === 'exams') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Subject-Wise Study Volume &amp; Standardized Exam Percentiles</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {['Physics', 'Chemistry', 'Math'].map((subj) => {
              const maxSubjMins = Math.max(
                30,
                ...profiles.map((p) => p.subjectMap[subj]?.mins || 0)
              );
              return (
                <div
                  key={subj}
                  className="p-4 rounded-2xl bg-black/45 border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <span className="text-sm font-bold text-white font-display">{subj}</span>
                    <span className="text-[10px] text-slate-400 font-mono-num">
                      Study Time · Qs · Exam %ile
                    </span>
                  </div>

                  <div className="space-y-3">
                    {profiles.map((p) => {
                      const st = p.subjectMap[subj] || { mins: 0, solved: 0, examPct: 0 };
                      const pctWidth =
                        compareScope === 'exams'
                          ? Math.min(100, Math.round(st.examPct))
                          : Math.min(100, Math.round((st.mins / maxSubjMins) * 100));
                      return (
                        <div key={p.id} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{p.name}</span>
                            <span className="font-mono-num text-[11px] text-slate-300">
                              <strong className="text-white">{formatMins(st.mins)}</strong> ·{' '}
                              <span className="text-sky-400">{st.solved} Qs</span>
                              {st.examPct > 0 && (
                                <span className="text-emerald-400">
                                  {' '}
                                  · {st.examPct.toFixed(1)}%ile
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${p.palette.bar}`}
                              style={{ width: `${Math.max(4, pctWidth)}%` }}
                            />
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
      )}

      {/* PROS, CONS, BEST SUBJECT & BEST EXAM FORMAT CARDS ACROSS ALL SELECTED SCHOLARS */}
      {(compareScope === 'all' || compareScope === 'pros_cons') && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-sky-400" />
            <span>Scholar Strengths, Weaknesses &amp; Optimal Exam Format</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {profiles.map((p) => (
              <div
                key={p.id}
                onClick={() => onInspectScholar && onInspectScholar(p.id)}
                className="p-4 rounded-2xl bg-black/45 border border-white/10 hover:border-sky-400/40 transition-all space-y-3 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white font-display">{p.name}</div>
                    <div className="text-[10px] text-slate-400">{p.institute}</div>
                  </div>
                  <span className="text-xs font-mono-num font-bold text-sky-400">
                    {p.avgPercentile > 0 ? `${p.avgPercentile.toFixed(1)}%ile` : `${p.totalXp} XP`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20">
                    <span className="text-[9.5px] text-emerald-300 uppercase font-bold block">
                      Best Subject
                    </span>
                    <strong className="text-white font-display">{p.bestSubject}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-500/[0.07] border border-rose-500/20">
                    <span className="text-[9.5px] text-rose-300 uppercase font-bold block">
                      Needs Focus
                    </span>
                    <strong className="text-white font-display">{p.worstSubject}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.06]">
                  <span className="text-slate-400">Best Exam Type:</span>
                  <strong className="text-sky-300 font-semibold">{p.bestExamType}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
