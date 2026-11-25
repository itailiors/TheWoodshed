import {
  DEFAULT_SWING,
  absBeat,
  bandFeel,
  bassLine,
  clampSwing,
  drumPattern,
  formBars,
  isSwungFeel,
  midiOf,
  swingTime,
  voiceProgression,
  type ChordEvent,
  type DrumVoice,
  type TimePos,
  type Tune,
  type VoicingStyle,
} from "@reharm/theory-core";
import * as Tone from "tone";
import { getBandFeel, subscribeBandFeel, type BandTone } from "./bandFeel";
import { createToneChain, type ToneChain } from "./bandTone";
import {
  getBgPianoVolume,
  getPlayerPianoVolume,
  humanTime,
  humanVel,
  loadBass,
  loadDrums,
  subscribeChannelVolumes,
  type BandSource,
  type BassInstrument,
  type DrumKit,
  type Sticks,
} from "./band";
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

/** Straight eighth-note offbeat for bossa, ballad, and straight-8th feels. */
const STRAIGHT_OFFBEAT = 0.5;

interface NoteEvent {
  beat: number; // absolute beat from the top
  notes: number[]; // MIDI
  dur: number; // beats
  vel: number;
  /** The pianist's left-hand bass: dropped while the bass player is in. */
  lh?: boolean;
}

/**
 * Turn a chord list into a meter- and feel-aware piano comping part:
 * - 3/4 waltz: bass on 1 (and 5th on 3), RH on 1 and the swung "2&".
 * - 4/4 swing: Charleston ("1", swung "2&") + Red Garland / Sonny Clark "4&" anticipation,
 *   alternating on multi-bar chords with a syncopated "1&", "3", "4&" groove so beats 3–4 stay alive.
 * - 4/4 bossa / straight8: straight-eighth syncopated clave ("1", "2&", "3&", "4&") locking with the drums.
 * - 4/4 ballad: warm half-note pads on 1 and 3 with a gentle pickup on "4&".
 * `tune.feel` is the feel the band plays (the band style may override the chart's), and
 * `swing` is the swing ratio: swung offbeats sit at `beat + swing`, and the head melody,
 * written in straight eighths, is swung by the same ratio so it sits in the band's pocket.
 */
