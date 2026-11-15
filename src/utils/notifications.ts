// Utility for browser Web Push Notifications, Mobile Phone Alerts, and Service Worker management
// Engineered to work reliably in both mobile Chrome/Safari AND installed Standalone PWAs (Android WebAPK & iOS Home Screen Apps)

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
}

export function isRunningStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.location.search.includes('source=pwa')
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function doesPushSubscriptionMatchKey(sub: PushSubscription | null, expectedBytes: Uint8Array): boolean {
  try {
    if (!sub || !sub.options || !sub.options.applicationServerKey) return false;
    const actual = new Uint8Array(sub.options.applicationServerKey);
    if (actual.length !== expectedBytes.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expectedBytes[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

let cachedVapidPublicKey: string | null = null;
let sessionPushSynced = false;
const blockedPushMemberIds = new Set<string>(['guest', 'nishchit_590']);

export function setBlockedPushMemberIds(ids: string[]): void {
  blockedPushMemberIds.clear();
  blockedPushMemberIds.add('guest');
  blockedPushMemberIds.add('nishchit_590');
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (id) blockedPushMemberIds.add(String(id).trim());
    }
  }
}

function isMemberBlockedFromClientPush(explicitMemberId?: string): boolean {
  if (typeof window === 'undefined') return false;
  const activeId = String(
    explicitMemberId ||
      localStorage.getItem('jee_arena_active_id') ||
      localStorage.getItem('jee_arena_active_member_id') ||
      ''
  ).trim();
  if (!activeId) return false;
  return blockedPushMemberIds.has(activeId);
}

/**
 * Subscribes this device's Service Worker PushManager to the backend VAPID Web Push server
 * so mobile & desktop devices receive push notifications even when all tabs and the app are completely closed.
 */
export async function syncWebPushSubscription(memberId?: string, memberName?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  if (isMemberBlockedFromClientPush(memberId)) {
    return false;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.pushManager) return false;

    let activeEndpoints: string[] | null = null;
    try {
      const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      if (keyRes.ok) {
        const keyJson = await keyRes.json();
        if (keyJson && keyJson.publicKey) {
          cachedVapidPublicKey = keyJson.publicKey;
        }
        if (Array.isArray(keyJson?.activeEndpoints)) {
          activeEndpoints = keyJson.activeEndpoints;
        }
      }
    } catch {
      // Fallback to cached key if offline
    }
    if (!cachedVapidPublicKey) return false;

    const convertedVapidKey = urlBase64ToUint8Array(cachedVapidPublicKey);
    let subscription = await registration.pushManager.getSubscription();
    const savedVapidKeyV3 = localStorage.getItem('jee_arena_vapid_pubkey_v3');

    if (subscription) {
      const keyMatches = doesPushSubscriptionMatchKey(subscription, convertedVapidKey);
      const isV3Verified = savedVapidKeyV3 === cachedVapidPublicKey;
      const isKnownOnServer = activeEndpoints === null ? true : activeEndpoints.includes(subscription.endpoint);
      if (!keyMatches || !isV3Verified || !isKnownOnServer) {
        try {
          await subscription.unsubscribe();
        } catch {}
        subscription = null;
      }
    }

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource
        });
      } catch (_subErr) {
        // If browser had a subscription with an old applicationServerKey, unsubscribe and retry once
        const oldSub = await registration.pushManager.getSubscription().catch(() => null);
        if (oldSub) {
          await oldSub.unsubscribe().catch(() => {});
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource
        });
      }
    }

    if (!subscription) return false;

    const ua = navigator.userAgent || '';
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const activeMemberId =
      memberId ||
      localStorage.getItem('jee_arena_active_id') ||
      localStorage.getItem('jee_arena_active_member_id') ||
      'scholar';
    const activeMemberName =
      memberName ||
      localStorage.getItem('jee_arena_active_member_name') ||
      '';

    if (memberId && memberId !== 'scholar') {
      localStorage.setItem('jee_arena_active_member_id', memberId);
    }
    if (memberName) {
      localStorage.setItem('jee_arena_active_member_name', memberName);
    }

    const postSubscription = async (subObj: PushSubscription) => {
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subObj.toJSON ? subObj.toJSON() : subObj,
          vapidPublicKey: cachedVapidPublicKey,
          memberId: activeMemberId,
          memberName: activeMemberName,
          isMobile: isMobileDevice,
          isStandalone: isRunningStandalonePWA(),
          userAgent: ua.slice(0, 140)
        })
      });
    };

    const subResp = await postSubscription(subscription);
    if (subResp.status === 409) {
      try {
        await subscription.unsubscribe();
      } catch {}
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource
      });
      await postSubscription(subscription);
    }

    if (registration.active) {
      registration.active.postMessage({
        type: 'SYNC_VAPID_PUSH',
        memberId: activeMemberId,
        memberName: activeMemberName
      });
    }

    localStorage.setItem('jee_arena_vapid_pubkey', cachedVapidPublicKey);
    localStorage.setItem('jee_arena_vapid_pubkey_v3', cachedVapidPublicKey);
    localStorage.setItem('jee_arena_vapid_subscribed', 'true');
    sessionPushSynced = true;
    return true;
  } catch (err) {
    console.warn('Web Push VAPID subscription sync warning:', err);
    return false;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    // Ensure active update check when opening installed app
    registration.update().catch(() => {});
    if ('Notification' in window && Notification.permission === 'granted') {
      syncWebPushSubscription().catch(() => {});
    }
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

const STANDALONE_NOTIF_PRIMED_KEY = 'jee_arena_standalone_notif_primed_v2';

/**
 * Ensures the installed Standalone PWA (Android WebAPK / iOS Home Screen App)
 * has its own OS-level notification permission granted and Service Worker active.
 * Call this inside any user gesture (login, timer start, button tap).
 */
export async function ensureStandaloneNotificationPermission(memberId?: string, memberName?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (isMemberBlockedFromClientPush(memberId)) return false;

  try {
    await registerServiceWorker();

    const currentPerm = Notification.permission;
    const isStandalone = isRunningStandalonePWA();
    const alreadyPrimedStandalone = localStorage.getItem(STANDALONE_NOTIF_PRIMED_KEY) === 'true';

    // On Android 13+ WebAPK, calling Notification.requestPermission() inside the standalone app
    // on a user gesture initializes the WebAPK's own Android system notification channel.
    if (currentPerm === 'default' || (isStandalone && !alreadyPrimedStandalone)) {
      const requested = await Notification.requestPermission();
      if ((requested as string) === 'granted') {
        localStorage.setItem('jee_arena_web_push_enabled', 'true');
        localStorage.removeItem(PUSH_MANUALLY_DISMISSED_KEY);
        if (isStandalone) {
          localStorage.setItem(STANDALONE_NOTIF_PRIMED_KEY, 'true');
        }
        syncWebPushSubscription(memberId, memberName).catch(() => {});
        return true;
      }
      return (requested as string) === 'granted';
    }

    if (currentPerm === 'granted') {
      if (localStorage.getItem('jee_arena_web_push_enabled') === null) {
        localStorage.setItem('jee_arena_web_push_enabled', 'true');
      }
      if (isStandalone && !alreadyPrimedStandalone) {
        localStorage.setItem(STANDALONE_NOTIF_PRIMED_KEY, 'true');
      }
      syncWebPushSubscription(memberId, memberName).catch(() => {});
      return true;
    }

    return false;
  } catch (err) {
    console.warn('ensureStandaloneNotificationPermission error:', err);
    return Notification.permission === 'granted';
  }
}

export async function requestWebPushPermission(memberId?: string, memberName?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!('Notification' in window)) {
    console.warn('Notifications API not directly supported in this browser window.');
    return false;
  }

  try {
    await registerServiceWorker();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('jee_arena_web_push_enabled', 'true');
      localStorage.setItem(STANDALONE_NOTIF_PRIMED_KEY, 'true');
      localStorage.removeItem(PUSH_MANUALLY_DISMISSED_KEY);
      await syncWebPushSubscription(memberId, memberName);
      sendWebPushNotification('⚡ Phone & Background Push Active!', {
        body: 'Background Web Push synced! Your phone will now receive live squad alerts even when locked or when the site is open on desktop.',
        tag: 'push-activation-welcome-' + Date.now()
      });
      return true;
    } else {
      localStorage.setItem('jee_arena_web_push_enabled', 'false');
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

export function isWebPushEnabledByUser(): boolean {
  if (typeof window === 'undefined') return false;
  const permission = 'Notification' in window ? Notification.permission : 'default';
  if (permission !== 'granted') return false;
  const val = localStorage.getItem('jee_arena_web_push_enabled');
  return val === null || val === 'true'; // Enabled by default once permission is granted
}

export function setWebPushEnabledByUser(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('jee_arena_web_push_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    localStorage.removeItem(PUSH_MANUALLY_DISMISSED_KEY);
    syncWebPushSubscription().catch(() => {});
  }
}

export interface WebNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface WebNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  vibrate?: number[];
  silent?: boolean;
  renotify?: boolean;
  requireInteraction?: boolean;
  allowReplaceTag?: boolean;
  actions?: WebNotificationAction[];
  data?: any;
}

// In-memory deduplication cache so identical one-shot events don't fire twice
const sentNotificationTags = new Set<string>();

export function closeWebPushNotification(tag: string): void {
  if (typeof window === 'undefined' || !tag) return;
  sentNotificationTags.delete(tag);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.getNotifications({ tag }))
      .then((list) => list?.forEach((n) => n.close()))
      .catch(() => {});

    if (navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLOSE_NOTIFICATION',
          tag
        });
      } catch {}
    }
  }
}

