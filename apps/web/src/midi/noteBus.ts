import { useEffect, useRef } from "react";

export interface NoteMsg {
  type: "on" | "off";
  note: number;
  velocity: number;
  source: "midi" | "virtual" | "qwerty";
}

type Listener = (m: NoteMsg) => void;
const listeners = new Set<Listener>();

/** One stream of note events for every practice tool, fed by Web MIDI, the on-screen keys and the computer keyboard. */
export const noteBus = {
  emit(m: NoteMsg) {
    listeners.forEach((l) => l(m));
  },
  on(fn: Listener) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

export function useNoteBus(fn: Listener, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    return noteBus.on((m) => ref.current(m));
  }, [active]);
}

/**
 * Group note events into chord strikes: collect everything held, and when the
 * last key comes up, report the largest set that was down at once.
 */
export function useChordStrikes(onStrike: (notes: number[]) => void, active = true, minNotes = 2) {
  const held = useRef(new Set<number>());
  const peak = useRef<number[]>([]);
  useNoteBus((m) => {
    if (m.type === "on") {
      held.current.add(m.note);
      if (held.current.size >= peak.current.length) peak.current = [...held.current].sort((a, b) => a - b);
    } else {
      held.current.delete(m.note);
      if (held.current.size === 0) {
        const strike = peak.current;
        peak.current = [];
        if (strike.length >= minNotes) onStrike(strike);
      }
    }
  }, active);
}
