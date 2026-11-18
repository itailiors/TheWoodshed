import { romanFor } from "../analysis";
import { symbol } from "../chords";
import { chroma, mod, noteName, parseNote, prettyNote, prettySymbol, simplifyNote, transpose } from "../pitch";
import type { Quality } from "../types";

/*
 * "Make the Changes", the first game in the Changes tab: you're on a chord, and you say where
 * it wants to go next. This module is the game's harmony: which chords exist in a key, how
 * they're spelled, which root motions the game teaches (and how it explains them), and which
 * other answers are real jazz moves that just aren't this round's path.
 *
 * v1 is major keys only, Levels 1–3: the landing (V→I), the setup (ii→V), the fourths
 * staircase (the diatonic walk down in fifths, including its one wider step, IV→vii) and the
 * turnaround door (I→vi). Like the rest of theory-core it's pure and deterministic, and it
 * spells every chord the way a chart in that key would (B♭ in F, never A♯).
 */

// ── chords in a key ──

/** A scale degree of the major scale, 1 = the tonic. */
export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DEGREES: readonly Degree[] = [1, 2, 3, 4, 5, 6, 7];

/** A chord as a function in the key, before it's given a key. */
export interface DegreeChord {
  degree: Degree;
  quality: Quality;
}

/** The diatonic seventh chords of a major key: Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7. */
export const DIATONIC_MAJOR: readonly DegreeChord[] = [
  { degree: 1, quality: "maj7" },
  { degree: 2, quality: "m7" },
  { degree: 3, quality: "m7" },
  { degree: 4, quality: "maj7" },
  { degree: 5, quality: "7" },
  { degree: 6, quality: "m7" },
  { degree: 7, quality: "m7b5" },
];

const MAJOR_INTERVALS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** The keys v1 plays in: natural and flat-side jazz keys, so every spelling is plain. */
export const V1_KEYS = ["C", "F", "Bb", "Eb", "G"] as const;

/** A chord spelled in a key: what the player sees and hears. */
export interface SpelledChord {
  /** Its degree in the key, or null for a chord from outside it (a tritone sub, a backdoor ♭VII7…). */
  degree: Degree | null;
  quality: Quality;
  /** The root as the key spells it: "Bb" in F, "F#" in G. */
  root: string;
  /** Pitch class of the root, 0–11 (what an answer is judged on). */
  pc: number;
  /** Roman numeral in the key, from the engine's own analysis: "ii7", "V7", "viiø7", "bII7". */
  numeral: string;
  /** Chord symbol in the engine's text form ("Bbmaj7"); prettySymbol() it for display. */
  symbol: string;
}

/**
 * Spell a chord with this root and quality in a key. Roots are simplified the way charts write
 * them (a tritone sub in D♭ is D7, not E𝄫7) unless `exact`: a key's own notes and the raised
 * tonic of ♯i°7 keep their letter (C♭ in G♭ major, E♯°7 in E), since the key says so.
 */
export function spellChord(root: string, quality: Quality, tonic: string, degree: Degree | null, exact = false): SpelledChord {
  const r = exact ? root : simplifyNote(root);
  return {
    degree,
    quality,
    root: r,
    pc: chroma(r),
    numeral: romanFor({ root: r, quality }, tonic).roman,
    symbol: symbol({ root: r, quality, extensions: [], alterations: [] }),
  };
}

/** The diatonic chord on a degree of a major key, spelled for that key. */
export function spellInKey(tonic: string, degree: Degree): SpelledChord {
  const { quality } = DIATONIC_MAJOR[degree - 1];
  return spellChord(transpose(tonic, MAJOR_INTERVALS[degree - 1]), quality, tonic, degree, true);
}

/** All seven diatonic chords of a major key, I to vii. */
export const diatonicChords = (tonic: string): SpelledChord[] => DEGREES.map((d) => spellInKey(tonic, d));

/** Rising semitones from one root to the next, 0–11. Down a fifth and up a fourth are both 5. */
export const semitonesUp = (from: { pc: number }, to: { pc: number }) => mod(to.pc - from.pc, 12);

// ── the motions the game teaches ──

export type EarMotionId = "landing" | "setup" | "staircase" | "door";

/** How the road draws a step: an even fifths "stair", the wider hop (IV→vii), or the turnaround door. */
export type StepKind = "fifth" | "tritoneHop" | "door";

/** Which degree the diatonic walk goes to next: down a fifth, staying in the key (I→IV→vii→iii→vi→ii→V→I). */
export const walkNext = (d: Degree): Degree => (mod(d - 1 + 3, 7) + 1) as Degree;

/**
 * What a step from one degree to another is, in the game's terms, or null if it isn't one the
 * game teaches. V→I is the landing and ii→V the setup, even though both are also walk steps.
 */
