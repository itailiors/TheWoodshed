import type { ChordEvent, ReharmMove } from "./types";

/*
 * The chord cursor: Study's previous / next chord. It walks the tune's own changes in chart
 * order (one stop per chord, whether or not a move fits there) and stops at the ends.
 *   - Over a chord the reharm replaces, the cursor opens that move.
 *   - Over a chord the reharm leaves alone, the open move stays open.
 * The cursor remembers which move was open when it was set. If a different move is open now
 * (you clicked a wash, stepped moves with ← →, picked one), the cursor is stale and the next
 * step starts from the open move's first chord instead, so the two kinds of stepping never
 * fight. Pure: the app holds the cursor; the open move stays in the pathway editor.
 */

export interface ChordCursor {
  /** A chord of the tune as written (`sortedHarmony`), not of the reharm. */
  chordId: string;
  /** The open move when the cursor was set (null: none). */
  moveId: string | null;
}

/** The cursor if it still describes what's on the stand, else null. */
export function liveChordCursor(cursor: ChordCursor | null, chords: readonly ChordEvent[], selectedId: string | null): ChordCursor | null {
  if (!cursor || cursor.moveId !== selectedId || !chords.some((c) => c.id === cursor.chordId)) return null;
  return cursor;
}

/**
 * One step of the cursor. `chords` are the tune's changes in order; `pathway` the reharm on the
 * stand; `selectedId` the open move. Returns the new cursor, or null for a chart with no chords.
 */
export function stepChord(
  chords: readonly ChordEvent[],
  pathway: readonly ReharmMove[],
  cursor: ChordCursor | null,
  selectedId: string | null,
  dir: 1 | -1,
): ChordCursor | null {
  if (chords.length === 0) return null;
  const live = liveChordCursor(cursor, chords, selectedId);
  const open = pathway.find((m) => m.id === selectedId);
  const from = live
    ? chords.findIndex((c) => c.id === live.chordId)
    : open
      ? chords.findIndex((c) => open.replaces.includes(c.id))
      : -1;
  // nothing to start from: next lands on the first chord, previous on the last
  const i = from < 0 ? (dir === 1 ? 0 : chords.length - 1) : Math.min(chords.length - 1, Math.max(0, from + dir));
  const chord = chords[i];
  const over = pathway.find((m) => m.replaces.includes(chord.id));
  return { chordId: chord.id, moveId: over ? over.id : selectedId };
}
