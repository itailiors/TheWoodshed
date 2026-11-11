import { densityLabel } from "@reharm/theory-core";
import { useRef } from "react";
import { useRough } from "../design/rough";
import { ink, LEVELS, seedOf } from "../design/tokens";

function PenCircle({ seed }: { seed: number }) {
  const g = useRef<SVGGElement>(null);
  useRough(g, (rc, add) => add(rc.ellipse(50, 22, 96, 40, { seed, stroke: ink.deep, strokeWidth: 2, roughness: 1.6 })), [seed]);
  return (
    <svg aria-hidden viewBox="0 0 100 44" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-1 -inset-y-1 h-[calc(100%+8px)] w-[calc(100%+8px)] overflow-visible">
      <g ref={g} />
    </svg>
  );
}

/** The "spice dial": how far the engine is allowed to go. */
export function LevelDial({ level, onChange }: { level: number; onChange: (l: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Reharm level" className="flex flex-wrap items-center gap-1">
      {LEVELS.map((l) => {
        const on = l.level === level;
        return (
          <button
            key={l.level}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(l.level)}
            title={`L${l.level} ${l.label}: ${densityLabel(l.level)}`}
            className={`relative cursor-pointer px-3 py-1 font-marker text-base ${on ? "font-bold" : "text-ink-soft hover:text-ink"}`}
          >
            {on && <PenCircle seed={seedOf("lvl" + l.level)} />}
            <span className="relative">
              L{l.level} <span className="hidden sm:inline">{l.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