export function motionFor(from: Degree, to: Degree): EarMotionId | null {
  if (from === 5 && to === 1) return "landing";
  if (from === 2 && to === 5) return "setup";
  if (from === 1 && to === 6) return "door";
  if (walkNext(from) === to) return "staircase";
  return null;
}

/** The road's drawing for a step between two diatonic chords. */
export function stepKind(from: SpelledChord, to: SpelledChord): StepKind {
  if (from.degree === 1 && to.degree === 6) return "door";
  return semitonesUp(from, to) === 6 ? "tritoneHop" : "fifth";
}

/** A step being explained: the key, where you are, where it goes. */
export interface StepCtx {
  tonic: string;
  from: SpelledChord;
  to: SpelledChord;
}

const ps = (c: SpelledChord) => prettySymbol(c.symbol);
const pn = prettyNote;

export interface MotionRule {
  id: EarMotionId;
  /** The mental model, as the teacher says it: "the landing". */
  model: string;
  /** How hard the chord asks for this next root, 1–5 (5: V7→I, nearly required). */
  pull: 1 | 2 | 3 | 4 | 5;
  /** Guided-stage preview on the option card. Leads with chord names, numerals after. */
  hint: (s: StepCtx) => string;
  /** After a right answer. */
  right: (s: StepCtx) => string;
  /** After a wrong one: why the pull goes to the expected root. */
  wrong: (s: StepCtx) => string;
  /** Behind "why?": the voice leading, in two or three short sentences. */
  why: (s: StepCtx) => string;
}

export const MOTIONS: Record<EarMotionId, MotionRule> = {
  landing: {
    id: "landing",
    model: "the landing",
    pull: 5,
    hint: (s) => `${ps(s.to)}, home: ${ps(s.from)} is full of tension and wants to land here.`,
    right: (s) => `Landed it. ${ps(s.from)} to ${ps(s.to)}, the V coming home.`,
    wrong: (s) => `From ${ps(s.from)} the pull goes home to ${pn(s.to.root)}. That's the landing.`,
    why: (s) =>
      `${ps(s.from)} is the V of ${pn(s.tonic)}. Its 3rd steps up a half step to the root of ${ps(s.to)}, and its 7th steps down to the 3rd. ` +
      `That pair of half steps is the pull you hear.`,
  },
  setup: {
    id: "setup",
    model: "the setup",
    pull: 4,
    hint: (s) => `${ps(s.to)}, the V: the tension that wants to land on ${pn(s.tonic)}.`,
    right: (s) => `That's the setup. ${ps(s.from)} to ${ps(s.to)}, the ii walking to the V.`,
    wrong: (s) => `From ${ps(s.from)} the pull goes to ${pn(s.to.root)}, the V. Down a fifth, and the 7th slides down to the 3rd.`,
    why: (s) =>
      `${ps(s.from)} is the ii of ${pn(s.tonic)}: it walks you to the edge, and ${ps(s.to)} leans over it. ` +
      `The roots drop a fifth, and the 7th of ${ps(s.from)} slides down a half step to become the 3rd of ${ps(s.to)}.`,
  },
  staircase: {
    id: "staircase",
    model: "the fourths staircase",
    pull: 3,
    hint: (s) =>
      semitonesUp(s.from, s.to) === 6
        ? `${ps(s.to)}: down a fifth, but stay in the key. It's the one wider step.`
        : `${ps(s.to)}: one more stair down in fifths.`,
    right: (s) =>
      semitonesUp(s.from, s.to) === 6
        ? `Right: ${pn(s.to.root)}, the wider step that keeps you in ${pn(s.tonic)}.`
        : `Down the stairs: ${ps(s.from)} to ${ps(s.to)}.`,
    wrong: (s) =>
      semitonesUp(s.from, s.to) === 6
        ? `Down a fifth, but stay in the key: from ${pn(s.from.root)} it's ${pn(s.to.root)}, the one wider step.`
        : `The staircase goes down a fifth: from ${pn(s.from.root)} that's ${pn(s.to.root)}.`,
    why: (s) =>
      `Keep stepping down a fifth (the same as up a fourth) and you walk through every chord in ${pn(s.tonic)}. ` +
      `Once, from IV to vii, a perfect fifth down would leave the key, so the in-key note is a half step wider. That keeps you home.`,
  },
  door: {
    id: "door",
    model: "the turnaround door",
    pull: 2,
    hint: (s) => `${ps(s.to)}, the vi: step out the door to start the loop back home.`,
    right: (s) => `Out the door: ${ps(s.from)} to ${ps(s.to)}. Now it's ii, V and home.`,
    wrong: (s) => `From home, the turnaround steps out to ${ps(s.to)}, the vi. Then ii, V and back.`,
    why: (s) =>
      `${ps(s.to)} shares three notes with ${ps(s.from)}, so leaving home this way is soft. ` +
      `From the vi the staircase takes over: vi, ii, V, I.`,
  },
};

