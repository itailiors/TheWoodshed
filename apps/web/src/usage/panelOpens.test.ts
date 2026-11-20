import { describe, expect, it } from "vitest";
import { learningSummary } from "./panelOpens";

const c = (opens: number) => ({ opens, lastAt: 0 });

describe("the ⚙ Learning lines read the success criteria off the counters", () => {
  it("names the targets, and the Continue-anyway share as a percentage", () => {
    expect(learningSummary({ "learn.finish": c(2), "prereq.view": c(4), "prereq.continueAnyway": c(3), "why.open": c(5), "study.why": c(5) })).toEqual([
      "Lessons finished: 2 (target: 3 in the first week)",
      "Continue anyway: 3 of 4 notes (75%); 50% or more builds the skip-ahead test",
      "Why it works opened: 5 (Study baseline counter: 5)",
    ]);
  });

  it("reads nothing counted yet as zeros, with no 0/0 percentage", () => {
    expect(learningSummary({})[1]).toBe("Continue anyway: 0 of 0 notes; 50% or more builds the skip-ahead test");
  });
});
