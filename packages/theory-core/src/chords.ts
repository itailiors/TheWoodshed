import { chroma, mod, transpose } from "./pitch";
import type { ChordEvent, PitchName, Quality } from "./types";

export const QUALITY_FORMULA: Record<Quality, string[]> = {
  maj7: ["1", "3", "5", "7"],
  "6": ["1", "3", "5", "6"],
  "7": ["1", "3", "5", "b7"],
  m7: ["1", "b3", "5", "b7"],
  m6: ["1", "b3", "5", "6"],
  mMaj7: ["1", "b3", "5", "7"],
  m7b5: ["1", "b3", "b5", "b7"],
  dim7: ["1", "b3", "b5", "bb7"],
  "7sus4": ["1", "4", "5", "b7"],
  aug: ["1", "3", "#5"],
  "maj7#5": ["1", "3", "#5", "7"],
};

export const QUALITIES = Object.keys(QUALITY_FORMULA) as Quality[];

const QUALITY_TEXT: Record<Quality, string> = {
  maj7: "maj7",
  "6": "6",
  "7": "7",
  m7: "m7",
  m6: "m6",
  mMaj7: "m(maj7)",
  m7b5: "m7b5",
  dim7: "dim7",
  "7sus4": "7sus4",
  aug: "+",
  "maj7#5": "maj7(#5)",
};

/** An alteration replaces its natural neighbour (a #5 chord has no natural 5). */
export const ALTERATION_EXCLUDES: Record<string, string> = {
  "#5": "5",
  b5: "5",
  b13: "5",
  b9: "9",
  "#9": "9",
};

export interface ChordTone {
  degree: string;
  note: PitchName;
}

type ChordShape = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations">;

export function chordDegrees(c: Omit<ChordShape, "root">): string[] {
  const removed = new Set(c.alterations.map((a) => ALTERATION_EXCLUDES[a]).filter(Boolean));
  const all = [...QUALITY_FORMULA[c.quality], ...c.extensions, ...c.alterations];
  return [...new Set(all)].filter((d) => !removed.has(d));
}

export function chordTones(c: ChordShape): ChordTone[] {
  return chordDegrees(c).map((degree) => ({ degree, note: transpose(c.root, degree) }));
}

export const chordChromas = (c: ChordShape) => new Set(chordTones(c).map((t) => chroma(t.note)));

/** 3rd (or sus 4th) followed by the 7th: the two notes that define the chord. */
export function guideTones(c: ChordShape): ChordTone[] {
  const tones = chordTones(c);
  const third = tones.find((t) => ["3", "b3"].includes(t.degree)) ?? tones.find((t) => t.degree === "4");
  const seventh = tones.find((t) => ["7", "b7", "bb7", "6"].includes(t.degree));
  return [third, seventh].filter((t): t is ChordTone => !!t);
}

export const isDominant = (q: Quality) => q === "7" || q === "7sus4";
export const isMajorQ = (q: Quality) => q === "maj7" || q === "6" || q === "maj7#5";
export const isMinorQ = (q: Quality) => q === "m7" || q === "m6" || q === "mMaj7";

export const resolvesDownFifth = (a: { root: string }, b: { root: string }) =>
  mod(chroma(a.root) - chroma(b.root), 12) === 7;

export function symbol(c: Omit<ChordShape, never> & { display?: string; bass?: string }): string {
  if (c.display) return c.display;
  let base = QUALITY_TEXT[c.quality];
  const highest = ["13", "11", "9"].find((e) => c.extensions.includes(e));
  if (highest && (c.quality === "maj7" || c.quality === "7" || c.quality === "m7")) {
    base = base.replace(/7$/, highest);
  }
  const alts = c.alterations.length ? `(${c.alterations.join(",")})` : "";
  return `${c.root}${base}${alts}${c.bass ? "/" + c.bass : ""}`;
}
