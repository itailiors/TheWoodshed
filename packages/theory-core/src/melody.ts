import { ALTERATION_EXCLUDES, chordTones, isDominant, symbol } from "./chords";
import { chroma, intervalName, mod, pitchClass, prettyNote, prettySymbol, transpose } from "./pitch";
import type { ChordEvent, Verdict } from "./types";

const TENSION_NAME: Record<string, string> = {
  b2: "b9",
  "2": "9",
  "#2": "#9",
  "4": "11",
  "#4": "#11",
  b6: "b13",
  "#5": "b13",
  "6": "13",
};

const BY_SEMITONES = ["1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"];

const DEGREE_WORD: Record<string, string> = {
  "1": "root",
  "3": "3rd",
  b3: "♭3rd",
  "5": "5th",
  b5: "♭5th",
  "7": "7th",
  b7: "♭7th",
};

export interface NoteClass {
  role: string;
  verdict: Verdict;
  reason?: string;
}

type ChordLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "display">;

/**
 * Chord tone, available tension, or avoid note?
 * Avoid = a half step above a chord tone (a minor 9th clash), except over a
 * dominant's root (b9) or 5th (b13), plus natural tones an alteration replaces.
 */
export function classifyNote(chord: ChordLike, note: string): NoteClass {
  const pc = pitchClass(note);
  const c = chroma(pc);
  const tones = chordTones(chord);
  const sym = prettySymbol(symbol(chord));

  const hit = tones.find((t) => chroma(t.note) === c);
  if (hit) return { role: hit.degree, verdict: "chord-tone" };

  let raw = intervalName(chord.root, pc);
  // spellings with no simple interval (D over Db = augmented unison) are named by distance
  if (raw.startsWith("?")) raw = BY_SEMITONES[mod(c - chroma(chord.root), 12)];
  let role = TENSION_NAME[raw] ?? raw;
  if (raw === "b3" && tones.some((t) => t.degree === "3")) role = "#9";
  if (raw === "b5") role = "#11";

  for (const alt of chord.alterations) {
    const natural = ALTERATION_EXCLUDES[alt];
    if (natural && chroma(transpose(chord.root, natural)) === c) {
      return {
        role,
        verdict: "avoid",
        reason: `${prettyNote(pc)} is the natural ${natural} — it clashes with the ${prettyNote(alt)} in ${sym}`,
      };
    }
  }

  const below = tones.find((t) => chroma(t.note) === mod(c - 1, 12));
  const dominantException = isDominant(chord.quality) && below && (below.degree === "1" || below.degree === "5");
  if (below && !dominantException) {
    return {
      role,
      verdict: "avoid",
      reason: `${prettyNote(pc)} is the ${prettyNote(role)} of ${sym} — a half step above the ${
        DEGREE_WORD[below.degree] ?? below.degree
      } (${prettyNote(below.note)})`,
    };
  }
  return { role, verdict: "tension" };
}
