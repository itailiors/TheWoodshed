import { canonicalLesson, KEYS } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { ringPoint } from "./KeyCentreMap";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("the key-centre map", () => {
  it("puts home at 12 o'clock and a half step 30° clockwise", () => {
    expect(ringPoint("C", "C")).toEqual({ x: 60, y: 20 });
    expect(ringPoint("F#", "C")).toEqual({ x: 60, y: 100 });
    expect(ringPoint("Gb", "C")).toEqual(ringPoint("F#", "C"));
  });

  it("draws the Coltrane centres as an equilateral triangle, in every key", () => {
    for (const k of KEYS) {
      const map = canonicalLesson("symmetric.coltraneSubstitution", k)!.steps[0].map!;
      expect(map).toHaveLength(3);
      const [a, b, c] = map.map((n) => ringPoint(n, map[2]));
      expect(c).toEqual({ x: 60, y: 20 });
      expect(dist(a, b)).toBeCloseTo(dist(b, c), 1);
      expect(dist(b, c)).toBeCloseTo(dist(c, a), 1);
    }
  });
});
