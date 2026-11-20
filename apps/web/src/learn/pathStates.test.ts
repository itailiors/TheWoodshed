import { CONCEPTS } from "@reharm/theory-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProgress } from "../library/demoHistory";
import { browserHistory } from "../library/historyBrowser";
import { memoryBackend } from "../library/localPractice";
import { LESSONS_STORE, readLessonFlags } from "./lessonFlags";
import { ownProgressOnly, pathStates } from "./pathStates";
import { memoryStorage, throwingStorage } from "./testStorage";

const NOW = new Date("2026-11-20T12:00:00Z");
const notYet = new Set(["new", "recommendedFirst"]);

/** The demo's adapter over an empty in-memory store, with the real seeded sample behind it. */
const demoAdapter = () => {
  const store = memoryBackend();
  return browserHistory({ store: async () => store, sample: () => demoProgress(NOW.getTime()), onTabOnly: () => {} });
};

const fresh = pathStates(null, {}, NOW);

describe("path states come from this browser's own runs and flags", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the seeded sample yields nothing above Recommended first, and the same Next up as a fresh player", async () => {
    const p = await demoAdapter().progress();
    expect(p?.sample).toBe(true);
    expect(ownProgressOnly(p)).toEqual({ concepts: [], cleanKeys: {} });
    const { states, nextUp } = pathStates(p, {}, NOW);
    for (const c of CONCEPTS) expect(notYet.has(states.get(c.id)!.state), c.id).toBe(true);
    for (const c of CONCEPTS) expect(states.get(c.id)!.due, c.id).toBe(false);
    expect(nextUp).toEqual(fresh.nextUp);
  });

  it("one clean run of the player's own makes that concept Familiar", async () => {
    const h = demoAdapter();
    const res = await h.saveCoachRun({ tuneId: "co-op-blues", moveId: "dominant.tritoneSub@10.1", ruleId: "dominant.tritoneSub", keyTonic: "F", misses: 0, leaps: 0, maxLeap: 2 });
    expect(res?.clean).toBe(true);
    const p = await h.progress();
    expect(p?.sample).toBeFalsy();
    const s = pathStates(p, {}, NOW).states.get("dominant.tritoneSub")!;
    expect(s).toMatchObject({ state: "familiar", cleanKeys: 1 });
  });

  it("finishing a lesson makes it Familiar for the path (decision 6) and moves Next up on", () => {
    const { states, nextUp } = pathStates(null, { "basics:sevenths": { seenAt: "2026-11-20", finishedAt: "2026-11-20" } }, NOW);
    expect(states.get("basics:sevenths")!.state).toBe("familiar");
    expect(nextUp).not.toContain("basics:sevenths");
    expect(nextUp).toContain("basics:guideTones");
  });

  it("blocked storage reads as no flags, and the path is a fresh player's", () => {
    vi.stubGlobal("localStorage", throwingStorage());
    const flags = readLessonFlags();
    expect(flags).toEqual({});
    expect(pathStates(null, flags, NOW).nextUp).toEqual(fresh.nextUp);
  });

  it("an unknown version of reharm.lessons is ignored", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    localStorage.setItem(LESSONS_STORE, JSON.stringify({ v: 2, flags: { "basics:sevenths": { finishedAt: "2026-11-20" } } }));
    expect(pathStates(null, readLessonFlags(), NOW).states.get("basics:sevenths")!.state).toBe("new");
  });

  it("a malformed entry is dropped, and the good ones still count", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    const flags = { "basics:sevenths": { finishedAt: "2026-11-20" }, "basics:tritone": { finishedAt: 42 } };
    localStorage.setItem(LESSONS_STORE, JSON.stringify({ v: 1, flags }));
    const { states } = pathStates(null, readLessonFlags(), NOW);
    expect(states.get("basics:sevenths")!.state).toBe("familiar");
    expect(states.get("basics:tritone")!.state).toBe("new");
  });
});
