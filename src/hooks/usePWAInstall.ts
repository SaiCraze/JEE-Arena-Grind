import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

function detectStrictMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /android|iphone|ipad|ipod|iemobile|opera mini|mobile/i.test(ua);
  const iosPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const coarseTouchMobile =
    navigator.maxTouchPoints > 0 &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.innerWidth <= 900;
  return Boolean(mobileUa || iosPad || coarseTouchMobile);
}

function detectStandaloneInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.location.search.includes('source=pwa')
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__deferredPwaPrompt) {
      return window.__deferredPwaPrompt;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandaloneInstalled());
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => detectStrictMobileDevice());
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [showMobilePopup, setShowMobilePopup] = useState<boolean>(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const checkStandalone = () => {
      const standalone = detectStandaloneInstalled();
      setIsInstalled(standalone);
      return standalone;
    };

    const standaloneNow = checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    // Strictly detect mobile/tablet hardware ONLY (never true on desktop/laptops)
    const evaluateMobile = () => {
      const isMob = detectStrictMobileDevice();
      setIsMobileDevice(isMob);
      return isMob;
    };

    const isMobNow = evaluateMobile();

    if (window.__deferredPwaPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleCustomPromptAvailable = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt);
      }
    };

    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowMobilePopup(false);
      setShowInstallGuideModal(false);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleResize = () => {
      const mob = evaluateMobile();
      if (!mob) {
        setShowMobilePopup(false);
        setShowInstallGuideModal(false);
      }
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setShowMobilePopup(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handleCustomPromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installed', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('resize', handleResize);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    }

    // If opened on a mobile device and not already installed as a standalone app, prompt to install
    let popupTimer: ReturnType<typeof setTimeout> | null = null;
    if (isMobNow && !standaloneNow) {
      popupTimer = setTimeout(() => {
        if (evaluateMobile() && !checkStandalone()) {
          setShowMobilePopup(true);
        }
      }, 600);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handleCustomPromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installed', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('resize', handleResize);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      }
      if (popupTimer) clearTimeout(popupTimer);
    };
  }, []);

  const dismissMobilePopup = useCallback(() => {
    setShowMobilePopup(false);
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'guide'> => {
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPwaPrompt : null);
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const { outcome } = await activePrompt.userChoice;
        if (outcome === 'accepted') {
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
          setShowMobilePopup(false);
          setShowInstallGuideModal(false);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        setShowInstallGuideModal(true);
        return 'guide';
      }
    } else {
      setShowInstallGuideModal(true);
      return 'guide';
    }
  }, [deferredPrompt]);

  /**
   * Prompts the user to install the standalone mobile app EVERY TIME they log in on a MOBILE device.
   * Strictly no-op on desktop/laptop devices or when already running inside the installed standalone PWA.
   */
  const promptMobileInstallOnLogin = useCallback(async () => {
    const isMob = detectStrictMobileDevice();
    const standalone = detectStandaloneInstalled();
    setIsMobileDevice(isMob);
    setIsInstalled(standalone);

    // STRICTLY ONLY FOR MOBILE DEVICES (never desktop) and only if not already in the installed app
    if (!isMob || standalone) {
      setShowMobilePopup(false);
      return;
    }

    // Show the mobile install modal immediately upon login
    setShowMobilePopup(true);

    // If native Android/Chromium beforeinstallprompt is ready, also trigger the native install prompt right on the login gesture
    const activePrompt = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPwaPrompt : null);
    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const { outcome } = await activePrompt.userChoice;
        if (outcome === 'accepted') {
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
          setShowMobilePopup(false);
          setShowInstallGuideModal(false);
        }
      } catch {
        // Keep showMobilePopup open so they can tap Install App button
      }
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isMobileDevice,
    isInIframe,
    isOnline,
    showMobilePopup: showMobilePopup && isMobileDevice && !isInstalled,
    showInstallGuideModal: showInstallGuideModal && isMobileDevice && !isInstalled,
    setShowInstallGuideModal,
    dismissMobilePopup,
    triggerInstall,
    promptMobileInstallOnLogin
  };
}
