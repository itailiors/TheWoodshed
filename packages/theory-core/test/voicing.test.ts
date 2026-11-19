import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, QUALITIES, symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { buildPathway, realize } from "../src/pathway";
import { chroma, mod, spellChroma, transpose } from "../src/pitch";
import { someday } from "../src/fixtures/someday";
import { suggestScales } from "../src/scales";
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

    it("every root, quality and style keeps all voices above the bass (exhaustive, not sampled)", () => {
      // D♭m7♭5 in drop 3 used to drop its root onto the bass's own D♭; sampling only caught it now and then
      for (const root of ROOTS)
        for (const quality of ["maj7", "7", "m7", "m7b5", "6", "m6", "7sus4", "mMaj7"] as Quality[])
          for (const { id: style } of VOICING_STYLES) {
            const v = voiceChord({ root, quality, extensions: [], alterations: [] }, undefined, { style });
            expect(Math.min(...v.upper), `${root}${quality} ${style}`).toBeGreaterThan(v.bass);
          }
      const v = voiceChord({ root: "Db", quality: "m7b5", extensions: [], alterations: [] }, undefined, { style: "drop3" }).upper;
      expect(v).toHaveLength(4);
      const closed = sorted([v[0] + 12, ...v.slice(1)]);
      expect(closed[3] - closed[0]).toBeLessThan(12);
      expect(closed.indexOf(v[0] + 12)).toBe(1);
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

    describe("quartal", () => {
      const scaleOf = (c: Parameters<typeof voiceChord>[0]) => suggestScales(c)[0];
      const fourths = (v: number[]) => v.slice(1).map((m, i) => m - v[i]);

      it("stacks 3–4 fourths from the chord's scale, no avoid notes, no root, at most one tritone, guide tones kept", () => {
        for (const root of ROOTS)
          for (const quality of ["maj7", "7", "m7", "m7b5", "6", "7sus4"] as Quality[]) {
            const c = { root, quality, extensions: [], alterations: [] };
            const v = voiceChord(c, undefined, { style: "quartal" }).upper;
            const s = scaleOf(c);
            const label = `${root}${quality} ${v.join(" ")}`;
            expect(v.length, label).toBeGreaterThanOrEqual(3);
            expect(v.length, label).toBeLessThanOrEqual(4);
            for (const step of fourths(v)) expect([5, 6], label).toContain(step);
            expect(fourths(v).filter((s) => s === 6).length, label).toBeLessThanOrEqual(1);
            const scalePcs = new Set(s.notes.map(chroma));
            const avoid = new Set(s.avoid.map(chroma));
            for (const m of v) {
              expect(scalePcs.has(mod(m, 12)), label).toBe(true);
              expect(avoid.has(mod(m, 12)), label).toBe(false);
              expect(mod(m, 12), label).not.toBe(chroma(root));
            }
          }
      });

      it("the textbook grips: Cmaj7 B–E–A–D, C7 B♭–E–A–D, Cm7 F–B♭–E♭–A or B♭–E♭–A–D", () => {
        const names = (q: Quality) => voiceChord({ root: "C", quality: q, extensions: [], alterations: [] }, undefined, { style: "quartal" }).upper.map((m) => mod(m, 12));
        expect(names("maj7")).toEqual([11, 4, 9, 2]);
        expect(names("7")).toEqual([10, 4, 9, 2]);
        expect([[5, 10, 3, 9], [10, 3, 9, 2]]).toContainEqual(names("m7"));
      });

      it("planes: on a long chord the stack has a neighbour one scale step away, every voice moving the same way, still in the scale", () => {
        for (const root of ROOTS)
          for (const quality of ["maj7", "7", "m7", "7sus4"] as Quality[]) {
            const c = { root, quality, extensions: [], alterations: [] };
            const v = voiceChord(c, undefined, { style: "quartal" });
            const label = `${root}${quality}`;
            expect(v.plane, label).toBeDefined();
            const s = scaleOf(c);
            const scalePcs = new Set(s.notes.map(chroma));
            const avoid = new Set(s.avoid.map(chroma));
            const moves = v.plane!.map((m, i) => m - v.upper[i]);
            expect(moves.every((d) => d >= 1 && d <= 2) || moves.every((d) => d <= -1 && d >= -2), label).toBe(true);
            for (const m of v.plane!) {
              expect(scalePcs.has(mod(m, 12)), label).toBe(true);
              expect(avoid.has(mod(m, 12)), label).toBe(false);
            }
            expect(Math.max(...v.plane!)).toBeLessThanOrEqual(81);
          }
      });

      it("only quartal planes", () => {
        const c = { root: "D", quality: "m7" as Quality, extensions: [], alterations: [] };
        for (const { id } of VOICING_STYLES) if (id !== "quartal") expect(voiceChord(c, undefined, { style: id }).plane).toBeUndefined();
      });
    });

    describe("spread", () => {
      const isTriad = (ms: number[]) => {
        const p = [...new Set(ms.map((m) => mod(m, 12)))].sort((a, b) => a - b);
        if (p.length !== 3) return false;
        return [0, 1, 2].some((r) => {
          const o = [...p.slice(r), ...p.slice(0, r)];
          const a = mod(o[1] - o[0], 12);
          const b = mod(o[2] - o[1], 12);
          return (a === 3 || a === 4) && (b === 3 || b === 4);
        });
      };

      it("the left hand plays a 10th (root–3rd), or root–♭7 on a sus chord, and the right hand a close 3-note grip above it", () => {
        for (const root of ROOTS)
          for (const quality of ["maj7", "7", "m7", "m7b5", "6", "m6", "7sus4", "mMaj7", "dim7"] as Quality[]) {
            const c = { root, quality, extensions: [], alterations: [] };
            const v = voiceChord(c, undefined, { style: "spread" });
            const [lh, ...rh] = v.upper;
            const label = `${root}${quality} ${v.bass} | ${v.upper.join(" ")}`;
            const third = chordTones(c).find((t) => ["3", "b3"].includes(t.degree));
            if (third) {
              expect(mod(lh, 12), label).toBe(chroma(third.note));
              expect(lh - v.bass, label).toBeGreaterThanOrEqual(15);
              expect(lh - v.bass, label).toBeLessThanOrEqual(16);
            } else expect(lh - v.bass, label).toBe(10);
            expect(rh, label).toHaveLength(3);
            expect(rh[0], label).toBeGreaterThan(lh);
            expect(rh[2] - rh[0], label).toBeLessThan(12);
          }
      });

      it("the right hand is a triad wherever one fits: Cmaj7 = G/C, C7 = Gm/C, Cm7 = Gm/C, C7sus = B♭/C, Cø = E♭m/C", () => {
        const rh = (q: Quality) => new Set(voiceChord({ root: "C", quality: q, extensions: [], alterations: [] }, undefined, { style: "spread" }).upper.slice(1).map((m) => mod(m, 12)));
        expect(rh("maj7")).toEqual(new Set([7, 11, 2]));
        expect(rh("7")).toEqual(new Set([7, 10, 2]));
        expect(rh("m7")).toEqual(new Set([7, 10, 2]));
        expect(rh("7sus4")).toEqual(new Set([10, 2, 5]));
        expect(rh("m7b5")).toEqual(new Set([3, 6, 10]));
        for (const q of ["maj7", "7", "m7", "7sus4", "m7b5", "mMaj7", "dim7"] as Quality[])
          expect(isTriad(voiceChord({ root: "F", quality: q, extensions: [], alterations: [] }, undefined, { style: "spread" }).upper.slice(1)), q).toBe(true);
      });

      it("an altered dominant keeps its alterations in the right hand", () => {
        const v = voiceChord({ root: "G", quality: "7", extensions: [], alterations: ["b9"] }, undefined, { style: "spread" });
        expect(pcs(v.upper.slice(1)).has(chroma("Ab"))).toBe(true);
      });
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
