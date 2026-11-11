import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BASE_INTERVAL_NAMES, chroma, INTERVALS, letterIndex, mod, prettySymbol, simplifyNote, transpose } from "../src/pitch";
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
