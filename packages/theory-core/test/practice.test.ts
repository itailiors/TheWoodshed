import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, symbol } from "../src/chords";
import { diffStrike, diffVoiceLeading, drillSteps } from "../src/coach";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { chordAtBeat, evaluateLineNote } from "../src/lineEval";
import { chroma, midiOf, mod, spellMidi } from "../src/pitch";
import { suggestScales } from "../src/scales";
import { KEYS, transposeTune } from "../src/transpose";
import { progressionArb } from "./arbitraries";

const RUNS = { numRuns: 200 };
const keyArb = fc.constantFrom(...KEYS);

describe("spelled MIDI", () => {
  it("midiOf and spellMidi round-trip, including Cb and B#", () => {
    expect(midiOf("Bb4")).toBe(70);
    expect(midiOf("Cb5")).toBe(71);
    expect(midiOf("B#4")).toBe(72);
    expect(spellMidi("Cb", 71)).toBe("Cb5");
    fc.assert(
      fc.property(fc.constantFrom("C", "Db", "D#", "Fb", "E#", "Gb", "A", "Bb", "Cb", "B#"), fc.integer({ min: 1, max: 7 }), (pc, oct) => {
        expect(spellMidi(pc, midiOf(pc + oct))).toBe(pc + oct);
      }),
    );
  });
});

describe("12-key transfer", () => {
  it("transposing a tune moves every chord root by the same interval and keeps qualities", () => {
    fc.assert(
      fc.property(progressionArb, keyArb, (tune, key) => {
        const t = transposeTune(tune, key);
        const shift = mod(chroma(key) - chroma(tune.key.tonic), 12);
        t.harmony.forEach((c, i) => {
          expect(mod(chroma(c.root) - chroma(tune.harmony[i].root), 12)).toBe(shift);
          expect(c.quality).toBe(tune.harmony[i].quality);
        });
        t.melody.forEach((n, i) => {
          const d = midiOf(n.pitch) - midiOf(tune.melody[i].pitch);
          expect(mod(d, 12)).toBe(shift);
          expect(Math.abs(d)).toBeLessThanOrEqual(6);
        });
      }),
      RUNS,
    );
  });

  it("the engine finds the same moves in every key (rules are interval-based)", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const a = generateMoves(someday);
        const b = generateMoves(transposeTune(someday, key));
        expect(b.accepted.map((m) => m.id)).toEqual(a.accepted.map((m) => m.id));
        expect(b.rejected.map((r) => r.move.id)).toEqual(a.rejected.map((r) => r.move.id));
        const shift = mod(chroma(key) - chroma("Bb"), 12);
        b.accepted.forEach((m, i) =>
          m.chords.forEach((c, j) => expect(mod(chroma(c.root) - chroma(a.accepted[i].chords[j].root), 12)).toBe(shift)),
        );
      }),
    );
  });

  it("gospel sus display respells with the key", () => {
    const g = generateMoves(transposeTune(someday, "D")).accepted.find((m) => m.ruleId === "gospel.halfStepTurnaround")!;
    expect(g.chords.map(symbol)).toEqual(["G/A", "Eb13(#11)"]);
  });
});

