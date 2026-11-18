import { describe, expect, it } from "vitest";
import { buildPathway, buildPathwayTraced, generateMoves, referenceTune, sortedHarmony } from "../src";

/*
 * The chord-by-chord selector: you can pick a move for a chord (forced) or keep the chord as
 * written (kept). A kept chord is never replaced, whatever the dial or your picks say.
 */
const { accepted } = generateMoves(referenceTune);
const chords = sortedHarmony(referenceTune);

describe("buildPathway with chords kept as written", () => {
  it("no move in the pathway replaces a kept chord, at any dial level", () => {
    for (const c of chords) {
      for (const level of [1, 2, 3, 4]) {
        const path = buildPathway(accepted, level, [], [c.id]);
        expect(path.some((m) => m.replaces.includes(c.id))).toBe(false);
      }
    }
  });

  it("keeping a chord beats a pick of a move over it, and the trace says why", () => {
    const m = accepted.find((x) => x.level <= 2)!;
    const chordId = m.replaces[0];
    const trace = buildPathwayTraced(accepted, 2, [m], [chordId]);
    expect(trace.chosen).not.toContain(m);
    expect(trace.decisions.get(m.id)).toEqual({ kind: "kept", chordId });
  });

  it("keeping nothing changes nothing", () => {
    for (const level of [0, 1, 2, 3, 4]) expect(buildPathway(accepted, level, [], [])).toEqual(buildPathway(accepted, level));
  });

  it("every candidate still gets exactly one decision", () => {
    const keep = chords.filter((_, i) => i % 3 === 0).map((c) => c.id);
    const trace = buildPathwayTraced(accepted, 4, [], keep);
    expect([...trace.decisions.keys()].sort()).toEqual(accepted.map((m) => m.id).sort());
  });
});
