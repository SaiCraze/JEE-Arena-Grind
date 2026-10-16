// Background Timer Engine for JEE Grind Arena
// Ensures timers count accurately even if the phone screen locks, sleeps, or the device is turned off and back on.

import { sendWebPushNotification } from './notifications';

// 1-second silent WAV base64 string for background audio and lock screen media session
const SILENT_WAV_BASE64 = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let wakeLockSentinel: any = null;
let silentAudioEl: HTMLAudioElement | null = null;
let mediaSessionInterval: ReturnType<typeof setInterval> | null = null;
let workerInstance: Worker | null = null;

// ==================== SCREEN WAKE LOCK ====================

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestScreenWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) return false;
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.debug('WakeLock request error (normal if backgrounded):', err);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      await wakeLockSentinel.release();
    }
  } catch (e) {
    console.debug('WakeLock release error:', e);
  } finally {
    wakeLockSentinel = null;
  }
}

// ==================== MEDIA SESSION & LOCK SCREEN WIDGET ====================

export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function startLockScreenPresence(
  subject: string,
  onTogglePlayPause?: () => void
): void {
  try {
    if (typeof window === 'undefined') return;

    // 1. Initialize or resume silent looping audio to maintain background media session
    if (!silentAudioEl) {
      silentAudioEl = new Audio(SILENT_WAV_BASE64);
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.01; // nearly silent
    }

    silentAudioEl.play().catch(() => {
      // Browsers require user interaction; usually called from start/pause button click
    });

    // 2. Setup Media Session metadata
    if (isMediaSessionSupported()) {
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Focus Stopwatch • ${subject}`,
        artist: 'JEE Grind Arena',
        album: 'Wall-clock Background Study Tracker',
        artwork: [
          { src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' },
          { src: '/favicon.ico', sizes: '192x192', type: 'image/x-icon' }
        ]
      });

      // Allow pausing/resuming directly from phone lock screen
      if (onTogglePlayPause) {
        navigator.mediaSession.setActionHandler('play', () => {
          onTogglePlayPause();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          onTogglePlayPause();
        });
      }
    }
  } catch (e) {
    console.debug('Lock screen presence error:', e);
  }
}

export function updateLockScreenTime(seconds: number, subject: string): void {
  if (!isMediaSessionSupported()) return;
  try {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    const timeStr = `${hrs}:${mins}:${secs}`;

    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      navigator.mediaSession.metadata.title = `⏱️ ${timeStr} • ${subject}`;
    }
  } catch {
    // Ignore minor errors
  }
}

export function stopLockScreenPresence(): void {
  try {
    if (silentAudioEl) {
      silentAudioEl.pause();
      silentAudioEl.currentTime = 0;
    }
    if (isMediaSessionSupported()) {
      navigator.mediaSession.playbackState = 'paused';
    }
    if (mediaSessionInterval) {
      clearInterval(mediaSessionInterval);
      mediaSessionInterval = null;
    }
  } catch (e) {
    console.debug('Stop lock screen presence error:', e);
  }
}

// ==================== BACKGROUND WEB WORKER TICKER ====================

export function createBackgroundWorker(onTick: () => void): () => void {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return () => {};
  }

  try {
    // Inline Web Worker blob so we don't need a separate static file
    const workerBlob = new Blob([
      `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!intervalId) {
            intervalId = setInterval(function() {
              self.postMessage('tick');
            }, 1000);
          }
        } else if (e.data === 'stop') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
      `
    ], { type: 'application/javascript' });

    const workerUrl = URL.createObjectURL(workerBlob);
    workerInstance = new Worker(workerUrl);

    workerInstance.onmessage = (e) => {
      if (e.data === 'tick') {
        onTick();
      }
    };

    workerInstance.postMessage('start');

    return () => {
      if (workerInstance) {
        workerInstance.postMessage('stop');
        workerInstance.terminate();
        workerInstance = null;
      }
      URL.revokeObjectURL(workerUrl);
    };
  } catch (err) {
    console.warn('Worker ticker init error, fallback to interval:', err);
    return () => {};
  }
}

// ==================== MILESTONE NOTIFICATIONS ====================

const NOTIFIED_MILESTONES_KEY = 'jee_arena_timer_notified_milestones';

export function checkAndSendTimerMilestoneNotification(seconds: number, subject: string): void {
  const mins = Math.floor(seconds / 60);
  if (mins < 25) return;

  try {
    const raw = localStorage.getItem(NOTIFIED_MILESTONES_KEY);
    const notified = raw ? JSON.parse(raw) : [];

    // Milestones at 25m (Pomodoro), 50m, 60m (1 hr), 90m, 120m (2 hrs), 180m (3 hrs), 240m (4 hrs)
    const milestones = [25, 50, 60, 90, 120, 180, 240, 300, 360];
    for (const m of milestones) {
      if (mins >= m && !notified.includes(m)) {
        notified.push(m);
        localStorage.setItem(NOTIFIED_MILESTONES_KEY, JSON.stringify(notified));

        const hrText = m >= 60 ? `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1)} Hours` : `${m} Minutes`;
        sendWebPushNotification(`🔥 ${hrText} of ${subject} Completed!`, {
          body: `Keep up the focus streak! Timer is active and counting accurately.`,
          tag: `timer-milestone-${m}`
        });
        break;
      }
    }
  } catch {
    // Ignore storage issues
  }
}

export function resetTimerMilestones(): void {
  try {
    localStorage.removeItem(NOTIFIED_MILESTONES_KEY);
  } catch {
    // Ignore
  }
}
