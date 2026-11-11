import { DIAL_CONTROLLERS, pedalToLevel } from "@reharm/theory-core";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { controlBus } from "./controlBus";

/*
 * The expression pedal (CC11) or mod wheel (CC1) on the reharm dial: heel down is the
 * original changes, toe down is L4. Opt-in, because hardware wheels and cheap pedals
 * jitter and nobody wants the harmony changing on its own. Whichever of the two
 * controllers moved last is in charge.
 *
 * The level comes from `pedalToLevel`, which has hysteresis (a resting foot can't flicker
 * between two levels). The raw value is published too, so the dial can draw a needle
 * that follows the pedal continuously while the level snaps.
 */

export interface PedalState {
  linked: boolean;
  /** Last controller value, 0–127; null until something moves after linking. */
  value: number | null;
  source: "mod wheel" | "expression pedal" | null;
  /** The level the pedal is asking for (null until it moves). */
  level: number | null;
}

const STORE = "reharm.pedal";
const NAMES: Record<number, PedalState["source"]> = { [DIAL_CONTROLLERS.modWheel]: "mod wheel", [DIAL_CONTROLLERS.expression]: "expression pedal" };

let state: PedalState = { linked: false, value: null, source: null, level: null };
try {
  state.linked = !!(JSON.parse(localStorage.getItem(STORE) ?? "null") as { linked?: boolean } | null)?.linked;
} catch {
  /* blocked storage: start unlinked */
}

const subs = new Set<() => void>();
const levelSubs = new Set<(level: number) => void>();

function set(next: Partial<PedalState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}

export const pedal = {
  get: () => state,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  setLinked(on: boolean) {
    // a fresh link waits for the pedal to move, so switching it on never jumps the dial by itself
    set({ linked: on, value: null, source: null, level: null });
    try {
      localStorage.setItem(STORE, JSON.stringify({ linked: on }));
    } catch {
      /* fine: just not remembered */
    }
  },
  toggle() {
    pedal.setLinked(!state.linked);
  },
  /** Called with each new level the pedal settles on. */
  onLevel(fn: (level: number) => void) {
    levelSubs.add(fn);
    return () => void levelSubs.delete(fn);
  },
  /** Feed a controller value (from the control bus, or a test). */
  input(cc: number, value: number) {
    const source = NAMES[cc];
    if (!state.linked || !source) return;
    const level = pedalToLevel(value, state.level);
    const changed = level !== state.level;
    set({ value, source, level });
    if (changed) levelSubs.forEach((f) => f(level));
  },
};

let installed = false;
export function installPedal() {
  if (installed) return;
  installed = true;
  controlBus.on((m) => pedal.input(m.cc, m.value));
}

export function usePedal() {
  return useSyncExternalStore(pedal.subscribe, pedal.get);
}

/** Run `fn` whenever the linked pedal settles on a new level. */
export function usePedalLevel(fn: (level: number) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => pedal.onLevel((l) => ref.current(l)), []);
}
