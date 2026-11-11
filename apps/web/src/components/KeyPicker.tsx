import { chroma, KEYS, prettyNote } from "@reharm/theory-core";
import { useEffect, useRef, useState } from "react";
import { SketchBox } from "../design/rough";
import { paper, pen, seedOf } from "../design/tokens";

/** The circle of fifths, clockwise from C (flat-side spellings, as a jazz chart writes them). */
const CIRCLE = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((c) => KEYS.find((k) => chroma(k) === c)!);

interface Props {
  /** The tonic now on the stand. */
  tonic: string;
  /** The key the chart is written in. */
  original: string;
  mode: "major" | "minor";
  onChange: (tonic: string) => void;
  compact?: boolean;
}

/** The marker font has no accidentals, so the ½-step buttons use the music font, at a size you can hit. */
const HALF_STEP = "grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2 border-dashed border-ink-faint font-music text-lg leading-none hover:border-ink hover:bg-paper-shade";
const label = (k: string, mode: Props["mode"]) => `${prettyNote(k)}${mode === "minor" ? "m" : ""}`;
const step = (k: string, semis: number) => KEYS.find((x) => chroma(x) === (chroma(k) + semis + 12) % 12)!;

/**
 * Global key change: "Key: B♭ ▾" opens a hand-drawn circle of fifths. Click any key to move
 * the whole tune there (chords, melody, every reharm move); the original key is marked so you
 * can always find your way home. The ½-step arrows walk chromatically without opening it.
 */
export function KeyPicker({ tonic, original, mode, onChange, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const moved = chroma(tonic) !== chroma(original);

  // close on Escape or a click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const pick = (k: string) => {
    onChange(k);
    setOpen(false);
  };

  const R = 74; // radius of the key ring, in px (the circle is 200×200)
  return (
    <div ref={wrap} className="relative inline-flex items-center gap-1 font-marker">
      <button type="button" onClick={() => onChange(step(tonic, -1))} aria-label="Down a half step" title="Down a half step" className={HALF_STEP}>
        ♭
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`cursor-pointer rounded-full border-2 px-3 py-0.5 hover:-rotate-1 ${moved ? "border-ink bg-ink text-paper-light" : "border-ink hover:bg-paper-shade"}`}
      >
        {compact ? "" : "Key: "}
        {label(tonic, mode)}
        {moved && !compact && <span className="ml-1 text-xs opacity-80">(orig. {label(original, mode)})</span>}
        <span aria-hidden className="ml-1 text-xs">
          ▾
        </span>
      </button>
      <button type="button" onClick={() => onChange(step(tonic, 1))} aria-label="Up a half step" title="Up a half step" className={HALF_STEP}>
        ♯
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a key" className="absolute left-0 top-full z-40 mt-2">
          <SketchBox seed={seedOf("key-circle")} fill={paper.light} strokeWidth={1.8} className="animate-ink-in shadow-[3px_3px_0_var(--color-ink-faint)]">
            <div className="relative h-[200px] w-[200px] text-ink" role="radiogroup" aria-label="Circle of fifths">
              {/* the circle itself, in pencil */}
              <svg viewBox="0 0 200 200" className="absolute inset-0" aria-hidden>
                <g fill="none" stroke="currentColor" filter="url(#ink-wobble)">
                  <circle cx="100" cy="100" r={R} strokeWidth="1" opacity="0.35" strokeDasharray="2 4" />
                  <circle cx="100" cy="100" r="34" strokeWidth="1" opacity="0.25" />
                </g>
                <text x="100" y="96" textAnchor="middle" className="font-hand" fontSize="10" fill="currentColor" opacity="0.6">
                  circle of
                </text>
                <text x="100" y="109" textAnchor="middle" className="font-hand" fontSize="10" fill="currentColor" opacity="0.6">
                  fifths
                </text>
              </svg>
              {CIRCLE.map((k, i) => {
                const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const x = 100 + R * Math.cos(a);
                const y = 100 + R * Math.sin(a);
                const here = chroma(k) === chroma(tonic);
                const home = chroma(k) === chroma(original);
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={here}
                    aria-label={`${label(k, mode)}${home ? " (original key)" : ""}`}
                    onClick={() => pick(k)}
                    className="absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[15px] hover:bg-paper-shade"
                    style={{ left: x, top: y }}
                  >
                    {here && (
                      // the chosen key, circled in ink
                      <svg viewBox="0 0 36 36" className="absolute inset-0" aria-hidden filter="url(#ink-wobble)">
                        <ellipse cx="18" cy="18" rx="16" ry="14.5" fill="none" stroke={pen.red} strokeWidth="2" transform="rotate(-8 18 18)" />
                      </svg>
                    )}
                    <span className={here ? "font-bold" : ""}>{label(k, mode)}</span>
                    {home && <span className="absolute -bottom-2 text-[9px] leading-none text-ink-soft">orig</span>}
                  </button>
                );
              })}
            </div>
          </SketchBox>
        </div>
      )}
    </div>
  );
}
