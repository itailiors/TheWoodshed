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
