import { describe, expect, it } from "vitest";
import { buildPathway, editPathway, editorPathway, generateMoves, overlaps, PATHWAY_EDITOR_START, referenceTune, type PathwayEditor } from "../src";

/*
 * The pathway editor: the dial, your picks, the chords you keep as written and the open move.
 * A click on the dial starts over; a pedal only moves the dial; a pick evicts the picks it
 * collides with and un-keeps its chords.
 */
const { accepted } = generateMoves(referenceTune);
const [a, b] = (() => {
  for (const x of accepted) for (const y of accepted) if (x !== y && overlaps(x, y)) return [x, y];
  throw new Error("the reference tune has no overlapping candidates");
})();
const free = accepted.find((m) => !overlaps(m, a) && !overlaps(m, b))!;

const edit = (s: PathwayEditor, ...events: Parameters<typeof editPathway>[1][]) => events.reduce((st, e) => editPathway(st, e, accepted), s);
const picked = edit(PATHWAY_EDITOR_START, { type: "pick", id: a.id }, { type: "pick", id: free.id }, { type: "keep", chordId: b.replaces.at(-1)! });

describe("the pathway editor", () => {
  it("starts on level 2 with nothing picked, kept or open", () => {
    expect(PATHWAY_EDITOR_START).toEqual({ level: 2, picks: [], kept: [], selectedId: null });
  });

  it("a pick opens the move; a colliding pick evicts the earlier one", () => {
    const s = edit(PATHWAY_EDITOR_START, { type: "pick", id: a.id }, { type: "pick", id: free.id }, { type: "pick", id: b.id });
    expect(s.picks).toEqual([free.id, b.id]);
    expect(s.selectedId).toBe(b.id);
  });

  it("picking a move over a kept chord un-keeps it", () => {
    const s = edit(PATHWAY_EDITOR_START, { type: "keep", chordId: a.replaces[0] }, { type: "pick", id: a.id });
    expect(s.kept).toEqual([]);
    expect(s.picks).toEqual([a.id]);
  });

  it("keeping a chord drops the picks over it, once; handing it back to the dial un-keeps it", () => {
    const chord = a.replaces[0];
    const kept = edit(PATHWAY_EDITOR_START, { type: "pick", id: a.id }, { type: "keep", chordId: chord }, { type: "keep", chordId: chord });
    expect(kept.picks).toEqual([]);
    expect(kept.kept).toEqual([chord]);
    expect(edit(kept, { type: "release", chordId: chord }).kept).toEqual([]);
  });

  it("a click on the dial starts over; a pedal keeps your picks, kept chords and open move", () => {
    expect(edit(picked, { type: "dial", level: 4 })).toEqual({ level: 4, picks: [], kept: [], selectedId: null });
    expect(edit(picked, { type: "pedal", level: 4 })).toEqual({ ...picked, level: 4 });
  });

  it("a new tune clears the edits but keeps the dial", () => {
    const s = edit(picked, { type: "pedal", level: 3 }, { type: "newTune" });
    expect(s).toEqual({ level: 3, picks: [], kept: [], selectedId: null });
  });

  it("a link replaces the edits, and keeps the dial when it names no level", () => {
    const s = edit(picked, { type: "link", picks: [b.id], keep: [], move: b.id });
    expect(s).toEqual({ level: picked.level, picks: [b.id], kept: [], selectedId: b.id });
  });

  it("a stale pick id (from a link, or another tune) is ignored, not a crash", () => {
    const s = edit(PATHWAY_EDITOR_START, { type: "link", picks: ["nope@99.1"], keep: [] }, { type: "pick", id: a.id });
    expect(s.picks).toEqual(["nope@99.1", a.id]);
    expect(edit(PATHWAY_EDITOR_START, { type: "pick", id: "nope@99.1" })).toBe(PATHWAY_EDITOR_START);
  });

  it("the pathway forces the picks it can find and skips the rest", () => {
    const s = edit(PATHWAY_EDITOR_START, { type: "link", level: 1, picks: ["nope@99.1", free.id], keep: [] });
    expect(editorPathway(s, accepted)).toEqual(buildPathway(accepted, 1, [free], []));
  });
});