function buildSanitizedNotificationOptions(options: WebNotificationOptions): {
  fullOptions: any;
  basicOptions: any;
} {
  const isSilent = Boolean(options.silent);
  const tag = options.tag || 'jee-arena-push-' + Date.now();

  // Basic options guaranteed to work on every browser & standalone PWA container
  const basicOptions: any = {
    body: options.body || 'New update in JEE Grind Arena',
    icon: options.icon || '/pwa-192x192.png',
    badge: options.badge || '/pwa-192x192.png',
    tag,
    renotify: Boolean(options.renotify),
    requireInteraction: Boolean(options.requireInteraction),
    data: options.data || { url: '/' }
  };

  // CRITICAL: Chromium / Android WebAPK throws a TypeError if `vibrate` is present when `silent: true`!
  if (isSilent) {
    basicOptions.silent = true;
  } else {
    basicOptions.silent = false;
    basicOptions.vibrate = options.vibrate || [120, 60, 120];
  }

  const fullOptions: any = { ...basicOptions };

  // Respect Notification.maxActions (typically 2 on Android WebAPK, 0 on iOS)
  if (Array.isArray(options.actions) && options.actions.length > 0) {
    const maxSupported =
      typeof Notification !== 'undefined' && typeof (Notification as any).maxActions === 'number'
        ? (Notification as any).maxActions
        : 2;
    if (maxSupported > 0) {
      fullOptions.actions = options.actions.slice(0, maxSupported);
    }
  }

  return { fullOptions, basicOptions };
}

