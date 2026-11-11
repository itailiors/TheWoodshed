import { midiMonitor, useMidiMonitor } from "../midi/monitor";

/**
 * Whether your MIDI keyboard sounds through the app's piano. Shown once a keyboard is
 * connected. On by default; turn it off if your keyboard has its own speakers.
 */
export function MidiMonitorToggle({ compact = false }: { compact?: boolean }) {
  const on = useMidiMonitor();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={midiMonitor.toggle}
      title={
        on
          ? "Your MIDI keyboard plays through the app's piano (sustain pedal included). Turn this off if your keyboard has its own speakers."
          : "Muted: you hear only your keyboard's own sound. Turn this on to play through the app's piano."
      }
      className={`cursor-pointer rounded-full border-2 px-3 py-0.5 font-marker text-sm hover:bg-paper-shade ${on ? "border-ink bg-paper-light" : "border-dashed border-ink-soft text-ink-soft"}`}
    >
      {on ? "🔊" : "🔇"} {compact ? (on ? "In app" : "Keyboard only") : on ? "Hear it in the app" : "Keyboard speakers only"}
    </button>
  );
}
