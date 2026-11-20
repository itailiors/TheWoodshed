import { describe, expect, it } from "vitest";
import { coachInput, modeForStage, openingStage, stagesFor, type CoachInput } from "./gradingMode";
import type { LessonStage } from "@reharm/theory-core";

describe("modeForStage: the stage ladder onto the drill", () => {
  const table: [LessonStage, CoachInput, ReturnType<typeof modeForStage>][] = [
    // Learn never mounts the drill, whatever the input (grader isolation)
    ["learn", "none", null],
    ["learn", "qwerty", null],
    ["learn", "midi", null],
    ["study", "none", { grading: "study", hintForced: false, strikes: false }],
    ["study", "qwerty", { grading: "study", hintForced: false, strikes: false }],
    // a keyboard being plugged in changes nothing in Study: nothing is graded there
    ["study", "midi", { grading: "study", hintForced: false, strikes: false }],
    // Self-check: the acoustic self-check, or listen with the hint forced on when the engine can hear you
    ["self", "none", { grading: "self", hintForced: false, strikes: false }],
    ["self", "qwerty", { grading: "listen", hintForced: true, strikes: true }],
    ["self", "midi", { grading: "listen", hintForced: true, strikes: true }],
    ["play", "none", { grading: "listen", hintForced: false, strikes: true }],
    ["play", "qwerty", { grading: "listen", hintForced: false, strikes: true }],
    ["play", "midi", { grading: "listen", hintForced: false, strikes: true }],
  ];
  it.each(table)("%s with %s input", (stage, input, want) => {
    expect(modeForStage(stage, input)).toEqual(want);
  });

  it("strikes are heard only on Play it and Self-check's hint mode", () => {
    for (const [stage, input] of table) {
      const heard = !!modeForStage(stage, input)?.strikes;
      expect(heard).toBe(stage === "play" || (stage === "self" && input !== "none"));
    }
  });

  it("MIDI wins over the computer keys", () => {
    expect(coachInput(true, true)).toBe("midi");
    expect(coachInput(false, true)).toBe("qwerty");
    expect(coachInput(false, false)).toBe("none");
  });
});

describe("the ladder and where a concept opens", () => {
  const base = { hasLesson: true, basics: false, touchFirst: false, midiConnected: false } as const;

  it("a rule without a lesson has no Learn stage; a basic has only Learn", () => {
    expect(stagesFor(true, false)).toEqual(["learn", "study", "self", "play"]);
    expect(stagesFor(false, false)).toEqual(["study", "self", "play"]);
    expect(stagesFor(true, true)).toEqual(["learn"]);
  });

  it("not yet Familiar opens on Learn; Familiar or above on Play it", () => {
    for (const state of ["new", "recommendedFirst", "learning"] as const) expect(openingStage({ ...base, state })).toBe("learn");
    for (const state of ["familiar", "proficient", "mastered"] as const) expect(openingStage({ ...base, state })).toBe("play");
  });

  it("a rule without a lesson opens on Play it as before (Self-check on a phone without MIDI)", () => {
    expect(openingStage({ ...base, hasLesson: false, state: "new" })).toBe("play");
    expect(openingStage({ ...base, hasLesson: false, state: "new", touchFirst: true })).toBe("self");
    expect(openingStage({ ...base, hasLesson: false, state: "new", touchFirst: true, midiConnected: true })).toBe("play");
  });

  it("the stage it was left on wins, unless it isn't on this ladder", () => {
    expect(openingStage({ ...base, state: "new", lastStage: "study" })).toBe("study");
    expect(openingStage({ ...base, state: "mastered", lastStage: "learn" })).toBe("learn");
    expect(openingStage({ ...base, hasLesson: false, state: "new", lastStage: "learn" })).toBe("play");
    expect(openingStage({ ...base, basics: true, state: "familiar", lastStage: "play" })).toBe("learn");
  });
});
