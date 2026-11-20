import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, symbol } from "../src/chords";
import { conceptDrillSteps, diffStrike, diffVoiceLeading, drillSteps } from "../src/coach";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES } from "../src/index";
import { ARTICLE_BEFORE_NOTE, BANNED_PHRASES } from "../src/learn/lesson";
import { chordAtBeat, evaluateLineNote, isOnBeat, isPassingTone } from "../src/lineEval";
import { chroma, midiOf, mod, prettySymbol, spellMidi } from "../src/pitch";
import { RULES } from "../src/ruleset";
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

  it("conceptDrillSteps generates tune-independent cadences for all 17 rules across all 12 keys with pedagogy and stepCue", () => {
    expect(RULES.length).toBe(17);
    for (const r of RULES) {
      expect(r.pedagogy).toBeDefined();
      expect(r.pedagogy!.formula.length).toBeGreaterThan(0);
      expect(r.pedagogy!.whyItWorks.length).toBeGreaterThan(0);
      for (const k of KEYS) {
        const res = conceptDrillSteps(r.id, k);
        expect(res.move?.ruleId).toBe(r.id);
        expect(res.length).toBeGreaterThanOrEqual(2);
        for (const s of res) {
          expect(s.stepCue.role.length).toBeGreaterThan(0);
          expect(s.stepCue.whyHere.length).toBeGreaterThan(0);
          const d = diffStrike([s.target.bass, ...s.target.upper], s);
          expect(d.verdict).toBe("perfect");
        }
      }
    }
  });

  describe("step cues", () => {
    const BANNED = BANNED_PHRASES;
    const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const NOTE = /(?<![\p{L}\p{N}])[A-G][♭♯]*(?![\p{L}\p{N}])/gu;

    /** Every drill a player can open: the 17 canonical concept drills and every bundled tune's moves, in 12 keys. */
    const drills = () =>
      KEYS.flatMap((k) => [
        ...RULES.map((r) => {
          const res = conceptDrillSteps(r.id, k);
          return { where: `${r.id} in ${k}`, move: res.move!, steps: [...res] };
        }),
        ...BUNDLED_TUNES.flatMap((tune) => {
          const t = transposeTune(tune, k);
          return generateMoves(t).accepted.map((m) => ({ where: `${tune.id} ${m.id} in ${k}`, move: m, steps: drillSteps(t, m) }));
        }),
      ]);
    let cached: ReturnType<typeof drills> | undefined;
    const allDrills = () => (cached ??= drills());

    it("no rule falls through to the generic cue", () => {
      const all = allDrills();
      const ruled = new Set(all.map((d) => d.move.ruleId));
      expect(ruled.size).toBe(17);
      for (const { where, steps } of all) {
        for (const s of steps) expect(s.stepCue.whyHere, `${where} ${s.symbol}`).not.toMatch(/^Voice-lead guide tones/);
      }
    });

    it("cues are ≤ 25 words, display-spelled, with no hype and no article before a note", () => {
      for (const { where, steps } of allDrills()) {
        for (const s of steps) {
          const at = `${where} ${s.symbol}: "${s.stepCue.whyHere}"`;
          expect(words(s.stepCue.whyHere), at).toBeLessThanOrEqual(25);
          for (const text of [s.stepCue.whyHere, s.stepCue.role]) {
            expect(text, at).not.toMatch(BANNED);
            expect(text, at).not.toMatch(/#|undefined|NaN|\?/);
            expect(text, at).not.toMatch(/(?<![A-Za-z])[A-G]b+(?![a-ce-ln-z])/);
            expect(text, at).not.toMatch(ARTICLE_BEFORE_NOTE);
            // the lessons' rule: no double flat or sharp a reader has to decode (B♭♭ reads A)
            expect(text, `${at}: double accidental`).not.toMatch(/♭♭|♯♯|𝄫|𝄪/u);
          }
        }
      }
    });

    it("every note a cue names is in the chord under your hands (its tones or the engine's voicing), in 12 keys", () => {
      for (const { where, move, steps } of allDrills()) {
        const symbols = [...steps.map((s) => s.chord), ...move.original]
          .map((c) => prettySymbol(symbol(c)))
          .sort((a, b) => b.length - a.length);
        for (const s of steps) {
          const held = new Set([...chordTones(s.chord).map((t) => chroma(t.note)), ...[s.target.bass, ...s.target.upper].map((m) => mod(m, 12))]);
          const text = symbols.reduce((t, sym) => t.split(sym).join(" "), s.stepCue.whyHere);
          for (const n of text.match(NOTE) ?? []) {
            expect(held.has(chroma(n.replace(/♭/g, "b").replace(/♯/g, "#"))), `${where} ${s.symbol}: ${n} in "${s.stepCue.whyHere}"`).toBe(true);
          }
        }
      }
    });
  });

  it("drills the 3 new curriculum moves (rootlessTwoFiveOne, upperStructureII, minorLineCliche)", () => {
    const rootless = conceptDrillSteps("voicing.rootlessTwoFiveOne", "C");
    expect(rootless.move!.voicingHints).toHaveLength(3);
    expect(rootless.map((s) => s.symbol)).toEqual(["Dm9", "G13", "Cmaj7"]);
    // Dm9 Type A (F A C E) -> G13 Type B (F A B E): 3 common tones held, C drops 1 semitone to B
    expect(rootless.move!.voicingHints![0]).toEqual({ lh: ["F", "A"], rh: ["C", "E"] });
    expect(rootless.move!.voicingHints![1]).toEqual({ lh: ["F", "A"], rh: ["B", "E"] });
    expect(rootless.move!.voicingHints![2]).toEqual({ lh: ["E", "G"], rh: ["B", "D"] });

    const usII = conceptDrillSteps("voicing.upperStructureII", "C");
    expect(usII.map((s) => s.symbol)).toEqual(["G13(#11)", "Cmaj7"]);
    expect(usII.move!.voicingHint).toEqual({ lh: ["G", "B", "F"], rh: ["A", "C#", "E"] });

    const cliche = conceptDrillSteps("chromatic.minorLineCliche", "C");
    expect(cliche.map((s) => s.symbol)).toEqual(["Cm(add9)", "Cm(maj7)", "Cm9", "Cm6", "Fm7"]);
  });
});

describe("passing tones in an improvised line", () => {
  const avoid = { verdict: "avoid" as const };
  it("a short off-beat avoid note is passing; held, on the beat, or not an avoid note, it isn't", () => {
    expect(isPassingTone(avoid, 1.5, 1.75)).toBe(true); // the 'and' of 2, an eighth or less
    expect(isPassingTone(avoid, 1.5, 2.0)).toBe(false); // held half a beat: it's heard
    expect(isPassingTone(avoid, 2.1, 2.3)).toBe(false); // within the on-beat window
    expect(isPassingTone({ verdict: "tension" }, 1.5, 1.75)).toBe(false);
  });
  it("the on-beat window is the same one the strong-beat stats use", () => {
    expect(isOnBeat(3.15)).toBe(true);
    expect(isOnBeat(2.85)).toBe(true);
    expect(isOnBeat(3.2)).toBe(false);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 64, noNaN: true }), fc.double({ min: 0, max: 0.49, noNaN: true }), (start, len) => {
        expect(isPassingTone(avoid, start, start + len)).toBe(!isOnBeat(start));
      }),
    );
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
