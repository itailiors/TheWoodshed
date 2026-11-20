import { CONCEPTS } from "@reharm/theory-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProgress } from "../library/demoHistory";
import type { Review } from "../library/practice";
import { DEFAULT_EXPLAIN, depthFor, EXPLAIN_STORE, explainFor, latestRunFor, readExplainSetting, roughRunLine, writeExplainSetting, type GradedRun } from "./explainDepth";
import { LESSONS_STORE, readLessonFlags, updateLessonFlag } from "./lessonFlags";
import { ownProgressOnly, type OwnProgress } from "./pathStates";
import { memoryStorage, throwingStorage } from "./testStorage";

const run = (grade: number, at = "2026-11-20T10:00:00.000Z", keyTonic = "Ab"): GradedRun => ({ keyTonic, grade, at });

describe("depthFor: the setting overrides fading; fading waits for a clean key", () => {
  it.each([
    // setting, clean keys, latest run, already reopened for, → open, says rough
    ["steps", 0, null, undefined, true, false, "a new concept opens the steps"],
    ["steps", 0, run(5), undefined, true, false, "a finished lesson (or a messy run) with 0 clean keys stays open"],
    ["steps", 1, run(5), undefined, false, false, "1 clean key folds"],
    ["steps", 4, null, undefined, false, false, "clean keys with no graded latest run fold"],
    ["steps", 1, run(2), undefined, true, true, "a latest run graded 2 reopens the steps"],
    ["steps", 1, run(0), undefined, true, true, "a latest run graded 0 reopens the steps"],
    ["steps", 1, run(3), undefined, false, false, "a grade of 3 doesn't"],
    ["steps", 1, run(2), run(2).at, false, false, "the same rough run reopens them once only"],
    ["steps", 1, run(1, "2026-11-21T10:00:00.000Z"), run(2).at, true, true, "a newer rough run reopens them again"],
    ["rule", 0, null, undefined, false, false, '"Just the rule" folds a new concept'],
    ["rule", 3, run(5), undefined, false, false, '"Just the rule" folds a familiar one'],
    ["rule", 1, run(1), undefined, false, false, '"Just the rule" never reopens on a rough run'],
  ] as const)("%s, %i clean, %o (reopened for %s) → open %s, rough %s: %s", (setting, clean, latest, spent, open, rough, _why) => {
    const d = depthFor(setting, clean, latest, spent);
    expect(d.open).toBe(open);
    expect(d.rough !== null).toBe(rough);
    if (rough) expect(d.rough).toEqual(latest);
  });

  it("says the rough run's key in display spelling", () => {
    expect(roughRunLine("A♭")).toBe("A rough run in A♭: the steps are open again.");
  });
});

const review = (p: Partial<Review>): Review => ({
  ruleId: "dominant.tritoneSub",
  keyTonic: "C",
  reps: 1,
  ease: 2.5,
  intervalDays: 1,
  dueAt: "2026-11-21T00:00:00.000Z",
  attempts: 1,
  cleanRuns: 0,
  lastGrade: 3,
  lastReviewedAt: "2026-11-19T00:00:00.000Z",
  ...p,
});

describe("explainFor: from the player's own runs", () => {
  it("takes the latest graded run across the concept's keys (ms or ISO dates)", () => {
    const own: OwnProgress = {
      concepts: [
        review({ keyTonic: "C", lastGrade: 5, lastReviewedAt: "2026-11-19T00:00:00.000Z" }),
        review({ keyTonic: "Ab", lastGrade: 1, lastReviewedAt: Date.parse("2026-11-20T09:00:00.000Z") }),
        review({ keyTonic: "D", lastGrade: null, lastReviewedAt: null }),
        review({ ruleId: "functional.secondaryTwoFive", keyTonic: "E", lastGrade: 0, lastReviewedAt: "2026-11-20T11:00:00.000Z" }),
      ],
      cleanKeys: { "dominant.tritoneSub": ["C"] },
    };
    expect(latestRunFor(own, "dominant.tritoneSub")).toEqual({ keyTonic: "Ab", grade: 1, at: "2026-11-20T09:00:00.000Z" });
    expect(latestRunFor(own, "basics:sevenths")).toBeNull();
    expect(explainFor("steps", own, "dominant.tritoneSub")).toEqual({ open: true, rough: { keyTonic: "Ab", grade: 1, at: "2026-11-20T09:00:00.000Z" } });
    expect(explainFor("steps", own, "dominant.tritoneSub", { reopenedFor: "2026-11-20T09:00:00.000Z" }).open).toBe(false);
    expect(explainFor("rule", own, "basics:sevenths").open).toBe(false);
  });

  it("the demo's seeded sample never folds anything (rule 11)", async () => {
    const sample = { ...(await demoProgress(Date.UTC(2026, 10, 20, 12))), sample: true };
    // read raw, the sample would fold some concept: the guard is what keeps it out
    expect(CONCEPTS.some((c) => !explainFor("steps", sample, c.id).open)).toBe(true);
    const own = ownProgressOnly(sample);
    for (const c of CONCEPTS) expect(explainFor("steps", own, c.id), c.id).toEqual({ open: true, rough: null });
  });
});

describe("the setting, per browser (reharm.explain)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a new visitor gets Step by step", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect(DEFAULT_EXPLAIN).toBe("steps");
    expect(readExplainSetting()).toBe("steps");
  });

  it("stores the choice and reads it back; junk reads as the default", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    writeExplainSetting("rule");
    expect(localStorage.getItem(EXPLAIN_STORE)).toBe("rule");
    expect(readExplainSetting()).toBe("rule");
    localStorage.setItem(EXPLAIN_STORE, "everything");
    expect(readExplainSetting()).toBe("steps");
  });

  it("blocked storage is never an error: the default, and a write is a no-op", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(readExplainSetting()).toBe("steps");
    expect(() => writeExplainSetting("rule")).not.toThrow();
    expect(readExplainSetting()).toBe("steps");
  });

  it("the spent rough run rides in the lesson flags and survives a read", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    updateLessonFlag("dominant.tritoneSub", { reopenedFor: "2026-11-20T09:00:00.000Z" });
    expect(readLessonFlags()["dominant.tritoneSub"]).toEqual({ reopenedFor: "2026-11-20T09:00:00.000Z" });
    localStorage.setItem(LESSONS_STORE, JSON.stringify({ v: 1, flags: { "dominant.tritoneSub": { reopenedFor: 7 } } }));
    expect(readLessonFlags()).toEqual({});
  });
});
