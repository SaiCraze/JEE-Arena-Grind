import React, { useState } from 'react';
import { Download, X, Check, Share, Plus, Shield, Zap, Bell, WifiOff, ExternalLink } from 'lucide-react';

interface PWAInstallButtonProps {
  isInstallable: boolean;
  isInstalled: boolean;
  isMobileDevice?: boolean;
  onInstallClick: () => void;
  variant?: 'header' | 'sidebar' | 'login' | 'menu' | 'chip';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  isInstallable,
  isInstalled,
  isMobileDevice = true,
  onInstallClick,
  variant = 'header'
}) => {
  // Strictly hide on laptops/desktops and when already installed as a standalone PWA
  if (isInstalled || !isMobileDevice || variant === 'sidebar') return null;

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={onInstallClick}
        className="md:hidden w-full text-left p-2.5 rounded-xl text-xs bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 font-bold flex items-center justify-between transition-all cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Install Grind Arena App</span>
        </span>
        <span className="px-1.5 py-0.5 rounded bg-sky-400 text-slate-950 text-[9px] font-mono-num font-extrabold uppercase">
          APK / PWA
        </span>
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={onInstallClick}
        className="md:hidden shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-xs font-bold text-sky-200 flex items-center gap-1.5 transition-all cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (variant === 'login') {
    return (
      <button
        type="button"
        onClick={onInstallClick}
        className="md:hidden w-full py-2.5 px-3.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-sky-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-sm"
      >
        <Download className="w-4 h-4 text-sky-400 shrink-0" />
        <span>Install Standalone Mobile App</span>
        {isInstallable && (
          <span className="px-1.5 py-0.5 rounded-md bg-sky-400 text-slate-950 text-[9px] font-extrabold uppercase tracking-wider">
            Ready
          </span>
        )}
      </button>
    );
  }

  // Default: Header button — ONLY visible on mobile (< md), never on laptops!
  return (
    <button
      type="button"
      onClick={onInstallClick}
      className="md:hidden relative h-8 px-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-[11px] text-sky-200 font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer shrink-0"
      title="Install JEE Grind Arena App"
      aria-label="Install JEE Grind Arena App"
    >
      <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
      <span>App</span>
      {isInstallable && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 ring-2 ring-[#06070A]" />
      )}
    </button>
  );
};

interface MobilePWAInstallPopupProps {
  isOpen: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInIframe?: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'guide'>;
  onDismiss: () => void;
}

