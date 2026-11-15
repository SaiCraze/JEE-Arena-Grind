import React from 'react';
import {
  Compass,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  LogIn,
  CheckCircle2,
  Sparkles,
  Play
} from 'lucide-react';
import { GUEST_GUIDE_STEPS } from '../data/guestDemoData';

export interface GuestGuideJumpTarget {
  tab?: 'arena' | 'timer' | 'tasks' | 'tuition' | 'stats';
  action?: 'open_log' | 'open_exam' | 'open_warfare' | 'open_chat' | 'open_lounge';
}

interface GuestDemoWalkthroughProps {
  currentStepIndex: number;
  onStepChange: (nextIndex: number) => void;
  isTourOpen: boolean;
  onToggleTour: (open: boolean) => void;
  onShuffleDemo: () => void;
  onJumpToTarget: (target: GuestGuideJumpTarget) => void;
  onExitToLogin: () => void;
  demoScholarName: string;
}

export const GuestDemoWalkthrough: React.FC<GuestDemoWalkthroughProps> = ({
  currentStepIndex,
  onStepChange,
  isTourOpen,
  onToggleTour,
  onShuffleDemo,
  onJumpToTarget,
  onExitToLogin,
  demoScholarName
}) => {
  const safeIndex = Math.max(0, Math.min(GUEST_GUIDE_STEPS.length - 1, currentStepIndex));
  const step = GUEST_GUIDE_STEPS[safeIndex];

  return (
    <>
      {/* Sticky Guest Sandbox Control Strip */}
      <div className="rounded-2xl bg-[#0D121F]/95 border border-sky-400/25 px-3.5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/35 text-sky-300 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-white tracking-tight">
                Interactive Demo Mode
              </span>
              <span className="text-[11px] font-mono-num text-sky-300 bg-sky-500/10 border border-sky-400/25 px-2 py-0.5 rounded-md">
                Acting as {demoScholarName} (Sample Squad)
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              Randomized sample data only. Changes stay in your temporary sandbox and never affect live squad records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleTour(!isTourOpen)}
            className="h-8 px-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-98 whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Guided Tour ({safeIndex + 1}/{GUEST_GUIDE_STEPS.length})</span>
          </button>

          <button
            type="button"
            onClick={onShuffleDemo}
            className="h-8 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-100 font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-98 whitespace-nowrap"
            title="Generate a fresh randomized squad and activity dataset"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
            <span>Shuffle Demo Data</span>
          </button>

          <button
            type="button"
            onClick={onExitToLogin}
            className="h-8 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-slate-200 hover:text-white font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-98 whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5 text-amber-300" />
            <span>Sign In</span>
          </button>
        </div>
      </div>

      {/* Interactive Multi-Step Guided Tour Modal */}
      {isTourOpen && step && (
        <div
          className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          onClick={() => onToggleTour(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-[#0B0F1A] border border-white/15 shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden animate-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-mono-num font-bold text-sky-300">
                    App Walkthrough · Step {safeIndex + 1} of {GUEST_GUIDE_STEPS.length}
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white font-display truncate">
                    {step.title}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleTour(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Close Walkthrough"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step Selector Pills */}
            <div className="px-5 pt-3.5 pb-2 flex flex-wrap gap-1.5 border-b border-white/[0.07] bg-black/25">
              {GUEST_GUIDE_STEPS.map((s, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onStepChange(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-sky-400 text-slate-950 font-extrabold shadow-sm'
                        : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white border border-white/10'
                    }`}
                  >
                    {idx + 1}. {s.sectionLabel}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[68dvh] overflow-y-auto">
              <p className="text-sm text-slate-200 leading-relaxed">
                {step.summary}
              </p>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="text-xs font-bold text-white">How it works</div>
                <ul className="space-y-1.5">
                  {step.howItWorks.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-500/[0.08] border border-sky-400/25 space-y-2">
                <div className="text-xs font-bold text-sky-200">Try it in this Demo Sandbox</div>
                <ul className="space-y-1">
                  {step.tryItActions.map((tip, i) => (
                    <li key={i} className="text-xs text-slate-200 leading-relaxed flex items-start gap-2">
                      <Play className="w-3 h-3 text-sky-300 shrink-0 mt-1" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="px-5 py-3.5 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeIndex === 0}
                  onClick={() => onStepChange(Math.max(0, safeIndex - 1))}
                  className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (safeIndex < GUEST_GUIDE_STEPS.length - 1) {
                      onStepChange(safeIndex + 1);
                    } else {
                      onToggleTour(false);
                    }
                  }}
                  className="h-9 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{safeIndex < GUEST_GUIDE_STEPS.length - 1 ? 'Next Feature' : 'Finish Tour'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onJumpToTarget(step.target);
                    onToggleTour(false);
                  }}
                  className="h-9 px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <span>{step.target.ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
