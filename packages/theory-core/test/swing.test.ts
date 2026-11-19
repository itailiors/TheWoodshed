import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BAND_STYLES,
  bandFeel,
  bandStylesFor,
  bassLine,
  clampSwing,
  DEFAULT_SWING,
  drumPattern,
  rideOffsets,
  SWING_HARD,
  SWING_SKIP,
  SWING_STRAIGHT,
  swingTime,
} from "../src/band";
import { someday } from "../src/fixtures/someday";
import { sortedHarmony } from "../src/time";
import { referenceTune } from "../src";

const ratio = fc.double({ min: SWING_STRAIGHT, max: SWING_HARD, noNaN: true });

describe("swing ratio", () => {
  it("defaults to the triplet 2:1, so the default band is unchanged", () => {
    expect(DEFAULT_SWING).toBe(SWING_SKIP);
    expect(drumPattern("swing", 4, 12, "x", DEFAULT_SWING)).toEqual(drumPattern("swing", 4, 12, "x"));
  });

  it("clamps to straight..hard and survives garbage", () => {
    expect(clampSwing(0.2)).toBe(SWING_STRAIGHT);
    expect(clampSwing(0.9)).toBe(SWING_HARD);
    expect(clampSwing(Number.NaN)).toBe(DEFAULT_SWING);
  });

  it("moves the ride's skip note and the snare chatter, nothing else", () => {
    fc.assert(
      fc.property(ratio, (r) => {
        const skips = rideOffsets("swing", 4, r).filter((o) => o.at % 1 !== 0).map((o) => o.at);
        expect(skips).toEqual([1 + r, 3 + r]);
        const base = drumPattern("swing", 4, 16, "seed");
        const moved = drumPattern("swing", 4, 16, "seed", r);
        // same hits in the same order (the seeded choices don't depend on the ratio)
        expect(moved.map((h) => [h.voice, Math.floor(h.beat + 1e-9)])).toEqual(base.map((h) => [h.voice, Math.floor(h.beat + 1e-9)]));
        for (const h of moved.filter((x) => x.voice === "snare")) expect((h.beat % 1).toFixed(6)).toBe((r % 1).toFixed(6));
      }),
    );
  });

  it("leaves straight feels straight", () => {
    expect(rideOffsets("bossa", 4, SWING_HARD)).toEqual(rideOffsets("bossa", 4));
  });
});

describe("swingTime (straight-written eighths into the band's swing)", () => {
  it("puts the 'and' on beat + ratio and leaves downbeats alone", () => {
    expect(swingTime(2.5, 2 / 3)).toBeCloseTo(2 + 2 / 3);
    expect(swingTime(2.5, 0.75)).toBeCloseTo(2.75);
    expect(swingTime(3, 0.75)).toBe(3);
    expect(swingTime(7.25, 0.5)).toBeCloseTo(7.25); // straight is the identity
  });

  it("is monotonic, so swung notes never overlap or swap order", () => {
    fc.assert(
      fc.property(ratio, fc.double({ min: 0, max: 64, noNaN: true }), fc.double({ min: 0, max: 4, noNaN: true }), (r, a, d) => {
        expect(swingTime(a + d, r)).toBeGreaterThanOrEqual(swingTime(a, r) - 1e-9);
      }),
    );
  });

  it("swings Co-op Blues' eighth-note head: every offbeat lands on the ratio", () => {
    const offbeats = referenceTune.melody.map((n) => n.at.beat).filter((b) => b % 1 === 0.5);
    expect(offbeats.length).toBeGreaterThan(0);
    for (const b of offbeats) expect(swingTime(b, 0.6) % 1).toBeCloseTo(0.6);
  });
});

describe("band styles", () => {
  it("as written follows the tune's own feel", () => {
    expect(bandFeel({ feel: "swing", meter: [4, 4] }, "as-written")).toEqual({ feel: "swing", bass: "walking" });
    expect(bandFeel({ feel: "ballad", meter: [4, 4] }, "as-written")).toEqual({ feel: "ballad", bass: "two-feel" });
  });

  it("in 2 keeps the ride swinging but puts the bass on 1 and 3", () => {
    const feel = bandFeel({ feel: "swing", meter: [4, 4] }, "in-two");
    expect(feel).toEqual({ feel: "swing", bass: "two-feel" });
    const line = bassLine({ feel: feel.feel, meter: [4, 4] }, sortedHarmony(someday), feel.bass);
    expect(line.every((n) => n.beat % 4 === 0 || n.beat % 4 === 2)).toBe(true);
  });

  it("a ballad tune can walk", () => {
    const feel = bandFeel({ feel: "ballad", meter: [4, 4] }, "walking");
    expect(feel).toEqual({ feel: "swing", bass: "walking" });
    const line = bassLine({ feel: "ballad", meter: [4, 4] }, sortedHarmony(someday), feel.bass);
    expect(line.some((n) => n.beat % 4 === 1)).toBe(true);
  });

  it("a waltz keeps its 3: walking stays a waltz, and bossa/straight 8ths aren't offered", () => {
    expect(bandStylesFor(3)).not.toContain("bossa");
    expect(bandStylesFor(3)).not.toContain("straight8");
    expect(bandFeel({ feel: "waltz", meter: [3, 4] }, "walking").feel).toBe("waltz");
    // a style the meter doesn't offer falls back to the chart
    expect(bandFeel({ feel: "waltz", meter: [3, 4] }, "bossa")).toEqual({ feel: "waltz", bass: "walking" });
  });

  it("every style is offered in 4/4 and has a label", () => {
    expect(bandStylesFor(4)).toEqual(BAND_STYLES.map((s) => s.id));
    for (const s of BAND_STYLES) expect(s.label.length).toBeGreaterThan(0);
  });
});
