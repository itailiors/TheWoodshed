import { useSyncExternalStore } from "react";
import { player } from "../audio/player";
import { controlBus } from "./controlBus";
import { noteBus } from "./noteBus";

/*
 * MIDI monitoring: play what you're playing on a MIDI keyboard through the app's piano.
 *
 * Most USB controllers have no speaker, so without this you'd play into silence. On by
 * default; switch it off if your keyboard has its own sound (a digital piano) and you'd
 * rather hear only that. The computer keyboard and on-screen keys sound by themselves and
 * aren't affected.
 *
 * The sustain pedal (CC64) works like a piano's: while it's down, released keys keep
 * ringing until it comes up; a key struck again while it's ringing restarts it.
 */

const STORE = "reharm.midiMonitor";

let enabled = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as { enabled?: boolean } | null;
  if (saved && typeof saved.enabled === "boolean") enabled = saved.enabled;
} catch {
  /* blocked storage: monitoring on */
}

/** Keys physically down, and notes ringing only because the pedal is down. */
const held = new Set<number>();
const sustained = new Set<number>();
let pedalDown = false;

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function silenceAll() {
  for (const n of new Set([...held, ...sustained])) player.noteOff(n);
  held.clear();
  sustained.clear();
}

export const midiMonitor = {
  get: () => enabled,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  setEnabled(on: boolean) {
    if (!on) silenceAll();
    enabled = on;
    try {
      localStorage.setItem(STORE, JSON.stringify({ enabled: on }));
    } catch {
      /* not remembered, still works */
    }
    notify();
  },
  toggle() {
    midiMonitor.setEnabled(!enabled);
  },
};

let installed = false;
export function installMidiMonitor() {
  if (installed) return;
  installed = true;

  noteBus.on((m) => {
    if (m.source !== "midi" || !enabled) return;
    if (m.type === "on") {
      if (sustained.delete(m.note)) player.noteOff(m.note); // re-strike a ringing note
      held.add(m.note);
      void player.noteOn(m.note, Math.max(0.15, m.velocity / 127));
    } else {
      if (!held.delete(m.note)) return;
      if (pedalDown) sustained.add(m.note);
      else player.noteOff(m.note);
    }
  });

  controlBus.on((c) => {
    if (c.cc !== 64) return;
    const down = c.value >= 64;
    if (down === pedalDown) return;
    pedalDown = down;
    if (!down) {
      for (const n of sustained) if (!held.has(n)) player.noteOff(n);
      sustained.clear();
    }
  });
}

export function useMidiMonitor() {
  return useSyncExternalStore(midiMonitor.subscribe, midiMonitor.get);
}
