import type { ChordEvent, HarmonicFunction, Quality, Tune } from "../types";

/*
 * Public-domain standards for the demo library, as CHORD CHANGES ONLY.
 *
 * Chord progressions aren't protected by copyright anywhere; melodies are. These songs
 * are public domain in the US (published 1930; US term 95 years), but under life + 70
 * (Israel, the EU, the UK) "On the Sunny Side of the Street" stays protected until the end
 * of 2039 (Jimmy McHugh died in 1969), so no melody is shipped for it. "I Got Rhythm" is
 * out of copyright almost everywhere (George Gershwin died in 1937). Its melody isn't
 * shipped either, because only a melody verified against the 1930 sheet music would be
 * fit for the melody filter. Without a melody, the engine marks every move "melody not
 * checked", exactly as it does for iReal imports.
 *
 * These are the common session versions of the changes; check them against your own
 * lead sheet at the piano.
 */

const C = (
  id: string,
  bar: number,
  beat: number,
  beats: number,
  root: string,
  quality: Quality,
  roman: string,
  func: HarmonicFunction,
  extra: Partial<Pick<ChordEvent, "alterations" | "bass">> = {},
): ChordEvent => ({ id, at: { bar, beat }, beats, root, quality, extensions: [], alterations: extra.alterations ?? [], ...(extra.bass ? { bass: extra.bass } : {}), analysis: { roman, func } });

/** Builds a bar list ("C6" or ["Am7","D7"]) into chord events, two beats each for a split bar. */
type Spec = [root: string, quality: Quality, roman: string, func: HarmonicFunction, extra?: Partial<Pick<ChordEvent, "alterations" | "bass">>];
function bars(list: (Spec | [Spec, Spec])[]): ChordEvent[] {
  const out: ChordEvent[] = [];
  list.forEach((b, i) => {
    const bar = i + 1;
    const halves = Array.isArray(b[0]) ? (b as [Spec, Spec]) : [b as Spec];
    halves.forEach((s, h) => out.push(C(`c${out.length + 1}`, bar, halves.length === 1 ? 1 : 1 + h * 2, halves.length === 1 ? 4 : 2, s[0], s[1], s[2], s[3], s[4])));
  });
  return out;
}

// ── On the Sunny Side of the Street (Jimmy McHugh, 1930), C major, AABA ──
const I6: Spec = ["C", "6", "I6", "T"];
const III7: Spec = ["E", "7", "III7", "D"];
const IV: Spec = ["F", "maj7", "IVmaj7", "PD"];
const I6overG: Spec = ["C", "6", "I6", "T", { bass: "G" }];
const III7overGs: Spec = ["E", "7", "III7", "D", { alterations: ["b9"], bass: "G#" }];
const vi: Spec = ["A", "m7", "vim7", "T"];
const II7: Spec = ["D", "7", "II7", "D"];
const ii: Spec = ["D", "m7", "iim7", "PD"];
const V: Spec = ["G", "7", "V7", "D"];
const iii: Spec = ["E", "m7", "iiim7", "T"];
const VI7: Spec = ["A", "7", "VI7", "D"];
const vOfIV: Spec = ["G", "m7", "vm7", "PD"];
const I7: Spec = ["C", "7", "I7", "D"];
const sunnyA = (ending: (Spec | [Spec, Spec])[]): (Spec | [Spec, Spec])[] => [I6, III7, IV, [I6overG, III7overGs], [vi, II7], [ii, V], ...ending];

export const sunnySide: Tune = {
  id: "sunny-side",
  title: "On the Sunny Side of the Street",
  composer: "Jimmy McHugh (1930)",
  key: { tonic: "C", mode: "major" },
  meter: [4, 4],
  feel: "swing",
  tempo: 132,
  sections: [
    { id: "A1", label: "A", startBar: 1, bars: 8 },
    { id: "A2", label: "A", startBar: 9, bars: 8 },
    { id: "B", label: "B", startBar: 17, bars: 8 },
    { id: "A3", label: "A", startBar: 25, bars: 8 },
  ],
  formOrder: ["A1", "A2", "B", "A3"],
  harmony: bars([
    ...sunnyA([[iii, VI7], [ii, V]]),
    ...sunnyA([I6, I6]),
    // bridge: ii–V into the IV, twice, then the long way home
    [vOfIV, I7], IV, [vOfIV, I7], IV, vi, II7, ii, V,
    ...sunnyA([I6, V]),
  ]),
  melody: [],
  melodyCoverage: "none",
  source: { kind: "manual", personalUseOnly: true },
  rights: { kind: "public-domain", note: "Public domain in the US since 2026 (published 1930). Chord changes only." },
};

// ── I Got Rhythm (George Gershwin, 1930), B♭ major, the 32-bar jazz form ──
const Bb6: Spec = ["Bb", "6", "I6", "T"];
const G7: Spec = ["G", "7", "VI7", "D"];
const Cm7: Spec = ["C", "m7", "iim7", "PD"];
const F7: Spec = ["F", "7", "V7", "D"];
const Bb7: Spec = ["Bb", "7", "I7", "D"];
const Eb6: Spec = ["Eb", "6", "IV6", "PD"];
const Ebm6: Spec = ["Eb", "m6", "ivm6", "PD"];
const rhythmA = (ending: (Spec | [Spec, Spec])[]): (Spec | [Spec, Spec])[] => [[Bb6, G7], [Cm7, F7], [Bb6, G7], [Cm7, F7], [Bb6, Bb7], [Eb6, Ebm6], ...ending];
const D7: Spec = ["D", "7", "III7", "D"];
const G7b: Spec = ["G", "7", "VI7", "D"];
const C7: Spec = ["C", "7", "II7", "D"];

export const iGotRhythm: Tune = {
  id: "i-got-rhythm",
  title: "I Got Rhythm",
  composer: "George Gershwin (1930)",
  key: { tonic: "Bb", mode: "major" },
  meter: [4, 4],
  feel: "swing",
  tempo: 184,
  sections: [
    { id: "A1", label: "A", startBar: 1, bars: 8 },
    { id: "A2", label: "A", startBar: 9, bars: 8 },
    { id: "B", label: "B", startBar: 17, bars: 8 },
    { id: "A3", label: "A", startBar: 25, bars: 8 },
  ],
  formOrder: ["A1", "A2", "B", "A3"],
  harmony: bars([
    ...rhythmA([[Bb6, G7], [Cm7, F7]]),
    ...rhythmA([[Cm7, F7], Bb6]),
    // the bridge: dominants round the cycle of fifths, two bars each
    D7, D7, G7b, G7b, C7, C7, F7, F7,
    ...rhythmA([[Cm7, F7], Bb6]),
  ]),
  melody: [],
  melodyCoverage: "none",
  source: { kind: "manual", personalUseOnly: true },
  rights: { kind: "public-domain", note: "Public domain in the US since 2026 (published 1930) and under life + 70 since 2008. Chord changes only." },
};
