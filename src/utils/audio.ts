// Procedural Web Audio API Sound Engine (Zero external assets required)

const MUTE_STORAGE_KEY = 'jee_arena_audio_muted';

export function isAudioMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {}
}

function getAudioContext(): AudioContext | null {
  if (isAudioMuted()) return null;
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

// 1. Ascending Arpeggio Chime for Standard Study Session Log
export function playLogSuccess(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.075);

    gain.gain.setValueAtTime(0.001, now + idx * 0.075);
    gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.075 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.075 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.075);
    osc.stop(now + idx * 0.075 + 0.36);
  });
}

// 2. First Blood Fanfare
export function playFirstBlood(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
  const now = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0.001, now + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.46);
  });
}

// 3. Critical Hit Snap (Boss Damaged / Hard Questions Solved)
export function playCritHit(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(920, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);

  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);

  const chime = ctx.createOscillator();
  const chimeGain = ctx.createGain();
  chime.type = 'sine';
  chime.frequency.setValueAtTime(1318.5, now + 0.06);
  chime.frequency.setValueAtTime(1567.98, now + 0.14);

  chimeGain.gain.setValueAtTime(0.001, now + 0.06);
  chimeGain.gain.exponentialRampToValueAtTime(0.2, now + 0.09);
  chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  chime.connect(chimeGain);
  chimeGain.connect(ctx.destination);
  chime.start(now + 0.06);
  chime.stop(now + 0.46);
}

// 4. Shimmering Mystery Loot Crate Chime
export function playLootOpen(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const shimmerFreqs = [587.33, 739.99, 880, 1174.66, 1479.98, 1760];
  const now = ctx.currentTime;

  shimmerFreqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.055);

    gain.gain.setValueAtTime(0.001, now + i * 0.055);
    gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.055 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.055);
    osc.stop(now + i * 0.055 + 0.56);
  });
}

// 5. Retro Modulus-to-Allen Buzzer Nudge Alert
export function playNudgeBuzzer(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  [0, 0.16].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now + offset);
    osc.frequency.setValueAtTime(185, now + offset + 0.06);

    gain.gain.setValueAtTime(0.18, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.14);
  });
}

// 6. Cinematic Dragon Boss Entrance Roar & Sub-Bass Impact
export function playBossEntrance(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Deep sub-bass drop
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sawtooth';
  sub.frequency.setValueAtTime(130, now);
  sub.frequency.exponentialRampToValueAtTime(38, now + 1.1);

  subGain.gain.setValueAtTime(0.001, now);
  subGain.gain.linearRampToValueAtTime(0.28, now + 0.08);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

  sub.connect(subGain);
  subGain.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 1.3);

  // Brass-like minor chord swell
  const chord = [220, 261.63, 329.63, 415.3];
  chord.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + 0.15 + idx * 0.06);

    gain.gain.setValueAtTime(0.001, now + 0.15 + idx * 0.06);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.15 + idx * 0.06);
    osc.stop(now + 1.45);
  });
}