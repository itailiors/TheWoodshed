import { useEffect, useRef } from "react";
import { notForUs } from "./components/Shortcuts";

export interface StudyKeyActions {
  toggle(): void;
  /** -1 = previous move, +1 = next */
  step(dir: 1 | -1): void;
  /** Shift + ← →: previous / next chord of the tune (theory-core's `stepChord`). */
  chord(dir: 1 | -1): void;
  dial(dir: 1 | -1): void;
  flipView(): void;
  loop(): void;
  tempo(dir: 1 | -1): void;
  key(dir: 1 | -1): void;
  help(): void;
}

/**
 * Study mode's keyboard: the lead sheet with your hands off the mouse. Off while anything
 * sits over the page (a drawer, the X-ray with its own ← →, the ▶ prompt, the `?` card).
 * QWERTY mode's capture listener runs first and swallows the letters it plays, so A and L
 * only work here while it's off, as in Practice Mode.
 */
export function useStudyKeys(enabled: boolean, actions: StudyKeyActions) {
  const latest = useRef(actions);
  latest.current = actions;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (notForUs(e) || e.defaultPrevented) return;
      const a = latest.current;
      const handled = (() => {
        switch (e.key) {
          case " ":
            a.toggle();
            return true;
          case "ArrowLeft":
          case "ArrowRight":
            // Shift walks the tune's chords one by one; bare arrows walk the reharm's moves
            (e.shiftKey ? a.chord : a.step)(e.key === "ArrowRight" ? 1 : -1);
            return true;
          case "ArrowUp":
          case "ArrowDown":
            a.dial(e.key === "ArrowUp" ? 1 : -1);
            return true;
          case "a":
          case "A":
            a.flipView();
            return true;
          case "l":
          case "L":
            a.loop();
            return true;
          case "[":
          case "]":
            a.tempo(e.key === "]" ? 1 : -1);
            return true;
          case ",":
          case ".":
            a.key(e.key === "." ? 1 : -1);
            return true;
          case "?":
            a.help();
            return true;
          default:
            return false;
        }
      })();
      // also stops Space from clicking a focused button and the arrows from scrolling the page
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
