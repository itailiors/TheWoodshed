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

/** Rolling settle window (ms) for grouping finger-legato chord strikes without lifting common tones. */
const STRIKE_WINDOW_MS = 45;

/**
 * Group note events into chord strikes using a ~45ms rolling settle window.
 * Allows finger-legato voice leading: common tones from the previous chord can remain
 * depressed while inner voices move, registering the new strike once the moving fingers settle.
 * Also supports staccato strikes released faster than the 45ms window.
 */
export function useChordStrikes(onStrike: (notes: number[]) => void, active = true, minNotes = 2) {
  const held = useRef(new Set<number>());
  const peak = useRef<number[]>([]);
  const freshCount = useRef(0);
  const lastEmitted = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStrikeRef = useRef(onStrike);
  onStrikeRef.current = onStrike;

  useEffect(() => {
    if (active) return;
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    held.current.clear();
    peak.current = [];
    freshCount.current = 0;
    lastEmitted.current = "";
  }, [active]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  useNoteBus((m) => {
    const flush = () => {
      timer.current = null;
      const strike = [...held.current].sort((a, b) => a - b);
      const sig = strike.join(",");
      if (strike.length >= minNotes && freshCount.current > 0 && sig !== lastEmitted.current) {
        freshCount.current = 0;
        peak.current = [];
        lastEmitted.current = sig;
        onStrikeRef.current(strike);
      }
    };

    if (m.type === "on") {
      held.current.add(m.note);
      freshCount.current++;
      if (held.current.size >= peak.current.length) {
        peak.current = [...held.current].sort((a, b) => a - b);
      }
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, STRIKE_WINDOW_MS);
    } else {
      held.current.delete(m.note);
      if (held.current.size === 0) {
        if (timer.current !== null) {
          clearTimeout(timer.current);
          timer.current = null;
          const strike = peak.current;
          peak.current = [];
          freshCount.current = 0;
          lastEmitted.current = "";
          if (strike.length >= minNotes) onStrikeRef.current(strike);
        } else {
          peak.current = [];
          freshCount.current = 0;
          lastEmitted.current = "";
        }
      }
    }
  }, active);
}
