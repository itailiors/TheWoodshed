import { chordTones, guideTones } from "./chords";
import { chroma, mod, prettyNote, spellChroma } from "./pitch";
import { bassOf, drop, inversions, layoutScore, styleOptions, VOICING_STYLES, type ChordLike, type VoicingStyle } from "./voicing";

/**
 * The Voicings tab's view of the engine: every *form* a style offers for a chord (rootless A
 * and B, the drop-2 inversions, each quartal stack…), annotated note by note, plus a grader
 * that names the shape a player actually played. Every layout comes from `voicing.ts`'s own
 * `styleOptions`, so the tab can only ever show what the band can play.
 */

export type Hand = "L" | "R";

export interface FormNote {
  midi: number;
  /** Degree against the chord root: "1", "b3", "5", "b7", "9", "#11", "13"… */
  degree: string;
  /** Spelled note name without octave ("Ab", "F#"). */
  name: string;
  hand: Hand;
}

export interface VoicingForm {
  /** The style these notes belong to: "close" when the asked-for style fell back. */
  style: VoicingStyle;
  /** Stable within (chord, style): "A", "B", "rootless-top-9", "root-on-3", "3-b7-9"… */
  id: string;
  /** Plain-English name for the UI ("Type A: 3rd on the bottom"). */
  label: string;
  /** Bass first (left hand), then the voicing, ascending. */
  notes: FormNote[];
  /** True when the asked-for style can't voice this chord and these are close forms instead. */
  fellBack: boolean;
}

export interface ShapeKey {
  style: VoicingStyle;
  form: string;
}

/** Degree names by semitone above the root, for notes the chord's own spelling doesn't cover. */
const DEGREE_BY_SEMIS = ["1", "b9", "9", "b3", "3", "11", "#11", "5", "b13", "13", "b7", "7"];

/** Pitch class → { degree, spelled name } for this chord, colour tones included. */
function degreeMap(chord: ChordLike): Map<number, { degree: string; name: string }> {
  const map = new Map<number, { degree: string; name: string }>();
  const extensions = [...new Set([...chord.extensions, "9", "11", "13"])];
  // the chord's own tones win over generic colours (a ♭9 beats a 9 for the same key)
  for (const t of [...chordTones(chord), ...chordTones({ ...chord, alterations: [], extensions })]) {
    const pc = chroma(t.note);
    if (!map.has(pc)) map.set(pc, { degree: t.degree, name: t.note });
  }
  const root = chroma(chord.root);
  for (let s = 0; s < 12; s++) {
    const pc = mod(root + s, 12);
    if (!map.has(pc)) map.set(pc, { degree: DEGREE_BY_SEMIS[s], name: spellChroma(pc) });
  }
  return map;
}

/** A chord and how it's voiced: a Coach `DrillStep` fits, and so does a form split into bass and upper voices. */
export interface VoicedChord {
  chord: ChordLike;
  target: { bass: number; upper: readonly number[] };
}

/**
 * Voice motion: what the voices did between two chords, as you'd say it at the piano:
 * "2 held · A♭→G (−1) · E♭→D (−1) · bass B♭→E♭". Each note is spelled as its chord spells it
 * (A♭ in Fm9, not G♯, colour tones included); upper voices are paired bottom to top.
 */
export function voiceMotion(prev: VoicedChord, cur: VoicedChord): string {
  const spell = (v: VoicedChord, midi: number) => prettyNote(degreeMap(v.chord).get(mod(midi, 12))!.name);
  const a = [...prev.target.upper].sort((x, y) => x - y);
  const b = [...cur.target.upper].sort((x, y) => x - y);
  let held = 0;
  const moves: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = b[i] - a[i];
    if (d === 0) held++;
    else moves.push(`${spell(prev, a[i])}→${spell(cur, b[i])} (${d > 0 ? "+" : "−"}${Math.abs(d)})`);
  }
  const bass = prev.target.bass === cur.target.bass ? [] : [`bass ${spell(prev, prev.target.bass)}→${spell(cur, cur.target.bass)}`];
  return [held ? `${held} held` : "", ...moves, ...bass].filter(Boolean).join(" · ");
}

