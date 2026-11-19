import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, QUALITIES, symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { buildPathway, realize } from "../src/pathway";
import { chroma, mod, spellChroma, transpose } from "../src/pitch";
import { someday } from "../src/fixtures/someday";
import type { Quality } from "../src/types";
import { upperPitchClasses, VOICING_STYLES, voiceChord, voiceProgression, type VoicingStyle } from "../src/voicing";
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

  describe("voicing styles", () => {
    const seventh = fc.constantFrom<Quality>("maj7", "7", "m7", "m7b5", "6", "m6", "7sus4", "mMaj7");
    const chordArb = fc.record({ root: fc.constantFrom(...ROOTS), quality: seventh }).map(({ root, quality }) => ({ root, quality, extensions: [], alterations: [] }));
    const sorted = (v: number[]) => [...v].sort((a, b) => a - b);

    it("close is the default, so nothing that doesn't ask for a style changes", () => {
      fc.assert(
        fc.property(chordArb, (c) => {
          expect(voiceChord(c, undefined, { style: "close" })).toEqual(voiceChord(c));
        }),
      );
    });

    it("every style keeps the guide tones, ascends, and stays above the bass and in range", () => {
      fc.assert(
        fc.property(chordArb, fc.constantFrom(...VOICING_STYLES.map((s) => s.id)), (c, style) => {
          const v = voiceChord(c, undefined, { style });
          for (const g of guideTones(c)) expect(pcs(v.upper).has(chroma(g.note))).toBe(true);
          expect(sorted(v.upper)).toEqual(v.upper);
          expect(Math.min(...v.upper)).toBeGreaterThan(v.bass);
          expect(Math.max(...v.upper)).toBeLessThanOrEqual(81);
        }),
      );
    });

    it("drop 2 and drop 3: four voices, and raising the lowest an octave closes them into an octave, landing 2nd or 3rd from the top", () => {
      fc.assert(
        fc.property(chordArb, fc.constantFrom<VoicingStyle>("drop2", "drop3"), (c, style) => {
          const v = voiceChord(c, undefined, { style }).upper;
          expect(v).toHaveLength(4);
          const raised = v[0] + 12;
          const closed = sorted([raised, ...v.slice(1)]);
          expect(closed[3] - closed[0]).toBeLessThan(12);
          expect(closed.indexOf(raised)).toBe(style === "drop2" ? 2 : 1);
        }),
      );
    });

    it("shells are the 3rd and 7th only, low in the left hand", () => {
      fc.assert(
        fc.property(chordArb, (c) => {
          const v = voiceChord(c, undefined, { style: "shell" }).upper;
          expect(pcs(v)).toEqual(new Set(guideTones(c).map((g) => chroma(g.note))));
          expect(Math.max(...v)).toBeLessThanOrEqual(62);
        }),
      );
    });

    it("three-zone puts one colour tone (not a guide tone) a 3rd or more above the shell", () => {
      fc.assert(
        fc.property(chordArb, (c) => {
          const v = voiceChord(c, undefined, { style: "threeZone" }).upper;
          const guides = new Set(guideTones(c).map((g) => chroma(g.note)));
          expect(v).toHaveLength(3);
          expect(guides.has(mod(v[2], 12))).toBe(false);
          expect(v[2] - v[1]).toBeGreaterThanOrEqual(3);
        }),
      );
    });

    it("a pinned top note (or the chord's topVoice) is always the highest voice, in every style", () => {
      fc.assert(
        fc.property(chordArb, fc.constantFrom(...VOICING_STYLES.map((s) => s.id)), fc.integer({ min: 0, max: 3 }), (c, style, pick) => {
          const tone = guideTones(c)[pick % guideTones(c).length];
          const top = 67 + mod(chroma(tone.note) - 67, 12);
          const topVoice = `${spellChroma(top)}${Math.floor(top / 12) - 1}`;
          for (const v of [voiceChord(c, undefined, { style, top }), voiceChord({ ...c, topVoice }, undefined, { style })]) {
            expect(Math.max(...v.upper)).toBe(top);
            expect(v.upper.filter((m) => m === top)).toHaveLength(1);
          }
        }),
      );
    });
  });

  it("puts alterations in the right hand", () => {
    const g = { root: "G", quality: "7" as const, extensions: [], alterations: ["#9", "b13"] };
    const up = upperPitchClasses(g).map(chroma);
    expect(up).toContain(chroma(transpose("G", "#9")));
    expect(up).toContain(chroma(transpose("G", "b13")));
  });
});
