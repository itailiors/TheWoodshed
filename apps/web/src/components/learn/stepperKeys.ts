/*
 * The LessonStepper's keys (spec §A), as one pure decision so it can be tested without a DOM:
 *   ← / →   Back / Next
 *   Enter   Next; on an unanswered ask the first Enter focuses and pulses "Show me", a second reveals
 *   Space   ▶ Hear
 * Keys typed into a field, or with a browser/OS modifier, are never ours. Space and Enter on a
 * focused button or link belong to that control (it clicks itself), so the stepper leaves them.
 * Esc and ? are handled elsewhere (popovers in the capture phase; the shortcuts sheet).
 */

export type StepperAction = "back" | "next" | "hear" | "focusShowMe" | "reveal";

export interface StepperKeyEvent {
  key: string;
  /** Lower-cased tag name of the focused element ("button", "a", "input", "body", …). */
  tag: string;
  /** The focused element is editable (contenteditable) or has role="button"/"link". */
  editable?: boolean;
  role?: string | null;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
}

export interface StepperKeyState {
  /** This step has an ask that hasn't been answered or shown yet. */
  askOpen: boolean;
  /** "Show me" has already been focused and pulsed by an Enter. */
  showMePulsed: boolean;
}

const FIELDS = new Set(["input", "textarea", "select"]);
const CONTROLS = new Set(["button", "a", "summary"]);

/** A focused control that answers Space/Enter itself. */
export const onControl = (e: Pick<StepperKeyEvent, "tag" | "role">) => CONTROLS.has(e.tag) || e.role === "button" || e.role === "link";

/** What a key does in the stepper, or null to leave it alone. Pure. */
export function stepperKey(e: StepperKeyEvent, s: StepperKeyState): StepperAction | null {
  if (e.altKey || e.ctrlKey || e.metaKey || FIELDS.has(e.tag) || e.editable) return null;
  if (e.key === "ArrowLeft") return "back";
  if (e.key === "ArrowRight") return "next";
  if (e.key !== " " && e.key !== "Enter") return null;
  if (onControl(e) || e.repeat) return null;
  if (e.key === " ") return "hear";
  if (s.askOpen) return s.showMePulsed ? "reveal" : "focusShowMe";
  return "next";
}

/** The parts of a DOM KeyboardEvent the decision reads. */
export function keyEventOf(e: KeyboardEvent): StepperKeyEvent {
  const t = e.target instanceof HTMLElement ? e.target : null;
  return {
    key: e.key,
    tag: t?.tagName.toLowerCase() ?? "",
    editable: t?.isContentEditable ?? false,
    role: t?.getAttribute("role") ?? null,
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    repeat: e.repeat,
  };
}

const BLACK = [1, 3, 6, 8, 10];
const isBlack = (m: number) => BLACK.includes(((m % 12) + 12) % 12);

/**
 * Keyboard range for a step: the lit keys plus one key either side, at least `minSpan`
 * semitones (two octaves on a desktop, one on a phone), widened evenly around the notes and
 * snapped out to white keys so the drawing never starts or ends on a black key. Pure.
 */
export function keyRange(lit: readonly number[], minSpan: number): { low: number; high: number } {
  let low = lit.length ? Math.min(...lit) - 1 : 60;
  let high = lit.length ? Math.max(...lit) + 1 : 60 + minSpan;
  const short = minSpan - (high - low);
  if (short > 0) {
    low -= Math.floor(short / 2);
    high += Math.ceil(short / 2);
  }
  while (isBlack(low)) low--;
  while (isBlack(high)) high++;
  return { low, high };
}

/** The pitch class `pc` placed inside [low, high] (its lowest occurrence), or null when it can't fit. */
export function inRange(pc: number, low: number, high: number): number | null {
  const m = low + ((pc - low) % 12 + 12) % 12;
  return m <= high ? m : null;
}

/** "New to guide tones?": a concept name inside a sentence (keeps a leading proper noun or numeral). */
export const inSentence = (name: string) => (/^[A-Z][a-z]/.test(name) && !/^Coltrane\b/.test(name) ? name[0].toLowerCase() + name.slice(1) : name);

/** The first use of `term` in `text` (case-insensitive), split for a glossary chip, or null. */
export function splitOnTerm(text: string, term: string | undefined): [string, string, string] | null {
  if (!term) return null;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return null;
  return [text.slice(0, i), text.slice(i, i + term.length), text.slice(i + term.length)];
}
