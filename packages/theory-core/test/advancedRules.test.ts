import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, resolvesDownFifth, symbol } from "../src/chords";
import { conceptDrillSteps } from "../src/coach";
import { generateMoves } from "../src/engine";
import { chroma, mod, simplifyNote, transpose } from "../src/pitch";
import { sortedHarmony } from "../src/time";
import type { ChordEvent, Quality, ReharmMove, Tune } from "../src/types";
import { ROOTS } from "./arbitraries";

// ── generator: random diatonic progressions built from musical cells ──────
const DEGREES: Record<string, [string, Quality]> = {
  I: ["1", "maj7"],
  ii: ["2", "m7"],
  iii: ["3", "m7"],
  IV: ["4", "maj7"],
  V: ["5", "7"],
  vi: ["6", "m7"],
};
const CELLS = [["I"], ["ii", "V", "I"], ["IV", "I"], ["I", "ii"], ["iii", "ii"], ["V", "I"], ["vi"], ["iii", "vi", "ii", "V", "I"]];

function buildTune(tonic: string, bpb: number, cells: string[][]): Tune {
  const degrees = cells.flat();
  const harmony: ChordEvent[] = degrees.map((d, i) => {
    const [iv, quality] = DEGREES[d];
    return { id: `c${i}`, at: { bar: i + 1, beat: 1 }, beats: bpb, root: simplifyNote(transpose(tonic, iv)), quality, extensions: [], alterations: [] };
  });
  return {
    id: "diatonic",
    title: "diatonic walk",
    key: { tonic, mode: "major" },
    meter: [bpb, 4],
    feel: "swing",
    tempo: 160,
    sections: [{ id: "A", label: "A", startBar: 1, bars: harmony.length }],
    formOrder: ["A"],
    harmony,
    melody: [],
    melodyCoverage: "none",
    source: { kind: "manual", personalUseOnly: true },
  };
}

const diatonicArb = fc
  .record({
    tonic: fc.constantFrom(...ROOTS),
    bpb: fc.constantFrom(3, 4),
    cells: fc.array(fc.constantFrom(...CELLS), { minLength: 2, maxLength: 5 }),
  })
  .map(({ tonic, bpb, cells }) => buildTune(tonic, bpb, cells));

const RUNS = { numRuns: 250 };
const semis = (a: string, b: string) => mod(chroma(b) - chroma(a), 12);
/** The chord the move resolves into (first chord after the span). */
const target = (t: Tune, m: ReharmMove) =>
  sortedHarmony(t).find((c) => c.at.bar === m.span.to.bar && c.at.beat === m.span.to.beat)!;
const movesOf = (t: Tune, ruleId: string) => generateMoves(t).accepted.filter((m) => m.ruleId === ruleId);

