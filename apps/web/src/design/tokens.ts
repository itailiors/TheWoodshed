import type { MoveCategory } from "@reharm/theory-core";

/*
 * Colours as CSS variable references, so every theme (src/design/themes.ts) reaches inline
 * styles and Rough.js sketches too: SVG attributes resolve `var()` like any CSS colour.
 * The values live in index.css. Never use raw hex in a component; for a translucent
 * colour use `tint()`, not hex-alpha string concatenation.
 */
const v = (name: string) => `var(--color-${name})`;

export const ink = { deep: v("ink"), soft: v("ink-soft"), faint: v("ink-faint") } as const;
export const paper = { base: v("paper"), light: v("paper-light"), shade: v("paper-shade") } as const;
export const wash = { blue: v("wash-blue"), mustard: v("wash-mustard"), brick: v("wash-brick"), sage: v("wash-sage") } as const;
/** The teacher's red pen: corrections and checkmarks in the practice tools. */
export const pen = { red: v("pen") } as const;
/** "Right" in the Changes game: a darkened sage that reads on paper (the sage wash fills, this draws). */
export const sageInk = v("sage-ink");
/**
 * Piano keys. Separate from paper and ink because a dark theme swaps those two, and the
 * keyboard must still read as ivories and ebonies. `line` outlines keys and dots, `soft`
 * marks a target on a white key.
 */
export const keys = { white: v("key-white"), black: v("key-black"), line: v("key-line"), soft: v("key-soft") } as const;

/** A colour at `pct`% opacity (any colour string, including the tokens above). */
export function tint(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/** Improv heatmap verdict colours. */
export const VERDICT_COLOR = {
  "chord-tone": wash.blue,
  tension: wash.mustard,
  avoid: pen.red,
  outside: ink.faint,
} as const;

export const CATEGORY_WASH: Record<MoveCategory, string> = {
  functional: wash.mustard,
  "dominant-sub": wash.blue,
  gospel: wash.brick,
  voicing: wash.sage,
  chromatic: wash.mustard,
  modal: wash.sage,
  symmetric: wash.blue,
};

export const CATEGORY_LABEL: Record<MoveCategory, string> = {
  functional: "Functional",
  "dominant-sub": "Dominant sub",
  gospel: "Gospel",
  voicing: "Voicing",
  chromatic: "Chromatic",
  modal: "Modal",
  symmetric: "Symmetric",
};

export const LEVELS = [
  { level: 0, label: "Original" },
  { level: 1, label: "Functional" },
  { level: 2, label: "Bebop" },
  { level: 3, label: "Gospel" },
  { level: 4, label: "Modern" },
] as const;

/** Stable seed from a string, so a sketch doesn't re-jitter on every render. */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (Math.abs(h) % 100000) + 1;
}
