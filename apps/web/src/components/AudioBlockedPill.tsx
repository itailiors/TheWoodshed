import { useSyncExternalStore } from "react";
import { player } from "../audio/player";

const subscribe = (cb: () => void) => player.onAudioBlocked(cb);
const blocked = () => player.audioBlocked;

/**
 * "Sound is paused · tap to enable": shown only when something asked for sound and the
 * browser kept the audio clock asleep (MIDI after a refresh, iOS after a call). The tap is
 * the user gesture the browser wants; `audio/unlock.ts` wakes the context on any gesture, and
 * the click handler does it too. Rendered by the Toaster, so every page has it.
 */
export function AudioBlockedPill() {
  const isBlocked = useSyncExternalStore(subscribe, blocked);
  if (!isBlocked) return null;
  return (
    <button
      type="button"
      onClick={() => player.resume()}
      className="animate-ink-in pointer-events-auto cursor-pointer rounded-full border-2 border-ink bg-paper-light px-4 py-1.5 font-marker text-[15px] shadow-sm hover:bg-paper-shade"
    >
      🔇 Sound is paused by the browser · <span className="underline">tap to enable</span>
    </button>
  );
}
