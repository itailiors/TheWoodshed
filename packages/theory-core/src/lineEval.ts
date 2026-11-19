import { chordTones } from "./chords";
import { classifyNote } from "./melody";
import { chroma, mod, spellChroma } from "./pitch";
import { suggestScales } from "./scales";
import { absBeat } from "./time";
import type { ChordEvent } from "./types";

export type LineVerdict = "chord-tone" | "tension" | "avoid" | "outside";

export interface LineNoteEval {
  midi: number;
  /** Spelled to fit the chord or its scale. */
  name: string;
  role: string;
  verdict: LineVerdict;
  /** The engine's first-choice scale for this chord, if any. */
  scale?: string;
  inScale: boolean;
}

/** How far (in beats) a note may sit from a beat and still count as on it: a loose 16th, for human timing. */
export const ON_BEAT_TOLERANCE = 0.15;
/** An avoid note shorter than this (in beats) can pass through; held longer, it's heard against the chord. */
export const PASSING_MAX_BEATS = 0.5;

/** A note that starts on a beat (within `ON_BEAT_TOLERANCE`): where a chord tone is expected. */
export const isOnBeat = (beat: number) => Math.abs(beat - Math.round(beat)) <= ON_BEAT_TOLERANCE;

/**
 * A passing tone, not a mistake: an avoid note that is short and off the beat, like the 4th
 * over a major chord on the 'and' between 3 and 5. Only known once the note has ended.
 */
export function isPassingTone(ev: Pick<LineNoteEval, "verdict">, start: number, end: number): boolean {
  return ev.verdict === "avoid" && end - start < PASSING_MAX_BEATS && !isOnBeat(start);
}

/** The chord sounding at an absolute beat. */
export function chordAtBeat(chords: ChordEvent[], beat: number, beatsPerBar: number): { chord: ChordEvent; next?: ChordEvent } | null {
  for (let i = 0; i < chords.length; i++) {
    const s = absBeat(chords[i].at, beatsPerBar);
    if (beat >= s - 1e-6 && beat < s + chords[i].beats - 1e-6) return { chord: chords[i], next: chords[i + 1] };
  }
  return null;
}

/**
 * Judge one note of an improvised line against the chord under it:
 * chord tone, available tension (in the engine's scale), avoid note,
 * or outside (chromatic, fine as a passing or approach note).
 */
export function evaluateLineNote(midi: number, chord: ChordEvent, next?: ChordEvent, melody: string[] = []): LineNoteEval {
  const c = mod(midi, 12);
  const scales = suggestScales(chord, next, melody);
  const top = scales[0];
  const name =
    chordTones(chord).find((t) => chroma(t.note) === c)?.note ??
    top?.notes.find((n) => chroma(n) === c) ??
    spellChroma(c);
  const cls = classifyNote({ ...chord, display: undefined }, name);
  const inScale = !!top && top.notes.some((n) => chroma(n) === c);
  const verdict: LineVerdict =
    cls.verdict === "chord-tone" ? "chord-tone" : cls.verdict === "avoid" ? "avoid" : inScale ? "tension" : "outside";
  return { midi, name, role: cls.role, verdict, scale: top?.name, inScale };
}
