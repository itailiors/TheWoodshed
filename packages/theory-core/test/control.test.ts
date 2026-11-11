import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PEDAL_MARGIN, pedalToLevel } from "../src/control";

const levelArb = fc.option(fc.integer({ min: 0, max: 4 }), { nil: null });

/** Feed a sequence of controller values through the mapping, as the app does. */
const run = (values: number[], start: number | null = null) => {
  const out: number[] = [];
  let level = start;
  for (const v of values) out.push((level = pedalToLevel(v, level)));
  return out;
};

describe("pedalToLevel: a pedal or mod wheel on the reharm dial", () => {
  it("heel down is always L0, toe down always L4, from any previous level", () => {
    fc.assert(
      fc.property(levelArb, (prev) => {
        expect(pedalToLevel(0, prev)).toBe(0);
        expect(pedalToLevel(127, prev)).toBe(4);
      }),
    );
  });

  it("a slow sweep visits every level once, in order (and back down again)", () => {
    const up = run(Array.from({ length: 128 }, (_, i) => i));
    expect([...new Set(up)]).toEqual([0, 1, 2, 3, 4]);
    expect(up.every((l, i) => i === 0 || l >= up[i - 1])).toBe(true);
    const down = run(Array.from({ length: 128 }, (_, i) => 127 - i), 4);
    expect([...new Set(down)]).toEqual([4, 3, 2, 1, 0]);
    expect(down.every((l, i) => i === 0 || l <= down[i - 1])).toBe(true);
  });

  it("no flicker: values jittering inside a window narrower than 2 × margin change the level at most once", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 127 }),
        fc.array(fc.integer({ min: 0, max: 2 * PEDAL_MARGIN - 1 }), { minLength: 2, maxLength: 60 }),
        levelArb,
        (lo, offsets, start) => {
          const values = offsets.map((o) => Math.min(127, lo + o));
          const levels = run(values, start ?? pedalToLevel(values[0], null));
          const changes = levels.filter((l, i) => i > 0 && l !== levels[i - 1]).length;
          expect(changes).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it("well away from a band edge it's plain quantising, whatever the previous level", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), levelArb, (v, prev) => {
        const band = 128 / 5;
        const distanceToEdge = Math.min(...[1, 2, 3, 4].map((k) => Math.abs(v - k * band)));
        fc.pre(distanceToEdge >= PEDAL_MARGIN);
        expect(pedalToLevel(v, prev)).toBe(Math.min(4, Math.floor(v / band)));
      }),
    );
  });
});
