import type { ColorId } from '../game/colors';

// Audio Engine (ARCHITECTURE §2.4): local Web Audio oscillators, no audio files.
// The AudioContext is created/resumed only from a user gesture ("התחל משחק").

/** Distinct pitch per color, inspired by the original Simon device. */
const COLOR_FREQUENCIES: Record<ColorId, number> = {
  green: 415,
  red: 310,
  yellow: 252,
  blue: 209,
};

const ATTACK_S = 0.01;
const RELEASE_S = 0.02;
const TONE_GAIN = 0.3;

type Voice = { osc: OscillatorNode; gain: GainNode; peak: number; ended: boolean };

let context: AudioContext | null = null;
const activeVoices = new Set<Voice>();

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Creates (first time) and resumes the AudioContext. Must be called synchronously inside a user gesture.
 * Resolves true only if audio is actually running.
 */
export async function unlockAudio(): Promise<boolean> {
  try {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return false;
    if (!context) context = new Ctor();
    const ctx = context;
    if (ctx.state !== 'running') await ctx.resume();
    return (ctx.state as AudioContextState) === 'running';
  } catch {
    return false;
  }
}

function startVoice(frequency: number, type: OscillatorType, peak: number, when = 0): Voice | null {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return null;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  // Short envelope to avoid clicks.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + ATTACK_S);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  const voice: Voice = { osc, gain, peak, ended: false };
  activeVoices.add(voice);
  osc.onended = () => {
    voice.ended = true;
    activeVoices.delete(voice);
    osc.disconnect();
    gain.disconnect();
  };
  return voice;
}

// May be called again later (e.g. stopAll overriding a scheduled stop); the last call wins.
function stopVoice(voice: Voice, at?: number) {
  const ctx = context;
  if (!ctx || voice.ended) return;
  const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
  try {
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(t > ctx.currentTime ? voice.peak : voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + RELEASE_S);
    voice.osc.stop(t + RELEASE_S + 0.01);
  } catch {
    // Already stopped.
  }
}

/** Starts a color tone that lasts until the returned function is called (player press). */
export function startTone(color: ColorId): () => void {
  const voice = startVoice(COLOR_FREQUENCIES[color], 'triangle', TONE_GAIN);
  return () => {
    if (voice) stopVoice(voice);
  };
}

/** Plays a color tone of a fixed duration (sequence presentation). */
export function playTone(color: ColorId, durationMs: number): void {
  const voice = startVoice(COLOR_FREQUENCIES[color], 'triangle', TONE_GAIN);
  if (voice && context) stopVoice(voice, context.currentTime + durationMs / 1000 - RELEASE_S);
}

/** Short ascending victory motif (C5–E5–G5–C6). */
export function playWinSound(): void {
  const ctx = context;
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const when = i * 0.13;
    const voice = startVoice(freq, 'square', 0.12, when);
    const length = i === notes.length - 1 ? 0.4 : 0.11;
    if (voice) stopVoice(voice, ctx.currentTime + when + length);
  });
}

/** Low descending loss tone. */
export function playLoseSound(): void {
  const ctx = context;
  if (!ctx) return;
  const voice = startVoice(180, 'sawtooth', 0.15);
  if (!voice) return;
  voice.osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.6);
  stopVoice(voice, ctx.currentTime + 0.6);
}

/** Immediately silences every active tone. */
export function stopAll(): void {
  for (const voice of activeVoices) stopVoice(voice);
}
