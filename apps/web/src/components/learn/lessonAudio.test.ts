import {
  basicsLesson,
  canonicalMove,
  chroma,
  CONCEPTS,
  generateMoves,
  hasBasicsLesson,
  KEYS,
  lessonForMove,
  referenceTune,
  voiceProgression,
  type ChordLike,
  type LessonStep,
} from "@reharm/theory-core";
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

  it("places each lit key the way the text moves: a fall is drawn below, a rise above", () => {
    expect(placeHighlights([{ note: "F" }, { note: "E", dir: "down" }])).toEqual([65, 64]);
    expect(placeHighlights([{ note: "Gb" }, { note: "F", dir: "down" }, { note: "C", dir: "up" }])).toEqual([54, 53, 60]);
    expect(placeHighlights([{ note: "C" }, { note: "F", dir: "down" }])).toEqual([60, 53]); // C falls a fifth to F
    // nearest when the text says nothing; a tritone goes up
    expect(placeHighlights(["E", "F"])).toEqual([64, 65]);
    expect(placeHighlights(["C", "Gb"])).toEqual([60, 66]);
    // a whole falling chain stays together, centred near middle C
    const fifths = placeHighlights([{ note: "G" }, { note: "C", dir: "down" }, { note: "F", dir: "down" }]);
    expect(fifths[0] - fifths[1]).toBe(7);
    expect(fifths[1] - fifths[2]).toBe(7);
    expect(Math.abs((fifths[0] + fifths[2]) / 2 - 61)).toBeLessThanOrEqual(6);
  });

  it("Co-op Blues: F falls to E, B♭ falls to A and G♭ slides down to F, all drawn downward", () => {
    const { accepted } = generateMoves(referenceTune);
    const lessonOf = (id: string) => lessonForMove(accepted.find((m) => m.id.startsWith(id))!)!;
    const twoFive = lessonOf("functional.secondaryTwoFive@");
    // step 3: "Gm9's 7th: F falls to E"
    const s3 = placeHighlights(twoFive.steps[2].highlight);
    expect(twoFive.steps[2].text).toContain("F falls to E");
    expect(s3[1] - s3[0]).toBe(-1);
    // step 4: "… B♭ falls to A"
    const s4 = twoFive.steps[3].highlight;
    const p4 = placeHighlights(s4);
    const bb = s4.findIndex((h) => h.note === "Bb");
    expect(twoFive.steps[3].text).toContain("B♭ falls to A");
    expect(p4[bb + 1] - p4[bb]).toBe(-1);
    const tritone = lessonOf("dominant.tritoneSub@10");
    const s5 = tritone.steps[4];
    const p5 = placeHighlights(s5.highlight);
    expect(s5.text).toContain("G♭ slides down a half step to F");
    expect(p5[1] - p5[0]).toBe(-1); // G♭ → F
    expect(p5[2] - p5[1]).toBe(7); // C sits a fifth above F: "C falling a fifth"
  });

  it("every directed key in every lesson lands on the side its text says", () => {
    const { accepted } = generateMoves(referenceTune);
    const lessons = [
      ...accepted.map((m) => lessonForMove(m)).filter((l): l is NonNullable<typeof l> => !!l),
      ...CONCEPTS.map((c) => c.id).filter(hasBasicsLesson).flatMap((id) => KEYS.map((k) => basicsLesson(id, k)!)),
    ];
    expect(lessons.length).toBeGreaterThan(100);
    for (const l of lessons)
      for (const s of l.steps) {
        const p = placeHighlights(s.highlight);
        s.highlight.forEach((h, i) => {
          if (h.dir === "up") expect(p[i], `${l.conceptId}: ${s.text}`).toBeGreaterThan(p[i - 1]);
          if (h.dir === "down") expect(p[i], `${l.conceptId}: ${s.text}`).toBeLessThan(p[i - 1]);
          // a directed key is the nearest one that way: never a leap past the octave
          if (h.dir) expect(Math.abs(p[i] - p[i - 1]), `${l.conceptId}: ${s.text}`).toBeLessThanOrEqual(12);
        });
      }
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
