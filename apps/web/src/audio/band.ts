import type { DrumVoice } from "@reharm/theory-core";
import * as Tone from "tone";

/*
 * The backing band's instruments: sampled when the CDNs answer, synthesized when they
 * don't, so Play always works. Every source below is CORS-open and was checked by hand.
 */

export type BandSource = "sampled" | "synth";
export type GhostInstrument = "sax" | "piano";
const hz = (midi: number) => Tone.Frequency(midi, "midi").toFrequency();

// ── master & per-instrument channel volumes ─────────────────────────────

const MASTER_VOL_KEY = "reharm.masterVolume";
const CHANNEL_VOL_KEY = "reharm.channelVolumes";
const masterVolSubs = new Set<() => void>();
const channelVolSubs = new Set<() => void>();

export type ChannelId = "playerPiano" | "bgPiano" | "bass" | "drums";
export type ChannelVolumes = Readonly<Record<ChannelId, number>>;

const clampDb = (db: number) => (Number.isFinite(db) ? Math.max(-24, Math.min(12, Math.round(db * 2) / 2)) : 0);

let masterVolumeDb = (() => {
  try {
    const raw = localStorage.getItem(MASTER_VOL_KEY);
    return raw !== null ? clampDb(Number(raw)) : 0;
  } catch {
    return 0;
  }
})();