describe("comping coach diff", () => {
  const steps = (key: string) => {
    const t = transposeTune(someday, key);
    return generateMoves(t).accepted.flatMap((m) => drillSteps(t, m));
  };

  it("the engine's own voicing is always judged perfect", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        for (const s of steps(key)) {
          const d = diffStrike([s.target.bass, ...s.target.upper], s);
          expect(d.verdict).toBe("perfect");
          expect(d.comments.filter((c) => /Missing|avoid|isn't/.test(c))).toEqual([]);
        }
      }),
      { numRuns: 24 },
    );
  });

  it("dropping a guide tone is flagged as incomplete, with the red-pen position", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        for (const s of steps(key)) {
          const third = guideTones(s.chord)[0];
          const played = [s.target.bass, ...s.target.upper].filter((m) => mod(m, 12) !== chroma(third.note));
          const d = diffStrike(played, s);
          expect(d.verdict).toBe("incomplete");
          const miss = d.guideTones.find((g) => !g.present)!;
          expect(mod(miss.targetMidi, 12)).toBe(chroma(third.note));
        }
      }),
      { numRuns: 24 },
    );
  });

  it("any inversion of the right notes is correct, and rootless voicings pass", () => {
    const [fm9] = drillSteps(someday, generateMoves(someday).accepted.find((m) => m.id === "functional.secondaryTwoFive@2.1")!);
    const pcs = chordTones(fm9.chord).map((t) => chroma(t.note));
    const spread = pcs.map((c, i) => 60 + mod(c - 0, 12) + (i % 2) * 12);
    expect(["correct", "perfect"]).toContain(diffStrike([41, ...spread], fm9).verdict);
    // rootless: Ab C Eb G (3 5 7 9)
    const rootless = diffStrike([56, 60, 63, 67], fm9);
    expect(rootless.verdict).not.toBe("wrong");
    expect(rootless.bass.rootless).toBe(true);
  });

  it("a natural 11 on a major 7 chord is called out as an avoid note", () => {
    const step = steps("Bb").find((s) => s.symbol === "Ebmaj7")!;
    const d = diffStrike([39, 55, 58, 62, 68], step); // Ab = natural 11 over Ebmaj7
    expect(d.verdict).toBe("wrong");
    expect(d.wrongNotes[0].why).toMatch(/avoid/);
  });

  it("voice-leading check: the engine's path is smooth, a big leap is not", () => {
    const [a, b] = drillSteps(someday, generateMoves(someday).accepted.find((m) => m.id === "functional.secondaryTwoFive@2.1")!);
    const ok = diffVoiceLeading([a.target.bass, ...a.target.upper], [b.target.bass, ...b.target.upper], a, b);
    expect(ok.smooth).toBe(true);
    const jumpy = diffVoiceLeading([a.target.bass, ...a.target.upper], [b.target.bass, ...b.target.upper.map((m, i) => (i === 0 ? m + 12 : m))], a, b);
    expect(jumpy.smooth).toBe(false);
  });
});

describe("improv line evaluation", () => {
  it("chord tones are chord tones, the top scale has no surprises, and the natural 11 on maj7 is avoid", () => {
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 48, max: 84 }), (tune, midi) => {
        for (const c of tune.harmony) {
          const ev = evaluateLineNote(midi, c);
          const isTone = chordTones(c).some((t) => chroma(t.note) === mod(midi, 12));
          expect(ev.verdict === "chord-tone").toBe(isTone);
          const top = suggestScales(c)[0];
          if (top && top.notes.some((n) => chroma(n) === mod(midi, 12))) expect(ev.verdict).not.toBe("outside");
        }
      }),
      RUNS,
    );
    const ebmaj7 = someday.harmony.find((c) => c.root === "Eb")!;
    expect(evaluateLineNote(68, ebmaj7).verdict).toBe("avoid"); // Ab
    expect(evaluateLineNote(65, ebmaj7)).toMatchObject({ verdict: "tension", role: "9" }); // F
  });

  it("names every note's role, even awkward spellings (D over D♭9 is the ♭9)", () => {
    const db9 = { id: "x", at: { bar: 1, beat: 1 }, beats: 3, root: "Db", quality: "7" as const, extensions: ["9"], alterations: [] };
    expect(evaluateLineNote(62, db9).role).toBe("b9");
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 48, max: 84 }), (tune, midi) => {
        for (const c of tune.harmony) expect(evaluateLineNote(midi, c).role).not.toMatch(/\?/);
      }),
      RUNS,
    );
  });

  it("finds the chord under any beat", () => {
    expect(chordAtBeat(someday.harmony, 4.5, 3)?.chord.root).toBe("D");
    expect(chordAtBeat(someday.harmony, 99, 3)).toBeNull();
  });
});
