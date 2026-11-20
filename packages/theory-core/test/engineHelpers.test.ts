import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordSpelling, chordTones, symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { canonicalMove, canonicalTune } from "../src/learn/canonical";
import type { VoicePath } from "../src/learn/facts";
import { melodyNoteLabel } from "../src/melody";
import { chroma, mod, parseNote, transpose } from "../src/pitch";
import { dimTones, mk, planeMotion, risingTone } from "../src/ruleKit";
import { passingDiminished } from "../src/rulesAdvanced";
import { KEYS } from "../src/transpose";
import type { VoiceMotion } from "../src/types";
import { collapseHolds, nearestMotion } from "../src/voiceLeading";

const doubled = (n: string) => Math.abs(parseNote(n).alter) >= 2;
/** Display text with a double accidental in it. */
const DOUBLE_SHOWN = /♭♭|♯♯|𝄪|𝄫|bb(?![a-z])|##/;

describe("planeMotion: positional voice motion for planing and grips", () => {
  it("D♭maj7 → Cmaj7 slides every voice down a half step, where nearest motion holds the C", () => {
    const from = chordTones(mk("Db", "maj7", 1));
    const to = chordTones(mk("C", "maj7", 1));
    expect(planeMotion(from, to).map((m) => [m.from, m.to, m.semitones])).toEqual([
      ["Db", "C", -1],
      ["F", "E", -1],
      ["Ab", "G", -1],
      ["C", "B", -1],
    ]);
    expect(nearestMotion("C", to).semitones).toBe(0); // the bug planeMotion fixes
  });

  it("takes note names or chord tones, and refuses unequal voice counts", () => {
    const to = chordTones(mk("C", "7", 1));
    expect(planeMotion(["D", "F#", "A", "C"], to).map((m) => m.semitones)).toEqual([-2, -2, -2, -2]);
    expect(() => planeMotion(["D", "F#"], to)).toThrow(/2 voices into 4/);
  });

  it("constant structure's voice-leading grid: every planed voice slides −1, in 12 keys", () => {
    for (const k of KEYS) {
      const m = canonicalMove("chromatic.constantStructure", k)!;
      expect(m, k).not.toBeNull();
      expect(m.voiceLeading.length).toBe(chordTones(m.chords[m.chords.length - 1]).length);
      for (const v of m.voiceLeading) expect(v.semitones, `${k}: ${v.from} → ${v.to}`).toBe(-1);
    }
  });

  it("any shape planed down a half step: all −1 (property)", () => {
    const shapes = [mk("C", "maj7", 1, ["9"]), mk("C", "7", 1, [], ["b9", "#11"]), mk("C", "m7", 1, ["11"]), mk("C", "6", 1, ["9"]), mk("C", "m7b5", 1)];
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), fc.constantFrom(...shapes), (root, shape) => {
        const target = { ...shape, root };
        const above = { ...shape, root: transpose(root, "b2") };
        for (const m of planeMotion(chordTones(above), chordTones(target))) expect(m.semitones).toBe(-1);
      }),
    );
  });
});

