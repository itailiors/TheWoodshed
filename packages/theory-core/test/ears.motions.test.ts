import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ALTS,
  altsFrom,
  DEGREES,
  diatonicChords,
  EAR_MOTION_NAME,
  earRuleId,
  isEarRuleId,
  LEVELS,
  MOTIONS,
  motionFor,
  motionOfRuleId,
  semitonesUp,
  spellInKey,
  stepKind,
  V1_KEYS,
  walkNext,
  type Degree,
  type EarMotionId,
  type SpelledChord,
} from "../src/ears";
import { chroma, mod, parseNote } from "../src/pitch";
import { KEYS } from "../src/transpose";

/*
 * Make the Changes, step 1: the harmony the game is built on. Every chord spelled the way a
 * chart in that key spells it, the fifths walk with its one wider step, the motions the game
 * teaches, and the "valid but different" answers.
 */

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/** The diatonic walk from I: down in fifths through the key and back home (8 chords, 7 steps). */
function walkFromI(tonic: string): SpelledChord[] {
  const out = [spellInKey(tonic, 1)];
  let d: Degree = 1;
  for (let i = 0; i < 7; i++) {
    d = walkNext(d);
    out.push(spellInKey(tonic, d));
  }
  return out;
}

describe("the fourths staircase (golden): E♭ major", () => {
  const walk = walkFromI("Eb");

  it("walks E♭ A♭ D G C F B♭ E♭ with the qualities of the key", () => {
    expect(walk.map((c) => c.symbol)).toEqual(["Ebmaj7", "Abmaj7", "Dm7b5", "Gm7", "Cm7", "Fm7", "Bb7", "Ebmaj7"]);
    expect(walk.map((c) => c.numeral)).toEqual(["Imaj7", "IVmaj7", "viiø7", "iii7", "vi7", "ii7", "V7", "Imaj7"]);
  });

  it("drops a perfect fifth every step but one: A♭ → D, the wider step that keeps you in the key", () => {
    const steps = walk.slice(1).map((c, i) => semitonesUp(walk[i], c));
    expect(steps).toEqual([5, 6, 5, 5, 5, 5, 5]);
    expect(walk.slice(1).map((c, i) => stepKind(walk[i], c))).toEqual(["fifth", "tritoneHop", "fifth", "fifth", "fifth", "fifth", "fifth"]);
  });

  it("names its steps the way the game teaches them: the last two are the setup and the landing", () => {
    const motions = walk.slice(1).map((c, i) => motionFor(walk[i].degree!, c.degree!));
    expect(motions).toEqual(["staircase", "staircase", "staircase", "staircase", "staircase", "setup", "landing"]);
  });
});

describe("spelling in the v1 keys", () => {
  it.each(V1_KEYS)("%s major: seven chords on seven different letters, at the major-scale pitches", (tonic) => {
    const chords = diatonicChords(tonic);
    expect(new Set(chords.map((c) => parseNote(c.root).letter)).size).toBe(7);
    expect(chords.map((c) => mod(c.pc - chroma(tonic), 12))).toEqual(MAJOR_SCALE);
    expect(chords.map((c) => c.numeral)).toEqual(["Imaj7", "ii7", "iii7", "IVmaj7", "V7", "vi7", "viiø7"]);
  });

  it("follows each key signature: flats in F, B♭ and E♭, F♯ only in G, nothing in C", () => {
    const roots = (k: string) => diatonicChords(k).map((c) => c.root);
    expect(roots("C").join(" ")).toBe("C D E F G A B");
    expect(roots("F").join(" ")).toBe("F G A Bb C D E");
    expect(roots("Bb").join(" ")).toBe("Bb C D Eb F G A");
    expect(roots("Eb").join(" ")).toBe("Eb F G Ab Bb C D");
    expect(roots("G").join(" ")).toBe("G A B C D E F#");
  });

  it("never respells a key's note enharmonically (B♭ in F, not A♯)", () => {
    for (const k of ["F", "Bb", "Eb"]) for (const c of diatonicChords(k)) expect(c.root).not.toContain("#");
  });
});

describe("the walk in every key", () => {
  it("visits all seven degrees, lands home in seven steps, with exactly one wider step at IV → vii", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (tonic) => {
        const walk = walkFromI(tonic);
        expect(new Set(walk.slice(0, 7).map((c) => c.degree)).size).toBe(7);
        expect(walk[7].degree).toBe(1);
        const steps = walk.slice(1).map((c, i) => semitonesUp(walk[i], c));
        expect(steps.filter((s) => s === 6)).toHaveLength(1);
        expect(steps.filter((s) => s === 5)).toHaveLength(6);
        const hop = steps.indexOf(6);
        expect([walk[hop].degree, walk[hop + 1].degree]).toEqual([4, 7]);
      }),
    );
  });
});

