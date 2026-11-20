/**
 * One Note on Top: hold a single note in the top voice while the bass walks chromatically
 * into the next chord, re-hearing that one note as a different chord member over each bass
 * note (root, ♭9, 9, 3rd, sus 4th, ♯11, 5th, ♭13, 13, ♭7, major 7th).
 *
 * With a melody, the held note is the melody's own sustained note, so the melody filter can
 * only ever pass the move: every walk chord is built to contain it. On a changes-only chart
 * the pianist picks the top note, so the rule holds the tone the chord shares with its target,
 * and only into a cadence (the chord resolving down a 5th), so the dial doesn't reach for it
 * on every long chord.
 * Everything is interval-relative to the held note and the target's bass.
 */
import { chordChromas, chordTones, resolvesDownFifth, symbol } from "./chords";
import type { OneNoteOnTopLearn } from "./learn/facts";
import { chroma, midiOf, mod, pitchClass, transpose } from "./pitch";
import { mk, ps, tidy, type NewChord, type Rule } from "./ruleKit";
import { eventSpan, melodyIn, sortedHarmony } from "./time";
import type { ChordEvent, NoteEvent, Quality } from "./types";

interface Shape {
  quality: Quality;
  extensions?: string[];
  alterations?: string[];
}

/** For the held note `i` semitones above the bass: a chord that contains it, chosen for colour. */
const SHAPE: Record<number, Shape> = {
  0: { quality: "6", extensions: ["9"] },
  1: { quality: "7", alterations: ["b9"] },
  2: { quality: "m7", extensions: ["9"] },
  3: { quality: "m7", extensions: ["9"] },
  4: { quality: "7", extensions: ["9"] },
  5: { quality: "7sus4", extensions: ["9"] },
  6: { quality: "7", alterations: ["#11"] },
  7: { quality: "maj7", extensions: ["9"] },
  8: { quality: "7", alterations: ["b13"] },
  9: { quality: "7", extensions: ["13"] },
  10: { quality: "m7", extensions: ["9"] },
  11: { quality: "maj7", extensions: ["9"] },
};

/** The last walk chord leans into the target, so it's a dominant wherever the held note allows. */
const APPROACH: Partial<Record<number, Shape>> = {
  0: { quality: "7sus4", extensions: ["9"] },
  2: { quality: "7", extensions: ["9"] },
  3: { quality: "7", alterations: ["#9"] },
  7: { quality: "7", extensions: ["9"] },
  10: { quality: "7", extensions: ["9"] },
};

/** Which common tone a changes-only chart holds on top, best first (by degree in the chord). */
const HOLD_PREFERENCE = ["1", "5", "3", "b3", "b7", "7", "6", "4", "9", "13"];

/** The held note's role as a word ("b9" → "♭9", "4" → "sus 4th"); `facts.roles` keeps the degree codes. */
export const roleWord = (degree: string) => DEGREE_WORD[degree] ?? degree;

const DEGREE_WORD: Record<string, string> = {
  "1": "root",
  b9: "♭9",
  "9": "9th",
  "#9": "♯9",
  b3: "♭3rd",
  "3": "3rd",
  "4": "sus 4th",
  "11": "11th",
  "#11": "♯11",
  b5: "♭5th",
  "5": "5th",
  b13: "♭13",
  "#5": "♯5",
  "6": "6th",
  "13": "13th",
  b7: "♭7th",
  "7": "major 7th",
};

const EPS = 1e-6;

/** The one note sounding through [from, to), if the melody holds a single pitch class there and over the whole chord. */
function heldMelodyNote(notes: NoteEvent[], bpb: number, chordStart: number, from: number, to: number): NoteEvent | null {
  if (!notes.length) return null;
  const c = chroma(pitchClass(notes[0].pitch));
  if (notes.some((n) => chroma(pitchClass(n.pitch)) !== c)) return null;
  // the walk's beats must be covered with no gap (a tie or repeated strikes of the same note are fine)
  const spans = notes.map((n) => eventSpan(n, bpb)).sort((a, b) => a[0] - b[0]);
  let covered = from;
  for (const [s, e] of spans) {
    if (s > covered + EPS) break;
    covered = Math.max(covered, e);
  }
  if (covered < to - EPS) return null;
  // the note heard over the walk (the last one that starts before it does), for its octave
  const inWalk = notes.filter((n) => eventSpan(n, bpb)[0] < to - EPS && eventSpan(n, bpb)[1] > from + EPS);
  return inWalk[inWalk.length - 1] ?? (chordStart <= from ? notes[0] : null);
}

/** On a chart with no melody: the chord's tone the target shares, placed around the top of the treble staff. */
function commonTopNote(chord: ChordEvent, next: ChordEvent): string | null {
  const shared = chordChromas(next);
  const tones = chordTones(chord);
  for (const d of HOLD_PREFERENCE) {
    const t = tones.find((x) => x.degree === d && shared.has(chroma(x.note)));
    if (!t) continue;
    const name = tidy(t.note);
    const midi = 65 + mod(chroma(name) - 65, 12);
    // name the octave from the spelling's own letter (B#, Cb sit across the octave line)
    const octave = Math.floor(midi / 12) - 1;
    for (const o of [octave, octave - 1, octave + 1]) if (midiOf(`${name}${o}`) === midi) return `${name}${o}`;
  }
  return null;
}

