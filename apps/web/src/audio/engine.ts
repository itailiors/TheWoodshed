import { absBeat, bassLine, drumPattern, formBars, midiOf, voiceProgression, type ChordEvent, type DrumVoice, type TimePos, type Tune } from "@reharm/theory-core";
import * as Tone from "tone";
import { humanTime, humanVel, loadBass, loadDrums, type BandSource, type BassInstrument, type DrumKit, type Sticks } from "./band";
import type { Arrangement, CountState, Instrument, InstrumentSource, LoadPart, LoadState, Mix } from "./player";

/*
 * Everything that touches Tone.js lives in this module, so it ships as its own chunk:
 * the page paints without ~250 kB of audio code, and `player.ts` pulls this in on the
 * first Play (or earlier, when the browser is idle).
 */

/** Salamander Grand Piano samples (CC-BY 3.0, Alexander Holm), hosted by the Tone.js project. */
const SALAMANDER_URL = "https://tonejs.github.io/audio/salamander/";
const SAMPLED = ["A1", "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3", "A3", "C4", "D#4", "F#4", "A4", "C5", "D#5", "F#5", "A5", "C6"];
const LOAD_TIMEOUT_MS = 12000;

/** Jazz-waltz comping: where the "2&" lands. 2/3 of a beat = a swung eighth. */
const SWING_OFFBEAT = 2 / 3;

interface NoteEvent {
  beat: number; // absolute beat from the top
  notes: number[]; // MIDI
  dur: number; // beats
  vel: number;
  /** The pianist's left-hand bass: dropped while the bass player is in. */
  lh?: boolean;
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
    events.push({ beat: absBeat(n.at, bpb), notes: [midiOf(n.pitch)], dur: n.beats * 0.95, vel: 0.78 });
  }
  return events;
}

type Timed<T> = T & { time: string };
type BassEvent = { midi: number; dur: number; vel: number };
type DrumEvent = { voice: DrumVoice; dur: number; vel: number };
type ClickEvent = { accent: boolean };

/** A count-in in flight: its own output (so it can be cut instantly) and when the band starts. */
interface CountIn {
  bus: Tone.Gain;
  sticks: Sticks;
  until: number;
}

/** What the engine needs from the player facade that owns it. */
export interface EngineHost {
  /** The current mix, read at every event so a mute lands on the next note. */
  mix(): Mix;
  position(pos: TimePos | null): void;
  progress(part: LoadPart, state: LoadState): void;
  /** The count-in beat now sounding, or null when the count-in ends or is cancelled. */
  count(state: CountState | null): void;
}

/**
 * The trio on Tone's Transport. Each Part is rebuilt whenever the chords change; since they
 * live on the Transport timeline, a swap mid-bar takes effect on the very next event.
 * That is the A/B "ghost" switch.
 */
export class AudioEngine {
  private instrument: Tone.Sampler | Tone.PolySynth | null = null;
  private bass: BassInstrument | null = null;
  private drums: DrumKit | null = null;
  private part: Tone.Part<Timed<NoteEvent>> | null = null;
  private bassPart: Tone.Part<Timed<BassEvent>> | null = null;
  private drumPart: Tone.Part<Timed<DrumEvent>> | null = null;
  private clickPart: Tone.Part<Timed<ClickEvent>> | null = null;
  private countIn: CountIn | null = null;
  private clockId: number | null = null;
  private bpb = 3;
  source: InstrumentSource | null = null;
  bandSource: { bass: BandSource; drums: BandSource } | null = null;

  constructor(private host: EngineHost) {}

  /** Must run inside a user gesture's activation window (browser autoplay rules). */
  async init(): Promise<InstrumentSource> {
    await Tone.start();
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).toDestination();
    // Bass and drums sit drier than the piano; a little room keeps them in the same club.
    const room = new Tone.Reverb({ decay: 1.2, wet: 0.08 }).toDestination();
    await Promise.all([reverb.ready, room.ready]);

