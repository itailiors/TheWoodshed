import { useEffect, useRef } from "react";

/** A MIDI Continuous Controller message: mod wheel (CC1), expression pedal (CC11), and so on. */
export interface ControlMsg {
  cc: number;
  /** 0–127 */
  value: number;
  channel: number;
  device: string;
}

type Listener = (m: ControlMsg) => void;
const listeners = new Set<Listener>();

/**
 * The controller twin of the note bus: every Control Change from every MIDI input, so
 * features (the pedal-linked dial today, MIDI learn later) subscribe here and never to
 * Web MIDI directly. Sustain (CC64) and the panic messages (CC120/123) still travel here
 * too; useMidi handles their note-releasing side itself.
 */
export const controlBus = {
  emit(m: ControlMsg) {
    listeners.forEach((l) => l(m));
  },
  on(fn: Listener) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
};

export function useControlBus(fn: Listener, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    return controlBus.on((m) => ref.current(m));
  }, [active]);
}