export function arrange(tune: Tune, chords: ChordEvent[], swing = DEFAULT_SWING, voicing: VoicingStyle = "close"): NoteEvent[] {
  const bpb = tune.meter[0];
  const swung = isSwungFeel(tune.feel);
  const SWING_OFFBEAT = clampSwing(swing);
  const offbeat = swung ? SWING_OFFBEAT : STRAIGHT_OFFBEAT;
  const voicings = voiceProgression(chords, { style: voicing });
  const events: NoteEvent[] = [];

  chords.forEach((c, i) => {
    const v = voicings[i];
    const start = absBeat(c.at, bpb);
    const L = c.beats;
    const fifth = v.bass + 7 <= 52 ? v.bass + 7 : v.bass - 5;
    // Quartal planing: on a chord held 4+ beats, every other hit moves the stack a scale step
    // and the next one comes home (So What / McCoy comping). Other styles always play `upper`.
    let hit = 0;
    const rh = () => (v.plane && L >= 4 && hit++ % 2 === 1 ? v.plane : v.upper);

    // Slice multi-bar chords into bar-sized segments so the groove continues across every bar.
    for (let off = 0, barIdx = 0; off < L; off += bpb, barIdx++) {
      const segStart = start + off;
      const segLen = Math.min(bpb, L - off);

      // Left-hand bass (muted automatically when the upright bassist is in the mix)
      if (segLen >= 3) {
        events.push({ beat: segStart, notes: [v.bass], dur: 1.9, vel: 0.62, lh: true });
        events.push({ beat: segStart + 2, notes: [fifth], dur: Math.min(1.9, (segLen - 2) * 0.95), vel: 0.5, lh: true });
      } else {
        events.push({ beat: segStart, notes: [v.bass], dur: segLen * 0.95, vel: 0.62, lh: true });
      }

      // Right-hand comping
      if (bpb === 3 || tune.feel === "waltz") {
        events.push({ beat: segStart, notes: rh(), dur: Math.min(0.9, segLen * 0.9), vel: 0.5 });
        if (segLen >= 2) events.push({ beat: segStart + 1 + offbeat, notes: rh(), dur: 0.3, vel: 0.36 });
      } else if (segLen < 2) {
        events.push({ beat: segStart, notes: rh(), dur: segLen * 0.85, vel: 0.5 });
      } else if (segLen < 3) {
        // 2-beat harmonic rhythm (e.g. two chords per 4/4 bar): Charleston stab on 1 and "&" of 2
        events.push({ beat: segStart, notes: rh(), dur: 0.85, vel: 0.5 });
        events.push({ beat: segStart + 1 + offbeat, notes: rh(), dur: 0.3, vel: 0.38 });
      } else if (tune.feel === "bossa" || tune.feel === "straight8") {
        // Straight-8th bossa / partido-alto comping locked to 0.5 subdivisions
        events.push({ beat: segStart, notes: rh(), dur: 0.9, vel: 0.48 });
        events.push({ beat: segStart + 1 + STRAIGHT_OFFBEAT, notes: rh(), dur: 0.75, vel: 0.42 });
        if (segLen >= 4) {
          events.push({ beat: segStart + 2 + STRAIGHT_OFFBEAT, notes: rh(), dur: 0.45, vel: 0.36 });
          events.push({ beat: segStart + 3 + STRAIGHT_OFFBEAT, notes: rh(), dur: 0.35, vel: 0.38 });
        }
      } else if (tune.feel === "ballad") {
        // Ballad: warm half-note pads on 1 and 3
        events.push({ beat: segStart, notes: rh(), dur: 1.8, vel: 0.46 });
        events.push({ beat: segStart + 2, notes: rh(), dur: Math.min(1.8, (segLen - 2) * 0.9), vel: 0.4 });
        if (segLen >= 4) events.push({ beat: segStart + 3 + STRAIGHT_OFFBEAT, notes: rh(), dur: 0.4, vel: 0.32 });
      } else {
        // 4/4 swing: Charleston (1, 2&) + Red Garland / Sonny Clark 4& anticipation;
        // on continuation bars of a held chord, vary with 1&, 3, 4& so comping breathes.
        if (barIdx % 2 === 0) {
          events.push({ beat: segStart, notes: rh(), dur: 0.85, vel: 0.5 });
          events.push({ beat: segStart + 1 + SWING_OFFBEAT, notes: rh(), dur: 0.45, vel: 0.42 });
          if (segLen >= 4) {
            events.push({ beat: segStart + 3 + SWING_OFFBEAT, notes: rh(), dur: 0.32, vel: 0.38 });
          }
        } else {
          events.push({ beat: segStart + SWING_OFFBEAT, notes: rh(), dur: 0.42, vel: 0.4 });
          events.push({ beat: segStart + 2, notes: rh(), dur: 0.8, vel: 0.45 });
          if (segLen >= 4) {
            events.push({ beat: segStart + 3 + SWING_OFFBEAT, notes: rh(), dur: 0.32, vel: 0.38 });
          }
        }
      }
    }
  });
  for (const n of tune.melody) {
    const start = absBeat(n.at, bpb);
    const [from, to] = swung ? [swingTime(start, swing), swingTime(start + n.beats, swing)] : [start, start + n.beats];
    events.push({ beat: from, notes: [midiOf(n.pitch)], dur: (to - from) * 0.95, vel: 0.78 });
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
  /** Backing band piano (comping + head melody). */
  private instrument: Tone.Sampler | Tone.PolySynth | null = null;
  /** Player + Ghost Master + Coach audition piano, routed to its own volume bus. */
  private playerInstrument: Tone.Sampler | Tone.PolySynth | null = null;
  private bgPianoBus: Tone.Volume | null = null;
  private playerPianoBus: Tone.Volume | null = null;
  private unsubVolumes: (() => void) | null = null;
  private bass: BassInstrument | null = null;
  private drums: DrumKit | null = null;
  private part: Tone.Part<Timed<NoteEvent>> | null = null;
  private bassPart: Tone.Part<Timed<BassEvent>> | null = null;
  private drumPart: Tone.Part<Timed<DrumEvent>> | null = null;
  private clickPart: Tone.Part<Timed<ClickEvent>> | null = null;
  private countIn: CountIn | null = null;
  private clockId: number | null = null;
  private bpb = 3;
  /** The last arrangement, re-laid when the swing or band style changes. */
  private arrangement: Arrangement | null = null;
  private unsubFeel: () => void;
  /** The band's tone stage and the bus nodes it sits in (reverbs, glue), freed on dispose. */
  private toneChain: ToneChain | null = null;
  private toneNodes: Tone.ToneAudioNode[] = [];
  private tone: BandTone = getBandFeel().tone;
  source: InstrumentSource | null = null;
  bandSource: { bass: BandSource; drums: BandSource } | null = null;

  constructor(private host: EngineHost) {
    // Parts live on the Transport, so rebuilding them mid-tune lands on the very next event.
    this.unsubFeel = subscribeBandFeel(() => {
      const { tone } = getBandFeel();
      if (tone !== this.tone) {
        // A tone change is a mix change: no need to re-lay the parts.
        this.tone = tone;
        this.toneChain?.apply(tone);
        return;
      }
      if (this.arrangement) this.update(this.arrangement, Tone.getTransport().bpm.value);
    });
  }

  /**
   * Builds the instruments. Asks the browser to start audio, but never waits for it:
   * without a user gesture (Practice Mode connecting MIDI on a page refresh, a MIDI note
   * arriving before any click) Chrome leaves that promise pending forever, which used to
   * hang loading for good. A suspended context still loads samples; the next tap, key
   * press or Play wakes it (see resume()).
   */
  async init(unlock = true): Promise<InstrumentSource> {
    if (unlock) void Tone.start().catch(() => {});
    // The band (comping piano, bass, drums) runs through its tone stage and one glue compressor;
    // the player's own piano has its own reverb and skips both, so the tone never touches your playing.
    const makeup = new Tone.Volume(0).toDestination();
    const glue = new Tone.Compressor({ threshold: 0, ratio: 1, attack: 0.015, release: 0.2, knee: 6 }).connect(makeup);
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).connect(glue);
    const playerReverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).toDestination();
    // Bass and drums sit drier than the piano; a little room keeps them in the same club.
    const room = new Tone.Reverb({ decay: 1.2, wet: 0.08 }).connect(glue);
    await Promise.all([reverb.ready, playerReverb.ready, room.ready]);
    this.toneChain?.dispose();
    const chain = createToneChain(reverb, room, glue, makeup);
    this.toneChain = chain;
    chain.apply(getBandFeel().tone);
    this.toneNodes = [makeup, glue, reverb, playerReverb, room];

    // Dedicated volume buses for Background Piano vs. Player/Ghost Master Piano
    this.bgPianoBus = new Tone.Volume(getBgPianoVolume()).connect(chain.piano);
    this.playerPianoBus = new Tone.Volume(getPlayerPianoVolume()).connect(playerReverb);
    this.unsubVolumes?.();
    this.unsubVolumes = subscribeChannelVolumes(() => {
      if (this.bgPianoBus) this.bgPianoBus.volume.value = getBgPianoVolume();
      if (this.playerPianoBus) this.playerPianoBus.volume.value = getPlayerPianoVolume();
    });

    // All three load in parallel and report in as each one lands, sampled or synth.
    const { progress } = this.host;
    (["piano", "bass", "drums"] as const).forEach((i) => progress(i, "loading"));
    // The metronome bypasses the reverbs: a click should be a precise tick, not a sound.
    const dry = new Tone.Gain(1).toDestination();
    const bass = loadBass(chain.bass).then((b) => {
      this.bass = b;
      progress("bass", b.source === "sampled" ? "ready" : "fallback");
      return b;
    });
    const drums = loadDrums(chain.drums, dry).then((d) => {
      this.drums = d;
      progress("drums", d.source === "sampled" ? "ready" : "fallback");
      return d;
    });
    try {
      const s = await new Promise<Tone.Sampler>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("sample load timed out")), LOAD_TIMEOUT_MS);
        const sampler = new Tone.Sampler({
          urls: Object.fromEntries(SAMPLED.map((n) => [n, `${n.replace("#", "s")}.mp3`])),
          baseUrl: SALAMANDER_URL,
          release: 1.2,
          onload: () => {
            clearTimeout(timer);
            trimOnsets(sampler);
            resolve(sampler);
          },
          onerror: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      });
      this.instrument = s;
      this.playerInstrument = cloneSamplerFromBuffers(s);
      this.source = "salamander";
    } catch (err) {
      console.warn("[audio] Salamander samples unavailable, using synth fallback:", err);
      this.instrument = makeFallbackPianoSynth();
      this.playerInstrument = makeFallbackPianoSynth();
      this.source = "synth";
    }
    this.instrument.volume.value = -8;
    this.instrument.connect(this.bgPianoBus);
    this.playerInstrument.volume.value = -8;
    this.playerInstrument.connect(this.playerPianoBus);
    progress("piano", this.source === "salamander" ? "ready" : "fallback");
    const [b, d] = await Promise.all([bass, drums]);
    this.bandSource = { bass: b.source, drums: d.source };
    return this.source;
  }

  /** Swap in a new arrangement (safe while playing). */
  update(arrangement: Arrangement, tempo: number) {
    const { tune: chart, chords, loop } = arrangement;
    this.arrangement = arrangement;
    // The band plays the chosen style over the chart: same changes and melody, its own feel.
    const { swing, style, voicing } = getBandFeel();
    const band = bandFeel(chart, style);
    const tune: Tune = { ...chart, feel: band.feel };
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
    const events = arrange(tune, chords, swing, voicing).map((e) => ({ ...e, time: ticks(e.beat) }));
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
    const bassEvents = bassLine(tune, looped.length ? looped : chords, band.bass).map((n) => ({ midi: n.midi, dur: n.dur, vel: n.vel, time: ticks(n.beat) }));
    this.bassPart?.dispose();
    this.bassPart = new Tone.Part<Timed<BassEvent>>((time, n) => {
      if (!this.bass || !mix().bass) return;
      this.bass.play(n.midi, secs(n.dur), humanTime(time), humanVel(n.vel, 0.06));
    }, bassEvents).start(0);

    const hits = drumPattern(tune.feel, this.bpb, formBars(tune), tune.id, swing).map((h) => ({ voice: h.voice, dur: h.dur, vel: h.vel, time: ticks(h.beat) }));
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
    this.resume(); // Play is a user gesture: wake a context that loaded without one
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
    this.playerInstrument?.releaseAll();
    this.bass?.release();
    this.drums?.release();
    this.host.position(null);
  }

  /** Remove everything this engine put on the shared Transport and audio graph. */
  dispose() {
    this.stop();
    this.unsubFeel();
    this.arrangement = null;
    this.unsubVolumes?.();
    this.unsubVolumes = null;
    if (this.clockId !== null) Tone.getTransport().clear(this.clockId);
    this.clockId = null;
    for (const p of [this.part, this.bassPart, this.drumPart, this.clickPart]) p?.dispose();
    this.part = this.bassPart = this.drumPart = this.clickPart = null;
    this.instrument?.dispose();
    this.playerInstrument?.dispose();
    this.bgPianoBus?.dispose();
    this.playerPianoBus?.dispose();
    this.bass?.dispose();
    this.drums?.dispose();
    this.instrument = this.playerInstrument = null;
    this.bgPianoBus = this.playerPianoBus = null;
    this.bass = this.drums = null;
    this.toneChain?.dispose();
    this.toneChain = null;
    this.toneNodes.forEach((n) => n.dispose());
    this.toneNodes = [];
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

  // Direct auditions, Ghost Master piano replies, and live keys route through
  // `playerInstrument` -> `playerPianoBus` so the Player/Master Piano volume slider
  // controls them independently of the backing band's comping piano.

  playNotes(midis: number[], seconds: number, delay: number, vel = 0.6) {
    const freqs = midis.map((m) => Tone.Frequency(m, "midi").toFrequency());
    const target = this.playerInstrument ?? this.instrument;
    target?.triggerAttackRelease(freqs, seconds, Tone.now() + 0.03 + delay, vel);
  }

  /**
   * Run `cb` on screen at the moment a `playNotes(…, delay)` call made now is heard: same
   * offset, scheduled on the audio clock via Tone.Draw (the next animation frame at or after
   * that time), so pictures and sound stay together however busy the page is.
   */
  atAudioTime(cb: () => void, delay: number) {
    Tone.getDraw().schedule(cb, Tone.now() + 0.03 + delay);
  }

  /** The clock `playNotes` and `atAudioTime` delays count from (less their 30 ms). */
  clock(): number {
    return Tone.now();
  }

  /** Let go of every audition note that's sounding (a stopped "Hear the head"). */
  releaseAuditions() {
    (this.playerInstrument ?? this.instrument)?.releaseAll();
  }

  // Live notes use Tone.immediate() (the raw audio clock), not Tone.now(): now() adds the
  // context's lookAhead (0.1 s), which is right for the scheduled band and far too late for a
  // key you just pressed. Per-pitch timestamps stay strictly monotonic so re-striking a
  // sustained note (noteOff + noteOn in the same tick) never schedules its release after the new attack.
  private noteTime = new Map<number, number>();

  noteOn(midi: number, velocity = 0.6) {
    const prev = this.noteTime.get(midi) ?? 0;
    const at = Math.max(Tone.immediate(), prev + 0.001);
    this.noteTime.set(midi, at);
    const target = this.playerInstrument ?? this.instrument;
    target?.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), at, velocity);
  }

  noteOff(midi: number) {
    const prev = this.noteTime.get(midi) ?? 0;
    const at = Math.max(Tone.immediate(), prev + 0.005);
    this.noteTime.set(midi, at);
    const target = this.playerInstrument ?? this.instrument;
    target?.triggerRelease(Tone.Frequency(midi, "midi").toFrequency(), at);
  }

  /** Wake a context the OS suspended (iOS after a call or an app switch; tabs left in the background). */
  resume() {
    const ctx = Tone.getContext().rawContext as AudioContext;
    if (ctx.state !== "running" && ctx.state !== "closed") void ctx.resume().catch(() => {});
  }

  /** Report the context's state now and on every change ("running", "suspended", iOS's "interrupted", "closed"). */
  onAudioState(fn: (state: string) => void): () => void {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const report = () => fn(ctx.state);
    ctx.addEventListener("statechange", report);
    report();
    return () => ctx.removeEventListener("statechange", report);
  }
}

