// Service Worker for JEE Grind Arena PWA
// - Offline App Shell & Static Asset Caching (Stale-While-Revalidate)
// - Network-First Dynamic Data Strategy (Leaderboards, XP, Sessions, Firestore, APIs)
// - Background Live Timer Notification Sync & Web Push Alerts

const STATIC_CACHE_NAME = 'jee-grind-arena-static-v12';
const DYNAMIC_CACHE_NAME = 'jee-grind-arena-dynamic-v12';
let lastKnownMemberId = 'scholar';
let lastKnownMemberName = '';

function urlBase64ToUint8ArraySw(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function keysMatchSw(sub, expectedBytes) {
  try {
    if (!sub || !sub.options || !sub.options.applicationServerKey) return false;
    const actual = new Uint8Array(sub.options.applicationServerKey);
    if (actual.length !== expectedBytes.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expectedBytes[i]) return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}

async function ensureSwPushSubscription(memberIdOverride, memberNameOverride) {
  try {
    if (!self.registration || !self.registration.pushManager) return false;
    if (memberIdOverride && memberIdOverride !== 'scholar') {
      lastKnownMemberId = memberIdOverride;
    }
    if (memberNameOverride) {
      lastKnownMemberName = memberNameOverride;
    }
    const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (!keyRes.ok) return false;
    const keyData = await keyRes.json();
    const publicKey = keyData && keyData.publicKey;
    const activeEndpoints = Array.isArray(keyData && keyData.activeEndpoints) ? keyData.activeEndpoints : [];
    if (!publicKey) return false;

    const expectedBytes = urlBase64ToUint8ArraySw(publicKey);
    let sub = await self.registration.pushManager.getSubscription();

    if (sub) {
      const keyMatches = keysMatchSw(sub, expectedBytes);
      const isKnownOnServer = activeEndpoints.includes(sub.endpoint);
      if (!keyMatches || !isKnownOnServer) {
        try {
          await sub.unsubscribe();
        } catch (_e) {}
        sub = null;
      }
    }

    if (!sub) {
      sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedBytes
      });
    }

    const ua = (self.navigator && self.navigator.userAgent) || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON ? sub.toJSON() : sub,
        vapidPublicKey: publicKey,
        memberId: lastKnownMemberId || 'scholar',
        memberName: lastKnownMemberName || '',
        isMobile,
        isStandalone: true,
        userAgent: ua
      })
    });
    if (subRes.status === 409) {
      try {
        await sub.unsubscribe();
      } catch (_e) {}
      const freshSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: expectedBytes
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: freshSub.toJSON ? freshSub.toJSON() : freshSub,
          vapidPublicKey: publicKey,
          memberId: lastKnownMemberId || 'scholar',
          memberName: lastKnownMemberName || '',
          isMobile,
          isStandalone: true,
          userAgent: ua
        })
      });
    }
    return true;
  } catch (_e) {
    return false;
  }
}

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        APP_SHELL_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // Ignore individual asset failure during install
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
      .then(() => ensureSwPushSubscription())
  );
});

function isDynamicDataRequest(url) {
  // Keep leaderboards, XP, sessions, Firestore, and API endpoints strictly Network-First
  if (url.pathname.startsWith('/api/')) return true;
  if (url.hostname.includes('firestore.googleapis.com')) return true;
  if (url.hostname.includes('identitytoolkit.googleapis.com')) return true;
  if (url.hostname.includes('securetoken.googleapis.com')) return true;
  if (url.pathname.includes('bootstrap') || url.pathname.includes('mutate')) return true;
  return false;
}

function isRealtimeStreamRequest(url, request) {
  if (url.pathname.includes('/api/firestore/stream')) return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) return true;
  return false;
}

function isCodeAssetRequest(url, request) {
  if (request.destination === 'script' || request.destination === 'style') return true;
  return /\.(?:js|mjs|ts|tsx|css)$/i.test(url.pathname) || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/');
}

function isStaticAssetRequest(url, request) {
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    return true;
  }
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    return true;
  }
  return /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|json|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never intercept Server-Sent Events (SSE) live streams
  if (isRealtimeStreamRequest(url, request)) return;

  // 1. Dynamic Data (Leaderboards, XP, Sessions, APIs) -> Network-First with cache fallback
  if (isDynamicDataRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
            const cloned = networkResponse.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ offline: true, error: 'Network unavailable - serving offline state' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 2. HTML Navigation & Code Assets (JS, TS, CSS) -> Network-First so new code updates appear immediately!
  if (request.mode === 'navigate' || request.destination === 'document' || isCodeAssetRequest(url, request)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
              if (request.mode === 'navigate') {
                cache.put('/', cloned.clone());
              }
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedAsset = await caches.match(request);
          if (cachedAsset) return cachedAsset;
          if (request.mode === 'navigate' || request.destination === 'document') {
            return (await caches.match('/')) || (await caches.match('/index.html')) || Response.error();
          }
          return Response.error();
        })
    );
    return;
  }

  // 3. Static Media Assets (Fonts, Icons, Images) -> Stale-While-Revalidate
  if (isStaticAssetRequest(url, request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              const cloned = networkResponse.clone();
              caches.open(STATIC_CACHE_NAME).then((cache) => {
                cache.put(request, cloned);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});

// Handle real background Web Push events from VAPID push server (wakes up locked mobile devices even when app is closed)
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ JEE Grind Arena Alert',
    body: 'New activity in JEE Grind Arena!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'jee-arena-push-' + Date.now(),
    renotify: true,
    silent: false,
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (_e) {
      data.body = event.data.text();
    }
  }

  const isSilent = Boolean(data.silent);
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'jee-arena-push-' + Date.now(),
    renotify: data.renotify !== undefined ? Boolean(data.renotify) : true,
    silent: isSilent,
    requireInteraction: Boolean(data.requireInteraction),
    data: data.data || { url: '/' }
  };

  if (!isSilent) {
    options.vibrate = data.vibrate || [160, 80, 160];
  }

  const fullOptions = Object.assign({}, options, {
    actions: data.actions || [
      { action: 'open', title: '⚡ Open Arena' }
    ]
  });

  event.waitUntil(
    self.registration
      .showNotification(data.title, fullOptions)
      .catch(() => self.registration.showNotification(data.title, options))
      .catch(() =>
        self.registration.showNotification(data.title || '⚡ JEE Grind Arena Alert', {
          body: data.body || 'New Arena update!',
          icon: '/pwa-192x192.png'
        })
      )
      .catch(() => {})
  );
});