let channelVolumes: ChannelVolumes = (() => {
  const defaults: ChannelVolumes = { playerPiano: 0, bgPiano: 0, bass: 0, drums: 0 };
  try {
    const raw = localStorage.getItem(CHANNEL_VOL_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ChannelId, number>>;
    return {
      playerPiano: clampDb(parsed.playerPiano ?? 0),
      bgPiano: clampDb(parsed.bgPiano ?? 0),
      bass: clampDb(parsed.bass ?? 0),
      drums: clampDb(parsed.drums ?? 0),
    };
  } catch {
    return defaults;
  }
})();

export function getMasterVolume(): number {
  return masterVolumeDb;
}

export function setMasterVolume(db: number): void {
  masterVolumeDb = clampDb(db);
  try {
    localStorage.setItem(MASTER_VOL_KEY, String(masterVolumeDb));
  } catch {
    /* private mode */
  }
  try {
    Tone.getDestination().volume.value = masterVolumeDb;
  } catch {
    /* audio context not yet created */
  }
  masterVolSubs.forEach((fn) => fn());
}

export function subscribeMasterVolume(fn: () => void): () => void {
  masterVolSubs.add(fn);
  return () => void masterVolSubs.delete(fn);
}

export function getChannelVolumes(): ChannelVolumes {
  return channelVolumes;
}

export function setChannelVolume(channel: ChannelId, db: number): void {
  const next = clampDb(db);
  if (channelVolumes[channel] === next) return;
  channelVolumes = { ...channelVolumes, [channel]: next };
  try {
    localStorage.setItem(CHANNEL_VOL_KEY, JSON.stringify(channelVolumes));
  } catch {
    /* private mode */
  }
  if (channel === "playerPiano" && saxVol) {
    saxVol.volume.value = next;
  }
  channelVolSubs.forEach((fn) => fn());
}

export function resetChannelVolumes(): void {
  channelVolumes = { playerPiano: 0, bgPiano: 0, bass: 0, drums: 0 };
  try {
    localStorage.setItem(CHANNEL_VOL_KEY, JSON.stringify(channelVolumes));
  } catch {
    /* private mode */
  }
  if (saxVol) saxVol.volume.value = 0;
  channelVolSubs.forEach((fn) => fn());
}

export function subscribeChannelVolumes(fn: () => void): () => void {
  channelVolSubs.add(fn);
  return () => void channelVolSubs.delete(fn);
}

export const getPlayerPianoVolume = () => channelVolumes.playerPiano;
export const setPlayerPianoVolume = (db: number) => setChannelVolume("playerPiano", db);

export const getBgPianoVolume = () => channelVolumes.bgPiano;
export const setBgPianoVolume = (db: number) => setChannelVolume("bgPiano", db);

export const getPianoVolume = () => channelVolumes.bgPiano;
export const setPianoVolume = (db: number) => setChannelVolume("bgPiano", db);

export const getBassVolume = () => channelVolumes.bass;
export const setBassVolume = (db: number) => setChannelVolume("bass", db);

export const getDrumsVolume = () => channelVolumes.drums;
export const setDrumsVolume = (db: number) => setChannelVolume("drums", db);

// ── upright bass ────────────────────────────────────────────────────────

/**
 * General MIDI "acoustic_bass" rendered to MP3 by gleitz/midi-js-soundfonts, in three
 * soundfonts, tried in order. Samples every minor third, so nothing is repitched by more
 * than a semitone and a half (more stretch and an upright starts to sound like a cello).
 */
export const BASS_SOUNDFONTS = ["MusyngKite", "FluidR3_GM", "FatBoy"].map(
  (font) => `https://gleitz.github.io/midi-js-soundfonts/${font}/acoustic_bass-mp3/`,
);
const BASS_NOTES = ["E1", "G1", "Bb1", "Db2", "E2", "G2", "Bb2", "Db3", "E3", "G3"];
const SAMPLE_TIMEOUT_MS = 9000;

function loadSampler(options: Partial<Tone.SamplerOptions>): Promise<Tone.Sampler> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timed out after ${SAMPLE_TIMEOUT_MS} ms`));
    }, SAMPLE_TIMEOUT_MS);
    const s = new Tone.Sampler({
      ...options,
      onload: () => {
        clearTimeout(timer);
        resolve(s);
      },
      onerror: (e) => {
        clearTimeout(timer);
        s.dispose();
        reject(e);
      },
    });
  });
}

export interface BassInstrument {
  source: BandSource;
  play(midi: number, seconds: number, time: number, vel: number): void;
  release(time?: number): void;
  dispose(): void;
}

export async function loadBass(out: Tone.ToneAudioNode): Promise<BassInstrument> {
  try {
    Tone.getDestination().volume.value = masterVolumeDb;
  } catch {
    /* ignore */
  }
  const bassBus = new Tone.Volume(channelVolumes.bass).connect(out);
  const unsub = subscribeChannelVolumes(() => {
    bassBus.volume.value = channelVolumes.bass;
  });
  for (const baseUrl of BASS_SOUNDFONTS) {
    try {
      const s = await loadSampler({
        urls: Object.fromEntries(BASS_NOTES.map((n) => [n, `${n}.mp3`])),
        baseUrl,
        release: 0.12, // a walking line is legato, but the string still stops when the finger lifts
      });
      s.volume.value = -2;
      s.connect(bassBus);
      return {
        source: "sampled",
        play: (midi, seconds, time, vel) => s.triggerAttackRelease(hz(midi), seconds, time, vel),
        release: (time) => s.releaseAll(time),
        dispose: () => {
          unsub();
          s.dispose();
          bassBus.dispose();
        },
      };
    } catch (err) {
      console.warn(`[audio] bass samples unavailable at ${baseUrl}:`, err);
    }
  }
  console.warn("[audio] all bass soundfonts failed, using the synth bass");
  const synth = synthBass(bassBus);
  return {
    source: "synth",
    play: (midi, seconds, time, vel) => synth.triggerAttackRelease(hz(midi), seconds, time, vel),
    release: (time) => synth.triggerRelease(time),
    dispose: () => {
      unsub();
      synth.dispose();
      bassBus.dispose();
    },
  };
}

/** Fallback: a plucky filtered triangle. */
function synthBass(out: Tone.ToneAudioNode): Tone.MonoSynth {
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

// ── drum kit ────────────────────────────────────────────────────────────

/** General MIDI drum notes for the pieces we use. */
export const GM = { kick: 36, snare: 38, hatClosed: 42, hatPedal: 44, ride: 51 } as const;
/**
 * Extra GM notes that aren't part of the groove: the side stick (rim click) a drummer counts
 * in with, and the high/low woodblocks of a classic metronome. GM kits have no dedicated
 * "sticks" or "metronome" notes (those are GS extensions), so these stand in for them.
 */
export const GM_CUE = { sideStick: 37, woodHigh: 76, woodLow: 77 } as const;

/**
 * GM drum kits from WebAudioFont (surikov/webaudiofontdata): one small .js file per drum
 * note, wrapping a base64 MP3. Tried in order: FluidR3, JCLive, Sound Blaster Live.
 * The files are fetched as text and only the base64 sample is decoded; nothing is executed.
 */
export const DRUM_KITS = ["0_FluidR3_GM_sf2_file", "0_JCLive_sf2_file", "0_SBLive_sf2"];
const DRUM_URL = (note: number, kit: string) => `https://surikov.github.io/webaudiofontdata/sound/128${note}_${kit}.js`;

/**
 * Per-voice levels into the kit's one sampler (GM rides and kicks are mixed hot).
 * These, and the volumes in `makeBrush` and `loadBass`, are the knobs to balance the trio.
 */
const DRUM_LEVEL: Record<Exclude<DrumVoice, "brush">, number> = { ride: 0.5, hat: 0.75, snare: 0.6, kick: 0.7 };
/** The metronome's level (it bypasses the kit's sampler, so it has its own knob). */
const CLICK_LEVEL = 0.55;

async function fetchDrumSample(note: number, kit: string): Promise<Tone.ToneAudioBuffer> {
  const res = await fetch(DRUM_URL(note, kit), { signal: AbortSignal.timeout(SAMPLE_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for drum ${note} (${kit})`);
  const m = /file\s*:\s*'([A-Za-z0-9+/=]+)'/.exec(await res.text());
  if (!m) throw new Error(`no sample data in drum ${note} (${kit})`);
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  return new Tone.ToneAudioBuffer(await Tone.getContext().decodeAudioData(bytes.buffer));
}

/** A set of count-in sticks wired to its own output, so a cancelled count-in can be silenced at once. */
export interface Sticks {
  hit(time: number, vel: number): void;
  dispose(): void;
}

export interface DrumKit {
  source: BandSource;
  hit(voice: DrumVoice, time: number, vel: number, seconds: number): void;
  /** The metronome: a high woodblock on the downbeat, a low one on the other beats. */
  click(time: number, accent: boolean, vel: number): void;
  /** Count-in sticks (side stick), routed to `dest`. */
  sticks(dest: Tone.ToneAudioNode): Sticks;
  release(time?: number): void;
  dispose(): void;
}

/** Play a sample once into `dest`, and free its node when it ends. */
function oneShot(buffer: Tone.ToneAudioBuffer, dest: Tone.ToneAudioNode, time: number, gain: number) {
  const src = new Tone.ToneBufferSource(buffer).connect(dest);
  src.onended = () => src.dispose();
  src.start(time, 0, undefined, Math.min(1, gain));
}

/**
 * @param out   where the kit plays (the band's room)
 * @param dry   where the metronome click plays: straight to the speakers, no reverb, so it
 *              stays a precise tick rather than part of the band's sound
 */
export async function loadDrums(out: Tone.ToneAudioNode, dry: Tone.ToneAudioNode): Promise<DrumKit> {
  const drumsBus = new Tone.Volume(channelVolumes.drums).connect(out);
  const unsub = subscribeChannelVolumes(() => {
    drumsBus.volume.value = channelVolumes.drums;
  });
  // GM kits have no brush swirl, so the sweep stays a quiet filtered-noise texture.
  const brush = makeBrush(drumsBus);
  const notes = Object.values(GM);
  const cues = Object.values(GM_CUE);
  for (const kit of DRUM_KITS) {
    try {
      const [buffers, cueBuffers] = await Promise.all([
        Promise.all(notes.map((n) => fetchDrumSample(n, kit))),
        Promise.all(cues.map((n) => fetchDrumSample(n, kit))),
      ]);
      const cue = Object.fromEntries(cues.map((n, i) => [n, cueBuffers[i]])) as Record<number, Tone.ToneAudioBuffer>;
      const sampler = new Tone.Sampler({ urls: Object.fromEntries(notes.map((n, i) => [n, buffers[i]])) });
      sampler.volume.value = -6;
      sampler.connect(drumsBus);
      const strike = (note: number, time: number, vel: number) => sampler.triggerAttack(hz(note), time, Math.min(1, vel));
      return {
        source: "sampled",
        hit(voice, time, vel, seconds) {
          if (voice === "brush") return void brush.triggerAttackRelease(seconds, time, vel);
          const v = vel * DRUM_LEVEL[voice];
          if (voice === "hat") {
            // The foot chick: pedal hat, with a little closed hat on top for the crisp edge.
            strike(GM.hatPedal, time, v);
            strike(GM.hatClosed, time, v * 0.35);
          } else strike(GM[voice], time, v);
        },
        click: (time, accent, vel) => oneShot(cue[accent ? GM_CUE.woodHigh : GM_CUE.woodLow], dry, time, vel * CLICK_LEVEL),
        sticks: (dest) => ({
          hit: (time, vel) => oneShot(cue[GM_CUE.sideStick], dest, time, vel),
          dispose: () => {},
        }),
        release: (time) => {
          brush.triggerRelease(time);
          sampler.releaseAll(time);
        },
        dispose: () => {
          unsub();
          brush.dispose();
          sampler.dispose();
          drumsBus.dispose();
        },
      };
    } catch (err) {
      console.warn(`[audio] drum kit ${kit} unavailable:`, err);
    }
  }
  console.warn("[audio] all drum kits failed, using the synth kit");
  const fallback = synthKit(drumsBus, dry, brush);
  const origDispose = fallback.dispose;
  fallback.dispose = () => {
    unsub();
    origDispose();
    drumsBus.dispose();
  };
  return fallback;
}

function makeBrush(out: Tone.ToneAudioNode): Tone.NoiseSynth {
  const brush = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.09, decay: 0.2, sustain: 0.45, release: 0.18 } });
  brush.volume.value = -34;
  brush.chain(new Tone.Filter({ type: "bandpass", frequency: 2600, Q: 0.6 }), out);
  return brush;
}

/** Fallback kit from synths: metallic ride, noise hat and snare, membrane kick. */
function synthKit(out: Tone.ToneAudioNode, dry: Tone.ToneAudioNode, brush: Tone.NoiseSynth): DrumKit {
  // A short square-wave blip, pitched up on the downbeat: the classic electronic metronome.
  const blip = () => new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 } });
  const clicker = blip().connect(dry);
  clicker.volume.value = -14;
  const ride = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 1.1, release: 0.4 }, harmonicity: 5.1, modulationIndex: 24, resonance: 5200, octaves: 1.3 });
  ride.volume.value = -27;
  ride.chain(new Tone.Filter(2800, "highpass"), out);
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.045, sustain: 0 } });
  hat.volume.value = -21;
  hat.chain(new Tone.Filter(7500, "highpass"), out);
  const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } });
  snare.volume.value = -24;
  snare.chain(new Tone.Filter({ type: "bandpass", frequency: 1800, Q: 0.8 }), out);
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 3, envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.1 } });
  kick.volume.value = -16;
  kick.connect(out);
  return {
    source: "synth",
    hit(voice, time, vel, seconds) {
      if (voice === "ride") ride.triggerAttackRelease(320, seconds, time, vel);
      else if (voice === "kick") kick.triggerAttackRelease("C1", seconds, time, vel);
      else if (voice === "brush") brush.triggerAttackRelease(seconds, time, vel);
      else if (voice === "hat") hat.triggerAttackRelease(seconds, time, vel);
      else snare.triggerAttackRelease(seconds, time, vel);
    },
    click: (time, accent, vel) => clicker.triggerAttackRelease(accent ? 1760 : 1320, 0.03, time, vel),
    sticks: (dest) => {
      const s = blip().connect(dest);
      s.volume.value = -12;
      return { hit: (time, vel) => s.triggerAttackRelease(2400, 0.02, time, vel), dispose: () => s.dispose() };
    },
    release: (time) => brush.triggerRelease(time),
    dispose: () => [ride, hat, snare, kick, brush, clicker].forEach((n) => n.dispose()),
  };
}

// ── humanizing ──────────────────────────────────────────────────────────

/** Maximum push or drag on a strike, in seconds. */
export const SLOP = 0.015;

/**
 * Nudge a strike off the grid by up to ±SLOP. The sum of two uniforms gives a triangular
 * spread: most hits land within a few ms, a few lean further, none past the limit. Never
 * earlier than the audio clock can still schedule.
 */
export function humanTime(time: number): number {
  const offset = (Math.random() + Math.random() - 1) * SLOP;
  return Math.max(Tone.getContext().currentTime + 0.002, time + offset);
}

/** Vary a velocity by up to ±spread (relative), so no two quarter notes are identical. */
export function humanVel(vel: number, spread = 0.08): number {
  return Math.min(1, Math.max(0.02, vel * (1 + (Math.random() * 2 - 1) * spread)));
}

// ── Ghost Master Saxophone (MonoSynth with reedy filter envelope, vibrato & portamento) ──

let saxSynth: Tone.MonoSynth | null = null;
let saxVib: Tone.Vibrato | null = null;
let saxVol: Tone.Volume | null = null;
let saxLastTime = 0;

function ensureGhostSax(): Tone.MonoSynth {
  if (saxSynth) return saxSynth;
  saxVol = new Tone.Volume(channelVolumes.playerPiano).toDestination();
  saxVib = new Tone.Vibrato({ frequency: 5.2, depth: 0.14 }).connect(saxVol);
  saxSynth = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    portamento: 0.028,
    envelope: {
      attack: 0.022,
      decay: 0.16,
      sustain: 0.8,
      release: 0.18,
    },
    filter: {
      type: "lowpass",
      rolloff: -24,
      Q: 2.4,
    },
    filterEnvelope: {
      attack: 0.028,
      decay: 0.22,
      sustain: 0.42,
      release: 0.18,
      baseFrequency: 360,
      octaves: 2.7,
    },
  }).connect(saxVib);
  saxSynth.volume.value = -5;
  return saxSynth;
}

/**
 * Lightweight, expressive jazz saxophone synth for Trading 2s / 4s with the Ghost Master.
 * Uses a reedy sawtooth MonoSynth with a breathy filter envelope, legato portamento, and vibrato.
 */
export const ghostSax = {
  play(midiOrVoicing: number | number[], durSeconds: number, delaySeconds = 0, vel = 0.72) {
    const midi = Array.isArray(midiOrVoicing) ? midiOrVoicing[midiOrVoicing.length - 1] : midiOrVoicing;
    if (midi === undefined) return;
    const synth = ensureGhostSax();
    const at = Math.max(Tone.now() + 0.02 + delaySeconds, saxLastTime + 0.005);
    saxLastTime = at;
    synth.triggerAttackRelease(hz(midi), Math.max(0.08, durSeconds), at, humanVel(vel, 0.06));
  },
  release() {
    saxSynth?.triggerRelease(Tone.now());
  },
};
