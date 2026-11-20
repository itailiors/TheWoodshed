import { atLeastFamiliar, type ConceptState, type LessonStage } from "@reharm/theory-core";

/*
 * How the Coach finds out what you played.
 *
 *  - "listen": the engine hears the notes (MIDI keyboard, QWERTY, or the on-screen keys) and
 *    diffs each strike against the voicing: misses, wrong notes and voice-leading leaps.
 *  - "self":   you're at an acoustic piano with no cable. The drill reveals the voicing when
 *    you ask, you play it, and you say whether you nailed it. Same misses, same SM-2 grade,
 *    but no leap detection (nobody heard the notes), and the run is saved as self-graded.
 *
 *  - "study":  nothing is graded or saved. The keyboard shows each chord of the move, with how to
 *    play it (left hand, right hand, how the voices moved), and arrows step from chord to chord.
 *
 * The drill only ever sees per-step outcomes, so a future "mic" mode (Web Audio polyphonic
 * pitch detection on the real piano) needs no new grading path: publish the detected chord
 * to the note bus as another strike source and it becomes a "listen" mode, the self-check
 * panel stepping aside on its own.
 *
 * Which mode runs is decided by the Coach's stage ladder (Learn → Study it → Self-check → Play it,
 * spec §A), through `modeForStage`. The stage a concept was left on is its `lastStage` lesson flag
 * (`reharm.lessons`): the one source of truth. The old global `reharm.coachGrading` is retired.
 */
export type GradingMode = "listen" | "self" | "study";
/** The verdict a self-check gives one chord. */
export type SelfVerdict = "nailed" | "missed";

/** Where the notes can come from: a MIDI keyboard, the computer keys (QWERTY on), or neither. */
export type CoachInput = "midi" | "qwerty" | "none";

/** What the drill does on a stage. */
export interface StageMode {
  grading: GradingMode;
  /** "Show the voicing hint" is on and can't be turned off (Self-check with keys that the engine hears). */
  hintForced: boolean;
  /** Chord strikes are heard and graded (`useChordStrikes` is enabled). */
  strikes: boolean;
}

/**
 * The ladder onto the drill. Pure. **Learn → null: the drill is not mounted at all** (grader
 * isolation; the lesson stepper renders instead). Study it → "study" (ungraded). Self-check →
 * "self" at an acoustic piano, or, when the engine can hear you (MIDI, or the computer keys),
 * "listen" with the hint forced on ("Self-check: with hint"). Play it → "listen", hint free.
 */
export function modeForStage(stage: LessonStage, input: CoachInput): StageMode | null {
  switch (stage) {
    case "learn":
      return null;
    case "study":
      return { grading: "study", hintForced: false, strikes: false };
    case "self":
      return input === "none" ? { grading: "self", hintForced: false, strikes: false } : { grading: "listen", hintForced: true, strikes: true };
    case "play":
      return { grading: "listen", hintForced: false, strikes: true };
  }
}

/** The input the Coach hears now. MIDI wins over the computer keys. */
export const coachInput = (midiConnected: boolean, qwertyOn: boolean): CoachInput => (midiConnected ? "midi" : qwertyOn ? "qwerty" : "none");

/** The stages a concept's ladder shows: Learn only for a lesson; basics have no drill. */
export function stagesFor(hasLesson: boolean, basics: boolean): LessonStage[] {
  if (basics) return hasLesson ? ["learn"] : [];
  return hasLesson ? ["learn", "study", "self", "play"] : ["study", "self", "play"];
}

/**
 * Where a concept opens (spec §A "Where a concept opens"). Pure. The stage it was left on wins
 * when it's on the ladder. Otherwise: not yet Familiar → Learn (when there is a lesson); Familiar
 * or above, or no lesson → Play it, or Self-check on a touch-first device with no MIDI (tapping a
 * five-note voicing onto a phone's keys is a chore).
 */
export function openingStage(o: { state: ConceptState; hasLesson: boolean; basics: boolean; lastStage?: LessonStage; touchFirst: boolean; midiConnected: boolean }): LessonStage {
  const stages = stagesFor(o.hasLesson, o.basics);
  if (o.lastStage && stages.includes(o.lastStage)) return o.lastStage;
  if (o.basics || (o.hasLesson && !atLeastFamiliar(o.state))) return "learn";
  return o.touchFirst && !o.midiConnected ? "self" : "play";
}

/** The retired global grading choice: removed once, so nothing reads a stale value. */
export const RETIRED_GRADING_STORE = "reharm.coachGrading";
export function retireGradingStore() {
  try {
    localStorage.removeItem(RETIRED_GRADING_STORE);
  } catch {
    /* blocked storage: nothing was kept */
  }
}