    // All three load in parallel and report in as each one lands, sampled or synth.
    const { progress } = this.host;
    (["piano", "bass", "drums"] as const).forEach((i) => progress(i, "loading"));
    // The metronome bypasses the reverbs: a click should be a precise tick, not a sound.
    const dry = new Tone.Gain(1).toDestination();
    const bass = loadBass(room).then((b) => {
      this.bass = b;
      progress("bass", b.source === "sampled" ? "ready" : "fallback");
      return b;
    });
    const drums = loadDrums(room, dry).then((d) => {
      this.drums = d;
      progress("drums", d.source === "sampled" ? "ready" : "fallback");
      return d;
    });
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
    progress("piano", this.source === "salamander" ? "ready" : "fallback");
    const [b, d] = await Promise.all([bass, drums]);
    this.bandSource = { bass: b.source, drums: d.source };
    return this.source;
  }

  /** Swap in a new arrangement (safe while playing). */
  update({ tune, chords, loop }: Arrangement, tempo: number) {
    const t = Tone.getTransport();
    const mix = () => this.host.mix();
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
      if (!inst || !mix().piano) return;
      if (e.lh && mix().bass) return; // the bass player has the low end, so comp rootless
      const notes = e.notes.map((m) => Tone.Frequency(m, "midi").toFrequency());
      inst.triggerAttackRelease(notes, secs(e.dur), time, e.vel);
    }, events).start(0);

    // Bass and drums: the notes and dynamics come from theory-core (seeded per tune, so a
    // line repeats as written). The human part is added here, fresh on every pass of the
    // loop: each strike is pushed or dragged by up to ±15 ms and its velocity varied a little.
    // The bass walks only the looped chords, so its last lead-in aims at the note the loop
    // actually returns to (not at the bar after the loop, possibly an octave away).
    const [loopFrom, loopTo] = [(loop.startBar - 1) * this.bpb, loop.endBar * this.bpb];
    const looped = chords.filter((c) => {
      const at = absBeat(c.at, this.bpb);
      return at >= loopFrom && at < loopTo;
    });
    const bassEvents = bassLine(tune, looped.length ? looped : chords).map((n) => ({ midi: n.midi, dur: n.dur, vel: n.vel, time: ticks(n.beat) }));
    this.bassPart?.dispose();
    this.bassPart = new Tone.Part<Timed<BassEvent>>((time, n) => {
      if (!this.bass || !mix().bass) return;
      this.bass.play(n.midi, secs(n.dur), humanTime(time), humanVel(n.vel, 0.06));
    }, bassEvents).start(0);

    const hits = drumPattern(tune.feel, this.bpb, formBars(tune), tune.id).map((h) => ({ voice: h.voice, dur: h.dur, vel: h.vel, time: ticks(h.beat) }));
    this.drumPart?.dispose();
    this.drumPart = new Tone.Part<Timed<DrumEvent>>((time, h) => {
      if (!this.drums || !mix().drums) return;
      // The brush sweep is a texture, not a strike: it stays on the grid.
      const at = h.voice === "brush" ? time : humanTime(time);
      this.drums.hit(h.voice, at, humanVel(h.vel), secs(h.dur));
    }, hits).start(0);

    // Click: every beat, the downbeat accented. Dead on the grid, unlike the band.
    const clicks = Array.from({ length: formBars(tune) * this.bpb }, (_, b) => ({ accent: b % this.bpb === 0, time: ticks(b) }));
    this.clickPart?.dispose();
    this.clickPart = new Tone.Part<Timed<ClickEvent>>((time, c) => {
      if (!this.drums || !mix().click) return;
      this.drums.click(time, c.accent, c.accent ? 1 : 0.7);
    }, clicks).start(0);

    // A new loop that no longer contains the playhead (e.g. "practice this move" while the
    // tune plays on): jump into it now rather than playing on until the old position wraps.
    if (t.state === "started") {
      const [from, to] = [(loop.startBar - 1) * this.bpb * ppq, loop.endBar * this.bpb * ppq];
      if (t.ticks < from || t.ticks >= to) t.ticks = from;
    }
  }

  /** Cut what is ringing on one instrument, so a mute is immediate, not after the release tail. */
  silence(inst: Instrument) {
    if (inst === "click") return; // a click is a few ms long; nothing rings
    const now = Tone.now();
    if (inst === "piano") this.instrument?.releaseAll(now);
    if (inst === "bass") this.bass?.release(now);
    if (inst === "drums") this.drums?.release(now);
  }

  setTempo(bpm: number) {
    Tone.getTransport().bpm.rampTo(bpm, 0.2);
  }

  /**
   * Start from the top of the loop, after `countInBars` bars of side-stick count-in.
   * The count-in is scheduled on the audio clock (the Transport isn't running yet) and the
   * Transport is set to start exactly where it ends, so the band lands on the next beat.
   * Stopping during the count-in cancels both: Clock.stop() drops the pending start.
   */
  play(countInBars = 0) {
    const t = Tone.getTransport();
    if (this.clockId === null) {
      this.clockId = t.scheduleRepeat((time) => {
        const tick = t.getTicksAtTime(time);
        const beat = Math.floor(tick / t.PPQ + 1e-6);
        const pos = { bar: Math.floor(beat / this.bpb) + 1, beat: (beat % this.bpb) + 1 };
        Tone.getDraw().schedule(() => this.host.position(pos), time);
      }, "4n");
    }
    this.cancelCountIn();
    t.position = t.loopStart;
    const now = Tone.now() + 0.06;
    if (countInBars <= 0 || !this.drums) {
      t.start(now);
      return;
    }
    const spb = 60 / t.bpm.value;
    const beats = countInBars * this.bpb;
    const bus = new Tone.Gain(1).toDestination();
    const sticks = this.drums.sticks(bus);
    const draw = Tone.getDraw();
    for (let i = 0; i < beats; i++) {
      const time = now + i * spb;
      const beat = (i % this.bpb) + 1;
      sticks.hit(time, beat === 1 ? 0.95 : 0.7);
      const state = { beat, bar: Math.floor(i / this.bpb) + 1, bars: countInBars, beatsPerBar: this.bpb };
      draw.schedule(() => this.host.count(state), time);
    }
    const until = now + beats * spb;
    draw.schedule(() => this.host.count(null), until);
    this.countIn = { bus, sticks, until };
    t.start(until);
  }

  /** Silence and forget a count-in (no-op if none). */
  private cancelCountIn() {
    const c = this.countIn;
    if (!c) return;
    this.countIn = null;
    c.bus.gain.setValueAtTime(0, Tone.now());
    // Give already-started clicks a moment to be muted, then free the nodes.
    setTimeout(() => {
      c.sticks.dispose();
      c.bus.dispose();
    }, 200);
    if (Tone.now() < c.until) {
      Tone.getDraw().cancel(Tone.now());
      this.host.count(null);
    }
  }

  private get counting() {
    return this.countIn !== null && Tone.now() < this.countIn.until;
  }

  stop() {
    this.cancelCountIn();
    Tone.getTransport().stop();
    this.instrument?.releaseAll();
    this.bass?.release();
    this.drums?.release();
    this.host.position(null);
  }

  /** Remove everything this engine put on the shared Transport and audio graph. */
  dispose() {
    this.stop();
    if (this.clockId !== null) Tone.getTransport().clear(this.clockId);
    this.clockId = null;
    for (const p of [this.part, this.bassPart, this.drumPart, this.clickPart]) p?.dispose();
    this.part = this.bassPart = this.drumPart = this.clickPart = null;
    this.instrument?.dispose();
    this.bass?.dispose();
    this.drums?.dispose();
    this.instrument = this.bass = this.drums = null;
  }

  /** Playing, or counting in (so Space during the count-in stops rather than restarts). */
  get playing() {
    return Tone.getTransport().state === "started" || this.counting;
  }

  /** Fractional absolute beat of the transport (loop-aware), or null when stopped. */
  currentBeat(): number | null {
    const t = Tone.getTransport();
    return t.state === "started" ? t.ticks / t.PPQ : null;
  }

  // Direct auditions ignore the mixer: muting the band's piano never silences the
  // coach's "hear it" or the on-screen keys.

  playNotes(midis: number[], seconds: number, delay: number) {
    const freqs = midis.map((m) => Tone.Frequency(m, "midi").toFrequency());
    this.instrument?.triggerAttackRelease(freqs, seconds, Tone.now() + 0.03 + delay, 0.6);
  }

  /**
   * Run `cb` on screen at the moment a `playNotes(…, delay)` call made now is heard: same
   * offset, scheduled on the audio clock via Tone.Draw (the next animation frame at or after
   * that time), so pictures and sound stay together however busy the page is.
   */
  atAudioTime(cb: () => void, delay: number) {
    Tone.getDraw().schedule(cb, Tone.now() + 0.03 + delay);
  }

  noteOn(midi: number) {
    this.instrument?.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), Tone.now() + 0.01, 0.6);
  }

  noteOff(midi: number) {
    this.instrument?.triggerRelease(Tone.Frequency(midi, "midi").toFrequency(), Tone.now() + 0.05);
  }
}