/** A form as a `VoicedChord`: its first note is the bass, the rest are the upper voices. */
export const voicedForm = (form: VoicingForm, chord: ChordLike): VoicedChord => ({
  chord,
  target: { bass: form.notes[0].midi, upper: form.notes.slice(1).map((n) => n.midi) },
});

const prettyDeg = (d: string) => prettyNote(d);
const ORDINAL: Record<string, string> = { "1": "root", "3": "3rd", b3: "3rd", "4": "4th", "5": "5th", b5: "♭5", "#5": "♯5", "6": "6th", "7": "7th", b7: "7th", bb7: "7th", "9": "9th", "11": "11th", "13": "13th" };
/** "the 3rd", "the ♭9": how hints name a degree. */
export const degreeWord = (d: string) => (ORDINAL[d] ?? prettyDeg(d));

const isThird = (chord: ChordLike, pc: number) => guideTones(chord)[0] && chroma(guideTones(chord)[0].note) === pc;
const isSeventh = (chord: ChordLike, pc: number) => {
  const g = guideTones(chord);
  return g.length > 1 && chroma(g[1].note) === pc;
};

/** Which hand plays each upper note, by style (the bass is always the left hand's). */
function hands(style: VoicingStyle, upper: number[]): Hand[] {
  const lhCount = style === "drop2" || style === "drop3" || style === "spread" || style === "shell" ? 1 : 0;
  return upper.map((_, i) => (i < lhCount ? "L" : "R"));
}

/** Form id and label for one layout of a style. */
function nameOf(chord: ChordLike, style: VoicingStyle, upper: number[], degrees: string[], textbook: boolean): { id: string; label: string } {
  const bottom = mod(upper[0], 12);
  const top = degrees[degrees.length - 1];
  if (textbook) {
    const inv: Record<string, string> = { "1": "Root position", "3": "1st inversion", b3: "1st inversion", "4": "1st inversion", "5": "2nd inversion", b5: "2nd inversion", "#5": "2nd inversion" };
    return { id: `root-on-${degrees[0]}`, label: `${inv[degrees[0]] ?? "3rd inversion"} (with the root)` };
  }
  if (style === "close" && isThird(chord, bottom)) return { id: "A", label: "Type A: 3rd on the bottom" };
  if (style === "close" && isSeventh(chord, bottom)) return { id: "B", label: `Type B: ${degreeWord(degrees[0])} on the bottom` };
  if (style === "drop2" || style === "drop3") return { id: `rootless-top-${top}`, label: `Rootless, ${degreeWord(top)} on top` };
  if (style === "quartal") return { id: degrees.join("-"), label: `4ths from the ${degreeWord(degrees[0])}` };
  if (style === "spread") return { id: degrees.join("-"), label: `10th + ${degrees.slice(1).map(prettyDeg).join("–")}` };
  if (style === "shell") return { id: degrees.join("-"), label: `${degreeWord(degrees[0])} below ${degreeWord(degrees[1] ?? degrees[0])}` };
  return { id: degrees.join("-"), label: `${degreeWord(degrees[0])} on the bottom, ${degreeWord(top)} on top` };
}

/** The textbook drop-2/3 inversions of the plain four-note chord (R-3-5-7), root included. */
function textbookDrops(chord: ChordLike, n: 2 | 3, bass: number): number[][] {
  const tones = chordTones(chord);
  const pick = (ds: string[]) => tones.find((t) => ds.includes(t.degree));
  const four = [pick(["1"]), pick(["3", "b3", "4"]), pick(["5", "b5", "#5"]), pick(["7", "b7", "bb7", "6"])];
  if (four.some((t) => !t)) return [];
  const pcs = four.map((t) => chroma(t!.note));
  return [...inversions(pcs), ...inversions(pcs).map((v) => v.map((m) => m + 12))]
    .map((v) => drop(v, n))
    .filter((v) => v[0] > bass && v[0] >= 48 && v[v.length - 1] <= 81);
}

interface Layout {
  style: VoicingStyle;
  upper: number[];
  textbook: boolean;
  fellBack: boolean;
}

