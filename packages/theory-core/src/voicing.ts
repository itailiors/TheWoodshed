import { chordTones, guideTones, isDominant } from "./chords";
import { chroma, mod } from "./pitch";
import type { ChordEvent } from "./types";

export interface Voicing {
  /** Left-hand bass note (MIDI). */
  bass: number;
  /** Right-hand notes, ascending (MIDI). */
  upper: number[];
}

type ChordLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "bass" | "display">;

const BASS_LOW = 38; // D2
const UPPER_LOW = 52; // E3: lowest note of the right-hand voicing
const UPPER_CENTER = 63; // around Eb4: the comping sweet spot

/** Colour tones a pianist adds to an unadorned chord symbol. */
const DEFAULT_COLOR: Partial<Record<ChordEvent["quality"], string[]>> = {
  maj7: ["9"],
  "6": ["9"],
  m7: ["9"],
  m6: ["9"],
  mMaj7: ["9"],
  "7": ["9", "13"],
  "7sus4": ["9"],
};

/**
 * Which pitch classes go in the right hand: guide tones first, then
 * alterations, extensions, default colour, the 5th and finally the root.
 */
export function upperPitchClasses(chord: ChordLike, max = 4): string[] {
  const tones = chordTones(chord);
  const byDeg = new Map(tones.map((t) => [t.degree, t.note]));
  const picked: string[] = [];
  const add = (note?: string) => {
    if (note && !picked.some((p) => chroma(p) === chroma(note)) && picked.length < max) picked.push(note);
  };
  guideTones(chord).forEach((g) => add(g.note));
  chord.alterations.forEach((a) => add(byDeg.get(a)));
  chord.extensions.forEach((e) => add(byDeg.get(e)));
  if (!chord.alterations.length && !chord.extensions.length) {
    const color = DEFAULT_COLOR[chord.quality] ?? [];
    const colorTones = chordTones({ ...chord, extensions: color });
    color.forEach((c) => add(colorTones.find((t) => t.degree === c)?.note));
  }
  ["5", "b5", "#5", "1"].forEach((d) => add(byDeg.get(d)));
  // dominant 13(#11) clusters keep all five colours
  if (isDominant(chord.quality) && chord.alterations.length + chord.extensions.length >= 3 && max < 5) {
    return upperPitchClasses(chord, 5);
  }
  return picked;
}

/** Every close-position inversion of the pitch classes, starting at or above UPPER_LOW. */
function inversions(unsorted: number[]): number[][] {
  const pcs = [...unsorted].sort((a, b) => a - b);
  const out: number[][] = [];
  for (let r = 0; r < pcs.length; r++) {
    const order = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (const startOct of [0, 12]) {
      let prev = UPPER_LOW - 1 + startOct;
      const v = order.map((pc) => {
        let n = prev + 1 + mod(pc - (prev + 1), 12);
        prev = n;
        return n;
      });
      out.push(v);
    }
  }
  return out;
}

const movement = (a: number[], b: number[]) =>
  b.reduce((s, n) => s + Math.min(...a.map((m) => Math.abs(m - n))), 0) + a.reduce((s, n) => s + Math.min(...b.map((m) => Math.abs(m - n))), 0);

/**
 * Voice a chord for two-handed comping. With a previous voicing, picks the
 * inversion with the least total voice movement, so the engine's
 * half-step voice leading is what you hear.
 */
export function voiceChord(chord: ChordLike, prev?: Voicing): Voicing {
  const bassPc = chroma(chord.bass ?? chord.root);
  const bass = BASS_LOW + mod(bassPc - BASS_LOW, 12);
  const pcs = upperPitchClasses(chord).map((n) => chroma(n));
  const options = inversions(pcs).filter((v) => v[v.length - 1] <= 81);
  const score = (v: number[]) => {
    const center = v.reduce((s, n) => s + n, 0) / v.length;
    const drift = Math.abs(center - UPPER_CENTER) * 0.6;
    return (prev ? movement(prev.upper, v) : 0) + drift;
  };
  const upper = options.reduce((best, v) => (score(v) < score(best) ? v : best), options[0]);
  return { bass, upper };
}

/** Voice a whole progression with continuous voice leading. */
export function voiceProgression(chords: ChordLike[]): Voicing[] {
  const out: Voicing[] = [];
  for (const c of chords) out.push(voiceChord(c, out[out.length - 1]));
  return out;
}

export const midiToPc = (m: number) => mod(m, 12);
