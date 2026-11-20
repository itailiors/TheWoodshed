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

/** A key to place: its note, and which way it lies from the key before it (`Highlight.dir`). */
export interface Placeable {
  note: string;
  dir?: "up" | "down";
}

const CENTRE = 61; // the middle of the C3–C5 window the stepper draws on a desktop

/**
 * Where a step's lit keys sit on the keyboard. Each key goes at the octave its `dir` names from
 * the key before it ("F falls to E": E just below F), else the nearest one (a tritone, which is
 * as near either way, goes up). Then the whole shape moves by octaves so it centres near middle C.
 * Bare note names are placed nearest-first, the same way. Pure.
 */
export function placeHighlights(keys: readonly (string | Placeable)[]): number[] {
  const out: number[] = [];
  for (const k of keys) {
    const { note, dir } = typeof k === "string" ? { note: k, dir: undefined } : k;
    const pc = chroma(note);
    if (!out.length) {
      out.push(48 + pc);
      continue;
    }
    const prev = out[out.length - 1];
    const d = (((pc - prev) % 12) + 12) % 12; // half steps up to the next key with this pitch class
    if (d === 0) out.push(dir === "up" ? prev + 12 : dir === "down" ? prev - 12 : prev);
    else out.push(dir === "up" ? prev + d : dir === "down" ? prev + d - 12 : d <= 6 ? prev + d : prev + d - 12);
  }
  if (!out.length) return out;
  const mid = (Math.min(...out) + Math.max(...out)) / 2;
  const shift = 12 * Math.round((CENTRE - mid) / 12);
  return out.map((m) => m + shift);
}

const SOUND_FLOOR = 48; // basics chords: bass in the C3 octave
const voiced = (chords: ChordLike[]) => voiceProgression(chords).map((v) => [v.bass, ...v.upper]);

/** What ▶ Hear plays for a step, or null when it has nothing to play. Pure. */
export function stepAudio(step: LessonStep, ctx: LessonAudioContext = {}): StepAudio | null {
  if (step.sound?.length) return { voicings: step.sound.map((c) => stackUp(c, SOUND_FLOOR)), secondsEach: 1.2 };
  switch (step.play) {
    case "interval": {
      const lit = placeHighlights(step.highlight);
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

/** A step's chords as a paced score (each at its own offset), so `stopStepAudio` can still cut what hasn't sounded. Pure. */
export function stepScore(a: StepAudio) {
  return {
    events: a.voicings.flatMap((midis, i) => (midis.length ? [{ midis, at: i * a.secondsEach, seconds: a.secondsEach * 1.1 }] : [])),
    steps: a.voicings.map((_, i) => i * a.secondsEach),
  };
}

// bumped by every play and every stop: a play still waiting on the audio engine checks it's still the latest
let stepGen = 0;
let sounding = false;

/** Play a step through the player's audition path; `onDone` once it has rung (not if another audition took over). */
export function playStep(step: LessonStep, ctx: LessonAudioContext = {}, onDone?: () => void): boolean {
  const a = stepAudio(step, ctx);
  if (!a) return false;
  const gen = ++stepGen;
  const { events, steps } = stepScore(a);
  void player.init().then(() => {
    if (gen !== stepGen) return;
    sounding = true;
    return player.playScore(events, steps, (i) => {
      if (i !== null) return;
      if (gen === stepGen) sounding = false;
      onDone?.();
    });
  });
  return true;
}

/** The latest step cue's generation: pass it to `stopStepAudio` to stop that cue and nothing newer. */
export const stepAudioGen = () => stepGen;

/**
 * Silence the stepper's own cue: nothing more starts, and what's ringing is let go (a closed
 * stepper goes quiet). With `onlyGen`, only while no newer cue has started since (a stepper
 * that remounts on a new lesson keeps its fresh step 1).
 */
export function stopStepAudio(onlyGen?: number) {
  if (onlyGen !== undefined && onlyGen !== stepGen) return;
  stepGen++;
  if (!sounding) return;
  sounding = false;
  player.stopScore();
}
