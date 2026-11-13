import { prettySymbol } from "@reharm/theory-core";
import { pen } from "../../design/tokens";
import type { SelfVerdict } from "./gradingMode";

interface Props {
  symbol: string;
  /** "Strike it (2 of 3)" context, or "…and resolve it." */
  prompt: string;
  revealed: boolean;
  onReveal: () => void;
  onVerdict: (v: SelfVerdict) => void;
  /** The voicing in words, bottom to top, e.g. "B♭ (bass) · D F A C". */
  noteNames: string;
  /** How the voices moved from the previous chord, so you can check your voice leading by eye. */
  motion: string | null;
  /** You said you missed this chord: it stays revealed for another go. */
  retrying: boolean;
}

/**
 * The no-MIDI half of the Coach: play the chord on your own piano from memory, reveal the
 * engine's voicing, and grade yourself. Two big thumb-sized buttons, since this is mostly
 * used on a phone propped on the music stand.
 */
export function SelfCheckPanel({ symbol, prompt, revealed, onReveal, onVerdict, noteNames, motion, retrying }: Props) {
  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-ink-faint p-3 md:p-4" aria-live="polite">
      {!revealed ? (
        <>
          <p className="text-base">
            <span className="font-marker">{prompt}</span> Play <span className="font-marker">{prettySymbol(symbol)}</span> on your piano from memory, then check it.
          </p>
          <button
            type="button"
            onClick={onReveal}
            className="tap-lg w-full cursor-pointer rounded-full border-2 border-ink bg-ink px-5 font-marker text-lg text-paper-light shadow-[2px_2px_0_var(--color-ink-faint)] sm:w-auto"
          >
            👁 Show the voicing
          </button>
        </>
      ) : (
        <>
          <p className="font-hand text-base">
            <span className="font-marker">{prettySymbol(symbol)}</span>: {noteNames}
          </p>
          {motion && <p className="-mt-2 font-hand text-sm text-ink-soft">from the last chord: {motion}</p>}
          {retrying && (
            <p className="-mt-1 font-marker text-sm" style={{ color: pen.red }}>
              Noted. Play it again with the voicing in view, then grade the new try.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => onVerdict("nailed")}
              className="tap-lg cursor-pointer rounded-full border-2 border-ink bg-ink px-4 font-marker text-paper-light"
            >
              ✓ I played it perfectly
            </button>
            <button
              type="button"
              onClick={() => onVerdict("missed")}
              className="tap-lg cursor-pointer rounded-full border-2 px-4 font-marker"
              style={{ borderColor: pen.red, color: pen.red }}
            >
              ✗ I missed it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
