import * as Tone from "tone";
import type { BandTone } from "./bandFeel";

/*
 * The band's tone stage: per-instrument low shelf, one peak, high shelf, low-pass and trim, then
 * one glue compressor on the band bus. "clean" is the original sound: every gain at 0 dB (plain
 * biquads are exactly unity there; Tone's EQ3 isn't, its crossovers lose ~1.3 dB), the low-pass
 * at 20 kHz and the compressor at 1:1. "warm" is tuned against a dark, compressed small-group
 * backing track at 210 BPM: spectral centroid near 330 Hz, the 120–500 Hz body on top, the
 * 8–16 kHz octave 25–30 dB under it. The GM drum samples are the main gap (their centroid alone
 * is ~8 kHz). Only the backing band goes through here; the player's own piano does not.
 */

interface Stage {
  lowShelf: { freq: number; gain: number };
  peak: { freq: number; gain: number; q: number };
  highShelf: { freq: number; gain: number };
  /** Low-pass corner in Hz (20 kHz is effectively off). */
  lowpass: number;
  /** Level trim in dB. */
  trim: number;
}

interface ToneSettings {
  piano: Stage;
  bass: Stage;
  drums: Stage;
  /** Glue compressor on the band bus; ratio 1 is a bypass. `makeup` keeps the A/B level-matched. */
  glue: { threshold: number; ratio: number; makeup: number };
  /** Wet level of the bass/drums room. */
  room: number;
}

const FLAT: Stage = {
  lowShelf: { freq: 200, gain: 0 },
  peak: { freq: 1000, gain: 0, q: 1 },
  highShelf: { freq: 4000, gain: 0 },
  lowpass: 20000,
  trim: 0,
};

export const TONES: Record<BandTone, ToneSettings> = {
  clean: {
    piano: FLAT,
    bass: FLAT,
    drums: FLAT,
    glue: { threshold: 0, ratio: 1, makeup: 0 },
    room: 0.08,
  },
  warm: {
    // Body up and the hammer's top taken off: a darker piano behind the head.
    piano: { lowShelf: { freq: 350, gain: 2 }, peak: { freq: 1000, gain: 0, q: 1 }, highShelf: { freq: 3500, gain: -3 }, lowpass: 6500, trim: 0 },
    // A round upright: less boom under 100 Hz, the 180 Hz body (where the pitch reads) pushed, string click rolled off.
    bass: { lowShelf: { freq: 100, gain: -1 }, peak: { freq: 180, gain: 4, q: 0.9 }, highShelf: { freq: 1000, gain: -6 }, lowpass: 2800, trim: 1 },
    // A dark ride and a felt kick, under the band rather than on top of it.
    drums: { lowShelf: { freq: 200, gain: 1 }, peak: { freq: 3000, gain: 0, q: 1 }, highShelf: { freq: 6000, gain: -13 }, lowpass: 10000, trim: -4 },
    // WebAudio's compressor adds its own make-up gain (~5 dB at these settings); `makeup` takes it
    // back so Warm and Clean play at the same loudness and the A/B is fair.
    glue: { threshold: -20, ratio: 2, makeup: -4 },
    room: 0.12,
  },
};

export interface ToneChain {
  /** Inputs for each backing instrument. */
  piano: Tone.ToneAudioNode;
  bass: Tone.ToneAudioNode;
  drums: Tone.ToneAudioNode;
  apply(tone: BandTone): void;
  dispose(): void;
}

class StageNode {
  readonly lowShelf = new Tone.Filter({ type: "lowshelf", frequency: 200, gain: 0 });
  readonly peak = new Tone.Filter({ type: "peaking", frequency: 1000, gain: 0, Q: 1 });
  readonly highShelf = new Tone.Filter({ type: "highshelf", frequency: 4000, gain: 0 });
  readonly lp = new Tone.Filter({ type: "lowpass", frequency: 20000, rolloff: -12, Q: 0.707 }); // Butterworth: flat below the corner
  readonly trim = new Tone.Volume(0);
  constructor(out: Tone.ToneAudioNode) {
    this.lowShelf.chain(this.peak, this.highShelf, this.lp, this.trim, out);
  }
  // Linear ramps throughout: Tone ramps dB params exponentially, which can't reach or leave 0 dB.
  set(s: Stage, at: number) {
    const ramp = (p: { linearRampTo(value: number, rampTime: number, startTime?: number): unknown }, v: number) => p.linearRampTo(v, 0.08, at);
    ramp(this.lowShelf.frequency, s.lowShelf.freq);
    ramp(this.lowShelf.gain, s.lowShelf.gain);
    ramp(this.peak.frequency, s.peak.freq);
    ramp(this.peak.gain, s.peak.gain);
    ramp(this.peak.Q, s.peak.q);
    ramp(this.highShelf.frequency, s.highShelf.freq);
    ramp(this.highShelf.gain, s.highShelf.gain);
    ramp(this.lp.frequency, s.lowpass);
    ramp(this.trim.volume, s.trim);
  }
  dispose() {
    [this.lowShelf, this.peak, this.highShelf, this.lp, this.trim].forEach((n) => n.dispose());
  }
}

/**
 * @param pianoOut  where the comping piano goes after its stage (its reverb)
 * @param room      where bass and drums go after their stages; its wet level is set per tone
 * @param glue      the band-bus compressor both reverbs feed, followed by its `makeup` gain
 */
export function createToneChain(pianoOut: Tone.ToneAudioNode, room: Tone.Reverb, glue: Tone.Compressor, makeup: Tone.Volume): ToneChain {
  const piano = new StageNode(pianoOut);
  const bass = new StageNode(room);
  const drums = new StageNode(room);
  return {
    piano: piano.lowShelf,
    bass: bass.lowShelf,
    drums: drums.lowShelf,
    apply(tone) {
      const t = TONES[tone];
      const at = Tone.now();
      piano.set(t.piano, at);
      bass.set(t.bass, at);
      drums.set(t.drums, at);
      // Set, not ramped: Tone can't ramp a threshold that sits at 0 dB (the top of its range).
      glue.threshold.setValueAtTime(t.glue.threshold, at);
      glue.ratio.setValueAtTime(t.glue.ratio, at);
      makeup.volume.linearRampTo(t.glue.makeup, 0.08, at);
      room.wet.linearRampTo(t.room, 0.08, at);
    },
    dispose() {
      piano.dispose();
      bass.dispose();
      drums.dispose();
    },
  };
}
