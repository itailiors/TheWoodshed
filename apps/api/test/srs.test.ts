import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gradeAttempt, MIN_EASE, RETRY_AFTER_MINUTES, scheduleReview, type Grade, type ReviewState } from "../src/practice/srs";

const now = new Date("2026-11-11T12:00:00Z");
const gradeArb = fc.constantFrom<Grade>(0, 1, 2, 3, 4, 5);

describe("spaced repetition", () => {
  it("grades runs: clean & smooth 5, clean with a leap 4, one miss 3, more misses lower", () => {
    expect(gradeAttempt({ misses: 0, leaps: 0 })).toBe(5);
    expect(gradeAttempt({ misses: 0, leaps: 2 })).toBe(4);
    expect(gradeAttempt({ misses: 1, leaps: 0 })).toBe(3);
    expect(gradeAttempt({ misses: 3, leaps: 0 })).toBe(2);
    expect(gradeAttempt({ misses: 9, leaps: 0 })).toBe(1);
  });

  it("first successes come back in 1 day, then 3 days, then grow by the ease factor", () => {
    const a = scheduleReview(null, 5, now);
    const b = scheduleReview(a, 5, now);
    const c = scheduleReview(b, 5, now);
    expect([a.intervalDays, b.intervalDays]).toEqual([1, 3]);
    expect(c.intervalDays).toBeCloseTo(3 * c.ease, 1);
    expect(c.dueAt.getTime()).toBeGreaterThan(b.dueAt.getTime());
  });

  it("any sequence of grades: ease never drops below 1.3; failures reset and return within minutes; successes never shrink the interval", () => {
    fc.assert(
      fc.property(fc.array(gradeArb, { minLength: 1, maxLength: 30 }), (grades) => {
        let s: ReviewState | null = null;
        for (const g of grades) {
          const next = scheduleReview(s, g, now);
          expect(next.ease).toBeGreaterThanOrEqual(MIN_EASE);
          if (g < 3) {
            expect(next.reps).toBe(0);
            expect(next.dueAt.getTime() - now.getTime()).toBe(RETRY_AFTER_MINUTES * 60_000);
          } else {
            expect(next.reps).toBe((s?.reps ?? 0) + 1);
            if (s && s.reps > 0) expect(next.intervalDays).toBeGreaterThanOrEqual(s.intervalDays);
          }
          s = next;
        }
      }),
    );
  });
});
