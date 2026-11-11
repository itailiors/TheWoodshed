import type { ChordEvent, NoteEvent, TimePos, Tune } from "./types";

export const absBeat = (p: TimePos, beatsPerBar: number) => (p.bar - 1) * beatsPerBar + (p.beat - 1);

export function posFromAbs(abs: number, beatsPerBar: number): TimePos {
  const bar = Math.floor(abs / beatsPerBar) + 1;
  return { bar, beat: abs - (bar - 1) * beatsPerBar + 1 };
}

export function eventSpan(e: { at: TimePos; beats: number }, beatsPerBar: number): [number, number] {
  const s = absBeat(e.at, beatsPerBar);
  return [s, s + e.beats];
}

/** Melody notes sounding at any point inside [start, end). */
export function melodyIn(tune: Tune, start: number, end: number): NoteEvent[] {
  const bpb = tune.meter[0];
  return tune.melody.filter((n) => {
    const [s, e] = eventSpan(n, bpb);
    return s < end && e > start;
  });
}

/** Length of the form in bars: the sections if present, otherwise the last bar with a chord. */
export function formBars(tune: Tune): number {
  return Math.max(0, ...tune.sections.map((s) => s.startBar + s.bars - 1)) || Math.max(0, ...tune.harmony.map((c) => c.at.bar));
}

export function sortedHarmony(tune: Tune): ChordEvent[] {
  const bpb = tune.meter[0];
  return [...tune.harmony].sort((a, b) => absBeat(a.at, bpb) - absBeat(b.at, bpb));
}
