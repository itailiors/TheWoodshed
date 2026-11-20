import { chroma, prettyNote, spellChroma } from "@reharm/theory-core";
import { useEffect, useRef, useState } from "react";
import { noteBus, type NoteMsg } from "../../midi/noteBus";

/*
 * Predict, then reveal: an ask step's answer comes in through the note bus (on-screen keys,
 * computer keys or MIDI, all alike). Each note-on is reduced to its pitch class, so the octave
 * and the spelling don't matter (E answers F♭). Notes in the answer light up as they come; a
 * wrong one is shown briefly and never counted. A chord struck all at once can answer in one go.
 *
 * Nothing here is graded or stored: an ask is a moment of attention, not a test. This listener
 * is its own note-bus subscriber and never reaches a drill or the practice history.
 */

/** Pitch classes (0–11) of an answer in engine spelling ("Fb" → 4). */
export const answerPcs = (answer: readonly string[]) => [...new Set(answer.map((n) => chroma(n)))];

export interface TapState {
  /** Answer pitch classes played so far, in the order they came. */
  hits: number[];
  /** The last wrong pitch class, until the next note. */
  wrong: number | null;
  done: boolean;
}

export const TAP_START: TapState = { hits: [], wrong: null, done: false };

/** One note-on (a MIDI number) against the answer. Pure. */
export function tap(state: TapState, answer: readonly number[], midi: number): TapState {
  if (state.done) return state;
  const pc = ((midi % 12) + 12) % 12;
  if (!answer.includes(pc)) return { ...state, wrong: pc };
  const hits = state.hits.includes(pc) ? state.hits : [...state.hits, pc];
  return { hits, wrong: null, done: answer.every((a) => hits.includes(a)) };
}

/** What a screen reader hears for a wrong note: "Not B♭". */
export const notLine = (pc: number) => `Not ${prettyNote(spellChroma(pc))}`;

/**
 * A note-bus listener that feeds note-ons through `tap`. Note-offs are ignored (a released key
 * stays answered). `onChange` hears every new state; `onDone` fires once, when the last answer
 * note arrives.
 */
export function tapListener(answer: readonly number[], onChange: (s: TapState) => void, onDone?: () => void) {
  let s = TAP_START;
  return (m: NoteMsg) => {
    if (m.type !== "on" || s.done) return;
    const next = tap(s, answer, m.note);
    if (next === s) return;
    s = next;
    onChange(s);
    if (s.done) onDone?.();
  };
}

/** How long a wrong note's ghost key stays on screen. */
const WRONG_MS = 900;

/**
 * Listen for an ask's answer. Subscribes to the note bus ONLY while `active` (an unanswered
 * ask is showing); a new `answer` (or `resetKey`) starts over.
 */
export function useTapAnswer(answer: readonly string[] | undefined, active: boolean, onDone: () => void, resetKey: unknown = null) {
  const [state, setState] = useState<TapState>(TAP_START);
  const done = useRef(onDone);
  done.current = onDone;
  const sig = answer ? answerPcs(answer).join(",") : "";

  useEffect(() => setState(TAP_START), [sig, resetKey]);

  useEffect(() => {
    if (!active || !sig) return;
    let live = true;
    let clear: ReturnType<typeof setTimeout> | null = null;
    const pcs = sig.split(",").map(Number);
    const off = noteBus.on(
      tapListener(
        pcs,
        (s) => {
          if (!live) return;
          setState(s);
          if (clear) clearTimeout(clear);
          if (s.wrong !== null) clear = setTimeout(() => live && setState((cur) => (cur.wrong === s.wrong ? { ...cur, wrong: null } : cur)), WRONG_MS);
        },
        () => live && done.current(),
      ),
    );
    return () => {
      live = false;
      if (clear) clearTimeout(clear);
      off();
    };
  }, [active, sig, resetKey]);

  return state;
}
