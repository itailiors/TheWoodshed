import { useSyncExternalStore } from "react";
import { player } from "../audio/player";
import { noteBus } from "./noteBus";

/*
 * Play with the computer keyboard, for everyone without a MIDI controller.
 *
 * The layout is the one musicians already know from DAWs: the home row is the white keys,
 * the row above is the black keys, Z / X shift the octave, M switches it on and off.
 *
 *     W E   T Y U   O P
 *    A S D F G H J K L ; '
 *    C D E F G A B C D E F
 *
 * Keys are matched on `KeyboardEvent.code` (the physical key), so the shape stays the same
 * on AZERTY or QWERTZ. Notes go out on the shared note bus exactly like MIDI, so the
 * heatmap, the Coach and everything else hear them without knowing the difference, and
 * they sound through the app's piano (a computer keyboard has no speaker of its own).
 *
 * While it's on, the letter keys belong to the piano: they're taken in the capture phase,
 * so Practice Mode's A (A/B) and L (loop) shortcuts pause until you press M again.
 */

const LAYOUT: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};
/** The letters printed on each key, for hints on screen. */
export const QWERTY_LABELS: Record<number, string> = {
  0: "A", 1: "W", 2: "S", 3: "E", 4: "D", 5: "F", 6: "T", 7: "G", 8: "Y", 9: "H", 10: "U", 11: "J",
  12: "K", 13: "O", 14: "L", 15: "P", 16: ";", 17: "'",
};

const LOW = 24; // C1
const HIGH = 96; // C7 (the top of the layout lands on F7)
const VELOCITY = 96; // a solid mezzo-forte; there's no touch on a laptop key
const STORE = "reharm.qwerty";

export interface QwertyState {
  enabled: boolean;
  /** MIDI number of the note under A. Always a C. */
  base: number;
  held: number[];
}

let state: QwertyState = { enabled: false, base: 60, held: [] };
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<QwertyState> | null;
  if (saved) state = { ...state, enabled: !!saved.enabled, base: clampBase(saved.base ?? 60) };
} catch {
  /* private mode / blocked storage: start with the defaults */
}

const subs = new Set<() => void>();
/** physical key → the note it started, so a key-up releases the right pitch even after an octave shift */
const down = new Map<string, number>();

function clampBase(b: number) {
  return Math.min(HIGH - 12, Math.max(LOW, Math.round(b / 12) * 12));
}

function set(next: Partial<QwertyState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(STORE, JSON.stringify({ enabled: state.enabled, base: state.base }));
  } catch {
    /* fine: it just won't be remembered */
  }
  subs.forEach((f) => f());
}

function noteOn(code: string, note: number) {
  down.set(code, note);
  noteBus.emit({ type: "on", note, velocity: VELOCITY, source: "qwerty" });
  void player.noteOn(note, VELOCITY / 127);
  set({ held: [...new Set(down.values())].sort((a, b) => a - b) });
}

function noteOff(code: string) {
  const note = down.get(code);
  if (note === undefined) return;
  down.delete(code);
  // two keys can't share a pitch in this layout, but stay safe: only let go once nothing holds it
  if (![...down.values()].includes(note)) {
    noteBus.emit({ type: "off", note, velocity: 0, source: "qwerty" });
    player.noteOff(note);
  }
  set({ held: [...new Set(down.values())].sort((a, b) => a - b) });
}

/** Let every key up: on switching off, losing focus, or hiding the tab (key-ups never arrive then). */
function releaseAll() {
  for (const code of [...down.keys()]) noteOff(code);
}

export const qwerty = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  setEnabled(on: boolean) {
    if (!on) releaseAll();
    set({ enabled: on });
  },
  toggle() {
    qwerty.setEnabled(!state.enabled);
  },
  /** Octave up (+1) or down (−1). Notes already sounding keep their pitch until released. */
  shift(dir: 1 | -1) {
    set({ base: clampBase(state.base + dir * 12) });
  },
};

export function useQwerty() {
  return useSyncExternalStore(qwerty.subscribe, qwerty.get);
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);

let installed = false;

export function installQwertyKeys() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener(
    "keydown",
    (e) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "KeyM" && !e.repeat) {
        qwerty.toggle();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!state.enabled) return;
      const offset = LAYOUT[e.code];
      const isShift = e.code === "KeyZ" || e.code === "KeyX";
      if (offset === undefined && !isShift) return;
      // ours: keep the page's own shortcuts (and the browser's find-as-you-type) out of it
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat) return; // auto-repeat is not a new strike
      if (isShift) return qwerty.shift(e.code === "KeyX" ? 1 : -1);
      if (!down.has(e.code)) noteOn(e.code, state.base + offset);
    },
    { capture: true },
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (!down.has(e.code)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      noteOff(e.code);
    },
    { capture: true },
  );

  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && releaseAll());
}
