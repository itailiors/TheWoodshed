import {
  absBeat,
  bassLine,
  drumPattern,
  formBars,
  midiOf as pitchToMidi,
  voiceProgression,
  type ChordEvent,
  type DrumVoice,
  type TimePos,
  type Tune,
} from "@reharm/theory-core";
import * as Tone from "tone";

/** Salamander Grand Piano samples (CC-BY 3.0, Alexander Holm), hosted by the Tone.js project. */
const SALAMANDER_URL = "https://tonejs.github.io/audio/salamander/";
const SAMPLED = ["A1", "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3", "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5", "A5", "C6"];
const LOAD_TIMEOUT_MS = 12000;

/** Jazz-waltz comping: where the "2&" lands. 2/3 of a beat = a swung eighth. */
const SWING_OFFBEAT = 2 / 3;

export type InstrumentSource = "salamander" | "synth";

interface NoteEvent {
  beat: number; // absolute beat from the top
  notes: number[]; // MIDI
  dur: number; // beats
  vel: number;
  /** The pianist's left-hand bass: dropped while the bass player is in. */
  lh?: boolean;
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

export interface Arrangement {
  tune: Tune;
  chords: ChordEvent[];
  /** Inclusive bar range to loop. */
  loop: { startBar: number; endBar: number };
}

/** Turn a chord list into a waltz comping part: bass on 1 (and the 5th on 3), RH on 1 and the swung "2&". */
export function arrange(tune: Tune, chords: ChordEvent[]): NoteEvent[] {
  const bpb = tune.meter[0];
  const voicings = voiceProgression(chords);
  const events: NoteEvent[] = [];
  chords.forEach((c, i) => {
    const v = voicings[i];
    const start = absBeat(c.at, bpb);
    const L = c.beats;
    if (L >= 3) {
      events.push({ beat: start, notes: [v.bass], dur: 1.9, vel: 0.62, lh: true });
      const fifth = v.bass + 7 <= 52 ? v.bass + 7 : v.bass - 5;
      events.push({ beat: start + 2, notes: [fifth], dur: 0.95, vel: 0.5, lh: true });
    } else {
      events.push({ beat: start, notes: [v.bass], dur: L * 0.95, vel: 0.62, lh: true });
    }
    events.push({ beat: start, notes: v.upper, dur: Math.min(0.9, L * 0.9), vel: 0.5 });
    if (L >= 2) events.push({ beat: start + 1 + SWING_OFFBEAT, notes: v.upper, dur: 0.3, vel: 0.36 });
  });
  for (const n of tune.melody) {
    events.push({ beat: absBeat(n.at, bpb), notes: [pitchToMidi(n.pitch)], dur: n.beats * 0.95, vel: 0.78 });
  }
  return events;
}

// ── band instruments (synthesized: nothing to download) ─────────────────

type Listener = (pos: TimePos | null) => void;
type Timed<T> = T & { time: string };
type BassEvent = { midi: number; dur: number; vel: number };
type DrumEvent = { voice: DrumVoice; dur: number; vel: number };

interface Drums {
  ride: Tone.MetalSynth;
  hat: Tone.NoiseSynth;
  brush: Tone.NoiseSynth;
  kick: Tone.MembraneSynth;
}

/** A plucky, woody upright: a filtered triangle with a fast filter envelope. */
function makeBass(out: Tone.ToneAudioNode): Tone.MonoSynth {
  const bass = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.006, decay: 0.4, sustain: 0.32, release: 0.18 },
    filter: { type: "lowpass", rolloff: -24, Q: 1.2 },
    filterEnvelope: { attack: 0.002, decay: 0.16, sustain: 0.25, release: 0.2, baseFrequency: 160, octaves: 2.8 },
  });
  bass.volume.value = -5;
  bass.connect(out);
  return bass;
}

/** A brush kit from synths: metallic ride, noise hi-hat, pink-noise brush, feathered kick. */
function makeDrums(out: Tone.ToneAudioNode): Drums {
  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.1, release: 0.4 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 5200,
    octaves: 1.3,
  });
  ride.volume.value = -27;
  ride.chain(new Tone.Filter(2800, "highpass"), out);

  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } });
  hat.volume.value = -21;
  hat.chain(new Tone.Filter(7500, "highpass"), out);

  // A long, soft pink-noise swell on every beat: the brush circling on the snare head.
  const brush = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.09, decay: 0.2, sustain: 0.45, release: 0.18 } });
  brush.volume.value = -31;
  brush.chain(new Tone.Filter({ type: "bandpass", frequency: 2600, Q: 0.6 }), out);

  const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.1 } });
  kick.volume.value = -16;
  kick.connect(out);
  return { ride, hat, brush, kick };
}

