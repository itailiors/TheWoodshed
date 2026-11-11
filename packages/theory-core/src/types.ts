/** Spelled pitch class, e.g. "Bb", "D#", "Cb". Spelling matters for theory text. */
export type PitchName = string;

/** 1-based bar and beat; beat may be fractional (2.5 = the "and" of 2). */
export interface TimePos {
  bar: number;
  beat: number;
}

export type Quality =
  | "maj"
  | "m"
  | "maj7"
  | "6"
  | "7"
  | "m7"
  | "m6"
  | "mMaj7"
  | "m7b5"
  | "dim7"
  | "7sus4"
  | "aug"
  | "maj7#5";

export type HarmonicFunction = "T" | "PD" | "D" | "passing" | "chromatic" | "modal";

export interface ChordEvent {
  id: string;
  at: TimePos;
  beats: number;
  root: PitchName;
  quality: Quality;
  /** Natural extensions: "9", "11", "13". */
  extensions: string[];
  /** Altered tones: "b9", "#9", "#11", "b13", "#5", "b5". */
  alterations: string[];
  bass?: PitchName;
  /** Display override, e.g. "Eb/F" for a IV/V sus chord. */
  display?: string;
  analysis?: { roman: string; func: HarmonicFunction };
}

export interface NoteEvent {
  at: TimePos;
  beats: number;
  /** Spelled pitch with octave, e.g. "Bb4". */
  pitch: string;
}

export interface Section {
  id: string;
  label: string;
  startBar: number;
  bars: number;
}

export interface Tune {
  id: string;
  title: string;
  composer?: string;
  key: { tonic: PitchName; mode: "major" | "minor" };
  meter: [number, number];
  feel: "swing" | "waltz" | "bossa" | "ballad" | "straight8";
  /** Default tempo in quarter-note BPM. */
  tempo: number;
  sections: Section[];
  formOrder: string[];
  harmony: ChordEvent[];
  melody: NoteEvent[];
  /** "anchors" = only structurally important notes were entered. */
  melodyCoverage: "full" | "anchors" | "none";
  source: { kind: "ireal" | "musicxml" | "manual"; personalUseOnly: true };
  /** Who owns the tune, when known: drives the "Original Composition" stamp and the library's notes. */
  rights?: { kind: "original"; holder: string; year: number } | { kind: "public-domain"; note: string };
}

export type MoveCategory =
  | "functional"
  | "dominant-sub"
  | "chromatic"
  | "modal"
  | "symmetric"
  | "gospel"
  | "voicing";

export type Verdict = "chord-tone" | "tension" | "avoid";

export interface MelodyCheck {
  chordId: string;
  chordSymbol: string;
  note: PitchName;
  role: string;
  verdict: Verdict;
  reason?: string;
}

export interface VoiceMotion {
  from: PitchName;
  to: PitchName;
  /** Signed semitones, -6..6. */
  semitones: number;
  toDegree: string;
}

export interface MoveText {
  summary: string;
  theory: string;
  recreateRule: string;
  insight?: string;
}

export interface ReharmMove {
  id: string;
  ruleId: string;
  /** Rule order; used as a stable tie-breaker. */
  priority: number;
  title: string;
  category: MoveCategory;
  level: 1 | 2 | 3 | 4;
  styleTags: string[];
  span: { from: TimePos; to: TimePos };
  /** Absolute beats from the top of the tune: [start, end). */
  spanBeats: { start: number; end: number };
  replaces: string[];
  original: ChordEvent[];
  chords: ChordEvent[];
  /** Symbol of the chord the move resolves into, if any. */
  targetSymbol?: string;
  voicingHint?: { lh: PitchName[]; rh: PitchName[] };
  checks: {
    melody: MelodyCheck[];
    /** False when no melody was entered for this span. */
    melodyVerified: boolean;
    voiceLeadingCost: number;
    score: number;
  };
  voiceLeading: VoiceMotion[];
  facts: Record<string, unknown>;
  text: MoveText;
}

export interface RejectedMove {
  move: ReharmMove;
  reasons: string[];
}
