import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Zap,
  Swords,
  Scale,
  Shield,
  Package,
  Trophy,
  Clock,
  History,
  Sparkles,
  Award,
  Crosshair,
  Crown,
  Link as LinkIcon,
  EyeOff,
  FileSearch,
  Volume2,
  Edit3,
  Skull,
  CheckCircle2,
  Lock
} from 'lucide-react';

export type GuideSectionId = 'xp' | 'warfare' | 'raid' | 'fairness' | 'howto' | 'changelog';

interface ArenaGuideModalProps {
  isOpen?: boolean;
  initialSection?: GuideSectionId;
  onClose: () => void;
}

export const ArenaGuideModal: React.FC<ArenaGuideModalProps> = ({
  isOpen = true,
  initialSection = 'xp',
  onClose
}) => {
  const [section, setSection] = useState<GuideSectionId>(initialSection);

  useEffect(() => {
    if (isOpen && initialSection) {
      setSection(initialSection);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const tabs: Array<{ id: GuideSectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'xp', label: 'Core XP Methodology', icon: Zap },
    { id: 'warfare', label: 'Tactical Warfare & Blackout', icon: Crosshair },
    { id: 'raid', label: 'Co-op Boss Raids', icon: Swords },
    { id: 'fairness', label: 'Fairness & Multipliers', icon: Scale },
    { id: 'howto', label: 'Arena Workflow', icon: BookOpen },
    { id: 'changelog', label: 'Changelog', icon: History }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#05070E]/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl surface-card rounded-3xl border border-slate-800/90 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] animate-modal">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between bg-[#060913]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white font-display">
                JEE Grind Arena - Official Index Methodology &amp; Codex
              </h2>
              <p className="text-[11px] text-slate-400">
                Complete technical methodology for XP currency, Tactical Warfare, Blood Pacts, Friday Blackout, and Raid Bosses
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#050811]/80 border-b border-slate-800/90 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = section === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs leading-relaxed text-slate-300">
          {section === 'xp' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">
                  1. Quantitative XP Ledger &amp; Spendable Standing Currency
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Every study block, practice question, coaching mock test, and graded faculty assignment builds your Weekly Sprint XP and Career XP. Crucially, your live Weekly XP also acts as your spendable tactical currency in the Arena.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Live Leaderboard XP = Spendable Currency</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  There is no separate secondary coin balance. When you spend XP in the Black Market, wager XP in a 1v1 Quickdraw Duel, or pay the 50 XP Robin Hood Ambush entry fee, that cost is deducted directly from your live Weekly Leaderboard XP. Spending XP can immediately drop your rank from #1 to #2 or #3, turning every sabotage and wager into a high-stakes strategic trade-off.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Focused Study Time</span>
                    </span>
                    <span className="font-mono-num font-bold text-emerald-400">+10 XP / 30m</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Every 30 minutes of logged study grants 10 XP (20 XP per hour). Breaks grant 0 XP.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Coaching Mock Exams</span>
                    </span>
                    <span className="font-mono-num font-bold text-amber-400">Up to +300 XP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Your standardized batch percentile is multiplied by 3.0 (e.g. 96.0%ile = 288 XP). Capped at 150 XP if the weekly Raid Boss is not defeated by Sunday 6:00 PM.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-2.5">
                <div className="font-bold text-white">Question Difficulty Multipliers (Solved &amp; Attempted)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-emerald-400 font-bold">Easy / Drill</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">0.8x Solved</div>
                    <div className="text-[10px] text-slate-400 font-mono-num">+0.3x Attempted</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-cyan-400 font-bold">Mains / Med</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">1.2x Solved</div>
                    <div className="text-[10px] text-slate-400 font-mono-num">+0.5x Attempted</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-amber-400 font-bold">Hard Drill</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">1.8x Solved</div>
                    <div className="text-[10px] text-slate-400 font-mono-num">+0.8x Attempted</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-rose-400 font-bold">JEE Advanced</div>
                    <div className="text-sm font-extrabold text-white font-mono-num mt-0.5">2.5x Solved</div>
                    <div className="text-[10px] text-slate-400 font-mono-num">+1.1x Attempted</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Anti-inflation cap: Question XP per session is bounded at 60 XP per hour of study + 25 baseline XP so speed-spamming trivial questions in 5 minutes cannot exploit the standings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mystery Supply Vaults (1 Vault / 90m)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Every 90 minutes (1h 30m) of focused study unlocks 1 Supply Vault (e.g. 3 hours = 2 vaults) containing Bonus XP, 1.5x Overclock Multipliers, Orbital Boss Strikes, or a 12-Hour Bush Ambush Stealth Cloak.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Algorithmic Weekly Mini-Titles</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Automatic weekly titles awarded from live telemetry: &quot;The Iron Core&quot; (longest streak), &quot;The Advanced Demon&quot; (most Hard/Adv Qs), &quot;The Midnight Raider&quot; (marathon grind), and &quot;The Comeback Kid&quot; (underdog surge).
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'warfare' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">
                  2. Psychological Warfare Systems &amp; The Friday Blackout Protocol
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Four high-stakes competitive systems plus a mandatory weekly Friday Blackout lockdown designed to turn passive leaderboard watching into active tactical rivalry.
                </p>
              </div>

              {/* Critical Rule: Explicit Target Selection */}
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/35 space-y-1.5">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  <span>Explicit Target Lock Protocol &amp; Post-Login Tactical Briefing</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Every offensive action (XP Shop Sabotage, Audit Badge, Quickdraw Duel, or Robin Hood Ambush) requires explicit target selection via the <strong>Target Lock Modal</strong>. There are zero random rolls: you inspect your rival&apos;s live rank, XP, and shield status, see the exact rank-drop consequence preview (<em>&quot;This will deduct [Cost] XP from your balance and drop your rank from #[X] to #[Y]&quot;</em>), and confirm the strike. Upon signing in, scholars also receive an interactive <strong>Tactical Briefing Sheet</strong> to immediately launch a focus timer, challenge a rival, declare an ambush, or respond to pending invitations.
                </p>
              </div>

              {/* The XP Shop */}
              <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-3">
                <div className="font-bold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>System A: The XP Black Market (Sabotages &amp; Defense)</span>
                  </span>
                  <span className="text-[10px] font-mono-num text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">
                    Spend Live XP
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Name Hijack</span>
                      </span>
                      <span className="font-mono-num">300 XP</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Rename a target rival&apos;s leaderboard display title for 24 hours (e.g. &quot;Nap Champion&quot;). Target can cleanse early by logging a verified 60-minute uninterrupted study session.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-bold text-pink-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>UI Flashbang / Curse</span>
                      </span>
                      <span className="font-mono-num">400 XP</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Forces an obnoxious hot-pink and Comic Sans &quot;Curse Mode&quot; theme on your target&apos;s interface for 24 hours. Lifts early once the target logs 45 study minutes.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-bold text-sky-300">
                      <span className="flex items-center gap-1.5">
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>The Audit Badge</span>
                      </span>
                      <span className="font-mono-num">250 XP</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Challenge a rival study session logged within the last 2 hours. Starts a 10-minute timer on their screen to upload photo proof of their written work. Failure strips their session XP and transfers it to you!
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between font-bold text-orange-300">
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Sound Horn Trap</span>
                      </span>
                      <span className="font-mono-num">200 XP</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Arms a stadium airhorn trap on a specific rival that automatically blasts when they complete their next focus timer.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Bounty Shield (Self-Targeted Defense)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Grants 24-hour personal immunity from Audits, 1v1 Quickdraw Duels, and Robin Hood Ambushes. Automatically pauses its countdown during Friday Blackout.
                    </p>
                  </div>
                  <span className="font-mono-num font-extrabold text-cyan-200 shrink-0">500 XP</span>
                </div>
              </div>

              {/* Duels, Robin Hood, Hostage Links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-sky-300 flex items-center gap-1.5">
                    <Swords className="w-4 h-4 text-sky-400" />
                    <span>System B: 1v1 Quickdraw Duels</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Challenge a rival to a simultaneous 45m or 60m focus sprint with a custom XP wager. Both wagers lock into a <strong>2x Escrow Pot</strong> (10-min expiry if unaccepted). First player to complete the sprint without pausing or aborting wins the entire pot!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>System C: Robin Hood Tax (#1 Bounty)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Rank #1 is crowned <strong>The King</strong>. Any lower-ranked scholar can pay <strong>50 XP</strong> to declare an Ambush for the day. Out-study the King before midnight to siphon <strong>20% of the King&apos;s daily XP</strong>. If the King out-studies you, the King keeps your 50 XP fee as Tribute!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5">
                    <LinkIcon className="w-4 h-4 text-rose-400" />
                    <span>System D: Hostage Blood Pacts</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Form a 5-day Soul-Bound Duo Streak for a <strong>1.5x XP Multiplier</strong> on all study sessions. Both partners must log <strong>120m (2h) daily</strong>. If either misses quota, both lose <strong>100 XP</strong> and enter <strong>The Gulag</strong> (requiring a 45m penance session to clear).
                  </p>
                </div>
              </div>

              {/* Friday Blackout Protocol */}
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-amber-500/35 space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-amber-400" />
                  <span>System E: The Friday Blackout Protocol &amp; Saturday Midnight Reveal</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Every Friday from 00:00:00 to 23:59:59, the Arena enters global lockdown: public ranks and rival XP are hidden behind <strong>CLASSIFIED / IN THE DARK</strong> placeholders, the Live Activity Feed pauses, and the XP Shop, Duels, Ambushes, and new Pact actions are disabled. Scholars can only view their own personal study logs. At <strong>Saturday 00:00 Midnight Reveal</strong>, the fog lifts and all Friday study hours convert onto the public leaderboard simultaneously.
                </p>
              </div>
            </div>
          )}

          {section === 'raid' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">Syllabus-Agnostic Co-op Raid Bosses</h3>
                <p className="text-slate-400 mt-0.5">
                  Runs weekly until Sunday at 6:00 PM (with Admin override controls available anytime).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-2">
                <div className="font-bold text-white">How Your Study Strikes the Boss HP Bar</div>
                <p className="text-[11px] text-slate-400">
                  Instead of fighting over different coaching chapters, the squad teams up against universal JEE Raid Bosses (The Backlog Leviathan, Chronos the Stagnant, The Attrition Hydra, Null-Phase Wraith, and The Singularity Wyrm):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center font-mono-num">
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Study Time</div>
                    <div className="text-xs font-bold text-emerald-400">1-2 DMG / min</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Easy Q</div>
                    <div className="text-xs font-bold text-emerald-400">2-3 DMG / Q</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Mains Q</div>
                    <div className="text-xs font-bold text-cyan-400">4 DMG / Q</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Hard Q</div>
                    <div className="text-xs font-bold text-amber-400">8 DMG / Q</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Advanced Q</div>
                    <div className="text-xs font-bold text-rose-400">12 DMG / Q</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1.5">
                <div className="font-bold text-white">Sunday 6:00 PM Deadline &amp; Method 1 Deferred Exam Debt</div>
                <p className="text-[11px] text-slate-400">
                  If the squad defeats the boss before Sunday 6:00 PM, everyone unlocks the full 300 XP Exam Pool. If the boss survives past Sunday 6:00 PM, the Exam Pool is capped at 150 XP. Because Ved writes Allen tests on an alternating bi-weekly schedule, if a raid fails on his off-week, his 150 XP cap carries over cleanly via Method 1 Deferred Exam Debt to his next test week so nobody dodges the consequences.
                </p>
              </div>
            </div>
          )}

          {section === 'fairness' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white font-display">Cross-Institute Fairness &amp; Multiplier Stacking</h3>
                <p className="text-slate-400 mt-0.5">
                  Engineered so Modulus and Allen scholars compete on a 100% level playing field with transparent catch-up mechanics.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. Underdog Comeback Buff (1.25x XP Boost)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    If anyone falls more than 150 XP behind the #1 weekly leader, they automatically catch a 1.25x boost on study time and question solving until they close the gap.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-rose-400" />
                    <span>2. Blood Pact Duo Multiplier (1.5x XP Boost) &amp; Vault Overclock (1.5x)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Active 5-day Hostage Link Blood Pacts multiply all study session XP by 1.5x, which stacks multiplicatively with the 1.25x Underdog Buff and any 1.5x Supply Vault Overclock surge.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3. Rest Day Shield &amp; Weekly Token</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Everyone receives 1 Rest Token per week. Tap the Rest Shield button on your player card to protect your daily streak for 36 hours without penalty.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4. Batch-Size Normalized Percentile &amp; Active Standing</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Raw ranks are converted to exact percentile: <code className="text-emerald-300">(1 - (Rank - 1) / TotalStudents) * 100</code>. If no test is logged for the current week, your previous test&apos;s XP and percentile carry over into active standing until your next test is logged and replaces them.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'howto' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white font-display">Quick-Start Sanctuary &amp; Warfare Workflow</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white">1. Tactical Briefing on Sign-In</div>
                  <p className="text-[11px] text-slate-400">
                    Right after logging in, use the Tactical Briefing Sheet to accept incoming 1v1 Duels or Blood Pacts, launch a Quickdraw Sprint, ambush the Rank #1 King, or jump straight into the Focus Chronometer.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white">2. Precision Chronometer &amp; Instant Session Log</div>
                  <p className="text-[11px] text-slate-400">
                    Run the Focus Chronometer while studying or click &quot;+ Log Study&quot; to record completed blocks, solved/attempted questions across difficulty tiers, and linked tasks with single-click instant commit.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white">3. Target Lock &amp; Black Market Strikes</div>
                  <p className="text-[11px] text-slate-400">
                    Click &quot;Target&quot; on any rival&apos;s leaderboard card or open the Tactical Warfare Hub bar to deploy Name Hijacks, UI Flashbangs, Audit Badges, Sound Horns, or 1v1 Quickdraw Duels.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-1">
                  <div className="font-bold text-white">4. Friday Blackout &amp; Saturday Reveal</div>
                  <p className="text-[11px] text-slate-400">
                    Every Friday, lock in with zero leaderboard distractions while all rival ranks are masked. At Saturday 00:00, watch all Friday study hours convert to XP in one massive drop.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#050811] border border-emerald-500/35 space-y-1 sm:col-span-2">
                  <div className="font-bold text-emerald-300">5. 24/7 Combined Study Mode (Study Together Anytime)</div>
                  <p className="text-[11px] text-slate-300">
                    Click &quot;Study Together&quot; from the Top Header, Sidebar, Focus Chronometer, or Tactical Briefing Sheet to enter the open-door Combined Squad Study Room. View every squadmate&apos;s live ticking clock, active subject, and micro-goal, run synchronized 25m/50m/90m group pacing blocks, send silent accountability check-in pings, and minimize the room into a floating dock while browsing other tabs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {section === 'changelog' && (
            <div className="space-y-4">
              {/* v4.0 Latest Release */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#050811] border border-emerald-500/45 space-y-3 shadow-[0_0_25px_rgba(16,185,129,0.1)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>v4.0 - Tactical Warfare Suite, Combined Study Mode &amp; Streamlined Arena HUD</span>
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black uppercase tracking-wider">
                    LATEST RELEASE
                  </span>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-200 list-disc pl-4">
                  <li>
                    <strong>24/7 Combined Study Mode (Study Together Lounge):</strong> Accessible anytime from the Arena header, sidebar, or timer tab. Features live synchronized multi-scholar desks, shared group pacing blocks (25m / 50m / 90m / Open Marathon), personal topic status sharing, one-click Squad Summon pings, and a minimizable floating PiP dock.
                  </li>
                  <li>
                    <strong>The XP Black Market (Spendable Leaderboard XP):</strong> Live weekly XP is now directly spendable on tactical items including <em>Name Hijack</em> (300 XP, 24h title override or 60m study cleanse), <em>UI Flashbang / Curse Mode</em> (400 XP, hot-pink + Comic Sans client curse or 45m study cleanse), <em>The Audit Badge</em> (250 XP, 10-minute photo-proof challenge on any session logged in the last 2h), <em>Sound Horn Trap</em> (200 XP, airhorn blast on target&apos;s next timer completion), and <em>Bounty Shield</em> (500 XP, 24h personal immunity).
                  </li>
                  <li>
                    <strong>High-Friction Target Lock Modal:</strong> Every offensive action requires explicit rival selection with live telemetry, shield verification, and an exact rank-drop consequence preview before execution.
                  </li>
                  <li>
                    <strong>1v1 Quickdraw Focus Duels:</strong> Real-time 45m and 60m head-to-head focus sprints with custom XP wagers locked into a 2x Escrow Pot and automatic 10-minute expiry refunds.
                  </li>
                  <li>
                    <strong>The Robin Hood Tax (Rank #1 King&apos;s Bounty):</strong> Dynamic &quot;Crowned Tyrant&quot; badge for Rank #1. Lower-ranked scholars can pay a 50 XP fee to declare a daily Ambush: out-study the King before midnight to siphon 20% of the King&apos;s daily XP, or forfeit the 50 XP fee as King&apos;s Tribute.
                  </li>
                  <li>
                    <strong>Hostage Links (5-Day Soul-Bound Blood Pacts &amp; Gulag State):</strong> Partner up for a 1.5x study XP multiplier requiring 120 minutes of study per day from both partners. Missing quota deducts 100 XP from both partners and places them in The Gulag until a 45-minute penance session is logged.
                  </li>
                  <li>
                    <strong>The Friday Blackout Protocol &amp; Saturday Midnight Reveal:</strong> Full Friday lockdown masking public ranks behind <em>CLASSIFIED / IN THE DARK</em> placeholders, freezing all sabotage/duel/ambush actions, and releasing all Friday XP simultaneously at Saturday 00:00.
                  </li>
                  <li>
                    <strong>Post-Login Tactical Briefing Sheet:</strong> Interactive command modal on sign-in to accept pending duels/pacts or immediately launch Combined Study Mode, a duel, ambush, sabotage, or study timer.
                  </li>
                  <li>
                    <strong>Mandatory Mon-Fri Tactical Warfare Protocol &amp; 1v1 Rivalry Lock:</strong> Squad regulations require every scholar to choose an active 1v1 Rival (0 XP cost) or engage in tactical warfare (Black Market, Robin Hood Ambush, Quickdraw Duel, or Blood Pact) at least once between Monday and Friday. Satisfying the duty unlocks full arena access and awards an active rival status badge on the leaderboard.
                  </li>
                  <li>
                    <strong>5 PM - 12 AM Evening Study Motivation Engine:</strong> Automated Web Push delivery of curated, mind-bending science, math, and physics breakthroughs (Dirac antimatter prediction, Euler identity, cat rotational mechanics, crystal field emerald color, Fermat least-time principle) sent occasionally to scholars when they are NOT currently studying to reignite evening momentum.
                  </li>
                  <li>
                    <strong>Intelligent Hourly Push Notification Prompts:</strong> Automated 1-hour reminder cadence for scholars who have not yet enabled browser/phone notifications, automatically muted once granted or manually dismissed by the user.
                  </li>
                </ul>
              </div>

              {/* v3.0 Previous Release */}
              <div className="p-4 rounded-2xl bg-[#050811] border border-slate-800/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                    <span>v3.0 - Obsidian Scholar&apos;s Sanctuary &amp; Co-op Raid Bosses</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">ARCHIVE</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc pl-4">
                  <li><strong>Multi-Aspect-Ratio Command Deck:</strong> Desktop Guild Command Sidebar, RPG Character Level &amp; Rank insignias, and adaptive mobile dock.</li>
                  <li><strong>Deterministic Focus Chronometer:</strong> Hardware-timestamp clock with wake-lock resilience, target block / stopwatch modes, and task linking.</li>
                  <li><strong>Syllabus-Agnostic Co-op Raid Bosses:</strong> 5 animated SVG JEE Raid Bosses with real-time squad damage contributions.</li>
                  <li><strong>Underdog Comeback Buff (1.25x XP) &amp; Rest Day Shield:</strong> Automatic 1.25x multiplier when trailing #1 by &gt;150 XP and 1 weekly Rest Token per scholar.</li>
                  <li><strong>Mystery Supply Vaults (1 Vault / 90m):</strong> Interactive vault drops awarding Bonus XP, Overclock Multipliers, Orbital Boss Strikes, or a 12-Hour Stealth Cloak.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/90 bg-[#060913]/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Accessible anytime via Top Arena Bar or Sidebar</span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary px-5 py-2 rounded-xl font-bold text-xs cursor-pointer"
          >
            Back to Arena
          </button>
        </div>
      </div>
    </div>
  );
};