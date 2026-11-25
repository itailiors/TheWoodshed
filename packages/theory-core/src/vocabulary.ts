import { chordTones, guideTones, isDominant, isMajorQ, isMinorQ } from "./chords";
import { evaluateLineNote } from "./lineEval";
import { chroma, mod } from "./pitch";
import { suggestScales } from "./scales";
import type { ChordEvent } from "./types";

/**
 * Deterministic Classic Jazz Vocabulary Bank for the Ghost Master.
 * Includes both high-energy bebop/blues vocabulary and singing, lyrical, memorable slow lines
 * for opening trades or slow starts. Every lick is encoded relative to the active chord's root
 * and snapped to the underlying chord quality at each beat of the response window.
 */

export type LickQuality = "major" | "minor" | "dominant";
export type LickEnergy = "dense" | "sparse";

export interface GhostLickStep {
  /** Beat offset from the start of the lick window (normalized to a 4-beat bar, with 0.66 swung "&"s). */
  relBeat: number;
  /** Duration in beats. */
  dur: number;
  /** Semitone offset above the active chord's root pitch class. */
  semitonesFromRoot: number;
  /** True when the note functions as a chromatic approach or bebop enclosure tone. */
  enclosure?: boolean;
  /** Optional expressive target velocity (0..1) for dynamic hairpins on lyrical lines. */
  vel?: number;
  /** Musician-facing description of the note's role inside the lick. */
  role: string;
}

export interface GhostLick {
  id: string;
  title: string;
  master: string;
  qualities: readonly LickQuality[];
  energy: LickEnergy;
  /** True for singing, memorable, slow-start melodic invitations. */
  lyrical?: boolean;
  /** Reference length of the lick in beats (scaled to fit its target window). */
  spanBeats: number;
  steps: readonly GhostLickStep[];
}

