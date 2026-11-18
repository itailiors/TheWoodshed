import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyCoachRun,
  chroma,
  KEYS,
  normaliseKey,
  RECENT_IMPROV_LIMIT,
  summariseProgress,
  type CoachAttemptRecord,
  type ConceptReview,
  type ImprovRunRecord,
} from "../src";

/*
 * The shared practice-history path: the API stores runs in SQLite and the static demo stores
 * them in the browser, but both grade, schedule and summarise them with these functions.
 */

const DAY = 86_400_000;
const t0 = new Date("2026-11-18T12:00:00Z");
const PLACE = { tuneId: "coop-blues", moveId: "dominant.tritoneSub@4.1" };

/** A tiny in-memory history, the way the browser store keeps one. */
function history() {
  const reviews = new Map<string, ConceptReview>();
  const attempts: CoachAttemptRecord[] = [];
  const improv: ImprovRunRecord[] = [];
  const run = (r: { ruleId: string; keyTonic: string; misses: number; leaps: number; tuneId?: string | null; moveId?: string }, now: Date) => {
    const id = `${r.ruleId}|${normaliseKey(r.keyTonic)}`;
    const res = applyCoachRun(reviews.get(id) ?? null, r, now);
    reviews.set(id, res.review);
    attempts.push({ ...r, keyTonic: normaliseKey(r.keyTonic), tuneId: r.tuneId ?? null, moveId: r.moveId ?? "m", clean: res.clean, createdAt: now });
    return res;
  };
  const all = () => ({ reviews: [...reviews.values()], attempts, improv });
  return { run, all, improv };
}

describe("applyCoachRun + summariseProgress (shared by the API and the browser store)", () => {
  it("replays the API's practice scenario with the same grades, schedule, clean keys and places", () => {
    const h = history();
    const tri = (keyTonic: string, misses: number, leaps = 0) => h.run({ ruleId: "dominant.tritoneSub", keyTonic, misses, leaps, ...PLACE }, t0);

    expect(tri("Bb", 0)).toMatchObject({ grade: 5, clean: true, review: { reps: 1, intervalDays: 1 } });
    expect(tri("A#", 0).review).toMatchObject({ keyTonic: "Bb", reps: 2, intervalDays: 3, cleanRuns: 2 }); // same key, other spelling
    expect(tri("D", 2)).toMatchObject({ grade: 2, clean: false, review: { keyTonic: "D", reps: 0 } }); // reset: retry in 10 min
    tri("Ab", 0, 1); // right notes, a leap: not clean

    const p = summariseProgress(h.all(), t0);
    expect(p.cleanKeys).toEqual({ "dominant.tritoneSub": ["Bb"] });
    expect(p.places).toEqual({ "dominant.tritoneSub": PLACE });
    expect(p.concepts.map((c) => [c.keyTonic, c.attempts])).toEqual([
      ["Ab", 1],
      ["Bb", 2],
      ["D", 1],
    ]);
    expect(p.due).toEqual([]); // the earliest retry is 10 minutes out

    // two days on: D (missed) and Ab (not clean, 1-day gap) are due; Bb (3-day gap) isn't
    const later = summariseProgress(h.all(), new Date(t0.getTime() + 2 * DAY));
    expect(later.due.map((d) => d.keyTonic)).toEqual(["D", "Ab"]); // oldest due first
    for (const d of later.due) expect(d.lastPlace).toEqual(PLACE);
  });

  it("serialises dates the way the API's JSON does (ISO strings)", () => {
    const h = history();
    h.run({ ruleId: "r", keyTonic: "C", misses: 0, leaps: 0 }, t0);
    const [c] = summariseProgress(h.all(), t0).concepts;
    expect(c.lastReviewedAt).toBe(t0.toISOString());
    expect(c.dueAt).toBe(new Date(t0.getTime() + DAY).toISOString());
  });

  it("a concept practised only off-tune (a 12-key concept drill) has no place", () => {
    const h = history();
    h.run({ ruleId: "r", keyTonic: "C", misses: 0, leaps: 0, tuneId: null }, t0);
    expect(summariseProgress(h.all(), t0).places).toEqual({ r: null });
  });

  it("recent solo passes: newest first, filtered by tune, at most the API's limit", () => {
    const h = history();
    const pass = (i: number, tuneId: string) =>
      h.improv.push({
        id: i,
        tuneId,
        level: 2,
        view: "reharm",
        notes: 12,
        chordTonePct: i,
        tensionPct: 0,
        avoidPct: 0,
        outsidePct: 0,
        strongBeatChordTonePct: null,
        guideToneLandings: 0,
        heldAvoidNotes: 0,
        createdAt: new Date(t0.getTime() + i * 60_000),
      });
    for (let i = 1; i <= RECENT_IMPROV_LIMIT + 5; i++) pass(i, i % 2 ? "a" : "b");
    const all = summariseProgress(h.all(), t0).recentImprov;
    expect(all).toHaveLength(RECENT_IMPROV_LIMIT);
    expect(all[0].chordTonePct).toBe(RECENT_IMPROV_LIMIT + 5);
    const a = summariseProgress(h.all(), t0, "a").recentImprov;
    expect(a.every((r) => r.tuneId === "a")).toBe(true);
    expect(a.map((r) => r.chordTonePct)).toEqual([...a.map((r) => r.chordTonePct)].sort((x, y) => y - x));
  });

  it("any run history: a key is clean iff it had a clean run, tallies add up, and due means due", () => {
    const runArb = fc.record({
      ruleId: fc.constantFrom("a", "b", "c"),
      keyTonic: fc.constantFrom(...KEYS, "C#", "A#", "F#"),
      misses: fc.nat({ max: 5 }),
      leaps: fc.nat({ max: 2 }),
      minutes: fc.nat({ max: 60 * 24 * 10 }),
    });
    fc.assert(
      fc.property(fc.array(runArb, { maxLength: 40 }), fc.nat({ max: 20 }), (runs, daysLater) => {
        const h = history();
        const sorted = [...runs].sort((x, y) => x.minutes - y.minutes);
        for (const r of sorted) h.run(r, new Date(t0.getTime() + r.minutes * 60_000));
        const now = new Date(t0.getTime() + daysLater * DAY);
        const p = summariseProgress(h.all(), now);

        for (const c of p.concepts) {
          const mine = sorted.filter((r) => r.ruleId === c.ruleId && chroma(r.keyTonic) === chroma(c.keyTonic));
          expect(c.attempts).toBe(mine.length);
          expect(c.cleanRuns).toBe(mine.filter((r) => r.misses === 0 && r.leaps === 0).length);
          expect((p.cleanKeys[c.ruleId] ?? []).includes(c.keyTonic)).toBe(c.cleanRuns > 0);
        }
        expect(p.due.every((d) => new Date(d.dueAt).getTime() <= now.getTime())).toBe(true);
        expect(p.concepts.filter((c) => new Date(c.dueAt).getTime() <= now.getTime())).toHaveLength(p.due.length);
        expect(p.due.map((d) => d.dueAt)).toEqual([...p.due.map((d) => d.dueAt)].sort());
      }),
    );
  });
});