describe("motions", () => {
  it("knows the four v1 motions and nothing else", () => {
    expect(motionFor(5, 1)).toBe("landing");
    expect(motionFor(2, 5)).toBe("setup");
    expect(motionFor(1, 6)).toBe("door");
    expect(motionFor(1, 4)).toBe("staircase");
    expect(motionFor(4, 7)).toBe("staircase");
    expect(motionFor(6, 2)).toBe("staircase");
    expect(motionFor(5, 6)).toBeNull(); // deceptive: not in v1
    expect(motionFor(2, 1)).toBeNull();
    expect(motionFor(1, 5)).toBeNull();
  });

  it("every motion's text is filled in, spelled for the key, and never says 'V/ii'", () => {
    const steps: [EarMotionId, Degree, Degree][] = [
      ["landing", 5, 1],
      ["setup", 2, 5],
      ["staircase", 4, 7], // the wider step
      ["staircase", 3, 6],
      ["door", 1, 6],
    ];
    for (const tonic of V1_KEYS)
      for (const [id, a, b] of steps) {
        const ctx = { tonic, from: spellInKey(tonic, a), to: spellInKey(tonic, b) };
        const m = MOTIONS[id];
        for (const text of [m.hint(ctx), m.right(ctx), m.wrong(ctx), m.why(ctx)]) {
          expect(text.length).toBeGreaterThan(10);
          expect(text).not.toMatch(/undefined|NaN|V\/|#/);
          expect(text).not.toMatch(/\b[A-G]b/); // engine spelling ("Bb") never reaches the player: it's B♭
        }
      }
  });

  it("explains the wider step as a wider step, and only there", () => {
    const hop = { tonic: "Eb", from: spellInKey("Eb", 4), to: spellInKey("Eb", 7) };
    const stair = { tonic: "Eb", from: spellInKey("Eb", 3), to: spellInKey("Eb", 6) };
    expect(MOTIONS.staircase.hint(hop)).toMatch(/wider/);
    expect(MOTIONS.staircase.hint(stair)).not.toMatch(/wider/);
  });
});

describe("valid-but-different answers", () => {
  it("are spelled on the flat side: D♭7 and B♭7 in C, with ♯i°7 for the passing diminished", () => {
    const from = (d: Degree) => Object.fromEntries(altsFrom("C", spellInKey("C", d)).map((a) => [a.id, a.chord.symbol]));
    expect(from(2)).toEqual({ tritoneSub: "Db7" });
    expect(from(5)).toEqual({ tritoneSub: "Db7" });
    expect(from(4)).toEqual({ backdoor: "Bb7" });
    expect(from(1)).toEqual({ passingDim: "C#dim7" });
    expect(altsFrom("Bb", spellInKey("Bb", 1))[0].chord.root).toBe("B");
    expect(altsFrom("Eb", spellInKey("Eb", 1))[0].chord.root).toBe("E");
  });

  it("the backdoor is offered from IV only, never from V7", () => {
    expect(ALTS.backdoor.from).toEqual([4]);
    for (const k of V1_KEYS) expect(altsFrom(k, spellInKey(k, 5)).map((a) => a.id)).not.toContain("backdoor");
  });

  it("at the wider step, a perfect fifth down (D♭ instead of D in E♭) is the backdoor, not wrong", () => {
    const iv = spellInKey("Eb", 4);
    const alts = altsFrom("Eb", iv);
    expect(alts.map((a) => [a.id, a.chord.root])).toEqual([["backdoor", "Db"]]);
    expect(semitonesUp(iv, alts[0].chord)).toBe(5);
  });

  it("never collide with each other or with the answer the round expects", () => {
    for (const tonic of V1_KEYS)
      for (const d of DEGREES) {
        const from = spellInKey(tonic, d);
        const alts = altsFrom(tonic, from);
        const pcs = alts.map((a) => a.chord.pc);
        expect(new Set(pcs).size).toBe(pcs.length);
        // what a round can expect from here: the next stair down, or (from I) the turnaround door
        const expected = [spellInKey(tonic, walkNext(d)).pc, ...(d === 1 ? [spellInKey(tonic, 6).pc] : [])];
        for (const pc of pcs) expect(expected).not.toContain(pc);
        for (const a of alts) expect(ALTS[a.id].line(tonic, a.chord)).toMatch(/real jazz move/);
      }
  });

  it("tritone sub and backdoor roots never use a sharp", () => {
    for (const tonic of V1_KEYS)
      for (const d of DEGREES)
        for (const a of altsFrom(tonic, spellInKey(tonic, d))) if (a.id !== "passingDim") expect(a.chord.root).not.toContain("#");
  });
});

describe("levels and passport ids", () => {
  it("v1 is Levels 1–3, each building on the last; Level 1 in all 12 keys, the rest in v1 keys only", () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3]);
    for (let i = 1; i < LEVELS.length; i++) {
      for (const m of LEVELS[i - 1].motions) expect(LEVELS[i].motions).toContain(m);
    }
    expect(LEVELS[0].keys).toHaveLength(12);
    expect(LEVELS[2].keys).toEqual(expect.arrayContaining([...LEVELS[1].keys]));
    for (const l of LEVELS.slice(1)) for (const k of l.keys) expect(V1_KEYS).toContain(k);
    expect(LEVELS[0].asksFunction).toBe(false);
  });

  it("stores motions as ear:<motion> concepts, kept apart from reharm rules", () => {
    for (const m of Object.keys(MOTIONS) as EarMotionId[]) {
      expect(motionOfRuleId(earRuleId(m))).toBe(m);
      expect(EAR_MOTION_NAME[m]).toBeTruthy();
    }
    expect(isEarRuleId("dominant.tritoneSub")).toBe(false);
    expect(motionOfRuleId("dominant.tritoneSub")).toBeNull();
    expect(motionOfRuleId("ear:nonsense")).toBeNull();
  });
});