/**
 * One shared player. Each Part is rebuilt whenever the chords change; since they live on
 * the Transport timeline, a swap mid-bar takes effect on the very next event.
 * That is the A/B "ghost" switch. The mix is read at every event, so muting is instant too.
 */
class TrioPlayer {
  private instrument: Tone.Sampler | Tone.PolySynth | null = null;
  private bass: Tone.MonoSynth | null = null;
  private drums: Drums | null = null;
  private part: Tone.Part<Timed<NoteEvent>> | null = null;
  private bassPart: Tone.Part<Timed<BassEvent>> | null = null;
  private drumPart: Tone.Part<Timed<DrumEvent>> | null = null;
  private clockId: number | null = null;
  private loading: Promise<InstrumentSource> | null = null;
  private listeners = new Set<Listener>();
  private mixListeners = new Set<() => void>();
  private bpb = 3;
  source: InstrumentSource | null = null;
  /** Who is playing. Replaced (not mutated) on change, so React can compare snapshots. */
  mix: Mix = loadMix();

  /** Must be called from a user gesture (browser autoplay rules). */
  init(): Promise<InstrumentSource> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await Tone.start();
      const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).toDestination();
      // Bass and drums sit drier than the piano; a little room keeps them in the same club.
      const room = new Tone.Reverb({ decay: 1.2, wet: 0.08 }).toDestination();
      await Promise.all([reverb.ready, room.ready]);
      this.bass = makeBass(room);
      this.drums = makeDrums(room);
      try {
        this.instrument = await new Promise<Tone.Sampler>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("sample load timed out")), LOAD_TIMEOUT_MS);
          const s = new Tone.Sampler({
            urls: Object.fromEntries(SAMPLED.map((n) => [n, `${n.replace("#", "s")}.mp3`])),
            baseUrl: SALAMANDER_URL,
            release: 1.2,
            onload: () => {
              clearTimeout(timer);
              resolve(s);
            },
            onerror: (e) => {
              clearTimeout(timer);
              reject(e);
            },
          });
        });
        this.source = "salamander";
      } catch (err) {
        console.warn("[audio] Salamander samples unavailable, using synth fallback:", err);
        this.instrument = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle8" },
          envelope: { attack: 0.004, decay: 0.6, sustain: 0.18, release: 1.1 },
        });
        this.instrument.maxPolyphony = 48;
        this.source = "synth";
      }
      this.instrument.volume.value = -8;
      this.instrument.connect(reverb);
      return this.source!;
    })();
    return this.loading;
  }

  onPosition(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Swap in a new arrangement (safe while playing). */
  update({ tune, chords, loop }: Arrangement, tempo: number) {
    const t = Tone.getTransport();
    this.bpb = tune.meter[0];
    t.timeSignature = this.bpb;
    t.bpm.value = tempo;
    const ppq = t.PPQ;
    const ticks = (beats: number) => `${Math.round(beats * ppq)}i`;
    const secs = (beats: number) => Tone.Ticks(Math.round(beats * ppq)).toSeconds();
    t.loop = true;
    t.loopStart = ticks((loop.startBar - 1) * this.bpb);
    t.loopEnd = ticks(loop.endBar * this.bpb);

    // Piano: comping + melody.
    const events = arrange(tune, chords).map((e) => ({ ...e, time: ticks(e.beat) }));
    this.part?.dispose();
    this.part = new Tone.Part<Timed<NoteEvent>>((time, e) => {
      const inst = this.instrument;
      if (!inst || !this.mix.piano) return;
      if (e.lh && this.mix.bass) return; // the bass player has the low end, so comp rootless
      const notes = e.notes.map((m) => Tone.Frequency(m, "midi").toFrequency());
      inst.triggerAttackRelease(notes, secs(e.dur), time, e.vel);
    }, events).start(0);

    // Bass: walking or two-feel, from theory-core.
    const bassEvents = bassLine(tune, chords).map((n) => ({ midi: n.midi, dur: n.dur, vel: n.vel, time: ticks(n.beat) }));
    this.bassPart?.dispose();
    this.bassPart = new Tone.Part<Timed<BassEvent>>((time, n) => {
      if (!this.bass || !this.mix.bass) return;
      this.bass.triggerAttackRelease(Tone.Frequency(n.midi, "midi").toFrequency(), secs(n.dur), time, n.vel);
    }, bassEvents).start(0);

    // Drums: ride, hi-hat, brush and feathered kick for the whole form.
    const hits = drumPattern(tune.feel, this.bpb, formBars(tune)).map((h) => ({ voice: h.voice, dur: h.dur, vel: h.vel, time: ticks(h.beat) }));
    this.drumPart?.dispose();
    this.drumPart = new Tone.Part<Timed<DrumEvent>>((time, h) => {
      const d = this.drums;
      if (!d || !this.mix.drums) return;
      if (h.voice === "ride") d.ride.triggerAttackRelease(320, secs(h.dur), time, h.vel);
      else if (h.voice === "kick") d.kick.triggerAttackRelease("C1", secs(h.dur), time, h.vel);
      else d[h.voice].triggerAttackRelease(secs(h.dur), time, h.vel);
    }, hits).start(0);
  }

  // ── trio mixer ──

  setMix(inst: Instrument, on: boolean) {
    this.mix = { ...this.mix, [inst]: on };
    try {
      localStorage.setItem(MIX_KEY, JSON.stringify(this.mix));
    } catch {
      /* private mode: the mix just won't be remembered */
    }
    if (!on) {
      // Cut what is ringing so the mute is immediate, not after the release tail.
      const now = Tone.now();
      if (inst === "piano") this.instrument?.releaseAll(now);
      if (inst === "bass") this.bass?.triggerRelease(now);
      if (inst === "drums") this.drums?.brush.triggerRelease(now);
    }
    this.mixListeners.forEach((l) => l());
  }

  onMix(fn: () => void) {
    this.mixListeners.add(fn);
    return () => {
      this.mixListeners.delete(fn);
    };
  }

  setTempo(bpm: number) {
    Tone.getTransport().bpm.rampTo(bpm, 0.2);
  }

  async play() {
    await this.init();
    const t = Tone.getTransport();
    if (this.clockId === null) {
      this.clockId = t.scheduleRepeat((time) => {
        const tick = t.getTicksAtTime(time);
        const beat = Math.floor(tick / t.PPQ + 1e-6);
        const pos = { bar: Math.floor(beat / this.bpb) + 1, beat: (beat % this.bpb) + 1 };
        Tone.getDraw().schedule(() => this.listeners.forEach((l) => l(pos)), time);
      }, "4n");
    }
    t.position = t.loopStart;
    t.start("+0.05");
  }

  stop() {
    const t = Tone.getTransport();
    t.stop();
    this.instrument?.releaseAll();
    this.bass?.triggerRelease();
    this.drums?.brush.triggerRelease();
    this.listeners.forEach((l) => l(null));
  }

  /** Remove everything this player put on the shared Transport and audio graph. */
  dispose() {
    this.stop();
    const t = Tone.getTransport();
    if (this.clockId !== null) t.clear(this.clockId);
    this.clockId = null;
    for (const p of [this.part, this.bassPart, this.drumPart]) p?.dispose();
    this.part = this.bassPart = this.drumPart = null;
    for (const node of [this.instrument, this.bass, ...Object.values(this.drums ?? {})]) node?.dispose();
    this.instrument = this.bass = this.drums = null;
    this.listeners.clear();
    this.mixListeners.clear();
  }

  get playing() {
    return Tone.getTransport().state === "started";
  }

  /** Fractional absolute beat of the transport (loop-aware), or null when stopped. */
  currentBeat(): number | null {
    const t = Tone.getTransport();
    return t.state === "started" ? t.ticks / t.PPQ : null;
  }

  // Direct auditions below ignore the mixer: muting the band's piano never silences
  // the coach's "hear it" or the on-screen keys.

  /** Audition a voicing (coach "hear it"). */
  async playNotes(midis: number[], seconds = 1.6, delay = 0) {
    await this.init();
    const freqs = midis.map((m) => Tone.Frequency(m, "midi").toFrequency());
    this.instrument?.triggerAttackRelease(freqs, seconds, Tone.now() + 0.03 + delay, 0.6);
  }

  async playSequence(voicings: number[][], secondsEach = 1.2) {
    await this.init();
    voicings.forEach((v, i) => this.playNotes(v, secondsEach * 1.1, i * secondsEach));
  }

  /** On-screen keys: sound while held. */
  async noteOn(midi: number) {
    await this.init();
    this.instrument?.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), Tone.now() + 0.01, 0.6);
  }

  noteOff(midi: number) {
    this.instrument?.triggerRelease(Tone.Frequency(midi, "midi").toFrequency(), Tone.now() + 0.05);
  }
}

// When Vite hot-swaps this module in dev, the old player's Parts would stay scheduled on
// Tone's global Transport and keep playing with no way to mute them. (Vite runs `dispose`
// only on the accepting boundary, a component, not on this module.) So each new copy
// tears down the previous one itself.
const g = globalThis as { __reharmPlayer?: { dispose?: () => void } };
g.__reharmPlayer?.dispose?.();
export const player = new TrioPlayer();
g.__reharmPlayer = player;