export const MobilePWAInstallPopup: React.FC<MobilePWAInstallPopupProps> = ({
  isOpen,
  isInstallable,
  isIOS,
  isInIframe = false,
  onInstall,
  onDismiss
}) => {
  const [showManualSteps, setShowManualSteps] = useState(false);

  if (!isOpen) return null;

  const directAppUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?pwa_install=1`
      : '/?pwa_install=1';

  const handlePrimaryInstall = async () => {
    if (isInstallable) {
      const res = await onInstall();
      if (res === 'guide') {
        setShowManualSteps(true);
      }
    } else {
      setShowManualSteps(true);
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-[190] flex items-end justify-center bg-black/80 backdrop-blur-sm p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-view">
      <div className="w-full max-w-md surface-card rounded-3xl p-4 border border-sky-400/45 shadow-[0_24px_60px_rgba(0,0,0,0.95)] space-y-3.5 relative overflow-hidden">
        {/* Top Accent Glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-28 rounded-full bg-sky-400/20 blur-2xl" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="JEE Grind Arena"
              className="w-12 h-12 rounded-2xl border border-sky-400/40 shadow-md shrink-0"
            />
            <div className="min-w-0">
              <span className="inline-block px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/35 text-sky-300 text-[9.5px] font-extrabold uppercase tracking-wider mb-0.5">
                Native Standalone App
              </span>
              <h3 className="text-sm font-extrabold text-white font-display tracking-tight truncate">
                Install JEE Grind Arena App
              </h3>
              <p className="text-[11px] text-slate-300 leading-snug">
                Full-screen native app interface with zero browser bars &amp; offline focus clock.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
            aria-label="Close install prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <div className="p-2 rounded-2xl bg-black/50 border border-white/[0.08] text-center space-y-0.5">
            <Zap className="w-3.5 h-3.5 text-sky-400 mx-auto" />
            <div className="text-[10px] font-bold text-white leading-tight">Standalone</div>
            <div className="text-[9px] text-slate-400 leading-tight">No URL Bar</div>
          </div>
          <div className="p-2 rounded-2xl bg-black/50 border border-white/[0.08] text-center space-y-0.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
            <div className="text-[10px] font-bold text-white leading-tight">Offline App</div>
            <div className="text-[9px] text-slate-400 leading-tight">Instant Launch</div>
          </div>
          <div className="p-2 rounded-2xl bg-black/50 border border-white/[0.08] text-center space-y-0.5">
            <Bell className="w-3.5 h-3.5 text-sky-300 mx-auto" />
            <div className="text-[10px] font-bold text-white leading-tight">Push Alerts</div>
            <div className="text-[9px] text-slate-400 leading-tight">Duels &amp; Squad</div>
          </div>
        </div>

        {/* Crucial Warning when inside AI Studio Preview Wrapper Iframe so it installs the real Standalone App instead of a bookmark */}
        {isInIframe && !isInstallable && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 space-y-2 text-xs text-slate-100 relative z-10">
            <div className="font-extrabold text-amber-300 text-[10.5px] uppercase tracking-wider">
              Important for Full Standalone App (No Browser Bar):
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              You are viewing inside a preview frame. To install as a <strong>true standalone app</strong> (instead of a normal website shortcut), tap below to open the direct app first, then tap <strong>Install App</strong>:
            </p>
            <a
              href={directAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDismiss}
              className="w-full py-2.5 px-3.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Open Direct App to Install Standalone</span>
            </a>
          </div>
        )}

        {/* iOS Safari or Manual Fallback Instructions */}
        {(!isInIframe || showManualSteps) && (isIOS || showManualSteps) && (
          <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-400/30 space-y-1.5 text-xs text-slate-200 relative z-10">
            <div className="font-bold text-sky-200 text-[10.5px] uppercase tracking-wider">
              {isIOS ? 'Install Full-Screen App on iPhone:' : 'Install Full-Screen App on Android:'}
            </div>
            {isIOS ? (
              <ol className="space-y-1.5 text-[11px] text-slate-200">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[9.5px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap <strong>Share</strong> <Share className="w-3 h-3 inline text-sky-300 mx-0.5" /> in Safari&apos;s bottom bar.
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[9.5px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Tap <strong>Add to Home Screen</strong> <Plus className="w-3 h-3 inline text-sky-300 mx-0.5" /> (launches full-screen with no Safari bars).
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-1.5 text-[11px] text-slate-200">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[9.5px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>
                    Tap the browser menu <strong>(⋮)</strong> in Chrome.
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[9.5px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Tap <strong>Install app</strong> (creates the native standalone app on your home screen).
                  </span>
                </li>
              </ol>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5 relative z-10">
          <button
            type="button"
            onClick={onDismiss}
            className="py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            Later
          </button>
          {isInstallable ? (
            <button
              type="button"
              onClick={handlePrimaryInstall}
              className="flex-1 py-2.5 px-4 rounded-xl btn-primary font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Install Standalone App</span>
            </button>
          ) : !isIOS && !showManualSteps && !isInIframe ? (
            <button
              type="button"
              onClick={handlePrimaryInstall}
              className="flex-1 py-2.5 px-4 rounded-xl btn-primary font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Install App</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 py-2.5 px-4 rounded-xl btn-primary font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Got It</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  isIOS: boolean;
  isInstallable: boolean;
  isInIframe?: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'guide'>;
  onClose: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  isIOS,
  isInstallable,
  isInIframe = false,
  onInstall,
  onClose
}) => {
  if (!isOpen) return null;

  const directAppUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?pwa_install=1`
      : '/?pwa_install=1';

  return (
    <div className="md:hidden fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-view">
      <div className="w-full max-w-md surface-card rounded-3xl p-5 border border-sky-400/35 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="JEE Grind Arena"
              className="w-12 h-12 rounded-2xl border border-sky-400/40 shrink-0"
            />
            <div>
              <h3 className="text-base font-extrabold text-white font-display">
                Install JEE Grind Arena
              </h3>
              <p className="text-xs text-slate-400">
                Standalone App • No Browser Bar • Offline Ready
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isInstallable ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Install <strong>JEE Grind Arena</strong> directly to your phone&apos;s home screen for a full-screen native app experience without browser address bars.
            </p>
            <button
              type="button"
              onClick={() => onInstall()}
              className="w-full py-3 px-4 rounded-2xl btn-primary font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Install Standalone App Now</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-300">
            {isInIframe && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/40 space-y-2">
                <div className="font-extrabold text-amber-300 uppercase tracking-wider text-[10.5px]">
                  Step 1: Open Direct App URL First
                </div>
                <p className="text-[11px] text-slate-200 leading-relaxed">
                  Because this page is inside a preview frame, adding to home screen right now would only save a website link. Open the direct app URL below to install the real standalone app:
                </p>
                <a
                  href={directAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Open Direct App &amp; Install</span>
                </a>
              </div>
            )}

            {isIOS ? (
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[10.5px]">
                  iPhone &amp; iPad (Safari) Installation:
                </div>
                <ol className="space-y-2 text-slate-200">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Tap the <strong>Share</strong> button <Share className="w-3.5 h-3.5 inline text-sky-300 mx-0.5" /> in Safari.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      Tap <strong>Add to Home Screen</strong> then <strong>Add</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="font-bold text-sky-300 uppercase tracking-wider text-[10.5px]">
                  Android (Chrome / Edge) Installation:
                </div>
                <ol className="space-y-2 text-slate-200">
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>
                      Tap the browser menu <strong>(⋮)</strong> in the top-right corner.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>
                      Tap <strong>Install app</strong> (creates the full-screen native app).
                    </span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export const PWAOfflineBanner: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[160] w-[92%] max-w-md px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-sky-400/40 text-xs text-slate-100 shadow-xl flex items-center justify-between gap-2 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-3.5 h-3.5 text-sky-400 shrink-0 animate-pulse" />
        <span className="truncate font-semibold">
          Offline Mode — App shell cached. Data syncs when back online.
        </span>
      </div>
      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9.5px] font-mono-num font-bold shrink-0">
        PWA
      </span>
    </div>
  );
};
