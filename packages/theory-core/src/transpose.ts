import { chroma, letterIndex, midiOf, mod, parseNote, pitchClass, simplifyNote, spellMidi, transpose, type Interval } from "./pitch";
import type { ChordEvent, Tune } from "./types";

/** The twelve keys as a jazz chart spells them (flat side preferred, Gb over F#). */
export const KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Spelled interval from one key centre to another (letter steps + semitones, upward). */
export function intervalBetween(from: string, to: string): Interval {
  return { steps: mod(letterIndex(to) - letterIndex(from), 7), semis: mod(chroma(to) - chroma(from), 12) };
}

/** Transpose a note name, respelling only double accidentals. */
export function transposeName(n: string, iv: Interval): string {
  const out = transpose(n, iv);
  return Math.abs(parseNote(out).alter) >= 2 ? simplifyNote(out) : out;
}

function transposeChord(c: ChordEvent, iv: Interval): ChordEvent {
  return {
    ...c,
    root: transposeName(c.root, iv),
    bass: c.bass ? transposeName(c.bass, iv) : undefined,
    display: c.display?.replace(/[A-G][b#]*/g, (n) => transposeName(n, iv)),
  };
}

/**
 * Move a whole tune to another key. Because every rule in the engine works on
 * intervals and functions, running generateMoves on the result gives the same moves,
 * now with spelled pitches in the new key.
 */
export function transposeTune(tune: Tune, toTonic: string): Tune {
  const iv = intervalBetween(tune.key.tonic, toTonic);
  // keep the melody in roughly the same register: up to a tritone up, otherwise down
  const shift = iv.semis > 6 ? iv.semis - 12 : iv.semis;
  return {
    ...tune,
    id: toTonic === tune.key.tonic ? tune.id : `${tune.id}@${toTonic}`,
    key: { ...tune.key, tonic: toTonic },
    harmony: tune.harmony.map((c) => transposeChord(c, iv)),
    melody: tune.melody.map((n) => {
      const pc = transposeName(pitchClass(n.pitch), iv);
      return { ...n, pitch: spellMidi(pc, midiOf(n.pitch) + shift) };
    }),
  };
}

/** A random key different from `current`. */
export function randomKey(current: string, rand: () => number = Math.random): string {
  const pool = KEYS.filter((k) => chroma(k) !== chroma(current));
  return pool[Math.floor(rand() * pool.length)];
}