export const GHOST_VOCABULARY: readonly GhostLick[] = [
  // ── High-Energy / Dense Swinging Bebop & Blues Vocabulary ───────────────
  {
    id: "parker-bebop-enclosure",
    title: "Bebop 5th-to-3rd Enclosure",
    master: "Charlie Parker",
    qualities: ["dominant", "major"],
    energy: "dense",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.62, semitonesFromRoot: 7, vel: 0.66, role: "5th pickup" },
      { relBeat: 0.66, dur: 0.32, semitonesFromRoot: 8, enclosure: true, vel: 0.52, role: "b6 upper chromatic neighbor" },
      { relBeat: 1.0, dur: 0.62, semitonesFromRoot: 6, enclosure: true, vel: 0.48, role: "#4 lower chromatic neighbor" },
      { relBeat: 1.66, dur: 0.32, semitonesFromRoot: 7, vel: 0.76, role: "swung 5th pivot" },
      { relBeat: 2.0, dur: 0.62, semitonesFromRoot: 5, enclosure: true, vel: 0.5, role: "diatonic 4th above 3rd" },
      { relBeat: 2.66, dur: 0.32, semitonesFromRoot: 3, enclosure: true, vel: 0.54, role: "chromatic #9 below 3rd" },
      { relBeat: 3.0, dur: 0.9, semitonesFromRoot: 4, vel: 0.84, role: "resolved 3rd guide tone" },
    ],
  },
  {
    id: "coltrane-1235",
    title: "1-2-3-5 Digital Cell",
    master: "John Coltrane",
    qualities: ["major", "dominant"],
    energy: "dense",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.62, semitonesFromRoot: 0, vel: 0.62, role: "root (1)" },
      { relBeat: 0.66, dur: 0.32, semitonesFromRoot: 2, vel: 0.74, role: "swung 9th (2)" },
      { relBeat: 1.0, dur: 0.62, semitonesFromRoot: 4, vel: 0.68, role: "3rd (3)" },
      { relBeat: 1.66, dur: 0.32, semitonesFromRoot: 7, vel: 0.78, role: "swung 5th (5)" },
      { relBeat: 2.0, dur: 0.62, semitonesFromRoot: 9, vel: 0.72, role: "13th / 6th" },
      { relBeat: 2.66, dur: 0.32, semitonesFromRoot: 12, vel: 0.86, role: "upper root peak" },
      { relBeat: 3.0, dur: 0.9, semitonesFromRoot: 11, vel: 0.76, role: "7th guide-tone landing" },
    ],
  },
  {
    id: "clifford-minor-bop",
    title: "Minor Arpeggio Bebop Line",
    master: "Clifford Brown",
    qualities: ["minor"],
    energy: "dense",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.62, semitonesFromRoot: 3, vel: 0.64, role: "b3 arpeggio launch" },
      { relBeat: 0.66, dur: 0.32, semitonesFromRoot: 7, vel: 0.74, role: "swung 5th" },
      { relBeat: 1.0, dur: 0.62, semitonesFromRoot: 10, vel: 0.7, role: "b7 guide tone" },
      { relBeat: 1.66, dur: 0.32, semitonesFromRoot: 14, vel: 0.86, role: "swung 9th peak" },
      { relBeat: 2.0, dur: 0.62, semitonesFromRoot: 12, vel: 0.72, role: "root" },
      { relBeat: 2.66, dur: 0.32, semitonesFromRoot: 11, enclosure: true, vel: 0.52, role: "chromatic maj7 passing tone" },
      { relBeat: 3.0, dur: 0.9, semitonesFromRoot: 10, vel: 0.78, role: "b7 guide-tone resolution" },
    ],
  },
  {
    id: "garland-blues-riff",
    title: "Blue-Third Blues Call",
    master: "Red Garland",
    qualities: ["dominant", "minor"],
    energy: "dense",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.32, semitonesFromRoot: 3, enclosure: true, vel: 0.54, role: "#9 / b3 blue crush" },
      { relBeat: 0.33, dur: 0.62, semitonesFromRoot: 4, vel: 0.78, role: "natural 3rd release" },
      { relBeat: 1.0, dur: 0.62, semitonesFromRoot: 7, vel: 0.66, role: "5th" },
      { relBeat: 1.66, dur: 0.32, semitonesFromRoot: 10, vel: 0.82, role: "swung b7 accent" },
      { relBeat: 2.0, dur: 0.62, semitonesFromRoot: 6, enclosure: true, vel: 0.5, role: "b5 blue approach" },
      { relBeat: 2.66, dur: 0.32, semitonesFromRoot: 7, vel: 0.76, role: "swung 5th" },
      { relBeat: 3.0, dur: 0.9, semitonesFromRoot: 10, vel: 0.8, role: "b7 blues lock" },
    ],
  },

  // ── Lyrical, Pretty, Dynamic Slow Melodies (for Slow Starts & Sparse Trades) ──
  {
    id: "chet-velvet-sigh",
    title: "Minor 9th Velvet Sigh",
    master: "Chet Baker",
    qualities: ["minor", "dominant"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.64, semitonesFromRoot: 2, vel: 0.54, role: "whispered 9th entrance" },
      { relBeat: 0.66, dur: 0.95, semitonesFromRoot: 3, vel: 0.68, role: "swung b3 warm step" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 7, vel: 0.78, role: "singing 5th swell" },
      { relBeat: 2.66, dur: 0.64, semitonesFromRoot: 10, vel: 0.86, role: "expressive b7 peak" },
      { relBeat: 3.33, dur: 0.62, semitonesFromRoot: 7, vel: 0.62, role: "gentle 5th taper" },
    ],
  },
  {
    id: "getz-golden-melody",
    title: "Major 7th Golden Arch",
    master: "Stan Getz",
    qualities: ["major", "dominant"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.64, semitonesFromRoot: 4, vel: 0.56, role: "warm 3rd opening" },
      { relBeat: 0.66, dur: 0.95, semitonesFromRoot: 7, vel: 0.72, role: "swung 5th lift" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 11, vel: 0.86, role: "glowing 7th climax" },
      { relBeat: 2.66, dur: 0.64, semitonesFromRoot: 9, vel: 0.74, role: "sweet 6th/13th color" },
      { relBeat: 3.33, dur: 0.62, semitonesFromRoot: 4, vel: 0.6, role: "soft 3rd resolution" },
    ],
  },
  {
    id: "desmond-warm-question",
    title: "6-to-9 Lyrical Question",
    master: "Paul Desmond",
    qualities: ["major", "minor"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.64, semitonesFromRoot: 7, vel: 0.55, role: "gentle 5th pickup" },
      { relBeat: 0.66, dur: 0.95, semitonesFromRoot: 9, vel: 0.72, role: "6th pastel step" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 14, vel: 0.85, role: "soaring 9th question" },
      { relBeat: 2.66, dur: 1.2, semitonesFromRoot: 4, vel: 0.64, role: "poised 3rd answer" },
    ],
  },
  {
    id: "wynton-soulful-cry",
    title: "Blue-Grace 13th Soul Cry",
    master: "Wynton Kelly",
    qualities: ["dominant", "major", "minor"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.32, semitonesFromRoot: 3, enclosure: true, vel: 0.52, role: "soulful blue grace pickup" },
      { relBeat: 0.33, dur: 0.95, semitonesFromRoot: 4, vel: 0.76, role: "singing 3rd guide tone" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 9, vel: 0.86, role: "swung 13th/6th cry" },
      { relBeat: 2.66, dur: 0.64, semitonesFromRoot: 7, vel: 0.7, role: "5th step-down" },
      { relBeat: 3.33, dur: 0.62, semitonesFromRoot: 4, vel: 0.62, role: "warm 3rd landing" },
    ],
  },

  // ── Classic Cool / Space Vocabulary ─────────────────────────────────────
  {
    id: "miles-cool-space",
    title: "Dorian Cool Space",
    master: "Miles Davis",
    qualities: ["minor", "dominant"],
    energy: "sparse",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.64, semitonesFromRoot: 7, vel: 0.6, role: "5th bell tone" },
      { relBeat: 0.66, dur: 1.1, semitonesFromRoot: 10, vel: 0.78, role: "swung b7 guide tone" },
      { relBeat: 2.0, dur: 0.64, semitonesFromRoot: 7, vel: 0.64, role: "5th echo" },
      { relBeat: 2.66, dur: 1.2, semitonesFromRoot: 3, vel: 0.72, role: "swung b3 / #9 cool landing" },
    ],
  },
  {
    id: "evans-lyrical-maj",
    title: "Major 7th Falling Sigh",
    master: "Bill Evans",
    qualities: ["major"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.95, semitonesFromRoot: 11, vel: 0.62, role: "maj7 floating tone" },
      { relBeat: 1.0, dur: 0.64, semitonesFromRoot: 9, vel: 0.74, role: "6th warm color" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 7, vel: 0.82, role: "swung 5th arch" },
      { relBeat: 2.66, dur: 1.2, semitonesFromRoot: 4, vel: 0.64, role: "major 3rd resolution" },
    ],
  },
  {
    id: "monk-angular-space",
    title: "#11 Tritone Wink",
    master: "Thelonious Monk",
    qualities: ["dominant"],
    energy: "sparse",
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.62, semitonesFromRoot: 6, enclosure: true, vel: 0.54, role: "#11 angular inflection" },
      { relBeat: 0.66, dur: 0.95, semitonesFromRoot: 7, vel: 0.8, role: "swung 5th anchor" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 10, vel: 0.76, role: "swung b7 wink" },
      { relBeat: 2.66, dur: 1.2, semitonesFromRoot: 4, vel: 0.72, role: "major 3rd landing" },
    ],
  },
  {
    id: "dexter-minor-cry",
    title: "9th Suspension Cry",
    master: "Dexter Gordon",
    qualities: ["minor", "major", "dominant"],
    energy: "sparse",
    lyrical: true,
    spanBeats: 4,
    steps: [
      { relBeat: 0, dur: 0.62, semitonesFromRoot: 1, enclosure: true, vel: 0.5, role: "chromatic approach to 9th" },
      { relBeat: 0.66, dur: 0.95, semitonesFromRoot: 2, vel: 0.84, role: "swung 9th suspension" },
      { relBeat: 1.66, dur: 0.95, semitonesFromRoot: 7, vel: 0.74, role: "5th answer" },
      { relBeat: 2.66, dur: 1.2, semitonesFromRoot: 3, vel: 0.66, role: "3rd guide-tone sigh" },
    ],
  },
] as const;

