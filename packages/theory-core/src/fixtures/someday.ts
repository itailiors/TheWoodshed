import type { ChordEvent, HarmonicFunction, Quality, Tune } from "../types";

const C = (
  id: string,
  bar: number,
  root: string,
  quality: Quality,
  roman: string,
  func: HarmonicFunction,
  alterations: string[] = [],
): ChordEvent => ({ id, at: { bar, beat: 1 }, beats: 3, root, quality, extensions: [], alterations, analysis: { roman, func } });

/**
 * "Someday My Prince Will Come" (Churchill), bars 1–8 plus the downbeat of bar 9.
 * Personal-use practice data. Only two melody anchor notes are entered
 * (the held notes that explain the #5 chords); verify against your own lead sheet.
 */
export const someday: Tune = {
  id: "someday-my-prince",
  title: "Someday My Prince Will Come",
  composer: "Frank Churchill",
  key: { tonic: "Bb", mode: "major" },
  meter: [3, 4],
  feel: "waltz",
  tempo: 152,
  sections: [{ id: "A1", label: "A", startBar: 1, bars: 8 }],
  formOrder: ["A1"],
  harmony: [
    C("c1", 1, "Bb", "maj7", "Imaj7", "T"),
    C("c2", 2, "D", "7", "III7", "D", ["#5"]),
    C("c3", 3, "Eb", "maj7", "IVmaj7", "PD"),
    C("c4", 4, "G", "7", "VI7", "D", ["#5"]),
    C("c5", 5, "C", "m7", "iim7", "PD"),
    C("c6", 6, "G", "7", "VI7", "D", ["#5"]),
    C("c7", 7, "C", "m7", "iim7", "PD"),
    C("c8", 8, "F", "7", "V7", "D"),
    C("c9", 9, "Bb", "maj7", "Imaj7", "T"),
  ],
  melody: [
    { at: { bar: 2, beat: 1 }, beats: 3, pitch: "Bb4" },
    { at: { bar: 4, beat: 1 }, beats: 3, pitch: "Eb5" },
  ],
  melodyCoverage: "anchors",
  source: { kind: "manual", personalUseOnly: true },
};
