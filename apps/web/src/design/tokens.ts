import type { MoveCategory } from "@reharm/theory-core";

/** Raw hex for Rough.js (SVG attributes can't read CSS variables). Keep in sync with index.css @theme. */
export const ink = { deep: "#1e2a78", soft: "#3e4c9e", faint: "#8a93c4" } as const;
export const paper = { base: "#f6e9c9", light: "#fbf3df", shade: "#ead7aa" } as const;
export const wash = { blue: "#5b85c2", mustard: "#e3b23c", brick: "#b9532f", sage: "#7e9c6b" } as const;
/** The teacher's red pen: corrections and checkmarks in the practice tools. */
export const pen = { red: "#c2311f" } as const;

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
