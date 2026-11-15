import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Compass,
  Lock,
  Trophy,
  BookOpen,
  User as UserIcon,
  Delete,
  CheckCircle2,
  AlertTriangle,
  Wifi
} from 'lucide-react';
import heroCommandImg from '../assets/images/arena_hero_command_1794738676474.jpg';
import raidVictoryImg from '../assets/images/raid_boss_victory_1794738678080.jpg';
import liveLoungeImg from '../assets/images/live_study_lounge_1794738678526.jpg';
import { PWAInstallButton } from './PWAInstallComponents';

export interface ShowcaseLandingPageProps {
  tuitionVaultCategory: string;
  setTuitionVaultCategory: (cat: string) => void;
  setLoginTarget: (target: string) => void;
  pinInput: string;
  setPinInput: React.Dispatch<React.SetStateAction<string>>;
  handlePinInputChange: (val: string) => void;
  signInNameInput: string;
  setSignInNameInput: (val: string) => void;
  loginError: string;
  setLoginError: (val: string) => void;
  signUpName: string;
  setSignUpName: (val: string) => void;
  signUpInstitute: string;
  setSignUpInstitute: (val: string) => void;
  signUpPin: string;
  setSignUpPin: (val: string) => void;
  signUpError: string;
  setSignUpError: (val: string) => void;
  isSigningUp: boolean;
  signUpPendingApprovalName: string | null;
  setSignUpPendingApprovalName: (val: string | null) => void;
  handlePublicSignUp: (e: React.FormEvent) => void;
  enterGuestDemoMode: () => void;
  isConnected: boolean;
  scholarCount: number;
  activeGrindersCount: number;
  isRaidBlackoutActive: boolean;
  lockoutSecondsRemaining: number;
  isVerifyingPin: boolean;
  pinStrengthHint?: string;
  pwa: {
    isInstallable: boolean;
    isInstalled: boolean;
    isMobileDevice: boolean;
    triggerInstall: () => void;
  };
}

