import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, QUALITIES, symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { buildPathway, realize } from "../src/pathway";
import { chroma, mod, transpose } from "../src/pitch";
import { someday } from "../src/fixtures/someday";
import { upperPitchClasses, voiceChord, voiceProgression } from "../src/voicing";
import { progressionArb, ROOTS } from "./arbitraries";

const pcs = (ms: number[]) => new Set(ms.map((m) => mod(m, 12)));

describe("voicing engine", () => {
  it("always voices the guide tones, puts the root in the bass, and stays in a playable range", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROOTS), fc.constantFrom(...QUALITIES), (root, quality) => {
        const chord = { root, quality, extensions: [], alterations: [] };
        const v = voiceChord(chord);
        expect(mod(v.bass, 12)).toBe(chroma(root));
        expect(v.bass).toBeGreaterThanOrEqual(38);
        expect(v.bass).toBeLessThan(50);
        for (const g of guideTones(chord)) expect(pcs(v.upper).has(chroma(g.note))).toBe(true);
        expect(Math.min(...v.upper)).toBeGreaterThanOrEqual(52);
        expect(Math.max(...v.upper)).toBeLessThanOrEqual(81);
        expect([...v.upper].sort((a, b) => a - b)).toEqual(v.upper);
      }),
    );
  });

  it("never plays a note that isn't a chord tone or a standard colour tone", () => {
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 0, max: 4 }), (tune, level) => {
        const chords = realize(tune, buildPathway(generateMoves(tune).accepted, level));
        voiceProgression(chords).forEach((v, i) => {
          const c = chords[i];
          const allowed = new Set(chordTones({ ...c, extensions: [...c.extensions, "9", "13"] }).map((t) => chroma(t.note)));
          for (const m of v.upper) expect(allowed.has(mod(m, 12))).toBe(true);
        });
      }),
    );
  });

  it("the gospel turnaround is heard as a half-step slide into the tonic", () => {
    const chords = realize(someday, buildPathway(generateMoves(someday).accepted, 3));
    const i = chords.findIndex((c) => symbol(c) === "B13(#11)");
    const [approach, target] = voiceProgression(chords).slice(i, i + 2);
    // every right-hand voice of the target is within a whole step of a voice in the approach chord
    for (const n of target.upper) expect(Math.min(...approach.upper.map((m) => Math.abs(m - n)))).toBeLessThanOrEqual(1);
    expect(approach.upper).toHaveLength(5);
    expect(target.bass - approach.bass === -1 || target.bass - approach.bass === 11).toBe(true);
  });

  it("puts alterations in the right hand", () => {
    const g = { root: "G", quality: "7" as const, extensions: [], alterations: ["#9", "b13"] };
    const up = upperPitchClasses(g).map(chroma);
    expect(up).toContain(chroma(transpose("G", "#9")));
    expect(up).toContain(chroma(transpose("G", "b13")));
  });
});
