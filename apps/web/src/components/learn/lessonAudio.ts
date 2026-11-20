import { chroma, voiceProgression, type ChordLike, type LessonStep } from "@reharm/theory-core";
import { player } from "../../audio/player";

/*
 * ▶ Hear for a lesson step: the step's `sound` chords when it has them (basics), else its play
 * cue. Every pitch comes from theory-core (`voiceProgression`, the step's own notes); this file
 * only places pitch classes in a register and hands voicings to the player's audition path, so
 * it stays Tone-free (rule 12).
 */

/** The chords a rule lesson's before/after cues play; each list ends on the chord the move resolves into. */
export interface LessonAudioContext {
  before?: ChordLike[];
  after?: ChordLike[];
}

export interface StepAudio {
  voicings: number[][];
  secondsEach: number;
}

/** Pitch classes stacked upward from `floor` (the first at or above it): a close voicing, any spelling. */
export function stackUp(notes: readonly string[], floor: number): number[] {
  const out: number[] = [];
  for (const n of notes) {
    const pc = chroma(n);
    const prev = out.length ? out[out.length - 1] + 1 : floor;
    out.push(prev + ((pc - prev) % 12 + 12) % 12);
  }
  return out;
}

/** Where a step's lit notes sit on the keyboard: from the first at or above F♯3 (so the shape centres near middle C). */
export const placeHighlights = (notes: readonly string[]) => stackUp(notes, 54);

const SOUND_FLOOR = 48; // basics chords: bass in the C3 octave
const voiced = (chords: ChordLike[]) => voiceProgression(chords).map((v) => [v.bass, ...v.upper]);

/** What ▶ Hear plays for a step, or null when it has nothing to play. Pure. */
export function stepAudio(step: LessonStep, ctx: LessonAudioContext = {}): StepAudio | null {
  if (step.sound?.length) return { voicings: step.sound.map((c) => stackUp(c, SOUND_FLOOR)), secondsEach: 1.2 };
  switch (step.play) {
    case "interval": {
      const lit = placeHighlights(step.highlight.map((h) => h.note));
      // the notes one by one, then together
      return lit.length ? { voicings: [...lit.map((m) => [m]), lit], secondsEach: 0.7 } : null;
    }
    case "before":
      return ctx.before?.length ? { voicings: voiced(ctx.before), secondsEach: 1.1 } : null;
    case "after":
      return ctx.after?.length ? { voicings: voiced(ctx.after), secondsEach: 1.1 } : null;
    case "ab": {
      if (!ctx.before?.length || !ctx.after?.length) return null;
      // before, a beat's rest (an empty chord), then after
      return { voicings: [...voiced(ctx.before), [], ...voiced(ctx.after)], secondsEach: 1.1 };
    }
    default:
      return null;
  }
}

/** Play a step through the player's audition path; `onDone` once it has rung (not if another audition took over). */
export function playStep(step: LessonStep, ctx: LessonAudioContext = {}, onDone?: () => void): boolean {
  const a = stepAudio(step, ctx);
  if (!a) return false;
  void player.playSequence(a.voicings, a.secondsEach, (i) => i === null && onDone?.());
  return true;
}

/** Stop reporting the audition in progress (a closed stepper shouldn't un-press anything later). */
export const stopStepAudio = () => player.cancelAudition();
