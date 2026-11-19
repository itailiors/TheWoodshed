import { useSyncExternalStore } from "react";
import { BAND_STYLES, DEFAULT_SWING, SWING_HARD, SWING_STRAIGHT, bandStylesFor, type BandStyle } from "@reharm/theory-core";
import { getBandFeel, resetBandFeel, setBandStyle, setSwing, subscribeBandFeel } from "../audio/bandFeel";

/** Styles whose feel is straight, so the swing ratio has nothing to act on. */
const STRAIGHT_STYLES: readonly BandStyle[] = ["ballad", "bossa", "straight8"];

const pct = (r: number) => Math.round(r * 100);

/** Words for a ratio, the way a player would say it. */
export function swingWord(r: number): string {
  const p = pct(r);
  if (p <= 52) return "straight";
  if (p < 62) return "light";
  if (p <= 69) return "triplet 2:1";
  return "hard";
}

export const useBandFeel = () => useSyncExternalStore(subscribeBandFeel, getBandFeel);

/** True when swing or style is off its default (the mixer button shows it). */
export function useBandFeelChanged(): boolean {
  const { swing, style } = useBandFeel();
  return pct(swing) !== pct(DEFAULT_SWING) || style !== "as-written";
}

/**
 * Swing and band style: how the rhythm section plays, not what it plays. Lives in the
 * mixer popover beside the faders. Changes re-lay the band's parts while it plays.
 */
export function BandFeelControls({ beatsPerBar }: { beatsPerBar: number }) {
  const { swing, style } = useBandFeel();
  const changed = useBandFeelChanged();
  const offered = bandStylesFor(beatsPerBar);
  const styles = BAND_STYLES.filter((s) => offered.includes(s.id));
  const shown = offered.includes(style) ? style : "as-written";
  const straight = STRAIGHT_STYLES.includes(shown);
  const hint = BAND_STYLES.find((s) => s.id === shown)?.hint;

  return (
    <div className="mt-3 border-t border-ink/15 pt-2" role="group" aria-label="Band feel">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-marker text-xs tracking-wide text-ink">🎷 Band</span>
        <button
          type="button"
          onClick={resetBandFeel}
          disabled={!changed}
          className="cursor-pointer rounded px-1.5 py-0.5 font-hand text-[11px] text-ink-soft underline decoration-dotted hover:text-ink disabled:cursor-default disabled:opacity-40"
        >
          Reset feel
        </button>
      </div>

      <label htmlFor="band-style" className="flex items-center justify-between gap-2 font-marker text-xs text-ink">
        Style
        <select
          id="band-style"
          aria-label="Band style"
          value={shown}
          onChange={(e) => setBandStyle(e.target.value as BandStyle)}
          className="cursor-pointer rounded border border-ink/40 bg-paper-light px-1 py-0.5 font-hand text-xs text-ink"
        >
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {hint && <p className="mt-0.5 font-hand text-[10px] leading-tight text-ink-soft">{hint}</p>}

      <div className={`mt-2 flex flex-col gap-0.5 ${straight ? "opacity-45" : ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="band-swing" className="font-marker text-xs text-ink">
            Swing
          </label>
          <button
            type="button"
            onClick={() => setSwing(DEFAULT_SWING)}
            disabled={straight}
            title="Click to reset to the triplet 2:1"
            className="cursor-pointer font-hand text-[11px] tabular-nums text-ink-soft hover:text-ink disabled:cursor-default"
          >
            {pct(swing)}% · {swingWord(swing)}
          </button>
        </div>
        <input
          id="band-swing"
          type="range"
          min={pct(SWING_STRAIGHT)}
          max={pct(SWING_HARD)}
          step={1}
          value={pct(swing)}
          disabled={straight}
          aria-label="Swing ratio (percent of the beat before the offbeat eighth)"
          aria-valuetext={`${pct(swing)} percent, ${swingWord(swing)}`}
          onChange={(e) => setSwing(Number(e.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-[var(--color-ink)] disabled:cursor-default"
        />
        <div className="relative h-3 font-hand text-[10px] leading-none text-ink-soft" aria-hidden>
          <span className="absolute left-0">even</span>
          {/* the triplet mark sits where 2/3 really is on the 50–75 scale */}
          <span className="absolute -translate-x-1/2" style={{ left: `${((DEFAULT_SWING - SWING_STRAIGHT) / (SWING_HARD - SWING_STRAIGHT)) * 100}%` }}>
            2:1
          </span>
          <span className="absolute right-0">hard</span>
        </div>
        <p className="font-hand text-[10px] leading-tight text-ink-soft">
          {straight ? "This style plays straight eighths." : "Moves the ride's skip note, the comping offbeats and the head's eighths."}
        </p>
      </div>
    </div>
  );
}