/** Every layout (all octaves) a style offers for a chord, engine layouts first. With `top`, only layouts with that note on top. */
function layouts(chord: ChordLike, style: VoicingStyle, top?: number): Layout[] {
  const bass = bassOf(chord);
  const { options, fellBack } = styleOptions(chord, style, top, bass);
  const used: VoicingStyle = fellBack ? "close" : style;
  const out: Layout[] = options.map((upper) => ({ style: used, upper, textbook: false, fellBack }));
  if (!fellBack && (style === "drop2" || style === "drop3"))
    for (const upper of textbookDrops(chord, style === "drop2" ? 2 : 3, bass))
      if (top === undefined || upper[upper.length - 1] === top) out.push({ style, upper, textbook: true, fellBack });
  return out;
}

function toForm(chord: ChordLike, l: Layout, degrees: Map<number, { degree: string; name: string }>): VoicingForm {
  const bass = bassOf(chord);
  const ds = l.upper.map((m) => degrees.get(mod(m, 12))!.degree);
  const { id, label } = nameOf(chord, l.style, l.upper, ds, l.textbook);
  const h = hands(l.style, l.upper);
  const bassInfo = degrees.get(mod(bass, 12))!;
  return {
    style: l.style,
    id,
    label,
    fellBack: l.fellBack,
    notes: [
      { midi: bass, degree: bassInfo.degree, name: chord.bass ?? bassInfo.name, hand: "L" },
      ...l.upper.map((midi, i) => ({ midi, degree: ds[i], name: degrees.get(mod(midi, 12))!.name, hand: h[i] })),
    ],
  };
}

/**
 * Every form a style offers for a chord, one layout per form (the one the engine would pick
 * with no previous chord). The first form is exactly `voiceChord(chord, undefined, {style})`.
 * Drop-2/3 also list the textbook root-position inversions after the band's rootless ones.
 */
export function voicingForms(chord: ChordLike, style: VoicingStyle): VoicingForm[] {
  const degrees = degreeMap(chord);
  const all = layouts(chord, style);
  const score = layoutScore(style);
  const best = new Map<string, { l: Layout; s: number; i: number }>();
  all.forEach((l, i) => {
    const f = toForm(chord, l, degrees);
    const s = score(l.upper);
    const cur = best.get(f.id);
    if (!cur || s < cur.s) best.set(f.id, { l, s, i });
  });
  // engine forms by score (ties keep the engine's order, as voiceChord's reduce does), textbook forms after
  return [...best.values()]
    .sort((a, b) => Number(a.l.textbook) - Number(b.l.textbook) || a.s - b.s || a.i - b.i)
    .map(({ l }) => toForm(chord, l, degrees));
}

/** Pitch classes bottom to top, each once (its lowest occurrence). */
function pcOrder(notes: number[]): number[] {
  const out: number[] = [];
  for (const m of [...notes].sort((a, b) => a - b)) if (!out.includes(mod(m, 12))) out.push(mod(m, 12));
  return out;
}

/** The played notes read two ways: as played, and with a bass note (lowest, on the chord's bass) set aside. */
function readings(notes: number[], chord: ChordLike): number[][] {
  const sorted = [...notes].sort((a, b) => a - b);
  const out = [pcOrder(sorted)];
  if (sorted.length > 1 && mod(sorted[0], 12) === chroma(chord.bass ?? chord.root)) out.push(pcOrder(sorted.slice(1)));
  return out;
}

const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Which forms (of any style) these notes are, octave-free: the pitch classes bottom to top
 * must match a form's voicing, with the chord's bass optional underneath.
 */
export function classifyVoicing(notes: number[], chord: ChordLike): ShapeKey[] {
  const reads = readings(notes, chord);
  const out: ShapeKey[] = [];
  for (const { id: style } of VOICING_STYLES)
    for (const f of voicingForms(chord, style)) {
      if (f.fellBack) continue;
      const seq = pcOrder(f.notes.slice(1).map((n) => n.midi));
      if (reads.some((r) => sameSeq(r, seq)) && !out.some((k) => k.style === f.style && k.form === f.id)) out.push({ style: f.style, form: f.id });
    }
  return out;
}

