import { describe, expect, it, vi } from "vitest";
import { browserHistory } from "./historyBrowser";
import { memoryBackend } from "./localPractice";
import type { Progress } from "./practice";

/** A sample notebook with one overdue review, so a leak into `due()` would show. */
const SAMPLE: Progress = {
  concepts: [],
  places: {},
  cleanKeys: {},
  due: [
    {
      ruleId: "ear:fifth-down",
      keyTonic: "C",
      reps: 1,
      ease: 2.5,
      intervalDays: 1,
      dueAt: 0,
      attempts: 1,
      cleanRuns: 0,
      lastGrade: 2,
      lastReviewedAt: 0,
      lastPlace: null,
    },
  ],
  recentImprov: [],
};

const setup = (persistent = true) => {
  const store = Object.assign(memoryBackend(), { persistent });
  const onTabOnly = vi.fn();
  const h = browserHistory({ store: async () => store, sample: async () => SAMPLE, onTabOnly });
  return { h, onTabOnly };
};

const run = { tuneId: "co-op-blues", moveId: "tritone@3.1", ruleId: "tritone-sub", keyTonic: "F", misses: 0, leaps: 0, maxLeap: 2 };

describe("practice history kept in this browser (the demo's adapter)", () => {
  it("shows the labelled sample notebook before the first saved run, but never its due reviews", async () => {
    const { h } = setup();
    expect((await h.progress())?.sample).toBe(true);
    expect(await h.due()).toEqual([]);
  });

  it("switches to the player's own runs once one is saved, never mixing in the sample", async () => {
    const { h, onTabOnly } = setup();
    const res = await h.saveCoachRun(run);
    expect(res?.clean).toBe(true);
    expect(typeof res?.review.dueAt).toBe("string");

    const p = await h.progress();
    expect(p?.sample).toBeUndefined();
    expect(p?.storedIn).toBe("browser");
    expect(p?.concepts.map((c) => [c.ruleId, c.keyTonic])).toEqual([["tritone-sub", "F"]]);
    expect(p?.cleanKeys["tritone-sub"]).toEqual(["F"]);
    expect(onTabOnly).not.toHaveBeenCalled();
  });

  it("says when runs only last this tab", async () => {
    const { h, onTabOnly } = setup(false);
    await h.saveCoachRun(run);
    expect(onTabOnly).toHaveBeenCalledOnce();
    expect((await h.progress())?.storedIn).toBe("tab");
  });

  it("files a solo pass under its chart", async () => {
    const { h } = setup();
    const ok = await h.saveImprovRun({
      tuneId: "co-op-blues",
      level: 2,
      view: "reharm",
      loopStartBar: 1,
      loopEndBar: 12,
      notes: 40,
      chordTonePct: 60,
      tensionPct: 25,
      avoidPct: 5,
      outsidePct: 10,
      strongBeatChordTonePct: 70,
      guideToneLandings: 4,
      heldAvoidNotes: 0,
    });
    expect(ok).toBe(true);
    const p = await h.progress("co-op-blues");
    expect(p?.recentImprov.map((r) => r.tuneId)).toEqual(["co-op-blues"]);
  });
});
