import fc from "fast-check";
import { chordTones } from "../chords";
import { simplifyNote, transpose } from "../pitch";
import type { ChordEvent, Quality, Tune } from "../types";

export const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
export const SPELLED = ["C", "D", "E", "F", "G", "A", "B"].flatMap((l) => [l + "b", l, l + "#"]);

const ch = (id: string, bar: number, root: string, quality: Quality, beats: number, alterations: string[] = []): ChordEvent => ({
  id,
  at: { bar, beat: 1 },
  beats,
  root,
  quality,
  extensions: [],
  alterations,
});

/** ii–V–I–I in a random key and meter, with an optional chord-tone melody. */
export const progressionArb = fc
  .record({
    tonic: fc.constantFrom(...ROOTS),
    minor: fc.boolean(),
    bpb: fc.constantFrom(3, 4),
    picks: fc.array(fc.nat(20), { minLength: 4, maxLength: 4 }),
    withMelody: fc.boolean(),
  })
  .map(({ tonic, minor, bpb, picks, withMelody }): Tune => {
    const ii = simplifyNote(transpose(tonic, "2"));
    const V = simplifyNote(transpose(tonic, "5"));
    const harmony = [
      ch("h1", 1, ii, minor ? "m7b5" : "m7", bpb),
      ch("h2", 2, V, "7", bpb, minor ? ["b9"] : []),
      ch("h3", 3, tonic, minor ? "m7" : "maj7", bpb),
      ch("h4", 4, tonic, minor ? "m6" : "6", bpb),
    ];
    const melody = withMelody
      ? harmony.map((c, i) => {
          const tones = chordTones(c);
          return { at: { bar: i + 1, beat: 1 }, beats: bpb, pitch: tones[picks[i] % tones.length].note + "4" };
        })
      : [];
    return {
      id: "random",
      title: "random ii–V–I",
      key: { tonic, mode: minor ? "minor" : "major" },
      meter: [bpb, 4],
      feel: "swing",
      tempo: 160,
      sections: [{ id: "A", label: "A", startBar: 1, bars: 4 }],
      formOrder: ["A"],
      harmony,
      melody,
      melodyCoverage: withMelody ? "full" : "none",
      source: { kind: "manual", personalUseOnly: true },
    };
  });