export function sendWebPushNotification(title: string, options: WebNotificationOptions = {}): boolean {
  if (typeof window === 'undefined') return false;
  if (isMemberBlockedFromClientPush()) return false;

  if (!sessionPushSynced && 'Notification' in window && Notification.permission === 'granted') {
    syncWebPushSubscription().catch(() => {});
  }

  // Deduplication check unless allowReplaceTag is true (used for live updating timer notification)
  if (options.tag && !options.allowReplaceTag && sentNotificationTags.has(options.tag)) {
    return false;
  }

  if (options.tag && !options.allowReplaceTag) {
    sentNotificationTags.add(options.tag);
    if (sentNotificationTags.size > 200) {
      const firstKey = sentNotificationTags.values().next().value;
      if (firstKey) sentNotificationTags.delete(firstKey);
    }
  }

  // Trigger mobile haptic vibration if not silent
  if (!options.silent && 'vibrate' in navigator) {
    try {
      navigator.vibrate(options.vibrate || [120, 60, 120]);
    } catch {
      // Ignored if browser blocks vibration without recent tap
    }
  }

  if (!('Notification' in window)) {
    return false;
  }

  // If permission is still 'default' (e.g., user just opened the installed Standalone PWA),
  // attempt to request permission asynchronously so subsequent notifications succeed.
  if (Notification.permission === 'default') {
    ensureStandaloneNotificationPermission().then((granted) => {
      if (granted) {
        dispatchNotificationViaBestChannel(title, options);
      }
    });
    return false;
  }

  if (Notification.permission !== 'granted' || !isWebPushEnabledByUser()) {
    return false;
  }

  dispatchNotificationViaBestChannel(title, options);
  return true;
}

