import { generateMoves } from "../engine";
import { playableKey, simplifyNote, transpose } from "../pitch";

/** An interval name above the tonic, as `transpose()` takes it. */
type Degree = "1" | "2" | "4" | "5" | "6";
import { RULES } from "../ruleset";
import type { ChordEvent, HarmonicFunction, Quality, ReharmMove, Tune } from "../types";
import { basicsLesson } from "./index";
import type { Lesson } from "./lesson";
import { lessonForMove } from "./ruleLesson";

// Imports the engine, so this file stays OFF the `learn/index` barrel (the package root exports it):
// the engine's side must never pull in `learn/index`, or the two would import each other.

interface CanonicalChord {
  /** Root as an interval above the tonic ("1" is the tonic itself). */
  degree: Degree;
  quality: Quality;
  roman: string;
  func: HarmonicFunction;
  alterations?: string[];
}

export interface CanonicalProgression {
  mode: "major" | "minor";
  /** One bar each, in order. */
  chords: CanonicalChord[];
}

const ch = (degree: Degree, quality: Quality, roman: string, func: HarmonicFunction, alterations: string[] = []): CanonicalChord => ({
  degree,
  quality,
  roman,
  func,
  alterations,
});

const V_I: CanonicalProgression = { mode: "major", chords: [ch("5", "7", "V7", "D"), ch("1", "maj7", "Imaj7", "T")] };
const II_V_I: CanonicalProgression = { mode: "major", chords: [ch("2", "m7", "iim7", "PD"), ch("5", "7", "V7", "D"), ch("1", "maj7", "Imaj7", "T")] };

/**
 * The one table of canonical progressions: for each rule, the smallest progression in any key
 * where it fires as its textbook self. Coach's concept drills and the Learn stage both read it.
 */
export const CANONICAL_PROGRESSIONS: Readonly<Record<string, CanonicalProgression>> = {
  // IV → I, not V → I: in front of a chord that isn't already the V, the rule gives the FULL ii–V
  // (Fmaj7 becomes Dm9 → G7♭9 into Cmaj7), not just the related ii in front of an existing G7
  "functional.secondaryTwoFive": { mode: "major", chords: [ch("4", "maj7", "IVmaj7", "PD"), ch("1", "maj7", "Imaj7", "T")] },
  "functional.secondaryDominant": { mode: "major", chords: [ch("6", "m7", "vim7", "T"), ch("2", "m7", "iim7", "PD")] },
  "dominant.tritoneSub": V_I,
  "voicing.upperStructureBVI": { mode: "minor", chords: [ch("5", "7", "V7", "D", ["b13"]), ch("1", "m6", "im6", "T")] },
  "gospel.halfStepTurnaround": V_I,
  "voicing.rootlessTwoFiveOne": II_V_I,
  "voicing.upperStructureII": V_I,
  "modal.backdoorTwoFive": V_I,
  "dominant.mediantDominant": V_I,
  "modal.flatSixFlatSeven": V_I,
  "modal.borrowedIv": { mode: "major", chords: [ch("4", "maj7", "IVmaj7", "PD"), ch("1", "maj7", "Imaj7", "T")] },
  "chromatic.passingDiminished": { mode: "major", chords: [ch("1", "maj7", "Imaj7", "T"), ch("2", "m7", "iim7", "PD")] },
  "chromatic.commonToneDiminished": {
    mode: "major",
    chords: [ch("5", "7", "V7", "D"), ch("1", "maj7", "Imaj7", "T"), ch("4", "maj7", "IVmaj7", "PD")],
  },
  "symmetric.coltraneSubstitution": II_V_I,
  "chromatic.constantStructure": V_I,
  "chromatic.minorLineCliche": { mode: "minor", chords: [ch("1", "m7", "im7", "T"), ch("4", "m7", "ivm7", "PD")] },
  "melody.oneNoteOnTop": V_I,
};

/** The rule's canonical progression as a changes-only chart in `tonic` (engine spelling, e.g. "Bb"); null for an unknown rule. */
export function canonicalTune(ruleId: string, tonic: string): Tune | null {
  const prog = CANONICAL_PROGRESSIONS[ruleId];
  const rule = RULES.find((r) => r.id === ruleId);
  if (!prog || !rule) return null;
  // a minor progression in D♭ or G♭ is charted in C♯ or F♯ minor: 8 and 9 flats aren't a key anyone reads in
  const T = prog.mode === "minor" ? playableKey(simplifyNote(tonic), "minor") : simplifyNote(tonic);
  const harmony: ChordEvent[] = prog.chords.map((c, i) => ({
    id: `c${i + 1}`,
    at: { bar: i + 1, beat: 1 },
    beats: 4,
    root: c.degree === "1" ? T : simplifyNote(transpose(T, c.degree)),
    quality: c.quality,
    extensions: [],
    alterations: c.alterations ?? [],
    analysis: { roman: c.roman, func: c.func },
  }));
  return {
    id: `concept:${rule.id}`,
    title: `${rule.name} (12-Key Concept Drill)`,
    key: { tonic: T, mode: prog.mode },
    meter: [4, 4],
    feel: "swing",
    tempo: 120,
    sections: [{ id: "A", label: "A", startBar: 1, bars: harmony.length }],
    formOrder: ["A"],
    harmony,
    melody: [],
    melodyCoverage: "none",
    source: { kind: "manual", personalUseOnly: true },
  };
}

/**
 * The canonical chart and the rule's own move on it, through the engine (traces are the engine:
 * never a direct `propose()`). `move` is null when the rule doesn't fire there; never another rule's move.
 */
export function canonicalDrill(ruleId: string, tonic: string): { tune: Tune; move: ReharmMove | null } | null {
  const tune = canonicalTune(ruleId, tonic);
  if (!tune) return null;
  const rule = RULES.find((r) => r.id === ruleId)!;
  return { tune, move: generateMoves(tune, [rule]).accepted.find((m) => m.ruleId === ruleId) ?? null };
}

/** The rule's move on its canonical progression in `tonic`, or null. */
export function canonicalMove(ruleId: string, tonic: string): ReharmMove | null {
  return canonicalDrill(ruleId, tonic)?.move ?? null;
}

/** A rule's lesson in any key, read off its canonical move; null for rules without a lesson yet. */
export function canonicalLesson(ruleId: string, tonic: string): Lesson | null {
  const move = canonicalMove(ruleId, tonic);
  return move ? lessonForMove(move) : null;
}

/** Any concept's lesson in a key: a foundation's basics lesson, else a rule's canonical lesson. Feed it to `prereqSummary`'s `lessonFor`. */
export function anyLesson(id: string, tonic: string): Lesson | null {
  return basicsLesson(id, tonic) ?? canonicalLesson(id, tonic);
}
