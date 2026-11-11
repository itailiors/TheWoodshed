import { midiName } from "../midi/useMidi";
import { qwerty, useQwerty } from "../midi/qwerty";

/**
 * The switch for computer-keyboard input, styled like the MIDI pill beside it. Off, it
 * advertises itself ("no MIDI? play with your keyboard"); on, it shows the range under
 * your fingers and what's held, so you can tell at a glance where A will land.
 */
export function QwertyToggle({ compact = false }: { compact?: boolean }) {
  const q = useQwerty();
  const range = `${midiName(q.base)}–${midiName(q.base + 17)}`;
  return (
    <span className="inline-flex items-center gap-1 font-marker text-sm">
      <button
        type="button"
        aria-pressed={q.enabled}
        onClick={qwerty.toggle}
        title={
          "Play with the computer keyboard (M).\n" +
          "A S D F G H J K L ; ' = white keys from C\n" +
          "W E · T Y U · O P = black keys\n" +
          "Z / X = octave down / up"
        }
        className={`cursor-pointer rounded-full border-2 px-3 py-0.5 hover:bg-paper-shade ${q.enabled ? "border-ink bg-paper-light" : "border-dashed border-ink-soft"}`}
      >
        ⌨ {q.enabled ? (compact ? `Keys · ${range}` : `Keys on · A = ${midiName(q.base)}`) : compact ? "Keys (M)" : "No MIDI? Play with your keyboard (M)"}
        {q.held.length > 0 && <span className="ml-1 text-ink-soft">· {q.held.map(midiName).join(" ")}</span>}
      </button>
      {q.enabled && (
        <>
          <button type="button" aria-label="Octave down (Z)" onClick={() => qwerty.shift(-1)} className="cursor-pointer rounded px-1 hover:bg-paper-shade">
            Z−
          </button>
          <button type="button" aria-label="Octave up (X)" onClick={() => qwerty.shift(1)} className="cursor-pointer rounded px-1 hover:bg-paper-shade">
            X+
          </button>
        </>
      )}
    </span>
  );
}
