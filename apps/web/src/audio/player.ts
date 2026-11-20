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

export type Instrument = "piano" | "bass" | "drums" | "click";
export type Mix = Record<Instrument, boolean>;
/** The metronome starts off: it's a practice aid you reach for, not part of the band. */
export const DEFAULT_MIX: Mix = { piano: true, bass: true, drums: true, click: false };
const MIX_KEY = "reharm.mixer";
/** Generous: the sample loaders time out on their own (and fall back to synths) well before this. */
const INIT_TIMEOUT_MS = 20_000;
/** How far ahead (seconds) `playScore` hands notes to the engine: short, so a stop is near-instant. */
const LOOKAHEAD = 0.35;

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
/** What actually downloads (the click rides along with the drum kit). */
export type LoadPart = "piano" | "bass" | "drums";
export type LoadProgress = Record<LoadPart, LoadState>;

// ── count-in ─────────────────────────────────────────────────────────────

/** Bars of count-in before the band comes in. */
export type CountInBars = 0 | 1 | 2;
const COUNT_IN_KEY = "reharm.countIn";

/** Where the count-in is: beat `beat` of bar `bar` (of `bars`), in `beatsPerBar`. */
export interface CountState {
  beat: number;
  bar: number;
  bars: number;
  beatsPerBar: number;
}

function loadCountIn(): CountInBars {
  try {
    const raw = localStorage.getItem(COUNT_IN_KEY);
    if (raw === null) return 0;
    const n = Number(raw);
    return n === 1 || n === 2 ? n : 0;
  } catch {
    return 0;
  }
}
const NOT_LOADED: LoadProgress = { piano: "idle", bass: "idle", drums: "idle" };

let engineModule: Promise<typeof import("./engine")> | null = null;
const loadEngineModule = () => (engineModule ??= import("./engine"));

/**
 * Pre-fetch and warm the audio engine, convolution reverbs, and instrument samples on initial load
 * so clicking Play starts music immediately without a 3–6 s download/initialization stall.
 * Also attaches a one-time gesture listener to unlock the Web Audio clock on the first interaction.
 */
let gestureBound = false;
export function prefetchAudio() {
  if (typeof window !== "undefined" && !gestureBound) {
    gestureBound = true;
    const unlock = () => {
      player.resume();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    window.addEventListener("keydown", unlock, { capture: true, passive: true });
  }
  const warm = () => {
    void loadEngineModule()
      .then(() => player.init(false))
      .catch(() => {
        engineModule = null;
      });
  };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    requestIdleCallback(warm, { timeout: 300 });
  } else {
    setTimeout(warm, 50);
  }
}

type Listener = (pos: TimePos | null) => void;

class Player {
  private engine: AudioEngine | null = null;
  private booting: Promise<InstrumentSource> | null = null;
  private listeners = new Set<Listener>();
  private mixListeners = new Set<() => void>();
  private progressListeners = new Set<() => void>();
  private countListeners = new Set<() => void>();
  private disposed = false;
  source: InstrumentSource | null = null;
  /** Whether the bass and drums came up sampled or fell back to synths. */
  bandSource: { bass: BandSource; drums: BandSource } | null = null;
  /** Who is playing. Replaced (not mutated) on change, so React can compare snapshots. */
  mix: Mix = loadMix();
  /** Replaced on every change, for the same reason. */
  progress: LoadProgress = NOT_LOADED;
  /** Count-in length used by `play()`. */
  countInBars: CountInBars = loadCountIn();
  /** The count-in in progress, or null. Drives the "1 · 2 · 3" display. */
  count: CountState | null = null;

  /**
   * Loads the engine, convolution reverbs, and instrument samples.
   * When `unlock` is false (background pre-warming), samples and reverbs load into the
   * suspended context without triggering autoplay warnings; the first user gesture wakes it.
   */
  init(unlock = true): Promise<InstrumentSource> {
    if (unlock) this.resume();
    this.booting ??= (async () => {
      const { AudioEngine } = await loadEngineModule();
      const engine = new AudioEngine({
        mix: () => this.mix,
        position: (pos) => this.listeners.forEach((l) => l(pos)),
        progress: (inst, state) => {
          this.progress = { ...this.progress, [inst]: state };
          this.progressListeners.forEach((l) => l());
        },
        count: (c) => {
          this.count = c;
          this.countListeners.forEach((l) => l());
        },
      });
      // Watchdog: loading must never spin forever. If the band isn't ready in time, fail this
      // attempt (Play shows an error and the next press starts over) and throw away the
      // straggler if it ever does finish.
      let timedOut = false;
      const loading = engine.init(unlock);
      const source = await Promise.race([
        loading,
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            timedOut = true;
            reject(new Error(`audio engine didn't finish loading within ${INIT_TIMEOUT_MS / 1000} s`));
          }, INIT_TIMEOUT_MS),
        ),
      ]).catch((err) => {
        if (timedOut) void loading.then(() => engine.dispose(), () => engine.dispose());
        throw err;
      });
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

  /** Count-in in progress (for the visual count), or null. Fires on every count beat. */
  onCount(fn: () => void) {
    this.countListeners.add(fn);
    return () => {
      this.countListeners.delete(fn);
    };
  }