// Automatically renew Web Push subscription if rotated in the background while the app is closed
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(ensureSwPushSubscription());
});

// Listen for messages sent directly from App client (Notifications & Background Live Timer)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const isSilent = Boolean(options && options.silent);
    const cleanOptions = {
      body: (options && options.body) || 'New update in JEE Grind Arena',
      icon: (options && options.icon) || '/pwa-192x192.png',
      badge: (options && options.badge) || '/pwa-192x192.png',
      tag: (options && options.tag) || 'jee-arena-local-' + Date.now(),
      renotify: Boolean(options && options.renotify),
      silent: isSilent,
      requireInteraction: Boolean(options && options.requireInteraction),
      data: (options && options.data) || { url: '/' }
    };
    if (!isSilent) {
      cleanOptions.vibrate = (options && options.vibrate) || [120, 60, 120];
    }
    const withActions = Object.assign({}, cleanOptions);
    if (options && Array.isArray(options.actions) && options.actions.length > 0) {
      withActions.actions = options.actions.slice(0, 2);
    }
    event.waitUntil(
      self.registration
        .showNotification(title, withActions)
        .catch(() => self.registration.showNotification(title, cleanOptions))
        .catch(() => {})
    );
  }

  if (event.data.type === 'CLOSE_NOTIFICATION' && event.data.tag) {
    event.waitUntil(
      self.registration.getNotifications({ tag: event.data.tag }).then((list) => {
        list.forEach((n) => n.close());
      }).catch(() => {})
    );
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SYNC_VAPID_PUSH') {
    event.waitUntil(ensureSwPushSubscription(event.data.memberId, event.data.memberName));
  }
});

// Notification click event (handles both body taps and Lock-Screen Timer Action Buttons: Pause, Resume, Lap, Stop)
self.addEventListener('notificationclick', (event) => {
  const action = event.action || 'open';
  const notifData = event.notification.data || {};
  const urlToOpen = notifData.url || '/';
  const isTimerAction =
    action === 'pause_timer' ||
    action === 'resume_timer' ||
    action === 'lap_timer' ||
    action === 'stop_timer' ||
    action === 'minus_1m' ||
    action === 'plus_1m';

  // Broadcast to BroadcastChannel as an additional fast path
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('jee_arena_timer_controls');
      bc.postMessage({
        type: 'TIMER_NOTIFICATION_ACTION',
        action,
        data: notifData,
        timestamp: Date.now()
      });
      bc.close();
    }
  } catch (_e) {
    // Ignore if BroadcastChannel unavailable
  }

  if (isTimerAction && action !== 'stop_timer') {
    // Keep notification alive on lock screen and flip state immediately while app processes in background
    const subject = notifData.subject || 'Study';
    const timeStr = notifData.timeStr || '';
    let nextTitle = event.notification.title;
    let nextBody = event.notification.body;
    let nextActions = [
      { action: 'pause_timer', title: '❚❚ Pause' },
      { action: 'stop_timer', title: '⏹ End & Log' }
    ];

    if (action === 'pause_timer') {
      nextTitle = `❚❚ PAUSED ${timeStr ? `(${timeStr}) ` : ''}• ${subject}`;
      nextBody = 'Timer paused from lock screen. Tap Resume when ready to continue grinding.';
      nextActions = [
        { action: 'resume_timer', title: '▶ Resume' },
        { action: 'stop_timer', title: '⏹ End & Log' }
      ];
    } else if (action === 'resume_timer') {
      nextTitle = `⏱️ ${timeStr ? `${timeStr} • ` : ''}Studying ${subject}`;
      nextBody = 'Live Study Stopwatch running. Tap Pause or End & Log below.';
      nextActions = [
        { action: 'pause_timer', title: '❚❚ Pause' },
        { action: 'stop_timer', title: '⏹ End & Log' }
      ];
    } else if (action === 'lap_timer') {
      nextBody = `🏁 Lap recorded at ${timeStr || 'current split'}! Timer continues running.`;
    }

    const baseOpts = {
      body: nextBody,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'jee-arena-active-timer',
      silent: true,
      renotify: false,
      requireInteraction: true,
      data: { ...notifData, lastAction: action }
    };

    event.waitUntil(
      Promise.all([
        self.registration
          .showNotification(nextTitle, Object.assign({}, baseOpts, { actions: nextActions }))
          .catch(() => self.registration.showNotification(nextTitle, baseOpts))
          .catch(() => {}),
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (let i = 0; i < windowClients.length; i++) {
            windowClients[i].postMessage({
              type: 'TIMER_NOTIFICATION_ACTION',
              action,
              data: notifData
            });
          }
        })
      ])
    );
    return;
  }

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        client.postMessage({
          type: isTimerAction ? 'TIMER_NOTIFICATION_ACTION' : 'NOTIFICATION_CLICKED',
          action,
          data: notifData
        });
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

