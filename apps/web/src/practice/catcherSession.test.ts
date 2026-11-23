import { absBeat, chordTones, generateMoves, hintToVoicing, referenceTune, sortedHarmony, type ChordEvent, type ReharmMove } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { createCatcherSession } from "./catcherSession";

const tune = referenceTune;
const moves = generateMoves(tune).accepted;
const backdoor = moves.find((m) => m.id === "modal.backdoorTwoFive@10.1")!;
const bar1 = moves.find((m) => m.id === "chromatic.constantStructure@1.1")!;
const total = Math.max(...sortedHarmony(tune).map((c) => absBeat(c.at, 4) + c.beats));
const whole = { start: 0, end: total };

const grip = (c: ChordEvent) => {
  const v = hintToVoicing({ lh: [c.bass ?? c.root], rh: chordTones(c).map((t) => t.note) });
  return [v.bass, ...v.upper];
};
/** One pass of the loop as [beat, notes] strikes: the chart, with `move` (if any) played in place of what it replaces. */
const chorus = (move?: ReharmMove, offset = 0) =>
  [...sortedHarmony(tune).filter((c) => !move?.replaces.includes(c.id)), ...(move?.chords ?? [])]
    .map((c) => ({ beat: absBeat(c.at, 4) + offset, notes: grip(c) }))
    .sort((a, b) => a.beat - b.beat);

describe("catcherSession: live Harmony Catcher bookkeeping", () => {
  it("announces a catch only once the move's span is behind the playhead", () => {
    const s = createCatcherSession({ tune, moves, loop: whole, active: [] });
    const heard: string[] = [];
    for (const x of chorus(backdoor)) {
      heard.push(...s.strike(x.beat, x.notes).map((c) => c.moveId));
      if (x.beat === backdoor.spanBeats.start + 2) expect(heard).toEqual([]); // the E♭9 is down, but its 2 beats aren't over
    }
    expect(heard).toEqual([backdoor.id]); // bar 11's strike is past the span
  });

  it("a tick past the span confirms it with no further strike", () => {
    const s = createCatcherSession({ tune, moves, loop: whole, active: [] });
    for (const x of chorus(backdoor).filter((x) => x.beat < backdoor.spanBeats.end)) s.strike(x.beat, x.notes);
    expect(s.tick(backdoor.spanBeats.end - 0.75)).toEqual([]);
    expect(s.tick(backdoor.spanBeats.end - 0.5).map((c) => c.moveId)).toEqual([backdoor.id]);
  });

  it("each move once per pass, and again on the next pass", () => {
    const s = createCatcherSession({ tune, moves, loop: whole, active: [] });
    const heard: string[] = [];
    for (const pass of [0, 1]) {
      for (const x of chorus(backdoor)) heard.push(...s.strike(x.beat, x.notes).map((c) => c.moveId));
      heard.push(...s.tick(total - 0.6).map((c) => c.moveId));
      if (pass === 0) heard.push(...s.tick(0).map((c) => c.moveId)); // the loop goes round
    }
    expect(heard).toEqual([backdoor.id, backdoor.id]);
  });

  it("the band's own pathway is never announced", () => {
    const s = createCatcherSession({ tune, moves, loop: whole, active: [backdoor.id] });
    const heard = chorus(backdoor).flatMap((x) => s.strike(x.beat, x.notes));
    expect(heard).toEqual([]);
  });

  it("a push in the last eighth of the loop counts for the top of the next pass", () => {
    const s = createCatcherSession({ tune, moves, loop: whole, active: [] });
    const heard: string[] = [];
    const strikes = chorus(bar1);
    // the pass before: the chart as written, then bar 1's F6 pushed an eighth early across the seam
    for (const x of chorus()) heard.push(...s.strike(x.beat, x.notes).map((c) => c.moveId));
    heard.push(...s.strike(total - 0.5, strikes[0].notes).map((c) => c.moveId));
    for (const x of strikes.slice(1)) heard.push(...s.strike(x.beat, x.notes).map((c) => c.moveId));
    heard.push(...s.tick(8).map((c) => c.moveId));
    expect(heard).toEqual([bar1.id]);
  });

  it("works on a looped section: only that section's moves, the seam at its end", () => {
    const loop = { start: 36, end: 40 }; // bar 10 alone
    const s = createCatcherSession({ tune, moves, loop, active: [] });
    const bar10 = chorus(backdoor).filter((x) => x.beat >= 36 && x.beat < 40);
    const heard: string[] = [];
    for (const pass of [0, 1, 2]) {
      for (const x of bar10) heard.push(...s.strike(x.beat, x.notes).map((c) => c.moveId));
      heard.push(...s.tick(39.6).map((c) => c.moveId));
      void pass;
    }
    expect(heard).toEqual([backdoor.id, backdoor.id, backdoor.id]);
  });
});
