import { chordTones, guideTones, type ChordTone } from "./chords";
import { chroma, parseNote, pitchClass, simplifyNote, transpose } from "./pitch";
import { suggestScales, type ScaleSuggestion } from "./scales";
import { eventSpan, melodyIn } from "./time";
import type { ChordEvent, Tune, VoiceMotion } from "./types";
import { nearestMotion } from "./voiceLeading";

export interface ImprovEntry {
  chord: ChordEvent;
  next?: ChordEvent;
  scales: ScaleSuggestion[];
  guideTones: ChordTone[];
  /** Where each guide tone should land on the next chord. */
  targets: VoiceMotion[];
}

export function improvMap(tune: Tune, chords: ChordEvent[]): ImprovEntry[] {
  const bpb = tune.meter[0];
  return chords.map((chord, i) => {
    const next = chords[i + 1];
    const [s, e] = eventSpan(chord, bpb);
    const mel = melodyIn(tune, s, e).map((n) => pitchClass(n.pitch));
    const gts = guideTones(chord);
    return {
      chord,
      next,
      scales: suggestScales(chord, next, mel),
      guideTones: gts,
      targets: next ? gts.map((g) => nearestMotion(g.note, chordTones(next))) : [],
    };
  });
}

// ── Improv lenses: what Improv mode marks on the keys for one chord ──

/**
 * - `full`: the engine's first-choice scale, chord tones vs colour tensions vs avoid notes.
 * - `guide`: the 3rd and 7th only, the guide-tone line.
 * - `simple`: the chord tones (1-3-5-7 or 6), an arpeggio. No extensions.
 * - `blues`: one blues scale on the key's tonic for the whole tune; the chord's guide tones ringed
 *   so the ♭3-against-3 rub shows.
 */
export type ImprovLens = "full" | "guide" | "simple" | "blues";
export const IMPROV_LENSES: { id: ImprovLens; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "guide", label: "Guide tones" },
  { id: "simple", label: "Simple" },
  { id: "blues", label: "Blues" },
];

/** One marked pitch class. `fill: null` is ring-only (a guide tone that isn't in the blues scale). */
export interface LensKey {
  note: string;
  fill: "chord" | "tension" | "avoid" | "blue" | null;
  /** A guide tone (3rd or 7th) of the chord. */
  ring: boolean;
}

export interface LensView {
  /** What the keys show, e.g. "G Dorian", "Guide tones", "F blues". */
  title: string;
  keys: LensKey[];
}

/** The six-note blues scale (1 ♭3 4 ♯4 5 ♭7) on a tonic; the same for a minor-key blues. */
export function bluesScale(tonic: string): string[] {
  return ["1", "b3", "4", "#4", "5", "b7"].map((d) => {
    const n = transpose(pitchClass(tonic), d);
    return Math.abs(parseNote(n).alter) >= 2 ? simplifyNote(n) : n;
  });
}

const BASIC_DEGREES = new Set(["1", "3", "b3", "4", "5", "b5", "#5", "6", "7", "b7", "bb7"]);

export function improvLens(entry: ImprovEntry, lens: ImprovLens, keyTonic: string): LensView {
  const guide = new Set(entry.guideTones.map((g) => chroma(g.note)));
  const tones = chordTones(entry.chord);
  const toneSet = new Set(tones.map((t) => chroma(t.note)));
  const isGuide = (n: string) => guide.has(chroma(n));
  const basic = () => tones.filter((t) => BASIC_DEGREES.has(t.degree)).map((t): LensKey => ({ note: t.note, fill: "chord", ring: isGuide(t.note) }));

  switch (lens) {
    case "guide":
      return { title: "Guide tones", keys: entry.guideTones.map((g) => ({ note: g.note, fill: "chord", ring: true })) };
    case "simple":
      return { title: "Chord tones", keys: basic() };
    case "blues": {
      const scale = bluesScale(keyTonic);
      const inScale = new Set(scale.map(chroma));
      const keys: LensKey[] = scale.map((n) => ({ note: n, fill: "blue", ring: isGuide(n) }));
      for (const g of entry.guideTones) if (!inScale.has(chroma(g.note))) keys.push({ note: g.note, fill: null, ring: true });
      return { title: `${pitchClass(keyTonic)} blues`, keys };
    }
    case "full": {
      const top = entry.scales[0];
      if (!top) return { title: "Chord tones", keys: basic() };
      const avoid = new Set(top.avoid.map(chroma));
      return {
        title: top.name,
        keys: top.notes.map((n) => ({
          note: n,
          fill: toneSet.has(chroma(n)) ? "chord" : avoid.has(chroma(n)) ? "avoid" : "tension",
          ring: isGuide(n),
        })),
      };
    }
  }
}
