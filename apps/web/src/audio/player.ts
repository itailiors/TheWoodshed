import { absBeat, midiOf as pitchToMidi, voiceProgression, type ChordEvent, type TimePos, type Tune } from "@reharm/theory-core";
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
      events.push({ beat: start, notes: [v.bass], dur: 1.9, vel: 0.62 });
      const fifth = v.bass + 7 <= 52 ? v.bass + 7 : v.bass - 5;
      events.push({ beat: start + 2, notes: [fifth], dur: 0.95, vel: 0.5 });
    } else {
      events.push({ beat: start, notes: [v.bass], dur: L * 0.95, vel: 0.62 });
    }
    events.push({ beat: start, notes: v.upper, dur: Math.min(0.9, L * 0.9), vel: 0.5 });
    if (L >= 2) events.push({ beat: start + 1 + SWING_OFFBEAT, notes: v.upper, dur: 0.3, vel: 0.36 });
  });
  for (const n of tune.melody) {
    events.push({ beat: absBeat(n.at, bpb), notes: [pitchToMidi(n.pitch)], dur: n.beats * 0.95, vel: 0.78 });
  }
  return events;
}

type Listener = (pos: TimePos | null) => void;

/**
 * One shared player. The Part is rebuilt whenever the chords change; since it lives on
 * the Transport timeline, a swap mid-bar takes effect on the very next event.
 * That is the A/B "ghost" switch.
 */
class WaltzPlayer {
  private instrument: Tone.Sampler | Tone.PolySynth | null = null;
  private part: Tone.Part<NoteEvent & { time: string }> | null = null;
  private clockId: number | null = null;
  private loading: Promise<InstrumentSource> | null = null;
  private listeners = new Set<Listener>();
  private bpb = 3;
  source: InstrumentSource | null = null;

  /** Must be called from a user gesture (browser autoplay rules). */
  init(): Promise<InstrumentSource> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      await Tone.start();
      const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).toDestination();
      await reverb.ready;
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
    t.loop = true;
    t.loopStart = ticks((loop.startBar - 1) * this.bpb);
    t.loopEnd = ticks(loop.endBar * this.bpb);

    const events = arrange(tune, chords).map((e) => ({ ...e, time: ticks(e.beat) }));
    this.part?.dispose();
    this.part = new Tone.Part<NoteEvent & { time: string }>((time, e) => {
      const inst = this.instrument;
      if (!inst) return;
      const notes = e.notes.map((m) => Tone.Frequency(m, "midi").toFrequency());
      inst.triggerAttackRelease(notes, Tone.Ticks(Math.round(e.dur * ppq)).toSeconds(), time, e.vel);
    }, events).start(0);
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
    this.listeners.forEach((l) => l(null));
  }

  get playing() {
    return Tone.getTransport().state === "started";
  }

  /** Fractional absolute beat of the transport (loop-aware), or null when stopped. */
  currentBeat(): number | null {
    const t = Tone.getTransport();
    return t.state === "started" ? t.ticks / t.PPQ : null;
  }

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

export const player = new WaltzPlayer();
