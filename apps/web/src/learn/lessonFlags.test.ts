import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLessonFlags, LESSONS_STORE, markLessonSeen, onLessonFlagsChanged, parseLessonFlags, readLessonFlags, updateLessonFlag } from "./lessonFlags";
import { memoryStorage, throwingStorage } from "./testStorage";

const doc = (flags: unknown, v: unknown = 1) => JSON.stringify({ v, flags });

describe("lesson flags in reharm.lessons", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("reads {v: 1, flags}, keeping every known field", () => {
    const flag = {
      seenAt: "2026-11-20T10:00:00Z",
      finishedAt: "2026-11-20T10:05:00Z",
      testedOutAt: "2026-11-20T10:06:00Z",
      testedOutVia: "dominant.tritoneSub",
      relearn: false,
      lastStage: "self",
      continuedAnyway: true,
    };
    expect(parseLessonFlags(doc({ "basics:tritone": flag }))).toEqual({ "basics:tritone": flag });
  });

  it("ignores an unknown version, junk and a missing value: all read as empty", () => {
    expect(parseLessonFlags(doc({ "basics:tritone": { seenAt: "2026-11-20" } }, 2))).toEqual({});
    expect(parseLessonFlags(JSON.stringify({ "basics:tritone": { seenAt: "2026-11-20" } }))).toEqual({});
    expect(parseLessonFlags("{not json")).toEqual({});
    expect(parseLessonFlags(doc([]))).toEqual({});
    expect(parseLessonFlags(null)).toEqual({});
  });

  it("drops a malformed entry and keeps the rest; strips fields it doesn't know", () => {
    const flags = parseLessonFlags(
      doc({
        "basics:tritone": { seenAt: "2026-11-20" },
        "basics:sevenths": { seenAt: "yesterday-ish" },
        "basics:numerals": { lastStage: "jam" },
        "basics:guideTones": { relearn: "yes" },
        "basics:dim7": "finished",
        "modal.borrowedIv": { finishedAt: "2026-11-19", colour: "blue" },
      }),
    );
    expect(flags).toEqual({ "basics:tritone": { seenAt: "2026-11-20" }, "modal.borrowedIv": { finishedAt: "2026-11-19" } });
  });

  it("updates one entry, removes a field set to undefined, and deletes an entry left empty", () => {
    updateLessonFlag("dominant.tritoneSub", { seenAt: "2026-11-20T10:00:00Z", lastStage: "learn" });
    updateLessonFlag("dominant.tritoneSub", { lastStage: "play", relearn: true });
    expect(readLessonFlags()).toEqual({ "dominant.tritoneSub": { seenAt: "2026-11-20T10:00:00Z", lastStage: "play", relearn: true } });
    expect(JSON.parse(localStorage.getItem(LESSONS_STORE)!).v).toBe(1);
    updateLessonFlag("dominant.tritoneSub", { seenAt: undefined, lastStage: undefined, relearn: undefined });
    expect(readLessonFlags()).toEqual({});
  });

  it("never overwrites a newer version's store (a downgrade keeps it for the newer app)", () => {
    const newer = doc({ "basics:tritone": { seenAt: "2026-11-20T10:00:00Z", futureField: 1 } }, 2);
    localStorage.setItem(LESSONS_STORE, newer);
    expect(readLessonFlags()).toEqual({});
    updateLessonFlag("basics:dim7", { seenAt: "2026-11-20T11:00:00Z" });
    expect(localStorage.getItem(LESSONS_STORE)).toBe(newer);
    clearLessonFlags(); // "Erase runs" in this older build leaves the newer app's flags alone too
    expect(localStorage.getItem(LESSONS_STORE)).toBe(newer);
  });

  it("markLessonSeen stamps the first open only: a repeat (StrictMode, a remount) writes and notifies nothing", () => {
    const fn = vi.fn();
    const off = onLessonFlagsChanged(fn);
    markLessonSeen("basics:tritone", new Date("2026-11-20T10:00:00Z"));
    markLessonSeen("basics:tritone", new Date("2026-11-21T10:00:00Z"));
    off();
    expect(readLessonFlags()).toEqual({ "basics:tritone": { seenAt: "2026-11-20T10:00:00.000Z" } });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("refuses an update that would store a malformed entry", () => {
    updateLessonFlag("basics:tritone", { seenAt: "2026-11-20" });
    updateLessonFlag("basics:tritone", { lastStage: "jam" as never });
    expect(readLessonFlags()).toEqual({ "basics:tritone": { seenAt: "2026-11-20" } });
  });

  it("tells subscribers about every change, until they unsubscribe", () => {
    const fn = vi.fn();
    const off = onLessonFlagsChanged(fn);
    updateLessonFlag("basics:tritone", { seenAt: "2026-11-20" });
    clearLessonFlags();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    updateLessonFlag("basics:tritone", { seenAt: "2026-11-20" });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never throws when the browser blocks storage: reads are empty, writes are no-ops", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    expect(readLessonFlags()).toEqual({});
    expect(() => updateLessonFlag("basics:tritone", { seenAt: "2026-11-20" })).not.toThrow();
    expect(() => clearLessonFlags()).not.toThrow();
  });
});

describe("the demo's Erase runs", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("clears the lesson flags too, test-outs included: a clean slate, never a half-reset", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => {}); // the store's "no IndexedDB here" note
    const { forgetLocalPractice, onPracticeSaved } = await import("../library/practice");
    updateLessonFlag("dominant.tritoneSub", { testedOutAt: "2026-11-20T10:00:00Z" });
    updateLessonFlag("basics:tritone", { testedOutAt: "2026-11-20T10:00:00Z", testedOutVia: "dominant.tritoneSub" });
    const saved = vi.fn();
    const off = onPracticeSaved(saved);
    await forgetLocalPractice();
    off();
    expect(readLessonFlags()).toEqual({});
    expect(localStorage.getItem(LESSONS_STORE)).toBeNull();
    expect(saved).toHaveBeenCalledOnce();
  });
});
