import { describe, expect, it } from "vitest";
import { QUALITIES } from "../src/chords";
import { matchChord } from "../src/harmonyCatcher";
import { chroma, midiOf } from "../src/pitch";
import type { Quality } from "../src/types";
import { VOICING_STYLES } from "../src/voicing";
import { voicingForms } from "../src/voicingForms";
import { ROOTS } from "./arbitraries";

const chord = (root: string, quality: Quality, alterations: string[] = [], extensions: string[] = []) => ({ root, quality, extensions, alterations });
const notes = (s: string) => s.split(" ").map(midiOf);
const pcs = (...names: string[]) => names.map((n) => chroma(n)).sort((a, b) => a - b);

describe("matchChord: what counts as playing a chord", () => {
  it("every voicing form the app teaches matches its own chord (exhaustive: roots × qualities × styles)", () => {
    for (const root of ROOTS)
      for (const quality of QUALITIES)
        for (const style of VOICING_STYLES.map((s) => s.id)) {
          const c = chord(root, quality);
          for (const form of voicingForms(c, style)) {
            const m = matchChord(
              form.notes.map((n) => n.midi),
              c,
            );
            expect(m, `${root}${quality} ${style} ${form.id}`).toMatchObject({ ok: true, missing: [], foreign: [] });
          }
        }
  });

  it("rootless A and B forms count, and report the root as absent", () => {
    expect(matchChord(notes("F3 A3 C4 E4"), chord("D", "m7"))).toMatchObject({ ok: true, rootPresent: false, lowestIsRoot: false });
    expect(matchChord(notes("F3 A3 B3 E4"), chord("G", "7"))).toMatchObject({ ok: true, rootPresent: false });
    expect(matchChord(notes("E3 G3 B3 D4"), chord("C", "maj7"))).toMatchObject({ ok: true, rootPresent: false });
  });

  it("shells count: root–3–7 and the bare guide-tone tritone", () => {
    expect(matchChord(notes("G2 B3 F4"), chord("G", "7"))).toMatchObject({ ok: true, rootPresent: true, lowestIsRoot: true });
    expect(matchChord(notes("B3 F4"), chord("G", "7"))).toMatchObject({ ok: true, rootPresent: false });
  });

  it("a wrong 3rd or a missing 7th is not the chord", () => {
    const major = matchChord(notes("D3 F#3 A3 C4"), chord("D", "m7"));
    expect(major.ok).toBe(false);
    expect(major.missing).toEqual(["b3"]);
    expect(major.foreign).toEqual(pcs("F#"));

    const triad = matchChord(notes("D3 F3 A3"), chord("D", "m7"));
    expect(triad).toMatchObject({ ok: false, missing: ["b7"], foreign: [] });
  });

  it("avoid notes and quality clashes are foreign", () => {
    expect(matchChord(notes("G2 B3 C4 F4"), chord("G", "7")).foreign).toEqual(pcs("C")); // natural 11 against the 3rd
    expect(matchChord(notes("C3 E3 Eb4 B4"), chord("C", "maj7")).foreign).toEqual(pcs("Eb")); // minor 3rd on a major chord
    expect(matchChord(notes("C3 E3 G3 Bb3"), chord("C", "maj")).foreign).toEqual(pcs("Bb")); // a ♭7 turns I into V/IV
    expect(matchChord(notes("C3 E3 B3 Bb4"), chord("C", "maj7")).ok).toBe(false);
    expect(matchChord(notes("D3 F3 C4 Bb4"), chord("D", "m7")).foreign).toEqual(pcs("Bb")); // ♭13 on a Dorian minor
  });

  it("a sus chord needs its 4th; the 3rd is only a colour on top of it", () => {
    expect(matchChord(notes("G2 B3 F4"), chord("G", "7sus4"))).toMatchObject({ ok: false, missing: ["4"] });
    expect(matchChord(notes("G2 C3 F3 B3 E4"), chord("G", "7sus4")).ok).toBe(true);
  });

  it("a dominant takes every altered tension, so a rootless D♭7 is G7alt", () => {
    expect(matchChord(notes("F3 Ab3 Bb3 Db4 Eb4 B4"), chord("G", "7"))).toMatchObject({ ok: true, foreign: [] });
    // D♭13 rootless (F C♭ E♭ B♭) over G7: every tone is an altered tension of G7
    expect(matchChord(notes("F3 B3 Eb4 Bb4"), chord("G", "7"))).toMatchObject({ ok: true, lowestIsRoot: false });
    expect(matchChord(notes("F3 B3 Eb4 Bb4"), chord("Db", "7"))).toMatchObject({ ok: true, lowestIsRoot: false });
    // with D♭ underneath, only the sub has its root in the bass
    expect(matchChord(notes("Db2 F3 B3 Eb4"), chord("Db", "7")).lowestIsRoot).toBe(true);
    expect(matchChord(notes("Db2 F3 B3 Eb4"), chord("G", "7")).lowestIsRoot).toBe(false);
  });

  it("an alteration in the chart replaces its natural neighbour", () => {
    expect(matchChord(notes("G2 B3 D4 F4"), chord("G", "7", ["#5"])).foreign).toEqual(pcs("D"));
    expect(matchChord(notes("G2 B3 F4 A4"), chord("G", "7", ["b9"])).foreign).toEqual(pcs("A"));
    expect(matchChord(notes("G2 B3 F4 Ab4"), chord("G", "7", ["b9"])).ok).toBe(true);
  });

  it("half-diminished: a rootless strike needs its ♭5, a root–♭3–♭7 shell doesn't; an F major triad never fits", () => {
    expect(matchChord(notes("F3 Ab3 C4"), chord("D", "m7b5"))).toMatchObject({ ok: true, rootPresent: false });
    expect(matchChord(notes("F3 C4"), chord("D", "m7b5"))).toMatchObject({ ok: false, missing: ["b5"] });
    expect(matchChord(notes("D3 F3 C4"), chord("D", "m7b5")).ok).toBe(true);
    const fMajor = matchChord(notes("F3 A3 C4"), chord("D", "m7b5"));
    expect(fMajor.ok).toBe(false);
    expect(fMajor.missing).toEqual(["b5"]);
    expect(fMajor.foreign).toEqual(pcs("A"));
  });

  it("diminished 7th: any three of its four tones (it's symmetric), whole-step-above tensions allowed", () => {
    expect(matchChord(notes("D3 F3 Ab3"), chord("B", "dim7")).ok).toBe(true);
    expect(matchChord(notes("B2 D3 Ab3"), chord("B", "dim7")).ok).toBe(true);
    expect(matchChord(notes("B2 D3 F3 Ab3 C#4"), chord("B", "dim7")).ok).toBe(true);
    expect(matchChord(notes("B2 F3"), chord("B", "dim7")).ok).toBe(false);
  });

  it("a slash chord needs its bass underneath, and the bass is never foreign", () => {
    const abOverBb = { ...chord("Ab", "maj"), bass: "Bb" };
    expect(matchChord(notes("Bb2 Ab3 C4 Eb4"), abOverBb)).toMatchObject({ ok: true, lowestIsRoot: true });
    expect(matchChord(notes("F2 Ab3 C4 Eb4 G4"), abOverBb)).toMatchObject({ ok: false, missing: ["bass"] });
    expect(matchChord(notes("C2 D3 F#3 A3"), { ...chord("D", "maj"), bass: "C" }).ok).toBe(true);
  });

  it("a single pitch class is never a chord", () => {
    expect(matchChord(notes("E3 E4"), chord("C", "maj")).ok).toBe(false);
    expect(matchChord([], chord("C", "maj")).ok).toBe(false);
  });

  it("is key-free: transposing the notes and the root together keeps the verdict", () => {
    const base = notes("F3 A3 B3 E4");
    for (let t = 0; t < 12; t++) {
      const root = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb"][t];
      expect(matchChord(base.map((m) => m + t), chord(root, "7")).ok, root).toBe(true);
    }
  });
});