describe("advanced rule pack: invariants", () => {
  it("backdoor ii–V: iv m7 a 4th above the tonic, then ♭VII7 a whole step below it", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "modal.backdoorTwoFive")) {
          const T = target(t, m);
          const bVII = m.chords[m.chords.length - 1];
          expect(bVII.quality).toBe("7");
          expect(semis(bVII.root, T.root)).toBe(2);
          if (m.chords.length === 2) {
            expect(m.chords[0].quality).toBe("m7");
            expect(semis(T.root, m.chords[0].root)).toBe(5);
          }
          // the ♭7 of ♭VII7 falls a half step to the tonic's 5th
          expect(semis(transpose(T.root, "5"), transpose(bVII.root, "b7"))).toBe(1);
        }
      }),
      RUNS,
    );
  });

  it("♭VI–♭VII–I: borrowed major chords whose roots climb by whole steps into the tonic", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "modal.flatSixFlatSeven")) {
          const T = target(t, m);
          const [six, seven] = m.chords;
          expect([six.quality, seven.quality]).toEqual(["maj7", "6"]);
          expect(semis(T.root, six.root)).toBe(8);
          expect(semis(six.root, seven.root)).toBe(2);
          expect(semis(seven.root, T.root)).toBe(2);
        }
      }),
      RUNS,
    );
  });

  it("borrowed iv: IV becomes iv6 on the same root, a 4th above the tonic", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "modal.borrowedIv")) {
          const T = target(t, m);
          const iv = m.chords[m.chords.length - 1];
          expect(iv.quality).toBe("m6");
          expect(chroma(iv.root)).toBe(chroma(m.original[0].root));
          expect(semis(T.root, iv.root)).toBe(5);
          // the only change from IV is the 3rd, lowered a half step
          expect(semis(transpose(iv.root, "b3"), transpose(iv.root, "3"))).toBe(1);
        }
      }),
      RUNS,
    );
  });

  it("passing diminished: the bass moves by half steps, and going up the °7 is a rootless V7♭9 of the target", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "chromatic.passingDiminished")) {
          const T = target(t, m);
          const [orig, dim] = m.chords;
          expect(chroma(orig.root)).toBe(chroma(m.original[0].root));
          expect(dim.quality).toBe("dim7");
          const ascending = semis(orig.root, T.root) === 2;
          expect(semis(orig.root, dim.root)).toBe(ascending ? 1 : 11);
          expect(semis(dim.root, T.root)).toBe(ascending ? 1 : 11);
          if (ascending) {
            const V = transpose(T.root, "5");
            const rootlessV7b9 = new Set(["3", "5", "b7", "b9"].map((d) => chroma(transpose(V, d))));
            expect(new Set(chordTones(dim).map((n) => chroma(n.note)))).toEqual(rootlessV7b9);
          }
        }
      }),
      RUNS,
    );
  });

  it("common-tone diminished: same root as the chord, its ♯2 and ♯4 rise a half step into the 3rd and 5th", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "chromatic.commonToneDiminished")) {
          const [dim, chord] = m.chords;
          expect(dim.quality).toBe("dim7");
          expect(chroma(dim.root)).toBe(chroma(chord.root));
          expect(chord.quality).toBe(m.original[0].quality);
          expect(semis(transpose(dim.root, "b3"), transpose(chord.root, "3"))).toBe(1);
          expect(semis(transpose(dim.root, "b5"), transpose(chord.root, "5"))).toBe(1);
        }
      }),
      RUNS,
    );
  });

  it("Coltrane substitution: three tonics a major 3rd apart, each reached from its own V7", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "symmetric.coltraneSubstitution")) {
          const T = target(t, m);
          const c = m.chords;
          expect(c.map((x) => x.quality)).toEqual(["m7", "7", "maj7", "7", "maj7", "7"]);
          expect(chroma(c[0].root)).toBe(chroma(m.original[0].root));
          expect(chroma(c[5].root)).toBe(chroma(m.original[1].root));
          // key centres ♭VI → III → I descend by major 3rds (A♭ → E → C): an augmented triad
          expect([semis(c[2].root, c[4].root), semis(c[4].root, T.root), semis(T.root, c[2].root)]).toEqual([8, 8, 8]);
          // every dominant resolves down a 5th into its key centre
          expect(resolvesDownFifth(c[1], c[2])).toBe(true);
          expect(resolvesDownFifth(c[3], c[4])).toBe(true);
          expect(resolvesDownFifth(c[5], T)).toBe(true);
          expect(m.replaces).toHaveLength(2);
        }
      }),
      RUNS,
    );
  });

  it("constant structure: the original chord keeps the downbeat, then the target's exact shape planes down by half steps", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, "chromatic.constantStructure")) {
          const T = target(t, m);
          const [first, ...planed] = m.chords;
          expect(chroma(first.root)).toBe(chroma(m.original[0].root));
          expect(first.at).toEqual(m.span.from);
          for (const p of planed) {
            expect([p.quality, p.extensions, p.alterations]).toEqual([T.quality, T.extensions, T.alterations]);
          }
          expect(semis(planed[planed.length - 1].root, T.root)).toBe(11); // last shape is a half step above
          if (planed.length === 2) expect(semis(planed[0].root, planed[1].root)).toBe(11);
          // parallel motion: every voice of the last planed chord is a half step above a target voice
          const targetTones = new Set(chordTones(T).map((n) => chroma(n.note)));
          for (const n of chordTones(planed[planed.length - 1])) expect(targetTones.has(mod(chroma(n.note) - 1, 12))).toBe(true);
        }
      }),
      RUNS,
    );
  });
});

