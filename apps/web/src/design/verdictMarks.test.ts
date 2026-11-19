import { describe, expect, it } from "vitest";
import { VERDICT_COLOR } from "./tokens";
import { describeVerdicts, markPath, VERDICT_MARK, VERDICTS } from "./verdictMarks";

/** End points of every M / L / A command in a path. */
function points(d: string): [number, number][] {
  return [...d.matchAll(/([MLA])([^MLAZ]*)/g)].map((m) => {
    const nums = m[2].trim().split(/\s+/).map(Number);
    return [nums[nums.length - 2], nums[nums.length - 1]];
  });
}

describe("heatmap verdict marks", () => {
  it("gives every coloured verdict a shape, so colour is never the only cue", () => {
    expect(new Set(VERDICTS)).toEqual(new Set(Object.keys(VERDICT_COLOR)));
    for (const v of VERDICTS) expect(VERDICT_MARK[v].label.length).toBeGreaterThan(0);
  });

  it("uses a different shape for each verdict", () => {
    const shapes = VERDICTS.map((v) => VERDICT_MARK[v].shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("draws each shape inside its circle", () => {
    const [cx, cy, r] = [40, 20, 5];
    for (const v of VERDICTS) {
      const d = markPath(VERDICT_MARK[v].shape, cx, cy, r);
      expect(d.startsWith("M "), v).toBe(true);
      for (const [x, y] of points(d)) {
        expect(Number.isFinite(x) && Number.isFinite(y), `${v}: ${d}`).toBe(true);
        expect(Math.hypot(x - cx, y - cy), `${v} (${x}, ${y})`).toBeLessThanOrEqual(r + 1e-9);
      }
    }
  });

  it("describes a pass in words", () => {
    expect(describeVerdicts(0, () => 0)).toBe("no notes yet");
    const pct = { "chord-tone": 50, tension: 25, avoid: 15, outside: 10 } as const;
    expect(describeVerdicts(20, (v) => pct[v])).toBe("20 notes: 50% chord tones, 25% tensions, 15% avoid notes, 10% outside notes");
    expect(describeVerdicts(1, () => 0)).toMatch(/^1 note:/);
  });
});
