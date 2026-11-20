import { useEffect, useRef } from "react";

/**
 * Esc closes the open popover or sheet, and only that: the key is taken in the CAPTURE phase
 * with `stopImmediatePropagation` (as `Shortcuts.tsx` does), so a page's own Esc on `window`
 * (CoachPage's Esc-to-Study, Practice's Esc-to-Study) never hears it. Listens only while `active`.
 */
export function useEscapeCapture(active: boolean, onEscape: () => void) {
  const fn = useRef(onEscape);
  fn.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      fn.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);
}