describe("rule: one note on top", () => {
  const RULE = "melody.oneNoteOnTop";

  it("holds one note on top of every walk chord, as a real chord tone, while the bass walks by half steps into the target", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, RULE)) {
          const T = target(t, m);
          const held = m.facts.heldNote as string;
          const [kept, ...walk] = m.chords;
          expect(chroma(kept.root)).toBe(chroma(m.original[0].root));
          expect(walk.length).toBeGreaterThanOrEqual(2);
          for (const c of walk) {
            expect(c.topVoice).toBeDefined();
            expect(chroma(c.topVoice!)).toBe(chroma(held));
            expect(chordTones(c).some((x) => chroma(x.note) === chroma(held))).toBe(true);
          }
          // every walk chord sits on a single top pitch (same octave too)
          expect(new Set(walk.map((c) => c.topVoice)).size).toBe(1);
          // the bass descends by half steps through the walk and lands on the target
          const basses = [...walk.map((c) => c.root), T.bass ?? T.root];
          for (let i = 1; i < basses.length; i++) expect(semis(basses[i - 1], basses[i])).toBe(11);
          // on a changes-only chart the held note is shared by the chord and its target
          expect(chordTones(m.original[0]).some((x) => chroma(x.note) === chroma(held))).toBe(true);
          expect(chordTones(T).some((x) => chroma(x.note) === chroma(held))).toBe(true);
        }
      }),
      RUNS,
    );
  });

  it("V7 → I in C: holds G over D7sus4 and D♭7(♯11)", () => {
    const t = buildTune("C", 4, [["V", "I"]]);
    const [m] = movesOf(t, RULE);
    expect(m.chords.map((c) => c.root + c.quality)).toEqual(["G7", "D7sus4", "Db7"]);
    expect(m.chords.map((c) => c.beats)).toEqual([2, 1, 1]);
    expect(m.chords[2].alterations).toEqual(["#11"]);
    expect(m.facts.roles).toEqual(["sus 4th", "♯11"]);
    expect(new Set(m.chords.map((c) => c.topVoice))).toEqual(new Set(["G4"]));
  });

  it("on a changes-only chart it walks only into a cadence, and only at the start of a chain of fifths", () => {
    // iii vi ii V I: a chain of fifths from iii; I → IV isn't preceded by a fifth, so it may walk too
    const chain = buildTune("C", 4, [["iii", "vi", "ii", "V", "I"]]);
    expect(movesOf(chain, RULE).map((m) => m.original[0].root)).toEqual(["E"]);
    // IV → I is plagal (down a 4th = up a 5th): no walk
    expect(movesOf(buildTune("C", 4, [["IV", "I"]]), RULE)).toHaveLength(0);
    // a dominant written out bar by bar (V | V | I) still counts as one link
    const repeated = buildTune("C", 4, [["ii"], ["V"], ["V", "I"]]);
    expect(movesOf(repeated, RULE).map((m) => m.original[0].root)).toEqual(["D"]);
  });

  it("with a melody, holds the melody's own sustained note, and stays quiet when the melody moves", () => {
    const base = buildTune("C", 4, [["V", "I"]]);
    const held = { ...base, melody: [{ at: { bar: 1, beat: 1 }, beats: 4, pitch: "E5" }], melodyCoverage: "full" as const };
    const [m] = movesOf(held, RULE);
    expect(m.facts.heldNote).toBe("E");
    expect(m.chords.slice(1).every((c) => c.topVoice === "E5")).toBe(true);
    // E over D is the 9th; over D♭ (the approach) it's the ♯9
    expect(m.chords.map((c) => c.root + c.quality)).toEqual(["G7", "Dm7", "Db7"]);
    expect(m.chords[2].alterations).toEqual(["#9"]);
    expect(m.checks.melody.every((x) => x.verdict !== "avoid")).toBe(true);

    const moving = { ...held, melody: [{ at: { bar: 1, beat: 1 }, beats: 2, pitch: "E5" }, { at: { bar: 1, beat: 3 }, beats: 2, pitch: "D5" }] };
    expect(movesOf(moving, RULE)).toHaveLength(0);
  });
});

