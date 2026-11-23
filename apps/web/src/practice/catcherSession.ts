import { ANTICIPATION_BEATS, catchMoves, type Catch, type ReharmMove, type Strike, type Tune } from "@reharm/theory-core";

/**
 * Harmony Catcher's live bookkeeping (docs/plans/harmony-catcher.md, 7d): strikes go into the
 * current pass of the loop; a catch is announced once the move's span is behind the playhead (a
 * later strike under its last chord could still undo it), and each move at most once per pass.
 * Pure: the caller supplies beats (`player.currentBeat()`), so tests drive it without audio.
 */
export interface CatcherSession {
  /** A settled chord strike at an absolute beat. Returns catches confirmed by it. */
  strike(beat: number, notes: number[]): Catch[];
  /** The playhead moved (no strike). Returns catches whose span it has now passed. */
  tick(beat: number): Catch[];
}

export interface CatcherSetup {
  tune: Tune;
  /** `generateMoves(tune).accepted`, computed once per tune. */
  moves: ReharmMove[];
  /** The looped span in absolute beats, [start, end). */
  loop: { start: number; end: number };
  /** Move ids the band is playing (the reharm pathway): never caught. */
  active: Iterable<string>;
}

export function createCatcherSession({ tune, moves, loop, active }: CatcherSetup): CatcherSession {
  const activeIds = [...active];
  const endOf = new Map(moves.map((m) => [m.id, m.spanBeats.end]));
  const seam = loop.end - ANTICIPATION_BEATS;
  let pass: Strike[] = [];
  let announced = new Set<string>();
  let last = -Infinity;

  const confirm = (now: number, strikes: Strike[]) => {
    const out = catchMoves(tune, strikes, { moves, active: activeIds }).filter(
      (c) => !announced.has(c.moveId) && (endOf.get(c.moveId) ?? Infinity) - ANTICIPATION_BEATS <= now,
    );
    out.forEach((c) => announced.add(c.moveId));
    return out;
  };

  /** The playhead jumped back: close the old pass, and carry a push across the loop's seam into the new one. */
  const rollover = (beat: number): Catch[] => {
    if (beat >= last - 1) return [];
    const closing = confirm(Infinity, pass.filter((s) => s.beat < seam));
    pass = pass.filter((s) => s.beat >= seam).map((s) => ({ ...s, beat: s.beat - (loop.end - loop.start) }));
    announced = new Set();
    return closing;
  };

  const step = (beat: number, s?: Strike) => {
    const closing = rollover(beat);
    last = beat;
    if (s) pass.push(s);
    // a strike in the last eighth before the seam belongs to the next pass: leave it out of this one
    return [...closing, ...confirm(beat, pass.filter((x) => x.beat < seam))];
  };

  return {
    strike: (beat, notes) => step(beat, { beat, notes }),
    tick: (beat) => step(beat),
  };
}