function dispatchNotificationViaBestChannel(title: string, options: WebNotificationOptions): void {
  const { fullOptions, basicOptions } = buildSanitizedNotificationOptions(options);

  // 1. Primary Path for Standalone PWAs (Android WebAPK & iOS Home Screen):
  // Call registration.showNotification() directly from the client context so errors can be caught
  // and retried with basicOptions if the OS rejects action buttons or specific flags.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg && 'showNotification' in reg) {
          return reg.showNotification(title, fullOptions).catch(() => {
            // Fallback without actions/silent flags if the OS rejected fullOptions
            return reg.showNotification(title, basicOptions);
          });
        }
        return navigator.serviceWorker.ready.then((readyReg) =>
          readyReg.showNotification(title, fullOptions).catch(() =>
            readyReg.showNotification(title, basicOptions)
          )
        );
      })
      .catch(() => {
        // 2. Fallback to Service Worker postMessage or window Notification constructor
        if (navigator.serviceWorker.controller) {
          try {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title,
              options: fullOptions
            });
            return;
          } catch {}
        }
        try {
          new Notification(title, basicOptions);
        } catch {}
      });
    return;
  }

  // 3. Standard Notification API fallback
  try {
    new Notification(title, basicOptions);
  } catch (e) {
    console.warn('Standard Notification fallback failed:', e);
  }
}

export async function sendTestNotification(): Promise<boolean> {
  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    const granted = await requestWebPushPermission();
    if (!granted) return false;
  }
  setWebPushEnabledByUser(true);
  const activeMemberId =
    localStorage.getItem('jee_arena_active_id') ||
    localStorage.getItem('jee_arena_active_member_id') ||
    undefined;
  await syncWebPushSubscription(activeMemberId).catch(() => {});

  const testTag = 'test-notification-' + Date.now();
  try {
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '🔥 JEE Grind Arena Phone Push Verified',
        body: 'Background VAPID Web Push is active! You will receive live squad study updates even when Chrome & the app are closed.',
        tag: testTag,
        targetMemberId: activeMemberId,
        requireInteraction: true
      })
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && Number(json.sentCount) > 0) {
        return true;
      }
    }
  } catch {
    // Fallback to local notification below if offline
  }

  return sendWebPushNotification('🔥 JEE Grind Arena App Alerts Verified', {
    body: 'Notifications are active in your app! You will receive live squad study updates, chat pings, and lock-screen timer controls.',
    tag: testTag
  });
}

// ============================================================================
// HOURLY PUSH NOTIFICATION REMINDER ENGINE
// ============================================================================

export const PUSH_MANUALLY_DISMISSED_KEY = 'jee_arena_web_push_manually_dismissed';
export const PUSH_LAST_PROMPT_KEY = 'jee_arena_last_push_prompt_time';
export const PUSH_REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function isPushManuallyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PUSH_MANUALLY_DISMISSED_KEY) === 'true';
}

export function dismissPushNotificationsManually(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUSH_MANUALLY_DISMISSED_KEY, 'true');
  localStorage.setItem('jee_arena_web_push_enabled', 'false');
}

export function snoozePushNotificationReminder(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUSH_LAST_PROMPT_KEY, String(Date.now()));
}

export function shouldShowPushNotificationReminder(): boolean {
  if (typeof window === 'undefined') return false;
  if ('Notification' in window && Notification.permission === 'granted' && isWebPushEnabledByUser()) {
    return false;
  }
  if ('Notification' in window && Notification.permission === 'denied') {
    return false;
  }
  if (isPushManuallyDismissed()) {
    return false;
  }
  const lastPrompt = Number(localStorage.getItem(PUSH_LAST_PROMPT_KEY)) || 0;
  return Date.now() - lastPrompt >= PUSH_REMINDER_INTERVAL_MS;
}

// ============================================================================
// 5 PM - 12 AM EVENING STUDY MOTIVATION SPARK ENGINE
// ============================================================================

export interface StudyMotivationSpark {
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  title: string;
  fact: string;
  callToAction: string;
}

