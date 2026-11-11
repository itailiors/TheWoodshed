import type { ChordEvent, HarmonicFunction, NoteEvent, Quality, Tune } from "../types";

const C = (
  id: string,
  bar: number,
  beat: number,
  beats: number,
  root: string,
  quality: Quality,
  roman: string,
  func: HarmonicFunction,
  alterations: string[] = [],
): ChordEvent => ({ id, at: { bar, beat }, beats, root, quality, extensions: [], alterations, analysis: { roman, func } });

/** One melody note: bar, beat (2.5 = the "and" of 2), length in beats, spelled pitch. */
const N = (bar: number, beat: number, beats: number, pitch: string): NoteEvent => ({ at: { bar, beat }, beats, pitch });

/**
 * "Co-op Blues" (Itai Lior), the app's reference and demo tune: an original 12-bar jazz
 * blues in F with an original bebop head, written so the public demo ships no copyrighted
 * melody (chord progressions aren't protected; melodies are).
 *
 * The changes are the bebop blues players call at sessions: the IV in bar 2, a ii–V into
 * the IV in bar 4, the passing B°7 in bar 6, a ii–V into ii in bar 8, and two turnarounds.
 * The head is written out in full (melodyCoverage "full"), so every move the engine
 * proposes is checked against a real line: eighth-note bebop runs with chromatic
 * approach tones, the blue ♭3 (A♭) against F7, and anticipations that land a half beat
 * early across the bar line. It's a call (bars 1–4), an answer over the IV (5–8) and a
 * running turnaround line (9–12) that hands back to the pickup at bar 1.
 */
export const coopBlues: Tune = {
  id: "coop-blues",
  title: "Co-op Blues",
  composer: "Itai Lior",
  key: { tonic: "F", mode: "major" },
  meter: [4, 4],
  feel: "swing",
  tempo: 168,
  sections: [{ id: "A", label: "Blues", startBar: 1, bars: 12 }],
  formOrder: ["A"],
  harmony: [
    C("c1", 1, 1, 4, "F", "6", "I6", "T"),
    C("c2", 2, 1, 4, "Bb", "7", "IV7", "PD"),
    C("c3", 3, 1, 4, "F", "6", "I6", "T"),
    C("c4", 4, 1, 2, "C", "m7", "v7", "PD"),
    C("c5", 4, 3, 2, "F", "7", "V7/IV", "D"),
    C("c6", 5, 1, 4, "Bb", "7", "IV7", "PD"),
    C("c7", 6, 1, 4, "B", "dim7", "#iv°7", "passing"),
    C("c8", 7, 1, 4, "F", "6", "I6", "T"),
    C("c9", 8, 1, 2, "A", "m7b5", "iiø7/ii", "PD"),
    C("c10", 8, 3, 2, "D", "7", "V7/ii", "D", ["b9"]),
    C("c11", 9, 1, 4, "G", "m7", "iim7", "PD"),
    C("c12", 10, 1, 4, "C", "7", "V7", "D"),
    C("c13", 11, 1, 2, "F", "6", "I6", "T"),
    C("c14", 11, 3, 2, "D", "7", "VI7", "D"),
    C("c15", 12, 1, 2, "G", "m7", "iim7", "PD"),
    C("c16", 12, 3, 2, "C", "7", "V7", "D"),
  ],
  melody: [
    // ── call: bars 1–4 ──
    N(1, 1.5, 0.5, "C5"), N(1, 2, 0.5, "D5"), N(1, 2.5, 0.5, "Ab4"), N(1, 3, 0.5, "A4"), N(1, 3.5, 0.5, "C5"), N(1, 4, 0.5, "D5"), N(1, 4.5, 1.5, "F5"),
    N(2, 2.5, 0.5, "D5"), N(2, 3, 0.5, "C5"), N(2, 3.5, 0.5, "Bb4"), N(2, 4, 1, "Ab4"),
    N(3, 1, 1, "A4"), N(3, 2, 0.5, "C5"), N(3, 2.5, 0.5, "D5"), N(3, 3.5, 0.5, "Bb4"), N(3, 4, 0.5, "B4"), N(3, 4.5, 0.5, "C5"),
    N(4, 1, 0.5, "Eb5"), N(4, 1.5, 0.5, "D5"), N(4, 2, 0.5, "C5"), N(4, 2.5, 0.5, "Bb4"), N(4, 3, 0.5, "A4"), N(4, 3.5, 0.5, "C5"), N(4, 4, 0.5, "Eb5"), N(4, 4.5, 1.5, "D5"),
    // ── answer: bars 5–8 ──
    N(5, 2.5, 0.5, "F5"), N(5, 3, 0.5, "D5"), N(5, 3.5, 1.5, "Ab4"),
    N(6, 2, 0.5, "F4"), N(6, 2.5, 0.5, "Ab4"), N(6, 3, 0.5, "B4"), N(6, 3.5, 0.5, "D5"), N(6, 4, 1, "F5"),
    N(7, 1, 0.5, "D5"), N(7, 1.5, 0.5, "C5"), N(7, 2, 0.5, "A4"), N(7, 2.5, 0.5, "Ab4"), N(7, 3, 0.5, "G4"), N(7, 3.5, 0.5, "F4"), N(7, 4, 0.5, "A4"), N(7, 4.5, 2, "Eb5"),
    N(8, 2.5, 0.5, "C5"), N(8, 3, 0.5, "F#5"), N(8, 3.5, 0.5, "Eb5"), N(8, 4, 0.5, "C5"), N(8, 4.5, 0.5, "Bb4"),
    // ── turnaround line: bars 9–12 ──
    N(9, 1, 1, "Bb4"), N(9, 2.5, 0.5, "D5"), N(9, 3, 0.5, "F5"), N(9, 3.5, 0.5, "E5"), N(9, 4, 0.5, "D5"), N(9, 4.5, 0.5, "Db5"),
    N(10, 1, 0.5, "C5"), N(10, 1.5, 0.5, "Bb4"), N(10, 2, 0.5, "G4"), N(10, 2.5, 0.5, "E4"), N(10, 3, 0.5, "G4"), N(10, 3.5, 0.5, "Bb4"), N(10, 4, 0.5, "Db5"), N(10, 4.5, 1.5, "C5"),
    N(11, 2.5, 0.5, "A4"), N(11, 3, 0.5, "F#4"), N(11, 3.5, 0.5, "A4"), N(11, 4, 0.5, "C5"), N(11, 4.5, 0.5, "Eb5"),
    N(12, 1, 1, "D5"), N(12, 2, 0.5, "Bb4"), N(12, 2.5, 0.5, "G4"), N(12, 3, 0.5, "Bb4"), N(12, 3.5, 0.5, "G4"), N(12, 4, 1, "E4"),
  ],
  melodyCoverage: "full",
  source: { kind: "manual", personalUseOnly: true },
  rights: { kind: "original", holder: "Itai Lior", year: 2026 },
};
