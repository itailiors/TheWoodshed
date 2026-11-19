import { chordTones, guideTones, isDominant } from "./chords";
import { chroma, midiOf, mod } from "./pitch";
import type { ChordEvent } from "./types";

export interface Voicing {
  /** Left-hand bass note (MIDI). */
  bass: number;
  /** Right-hand notes, ascending (MIDI). */
  upper: number[];
}

type ChordLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "bass" | "display" | "topVoice">;

const BASS_LOW = 38; // D2
const UPPER_LOW = 52; // E3: lowest note of the right-hand voicing
const UPPER_CENTER = 63; // around Eb4: the comping sweet spot

/** Colour tones a pianist adds to an unadorned chord symbol. */
const DEFAULT_COLOR: Partial<Record<ChordEvent["quality"], string[]>> = {
  maj: ["9"],
  m: ["9"],
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
 * How the hands lay the chord out. Every style keeps the root (or slash bass) in the left
 * hand's `bass`; the styles differ in what `upper` holds.
 * - close: the upper structure (guide tones first, then colour) in close position: the default
 * - drop2 / drop3: four voices, the 2nd or 3rd from the top dropped an octave (the open,
 *   big-band spread under a lead voice)
 * - shell: just the 3rd and 7th (Bud Powell / root–shell comping)
 * - threeZone: shell low plus one "pretty note" (9, 11, 13, an alteration, or the 5th) on top
 */
export type VoicingStyle = "close" | "drop2" | "drop3" | "shell" | "threeZone";

export const VOICING_STYLES: readonly { id: VoicingStyle; label: string; hint: string }[] = [
  { id: "close", label: "Close (rootless)", hint: "Guide tones and colours packed inside an octave." },
  { id: "drop2", label: "Drop 2", hint: "Four voices, the second from the top dropped an octave: open and singing." },
  { id: "drop3", label: "Drop 3", hint: "Four voices, the third from the top dropped an octave: wide, with a tenth inside." },
  { id: "shell", label: "Shells", hint: "Root, 3rd and 7th only: the lean bebop sound." },
  { id: "threeZone", label: "Three-zone", hint: "Root, a 3rd–7th shell, and one pretty note on top (9, 11, 13)." },
];

export interface VoiceOptions {
  style?: VoicingStyle;
  /** MIDI note that must be the top voice (a melody note). Defaults to the chord's `topVoice`. */
  top?: number;
}

/** The degrees a three-zone voicing reaches for on top, best first. */
const PRETTY = ["b9", "#9", "#11", "b13", "#5", "b5", "13", "9", "11", "5"];

const SHELL_LOW = 47;
const SHELL_HIGH = 62;

/** The 3rd/7th shell's pitch classes (a triad without a 7th gets its 5th). */
function shellPcs(chord: ChordLike): number[] {
  const g = guideTones(chord).map((t) => chroma(t.note));
  const fifth = chordTones(chord).find((t) => ["5", "b5", "#5"].includes(t.degree));
  if (g.length < 2 && fifth) g.push(chroma(fifth.note));
  return [...new Set(g)];
}

/** The colour a three-zone voicing puts on top, as a pitch class. */
function prettyPc(chord: ChordLike, shell: number[]): number | undefined {
  const color = chord.alterations.length || chord.extensions.length ? [] : (DEFAULT_COLOR[chord.quality] ?? []);
  const tones = chordTones({ ...chord, extensions: [...chord.extensions, ...color] });
  for (const d of PRETTY) {
    const t = tones.find((x) => x.degree === d);
    if (t && !shell.includes(chroma(t.note))) return chroma(t.note);
  }
  return undefined;
}

/** Every placement of the shell inside the left hand's comping range, both orders. */
function shellPlacements(pcs: number[]): number[][] {
  const out: number[][] = [];
  for (let lo = SHELL_LOW; lo < SHELL_LOW + 12; lo++) {
    if (!pcs.includes(mod(lo, 12))) continue;
    const rest = pcs.filter((p) => p !== mod(lo, 12));
    let prev = lo;
    const v = [lo, ...rest.map((p) => (prev = prev + 1 + mod(p - (prev + 1), 12)))];
    if (v[v.length - 1] <= SHELL_HIGH) out.push(v);
  }
  return out;
}

/** Drop the n-th voice from the top (2 or 3) of a close four-voice stack an octave. */
function drop(v: number[], n: 2 | 3): number[] {
  const i = v.length - n;
  return [v[i] - 12, ...v.slice(0, i), ...v.slice(i + 1)];
}

/** The chord's voices stacked in close position directly under `top`. */
function closeUnder(top: number, pcs: number[]): number[] {
  const below = pcs.filter((p) => p !== mod(top, 12)).map((p) => top - (mod(top - p, 12) || 12));
  return [...new Set([...below, top])].sort((a, b) => a - b);
}

/** Candidate right-hand layouts for a style, before voice leading picks one. */
function candidates(chord: ChordLike, style: VoicingStyle, top: number | undefined): number[][] {
  if (style === "shell" || style === "threeZone") {
    const shell = shellPcs(chord);
    const placed = shellPlacements(shell);
    if (top !== undefined) return placed.filter((v) => v[v.length - 1] < top).map((v) => [...v, top]);
    if (style === "shell") return placed;
    const pretty = prettyPc(chord, shell);
    if (pretty === undefined) return placed;
    // the pretty note floats a 3rd to an octave and a half above the shell, in the right hand's range
    return placed.flatMap((v) => {
      const hi = v[v.length - 1];
      const out: number[][] = [];
      for (let n = hi + 3; n <= hi + 18; n++) if (mod(n, 12) === pretty && n >= 62 && n <= 79) out.push([...v, n]);
      return out;
    });
  }
  const four = upperPitchClasses(chord, 4).slice(0, 4).map((n) => chroma(n));
  if (top !== undefined) {
    const stack = closeUnder(top, four).slice(-4);
    return [style === "close" || stack.length < 4 ? stack : drop(stack, style === "drop2" ? 2 : 3)];
  }
  if (style === "close") return inversions(upperPitchClasses(chord).map((n) => chroma(n))).filter((v) => v[v.length - 1] <= 81);
  if (four.length < 4) return inversions(four).filter((v) => v[v.length - 1] <= 81);
  const n = style === "drop2" ? 2 : 3;
  return [...inversions(four), ...inversions(four).map((v) => v.map((m) => m + 12))]
    .map((v) => drop(v, n))
    .filter((v) => v[0] >= 48 && v[v.length - 1] <= 81);
}

/** Where each style's centre of gravity sits: shells low, drop voicings a little higher. */
const CENTER: Record<VoicingStyle, number> = { close: UPPER_CENTER, drop2: 62, drop3: 61, shell: 54, threeZone: 60 };

/**
 * Voice a chord for two-handed comping. With a previous voicing, picks the
 * layout with the least total voice movement, so the engine's
 * half-step voice leading is what you hear. `style` picks the texture (close by
 * default) and `top` (or the chord's own `topVoice`) pins the top note.
 */
export function voiceChord(chord: ChordLike, prev?: Voicing, opts: VoiceOptions = {}): Voicing {
  const style = opts.style ?? "close";
  const top = opts.top ?? (chord.topVoice ? midiOf(chord.topVoice) : undefined);
  const bassPc = chroma(chord.bass ?? chord.root);
  const bass = BASS_LOW + mod(bassPc - BASS_LOW, 12);
  let options = candidates(chord, style, top);
  if (!options.length) options = candidates(chord, "close", top);
  const score = (v: number[]) => {
    const center = v.reduce((s, n) => s + n, 0) / v.length;
    const drift = Math.abs(center - CENTER[style]) * 0.6;
    return (prev ? movement(prev.upper, v) : 0) + drift;
  };
  const upper = options.reduce((best, v) => (score(v) < score(best) ? v : best), options[0]);
  return { bass, upper };
}

/** Voice a whole progression with continuous voice leading, in one style. */
export function voiceProgression(chords: ChordLike[], opts: { style?: VoicingStyle } = {}): Voicing[] {
  const out: Voicing[] = [];
  for (const c of chords) out.push(voiceChord(c, out[out.length - 1], opts));
  return out;
}

export const midiToPc = (m: number) => mod(m, 12);
