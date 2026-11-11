import { densityLabel } from "@reharm/theory-core";
import { useLayoutEffect, useRef } from "react";
import { useRough } from "../design/rough";
import { ink, LEVELS, seedOf } from "../design/tokens";
import { pedal, usePedal } from "../midi/pedal";

function PenCircle({ seed }: { seed: number }) {
  const g = useRef<SVGGElement>(null);
  useRough(g, (rc, add) => add(rc.ellipse(50, 22, 96, 40, { seed, stroke: ink.deep, strokeWidth: 2, roughness: 1.6 })), [seed]);
  return (
    <svg aria-hidden viewBox="0 0 100 44" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-1 -inset-y-1 h-[calc(100%+8px)] w-[calc(100%+8px)] overflow-visible">
      <g ref={g} />
    </svg>
  );
}

/**
 * The "spice dial": how far the engine is allowed to go.
 *
 * With the pedal linked (CC11 expression or CC1 mod wheel), an ink needle under the dial
 * follows the controller continuously, and the pen circle snaps from stop to stop as the
 * level changes: you can see where your foot is *and* which harmony you're hearing.
 */
export function LevelDial({ level, onChange }: { level: number; onChange: (l: number) => void }) {
  const p = usePedal();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const needle = useRef<HTMLSpanElement>(null);
  const live = p.linked && p.value !== null;

  // Put the needle inside the segment for the raw value, as far across as the value is
  // through that band. (The buttons have different widths, so measure rather than assume.)
  useLayoutEffect(() => {
    const el = needle.current;
    if (!el || !live) return;
    const band = 128 / LEVELS.length;
    const raw = Math.min(LEVELS.length - 1, Math.floor(p.value! / band));
    const b = buttons.current[raw];
    if (!b) return;
    const frac = (p.value! - raw * band) / band;
    el.style.transform = `translateX(${b.offsetLeft + frac * b.offsetWidth}px)`;
  }, [live, p.value]);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div role="radiogroup" aria-label="Reharm level" className="relative flex flex-wrap items-center gap-1 pb-1">
        {LEVELS.map((l, i) => {
          const on = l.level === level;
          return (
            <button
              key={l.level}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(l.level)}
              title={`L${l.level} ${l.label}: ${densityLabel(l.level)}`}
              className={`relative cursor-pointer px-3 py-1 font-marker text-base ${on ? "font-bold" : "text-ink-soft hover:text-ink"}`}
            >
              {on && <PenCircle seed={seedOf("lvl" + l.level)} />}
              {/* remounts on each pedal-driven change, which replays the snap */}
              <span key={on && live ? `snap-${level}` : "still"} className={`relative inline-block ${on && live ? "dial-snap" : ""}`}>
                L{l.level} <span className="hidden sm:inline">{l.label}</span>
              </span>
            </button>
          );
        })}
        {live && (
          <span ref={needle} aria-hidden className="pedal-needle pointer-events-none absolute bottom-0 left-0 block h-2 w-0">
            <svg viewBox="-5 0 10 8" className="absolute -left-[5px] top-0 h-2 w-[10px] overflow-visible" style={{ filter: "url(#ink-wobble)" }}>
              <path d="M0 0 L4 8 L-4 8 Z" fill="currentColor" className="text-pen" />
            </svg>
          </span>
        )}
      </div>
      <PedalLink />
    </div>
  );
}

/** Opt-in: off by default, because jittery wheels shouldn't change the harmony on their own. */
function PedalLink() {
  const p = usePedal();
  return (
    <button
      type="button"
      aria-pressed={p.linked}
      onClick={pedal.toggle}
      title={
        p.linked
          ? "The dial follows your mod wheel (CC1) or expression pedal (CC11): heel down = original changes, toe down = L4. Click to unlink."
          : "Link the dial to a MIDI mod wheel (CC1) or expression pedal (CC11), then rock it to change how far out the harmony goes while the band plays."
      }
      className={`cursor-pointer rounded-full border-2 px-2 py-0.5 font-marker text-xs hover:bg-paper-shade ${p.linked ? "border-ink bg-paper-light" : "border-dashed border-ink-soft text-ink-soft"}`}
    >
      🦶 {!p.linked ? "Link to mod wheel / pedal" : p.value === null ? "Linked: move the wheel or pedal" : `${p.source} · ${p.value}`}
    </button>
  );
}
