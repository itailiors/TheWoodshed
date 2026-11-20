import { basicsLesson, canonicalMove, chroma, CONCEPTS, hasBasicsLesson, voiceProgression, type ChordLike, type LessonStep } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { placeHighlights, stackUp, stepAudio } from "./lessonAudio";

const move = canonicalMove("dominant.tritoneSub", "C")!;
const ctx = { before: [...move.original], after: [...move.chords] };
const voiced = (cs: ChordLike[]) => voiceProgression(cs).map((v) => [v.bass, ...v.upper]);
const step = (s: Partial<LessonStep>): LessonStep => ({ text: "x", highlight: [], ...s });

describe("lesson audio", () => {
  it("stacks pitch classes upward from a floor, any spelling", () => {
    expect(stackUp(["G", "B", "D", "F"], 48)).toEqual([55, 59, 62, 65]);
    expect(stackUp(["Fb", "Ab", "Cb"], 48)).toEqual([52, 56, 59]); // F♭ is the E key
    expect(stackUp(["C", "E"], 60)).toEqual([60, 64]);
    expect(placeHighlights(["B", "F"])).toEqual([59, 65]);
  });

  it("a step's sound chords play when present, even over its cue", () => {
    const a = stepAudio(step({ sound: [["G", "B", "D", "F"], ["C", "E", "G", "B"]], play: "before" }), ctx)!;
    expect(a.voicings).toEqual([stackUp(["G", "B", "D", "F"], 48), stackUp(["C", "E", "G", "B"], 48)]);
  });

  it("interval: the lit notes one by one, then together", () => {
    const a = stepAudio(step({ play: "interval", highlight: [{ note: "B", label: "3rd" }, { note: "F", label: "7th" }] }))!;
    expect(a.voicings).toEqual([[59], [65], [59, 65]]);
  });

  it("before / after play the move's chords, voice-led by theory-core; ab rests a beat between", () => {
    expect(stepAudio(step({ play: "before" }), ctx)!.voicings).toEqual(voiced(ctx.before));
    expect(stepAudio(step({ play: "after" }), ctx)!.voicings).toEqual(voiced(ctx.after));
    expect(stepAudio(step({ play: "ab" }), ctx)!.voicings).toEqual([...voiced(ctx.before), [], ...voiced(ctx.after)]);
  });

  it("nothing to play is null, never a guess", () => {
    expect(stepAudio(step({ play: "before" }))).toBeNull();
    expect(stepAudio(step({ play: "ab" }), { before: ctx.before })).toBeNull();
    expect(stepAudio(step({}), ctx)).toBeNull();
    expect(stepAudio(step({ play: "interval" }))).toBeNull();
  });

  it("every basics lesson's step 1 plays something, with the lesson's own pitch classes", () => {
    const ids = CONCEPTS.map((c) => c.id).filter(hasBasicsLesson);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const l = basicsLesson(id, "Eb")!;
      const a = stepAudio(l.steps[0]);
      expect(a, id).not.toBeNull();
      const sound = l.steps[0].sound;
      if (sound) expect(a!.voicings.map((v) => v.map((m) => m % 12))).toEqual(sound.map((c) => c.map((n) => chroma(n))));
    }
  });
});
