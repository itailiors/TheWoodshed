import type { TimePos } from "@reharm/theory-core";
import type { CountInBars, CountState } from "../audio/player";
import { pen } from "../design/tokens";

interface PulseProps {
  position: TimePos | null;
  /** Increments every beat (see usePlayback), so the pulse re-fires on repeated positions. */
  beatTick: number;
  count: CountState | null;
  beatsPerBar: number;
  className?: string;
}

/**
 * The metronome dot: an ink blot in the margin that lands on every beat. The downbeat is a
 * bigger blot in red pen; the others are smaller. During the count-in it shows the count
 * itself ("1 · 2 · 3"), so you can see as well as hear where the band comes in.
 * It sits still (and empty) when stopped, so nothing moves on the page unless the music does.
 */
export function BeatPulse({ position, beatTick, count, beatsPerBar, className = "" }: PulseProps) {
  const beat = count?.beat ?? position?.beat ?? null;
  const down = beat === 1;
  const n = count ? count.beat : null;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-hidden>
      <span className="relative grid h-7 w-7 place-items-center">
        {/* the faint ring the blot lands in */}
        <svg viewBox="0 0 28 28" className="absolute inset-0 text-ink-faint" filter="url(#ink-wobble)">
          <circle cx="14" cy="14" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
        </svg>
        {beat !== null && (
          <span
            key={`${beatTick}-${n ?? ""}`}
            className="beat-blot rounded-full"
            style={{
              width: down ? 18 : 12,
              height: down ? 18 : 12,
              background: down ? pen.red : "var(--color-ink)",
            }}
          />
        )}
      </span>
      {/* the beat dots across the bar: where you are in it */}
      <span className="flex gap-1">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full transition-colors duration-75"
            style={{ background: beat === i + 1 ? (i === 0 ? pen.red : "var(--color-ink)") : "var(--color-ink-faint)", opacity: beat === i + 1 ? 1 : 0.4 }}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * The count-in, written big: "1 · 2 · 3" with the current number inked and the rest faint.
 * Used in Practice Mode's HUD and next to Play.
 */
export function CountInDisplay({ count, size = "lg" }: { count: CountState | null; size?: "lg" | "sm" }) {
  if (!count) return null;
  const nums = Array.from({ length: count.beatsPerBar }, (_, i) => i + 1);
  return (
    <span role="status" aria-label={`Count-in: ${count.beat}`} className={`inline-flex items-baseline gap-2 font-marker ${size === "lg" ? "text-6xl" : "text-xl"}`}>
      {count.bars > 1 && <span className="text-sm text-ink-soft">bar {count.bar}</span>}
      {nums.map((i) => (
        <span
          key={`${i}-${count.bar}-${i === count.beat ? "on" : "off"}`}
          className={i === count.beat ? "animate-ink-in" : "opacity-25"}
          style={{ color: i === count.beat && i === 1 ? pen.red : undefined }}
        >
          {i}
        </span>
      ))}
    </span>
  );
}

/** "Count-in: off · 1 · 2" — pencil tabs, remembered between visits. */
export function CountInPicker({ bars, onChange, compact = false }: { bars: CountInBars; onChange: (b: CountInBars) => void; compact?: boolean }) {
  return (
    <span role="radiogroup" aria-label="Count-in" className="inline-flex items-center gap-1 font-marker text-sm">
      {!compact && <span className="mr-1">Count-in</span>}
      {([0, 1, 2] as const).map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={bars === b}
          onClick={() => onChange(b)}
          title={b === 0 ? "No count-in" : `${b} bar${b > 1 ? "s" : ""} of count-in`}
          className={`cursor-pointer rounded-full border-2 px-2 leading-5 ${bars === b ? "border-ink bg-ink text-paper-light" : "border-transparent hover:border-ink-faint"}`}
        >
          {b === 0 ? "off" : compact ? `${b}♩` : `${b} bar${b > 1 ? "s" : ""}`}
        </button>
      ))}
    </span>
  );
}