export const EVENING_MOTIVATION_SPARKS: StudyMotivationSpark[] = [
  {
    subject: 'Physics',
    title: 'The Negative Energy Mystery',
    fact: 'Dirac noticed his electron relativistic equation had square roots with negative solutions. Instead of discarding them, he dared to predict antimatter. 4 years later, the positron was discovered in cosmic rays.',
    callToAction: 'Your formula sheet is the universe blueprint. Lock in 45m of Physics right now!'
  },
  {
    subject: 'Physics',
    title: 'Light Has No Stopwatch',
    fact: 'Because light travels at c, time dilation is infinite from a photon perspective. A photon emitted from a star billions of years ago reaches your eye in literally zero elapsed proper time.',
    callToAction: 'Time moves fast, but tonight study hours are yours. Start a focus timer!'
  },
  {
    subject: 'Chemistry',
    title: 'The Ouroboros Ring',
    fact: 'Kekule dreamed of a snake biting its own tail and deduced benzene ring structure. Delocalized pi electrons give benzene 36 kcal/mol of extra resonance stabilization energy.',
    callToAction: 'Build your chemical intuition tonight. Solve 10 organic reaction mechanisms!'
  },
  {
    subject: 'Mathematics',
    title: 'The Most Beautiful Formula',
    fact: 'Euler identity e^(i*pi) + 1 = 0 unites the 5 greatest constants of mathematics using the 3 fundamental operations. Physicist Richard Feynman called it our most remarkable formula.',
    callToAction: 'Unleash your mathematical sharpness tonight. Open your problem set now!'
  },
  {
    subject: 'Physics',
    title: 'How Cats Defy Torque',
    fact: 'Falling cats always land on their feet with zero external torque. By twisting front and rear legs with opposite moments of inertia, angular momentum conservation turns their body 180 degrees.',
    callToAction: 'Rotational dynamics is pure magic once mastered. Tackle 5 rotational mechanics problems!'
  },
  {
    subject: 'Chemistry',
    title: 'Why Emeralds Are Green',
    fact: 'Both rubies and emeralds are aluminum oxide crystals doped with trace Cr3+ ions. The crystal field splitting in octahedral sites shifts absorbed wavelengths, turning red to green.',
    callToAction: 'Master coordination compounds and crystal field theory in a quick sprint!'
  },
  {
    subject: 'Physics',
    title: 'Relativity In Your Pocket',
    fact: 'GPS satellite atomic clocks tick 38 microseconds faster per day due to weaker orbital gravity. Without Einstein relativity equations, phone GPS would drift by 11 kilometers daily.',
    callToAction: 'Physics is the true superpower of modern engineering. Put in a 40m study block!'
  },
  {
    subject: 'Mathematics',
    title: 'Archimedes Infinite Lever',
    fact: 'Archimedes calculated the volume of a sphere 1800 years before Newton and Leibniz by balancing infinitesimal cross-sectional slices on a mechanical lever.',
    callToAction: 'Calculus is at your fingertips. Conquer 5 definite integration problems tonight!'
  },
  {
    subject: 'Chemistry',
    title: 'The Quantum Leap',
    fact: 'Bohr resolved why electrons do not spiral into the nucleus by postulating that angular momentum is quantized in discrete packets of h / (2*pi). Atoms can only emit discrete spectral lines.',
    callToAction: 'Tune your focus to your peak frequency. Knock out an atomic structure block!'
  },
  {
    subject: 'Physics',
    title: 'Defying Thermal Entropy',
    fact: 'The Second Law dictates that the entropy of an isolated system always increases. A disciplined study block is your personal act of ordering energy against chaos.',
    callToAction: 'Defy entropy tonight. Sit at your desk and start a 45m session!'
  },
  {
    subject: 'Chemistry',
    title: 'Ice Melts on Salt',
    fact: 'Salt melts ice even at -5 degrees C because dissolved ions disrupt the hydrogen-bonded water lattice, lowering the chemical potential and freezing point.',
    callToAction: 'Solutions and colligative properties are high-yield JEE marks. Review them now!'
  },
  {
    subject: 'Mathematics',
    title: 'Fermat Principle of Least Time',
    fact: 'Light bends when entering glass not because it feels a force, but because it automatically chooses the fastest path. This variational principle gave birth to modern analytical mechanics.',
    callToAction: 'Optimize your evening like a light ray. Begin your study block now!'
  }
];

export const EVENING_NUDGE_LAST_TIME_KEY = 'jee_arena_last_evening_nudge_time';
export const EVENING_NUDGE_COOLDOWN_MS = 45 * 60 * 1000;