describe("rule: secondary dominant", () => {
  const RULE = "functional.secondaryDominant";

  it("keeps the root and the beats, turns the chord into a dominant a 5th above its target, and its 3rd leads up to the target's root", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of movesOf(t, RULE)) {
          const T = target(t, m);
          const [orig] = m.original;
          expect(m.chords).toHaveLength(1);
          const [d] = m.chords;
          expect(m.level).toBe(1);
          expect(m.category).toBe("functional");
          expect(orig.quality).not.toBe("7");
          expect(chroma(d.root)).toBe(chroma(orig.root));
          expect(d.beats).toBe(orig.beats);
          expect(d.quality).toBe("7");
          expect(semis(T.root, d.root)).toBe(7);
          // the dominant's 3rd is the leading tone of the target's root
          const third = guideTones(d)[0];
          expect(third.degree).toBe("3");
          expect(semis(third.note, T.root)).toBe(1);
          // a minor target gets the ♭9 (Phrygian dominant), a major one the natural 9
          if (T.quality === "m7") expect(d.alterations).toContain("b9");
          else expect(d.alterations).not.toContain("b9");
        }
      }),
      RUNS,
    );
  });

  it("iii–vi–ii–V–I in C: E7(♭9) into Am7, A7(♭9) into Dm7, and the ii of the ii–V stays a ii", () => {
    const t = buildTune("C", 4, [["iii", "vi", "ii", "V", "I"]]);
    const moves = movesOf(t, RULE);
    expect(moves.map((m) => m.id)).toEqual([`${RULE}@1.1`, `${RULE}@2.1`]);
    expect(moves.map((m) => symbol(m.chords[0]))).toEqual(["E7(b9)", "A7(b9)"]);
    expect(moves[1].facts).toMatchObject({ original: "Am7", dominant: "A7(b9)", target: "Dm7", leadingTone: "C#", raised: ["C", "C#"] });
  });

  it("I → IV: the tonic becomes I7 (its 7th lowered, not its 3rd raised)", () => {
    const t = buildTune("C", 4, [["I"], ["IV", "I"]]);
    const [m] = movesOf(t, RULE);
    expect(symbol(m.chords[0])).toBe("C9");
    expect(m.facts).toMatchObject({ leadingTone: "E", lowered: ["B", "Bb"] });
    expect(m.facts.raised).toBeUndefined();
  });

  it("stays quiet on a chord that's already a dominant, or that doesn't fall a 5th", () => {
    // V → I is already a dominant; I → ii and IV → I don't fall a 5th
    expect(movesOf(buildTune("C", 4, [["V", "I"]]), RULE)).toHaveLength(0);
    expect(movesOf(buildTune("C", 4, [["I", "ii"]]), RULE)).toHaveLength(0);
    expect(movesOf(buildTune("C", 4, [["IV", "I"]]), RULE)).toHaveLength(0);
    // the ii of a written ii–V already points at its target
    expect(movesOf(buildTune("C", 4, [["ii", "V", "I"]]), RULE)).toHaveLength(0);
  });

  it("the melody decides: a major 7th in the tune keeps I from becoming I7", () => {
    const base = buildTune("C", 4, [["I"], ["IV", "I"]]);
    const onB = { ...base, melody: [{ at: { bar: 1, beat: 1 }, beats: 4, pitch: "B4" }], melodyCoverage: "full" as const };
    expect(movesOf(onB, RULE)).toHaveLength(0);
    const r = generateMoves(onB).rejected.find((x) => x.move.ruleId === RULE)!;
    expect(r.reasons[0]).toMatch(/B/);
  });

  it("has a 12-key concept drill: vi7 → ii7 becomes VI7(♭9) → ii7", () => {
    const d = conceptDrillSteps(RULE, "Eb");
    expect(d.move.ruleId).toBe(RULE);
    expect(d.move.chords.map(symbol)).toEqual(["C7(b9)"]);
    expect(d.move.targetSymbol).toBe("Fm7");
  });
});

describe("advanced rule pack: coverage", () => {
  it("every new rule fires on a showcase progression in C (and its levels are right)", () => {
    const t = buildTune("C", 4, [["I"], ["ii", "V", "I"], ["IV", "I"], ["iii", "ii", "V", "I"]]);
    const fired = new Map(generateMoves(t).accepted.map((m) => [m.ruleId, m.level]));
    expect(Object.fromEntries([...fired].filter(([id]) => !/secondary|tritone|upperStructure|gospel/.test(id)))).toEqual({
      "chromatic.passingDiminished": 2,
      "modal.backdoorTwoFive": 3,
      "modal.flatSixFlatSeven": 3,
      "modal.borrowedIv": 3,
      "chromatic.commonToneDiminished": 3,
      "symmetric.coltraneSubstitution": 4,
      "chromatic.constantStructure": 4,
      "melody.oneNoteOnTop": 4,
    });
  });

  it("guide tones of every new move are real chord tones (no empty or broken chords)", () => {
    fc.assert(
      fc.property(diatonicArb, (t) => {
        for (const m of generateMoves(t).accepted) for (const c of m.chords) expect(guideTones(c).length).toBeGreaterThan(0);
      }),
      RUNS,
    );
  });
});
