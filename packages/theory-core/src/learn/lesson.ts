import { prettyNote, prettySymbol, simplifyNote } from "../pitch";
import type { VoiceMotion } from "../types";

/*
 * A lesson: a headline on the card, then one idea per step, then the rule. A step names real
 * notes, lights at most 4 keys, and says what to hear. Text is display-ready (♭, ♯); notes
 * in `highlight` and `ask` are engine-spelled, for the keyboard and the note bus.
 */

export type PlayCue = "interval" | "before" | "after" | "ab";

export interface Highlight {
  /** Engine spelling ("Fb"); the keyboard lights its key. */
  note: string;
  /** Written on the key. */
  label: string;
  /**
   * Which way this key lies from the key before it in the list, when the text says so ("F falls
   * to E": E is "down" from F). Unset: the nearest octave. The keyboard places it accordingly.
   */
  dir?: "up" | "down";
}

export interface LessonStep {
  text: string;
  highlight: Highlight[];
  play?: PlayCue;
  /**
   * Basics have no "original", so a step's ▶ plays these chords in order instead of a cue: each
   * inner list is one chord, engine-spelled pitch classes from `transpose()`/`chordTones()`.
   */
  sound?: string[][];
  /** Predict, then reveal: tap these keys (any octave, any spelling of the same key). */
  ask?: { kind: "tapNotes"; prompt: string; answer: string[] };
  /** The one new term this step introduces (a glossary term, used in `text`). */
  term?: string;
  /** "Learn that first": the concept this step leans on. */
  prereqLink?: string;
}

export interface Lesson {
  conceptId: string;
  headline: string;
  steps: LessonStep[];
  /** One imperative sentence that works in any key. */
  rule: string;
  /** Optional last item: the deeper fact. */
  deeper?: string;
}

// ── formatting helpers (no harmony here: notes come in already computed) ──

export const pn = prettyNote;
export const ps = (sym: string) => prettySymbol(sym);

/** "F♭ (same key as E)" the first time a key shows up under a second spelling. */
export const twin = (spelled: string, other: string) => (pn(spelled) === pn(other) ? pn(spelled) : `${pn(spelled)} (same key as ${pn(other)})`);

const DEGREE_WORD: Record<string, string> = {
  "1": "root",
  b3: "3rd",
  "3": "3rd",
  "4": "sus 4th",
  b5: "♭5",
  "5": "5th",
  "6": "6th",
  b7: "7th",
  "7": "7th",
  "9": "9th",
  b9: "♭9",
  "#9": "♯9",
  "11": "11th",
  "#11": "♯11",
  b13: "♭13",
  "13": "13th",
};
export const degreeWord = (d: string) => DEGREE_WORD[d] ?? pn(d);

/**
 * A spelling a reader can take in: double flats and sharps become the everyday key name
 * (E♭♭ → D); single accidentals (C♭, E♯) stay, since they are the chord's correct spelling.
 */
export const readable = (n: string) => (/(bb|##|x)$/.test(n) ? simplifyNote(n) : n);

/*
 * Copy never puts "a"/"an" before a note name ("an E♭ triad" reads as "an E-flat" or "a E"):
 * write "the E♭ triad" or "E♭ in the bass". The copy test enforces it.
 */
export const ARTICLE_BEFORE_NOTE = /(?<!\p{L})[Aa]n? [A-G](?![a-z])/u;

/** "E rises to F", "B♭ falls to A", "B♭ holds". */
export function moves(m: VoiceMotion): string {
  if (m.semitones === 0) return pn(m.from) === pn(m.to) ? `${pn(m.from)} holds` : `${pn(m.from)} holds as ${pn(m.to)}`;
  return `${pn(m.from)} ${m.semitones > 0 ? "rises" : "falls"} to ${pn(m.to)}`;
}

export const hl = (note: string, label: string, dir?: "up" | "down"): Highlight => (dir ? { note, label, dir } : { note, label });

/** The key a motion lands on, placed the way it moves from the key listed just before it. */
export const hlTo = (m: VoiceMotion, label: string): Highlight => hl(m.to, label, m.semitones > 0 ? "up" : m.semitones < 0 ? "down" : undefined);
