// Utility for browser Web Push Notifications and Service Worker management

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isWebPushSupported()) return 'denied';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return registration;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

export async function requestWebPushPermission(): Promise<boolean> {
  if (!isWebPushSupported()) {
    alert('Web Push Notifications are not supported in your browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('jee_arena_web_push_enabled', 'true');
      await registerServiceWorker();
      sendWebPushNotification('⚡ Web Push Notifications Active!', {
        body: 'You will now receive real-time study updates, task bounties, and arena alerts on your device!',
        tag: 'push-activation-welcome'
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
  if (!isWebPushSupported() || Notification.permission !== 'granted') return false;
  const val = localStorage.getItem('jee_arena_web_push_enabled');
  return val === null || val === 'true'; // Enabled by default if permission granted
}

export function setWebPushEnabledByUser(enabled: boolean): void {
  localStorage.setItem('jee_arena_web_push_enabled', enabled ? 'true' : 'false');
}

export interface WebNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  vibrate?: number[];
  data?: any;
}

export function sendWebPushNotification(title: string, options: WebNotificationOptions = {}): void {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return;
  if (!isWebPushEnabledByUser()) return;

  const defaultOptions: WebNotificationOptions = {
    body: 'New update in JEE Grind Arena',
    icon: '/favicon.ico',
    tag: 'jee-arena-push-' + Date.now(),
    vibrate: [100, 50, 100],
    ...options
  };

  // 1. Try sending through Service Worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      options: defaultOptions
    });
    return;
  }

  // 2. Fallback to Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, defaultOptions as NotificationOptions);
    }).catch(() => {
      // 3. Fallback to standard Notification API
      try {
        new Notification(title, defaultOptions as NotificationOptions);
      } catch (e) {
        console.warn('Notification display failed:', e);
      }
    });
    return;
  }

  // 4. Standard Notification API
  try {
    new Notification(title, defaultOptions as NotificationOptions);
  } catch (e) {
    console.warn('Standard Notification fallback failed:', e);
  }
}

export async function sendTestNotification(): Promise<void> {
  const perm = getNotificationPermission();
  if (perm !== 'granted') {
    const granted = await requestWebPushPermission();
    if (!granted) return;
  }
  sendWebPushNotification('🔥 JEE Grind Arena Test Alert', {
    body: 'Web Push Notifications are working perfectly on your mobile device!',
    tag: 'test-notification-' + Date.now()
  });
}
