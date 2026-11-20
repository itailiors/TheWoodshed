import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BASE_INTERVAL_NAMES,
  chroma,
  fewestAccidentals,
  INTERVALS,
  keySignature,
  letterIndex,
  mod,
  playableKey,
  prettySymbol,
  simplifyNote,
  transpose,
} from "../src/pitch";
import { SPELLED } from "./arbitraries";

describe("pitch spelling", () => {
  it("transpose keeps both the letter distance and the semitone distance", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SPELLED), fc.constantFrom(...BASE_INTERVAL_NAMES), (note, iv) => {
        const out = transpose(note, iv);
        expect(chroma(out)).toBe(mod(chroma(note) + INTERVALS[iv].semis, 12));
        expect(letterIndex(out)).toBe(mod(letterIndex(note) + INTERVALS[iv].steps, 7));
      }),
    );
  });

  it("simplifyNote never changes the sounding pitch", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SPELLED), fc.constantFrom(...BASE_INTERVAL_NAMES), (note, iv) => {
        const raw = transpose(note, iv);
        expect(chroma(simplifyNote(raw))).toBe(chroma(raw));
      }),
    );
  });

  it("spells jazz intervals the way a chart would", () => {
    expect(transpose("G", "b5")).toBe("Db");
    expect(transpose("D", "#5")).toBe("A#");
    expect(transpose("Bb", "5")).toBe("F");
    expect(transpose("G", "b13")).toBe("Eb");
    expect(simplifyNote(transpose("F", "b5"))).toBe("B");
  });

  it("prettifies symbols without mangling the quality", () => {
    expect(prettySymbol("Bb7(b9)")).toBe("B♭7(♭9)");
    expect(prettySymbol("Eb/F")).toBe("E♭/F");
    expect(prettySymbol("Dm7b5")).toBe("Dm7♭5");
    expect(prettySymbol("Bbmaj7")).toBe("B♭maj7");
  });
});

describe("key names", () => {
  it("counts a key signature: sharps up, flats down, minor three fifths below its major", () => {
    expect(keySignature("C")).toBe(0);
    expect(keySignature("Eb")).toBe(-3);
    expect(keySignature("D#")).toBe(9);
    expect(keySignature("A", "minor")).toBe(0);
    expect(keySignature("Db", "minor")).toBe(-8);
  });

  it("charts a key centre with the fewest accidentals; a tie keeps the given spelling", () => {
    expect(["D#", "G#", "C#", "A#", "Cb", "Fb", "E#"].map((k) => fewestAccidentals(k))).toEqual(["Eb", "Ab", "Db", "Bb", "B", "E", "F"]);
    expect(["F#", "Gb", "B", "Db", "E", "C"].map((k) => fewestAccidentals(k))).toEqual(["F#", "Gb", "B", "Db", "E", "C"]);
    fc.assert(
      fc.property(fc.constantFrom(...SPELLED.filter((n) => !/bb|##|x/.test(n))), fc.constantFrom("major" as const, "minor" as const), (n, mode) => {
        const k = fewestAccidentals(n, mode);
        expect(chroma(k)).toBe(chroma(n));
        expect(Math.abs(keySignature(k, mode))).toBeLessThanOrEqual(Math.min(6, Math.abs(keySignature(n, mode))));
      }),
    );
  });

  it("respells only keys with more than 7 accidentals: D♭ and G♭ minor become C♯ and F♯ minor, A♭ minor stays", () => {
    expect(playableKey("Db", "minor")).toBe("C#");
    expect(playableKey("Gb", "minor")).toBe("F#");
    expect(playableKey("Ab", "minor")).toBe("Ab");
    expect(playableKey("Eb", "minor")).toBe("Eb");
    expect(playableKey("Db")).toBe("Db");
    expect(playableKey("D#")).toBe("Eb");
  });
});
