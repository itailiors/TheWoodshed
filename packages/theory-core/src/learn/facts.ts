import type { VoiceMotion } from "../types";

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
