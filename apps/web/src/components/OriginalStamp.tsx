import type { Tune } from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../design/rough";
import { pen, seedOf } from "../design/tokens";

type Original = Extract<NonNullable<Tune["rights"]>, { kind: "original" }>;

/**
 * A rubber stamp in the lead sheet's margin for tunes written for the app ("Co-op Blues"):
 * "Original Composition © Itai Lior // Software & Jazz Co-op". Red ink like the teacher's pen,
 * pressed slightly crooked, with a double border drawn by Rough.js (seeded, so it's the same
 * stamp every time) and the ink-wobble filter for uneven ink.
 *
 * It renders from the tune's `rights`, not its id, so any future original gets it too.
 */
export function OriginalStamp({ rights, compact = false, className = "" }: { rights: Original; compact?: boolean; className?: string }) {
  const g = useRef<SVGGElement>(null);
  const seed = seedOf("stamp:" + rights.holder);
  useRough(
    g,
    (rc, add) => {
      add(rc.rectangle(4, 4, 292, 102, { seed, stroke: pen.red, strokeWidth: 2.4, roughness: 1.3, bowing: 0.6 }));
      add(rc.rectangle(10, 10, 280, 90, { seed: seed + 1, stroke: pen.red, strokeWidth: 1.1, roughness: 1.1, bowing: 0.4 }));
      add(rc.line(40, 50, 260, 50, { seed: seed + 2, stroke: pen.red, strokeWidth: 1, roughness: 1.4 }));
    },
    [seed],
  );
  const label = `Original composition, © ${rights.year} ${rights.holder}, Software & Jazz Co-op`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 300 110"
      className={`pointer-events-none -rotate-[4deg] select-none overflow-visible opacity-90 mix-blend-multiply ${compact ? "w-44" : "w-60 md:w-64"} ${className}`}
    >
      <title>{label}</title>
      <g ref={g} />
      <g fill={pen.red} textAnchor="middle" style={{ filter: "url(#ink-wobble)" }}>
        <text x="150" y="41" className="font-marker" fontSize="21" fontWeight="700" letterSpacing="2.5">
          ORIGINAL COMPOSITION
        </text>
        <text x="150" y="72" className="font-marker" fontSize="17" fontWeight="700" letterSpacing="0.5">
          © {rights.year} {rights.holder.toUpperCase()}
        </text>
        <text x="150" y="92" className="font-hand" fontSize="12.5" letterSpacing="1.5">
          {"// SOFTWARE & JAZZ CO-OP"}
        </text>
      </g>
    </svg>
  );
}