export interface ShapeGrade {
  valid: boolean;
  /** Degrees of the form that weren't played. */
  missing: string[];
  /** Spelled names of played notes that aren't in the form (the bass is always allowed). */
  extra: string[];
  /** When the notes are right but the shape isn't: the form that was played instead, if it is one. */
  playedForm?: ShapeKey;
  /** One line for the red pen. */
  hint: string;
}

/**
 * Grade a played chord against one form, octave-free: right notes (bass optional), nothing
 * extra, and the same order bottom to top. Says which part failed, never just "wrong".
 */
export function gradeShape(played: number[], form: VoicingForm, chord: ChordLike): ShapeGrade {
  const degrees = degreeMap(chord);
  const target = form.notes.slice(1);
  const bassPc = mod(form.notes[0].midi, 12);
  const pcs = new Set(played.map((m) => mod(m, 12)));
  const targetPcs = new Set(target.map((n) => mod(n.midi, 12)));
  const missing = target.filter((n) => !pcs.has(mod(n.midi, 12))).map((n) => n.degree);
  const extra = [...pcs].filter((p) => !targetPcs.has(p) && p !== bassPc).map((p) => degrees.get(p)!.name);
  if (missing.length || extra.length) {
    const parts = [
      missing.length ? `missing the ${missing.map(degreeWord).join(" and the ")} (${target.filter((n) => missing.includes(n.degree)).map((n) => prettyNote(n.name)).join(", ")})` : "",
      extra.length ? `${extra.map(prettyNote).join(", ")} ${extra.length > 1 ? "aren't" : "isn't"} in this voicing` : "",
    ].filter(Boolean);
    const hint = parts.join("; ");
    return { valid: false, missing, extra, hint: hint[0].toUpperCase() + hint.slice(1) + "." };
  }
  const seq = pcOrder(target.map((n) => n.midi));
  if (readings(played, chord).some((r) => sameSeq(r, seq))) return { valid: true, missing: [], extra: [], hint: "That's it." };
  const others = classifyVoicing(played, chord);
  const playedForm = others.find((k) => k.style === form.style) ?? others[0];
  const want = `${degreeWord(target[0].degree)} on the bottom, ${degreeWord(target[target.length - 1].degree)} on top`;
  const hint = playedForm
    ? `Right notes, but that's the ${playedForm.form === "A" || playedForm.form === "B" ? `Type ${playedForm.form}` : playedForm.form} shape. This one has the ${want}.`
    : `Right notes, different order: this one has the ${want}.`;
  return { valid: false, missing: [], extra: [], playedForm, hint };
}

/**
 * Movement voice by voice (bottom to bottom, top to top) when the counts match: how a pianist
 * hears a ii–V–I line. Falls back to the nearest-note `layoutScore` measure otherwise.
 */
function voiceByVoice(style: VoicingStyle, prev: number[] | undefined) {
  const base = layoutScore(style, prev);
  if (!prev) return base;
  const drift = layoutScore(style);
  return (v: number[]) => (v.length === prev.length ? v.reduce((s, m, i) => s + Math.abs(m - prev[i]), 0) * 2 + drift(v) : base(v));
}

/**
 * Voice-lead a progression through one style's forms, each chord taking the form (and octave)
 * whose voices move least, voice by voice, from the last. Optionally start on a named form:
 * rootless ii–V–I from "A" alternates A, B, A. `tops[i]`, when set, pins chord i's top note
 * (a melody note); the style falls back to close when it can't fit under it.
 */
export function voiceLeadForms(chords: ChordLike[], style: VoicingStyle, startForm?: string, tops: (number | undefined)[] = []): VoicingForm[] {
  const out: VoicingForm[] = [];
  let prev: number[] | undefined;
  chords.forEach((chord, i) => {
    const degrees = degreeMap(chord);
    let pool = layouts(chord, style, tops[i]).map((l) => ({ l, f: toForm(chord, l, degrees) }));
    if (i === 0 && startForm && pool.some((p) => p.f.id === startForm)) pool = pool.filter((p) => p.f.id === startForm);
    const score = voiceByVoice(style, prev);
    const best = pool.reduce((b, p) => (score(p.l.upper) < score(b.l.upper) ? p : b), pool[0]);
    out.push(best.f);
    prev = best.l.upper;
  });
  return out;
}
