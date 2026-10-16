import React, { useState } from 'react';
import {
  X, BookOpen, Zap, Swords, Scale, Sparkles, Shield, Package,
  Trophy, Clock, CheckCircle2, Flame, History
} from 'lucide-react';

interface ArenaGuideModalProps {
  onClose: () => void;
}

export const ArenaGuideModal: React.FC<ArenaGuideModalProps> = ({ onClose }) => {
  const [section, setSection] = useState<'xp' | 'raid' | 'fairness' | 'howto' | 'changelog'>('xp');

  const tabs = [
    { id: 'xp' as const, label: 'XP & Ranks', icon: Zap },
    { id: 'raid' as const, label: 'Dragon Raids', icon: Swords },
    { id: 'fairness' as const, label: 'Fairness Rules', icon: Scale },
    { id: 'howto' as const, label: 'How to Use', icon: BookOpen },
    { id: 'changelog' as const, label: 'Changelog', icon: History }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-[#111216] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-display">
                JEE Grind Arena Codex & Official Guide
              </h2>
              <p className="text-[11px] text-zinc-400">
                Complete breakdown of XP formulas, Dragon Boss damage, coaching fairness, and updates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="px-4 sm:px-5 py-2.5 bg-zinc-950/40 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  active
                    ? 'bg-orange-500 text-zinc-950 font-bold'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs leading-relaxed text-zinc-300">
          {section === 'xp' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">How Weekly & Career XP Are Calculated</h3>
                <p className="text-zinc-400 mt-0.5">
                  Every study block, practice problem, and coaching mock test feeds directly into your Weekly Podium Score and Career XP.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orange-400" />
                      <span>Focused Study Time</span>
                    </span>
                    <span className="font-mono-num font-bold text-orange-400">+10 XP / 30m</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Every 30 minutes of logged study grants 10 XP (20 XP per hour). Breaks grant 0 XP.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Coaching Mock Exams</span>
                    </span>
                    <span className="font-mono-num font-bold text-amber-400">Up to +300 XP</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Your standardized batch percentile is multiplied by 3.0 (e.g., 96.0%ile = 288 XP). Capped at 150 XP if the weekly Raid Boss is not defeated.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2.5">
                <div className="font-bold text-white">Question Difficulty Multipliers</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-emerald-400 font-bold">Easy / Drill</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">0.8x XP / Q</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-blue-400 font-bold">Mains / Med</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">1.2x XP / Q</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-amber-400 font-bold">Hard Drill</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">1.8x XP / Q</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-rose-400 font-bold">JEE Advanced</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">2.5x XP / Q</div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Anti-inflation cap: Question XP per session is sensibly bounded at 60 XP per hour of study + 25 baseline XP so speed-spamming 200 trivial questions in 5 minutes cannot exploit the standings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mystery Loot Crates (90m+ Sessions)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Logging any single focused study session of 90 minutes or longer drops an interactive Mystery Crate containing +10/+15 Instant Bonus XP, Rare Profile Titles, or a 12-Hour Stealth Perk.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span>Login Streaks & XP Multipliers</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Maintain 3d, 7d, 10d, 14d, up to 365d daily logging streaks to earn up to 5x XP multipliers on all study logs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'raid' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">Syllabus-Agnostic Co-op Dragon Raids</h3>
                <p className="text-zinc-400 mt-0.5">
                  Starts Monday, October 19, 2026 at 12:00 AM and runs every week until Sunday at 6:00 PM.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2">
                <div className="font-bold text-white">How Your Study Chips Away Boss HP</div>
                <p className="text-[11px] text-zinc-400">
                  Even when Modulus and Allen are covering completely different chapters, every minute you study and every question you solve strikes the active Dragon Boss:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center font-mono-num">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-[10px] text-zinc-400">Study Time</div>
                    <div className="text-xs font-bold text-orange-400">2 DMG / min</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-[10px] text-zinc-400">Easy Q</div>
                    <div className="text-xs font-bold text-emerald-400">2 DMG / Q</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-[10px] text-zinc-400">Mains Q</div>
                    <div className="text-xs font-bold text-blue-400">4 DMG / Q</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-[10px] text-zinc-400">Hard Q</div>
                    <div className="text-xs font-bold text-amber-400">8 DMG / Q</div>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                    <div className="text-[10px] text-zinc-400">Advanced Q</div>
                    <div className="text-xs font-bold text-rose-400">12 DMG / Q</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-1.5">
                <div className="font-bold text-white">Sunday 6:00 PM Deadline & Method 1 Deferred Exam Debt</div>
                <p className="text-[11px] text-zinc-400">
                  If the squad defeats the boss before Sunday 6:00 PM, everyone unlocks the full 300 XP Exam Pool. If the boss survives past Sunday 6:00 PM, the Exam Pool is capped at 150 XP. Because Ved writes Allen tests on an alternating bi-weekly schedule, if a raid fails on his off-week, his 150 XP cap is cleanly carried over via Method 1 Deferred Exam Debt to his next test week so nobody dodges the penalty.
                </p>
              </div>
            </div>
          )}

          {section === 'fairness' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">Cross-Institute Fairness Protocol</h3>
                <p className="text-zinc-400 mt-0.5">
                  Engineered specifically so Sai & Nishchit (Modulus) and Ved (Allen) compete on a 100% level playing field.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10">
                  <div className="font-bold text-white">1. Batch-Size Normalized Percentile</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Raw ranks are never compared directly because Allen and Modulus have different cohort sizes. Instead, we compute exact percentile: <code className="text-orange-300">(1 - (Rank - 1) / TotalStudents) * 100</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10">
                  <div className="font-bold text-white">2. Active Standing Carry-Over</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    When Ved has an off-week with no scheduled Allen test, his most recent verified exam percentile remains in active standing so he does not drop 300 XP automatically.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10">
                  <div className="font-bold text-white">3. Underdog Comeback Buff (1.25x XP)</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    If any member falls more than 150 XP behind the #1 weekly leader, they automatically receive a 1.25x multiplier on all study time and questions solved until they close the gap.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10">
                  <div className="font-bold text-white">4. Guilt-Free Rest Day Shield</div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Everyone receives 1 Rest Token every Monday. Tapping the Rest Shield on your player card protects your daily login streak for 24 hours if you hit burnout or have a family day.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'howto' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white font-display">Quick-Start Workflow</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white">1. Live Stopwatch or Manual Log</div>
                  <p className="text-[11px] text-zinc-400">
                    Use the Tracker tab while studying (syncs across phone & laptop and stays alive on lock screen) or click "+ Log Study" in the header to log completed blocks and question counts.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white">2. Buzz Friends with Retro Nudge</div>
                  <p className="text-[11px] text-zinc-400">
                    See a squadmate slacking off? Click "Nudge" on their leaderboard card to fire a Modulus-to-Allen retro buzzer alert to their feed and phone.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white">3. Log Coaching Mock Exams</div>
                  <p className="text-[11px] text-zinc-400">
                    Click "Log Exam" on the Arena tab after your coaching test results drop. Enter your rank and batch size to lock in your weekly Exam XP and trigger an AI test-to-test diagnostic.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 space-y-1">
                  <div className="font-bold text-white">4. Friday Blind Mode & Sunday Reveal</div>
                  <p className="text-[11px] text-zinc-400">
                    Every Friday at 11:59 PM, the leaderboard enters Blind Mode to build suspense until the Sunday night Podium Reveal ceremony.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'changelog' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-zinc-950 border border-orange-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-400">October 2026 Overhaul (Raid Dragon & Obsidian UI)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-bold">LATEST</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-zinc-300 list-disc pl-4">
                  <li>Added animated SVG Dragon Boss perched above the HP bar with slash/recoil hit physics and a full-screen Boss Entrance Unveil ceremony.</li>
                  <li>Scheduled Co-op Raid Bosses to start automatically from Monday, October 19, 2026 at 12:00 AM and end Sunday at 6:00 PM.</li>
                  <li>Raid Boss box now hides cleanly when disabled or inactive, with full Admin controls to toggle ON/OFF, pick any boss, and edit Max/Current HP.</li>
                  <li>Added this official Arena Guide & Codex inside the Profile Menu.</li>
                  <li>Removed algorithmic mini-titles for a cleaner, high-signal leaderboard.</li>
                  <li>Redesigned the entire interface with a cohesive Obsidian dark-mode layout across desktop and mobile.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-zinc-950/60 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">Accessible anytime via Profile Menu &rarr; Arena Guide & Rules</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-xs transition-all"
          >
            Got It, Let's Grind
          </button>
        </div>
      </div>
    </div>
  );
};