describe("diminished spelling", () => {
  it("dimTones tidies a °7: E♭dim7 reads E♭ G♭ A C, never B♭♭ or D♭♭", () => {
    expect(dimTones(mk("Eb", "dim7", 1)).map((t) => t.note)).toEqual(["Eb", "Gb", "A", "C"]);
    expect(dimTones(mk("Eb", "dim7", 1)).map((t) => t.degree)).toEqual(["1", "b3", "b5", "bb7"]);
    expect(dimTones(mk("C#", "dim7", 1)).map((t) => t.note)).toEqual(["C#", "E", "G", "Bb"]);
  });

  it("no °7 shows a double accidental, on any root (12 keys, both spellings)", () => {
    const roots = [...KEYS, "C#", "D#", "F#", "G#", "A#"];
    for (const r of roots) {
      const tones = dimTones(mk(r, "dim7", 1));
      for (const t of tones) expect(doubled(t.note), `${r}dim7: ${t.note}`).toBe(false);
      // same keys as the engine's chord
      expect(tones.map((t) => chroma(t.note))).toEqual(chordTones(mk(r, "dim7", 1)).map((t) => chroma(t.note)));
    }
  });

  it("passing °7s, up and down, in 12 keys: the move's words show no double accidental, and the descending °7 stays flat", () => {
    for (const k of KEYS) {
      const up = canonicalTune("chromatic.passingDiminished", k)!;
      // iii → ii: the descending passing °7 (E → E♭dim7 → Dm7 in C)
      const down = { ...up, harmony: up.harmony.map((c, i) => (i === 0 ? { ...c, root: transpose(up.harmony[1].root, "2"), quality: "m7" as const } : c)) };
      for (const tune of [up, down]) {
        const m = generateMoves(tune, [passingDiminished]).accepted[0];
        expect(m, k).toBeDefined();
        const words = [m.text.summary, m.text.theory, m.text.recreateRule].join(" ");
        expect(words, `${k}: ${words}`).not.toMatch(DOUBLE_SHOWN);
        if (tune === down) expect(parseNote(m.chords[1].root).alter, `${k}: ${m.chords[1].root}`).toBeLessThanOrEqual(0);
      }
    }
  });

  it("risingTone: ♯2 and ♯4 by direction, simplified only where a double sharp would result", () => {
    expect(["#2", "#4"].map((iv) => risingTone("C", iv))).toEqual(["D#", "F#"]);
    expect(["#2", "#4"].map((iv) => risingTone("E", iv))).toEqual(["G", "A#"]); // F𝄪 → G
    expect(["#2", "#4"].map((iv) => risingTone("B", iv))).toEqual(["D", "E#"]); // C𝄪 → D; E♯ stays
    expect(["#2", "#4"].map((iv) => risingTone("Db", iv))).toEqual(["E", "G"]);
  });

  it("common-tone °7 in 12 keys: leaning tones spelled ♯2/♯4 (no double sharps), each rising a half step into the 3rd and 5th", () => {
    const expected: Record<string, string[]> = { C: ["D#", "F#"], E: ["G", "A#"], F: ["G#", "B"], Bb: ["C#", "E"], Ab: ["B", "D"] };
    for (const k of KEYS) {
      const m = canonicalMove("chromatic.commonToneDiminished", k)!;
      expect(m, k).not.toBeNull();
      const root = m.chords[0].root;
      const lean = m.facts.leaningTones as string[];
      if (expected[root]) expect(lean, root).toEqual(expected[root]);
      for (const n of lean) expect(doubled(n), `${root}: ${n}`).toBe(false);
      expect(lean.map((n) => mod(chroma(n) - chroma(root), 12))).toEqual([3, 6]);
      // the voice leading rises a half step into the chord's own 3rd and 5th
      expect(m.voiceLeading.map((v) => [v.semitones, v.toDegree])).toEqual([
        [1, "3"],
        [1, "5"],
      ]);
      // the symbol stays the °7 on the root
      expect(symbol(m.chords[0])).toBe(`${root}dim7`);
    }
    const c = canonicalMove("chromatic.commonToneDiminished", "C")!;
    // since 5c the words are the lesson's (MoveText derives from it)
    expect(c.text.theory).toContain("D♯ rises to E, the 3rd; F♯ rises to G, the 5th.");
  });
});

describe("minor line cliché stops", () => {
  it("symbol() prints the added 9 (m7 + 9 = Cm9), so `facts.stops` carries the four chords without it, in 12 keys", () => {
    const c = canonicalMove("chromatic.minorLineCliche", "C")!;
    expect(c.chords.map(symbol)).toEqual(["Cm(add9)", "Cm(maj7)", "Cm9", "Cm6"]);
    expect(c.facts.stops).toEqual(["Cm", "Cm(maj7)", "Cm7", "Cm6"]);
    for (const k of KEYS) {
      const m = canonicalMove("chromatic.minorLineCliche", k)!;
      const r = m.chords[0].root;
      expect(m.facts.stops, k).toEqual([`${r}m`, `${r}m(maj7)`, `${r}m7`, `${r}m6`]);
    }
  });
});

