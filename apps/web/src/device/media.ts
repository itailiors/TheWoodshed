import { useSyncExternalStore } from "react";

/*
 * What the device can do, read from CSS media queries so it follows reality (an iPad that
 * gains a Magic Keyboard, a window dragged narrower) instead of user-agent guesses.
 */

const subscribe = (query: string) => (fn: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(query);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};
const snapshot = (query: string) => () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;

/** A media query as live React state. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe(query), snapshot(query), () => false);
}

/** Phone-width layout (below Tailwind's `sm`). */
export const NARROW = "(max-width: 639.98px)";
export const useNarrow = () => useMediaQuery(NARROW);

/**
 * Touch-first: no precise pointer anywhere (a phone, or an iPad without a trackpad). On these
 * there's no QWERTY keyboard to play, hovers don't exist and the player is probably at an
 * acoustic piano, so the Coach checks itself instead of listening.
 */
export const TOUCH_FIRST = "not (any-pointer: fine)";
export const useTouchFirst = () => useMediaQuery(TOUCH_FIRST);
export const isTouchFirst = () => snapshot(TOUCH_FIRST)();

/** Web MIDI exists in this browser (it doesn't in Safari, so not on any iPhone or iPad). */
export const hasWebMidi = () => typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