export const ShowcaseLandingPage: React.FC<ShowcaseLandingPageProps> = ({
  tuitionVaultCategory,
  setTuitionVaultCategory,
  setLoginTarget,
  pinInput,
  setPinInput,
  handlePinInputChange,
  signInNameInput,
  setSignInNameInput,
  loginError,
  setLoginError,
  signUpName,
  setSignUpName,
  signUpInstitute,
  setSignUpInstitute,
  signUpPin,
  setSignUpPin,
  signUpError,
  setSignUpError,
  isSigningUp,
  signUpPendingApprovalName,
  setSignUpPendingApprovalName,
  handlePublicSignUp,
  enterGuestDemoMode,
  isConnected,
  scholarCount,
  activeGrindersCount,
  isRaidBlackoutActive,
  lockoutSecondsRemaining,
  isVerifyingPin,
  pinStrengthHint,
  pwa
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [bossImgFailed, setBossImgFailed] = useState(false);
  const [loungeImgFailed, setLoungeImgFailed] = useState(false);

  const isLocked = lockoutSecondsRemaining > 0;
  const formatCooldown = (secs: number) => {
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}m ${s.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="w-full max-w-5xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch z-10">
      {/* LEFT / SECOND ON MOBILE: Boxy Visual Arena Preview */}
      <div className="order-2 lg:order-1 lg:col-span-6 box-arena-panel rounded-xl overflow-hidden flex flex-col justify-between">
        <div>
          {/* 16:9 Architectural Hero Image */}
          <div className="relative aspect-video w-full bg-[#090C14] border-b border-white/10 overflow-hidden">
            {!heroImgFailed ? (
              <img
                src={heroCommandImg}
                alt="JEE Grind Arena Competitive Study Command Deck"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-[#080B12] to-amber-950/30">
                <Trophy className="w-12 h-12 text-amber-400/70" />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-white leading-tight">
                  JEE Grind Arena
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-[46ch]">
                  Competitive study tracking, live co-op focus rooms, normalized mock percentiles, and weekly boss raids.
                </p>
              </div>
              <div className="shrink-0 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono tabular-nums font-bold text-slate-200 flex items-center gap-1.5">
                <Wifi className={`w-3 h-3 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span>{isConnected ? 'LIVE' : 'SYNC'}</span>
              </div>
            </div>

            {/* Numeric Metrics Grid (Strict 4-cell Boxy Layout) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="box-metric-cell p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Scholars</div>
                <div className="text-lg font-mono tabular-nums font-extrabold text-white mt-0.5">{scholarCount}</div>
              </div>
              <div className="box-metric-cell p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Study Room</div>
                <div className="text-lg font-mono tabular-nums font-extrabold text-emerald-400 mt-0.5">
                  {activeGrindersCount > 0 ? `${activeGrindersCount} Live` : 'Ready'}
                </div>
              </div>
              <div className="box-metric-cell p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Weekly Crown</div>
                <div className="text-sm font-mono font-bold text-amber-400 mt-1">
                  {isRaidBlackoutActive ? 'Blackout On' : 'Public Race'}
                </div>
              </div>
              <div className="box-metric-cell p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Exam Pool</div>
                <div className="text-lg font-mono tabular-nums font-extrabold text-sky-400 mt-0.5">300 XP</div>
              </div>
            </div>

            {/* 2 Visual Showcase Tiles (No overlays on photos) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-black/40 border border-white/10 overflow-hidden">
                <div className="aspect-[16/9] bg-zinc-950 overflow-hidden border-b border-white/[0.08]">
                  {!bossImgFailed ? (
                    <img
                      src={raidVictoryImg}
                      alt="Weekly Co-Op Boss Raid Arena"
                      onError={() => setBossImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-950/30">
                      <Shield className="w-8 h-8 text-emerald-400/70" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Co-Op Raid Bosses</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Every study minute and solved question deals squad boss damage.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-black/40 border border-white/10 overflow-hidden">
                <div className="aspect-[16/9] bg-zinc-950 overflow-hidden border-b border-white/[0.08]">
                  {!loungeImgFailed ? (
                    <img
                      src={liveLoungeImg}
                      alt="Live Study Lounge Sync"
                      onError={() => setLoungeImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-sky-950/30">
                      <BookOpen className="w-8 h-8 text-sky-400/70" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Live Study Lounge</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    See who is studying in real time or sync paired timers together.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Strip */}
        <div className="p-4 sm:px-6 sm:pb-6 pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={enterGuestDemoMode}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-100 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Compass className="w-4 h-4 text-sky-300 shrink-0" />
            <span>Explore Interactive Demo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTuitionVaultCategory('signup');
              setSignUpError('');
              setLoginError('');
            }}
            className="min-h-[44px] py-2.5 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Join Squad</span>
          </button>
        </div>
      </div>

      {/* RIGHT / FIRST ON MOBILE: PIN & Security Access Terminal */}
      <div className="order-1 lg:order-2 lg:col-span-6 box-arena-panel rounded-xl p-4 sm:p-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Mobile Header Strip */}
          <div className="lg:hidden flex items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
            <div>
              <div className="text-sm font-display font-extrabold text-white">JEE Grind Arena</div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                {scholarCount} Scholars · {activeGrindersCount > 0 ? `${activeGrindersCount} Studying Live` : 'Desk Ready'}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-mono font-bold text-slate-200 flex items-center gap-1.5">
              <Wifi className={`w-3 h-3 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>{isConnected ? 'LIVE' : 'SYNC'}</span>
            </div>
          </div>

          {/* Terminal Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base sm:text-lg font-display font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{tuitionVaultCategory === 'signup' ? 'Scholar Sign Up' : 'Access Terminal'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {tuitionVaultCategory === 'signup'
                  ? 'Create your scholar account with a strong 4-digit PIN'
                  : 'Returning devices sign in automatically once unlocked'}
              </p>
            </div>

            <div className="grid grid-cols-3 p-1 bg-black/60 rounded-lg border border-white/10 shrink-0 gap-1">
              <button
                type="button"
                onClick={() => {
                  setTuitionVaultCategory('students');
                  setLoginTarget('');
                  setPinInput('');
                  setLoginError('');
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tuitionVaultCategory === 'students'
                    ? 'bg-white text-zinc-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTuitionVaultCategory('signup');
                  setPinInput('');
                  setLoginError('');
                  setSignUpError('');
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tuitionVaultCategory === 'signup'
                    ? 'bg-emerald-400 text-zinc-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Up</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTuitionVaultCategory('admin');
                  setLoginTarget('admin');
                  setPinInput('');
                  setLoginError('');
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tuitionVaultCategory === 'admin'
                    ? 'bg-amber-400 text-zinc-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {tuitionVaultCategory === 'signup' ? (
            signUpPendingApprovalName ? (
              <div className="p-5 rounded-xl bg-sky-500/10 border border-sky-400/35 space-y-3.5 text-center">
                <div className="w-11 h-11 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mx-auto text-sky-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-display font-extrabold text-white">
                    Request Sent for Admin Approval
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your scholar profile for <strong className="text-sky-300">{signUpPendingApprovalName}</strong> is queued for Admin approval and starting XP calibration.
                  </p>
                </div>
                <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSignUpPendingApprovalName(null);
                      setTuitionVaultCategory('students');
                    }}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-white text-zinc-950 font-bold text-xs cursor-pointer hover:bg-slate-100 transition-all"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignUpPendingApprovalName(null)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-200 font-semibold text-xs cursor-pointer transition-all"
                  >
                    Submit Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePublicSignUp} className="space-y-3.5">
                <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-400/25 text-xs text-sky-200 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>New accounts require Admin approval before first login. Avoid easy PINs like 1234 or 0000.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Scholar Name *
                  </label>
                  <input
                    type="text"
                    value={signUpName}
                    onChange={(e) => {
                      setSignUpName(e.target.value);
                      setSignUpError('');
                    }}
                    placeholder="e.g. Aryan"
                    maxLength={28}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-black/55 border border-white/15 focus:border-sky-400 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Institute / Batch
                    </label>
                    <input
                      type="text"
                      value={signUpInstitute}
                      onChange={(e) => setSignUpInstitute(e.target.value)}
                      placeholder="e.g. Allen / Modulus"
                      maxLength={24}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-black/55 border border-white/15 focus:border-sky-400 text-sm text-white placeholder:text-slate-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      4-Digit Access PIN *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={signUpPin}
                      onChange={(e) => {
                        setSignUpPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setSignUpError('');
                      }}
                      placeholder="Strong 4 digits (e.g. 4829)"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-black/55 border border-white/15 focus:border-sky-400 text-sm text-white font-mono tabular-nums tracking-widest placeholder:tracking-normal placeholder:text-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {pinStrengthHint && signUpPin.length === 4 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/35 text-xs text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{pinStrengthHint}</span>
                  </div>
                )}

                {signUpError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300 font-semibold">
                    {signUpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSigningUp}
                  className="w-full min-h-[48px] py-3 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-zinc-950 font-display font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSigningUp ? 'Submitting Request...' : 'Request Account Approval'}</span>
                </button>
              </form>
            )
          ) : (
            <>
              {/* Brute-Force Lockout Shield Banner */}
              {isLocked && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Too many incorrect PIN attempts. Security shield active.</span>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-rose-300 shrink-0">
                    {formatCooldown(lockoutSecondsRemaining)}
                  </span>
                </div>
              )}

              {tuitionVaultCategory === 'students' && (
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Scholar Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={signInNameInput}
                    onChange={(e) => {
                      setSignInNameInput(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="Type name or dial your 4-digit PIN directly"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-black/55 border border-white/15 focus:border-sky-400 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-all"
                  />
                </div>
              )}

              {tuitionVaultCategory === 'admin' && (
                <div className="w-full p-3 rounded-lg flex items-center justify-between border bg-amber-500/10 border-amber-400/35 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-xs sm:text-sm text-white">Admin Command Vault</div>
                      <div className="text-[11px] text-slate-300">Rate-limited console for roster, blackout &amp; raid boss</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4-Digit PIN Readout Box */}
              <div className="py-3 px-4 rounded-xl bg-black/60 border border-white/[0.1] flex flex-col items-center justify-center space-y-2">
                <div className="flex items-center justify-center gap-4 py-1">
                  {[0, 1, 2, 3].map((idx) => {
                    const filled = pinInput.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-[4px] transition-all duration-150 ${
                          filled
                            ? tuitionVaultCategory === 'admin'
                              ? 'bg-amber-400 scale-110 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                              : 'bg-sky-400 scale-110 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
                            : 'bg-white/10 border border-white/25'
                        }`}
                      />
                    );
                  })}
                </div>
                {loginError ? (
                  <div className="text-xs text-rose-300 font-semibold text-center">{loginError}</div>
                ) : (
                  <div className="text-[11px] text-slate-400 font-mono">
                    {isVerifyingPin
                      ? 'Verifying PIN...'
                      : tuitionVaultCategory === 'admin'
                      ? 'Enter 4-Digit Admin PIN'
                      : signInNameInput.trim()
                      ? `Scholar: ${signInNameInput.trim().toUpperCase()}`
                      : 'Dial 4-Digit PIN on keypad or keyboard'}
                  </div>
                )}
              </div>

              {/* Touch & Desktop Friendly Keypad (>= 48px targets) */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={isLocked || isVerifyingPin}
                    onClick={() => handlePinInputChange(pinInput + String(num))}
                    className="min-h-[48px] h-12 rounded-lg bg-white/[0.045] hover:bg-white/[0.10] active:scale-[0.97] disabled:opacity-40 border border-white/[0.10] hover:border-sky-400/45 text-base font-bold text-white transition-all font-mono tabular-nums cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={() => {
                    setPinInput('');
                    setLoginError('');
                  }}
                  className="min-h-[48px] h-12 rounded-lg bg-white/[0.025] hover:bg-white/[0.07] disabled:opacity-40 border border-white/[0.08] text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  disabled={isLocked || isVerifyingPin}
                  onClick={() => handlePinInputChange(pinInput + '0')}
                  className="min-h-[48px] h-12 rounded-lg bg-white/[0.045] hover:bg-white/[0.10] active:scale-[0.97] disabled:opacity-40 border border-white/[0.10] hover:border-sky-400/45 text-base font-bold text-white transition-all font-mono tabular-nums cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                  aria-label="Delete digit"
                  className="min-h-[48px] h-12 rounded-lg bg-white/[0.025] hover:bg-white/[0.07] disabled:opacity-40 border border-white/[0.08] text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Delete className="w-4 h-4" />
                  <span>DEL</span>
                </button>
              </div>

              {/* Mobile Quick Actions */}
              <div className="lg:hidden pt-2 border-t border-white/[0.08] flex flex-col gap-2">
                <PWAInstallButton
                  isInstallable={pwa.isInstallable}
                  isInstalled={pwa.isInstalled}
                  isMobileDevice={pwa.isMobileDevice}
                  onInstallClick={() => pwa.triggerInstall()}
                  variant="login"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
