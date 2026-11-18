import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { romanFor } from "../src/analysis";
import {
  altsFrom,
  diatonicChords,
  chipOf,
  FUNCTION_CHIPS,
  judge,
  LEVELS,
  makeRound,
  masteryProgress,
  MAX_OPTIONS,
  motionFor,
  optionsFor,
  planSession,
  scoreStep,
  semitonesUp,
  spellInKey,
  verdictLine,
  type AnswerRecord,
  type LevelId,
  type Round,
  type RoundKind,
} from "../src/ears";
import { chroma, mod } from "../src/pitch";
import { KEYS } from "../src/transpose";

/*
 * Make the Changes, step 2: rounds, option cards, judging and scoring. The ten properties the
 * plan asked for, over every v1 level, key and seed, plus a few worked examples.
 */

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const levelArb = fc.constantFrom<LevelId>(1, 2, 3);
/** A level, one of its keys, and a seed. */
const gameArb = levelArb.chain((level) => fc.tuple(fc.constant(level), fc.constantFrom(...LEVELS[level - 1].keys), fc.nat()));
const roundArb = gameArb.map(([level, key, seed]) => makeRound(level, key, seed));

const chordsOf = (r: Round) => [r.steps[0].from, ...r.steps.map((s) => s.expected)];

describe("rounds", () => {
  it("1 · every round is a connected chain of steps that lands home on I", () => {
    fc.assert(
      fc.property(roundArb, (r) => {
        expect(r.steps.length).toBeGreaterThan(0);
        expect(r.steps.at(-1)!.expected.degree).toBe(1);
        for (let i = 1; i < r.steps.length; i++) expect(r.steps[i].from).toEqual(r.steps[i - 1].expected);
        expect(r.steps[0].from.degree).toBe(r.start);
        // home only at the end (a turnaround starts there too)
        for (const s of r.steps.slice(0, -1)) expect(s.expected.degree).not.toBe(1);
      }),
    );
  });

  it("2 · every step moves the way its motion says: down a fifth, the one wider step at IV → vii, the door up a sixth", () => {
    fc.assert(
      fc.property(roundArb, (r) => {
        for (const s of r.steps) {
          expect(motionFor(s.from.degree!, s.expected.degree!)).toBe(s.motion);
          const up = semitonesUp(s.from, s.expected);
          if (s.motion === "door") expect(up).toBe(9);
          else expect(up).toBe(s.from.degree === 4 ? 6 : 5);
        }
      }),
    );
  });

  it("3 · every chord sits on its degree of the major scale, with the numeral the engine's analysis gives it", () => {
    fc.assert(
      fc.property(roundArb, (r) => {
        for (const c of chordsOf(r)) {
          expect(mod(c.pc - chroma(r.key), 12)).toBe(MAJOR_SCALE[c.degree! - 1]);
          expect(c.numeral).toBe(romanFor({ root: c.root, quality: c.quality }, r.key).roman);
        }
      }),
    );
  });

  it("4 · spells every chord in its key's signature: no sharps in C, F, B♭ or E♭, only F♯ in G", () => {
    fc.assert(
      fc.property(roundArb, (r) => {
        for (const c of chordsOf(r)) {
          if (r.key === "G") expect(["F#", "C", "D", "E", "G", "A", "B"]).toContain(c.root);
          else expect(c.root).not.toContain("#");
        }
      }),
    );
  });

  it("each level deals only its own kinds of round", () => {
    const kinds: Record<LevelId, RoundKind[]> = { 1: ["landing"], 2: ["landing", "setup"], 3: ["walkHome", "turnaround"] };
    fc.assert(
      fc.property(gameArb, ([level, key, seed]) => {
        expect(kinds[level]).toContain(makeRound(level, key, seed).kind);
      }),
    );
    expect(() => makeRound(1, "C", 1, { kind: "turnaround" })).toThrow();
  });

  it("works through the turnaround in F as F, Dm, Gm, C7, F", () => {
    const r = makeRound(3, "F", 7, { kind: "turnaround" });
    expect(chordsOf(r).map((c) => c.symbol)).toEqual(["Fmaj7", "Dm7", "Gm7", "C7", "Fmaj7"]);
    expect(r.steps.map((s) => s.motion)).toEqual(["door", "staircase", "setup", "landing"]);
  });
});

