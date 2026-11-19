import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chroma } from "../src/pitch";
import { drillKeyOrder, type DrillKeyReview } from "../src/srs";
import { KEYS } from "../src/transpose";

const now = new Date("2026-11-19T12:00:00Z");
const DAY = 86_400_000;
const rev = (keyTonic: string, lastGrade: number | null, dueInDays: number): DrillKeyReview => ({
  keyTonic,
  lastGrade,
  dueAt: new Date(now.getTime() + dueInDays * DAY).toISOString(),
});

describe("drillKeyOrder: a 12-key drill, weakest keys first", () => {
  it("with no history, it's the circle of fifths from the start key, every key new", () => {
    const order = drillKeyOrder([], "F", now);
    expect(order.map((k) => k.key)).toEqual(["F", "C", "G", "D", "A", "E", "B", "Gb", "Db", "Ab", "Eb", "Bb"]);
    expect(order.every((k) => k.why === "new")).toBe(true);
  });

  it("due keys come first (most overdue first), then weak, then new, then solid", () => {
    const order = drillKeyOrder(
      [
        rev("G", 5, 4), // solid, not due
        rev("D", 2, 1), // weak, not due yet
        rev("Bb", 5, -1), // due a day ago
        rev("E", 3, -3), // due three days ago
        rev("Ab", 1, 2), // weaker still
      ],
      "C",
      now,
    );
    expect(order.slice(0, 4).map((k) => [k.key, k.why])).toEqual([
      ["E", "due"],
      ["Bb", "due"],
      ["Ab", "weak"],
      ["D", "weak"],
    ]);
    expect(order[order.length - 1]).toEqual({ key: "G", why: "solid" });
    expect(order.filter((k) => k.why === "new").map((k) => k.key)).toEqual(["C", "A", "B", "Gb", "Db", "Eb", "F"]);
  });

  it("a spelling in the history matches its key (C# is D♭)", () => {
    const order = drillKeyOrder([rev("C#", 1, 1)], "C", now);
    expect(order[0]).toEqual({ key: "Db", why: "weak" });
  });

  it("always lists each of the 12 keys exactly once, whatever the history", () => {
    const review = fc.record({
      keyTonic: fc.constantFrom(...KEYS, "C#", "F#", "A#"),
      lastGrade: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
      dueAt: fc.integer({ min: -30, max: 30 }).map((d) => new Date(now.getTime() + d * DAY).toISOString()),
    });
    fc.assert(
      fc.property(fc.array(review, { maxLength: 20 }), fc.constantFrom(...KEYS), (reviews, start) => {
        const keys = drillKeyOrder(reviews, start, now).map((k) => chroma(k.key));
        expect(new Set(keys).size).toBe(12);
        expect(keys).toHaveLength(12);
      }),
    );
  });
});