/** Classify a `ChordEvent` into one of the three vocabulary quality families. */
export function classifyLickQuality(chord: ChordEvent): LickQuality {
  if (isDominant(chord.quality)) return "dominant";
  if (isMinorQ(chord.quality) || chord.quality === "m7b5" || chord.quality === "dim7") return "minor";
  if (isMajorQ(chord.quality)) return "major";
  return "dominant";
}

/**
 * Deterministically pick a classic lick from `GHOST_VOCABULARY` matching the target chord's
 * quality and the user's rhythmic density (`"dense"` vs. `"sparse"`).
 */
export function selectVocabularyLick(
  chord: ChordEvent,
  energy: LickEnergy,
  continuousPhraseIdx: number,
): GhostLick {
  const quality = classifyLickQuality(chord);
  const exact = GHOST_VOCABULARY.filter((l) => l.energy === energy && l.qualities.includes(quality));
  if (exact.length > 0) {
    return exact[mod(continuousPhraseIdx, exact.length)];
  }
  const byEnergy = GHOST_VOCABULARY.filter((l) => l.energy === energy);
  if (byEnergy.length > 0) {
    return byEnergy[mod(continuousPhraseIdx, byEnergy.length)];
  }
  return GHOST_VOCABULARY[mod(continuousPhraseIdx, GHOST_VOCABULARY.length)];
}

