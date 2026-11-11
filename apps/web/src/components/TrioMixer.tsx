import type { ReactNode } from "react";
import type { Instrument } from "../audio/player";
import { useMixer } from "../audio/useMixer";
import { pen, wash } from "../design/tokens";

/*
 * Ink doodles for the trio, drawn on a 48×48 grid. The strokes are hand-placed with a
 * little wobble (no perfect lines), then run through the global #ink-wobble filter like
 * the rest of the sketch UI. Stroke = currentColor, so the "muted" state is just a colour.
 */

/** A two-octave-ish keyboard seen from above: slightly skewed box, white-key ticks, black keys. */
const PianoDoodle = () => (
  <>
    <path d="M5.6 15.2 C14 14.3 30.5 15.7 42.4 14.6 L42.9 33.8 C30 34.9 16.2 33.4 6.1 34.5 Z" />
    <path d="M12.1 15 L11.8 34.2 M18.2 15.1 L18.4 34 M24.1 15 L23.8 34.1 M30.2 15.1 L30.3 34 M36.1 14.9 L36.4 33.9" strokeWidth={1.3} />
    <g fill="currentColor" strokeWidth={1}>
      <path d="M10.2 15.1 L10.4 25.6 L13.7 25.4 L13.5 15 Z" />
      <path d="M16.4 15.1 L16.5 25.3 L19.9 25.5 L19.8 15.1 Z" />
      <path d="M28.5 15.1 L28.4 25.4 L31.8 25.6 L31.9 15 Z" />
      <path d="M34.5 15 L34.6 25.3 L37.9 25.5 L37.8 14.9 Z" />
    </g>
    {/* a quick shadow line under the keybed */}
    <path d="M7.5 37.6 C17 36.9 31 38.1 41.2 37.2" strokeWidth={1} opacity={0.55} />
  </>
);

/** Upright bass: scroll on top, neck and strings, the curvy body with both f-holes and the bridge. */
const BassDoodle = () => (
  <>
    <path d="M24.6 9.4 C28.9 9.2 29.4 3.6 25.4 3.4 C22.6 3.3 22.4 6.7 24.6 6.9" />
    <path d="M23.1 9.6 L22.6 20.2 M26.2 9.5 L26.7 20.1" />
    <path d="M22.6 20.2 C16.2 19.3 13.2 23.2 15.1 27.1 C16.4 29.9 12.8 31.2 12.9 36.2 C13.1 43.1 19.8 45.6 24.6 45.5 C29.6 45.4 35.9 42.8 35.8 36 C35.7 31.1 32.4 29.8 33.9 27 C35.8 23.1 32.9 19.2 26.7 20.1" />
    <path d="M24.4 8.8 L24.6 39.4" strokeWidth={0.8} />
    <path d="M19.2 27.6 C17.9 29.6 20.4 31.1 19.1 33.3 C17.9 35.3 19.6 36.6 19.4 37.6" strokeWidth={1.3} />
    <path d="M29.8 27.5 C31.1 29.5 28.6 31 29.9 33.2 C31.1 35.2 29.4 36.5 29.6 37.6" strokeWidth={1.3} />
    <path d="M21.4 36.6 C23.4 35.8 25.6 35.9 27.6 36.5" />
    <path d="M23.6 41.4 L23.9 45.4 M25.3 41.4 L25.1 45.4" strokeWidth={1} />
  </>
);

/** A snare in three-quarter view with a pair of brushes crossed on the head. */
const DrumsDoodle = () => (
  <>
    <path d="M7.8 24.1 C7.6 20 40.2 19.8 40.3 24 C40.4 28.1 7.9 28.3 7.8 24.1 Z" />
    <path d="M7.9 24.4 L8.6 35.2 C9.4 39.6 38.8 39.8 39.6 35 L40.2 24.3" />
    <path d="M12.6 27.5 L13.1 37.6 M20.1 28.3 L20.3 39 M28.2 28.3 L27.9 39 M35.5 27.4 L35.1 37.5" strokeWidth={1.1} />
    <path d="M9.1 30.2 C18 32.6 30 32.6 39.2 30" strokeWidth={0.9} opacity={0.6} />
    {/* brushes: handles crossing, wire fans splayed on the head */}
    <path d="M12.4 3.6 L22.6 19.8 M35.8 3.4 L25.6 19.9" strokeWidth={1.8} />
    <path d="M22.6 19.8 L18.4 22.6 M22.6 19.8 L20.1 23.5 M22.6 19.8 L22.3 23.9 M22.6 19.8 L24.3 23.4" strokeWidth={0.8} />
    <path d="M25.6 19.9 L29.9 22.5 M25.6 19.9 L28.2 23.5 M25.6 19.9 L26 23.9 M25.6 19.9 L24.1 23.3" strokeWidth={0.8} />
  </>
);

const DOODLES: Record<Instrument, { label: string; draw: () => ReactNode; wash: string }> = {
  piano: { label: "Piano", draw: PianoDoodle, wash: wash.mustard },
  bass: { label: "Bass", draw: BassDoodle, wash: wash.brick },
  drums: { label: "Drums", draw: DrumsDoodle, wash: wash.blue },
};

const ORDER: Instrument[] = ["piano", "bass", "drums"];

interface Props {
  /** Smaller icons and no captions (Practice Mode's top bar). */
  compact?: boolean;
  className?: string;
}

/**
 * Piano / bass / drums toggles. A lit instrument gets ink plus a watercolour wash behind
 * it; a muted one fades to pencil grey and gets a red-pen slash, like a crossed-out part.
 */
export function TrioMixer({ compact = false, className = "" }: Props) {
  const { mix, toggle } = useMixer();
  const size = compact ? 34 : 44;
  return (
    <div role="group" aria-label="Band mixer" className={`flex items-end gap-1.5 ${className}`}>
      {ORDER.map((inst) => {
        const d = DOODLES[inst];
        const on = mix[inst];
        return (
          <button
            key={inst}
            type="button"
            onClick={() => toggle(inst)}
            aria-pressed={on}
            aria-label={`${d.label}: ${on ? "playing, click to mute" : "muted, click to bring in"}`}
            title={`${on ? "Mute" : "Unmute"} ${d.label.toLowerCase()}`}
            className={`group flex cursor-pointer flex-col items-center rounded-lg px-1 transition-[transform,opacity] hover:-rotate-2 focus-visible:outline-2 focus-visible:outline-ink ${
              on ? "text-ink" : "text-ink-faint opacity-60"
            }`}
          >
            <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="overflow-visible">
              {on && <ellipse cx="24" cy="26" rx="21" ry="17" fill={d.wash} opacity={0.38} filter="url(#watercolor)" />}
              <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" filter="url(#ink-wobble)">
                {d.draw()}
              </g>
              {!on && <path d="M6 42 C16 32 30 18 43 7" fill="none" stroke={pen.red} strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />}
            </svg>
            {!compact && <span className={`font-hand text-xs leading-none ${on ? "" : "line-through decoration-[var(--color-pen)]"}`}>{d.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
