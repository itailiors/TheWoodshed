import { basicsLesson, canonicalLesson, chroma, generateMoves, referenceTune, type Tune } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { coachLesson, sixChordNote, tuneMoveInKey } from "./coachLesson";

describe("sixChordNote: the chart writes I as a 6 chord, the lesson says Xmaj7", () => {
  const resolution = (k: string) => basicsLesson("basics:dominantResolution", k)!; // "C7 → Fmaj7" in F

  it("Co-op Blues (F6) with a lesson that says Fmaj7: one line, naming both chords", () => {
    expect(referenceTune.harmony.some((c) => c.root === "F" && c.quality === "6")).toBe(true);
    expect(sixChordNote(referenceTune, "F", resolution("F"))).toBe("Your chart writes F6; F6 and Fmaj7 are both the I chord here.");
    expect(sixChordNote(referenceTune, "Ab", resolution("Ab"))).toBe("Your chart writes its I as a 6 chord: A♭6 and A♭maj7 are both the I chord here.");
    expect(sixChordNote(referenceTune, "F", canonicalLesson("dominant.tritoneSub", "F")!)).toMatch(/^Your chart writes F6;/);
  });

  it("nothing when the lesson never says Xmaj7, the chart has a maj7 on I, or the chart is minor", () => {
    expect(sixChordNote(referenceTune, "F", basicsLesson("basics:tritone", "F")!)).toBeNull();
    const maj7: Tune = { ...referenceTune, harmony: [...referenceTune.harmony, { ...referenceTune.harmony[0], id: "x", quality: "maj7" }] };
    expect(sixChordNote(maj7, "F", resolution("F"))).toBeNull();
    expect(sixChordNote({ ...referenceTune, key: { ...referenceTune.key, mode: "minor" } }, "F", resolution("F"))).toBeNull();
  });

  it("B major never matches B♭maj7 (the accidental sits between the letter and the quality)", () => {
    expect(sixChordNote(referenceTune, "B", { ...resolution("F"), headline: "B♭maj7 only", rule: "", steps: [], deeper: undefined })).toBeNull();
  });
});

describe("Coach's Learn-stage lesson for a tune move", () => {
  const move = generateMoves(referenceTune).accepted.find((m) => m.ruleId === "dominant.tritoneSub")!;

  it("is that move's lesson in the drill's key, its ▶ chords in that key too", () => {
    const l = coachLesson(move.ruleId, "Ab", { tune: referenceTune, move })!;
    expect(l).not.toBeNull();
    expect(l.move!.id).toBe(move.id);
    const shift = (chroma("Ab") - chroma(referenceTune.key.tonic) + 12) % 12;
    expect(chroma(l.move!.chords[0].root)).toBe((chroma(move.chords[0].root) + shift) % 12);
    expect(l.audio!.after.slice(0, l.move!.chords.length)).toEqual(l.move!.chords);
    expect(l.audio!.before.slice(0, l.move!.original.length)).toEqual(l.move!.original);
  });

  it("never pairs the old key's move with the new key's chart: a move the key doesn't have gets no lesson", () => {
    const ghost = { ...move, id: "dominant.tritoneSub@99.1" };
    expect(coachLesson(move.ruleId, "Ab", { tune: referenceTune, move: ghost })).toBeNull();
  });

  it("tuneMoveInKey: the transposed chart and the same move on it, or null (what the page checks before mounting a drill)", () => {
    const there = tuneMoveInKey(referenceTune, move.id, "Ab");
    expect(there.tune.key.tonic).toBe("Ab");
    expect(there.move!.id).toBe(move.id);
    expect(tuneMoveInKey(referenceTune, move.id, referenceTune.key.tonic).tune).toBe(referenceTune);
    expect(tuneMoveInKey(referenceTune, "dominant.tritoneSub@99.1", "Ab").move).toBeNull();
  });
});