describe("judging", () => {
  const stepArb = roundArb.chain((r) => fc.tuple(fc.constant(r), fc.constantFrom(...r.steps)));

  it("5 · the expected root is right in any octave", () => {
    fc.assert(
      fc.property(stepArb, fc.integer({ min: 2, max: 8 }), ([r, s], octave) => {
        expect(judge(s, r.key, s.expected.pc + 12 * octave)).toEqual({ kind: "right" });
      }),
    );
  });

  it("6 · every alternative from here is a different root from the answer, and is judged a valid alternative", () => {
    fc.assert(
      fc.property(stepArb, ([r, s]) => {
        for (const a of altsFrom(r.key, s.from)) {
          expect(a.chord.pc).not.toBe(s.expected.pc);
          const v = judge(s, r.key, a.chord.pc + 48);
          expect(v).toMatchObject({ kind: "alt", move: a.id });
        }
      }),
    );
  });

  it("7 · any other root is wrong, and is read as a chord in the key where it is one", () => {
    fc.assert(
      fc.property(stepArb, ([r, s]) => {
        const alt = new Set(altsFrom(r.key, s.from).map((a) => a.chord.pc));
        for (let pc = 0; pc < 12; pc++) {
          if (pc === s.expected.pc || alt.has(pc)) continue;
          const v = judge(s, r.key, pc);
          // the only other "works" answers are the game's own motions from here (I → IV when the round goes I → vi)
          const own = v.kind === "alt" && v.played.degree !== null && motionFor(s.from.degree!, v.played.degree) !== null;
          if (!own) expect(v.kind).toBe("wrong");
          if (v.kind === "wrong") expect(v.played.pc).toBe(pc);
        }
      }),
    );
  });

  it("calls I → IV on a turnaround a valid move (the staircase), and the line says where the round goes", () => {
    const r = makeRound(3, "C", 1, { kind: "turnaround" });
    const v = judge(r.steps[0], "C", chroma("F"));
    expect(v).toMatchObject({ kind: "alt", move: "staircase" });
    expect(verdictLine(r.steps[0], "C", v)).toMatch(/This round goes to Am7/);
  });

  it("D♭ instead of D in E♭ (the staircase's wider step) is the backdoor: half credit, not wrong", () => {
    const r = makeRound(3, "Eb", 1, { kind: "walkHome", start: 4 });
    const v = judge(r.steps[0], "Eb", chroma("Db"));
    expect(v).toMatchObject({ kind: "alt", move: "backdoor" });
    expect(judge(r.steps[0], "Eb", chroma("D"))).toEqual({ kind: "right" });
    expect(verdictLine(r.steps[0], "Eb", v)).toMatch(/This round goes to Dm7♭5/);
  });

  it("every verdict comes with a line the player can read", () => {
    fc.assert(
      fc.property(stepArb, fc.integer({ min: 0, max: 11 }), ([r, s], pc) => {
        const line = verdictLine(s, r.key, judge(s, r.key, pc));
        expect(line.length).toBeGreaterThan(10);
        expect(line).not.toMatch(/undefined|#|\b[A-G]b/);
      }),
    );
  });
});

describe("option cards", () => {
  it("8 · at most three, all different roots, the answer always among them, and first in Guided", () => {
    fc.assert(
      fc.property(roundArb, fc.nat(), (r, seed) => {
        for (const s of r.steps) {
          const guided = optionsFor(s, r.key, "guided", seed);
          const choices = optionsFor(s, r.key, "choices", seed);
          for (const opts of [guided, choices]) {
            expect(opts.length).toBeGreaterThanOrEqual(2);
            expect(opts.length).toBeLessThanOrEqual(MAX_OPTIONS);
            expect(new Set(opts.map((o) => o.pc)).size).toBe(opts.length);
            expect(opts.map((o) => o.pc)).toContain(s.expected.pc);
            // at most one card is a valid-but-different move; the others are plainly wrong
            expect(opts.filter((o) => judge(s, r.key, o.pc).kind === "alt").length).toBeLessThanOrEqual(1);
          }
          expect(guided[0].pc).toBe(s.expected.pc);
          expect(new Set(choices.map((o) => o.pc))).toEqual(new Set(guided.map((o) => o.pc)));
        }
      }),
    );
  });
});

describe("determinism and sessions", () => {
  it("9 · the same seed always deals the same round and the same session", () => {
    fc.assert(
      fc.property(gameArb, ([level, key, seed]) => {
        expect(makeRound(level, key, seed)).toEqual(makeRound(level, key, seed));
        expect(planSession(level, seed)).toEqual(planSession(level, seed));
      }),
    );
  });

  it("10 · due reviews come first, in their own keys; then random keys, never the same twice in a row", () => {
    const due = [
      { ruleId: "ear:setup", keyTonic: "Bb" },
      { ruleId: "dominant.tritoneSub", keyTonic: "C" }, // a reharm review: not this game's
      { ruleId: "ear:staircase", keyTonic: "F" }, // Level 2 doesn't teach the staircase
      { ruleId: "ear:landing", keyTonic: "A#" }, // the same key, spelled differently
    ];
    fc.assert(
      fc.property(fc.nat(), (seed) => {
        const s = planSession(2, seed, due);
        expect(s).toHaveLength(10);
        expect([s[0].key, s[0].kind]).toEqual(["Bb", "setup"]);
        expect([s[1].key, s[1].kind]).toEqual(["Bb", "landing"]);
        for (let i = 3; i < s.length; i++) expect(s[i].key).not.toBe(s[i - 1].key);
        for (const r of s) expect(LEVELS[1].keys).toContain(r.key);
      }),
    );
    const l3 = planSession(3, 5, [{ ruleId: "ear:door", keyTonic: "G" }, { ruleId: "ear:staircase", keyTonic: "Eb" }]);
    expect([l3[0].kind, l3[0].key]).toEqual(["turnaround", "G"]);
    expect([l3[1].kind, l3[1].key, l3[1].start]).toEqual(["walkHome", "Eb", 7]);
  });
});

describe("scoring", () => {
  it("pays more for less help, half for a valid alternative, and +4 for naming the function at Open", () => {
    expect([scoreStep("guided", "right"), scoreStep("guided", "alt"), scoreStep("guided", "wrong")]).toEqual([3, 1, 0]);
    expect([scoreStep("choices", "right"), scoreStep("choices", "alt"), scoreStep("choices", "wrong")]).toEqual([6, 3, 0]);
    expect([scoreStep("open", "right"), scoreStep("open", "alt"), scoreStep("open", "wrong")]).toEqual([10, 5, 0]);
    expect(scoreStep("open", "right", true)).toBe(14);
    expect(scoreStep("choices", "right", true)).toBe(6); // the chip is only asked at Open
    expect(scoreStep("open", "alt", true)).toBe(5);
  });

  it("names each chord's function chip from its numeral", () => {
    const chips = [1, 2, 3, 4, 5, 6, 7].map((d) => chipOf(spellInKey("Bb", d as 1)));
    expect(chips).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii"]);
    expect(FUNCTION_CHIPS[3]).toEqual(chips);
    for (const c of FUNCTION_CHIPS[2]) expect(chips).toContain(c);
  });
});

describe("mastery", () => {
  let id = 0;
  const answer = (o: Partial<AnswerRecord> & Pick<AnswerRecord, "key">): AnswerRecord => ({
    stage: "open",
    verdict: "right",
    chipRight: null,
    round: { id: id++, kind: "landing", start: 5, steps: 1 },
    ...o,
  });

  it("Level 1: ten right in a row at Open, in both C and F", () => {
    const tenC = Array.from({ length: 10 }, () => answer({ key: "C" }));
    expect(masteryProgress(1, tenC, ["C", "F"])).toMatchObject({ mastered: false, detail: "10 of 10 in a row; F still to come." });
    expect(masteryProgress(1, [...tenC.slice(1), answer({ key: "F" })], ["C", "F"]).mastered).toBe(true);
    // a miss resets the run; help (Guided/Choices) doesn't count but doesn't break it either
    const broken = [...tenC.slice(0, 5), answer({ key: "F", verdict: "wrong" }), ...tenC.slice(5), answer({ key: "F", stage: "guided" })];
    expect(masteryProgress(1, broken, ["C", "F"]).mastered).toBe(false);
  });

  it("Level 2: the run needs the function named every time", () => {
    const keys = ["C", "F", "Bb"];
    const run = Array.from({ length: 10 }, (_, i) => answer({ key: keys[i % 3], chipRight: true }));
    expect(masteryProgress(2, run, keys).mastered).toBe(true);
    const chipMiss = run.map((a, i) => (i === 9 ? { ...a, chipRight: false } : a));
    expect(masteryProgress(2, chipMiss, keys).mastered).toBe(false);
  });

  it("Level 3: two clean walks home from vii or iii in two keys, and one clean turnaround", () => {
    const round = (key: string, kind: RoundKind, start: number, steps: number, ok = true): AnswerRecord[] => {
      const rid = id++;
      return Array.from({ length: steps }, (_, i) =>
        answer({ key, chipRight: ok || i > 0, round: { id: rid, kind, start, steps } }),
      );
    };
    const walkC = round("C", "walkHome", 7, 5);
    const walkG = round("G", "walkHome", 3, 4);
    const turn = round("F", "turnaround", 1, 4);
    expect(masteryProgress(3, [...walkC, ...walkG, ...turn], []).mastered).toBe(true);
    expect(masteryProgress(3, [...walkC, ...round("C", "walkHome", 3, 4), ...turn], []).mastered).toBe(false); // one key twice
    expect(masteryProgress(3, [...walkC, ...walkG, ...round("F", "turnaround", 1, 4, false)], []).mastered).toBe(false); // a chip missed
    expect(masteryProgress(3, [...walkC, ...round("G", "walkHome", 5, 1), ...turn], []).mastered).toBe(false); // from V doesn't count
  });
});

describe("the key picker", () => {
  it("a session can be narrowed to one key, or opened to any of the 12, on any level", () => {
    fc.assert(
      fc.property(fc.constantFrom<LevelId>(1, 2, 3), fc.constantFrom(...KEYS), fc.nat(), (level, key, seed) => {
        const s = planSession(level, seed, [], 10, [key]);
        expect(s.every((r) => r.key === key)).toBe(true); // one key: every round in it (repeats allowed)
        for (const r of s) for (const st of r.steps) expect(judge(st, key, st.expected.pc)).toEqual({ kind: "right" });
      }),
    );
    const all = planSession(1, 3, [], 40, KEYS);
    expect(new Set(all.map((r) => r.key)).size).toBeGreaterThan(5);
    for (let i = 1; i < all.length; i++) expect(all[i].key).not.toBe(all[i - 1].key);
  });

  it("due reviews in a key outside the chosen ones wait for another session", () => {
    const s = planSession(1, 1, [{ ruleId: "ear:landing", keyTonic: "D" }, { ruleId: "ear:landing", keyTonic: "A" }], 10, ["A"]);
    expect(s.map((r) => r.key).every((k) => k === "A")).toBe(true);
    // with D allowed too, its review comes first
    expect(planSession(1, 1, [{ ruleId: "ear:landing", keyTonic: "D" }], 10, ["A", "D"])[0].key).toBe("D");
  });

  it("every one of the 12 keys spells its chords on seven letters, with the engine's numerals (C♭ in G♭, E♯°7 in E)", () => {
    for (const k of KEYS) {
      const chords = diatonicChords(k);
      expect(new Set(chords.map((c) => c.root[0])).size).toBe(7);
      expect(chords.map((c) => c.numeral)).toEqual(["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"]);
    }
    expect(spellInKey("Gb", 4).root).toBe("Cb");
    expect(altsFrom("E", spellInKey("E", 1))[0].chord.symbol).toBe("E#dim7");
    expect(altsFrom("B", spellInKey("B", 1))[0].chord.symbol).toBe("B#dim7");
  });
});
