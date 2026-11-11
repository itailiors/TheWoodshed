import type { ChordEvent, TimePos, Tune } from "@reharm/theory-core";
import type { BandSource } from "./band";
import type { AudioEngine } from "./engine";

/*
 * The app's one player, as seen by the UI. This module has no Tone.js in it: the audio
 * engine (Tone, the samplers, the band) is a separate chunk that loads on the first Play,
 * or earlier when the browser is idle (`prefetchAudio`). Until then everything here works
 * on plain state, so components can import the player without pulling in any audio code.
 */

export type InstrumentSource = "salamander" | "synth";

export interface Arrangement {
  tune: Tune;
  chords: ChordEvent[];
  /** Inclusive bar range to loop. */
  loop: { startBar: number; endBar: number };
}

// ── trio mixer state ─────────────────────────────────────────────────────

export type Instrument = "piano" | "bass" | "drums";
export type Mix = Record<Instrument, boolean>;
export const DEFAULT_MIX: Mix = { piano: true, bass: true, drums: true };
const MIX_KEY = "reharm.mixer";

function loadMix(): Mix {
  try {
    const raw = localStorage.getItem(MIX_KEY);
    return raw ? { ...DEFAULT_MIX, ...JSON.parse(raw) } : DEFAULT_MIX;
  } catch {
    return DEFAULT_MIX;
  }
}

// ── load progress ────────────────────────────────────────────────────────

/** Per instrument: not started, loading, loaded from samples, or fell back to a synth. */
export type LoadState = "idle" | "loading" | "ready" | "fallback";
export type LoadProgress = Record<Instrument, LoadState>;
const NOT_LOADED: LoadProgress = { piano: "idle", bass: "idle", drums: "idle" };

let engineModule: Promise<typeof import("./engine")> | null = null;
const loadEngineModule = () => (engineModule ??= import("./engine"));

/**
 * Fetch the audio engine's code ahead of time (no sound, no AudioContext unlock), so the
 * first Play doesn't wait on the download and stays inside the click's activation window.
 */
export function prefetchAudio() {
  const go = () => void loadEngineModule().catch(() => (engineModule = null));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}

type Listener = (pos: TimePos | null) => void;

class Player {
  private engine: AudioEngine | null = null;
  private booting: Promise<InstrumentSource> | null = null;
  private listeners = new Set<Listener>();
  private mixListeners = new Set<() => void>();
  private progressListeners = new Set<() => void>();
  private disposed = false;
  source: InstrumentSource | null = null;
  /** Whether the bass and drums came up sampled or fell back to synths. */
  bandSource: { bass: BandSource; drums: BandSource } | null = null;
  /** Who is playing. Replaced (not mutated) on change, so React can compare snapshots. */
  mix: Mix = loadMix();
  /** Replaced on every change, for the same reason. */
  progress: LoadProgress = NOT_LOADED;

  /** Loads the engine and the instruments. Call from a user gesture (browser autoplay rules). */
  init(): Promise<InstrumentSource> {
    this.booting ??= (async () => {
      const { AudioEngine } = await loadEngineModule();
      const engine = new AudioEngine({
        mix: () => this.mix,
        position: (pos) => this.listeners.forEach((l) => l(pos)),
        progress: (inst, state) => {
          this.progress = { ...this.progress, [inst]: state };
          this.progressListeners.forEach((l) => l());
        },
      });
      const source = await engine.init();
      if (this.disposed) {
        engine.dispose();
        throw new Error("player was replaced while loading");
      }
      this.engine = engine;
      this.source = source;
      this.bandSource = engine.bandSource;
      return source;
    })().catch((err) => {
      this.booting = null; // let the next click try again
      throw err;
    });
    return this.booting;
  }

  onPosition(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onProgress(fn: () => void) {
    this.progressListeners.add(fn);
    return () => {
      this.progressListeners.delete(fn);
    };
  }

  /** Swap in a new arrangement (safe while playing). A no-op until the engine is up. */
  update(arrangement: Arrangement, tempo: number) {
    this.engine?.update(arrangement, tempo);
  }

  setTempo(bpm: number) {
    this.engine?.setTempo(bpm);
  }

  // ── trio mixer ──

  setMix(inst: Instrument, on: boolean) {
    this.mix = { ...this.mix, [inst]: on };
    try {
      localStorage.setItem(MIX_KEY, JSON.stringify(this.mix));
    } catch {
      /* private mode: the mix just won't be remembered */
    }
    if (!on) this.engine?.silence(inst);
    this.mixListeners.forEach((l) => l());
  }

  onMix(fn: () => void) {
    this.mixListeners.add(fn);
    return () => {
      this.mixListeners.delete(fn);
    };
  }

  // ── transport ──

  async play() {
    await this.init();
    this.engine?.play();
  }

  stop() {
    if (this.engine) this.engine.stop();
    else this.listeners.forEach((l) => l(null));
  }

  get playing() {
    return this.engine?.playing ?? false;
  }

  /** Fractional absolute beat of the transport (loop-aware), or null when stopped. */
  currentBeat(): number | null {
    return this.engine?.currentBeat() ?? null;
  }

  // ── direct auditions (ignore the mixer) ──

  /** Audition a voicing (coach "hear it"). */
  async playNotes(midis: number[], seconds = 1.6, delay = 0) {
    await this.init();
    this.engine?.playNotes(midis, seconds, delay);
  }

  async playSequence(voicings: number[][], secondsEach = 1.2) {
    await this.init();
    voicings.forEach((v, i) => this.engine?.playNotes(v, secondsEach * 1.1, i * secondsEach));
  }

  /** On-screen keys: sound while held. */
  async noteOn(midi: number) {
    await this.init();
    this.engine?.noteOn(midi);
  }

  noteOff(midi: number) {
    this.engine?.noteOff(midi);
  }

  /** Tear everything down (used when a dev hot reload replaces this module). */
  dispose() {
    this.disposed = true;
    this.engine?.dispose();
    this.engine = null;
    this.listeners.clear();
    this.mixListeners.clear();
    this.progressListeners.clear();
  }
}

// When Vite hot-swaps this module in dev, the old player's Parts would stay scheduled on
// Tone's global Transport and keep playing with no way to mute them. (Vite runs `dispose`
// only on the accepting boundary, a component, not on this module.) So each new copy
// tears down the previous one itself.
const g = globalThis as { __reharmPlayer?: { dispose?: () => void } };
g.__reharmPlayer?.dispose?.();
export const player = new Player();
g.__reharmPlayer = player;
