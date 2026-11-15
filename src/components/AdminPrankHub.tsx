import React, { useState } from 'react';
import { PrankTargetConfig, DEFAULT_PRANK_CONFIG, LeaderboardPrankMode, PrankScholar } from '../types/prank';
import {
  Sparkles,
  Crown,
  AlertTriangle,
  Play,
  RotateCcw,
  Volume2,
  Sliders,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Send,
  HelpCircle,
  Shuffle,
  ShieldAlert,
  Ghost
} from 'lucide-react';
import { playClownHorn, playBoingSound, playSadTrombone } from '../utils/prankAudio';

interface AdminPrankHubProps {
  members: PrankScholar[];
  currentPrankConfig: PrankTargetConfig | null;
  onSavePrank: (config: PrankTargetConfig) => Promise<void>;
  onClearPrank: () => Promise<void>;
  isAdminPreview: boolean;
  onToggleAdminPreview: () => void;
  onSendAnnouncement?: (message: string, targetMemberId?: string) => Promise<void>;
  notify: (title: string, message?: string, type?: 'info' | 'error') => void;
  leaderboardRankings?: { id: string; name: string; rank: number; weeklyXp: number }[];
}

export const AdminPrankHub: React.FC<AdminPrankHubProps> = ({
  members,
  currentPrankConfig,
  onSavePrank,
  onClearPrank,
  isAdminPreview,
  onToggleAdminPreview,
  onSendAnnouncement,
  notify,
  leaderboardRankings = []
}) => {
  const activeConfig = currentPrankConfig || DEFAULT_PRANK_CONFIG;

  const [targetId, setTargetId] = useState<string>(
    activeConfig.targetMemberId || (members[0]?.id ?? 'utham')
  );
  const [isActive, setIsActive] = useState<boolean>(Boolean(activeConfig.active));
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardPrankMode>(
    activeConfig.leaderboardMode || 'auto_invert'
  );
  const [fakeXp, setFakeXp] = useState<number>(activeConfig.fakeXpAmount ?? 999999);
  const [customTitle, setCustomTitle] = useState<string>(activeConfig.customTitle || '');

  // UI Annoyance toggles
  const [tiltedWorld, setTiltedWorld] = useState<boolean>(activeConfig.tiltedWorld ?? true);
  const [slipperyButtons, setSlipperyButtons] = useState<boolean>(activeConfig.slipperyButtons ?? true);
  const [comicSansMode, setComicSansMode] = useState<boolean>(activeConfig.comicSansMode ?? true);
  const [clownCursor, setClownCursor] = useState<boolean>(activeConfig.clownCursor ?? true);
  const [squeakyAudio, setSqueakyAudio] = useState<boolean>(activeConfig.squeakyAudio ?? true);
  const [annoyingPopups, setAnnoyingPopups] = useState<boolean>(activeConfig.annoyingPopups ?? true);
  const [threatToasts, setThreatToasts] = useState<boolean>(activeConfig.threatToasts ?? true);
  const [showAdminRevealBadge, setShowAdminRevealBadge] = useState<boolean>(
    activeConfig.showAdminRevealBadge ?? false
  );
  const [customTrollMsg, setCustomTrollMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const selectedMember = members.find((m) => m.id === targetId);
  const selectedMemberRank = leaderboardRankings.find((r) => r.id === targetId);

  // Quick Preset Handlers
  const applyPreset = (preset: 'topper' | 'demotion' | 'chaos' | 'clean') => {
    playBoingSound();
    if (preset === 'topper') {
      setIsActive(true);
      setLeaderboardMode('force_topper');
      setFakeXp(999999);
      setCustomTitle('👑 ASCENDED MULTIVERSE TOPPER (AIR-1)');
      setTiltedWorld(false);
      setSlipperyButtons(true);
      setComicSansMode(false);
      setClownCursor(true);
      setSqueakyAudio(true);
      setAnnoyingPopups(true);
      setThreatToasts(true);
      notify('Preset Applied: Fake Topper Delusion', 'Target will see themselves as undisputed Rank #1 with 999,999 XP!');
    } else if (preset === 'demotion') {
      setIsActive(true);
      setLeaderboardMode('force_last');
      setFakeXp(0);
      setCustomTitle('🥔 POTATO TIER: BACKLOG COLLAPSE');
      setTiltedWorld(false);
      setSlipperyButtons(true);
      setComicSansMode(true);
      setClownCursor(true);
      setSqueakyAudio(true);
      setAnnoyingPopups(true);
      setThreatToasts(true);
      notify('Preset Applied: Potato Demotion', 'Target will see themselves demoted to Dead Last Rank with 0 XP and potato tier!');
    } else if (preset === 'chaos') {
      setIsActive(true);
      setLeaderboardMode('auto_invert');
      setFakeXp(999999);
      setCustomTitle('👑 SUPREME OVERLORD OF CHAOS');
      setTiltedWorld(true);
      setSlipperyButtons(true);
      setComicSansMode(true);
      setClownCursor(true);
      setSqueakyAudio(true);
      setAnnoyingPopups(true);
      setThreatToasts(true);
      notify('Preset Applied: Complete Chaos & Trollfest', 'All weird, slippery, tilted, and squeaky prank mechanics enabled!');
    } else {
      setIsActive(false);
      setLeaderboardMode('off');
      setTiltedWorld(false);
      setSlipperyButtons(false);
      setComicSansMode(false);
      setClownCursor(false);
      setSqueakyAudio(false);
      setAnnoyingPopups(false);
      setThreatToasts(false);
      notify('Preset Cleared', 'All prank switches turned off.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const configToSave: PrankTargetConfig = {
        active: isActive,
        targetMemberId: targetId,
        targetMemberName: targetId === 'ALL' ? 'All Squad Scholars' : selectedMember?.name || targetId,
        leaderboardMode,
        fakeXpAmount: Number(fakeXp) || 999999,
        customTitle: customTitle.trim(),
        tiltedWorld,
        slipperyButtons,
        comicSansMode,
        clownCursor,
        squeakyAudio,
        annoyingPopups,
        threatToasts,
        fakeLagOnTabs: false,
        invertedTyping: false,
        showAdminRevealBadge,
        activatedAt: Date.now(),
        prankNotes: `Active prank on ${targetId === 'ALL' ? 'ALL' : selectedMember?.name}`
      };

      await onSavePrank(configToSave);
      playClownHorn();
      notify(
        isActive ? '🤡 Prank Protocol Deployed!' : '🕊️ Prank Deactivated',
        isActive
          ? `Prank is now LIVE for ${targetId === 'ALL' ? 'ALL scholars' : selectedMember?.name}! Whenever they open the app, the weirdness begins.`
          : 'Normal app state restored for all scholars.',
        'info'
      );
    } catch {
      notify('Save Failed', 'Could not sync prank config to server.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTrollBroadcast = async () => {
    if (!customTrollMsg.trim() || !onSendAnnouncement) return;
    try {
      await onSendAnnouncement(`🤡 SQUAD NOTICE: ${customTrollMsg.trim()}`, targetId);
      playClownHorn();
      setCustomTrollMsg('');
      notify('Troll Broadcast Sent', `Delivered prank broadcast to ${targetId === 'ALL' ? 'everyone' : selectedMember?.name}!`, 'info');
    } catch {
      notify('Broadcast Error', 'Could not send troll notice.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 border border-purple-500/35 bg-gradient-to-r from-purple-950/40 via-zinc-950 to-pink-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 text-xl">
              🤡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white font-display">
                  The Prank Chamber &amp; Chaos Control Center
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Pull a psychological prank on any squad member! Invert their leaderboard rank, tilt their world, and trigger hilarious UI chaos.
              </p>
            </div>
          </div>

          {/* Test Drive Preview Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-prank-exempt="true"
              onClick={onToggleAdminPreview}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-md ${
                isAdminPreview
                  ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-amber-400/20'
                  : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
            >
              {isAdminPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isAdminPreview ? 'Exit Admin Preview' : '🧪 Preview Prank on My Screen'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK PRESET ARCHETYPES */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              One-Click Prank Presets
            </h4>
          </div>
          <span className="text-[11px] text-zinc-400">Instant hilarious setups</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            data-prank-exempt="true"
            onClick={() => applyPreset('topper')}
            className="p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">👑</span>
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Topper Illusion</span>
            </div>
            <div className="text-xs font-bold text-amber-200 group-hover:text-amber-100">
              The Fake Topper Delusion
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Shows them at Rank #1 with 999,999 XP, golden laurels, and victory horns!
            </p>
          </button>

          <button
            type="button"
            data-prank-exempt="true"
            onClick={() => applyPreset('demotion')}
            className="p-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🥔</span>
              <span className="text-[10px] font-mono text-rose-400 font-bold uppercase">Potato Tier</span>
            </div>
            <div className="text-xs font-bold text-rose-200 group-hover:text-rose-100">
              The Great Demotion
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Demotes them straight to Dead Last (#16) with 0 XP and alarming backlog alerts!
            </p>
          </button>

          <button
            type="button"
            data-prank-exempt="true"
            onClick={() => applyPreset('chaos')}
            className="p-3.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🌪️</span>
              <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Max Annoyance</span>
            </div>
            <div className="text-xs font-bold text-purple-200 group-hover:text-purple-100">
              Maximum Chaos &amp; Troll
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Tilted world, slippery buttons, clown cursor, Comic Sans, squeaky audio, and popups!
            </p>
          </button>

          <button
            type="button"
            data-prank-exempt="true"
            onClick={() => applyPreset('clean')}
            className="p-3.5 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/60 text-left transition-all cursor-pointer group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">🕊️</span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase">Reset</span>
            </div>
            <div className="text-xs font-bold text-zinc-200 group-hover:text-white">
              Restore Normal State
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              Disengages all pranks and resets the entire experience to peaceful standard.
            </p>
          </button>
        </div>
      </div>

      {/* TARGET SELECTION & MAIN ACTIVATION SWITCH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Col 1: Target Scholar Selector */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-3 lg:col-span-2">
          <label className="text-xs font-bold text-white uppercase tracking-wider block">
            1. Select Prank Target:
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.map((m) => {
              const rankInfo = leaderboardRankings.find((r) => r.id === m.id);
              const isSelected = targetId === m.id;
              const isCurrentlyTop1 = rankInfo?.rank === 1;

              return (
                <button
                  key={m.id}
                  type="button"
                  data-prank-exempt="true"
                  onClick={() => {
                    setTargetId(m.id);
                    playBoingSound();
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-600/25 border-purple-400 shadow-md shadow-purple-600/20'
                      : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-white truncate">{m.name}</span>
                    {isCurrentlyTop1 && (
                      <span className="text-[9px] font-bold px-1 rounded bg-amber-400/20 text-amber-300">
                        👑 #1
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Rank #{rankInfo?.rank || '-'}</span>
                    <span className="text-sky-300">{rankInfo?.weeklyXp || 0} XP</span>
                  </div>
                </button>
              );
            })}

            {/* Special Option: ALL SCHOLARS */}
            <button
              type="button"
              data-prank-exempt="true"
              onClick={() => {
                setTargetId('ALL');
                playBoingSound();
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                targetId === 'ALL'
                  ? 'bg-rose-600/25 border-rose-400 shadow-md shadow-rose-600/20'
                  : 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-300">🚨 ALL SCHOLARS</span>
                <span className="text-xs">💣</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Universal squad chaos</p>
            </button>
          </div>

          {/* Target Status readout */}
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span>
                Target Locked: <strong className="text-white">{targetId === 'ALL' ? 'ALL SCHOLARS' : selectedMember?.name}</strong>
              </span>
            </div>
            {selectedMemberRank && targetId !== 'ALL' && (
              <div className="text-[11px] text-zinc-400 font-mono">
                True Rank: <strong className="text-amber-400">#{selectedMemberRank.rank}</strong> ({selectedMemberRank.weeklyXp} XP)
              </div>
            )}
          </div>
        </div>

        {/* Col 2: Master Switch & Live Indicator */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              2. Master Prank Engagement:
            </span>
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                isActive
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                  : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
              }`}
            >
              <div>
                <div className="text-sm font-black flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-rose-500 animate-ping' : 'bg-zinc-600'}`} />
                  <span>{isActive ? 'PRANK PROTOCOL ENGAGED' : 'PROTOCOL DORMANT'}</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isActive
                    ? `Currently active for ${activeConfig.targetMemberName || 'target'}`
                    : 'Target experiences normal website'}
                </p>
              </div>

              <button
                type="button"
                data-prank-exempt="true"
                onClick={() => {
                  setIsActive(!isActive);
                  playBoingSound();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg ${
                  isActive
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                {isActive ? 'DEACTIVATE' : 'ACTIVATE'}
              </button>
            </div>
          </div>

          {/* Quick Action Deploy Button */}
          <button
            type="button"
            data-prank-exempt="true"
            disabled={isSaving}
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 hover:from-purple-400 hover:to-amber-400 text-zinc-950 font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-purple-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>{isSaving ? 'Deploying to Cloud...' : 'SAVE & DEPLOY PRANK'}</span>
          </button>
        </div>
      </div>

      {/* LEADERBOARD INVERSION & MIND GAMES CONFIGURATION */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
            3. Leaderboard Manipulation &amp; Inversion
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setLeaderboardMode('auto_invert')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              leaderboardMode === 'auto_invert'
                ? 'bg-purple-600/20 border-purple-400 text-white'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <Shuffle className="w-4 h-4 text-purple-400" />
              <span>Auto-Invert (Recommended)</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              If target is <strong>NOT #1</strong>: Make them undisputed #1 Topper! If target <strong>IS #1</strong>: Drop them to Dead Last (#16)!
            </p>
          </div>

          <div
            onClick={() => setLeaderboardMode('force_topper')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              leaderboardMode === 'force_topper'
                ? 'bg-amber-600/20 border-amber-400 text-white'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Force Rank #1 Topper</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Always show them as the supreme #1 Topper with 999,999 XP, golden laurel card, and celebratory banners!
            </p>
          </div>

          <div
            onClick={() => setLeaderboardMode('force_last')}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              leaderboardMode === 'force_last'
                ? 'bg-rose-600/20 border-rose-400 text-white'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Force Dead Last Place</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Demote them to Rank #16 (Bottom of Arena) with 0 XP, sad potato icon, and scary backlog warnings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">
              Custom Topper / Roast Title (Optional):
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. 👑 ALL-KNOWING TOPPER GOD or 🥔 POTATO TIER"
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">
              Fake Topper XP Amount:
            </label>
            <input
              type="number"
              value={fakeXp}
              onChange={(e) => setFakeXp(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>
      </div>

      {/* WEIRD & ANNOYING UI EFFECTS */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2">
          <Ghost className="w-4 h-4 text-pink-400" />
          <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
            4. Annoying &amp; Weird UI Anomalies
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={tiltedWorld}
              onChange={(e) => setTiltedWorld(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🌀 Tilted World &amp; Wobble</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Rotates the whole website 1.8° and rocks slowly back and forth like a boat!
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={slipperyButtons}
              onChange={(e) => setSlipperyButtons(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🏃 Slippery Runaway Buttons</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Action buttons literally jump away from the mouse cursor when they try to click!
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={comicSansMode}
              onChange={(e) => setComicSansMode(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🤡 Comic Sans &amp; Neon Disco</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Swaps all fonts to Comic Sans, animates rainbow text headers, and gives neon green borders.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={clownCursor}
              onChange={(e) => setClownCursor(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🎈 Clown Cursor &amp; Emoji Trail</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Mouse cursor becomes a clown face and leaves a floating trail of 🤡 🎈 🥔 🦆 emojis.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={squeakyAudio}
              onChange={(e) => setSqueakyAudio(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🦆 Squeaky Toy &amp; Troll Audio</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Plays high-pitched clown horns, duck quacks, and boings whenever they click anything.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={annoyingPopups}
              onChange={(e) => setAnnoyingPopups(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">🚨 Fake Discipline Popups</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Pops up mock anti-cheat inspections demanding they solve 7 × 8 to prove they are awake.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={threatToasts}
              onChange={(e) => setThreatToasts(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">⚠️ Urgent Threat Toasts</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Periodic alarms claiming rivals just studied 48 hours in 10 minutes!
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={showAdminRevealBadge}
              onChange={(e) => setShowAdminRevealBadge(e.target.checked)}
              className="mt-0.5 rounded text-purple-500 focus:ring-purple-400"
            />
            <div>
              <span className="text-xs font-bold text-white block">💬 Show Secret Exit Badge</span>
              <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                Shows a small &quot;You got pranked by Admin! 🤡 Click to end&quot; banner at top.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* DIRECT TROLL BROADCAST DISPATCHER */}
      {onSendAnnouncement && (
        <div className="surface-card rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              5. Send Custom Troll In-App Alert
            </h4>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customTrollMsg}
              onChange={(e) => setCustomTrollMsg(e.target.value)}
              placeholder={`Send weird alert specifically to ${targetId === 'ALL' ? 'everyone' : selectedMember?.name}...`}
              className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-sky-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendTrollBroadcast();
              }}
            />
            <button
              type="button"
              data-prank-exempt="true"
              onClick={handleSendTrollBroadcast}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs cursor-pointer shrink-0 transition-all"
            >
              Send Troll Notice
            </button>
          </div>
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          data-prank-exempt="true"
          onClick={async () => {
            await onClearPrank();
            setIsActive(false);
            playSadTrombone();
            notify('Pranks Disengaged', 'All prank configurations cleared from server.', 'info');
          }}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/40 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Pranks</span>
        </button>

        <button
          type="button"
          data-prank-exempt="true"
          disabled={isSaving}
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-zinc-950 font-extrabold text-xs shadow-lg shadow-purple-500/25 transition-all cursor-pointer flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Save Prank Configuration</span>
        </button>
      </div>
    </div>
  );
};
