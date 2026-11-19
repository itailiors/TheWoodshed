import { mod } from "./pitch";
import type { FormNote, ShapeGrade, VoicingForm } from "./voicingForms";

/**
 * Hear, hide, play: the Voicings tab's ear mode. The app plays the voicing, hides it from the
 * keys, and you play it back from memory. Grading is `gradeShape`'s, untouched; this module only
 * decides when the voicing is hidden, what the red pen may say while it is, and what the reveal marks.
 */

/** `hear`: not played to you yet (hidden). `recall`: heard, still hidden. `shown`: on the keys again. */
export type EarPhase = "hear" | "recall" | "shown";
/** `next`: a different chord (or the same one started over) is on the stage. */
export type EarEvent = "heard" | "miss" | "clean" | "reveal" | "next";

export function earStep(phase: EarPhase, event: EarEvent): EarPhase {
  if (event === "next") return "hear";
  if (event === "clean" || event === "reveal") return "shown";
  if (event === "heard" && phase === "hear") return "recall";
  return phase;
}

const count = (n: number, what: string) => `${n} note${n > 1 ? "s" : ""} ${what}`;

/**
 * The red pen while the voicing is hidden: `gradeShape`'s verdict with the names taken out
 * (its own hint names the missing notes, which would give the answer away). Counts only.
 */
export function hiddenHint(grade: ShapeGrade): string {
  if (grade.valid) return grade.hint;
  if (!grade.missing.length && !grade.extra.length) return "Right notes, different order. Listen for the top note, then try again.";
  const parts = [grade.missing.length ? count(grade.missing.length, "missing") : "", grade.extra.length ? count(grade.extra.length, "too many") : ""];
  return `Not yet: ${parts.filter(Boolean).join(", ")}. Hear it again, or Reveal.`;
}

export interface ShapeDiff {
  /** The form's upper notes that weren't played (the bass is optional, so never missing). */
  missing: FormNote[];
  /** Played notes (as played) whose pitch class isn't in the form, bass included. */
  extra: number[];
  /** Played notes (as played) that belong to the form. */
  right: number[];
}

/**
 * What the reveal marks against your last try, octave-free: the missing notes come from the
 * grade (`gradeShape` decided them), extra and right are your notes sorted by the form's pitch classes.
 * With no try (`grade` null), nothing is marked.
 */
export function shapeDiff(form: VoicingForm, played: number[], grade: ShapeGrade | null): ShapeDiff {
  if (!grade) return { missing: [], extra: [], right: [] };
  const pcs = new Set(form.notes.map((n) => mod(n.midi, 12)));
  return {
    missing: grade.valid ? [] : form.notes.slice(1).filter((n) => grade.missing.includes(n.degree)),
    extra: played.filter((m) => !pcs.has(mod(m, 12))),
    right: played.filter((m) => pcs.has(mod(m, 12))),
  };
}
