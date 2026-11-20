import type { VoiceMotion } from "../types";
import type { PathStop } from "../voiceLeading";

/*
 * What a rule hands its lesson: `Proposal.facts.learn`. Notes are engine-spelled ("Bb", "Fb"),
 * chord symbols are `symbol()` output ("Gb9"), and every motion is the engine's own
 * `nearestMotion`. Lessons only format these; they never work out a note themselves
 * (rule 7: traces are the engine, and so are lessons). The "lessons-honest" proof checks it.
 */

/** A voice followed through a chord list: its start, then one motion per chord. */
export interface VoicePath {
  from: string;
  motions: VoiceMotion[];
}

export interface TritoneSubLearn {
  original: string;
  sub: string;
  target: string;
  originalRoot: string;
  subRoot: string;
  targetRoot: string;
  /** The original's 3rd and ♭7. */
  guideTones: [string, string];
  /** The sub's 3rd and ♭7: the same two keys, roles swapped, maybe respelled. */
  subGuideTones: [string, string];
  /** The original's 3rd and ♭7 moving into the target. */
  resolution: [VoiceMotion, VoiceMotion];
  /** The sub's 5th and 9th: the ♭9 and ♭13 of the original. */
  subFifth: string;
  subNinth: string;
  parentMelodicMinor: string;
}

export interface SecondaryDominantLearn {
  original: string;
  dominant: string;
  target: string;
  root: string;
  targetRoot: string;
  targetMinor: boolean;
  /** The dominant's 3rd (the leading tone of the target) and ♭7. */
  third: string;
  seventh: string;
  /** The original's minor 3rd raised to the leading tone, when it had one. */
  raised?: [string, string];
  /** How the ♭7 got there: a major 7th flattened, already there, or added. */
  seventhChange: "lowered" | "kept" | "added";
  lowered?: [string, string];
  /** The 3rd and ♭7 moving into the target. */
  resolution: [VoiceMotion, VoiceMotion];
  /** The ♭9 a minor target takes. */
  flatNine?: string;
}

export interface SecondaryTwoFiveLearn {
  original: string;
  ii: string;
  V: string;
  target: string;
  iiRoot: string;
  VRoot: string;
  targetRoot: string;
  targetMinor: boolean;
  /** The original was already the V: only the ii is new. */
  related: boolean;
  /** The ii's 3rd and 7th, followed through the V into the target. */
  iiThird: VoicePath;
  iiSeventh: VoicePath;
  /** The V's ♭9 and the target's 5th, a half step below it. */
  flatNine: [string, string];
}

export interface BorrowedIvLearn {
  IV: string;
  iv: string;
  target: string;
  root: string;
  targetRoot: string;
  /** The IV is kept for its first half, then turns minor. */
  kept: boolean;
  /** 6 → ♭6 → 5 of the home key: IV's 3rd, its lowered 3rd, the target's 5th. */
  line: [string, string, string];
}

export interface BackdoorLearn {
  original: string;
  target: string;
  iv: string | null;
  bVII: string;
  targetRoot: string;
  bVIIRoot: string;
  /** The original dominant's 3rd, which the backdoor leaves out. */
  leadingTone: string;
  /** ♭VII7's ♭7 and the target's 5th, a half step below it. */
  bVIISeventh: string;
  targetFifth: string;
  /** ♭VII7's 9th: the target's root, already sounding. */
  bVIINinth: string;
}

export interface ColtraneLearn {
  ii: string;
  V: string;
  target: string;
  targetRoot: string;
  /** ♭VI, III and I of the target: three key centres a major 3rd apart, in the order they're toured. */
  centres: [string, string, string];
  /** The chords that land on them: ♭VImaj7, IIImaj7 and the target. */
  centreChords: [string, string, string];
  /** Each centre's own V7, in the same order. */
  dominants: [string, string, string];
  dominantRoots: [string, string, string];
  /**
   * The ii's 3rd followed by nearest motion through the tour into the target, runs of holds
   * collapsed (F, E♭ held as D♯, D, C in C). A single descending voice, not a guide-tone line.
   */
  line: PathStop[];
}

export interface ConstantStructureLearn {
  /** The chart's chord, which keeps the downbeat. */
  from: string;
  target: string;
  targetRoot: string;
  /** The target's shape a whole step (when there's room) and a half step above it. */
  planed: string[];
  /** Their roots, then the target's: D, D♭, C. */
  planedRoots: string[];
  /** The target's tones, and the same shape a half step above (double accidentals respelled). */
  shapeTones: string[];
  approachTones: string[];
  /** The half-step shape's 3rd and 7th (or sus 4th and 7th). */
  approachGuide: [string, string];
  /** Voice k of the half-step shape sliding into voice k of the target (all −1). */
  slide: VoiceMotion[];
  /** Which voices a 4-key keyboard lights, as indices into the three lists above (all of them up to 4). */
  lit: number[];
}