/**
 * Deterministically pick a singing, memorable, slow-start lyrical melody (`lyrical: true`)
 * when the user is just starting out or plays a very sparse/tentative opening call.
 */
export function selectLyricalMelodyLick(
  chord: ChordEvent,
  continuousPhraseIdx: number,
): GhostLick {
  const quality = classifyLickQuality(chord);
  const lyricalMatches = GHOST_VOCABULARY.filter((l) => l.lyrical && l.qualities.includes(quality));
  if (lyricalMatches.length > 0) {
    return lyricalMatches[mod(continuousPhraseIdx, lyricalMatches.length)];
  }
  return selectVocabularyLick(chord, "sparse", continuousPhraseIdx);
}

/**
 * Snap a vocabulary step's MIDI pitch to the underlying chord so a major/dominant lick over a
 * minor chord (or a minor lick over a major chord) never clashes with the active 3rd or 7th.
 */
export function snapLickPitchToChord(
  rawMidi: number,
  enclosure: boolean,
  chord: ChordEvent,
  next?: ChordEvent,
): number {
  if (enclosure) return rawMidi;
  const gts = guideTones(chord);
  const rootPc = chroma(chord.root);
  const relPc = mod(rawMidi - rootPc, 12);

  // If the lick targets a 3rd (b3 = 3 or M3 = 4), snap to the active chord's actual 3rd guide tone
  if (relPc === 3 || relPc === 4) {
    const third = gts.find((g) => g.degree === "3" || g.degree === "b3" || g.degree === "4");
    if (third) {
      const targetPc = chroma(third.note);
      return rawMidi + mod(targetPc - mod(rawMidi, 12) + 6, 12) - 6;
    }
  }

  // If the lick targets a 7th (b7 = 10 or M7 = 11), snap to the active chord's actual 7th/6th guide tone
  if (relPc === 10 || relPc === 11) {
    const seventh = gts.find((g) => g.degree === "7" || g.degree === "b7" || g.degree === "bb7" || g.degree === "6");
    if (seventh) {
      const targetPc = chroma(seventh.note);
      return rawMidi + mod(targetPc - mod(rawMidi, 12) + 6, 12) - 6;
    }
  }

  // Snap any remaining avoid/outside tone on a non-enclosure step to the nearest chord or scale tone
  const ev = evaluateLineNote(rawMidi, chord, next);
  if (ev.verdict === "avoid" || ev.verdict === "outside") {
    const scale = suggestScales(chord, next)[0];
    const allowed = new Set<number>([
      ...chordTones(chord).map((t) => chroma(t.note)),
      ...(scale ? scale.notes.filter((n) => !scale.avoid.includes(n)).map((n) => chroma(n)) : []),
    ]);
    for (const delta of [1, -1, 2, -2]) {
      if (allowed.has(mod(rawMidi + delta, 12))) return rawMidi + delta;
    }
  }

  return rawMidi;
}
