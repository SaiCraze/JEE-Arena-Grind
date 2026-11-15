// Web Audio API Procedural Sound FX Synthesizer (Zero External Dependencies)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem('jee_arena_muted') === 'true';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('jee_arena_muted', String(muted));
  }
}

// 1. Cheerful ascending 3-note arpeggio (C5 -> E5 -> G5)
export function playLogSuccess(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.3);
  });
}

export const playArpeggioUp = playLogSuccess;

// 2. High-voltage retro arcade siren sound
export function playFirstBlood(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
  osc.frequency.exponentialRampToValueAtTime(1500, now + 0.6);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.7);
}

// 3. Bass-boosted snap / synth punch when logging JEE Advanced questions or attacking Boss
export function playCritHit(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Sub-bass punch
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.35);

  // High sparkle
  const oscHigh = ctx.createOscillator();
  const gainHigh = ctx.createGain();

  oscHigh.type = 'sine';
  oscHigh.frequency.setValueAtTime(1200, now);
  oscHigh.frequency.exponentialRampToValueAtTime(2400, now + 0.15);

  gainHigh.gain.setValueAtTime(0.15, now);
  gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  oscHigh.connect(gainHigh);
  gainHigh.connect(ctx.destination);

  oscHigh.start(now);
  oscHigh.stop(now + 0.2);
}

export const playBossAttackSound = playCritHit;

// 4. Shimmering high-pitch chime sequence for Loot Crates
export function playLootOpen(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5 to G6 chord

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.06);

    gain.gain.setValueAtTime(0, now + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.45);
  });
}

export const playCrateDropChime = playLootOpen;
export const playCrateOpenSound = playLootOpen;
export const playLootDrop = playLootOpen;

// 5. Humorous retro buzzer tone for Modulus-to-Allen Nudge
export function playNudgeBuzzer(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.setValueAtTime(220, now + 0.08);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

export const playRetroBuzzer = playNudgeBuzzer;

// 6. Crystalline Rest Shield Activation Chime
export function playShieldActivate(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [440, 554.37, 659.25, 880]; // A4 major triad

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0, now + idx * 0.06);
    gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.4);
  });
}

// 7. Obnoxious Multi-Horn Airhorn Blast + Chime (for Sound Horn XP Shop Sabotage)
export function playObnoxiousAirhorn(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Detuned stadium airhorn cluster
  const hornFreqs = [311.13, 329.63, 466.16, 622.25, 659.25];
  const blastStarts = [0, 0.22, 0.44];
  const blastDurations = [0.18, 0.18, 0.65];

  blastStarts.forEach((offset, bIdx) => {
    const dur = blastDurations[bIdx];
    hornFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + offset);
      osc.frequency.linearRampToValueAtTime(freq * 0.98, now + offset + dur);

      gain.gain.setValueAtTime(0.01, now + offset);
      gain.gain.linearRampToValueAtTime(0.14, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.02);
    });
  });
}

// 8. High-Stakes Duel Callout Horn
export function playDuelHorn(): void {
  if (isAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [293.66, 440, 587.33]; // D4 -> A4 -> D5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + i * 0.11);
    gain.gain.setValueAtTime(0.16, now + i * 0.11);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.11);
    osc.stop(now + i * 0.11 + 0.38);
  });
}