export function isEveningStudyWindow(now: Date = new Date()): boolean {
  const hr = now.getHours();
  return hr >= 17 && hr < 24;
}

export function getRandomEveningSpark(): StudyMotivationSpark {
  const idx = Math.floor(Math.random() * EVENING_MOTIVATION_SPARKS.length);
  return EVENING_MOTIVATION_SPARKS[idx];
}

export const EVENING_NUDGE_LAST_DATE_KEY = 'jee_arena_last_evening_nudge_date';

export function triggerEveningStudyNudge(
  isCurrentlyStudying: boolean,
  force: boolean = false
): { sent: boolean; spark?: StudyMotivationSpark; reason?: string } {
  const now = new Date();
  const inWindow = isEveningStudyWindow(now);

  if (!force && !inWindow) {
    return { sent: false, reason: 'Outside 5PM-12AM window' };
  }

  if (!force && isCurrentlyStudying) {
    return { sent: false, reason: 'Scholar is already actively studying' };
  }

  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (!force && typeof window !== 'undefined') {
    const lastDate = localStorage.getItem(EVENING_NUDGE_LAST_DATE_KEY);
    if (lastDate === todayDateStr) {
      return { sent: false, reason: 'Already sent evening motivation spark for today' };
    }
  }

  const spark = getRandomEveningSpark();
  const title = `🌌 ${spark.subject}: ${spark.title}`;
  const body = `${spark.fact}\n\n👉 ${spark.callToAction}`;

  const pushSent = sendWebPushNotification(title, {
    body,
    tag: 'evening-study-spark-' + todayDateStr,
    vibrate: [200, 100, 200],
    data: { url: '/?action=study' }
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(EVENING_NUDGE_LAST_DATE_KEY, todayDateStr);
    localStorage.setItem(EVENING_NUDGE_LAST_TIME_KEY, String(Date.now()));
  }

  return { sent: pushSent, spark, reason: pushSent ? 'Sent successfully' : 'Push permissions not active' };
}

// ============================================================================
// IDLE SCHOLAR TEMPTATION ENGINE (TEMPTS USERS WHEN NOT ACTIVELY STUDYING)
// ============================================================================
export const IDLE_TEMPTATION_LAST_TIME_KEY = 'jee_arena_last_idle_temptation_time';

export function triggerIdleTemptationNudge(params: {
  memberName: string;
  rivalName?: string;
  bossHp?: number;
  isCurrentlyStudying: boolean;
  force?: boolean;
}): boolean {
  if (typeof window === 'undefined') return false;
  if (!params.force && params.isCurrentlyStudying) return false;

  const now = Date.now();
  const lastSent = Number(localStorage.getItem(IDLE_TEMPTATION_LAST_TIME_KEY)) || 0;
  // Minimum 90 minutes between client-side idle temptation nudges unless forced
  if (!params.force && now - lastSent < 90 * 60 * 1000) {
    return false;
  }

  const rival = params.rivalName || 'Utham';
  const bossHp = params.bossHp || 1200;
  const prompts = [
    {
      title: `🔥 ${params.memberName}, ${rival} is eyeing your Leaderboard spot!`,
      body: `Your desk has been quiet! Log a 25m focus session right now to unlock a Tier-IV Supply Crate & protect your rank!`
    },
    {
      title: `🎁 Unclaimed Supply Drop Waiting for ${params.memberName}!`,
      body: `Start a quick study sprint now to roll for a 1.5x Overclock XP Multiplier or +75 Instant XP while the Raid Boss has ${bossHp} HP left!`
    },
    {
      title: `⚡ 25 Minutes Now = +40 XP & 2x Boss Crit Damage!`,
      body: `Don't leave free XP on the table today, ${params.memberName}! Tap to launch your Study Stopwatch and overtake ${rival}.`
    }
  ];

  const chosen = prompts[Math.floor(Math.random() * prompts.length)];
  const sent = sendWebPushNotification(chosen.title, {
    body: chosen.body,
    tag: `idle-temptation-${now}`,
    vibrate: [180, 80, 180],
    data: { url: '/?action=study' }
  });

  if (sent) {
    localStorage.setItem(IDLE_TEMPTATION_LAST_TIME_KEY, String(now));
  }
  return sent;
}

