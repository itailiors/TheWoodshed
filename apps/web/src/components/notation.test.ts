import { referenceTune, type Tune } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { chunks, engrave, formLength } from "./notation";

const F_MAJOR = { B: -1 };
const sheet = engrave(referenceTune, F_MAJOR);
const bar = (b: number) => sheet.get(b)!;
const show = (b: number) => bar(b).glyphs.map((g) => `${g.pitch ?? "rest"}@${g.beat}:${g.value}${g.tieToNext ? "~" : ""}`);

describe("engrave: the reference tune", () => {
  it("fills every bar of the form to exactly four beats, with no overlaps", () => {
    expect(formLength(referenceTune)).toBe(12);
    for (let b = 1; b <= 12; b++) {
      let cursor = 1;
      for (const g of bar(b).glyphs) {
        expect(g.beat, `bar ${b}`).toBeCloseTo(cursor);
        cursor += g.value;
      }
      expect(cursor, `bar ${b}`).toBeCloseTo(5);
    }
  });

  it("writes the opening rests the head implies", () => {
    expect(show(1)[0]).toBe("rest@1:0.5");
    expect(show(6)[0]).toBe("rest@1:1");
    expect(show(3)).toContain("rest@3:0.5");
    expect(show(9)).toContain("rest@2:0.5");
  });

  it("ties notes over the barline instead of overfilling the bar", () => {
    // bar 1 → 2: F5 on the "and" of 4 for 1½ beats = eighth tied to a quarter
    expect(show(1).at(-1)).toBe("F5@4.5:0.5~");
    expect(show(2).slice(0, 2)).toEqual(["F5@1:1", "rest@2:0.5"]);
    expect(bar(2).glyphs[0].tiedFromPrev).toBe(true);
    // bar 7 → 8: E♭5 for two beats = eighth tied to a dotted quarter
    expect(show(7).at(-1)).toBe("Eb5@4.5:0.5~");
    expect(show(8)[0]).toBe("Eb5@1:1.5");
    // bars 4 → 5 and 10 → 11 cross a system break; the tie is still there
    expect(show(4).at(-1)).toBe("D5@4.5:0.5~");
    expect(show(10).at(-1)).toBe("C5@4.5:0.5~");
  });

  it("splits an off-beat dotted quarter so beat 4 shows (bar 5)", () => {
    expect(show(5).slice(-2)).toEqual(["Ab4@3.5:0.5~", "Ab4@4:1"]);
  });

  it("cancels an accidental later in the same bar, and doesn't repeat one", () => {
    const acc = (b: number, pitch: string, beat: number) => bar(b).glyphs.find((g) => g.pitch === pitch && g.beat === beat)!.accidental;
    expect(acc(1, "Ab4", 2.5)).toBe(-1);
    expect(acc(1, "A4", 3)).toBe(0); // the natural that was missing
    expect(acc(7, "A4", 2)).toBeNull();
    expect(acc(7, "Ab4", 2.5)).toBe(-1);
    expect(acc(7, "A4", 4)).toBe(0);
    expect(acc(4, "Eb5", 1)).toBe(-1);
    expect(acc(4, "Eb5", 4)).toBeNull(); // still flat from beat 1
    expect(acc(3, "Bb4", 3.5)).toBeNull(); // in the key
    expect(acc(3, "B4", 4)).toBe(0);
    expect(acc(2, "F5", 1)).toBeNull(); // tied in: no accidental
  });

  it("beams eighths in half-bar groups and breaks at rests", () => {
    // bar 1: rest, C D A♭ | A C D F
    expect(bar(1).beams).toEqual([
      [1, 2, 3],
      [4, 5, 6, 7],
    ]);
    // bar 3: A (quarter), C D | rest, B♭ B C
    expect(bar(3).beams).toEqual([
      [1, 2],
      [4, 5, 6],
    ]);
    for (const eb of sheet.values()) {
      for (const run of eb.beams) for (const i of run) expect(eb.glyphs[i].value).toBe(0.5);
    }
  });
});

describe("chunks", () => {
  it("keeps the eighth–quarter–eighth syncopation inside a half bar", () => {
    expect(chunks(1.5, 1, 4, false)).toEqual([[1.5, 1]]);
    expect(chunks(2.5, 1, 4, false)).toEqual([
      [2.5, 0.5],
      [3, 0.5],
    ]);
  });

  it("shows the middle of a 4/4 bar except from beat 1 or a half note on beat 2", () => {
    expect(chunks(1, 4, 4, false)).toEqual([[1, 4]]);
    expect(chunks(2, 2, 4, false)).toEqual([[2, 2]]);
    expect(chunks(2, 1.5, 4, false)).toEqual([
      [2, 1],
      [3, 0.5],
    ]);
  });

  it("writes half rests only on beats 1 and 3, and a whole-bar rest in any meter", () => {
    expect(chunks(2, 3, 4, true)).toEqual([
      [2, 1],
      [3, 2],
    ]);
    expect(chunks(1, 3, 3, true)).toEqual([[1, 3]]);
  });

  it("prints a length it can't spell (a triplet) as-is rather than looping", () => {
    expect(chunks(1, 1 / 3, 4, false)).toEqual([[1, 1 / 3]]);
  });
});

describe("engrave: partial melodies", () => {
  it("leaves the gaps of an anchors melody empty", () => {
    const tune: Tune = { ...referenceTune, melodyCoverage: "anchors", melody: [{ at: { bar: 1, beat: 3 }, beats: 1, pitch: "C5" }] };
    const s = engrave(tune, F_MAJOR);
    expect(s.get(1)!.glyphs.map((g) => g.pitch)).toEqual(["C5"]);
    expect(s.get(2)!.glyphs).toEqual([]);
  });
});