  setCountIn(bars: CountInBars) {
    this.countInBars = bars;
    try {
      localStorage.setItem(COUNT_IN_KEY, String(bars));
    } catch {
      /* not remembered */
    }
    this.countListeners.forEach((l) => l());
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

  /** Start from the top of the loop, after the count-in (if one is set). */
  async play() {
    await this.init();
    this.engine?.play(this.countInBars);
  }

  stop() {
    if (this.engine) this.engine.stop();
    else this.listeners.forEach((l) => l(null));
  }

  /** True from the first count-in click on (so a second Space press stops instead of restarting). */
  get playing() {
    return this.engine?.playing ?? false;
  }

  /** Fractional absolute beat of the transport (loop-aware), or null when stopped. */
  currentBeat(): number | null {
    return this.engine?.currentBeat() ?? null;
  }

  // ── direct auditions (ignore the mixer) ──

  /** Audition a voicing (coach "hear it") or play a Ghost Master phrase with dynamic velocity. */
  async playNotes(midis: number[], seconds = 1.6, delay = 0, vel = 0.6) {
    await this.init();
    this.engine?.playNotes(midis, seconds, delay, vel);
  }

  private auditionToken = 0;

  /**
   * Play voicings one after another (the Coach's "hear the move"). `onStep(i)` fires as
   * chord i is heard, in sync with the audio, and `onStep(null)` once the last one has rung.
   * Starting another audition (or `cancelAudition`) silences the old one's callbacks.
   */
  async playSequence(voicings: number[][], secondsEach = 1.2, onStep?: (i: number | null) => void) {
    await this.init();
    const token = ++this.auditionToken;
    const step = (i: number | null) => () => token === this.auditionToken && onStep?.(i);
    voicings.forEach((v, i) => {
      this.engine?.playNotes(v, secondsEach * 1.1, i * secondsEach);
      if (onStep) this.engine?.atAudioTime(step(i), i * secondsEach);
    });
    if (onStep) this.engine?.atAudioTime(step(null), voicings.length * secondsEach + 0.15);
  }

  private scoreTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Play a little score: each event's notes at its own offset (seconds from now) and length.
   * `onStep(i)` fires as `steps[i]` (an offset) is heard, `onStep(null)` once everything has
   * rung. Voicings' "Hear the head": the comping under the melody, in time.
   * Notes are handed to the engine a fraction of a second ahead, not all at once, so
   * `stopScore` can cut it off: a sampler can't take back an attack it has already been given.
   */
  async playScore(events: { midis: number[]; at: number; seconds: number; vel?: number }[], steps: number[] = [], onStep?: (i: number | null) => void): Promise<number | null> {
    await this.init();
    this.stopScore();
    const eng = this.engine;
    if (!eng) return null;
    const token = ++this.auditionToken;
    const step = (i: number | null) => () => token === this.auditionToken && onStep?.(i);
    const start = eng.clock() + 0.1;
    const delay = (at: number) => Math.max(0, start + at - eng.clock() - 0.03);
    const notes = [...events].sort((a, b) => a.at - b.at);
    const marks = steps.map((t, i) => ({ t, i })).sort((a, b) => a.t - b.t);
    const end = Math.max(0, ...events.map((e) => e.at + e.seconds));
    let ni = 0;
    let mi = 0;
    const pump = () => {
      const horizon = eng.clock() - start + LOOKAHEAD;
      while (ni < notes.length && notes[ni].at < horizon) {
        const e = notes[ni++];
        eng.playNotes(e.midis, e.seconds, delay(e.at), e.vel);
      }
      while (mi < marks.length && marks[mi].t < horizon) {
        const m = marks[mi++];
        if (onStep) eng.atAudioTime(step(m.i), delay(m.t));
      }
      if (ni >= notes.length && mi >= marks.length) {
        if (onStep) eng.atAudioTime(step(null), delay(end + 0.15));
        if (this.scoreTimer) clearInterval(this.scoreTimer);
        this.scoreTimer = null;
      }
    };
    pump();
    if (ni < notes.length || mi < marks.length) this.scoreTimer = setInterval(pump, 100);
    return token;
  }

  /** The audition in progress (bumped by every start and stop): `playScore`'s token is still current while this equals it. */
  currentAudition() {
    return this.auditionToken;
  }

  /** Stop a `playScore`: nothing more is scheduled, what's ringing is let go, and its steps stop reporting. */
  stopScore() {
    if (this.scoreTimer) clearInterval(this.scoreTimer);
    this.scoreTimer = null;
    const token = ++this.auditionToken;
    this.engine?.releaseAuditions();
    // an attack handed over just before the stop lands within the look-ahead: let that go too
    // (unless something new has started playing since)
    setTimeout(() => token === this.auditionToken && this.engine?.releaseAuditions(), LOOKAHEAD * 1000 + 50);
  }

  /** Stop reporting steps for the audition in progress (its notes still ring out). */
  cancelAudition() {
    this.auditionToken++;
  }

  /** Tracks the latest active noteOn token per MIDI pitch so a sync noteOff during async init cancels the pending attack. */
  private liveNotes = new Map<number, number>();
  private noteSeq = 0;

  /** On-screen, MIDI, and computer keys: sound while held. `velocity` is 0–1. */
  async noteOn(midi: number, velocity?: number) {
    const seq = ++this.noteSeq;
    this.liveNotes.set(midi, seq);
    if (!this.engine) {
      await this.init();
      if (this.liveNotes.get(midi) !== seq) return;
    }
    this.engine?.noteOn(midi, velocity);
  }

  /** Called on every user gesture: wakes the audio clock if the OS put it to sleep. A no-op before the engine loads. */
  resume() {
    this.engine?.resume();
  }

  noteOff(midi: number) {
    this.liveNotes.delete(midi);
    this.engine?.noteOff(midi);
  }

  /** Tear everything down (used when a dev hot reload replaces this module). */
  dispose() {
    this.disposed = true;
    if (this.scoreTimer) clearInterval(this.scoreTimer);
    this.engine?.dispose();
    this.engine = null;
    this.listeners.clear();
    this.mixListeners.clear();
    this.progressListeners.clear();
    this.countListeners.clear();
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
