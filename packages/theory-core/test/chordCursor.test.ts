import { describe, expect, it } from "vitest";
import { editorPathway, generateMoves, liveChordCursor, PATHWAY_EDITOR_START, referenceTune, sortedHarmony, stepChord, type ChordCursor } from "../src";

/*
 * The chord cursor: Study's previous / next chord. It walks the tune's own changes in order,
 * opens the move the reharm puts over a chord when there is one, and otherwise leaves the open
 * move alone. A cursor left behind by a different open move (you clicked or stepped a move
 * since) is stale, so the next step starts from the open move instead.
 */
const chords = sortedHarmony(referenceTune);
const { accepted } = generateMoves(referenceTune);
const pathway = editorPathway(PATHWAY_EDITOR_START, accepted);
const moveOver = (chordId: string) => pathway.find((m) => m.replaces.includes(chordId)) ?? null;
const covered = chords.findIndex((c) => moveOver(c.id));
const bare = chords.findIndex((c) => !moveOver(c.id));

describe("the chord cursor", () => {
  it("the fixture has chords with and without a move over them", () => {
    expect(chords.length).toBeGreaterThan(4);
    expect(covered).toBeGreaterThanOrEqual(0);
    expect(bare).toBeGreaterThanOrEqual(0);
  });

  it("with nothing open, next starts on the first chord and previous on the last", () => {
    expect(stepChord(chords, pathway, null, null, 1)?.chordId).toBe(chords[0].id);
    expect(stepChord(chords, pathway, null, null, -1)?.chordId).toBe(chords.at(-1)!.id);
  });

  it("walks every chord in order, and back", () => {
    let cur: ChordCursor | null = null;
    const seen: string[] = [];
    for (let i = 0; i < chords.length; i++) {
      cur = stepChord(chords, pathway, cur, cur?.moveId ?? null, 1);
      seen.push(cur!.chordId);
    }
    expect(seen).toEqual(chords.map((c) => c.id));
    const back: string[] = [];
    for (let i = 0; i < chords.length; i++) {
      cur = stepChord(chords, pathway, cur, cur?.moveId ?? null, -1);
      back.push(cur!.chordId);
    }
    expect(back).toEqual([...chords.slice(0, -1).reverse(), chords[0]].map((c) => c.id));
  });

  it("stops at the ends instead of wrapping", () => {
    const last: ChordCursor = { chordId: chords.at(-1)!.id, moveId: moveOver(chords.at(-1)!.id)?.id ?? null };
    expect(stepChord(chords, pathway, last, last.moveId, 1)?.chordId).toBe(last.chordId);
    const first: ChordCursor = { chordId: chords[0].id, moveId: moveOver(chords[0].id)?.id ?? null };
    expect(stepChord(chords, pathway, first, first.moveId, -1)?.chordId).toBe(first.chordId);
  });

  it("opens the reharm's move over the chord, and leaves the open move alone over a bare chord", () => {
    const onCovered = stepChord(chords, pathway, { chordId: chords[covered - 1]?.id ?? chords[0].id, moveId: null }, null, covered === 0 ? -1 : 1)!;
    expect(onCovered.chordId).toBe(chords[covered].id);
    expect(onCovered.moveId).toBe(moveOver(chords[covered].id)!.id);

    const open = pathway[0].id;
    const from: ChordCursor = { chordId: chords[bare === 0 ? 1 : bare - 1].id, moveId: open };
    const onBare = stepChord(chords, pathway, from, open, bare === 0 ? -1 : 1)!;
    expect(onBare.chordId).toBe(chords[bare].id);
    expect(onBare.moveId).toBe(open);
  });

  it("a cursor from another open move is stale: the step starts from the open move's first chord", () => {
    const m = pathway.at(-1)!;
    const firstOfM = chords.findIndex((c) => m.replaces.includes(c.id));
    const stale: ChordCursor = { chordId: chords[0].id, moveId: "someOther@1.1" };
    expect(liveChordCursor(stale, chords, m.id)).toBeNull();
    const next = stepChord(chords, pathway, stale, m.id, 1)!;
    expect(next.chordId).toBe(chords[Math.min(chords.length - 1, firstOfM + 1)].id);
  });

  it("a cursor on a chord this chart doesn't have (another tune) is stale", () => {
    expect(liveChordCursor({ chordId: "nope", moveId: null }, chords, null)).toBeNull();
    expect(stepChord(chords, pathway, { chordId: "nope", moveId: null }, null, 1)?.chordId).toBe(chords[0].id);
  });

  it("a live cursor is returned as is", () => {
    const c: ChordCursor = { chordId: chords[2].id, moveId: null };
    expect(liveChordCursor(c, chords, null)).toBe(c);
  });

  it("an empty chart has no chord to step to", () => {
    expect(stepChord([], pathway, null, null, 1)).toBeNull();
  });
});