/** The walk's bass notes into `target`: down by half steps from the chord's bass when that lands exactly, else chromatically down from above the target. */
function walkBasses(from: string, target: string, n: number): string[] {
  const d = mod(chroma(from) - chroma(target), 12);
  if (d === n + 1) return ["7", "b7", "6"].slice(0, n).map((iv) => tidy(transpose(from, iv)));
  return ["b3", "2", "b2"].slice(3 - n).map((iv) => tidy(transpose(target, iv)));
}

export const oneNoteOnTop: Rule = {
  id: "melody.oneNoteOnTop",
  name: "One note on top",
  pedagogy: {
    formula: "X (held note) → bass walks ½-steps → Y, the top note never moves",
    whenToUse: "A chord of a bar or more under a sustained melody note; on a changes-only chart, a ii→V or V→I, holding a tone the two chords share.",
    whyItWorks:
      "The ear hangs on the held top note while the bass moves under it, so the same pitch is heard as ♭9, ♯11, 13… in turn: the colour changes and the line never leaves.",
    bandstandCue: "Pin the top note with your 5th finger, walk the bass down by half steps into the next chord, and build each chord under that one note.",
  },
  propose({ tune, index, chord, next }) {
    if (!next || chord.display || chord.beats < 3) return null;
    const bpb = tune.meter[0];
    const [start, end] = eventSpan(chord, bpb);
    // a bar: keep the chord for 1–2 beats, walk 2 beats; longer chords walk 3 (two beats each from 8)
    const walkLen = chord.beats >= 6 ? 3 : 2;
    const step = chord.beats >= 8 ? 2 : 1;
    const keepBeats = chord.beats - walkLen * step;
    const walkFrom = start + keepBeats;

    let topVoice: string | null;
    if (tune.melody.length === 0) {
      // with no melody to ask for it, walk only into a cadence (ii→V, V→I): the place a
      // chromatic approach earns its keep, and never into the same chord again. In a chain
      // of fifths (a bridge of dominants) only the first link walks, so it stays a surprise.
      const bassOf = (c: ChordEvent) => ({ root: c.bass ?? c.root });
      if (!resolvesDownFifth(bassOf(chord), bassOf(next))) return null;
      // (a chord written out bar by bar, G7 | G7, counts as one: look back past its repeats)
      const before = sortedHarmony(tune)
        .slice(0, index)
        .reverse()
        .find((c) => chroma(bassOf(c).root) !== chroma(bassOf(chord).root));
      if (before && resolvesDownFifth(bassOf(before), bassOf(chord))) return null;
      topVoice = commonTopNote(chord, next);
    } else {
      const held = heldMelodyNote(melodyIn(tune, start, end), bpb, start, walkFrom, end);
      topVoice = held?.pitch ?? null;
    }
    if (!topVoice) return null;
    const T = pitchClass(topVoice);
    const tc = chroma(T);

    const target = next.bass ?? next.root;
    const basses = walkBasses(chord.bass ?? chord.root, target, walkLen);
    const walk: NewChord[] = basses.map((b, k) => {
      const i = mod(tc - chroma(b), 12);
      const shape = (k === basses.length - 1 ? APPROACH[i] : undefined) ?? SHAPE[i];
      return { ...mk(b, shape.quality, step, shape.extensions ?? [], shape.alterations ?? []), topVoice };
    });
    // the chord keeps its downbeat; it holds the note on top too when that's one of its own colours
    const own = chordChromas({ ...chord, extensions: [...chord.extensions, "9", "13"] });
    const kept: NewChord = {
      root: chord.root,
      quality: chord.quality,
      extensions: chord.extensions,
      alterations: chord.alterations,
      beats: keepBeats,
      ...(chord.bass ? { bass: chord.bass } : {}),
      ...(chord.analysis ? { analysis: chord.analysis } : {}),
      ...(own.has(tc) ? { topVoice } : {}),
    };
    const chords = [kept, ...walk];
    /** The held note's degree in a walk chord, as a code ("b9", "#11"). */
    const role = (c: Shape & { root: string }) =>
      chordTones({ extensions: [], alterations: [], ...c }).find((x) => chroma(x.note) === tc)?.degree ?? "?";
    const landing = chordTones(next).find((x) => chroma(x.note) === tc);
    const learn: OneNoteOnTopLearn = {
      heldNote: T,
      fromMelody: tune.melody.length > 0,
      original: symbol(chord),
      target: symbol(next),
      heldIn: chordTones(chord).find((x) => chroma(x.note) === tc)?.degree ?? null,
      basses,
      targetBass: target,
      walkChords: walk.map(symbol),
      roles: walk.map(role),
      landing: landing?.degree ?? null,
    };

    return {
      title: "One note on top",
      level: 4,
      category: "chromatic",
      styleTags: ["bill-evans", "pedal", "ballad", "modern"],
      chords,
      facts: { heldNote: T, fromMelody: tune.melody.length > 0, bassWalk: [...basses, target], roles: walk.map(role), target: ps(next), learn },
      // the words come from the lesson (learn/lessons/rules.ts), in buildMove
    };
  },
};