describe("collapseHolds: a VoicePath with its runs of holds folded", () => {
  const mv = (from: string, to: string, semitones: number): VoiceMotion => ({ from, to, semitones, toDegree: "?" });

  it("F, E♭ (held, respelled D♯), D, C", () => {
    const path: VoicePath = {
      from: "F",
      motions: [mv("F", "Eb", -2), mv("Eb", "Eb", 0), mv("Eb", "D#", 0), mv("D#", "D#", 0), mv("D#", "D", -1), mv("D", "C", -2)],
    };
    expect(collapseHolds(path)).toEqual([
      { note: "F", holds: 0 },
      { note: "Eb", holds: 3, respelled: "D#" },
      { note: "D", holds: 0 },
      { note: "C", holds: 0 },
    ]);
  });

  it("a hold on the start note folds into it; a hold that returns to its own spelling isn't respelled", () => {
    expect(collapseHolds({ from: "G", motions: [mv("G", "G", 0), mv("G", "F#", -1)] })).toEqual([
      { note: "G", holds: 1 },
      { note: "F#", holds: 0 },
    ]);
    expect(collapseHolds({ from: "G", motions: [mv("G", "Fx", 0), mv("Fx", "G", 0)] })).toEqual([{ note: "G", holds: 2 }]);
  });

  it("property: stops + holds = chords + 1, and consecutive stops are never the same key held", () => {
    const step = fc.integer({ min: -2, max: 2 });
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), fc.array(step, { maxLength: 8 }), (start, deltas) => {
        let cur: string = start;
        const motions = deltas.map((d) => {
          const to = transpose(cur, { steps: 0, semis: d });
          const m = mv(cur, to, d);
          cur = to;
          return m;
        });
        const stops = collapseHolds({ from: start, motions });
        expect(stops.length + stops.reduce((s, x) => s + x.holds, 0)).toBe(motions.length + 1);
        for (let i = 1; i < stops.length; i++) expect(chroma(stops[i].note)).not.toBe(chroma(stops[i - 1].respelled ?? stops[i - 1].note));
      }),
    );
  });
});

describe("one note on top: roles are degree codes", () => {
  it("in 12 keys, every role is a degree code the held note really is in its walk chord", () => {
    for (const k of KEYS) {
      const m = canonicalMove("melody.oneNoteOnTop", k)!;
      const roles = m.facts.roles as string[];
      const held = m.facts.heldNote as string;
      expect(roles.length, k).toBe(m.chords.length - 1);
      roles.forEach((r, i) => {
        expect(r, k).toMatch(/^(b|#)?\d{1,2}$/);
        const tone = chordTones(m.chords[i + 1]).find((t) => t.degree === r)!;
        expect(chroma(tone.note), `${k}: ${r}`).toBe(chroma(held));
      });
    }
  });
});

describe("melody check display spelling", () => {
  it("chordSpelling: the chord's own name for the key, else the note as written", () => {
    const gb9 = mk("Gb", "7", 1, ["9"]);
    expect(chordSpelling(gb9, "E4")).toBe("Fb");
    expect(chordSpelling(gb9, "Bb")).toBe("Bb");
    expect(chordSpelling(gb9, "C")).toBe("C"); // not in the chord
    expect(chordSpelling(mk("C", "dim7", 1), "A")).toBe("A"); // the chord's B♭♭ is never shown
  });

  it("melodyNoteLabel: F♭ (same key as E) over G♭9; a matching spelling stays plain", () => {
    expect(melodyNoteLabel(mk("Gb", "7", 1, ["9"]), "E")).toBe("F♭ (same key as E)");
    expect(melodyNoteLabel(mk("Db", "7", 1, ["9"]), "Eb5")).toBe("E♭");
  });

  it("12 keys: the label's first note is always a chord tone's spelling with no double accidental, or the written note", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), fc.constantFrom(...KEYS), (root, note) => {
        const chord = mk(root, "7", 1, ["9"], ["#11"]);
        const spelled = chordSpelling(chord, note);
        expect(chroma(spelled)).toBe(chroma(note));
        expect(doubled(spelled)).toBe(false);
        const label = melodyNoteLabel(chord, note);
        expect(label).not.toMatch(DOUBLE_SHOWN);
      }),
    );
  });
});