// ── answers that are real moves, just not this round's path ──

export type AltMotionId = "tritoneSub" | "backdoor" | "passingDim";

export interface AltRule {
  id: AltMotionId;
  /** The degrees it can be played from (and only these). */
  from: readonly Degree[];
  /** The chord it means, spelled in the key (flat side: D♭7 in C, never C♯7). */
  spell: (tonic: string, from: SpelledChord) => SpelledChord;
  /** The "that works" line. The game adds what this round's path does instead. */
  line: (tonic: string, played: SpelledChord) => string;
}

/** The note a half step above the tonic, spelled as a raised tonic (C♯ in C, B in B♭), as in ♯i°7. */
const raisedTonic = (tonic: string) => {
  const t = parseNote(tonic);
  return noteName({ letter: t.letter, alter: t.alter + 1 });
};

export const ALTS: Record<AltMotionId, AltRule> = {
  tritoneSub: {
    id: "tritoneSub",
    // instead of V (from ii) or on the way home from V: ♭II7 shares V7's tritone and slides down into I
    from: [2, 5],
    spell: (tonic) => spellChord(transpose(tonic, "b2"), "7", tonic, null),
    line: (_, p) => `A real jazz move: ${ps(p)} is the tritone sub, sliding down a half step into home.`,
  },
  backdoor: {
    id: "backdoor",
    // Only from IV (the IV–iv–♭VII7–I side door), never from V7. IV down a perfect fifth is
    // always ♭VII, so this is also the "fifth down that leaves the key" answer at the staircase's
    // wider step (D♭ instead of D in E♭): one root, one rule, and the line says both.
    from: [4],
    spell: (tonic) => spellChord(transpose(tonic, "b7"), "7", tonic, null),
    line: (tonic, p) =>
      `A real jazz move: a perfect fifth down to ${ps(p)}, the backdoor that slips into ${pn(tonic)} from a whole step below. ` +
      `It steps outside the key for a moment, though.`,
  },
  passingDim: {
    id: "passingDim",
    // from home, a diminished chord a half step up climbs chromatically to ii
    from: [1],
    spell: (tonic) => spellChord(raisedTonic(tonic), "dim7", tonic, null, true),
    line: (_, p) => `A real jazz move: ${ps(p)} is a passing diminished, a stepping stone up to the ii.`,
  },
};

/** The alternative moves that can be played from a chord, each spelled in the key. */
export function altsFrom(tonic: string, from: SpelledChord): { id: AltMotionId; chord: SpelledChord }[] {
  if (from.degree === null) return [];
  return Object.values(ALTS)
    .filter((a) => a.from.includes(from.degree!))
    .map((a) => ({ id: a.id, chord: a.spell(tonic, from) }));
}

// ── levels ──

export type LevelId = 1 | 2 | 3;

export interface Level {
  id: LevelId;
  name: string;
  /** The motions its rounds are built from. */
  motions: readonly EarMotionId[];
  keys: readonly (typeof V1_KEYS)[number][];
  /** At the Open stage, naming the function (ii / V / I…) is asked for too. */
  asksFunction: boolean;
  /** What mastering it takes, in plain words (the summary card shows this). */
  mastery: string;
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: "The Landing",
    motions: ["landing"],
    keys: ["C", "F"],
    asksFunction: false,
    mastery: "10 right in a row at Open, in both C and F.",
  },
  {
    id: 2,
    name: "The Setup",
    motions: ["landing", "setup"],
    keys: ["C", "F", "Bb"],
    asksFunction: true,
    mastery: "10 right in a row at Open with the function named, in all three keys.",
  },
  {
    id: 3,
    name: "The Staircase",
    motions: ["landing", "setup", "staircase", "door"],
    keys: ["C", "F", "Bb", "Eb", "G"],
    asksFunction: true,
    mastery: "Two clean walks home from vii or iii, wider step included, in two keys, and one clean turnaround.",
  },
];

// ── passport names ──

/** How each motion is stored in the practice history: `ear:<motion>`, a concept per key, like a reharm rule. */
export const earRuleId = (m: EarMotionId) => `ear:${m}`;
export const isEarRuleId = (ruleId: string) => ruleId.startsWith("ear:");
export const motionOfRuleId = (ruleId: string): EarMotionId | null => {
  const m = ruleId.slice(4);
  return isEarRuleId(ruleId) && m in MOTIONS ? (m as EarMotionId) : null;
};

/** Passport and summary names for the motions. */
export const EAR_MOTION_NAME: Record<EarMotionId, string> = {
  landing: "The landing (V → I)",
  setup: "The setup (ii → V)",
  staircase: "The fourths staircase",
  door: "The turnaround door (I → vi)",
};
