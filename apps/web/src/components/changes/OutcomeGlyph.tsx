import { ink, pen, sageInk } from "../../design/tokens";
import type { Outcome } from "./RoadTrail";

/*
 * The three outcomes as hand-drawn marks (ink-wobble filter, like the app's other doodles).
 * Each differs in shape, colour and word, so none depends on colour alone:
 * a tick for right, a fork for "also works" (another road from here), a cross for not quite.
 */

export const OUTCOME_COLOR: Record<Outcome, string> = { right: sageInk, alt: ink.deep, wrong: pen.red };
export const OUTCOME_WORD: Record<Outcome, string> = { right: "Right.", alt: "Also works.", wrong: "Not quite." };

export function OutcomeGlyph({ outcome, size = 28 }: { outcome: Outcome; size?: number }) {
  const color = OUTCOME_COLOR[outcome];
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0" style={{ color }}>
      <g filter="url(#ink-wobble)" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {outcome === "alt" && <circle cx="14" cy="14" r="12" fill="var(--color-wash-mustard)" fillOpacity={0.35} stroke="none" />}
        <circle cx="14" cy="14" r="12" strokeWidth={1.6} />
        {outcome === "right" && <path d="M8 14.5 L12.5 19 L20.5 9" />}
        {outcome === "alt" && <path d="M14 21 V14 M14 14 L9 8 M14 14 L19 8" />}
        {outcome === "wrong" && <path d="M9.5 9.5 L18.5 18.5 M18.5 9.5 L9.5 18.5" />}
      </g>
    </svg>
  );
}
