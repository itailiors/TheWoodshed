import { chroma, generateMoves, referenceTune } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { coachLesson } from "./coachLesson";

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
});
