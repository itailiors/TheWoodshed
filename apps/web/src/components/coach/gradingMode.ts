import { useCallback, useState } from "react";
import { isTouchFirst } from "../../device/media";
import type { MidiStatus } from "../../midi/useMidi";

/*
 * How the Coach finds out what you played.
 *
 *  - "listen": the engine hears the notes (MIDI keyboard, QWERTY, or the on-screen keys) and
 *    diffs each strike against the voicing: misses, wrong notes and voice-leading leaps.
 *  - "self":   you're at an acoustic piano with no cable. The drill reveals the voicing when
 *    you ask, you play it, and you say whether you nailed it. Same misses, same SM-2 grade,
 *    but no leap detection (nobody heard the notes), and the run is saved as self-graded.
 *
 * The drill only ever sees per-step outcomes, so a future "mic" mode (Web Audio polyphonic
 * pitch detection on the real piano) needs no new grading path: publish the detected chord
 * to the note bus as another strike source and it becomes a "listen" mode, the self-check
 * panel stepping aside on its own.
 */
export type GradingMode = "listen" | "self";
/** The verdict a self-check gives one chord. */
export type SelfVerdict = "nailed" | "missed";

const KEY = "reharm.coachGrading";

function stored(): GradingMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "listen" || v === "self" ? v : null;
  } catch {
    return null;
  }
}

/**
 * The automatic choice: listen whenever MIDI is connected; otherwise self-check on touch-first
 * devices (phone, iPad), where there's no keyboard to type on and tapping a five-note voicing
 * onto a tiny keyboard is a chore; otherwise listen (QWERTY and clicks work on a desktop).
 */
export function autoMode(midi: MidiStatus, touchFirst = isTouchFirst()): GradingMode {
  if (midi === "connected") return "listen";
  return touchFirst ? "self" : "listen";
}

/** The current mode, the player's override (remembered) or else the automatic choice. */
export function useGradingMode(midi: MidiStatus): [GradingMode, (m: GradingMode) => void] {
  const [override, setOverride] = useState<GradingMode | null>(stored);
  // plugging in MIDI always means "listen to me", whatever was picked before
  const mode = midi === "connected" ? "listen" : (override ?? autoMode(midi));
  const set = useCallback((m: GradingMode) => {
    setOverride(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode: the choice lasts this visit */
    }
  }, []);
  return [mode, set];
}