function makeFallbackPianoSynth(): Tone.PolySynth {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.004, decay: 0.6, sustain: 0.18, release: 1.1 },
  });
  synth.maxPolyphony = 48;
  return synth;
}

/**
 * Build a second `Tone.Sampler` sharing the already-decoded, onset-trimmed `ToneAudioBuffer`
 * objects from the primary Salamander sampler, avoiding any duplicate network fetches while
 * giving the Player/Master piano its own independent `Tone.Volume` bus.
 */
function cloneSamplerFromBuffers(source: Tone.Sampler): Tone.Sampler | Tone.PolySynth {
  try {
    const map = (source as unknown as { _buffers?: { _buffers?: Map<string | number, Tone.ToneAudioBuffer> } })._buffers?._buffers;
    if (map && map.size > 0) {
      const urls: Record<string, Tone.ToneAudioBuffer> = {};
      for (const [key, buf] of map) {
        const noteName = typeof key === "number" || /^\d+$/.test(String(key))
          ? Tone.Frequency(Number(key), "midi").toNote()
          : String(key);
        urls[noteName] = buf;
      }
      return new Tone.Sampler({ urls, release: 1.2 });
    }
  } catch (err) {
    console.warn("[audio] couldn't clone Salamander buffers, falling back to PolySynth for player channel", err);
  }
  return makeFallbackPianoSynth();
}

/**
 * The Salamander MP3s start with 4–16 ms of near-silence (encoder padding plus the hammer's
 * approach), so every note, live or scheduled, sounded that much late. Cut each sample to just
 * before its onset. Reaches into Tone's private buffer map; if that ever changes, the samples
 * are simply left as they are.
 */
function trimOnsets(sampler: Tone.Sampler) {
  const PRE_ROLL = 0.001; // keep 1 ms before the onset so the attack transient survives
  const THRESHOLD = 0.003; // about −50 dBFS
  try {
    const map = (sampler as unknown as { _buffers?: { _buffers?: Map<string | number, Tone.ToneAudioBuffer> } })._buffers?._buffers;
    if (!map) return;
    for (const [key, buf] of map) {
      const data = buf.getChannelData(0);
      let i = 0;
      while (i < data.length && Math.abs(data[i]) < THRESHOLD) i++;
      const start = Math.max(0, i / buf.sampleRate - PRE_ROLL);
      if (start > 0.002 && i < data.length) map.set(key, buf.slice(start));
    }
  } catch (err) {
    console.warn("[audio] couldn't trim sample onsets; playing them untrimmed", err);
  }
}