export interface MediantDominantLearn {
  original: string;
  /** III7(♭9), and the same root as a plain dominant 7th ("E7"). */
  sub: string;
  subPlain: string;
  target: string;
  originalRoot: string;
  subRoot: string;
  targetRoot: string;
  /** The diminished 7th a half step below the target: the original V7(♭9) without its root (B D F A♭ in C). */
  dim: [string, string, string, string];
  /** III7(♭9)'s 3rd, 5th, ♭7 and ♭9, double accidentals respelled (G♯ B D F in C). */
  subTones: [string, string, string, string];
  /** For each of `subTones`, the key of `dim` it shares (A♭ for G♯): equal chroma, maybe another spelling. */
  dimTwins: [string, string, string, string];
  /** III7's 3rd and ♭7 moving into the target (half step to its 5th, whole step to its root). */
  resolution: [VoiceMotion, VoiceMotion];
  /** The four dominants that share the diminished 7th once they take the ♭9: V7, ♭VII7, ♭II7, III7. */
  family: [string, string, string, string];
  familyRoots: [string, string, string, string];
  /** III7's usual home, vi, which the ear expects instead of the major target. */
  relativeMinor: string;
  relativeMinorChord: string;
}

export interface GospelTurnaroundLearn {
  original: string;
  /** IV/V as written ("F/G"), its bass, and the triad over it. */
  sus: string;
  susRoot: string;
  susTriad: [string, string, string];
  approach: string;
  approachRoot: string;
  /** The chart's chord, and what the approach's voices actually land on (Cmaj13; F6/9 over a 6 chord). */
  target: string;
  landing: string;
  targetRoot: string;
  /** The approach as a playable grip: root, ♭7, 3rd in the left hand; 9th, ♯11, 13th (a major triad) on top. */
  grip: { lh: [string, string, string]; rh: [string, string, string] };
  /** Each grip voice into the landing, in grip order (left hand, then right hand), by nearest motion. */
  gripMotions: VoiceMotion[];
  /** The approach's voices that hold into the landing. */
  held: string[];
  /** The approach's ♯11: the original dominant's root, kept inside. */
  sharpEleven: string;
  /** The original dominant's 3rd, which the sus leaves out. */
  leadingTone: string;
}

export interface PassingDiminishedLearn {
  from: string;
  dim: string;
  target: string;
  fromRoot: string;
  dimRoot: string;
  targetRoot: string;
  ascending: boolean;
  /** The °7's tones for display (`dimTones`): E♭ G♭ A C, never B♭♭ or D♭♭. */
  dimTones: string[];
  /** Ascending: the target's V, its 7(♭9) and plain 7th symbols, and each dim tone's degree in that V7(♭9). */
  impliedV: string;
  impliedV7: string;
  impliedVPlain: string;
  roles: string[];
  /** Each dim tone into the target, by nearest motion. */
  motions: VoiceMotion[];
  /**
   * Ascending, the dominant's pull: its 3rd (the bass, the leading tone) up to the target's root,
   * its ♭9 down to the target's 5th. Named, not nearest: C♯ is as near to C as to D in Dm7.
   */
  pull: [VoiceMotion, VoiceMotion] | null;
  /** The target's tones the °7 already holds (target spelling), with their degree in the target. */
  shared: { note: string; degree: string }[];
  /** The motions of the dim tones the target doesn't hold. */
  moving: VoiceMotion[];
}

export interface CommonToneDiminishedLearn {
  chord: string;
  dim: string;
  root: string;
  /** Root, the two leaning tones spelled as they rise (♯2, ♯4), and the 6th: C D♯ F♯ A. */
  dimTones: [string, string, string, string];
  /** The leaning tones rising a half step into the 3rd and 5th. */
  leans: [VoiceMotion, VoiceMotion];
  /** The °7's tones already in the chord: its root, and the 6th over a 6 chord. */
  shared: string[];
  /** The chord has its root in the bass (not a slash chord), so the bass holds through the move. */
  bassStays: boolean;
}

export interface MinorLineClicheLearn {
  chord: string;
  root: string;
  third: string;
  fifth: string;
  /** The root voice walking down: 1, 7, ♭7, 6. */
  line: [string, string, string, string];
  /** The four stops, named without the added 9th: Cm, Cm(maj7), Cm7, Cm6. */
  stops: [string, string, string, string];
}

export interface OneNoteOnTopLearn {
  heldNote: string;
  fromMelody: boolean;
  original: string;
  target: string;
  /** The held note's degree in the chart's chord (null when the melody holds a note outside it). */
  heldIn: string | null;
  /** The walk's bass notes, then the target's bass. */
  basses: string[];
  targetBass: string;
  walkChords: string[];
  /** The held note's degree in each walk chord, as a code ("4", "#11"). */
  roles: string[];
  /** Its degree in the target, or null when the target doesn't contain it. */
  landing: string | null;
}
