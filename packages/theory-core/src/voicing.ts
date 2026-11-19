import { chordTones, guideTones, isDominant } from "./chords";
import { chroma, midiOf, mod } from "./pitch";
import { suggestScales } from "./scales";
import type { ChordEvent } from "./types";

export interface Voicing {
  /** Left-hand bass note (MIDI). */
  bass: number;
  /** Right-hand notes, ascending (MIDI). */
  upper: number[];
  /** Quartal only: the same stack moved one scale step, for planing on a held chord. */
  plane?: number[];
}

export type ChordLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "bass" | "display" | "topVoice">;

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
export function inversions(unsorted: number[]): number[][] {
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

/** Total voice movement between two layouts (each voice to its nearest partner, both ways). */
export const movement = (a: number[], b: number[]) =>
  b.reduce((s, n) => s + Math.min(...a.map((m) => Math.abs(m - n))), 0) + a.reduce((s, n) => s + Math.min(...b.map((m) => Math.abs(m - n))), 0);

/**
 * How the hands lay the chord out. Every style keeps the root (or slash bass) in the left
 * hand's `bass`; the styles differ in what `upper` holds.
 * - close: the upper structure (guide tones first, then colour) in close position: the default
 * - drop2 / drop3: four voices, the 2nd or 3rd from the top dropped an octave (the open,
 *   big-band spread under a lead voice)
 * - shell: just the 3rd and 7th (Bud Powell / root–shell comping)
 * - threeZone: shell low plus one "pretty note" (9, 11, 13, an alteration, or the 5th) on top
 * - quartal: 3–4 stacked 4ths from the chord's scale (McCoy / So What comping), with a
 *   `plane` neighbour one scale step away for long chords
 * - spread: the solo-ballad texture: a left-hand 10th (root–3rd; root–♭7 on a sus chord)
 *   under a right-hand triad or upper structure
 * A chord the style can't voice (no stack of 4ths in its scale holds both guide tones, say)
 * falls back to close, so no style ever drops a guide tone.
 */
export type VoicingStyle = "close" | "drop2" | "drop3" | "shell" | "threeZone" | "quartal" | "spread";

export const VOICING_STYLES: readonly { id: VoicingStyle; label: string; hint: string }[] = [
  { id: "close", label: "Close (rootless)", hint: "Guide tones and colours packed inside an octave." },
  { id: "drop2", label: "Drop 2", hint: "Four voices, the second from the top dropped an octave: open and singing." },
  { id: "drop3", label: "Drop 3", hint: "Four voices, the third from the top dropped an octave: wide, with a tenth inside." },
  { id: "shell", label: "Shells", hint: "Root, 3rd and 7th only: the lean bebop sound." },
  { id: "threeZone", label: "Three-zone", hint: "Root, a 3rd–7th shell, and one pretty note on top (9, 11, 13)." },
  { id: "quartal", label: "Quartal", hint: "Stacked 4ths from the chord's scale, planing a step on long chords: modal, McCoy-style." },
  { id: "spread", label: "Spread (10ths)", hint: "Left-hand 10th under a right-hand triad: the solo-ballad sound." },
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
export function drop(v: number[], n: 2 | 3): number[] {
  const i = v.length - n;
  return [v[i] - 12, ...v.slice(0, i), ...v.slice(i + 1)];
}

/** The chord's voices stacked in close position directly under `top`. */
function closeUnder(top: number, pcs: number[]): number[] {
  const below = pcs.filter((p) => p !== mod(top, 12)).map((p) => top - (mod(top - p, 12) || 12));
  return [...new Set([...below, top])].sort((a, b) => a - b);
}

/** The chord's own scale (the first `suggestScales` pick) as pitch classes, ascending from the root, plus its avoid notes. */
function chordScale(chord: ChordLike): { pcs: number[]; avoid: Set<number> } | undefined {
  const s = suggestScales({ ...chord, analysis: undefined })[0];
  if (!s) return undefined;
  const root = chroma(chord.root);
  const pcs = [...new Set(s.notes.map(chroma))].sort((a, b) => mod(a - root, 12) - mod(b - root, 12));
  return { pcs, avoid: new Set(s.avoid.map(chroma)) };
}

/**
 * Every stack of 3–4 fourths (perfect, or at most one tritone) built from the scale, as pitch
 * classes bottom to top, holding both guide tones and no avoid note or root. Stacks that keep
 * the chord's alterations win when there are any.
 */
function quartalStacks(chord: ChordLike, scale: { pcs: number[]; avoid: Set<number> }): number[][] {
  // a 6 chord's whole point is having no 7th: keep the scale's 7th out of the stack
  const sevenths = chord.quality === "6" || chord.quality === "m6" ? [10, 11].map((i) => mod(chroma(chord.root) + i, 12)) : [];
  const ok = new Set(scale.pcs.filter((p) => !scale.avoid.has(p) && p !== chroma(chord.root) && !sevenths.includes(p)));
  const guides = guideTones(chord).map((g) => chroma(g.note));
  const out: number[][] = [];
  const grow = (stack: number[], tritones: number) => {
    if (stack.length >= 3 && guides.every((g) => stack.includes(g))) out.push(stack);
    if (stack.length === 4) return;
    for (const step of [5, 6]) {
      const next = mod(stack[stack.length - 1] + step, 12);
      if (ok.has(next) && !stack.includes(next) && tritones + (step === 6 ? 1 : 0) <= 1) grow([...stack, next], tritones + (step === 6 ? 1 : 0));
    }
  };
  ok.forEach((p) => grow([p], 0));
  const byDeg = new Map(chordTones(chord).map((t) => [t.degree, chroma(t.note)]));
  const alts = chord.alterations.map((a) => byDeg.get(a)).filter((p): p is number => p !== undefined);
  const withAlts = out.filter((s) => alts.every((a) => s.includes(a)));
  const pool = withAlts.length ? withAlts : out;
  // four voices when the scale allows them; three only as a fallback
  const four = pool.filter((s) => s.length === 4);
  return four.length ? four : pool;
}

/** Lay a stack of pitch classes out upwards from `low` (each voice the next one above). */
function stackFrom(low: number, pcs: number[]): number[] {
  let prev = low;
  return [low, ...pcs.slice(1).map((p) => (prev = prev + 1 + mod(p - (prev + 1), 12)))];
}

/** The same stack moved one scale step (up first, then down), if every voice lands on a usable scale note. */
function planeOf(upper: number[], scale: { pcs: number[]; avoid: Set<number> }): number[] | undefined {
  for (const dir of [1, -1]) {
    const moved: number[] = [];
    for (const m of upper) {
      const i = scale.pcs.indexOf(mod(m, 12));
      if (i < 0) break;
      const pc = scale.pcs[mod(i + dir, scale.pcs.length)];
      const step = mod(dir * (pc - mod(m, 12)), 12);
      if (step < 1 || step > 2 || scale.avoid.has(pc)) break;
      moved.push(m + dir * step);
    }
    if (moved.length === upper.length && moved[moved.length - 1] <= 81 && moved[0] >= UPPER_LOW) return moved;
  }
  return undefined;
}

/** The left-hand note of a spread voicing: the 3rd a 10th above the bass, or the ♭7 on a sus chord. */
function spreadLh(chord: ChordLike, bass: number): number | undefined {
  const tones = chordTones(chord);
  const third = tones.find((t) => ["3", "b3"].includes(t.degree));
  const seventh = tones.find((t) => ["7", "b7", "bb7", "6"].includes(t.degree));
  if (third && mod(chroma(third.note) - bass, 12) !== 0) return bass + 12 + mod(chroma(third.note) - bass, 12);
  if (seventh) {
    const d = mod(chroma(seventh.note) - bass, 12);
    return bass + (d < 7 ? d + 12 : d);
  }
  return undefined;
}

const isTriadPcs = (pcs: number[]) =>
  pcs.length === 3 &&
  [0, 1, 2].some((r) => {
    const o = [...pcs.slice(r), ...pcs.slice(0, r)];
    const a = mod(o[1] - o[0], 12);
    const b = mod(o[2] - o[1], 12);
    return (a === 3 || a === 4) && (b === 3 || b === 4);
  });

/**
 * The right hand's three pitch classes over a spread left hand, best first: together with
 * the left-hand note they hold both guide tones; then keeping the chord's alterations beats
 * losing them, a real triad (an upper structure) beats any three notes, and not doubling the
 * left hand's note beats doubling it.
 */
function spreadSets(chord: ChordLike, lhPc: number, top: number | undefined): number[][] {
  const pool = upperPitchClasses(chord, 5)
    .map((n) => chroma(n))
    .filter((p) => p !== chroma(chord.root));
  // the natural 9 and 13 are upper-structure material unless an alteration replaces them
  const alt = chord.alterations;
  const color = (DEFAULT_COLOR[chord.quality] ?? []).filter((d) => !(d === "9" && (alt.includes("b9") || alt.includes("#9"))) && !(d === "13" && (alt.includes("b13") || alt.includes("#5"))));
  for (const t of chordTones({ ...chord, extensions: [...chord.extensions, ...color] }))
    if (color.includes(t.degree) && !pool.includes(chroma(t.note))) pool.push(chroma(t.note));
  if (top !== undefined && !pool.includes(mod(top, 12))) pool.push(mod(top, 12));
  const guides = guideTones(chord).map((g) => chroma(g.note));
  const byDeg = new Map(chordTones(chord).map((t) => [t.degree, chroma(t.note)]));
  const alts = chord.alterations.map((a) => byDeg.get(a)).filter((p): p is number => p !== undefined);
  const sets: { pcs: number[]; score: number }[] = [];
  for (let a = 0; a < pool.length; a++)
    for (let b = a + 1; b < pool.length; b++)
      for (let c = b + 1; c < pool.length; c++) {
        const pcs = [pool[a], pool[b], pool[c]];
        if (!guides.every((g) => g === lhPc || pcs.includes(g))) continue;
        if (top !== undefined && !pcs.includes(mod(top, 12))) continue;
        const score = alts.filter((p) => pcs.includes(p)).length * 10 + (isTriadPcs([...pcs].sort((x, y) => x - y)) ? 8 : 0) - (pcs.includes(lhPc) ? 2 : 0);
        sets.push({ pcs, score });
      }
  // stable order: equal scores keep pool order (guide tones first)
  return sets.sort((x, y) => y.score - x.score).map((s) => s.pcs);
}

/**
 * Candidate right-hand layouts for a style, before voice leading picks one.
 * @internal shared with `voicingForms.ts`, so the Voicings tab lists exactly what the band can play.
 */
export function candidates(chord: ChordLike, style: VoicingStyle, top: number | undefined, bass: number): number[][] {
  if (style === "quartal") {
    const scale = chordScale(chord);
    if (!scale) return [];
    const stacks = quartalStacks(chord, scale);
    if (top !== undefined)
      return stacks
        .filter((s) => s[s.length - 1] === mod(top, 12))
        .map((s) => stackFrom(top - (s.reduce((sum, p, i) => (i ? sum + mod(p - s[i - 1], 12) : sum), 0)), s))
        .filter((v) => v[0] >= UPPER_LOW && v[0] > bass);
    return stacks.flatMap((s) => {
      const out: number[][] = [];
      for (let low = UPPER_LOW; low < UPPER_LOW + 24; low++) {
        if (mod(low, 12) !== s[0]) continue;
        const v = stackFrom(low, s);
        if (v[0] > bass && v[v.length - 1] <= 81) out.push(v);
      }
      return out;
    });
  }
  if (style === "spread") {
    const lh = spreadLh(chord, bass);
    if (lh === undefined) return [];
    const guides = guideTones(chord).map((g) => chroma(g.note));
    const sets = spreadSets(chord, mod(lh, 12), top);
    if (!sets.length) return [];
    const out: number[][] = [];
    // the best-scoring sets only, so voice leading picks an inversion, not a weaker grip
    const best = sets.filter((s) => sets.indexOf(s) < 3);
    for (const set of best) {
      const layouts = top !== undefined ? [closeUnder(top, set)] : inversions(set).flatMap((v) => [v, v.map((m) => m + 12)]);
      for (const rh of layouts) {
        if (rh.length !== 3 || rh[0] <= lh || rh[2] > 81 || rh[2] - rh[0] >= 12) continue;
        const v = [lh, ...rh];
        if (guides.every((g) => v.some((m) => mod(m, 12) === g))) out.push(v);
      }
      if (out.length) break;
    }
    return out;
  }
  if (style === "shell" || style === "threeZone") {
    const shell = shellPcs(chord);
    // the shell range starts at B2, which can sit under a C3 bass
    const placed = shellPlacements(shell).filter((v) => v[0] > bass);
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
    // the dropped voice must clear the bass: D♭m7♭5's drop-3 once landed on the bass's own D♭
    .filter((v) => v[0] >= 48 && v[0] > bass && v[v.length - 1] <= 81);
}

/** Where each style's centre of gravity sits: shells low, drop voicings a little higher. */
export const CENTER: Record<VoicingStyle, number> = { close: UPPER_CENTER, drop2: 62, drop3: 61, shell: 54, threeZone: 60, quartal: 63, spread: 64 };

/**
 * Voice a chord for two-handed comping. With a previous voicing, picks the
 * layout with the least total voice movement, so the engine's
 * half-step voice leading is what you hear. `style` picks the texture (close by
 * default) and `top` (or the chord's own `topVoice`) pins the top note.
 */
export function voiceChord(chord: ChordLike, prev?: Voicing, opts: VoiceOptions = {}): Voicing {
  const style = opts.style ?? "close";
  const top = opts.top ?? (chord.topVoice ? midiOf(chord.topVoice) : undefined);
  const bass = bassOf(chord);
  const { options, scale } = styleOptions(chord, style, top, bass);
  const score = layoutScore(style, prev?.upper);
  const upper = options.reduce((best, v) => (score(v) < score(best) ? v : best), options[0]);
  const plane = scale && planeOf(upper, scale);
  if (plane) return { bass, upper, plane };
  return { bass, upper };
}

/** The left hand's bass note for a chord (its root, or its slash bass), between D2 and C♯3. */
export function bassOf(chord: ChordLike): number {
  return BASS_LOW + mod(chroma(chord.bass ?? chord.root) - BASS_LOW, 12);
}

/**
 * Every layout a style offers for a chord, after the fallback to close and the quartal
 * "room to plane" preference. @internal shared with `voicingForms.ts`.
 */
export function styleOptions(chord: ChordLike, style: VoicingStyle, top: number | undefined, bass: number) {
  let options = candidates(chord, style, top, bass);
  const fellBack = !options.length;
  if (fellBack) options = candidates(chord, "close", top, bass);
  const scale = style === "quartal" && top === undefined && !fellBack ? chordScale(chord) : undefined;
  if (scale) {
    // a stack with room to plane beats one jammed against the edge of the range
    const planing = options.filter((v) => planeOf(v, scale));
    if (planing.length) options = planing;
  }
  return { options, fellBack, scale };
}

/** How voice leading ranks a layout: movement from the previous one plus drift from the style's centre. Lower is better. */
export function layoutScore(style: VoicingStyle, prev?: number[]) {
  return (v: number[]) => {
    const center = v.reduce((s, n) => s + n, 0) / v.length;
    const drift = Math.abs(center - CENTER[style]) * 0.6;
    return (prev ? movement(prev, v) : 0) + drift;
  };
}

/** Voice a whole progression with continuous voice leading, in one style. */
export function voiceProgression(chords: ChordLike[], opts: { style?: VoicingStyle } = {}): Voicing[] {
  const out: Voicing[] = [];
  for (const c of chords) out.push(voiceChord(c, out[out.length - 1], opts));
  return out;
}

export const midiToPc = (m: number) => mod(m, 12);
