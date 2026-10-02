/* Jewelzz sound design — opt-in, synthesized via Web Audio.
 *
 * Four short cues, each tied to an identity moment:
 *   bell()   — sale posted (two-note chime, bright + warm)
 *   stamp()  — ledger sealed / backup (thud + brief ring)
 *   drop()   — item added / rate set / small confirmation (low tap)
 *   tick()   — error / warning (soft minor-third dyad, barely audible)
 *
 * Why synthesized: no asset bundle, no CDN dependency, fully customisable
 * at runtime. Each sound is just a few envelope curves on an OscillatorNode.
 *
 * Preference persists in localStorage. Default: OFF. The user has to toggle
 * it on in Settings — never surprise them with audio on first run.
 */

const STORAGE_KEY = 'jewelzz.sound.enabled';
const VOLUME = 0.18;              // overall gain — intentionally quiet
const SAMPLE_RATE_GUARD_MS = 70;  // ignore back-to-back triggers inside this window

let ctx: AudioContext | null = null;
let lastPlayed = 0;

function enabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isSoundEnabled(): boolean { return enabled(); }

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch { /* ignore */ }
}

function getCtx(): AudioContext | null {
  if (!enabled()) return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function envelope(gain: GainNode, now: number, attack: number, hold: number, release: number, peak: number) {
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
}

function tone(c: AudioContext, freq: number, start: number, attack: number, hold: number, release: number, peak = 1, type: OscillatorType = 'sine') {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  envelope(g, start, attack, hold, release, peak * VOLUME);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + attack + hold + release + 0.05);
}

function guard(): AudioContext | null {
  const now = Date.now();
  if (now - lastPlayed < SAMPLE_RATE_GUARD_MS) return null;
  lastPlayed = now;
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c;
}

/* ─── Four cues ───────────────────────────────────────────────────── */

/** Sale posted — a bright two-note bell. */
export function bell(): void {
  const c = guard(); if (!c) return;
  const t = c.currentTime;
  tone(c, 1318.5, t,         0.004, 0.02, 0.30, 1.0, 'triangle'); // E6
  tone(c, 987.8,  t + 0.09,  0.004, 0.02, 0.45, 0.85, 'triangle'); // B5
}

/** Backup sealed — a short press and a small resonant ring. */
export function stamp(): void {
  const c = guard(); if (!c) return;
  const t = c.currentTime;
  tone(c, 110,    t,        0.003, 0.015, 0.08, 0.9, 'square');    // thud
  tone(c, 440,    t + 0.06, 0.006, 0.02,  0.20, 0.6, 'triangle');  // ring
}

/** Item added / rate saved — a quiet low tap. */
export function drop(): void {
  const c = guard(); if (!c) return;
  const t = c.currentTime;
  tone(c, 523.3,  t, 0.004, 0.015, 0.10, 0.7, 'sine'); // C5
}

/** Error — subdued minor-third dyad. */
export function tick(): void {
  const c = guard(); if (!c) return;
  const t = c.currentTime;
  tone(c, 349.2,  t, 0.004, 0.03, 0.14, 0.6, 'sine');  // F4
  tone(c, 415.3,  t, 0.004, 0.03, 0.14, 0.5, 'sine');  // Ab4
}
