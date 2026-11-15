// Lightweight Web Audio synthesizers for funny prank sounds (no external files needed)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// 1. Dual-tone squeaky clown horn (honk-honk!)
export function playClownHorn() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    
    // First honk
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.linearRampToValueAtTime(1150, now + 0.08);
    osc1.frequency.linearRampToValueAtTime(800, now + 0.14);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second honk
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const t2 = now + 0.17;
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(920, t2);
    osc2.frequency.linearRampToValueAtTime(1200, t2 + 0.09);
    osc2.frequency.linearRampToValueAtTime(820, t2 + 0.16);
    gain2.gain.setValueAtTime(0.22, t2);
    gain2.gain.exponentialRampToValueAtTime(0.01, t2 + 0.18);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.18);
  } catch (e) {
    console.debug('Prank audio error', e);
  }
}

// 2. Cartoon spring / boing sound
export function playBoingSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {
    console.debug('Prank audio error', e);
  }
}

// 3. Sad Trombone (Wah-Wah-Wah-Waaaaah)
export function playSadTrombone() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 311.13, start: 0, dur: 0.22 },     // Eb4
      { freq: 293.66, start: 0.25, dur: 0.22 },  // D4
      { freq: 277.18, start: 0.50, dur: 0.22 },  // Db4
      { freq: 261.63, start: 0.75, dur: 0.55, slideTo: 220 } // C4 slide to A3
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const st = now + n.start;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, st);
      if (n.slideTo) {
        osc.frequency.linearRampToValueAtTime(n.slideTo, st + n.dur);
      }

      gain.gain.setValueAtTime(0.2, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(st);
      osc.stop(st + n.dur);
    });
  } catch (e) {
    console.debug('Prank audio error', e);
  }
}

// 4. Duck Quack
export function playDuckQuack() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.value = 4.0;

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.debug('Prank audio error', e);
  }
}

// 5. Cartoon Slide Whistle
export function playSlideWhistle(direction: 'up' | 'down' = 'up') {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    if (direction === 'up') {
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.35);
    } else {
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.35);
    }

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  } catch (e) {
    console.debug('Prank audio error', e);
  }
}

// Play a random funny prank sound
export function playRandomPrankSound() {
  const sounds = [playClownHorn, playBoingSound, playDuckQuack, () => playSlideWhistle('up')];
  const pick = sounds[Math.floor(Math.random() * sounds.length)];
  pick();
}
