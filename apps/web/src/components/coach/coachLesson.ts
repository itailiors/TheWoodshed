import {
  basicsLesson,
  canonicalDrill,
  generateMoves,
  isBasicsId,
  lessonForMove,
  sortedHarmony,
  transposeTune,
  type ChordEvent,
  type Lesson,
  type ReharmMove,
  type Tune,
} from "@reharm/theory-core";

/*
 * The lesson Coach's Learn stage shows (spec §A "Where the lesson comes from"). Pure: no drill,
 * no grading, nothing saved. A basic: `basicsLesson`. A rule drilled as a concept: the lesson read
 * off its canonical move in the drill's key (`canonicalDrill`, the same chart the drill plays, so
 * Learn and Study it show the same chords). A tune move: that move's own lesson, in the drill's key.
 */

export interface CoachLesson {
  lesson: Lesson;
  /** ▶ Hear's before/after chords, each ending on the chord the move resolves into. Basics bring their own `sound`. */
  audio?: { before: ChordEvent[]; after: ChordEvent[] };
  /** The move the lesson was read off (null for a basic). */
  move: ReharmMove | null;
}

/** The chord after the move's last replaced chord, on the chart as written. */
function targetOf(tune: Tune, m: ReharmMove): ChordEvent | undefined {
  if (!m.targetSymbol) return undefined;
  const chords = sortedHarmony(tune);
  const i = chords.findIndex((c) => c.id === m.replaces[m.replaces.length - 1]);
  return i >= 0 ? chords[i + 1] : undefined;
}

function fromMove(tune: Tune, move: ReharmMove): CoachLesson | null {
  const lesson = lessonForMove(move);
  if (!lesson) return null;
  const target = targetOf(tune, move);
  const end = target ? [target] : [];
  return { lesson, move, audio: { before: [...move.original, ...end], after: [...move.chords, ...end] } };
}

/**
 * A chart's move in another key: the chart transposed, and the move with the same id on it, or
 * null when it doesn't fire there (the melody rules it out in that key). Move ids are positional,
 * so the same id is the same move. Never the old key's move on the new key's chart. Pure.
 */
export function tuneMoveInKey(tune: Tune, moveId: string, key: string): { tune: Tune; move: ReharmMove | null } {
  const dtune = key === tune.key.tonic ? tune : transposeTune(tune, key);
  return { tune: dtune, move: generateMoves(dtune).accepted.find((m) => m.id === moveId) ?? null };
}

/**
 * The Learn stage's lesson for a concept in `key`, or null when it has none yet (the ladder then
 * starts at Study it). `tuneMove`: drilling a move from the chart instead of the concept.
 */
export function coachLesson(conceptId: string, key: string, tuneMove?: { tune: Tune; move: ReharmMove } | null): CoachLesson | null {
  if (isBasicsId(conceptId)) {
    const lesson = basicsLesson(conceptId, key);
    return lesson ? { lesson, move: null } : null;
  }
  if (tuneMove) {
    // not in this key: no lesson (the Coach shows "not in this key" instead of a drill)
    const d = tuneMoveInKey(tuneMove.tune, tuneMove.move.id, key);
    return d.move ? fromMove(d.tune, d.move) : null;
  }
  const drill = canonicalDrill(conceptId, key);
  return drill?.move ? fromMove(drill.tune, drill.move) : null;
}
