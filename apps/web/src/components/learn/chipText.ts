import { GLOSSARY, glossaryEntry, parseSymbol, termAt } from "@reharm/theory-core";

/*
 * Where the chips go in a line of copy (spec §D), as one pure function: glossary terms the
 * caller names, the roman numerals the glossary knows (V, ♭II, ii, ♭VII7, iv), and chord symbols
 * (the decoder chip). Only the first use of each in a view gets a chip: pass the same `seen` set
 * to every line of one view.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "term"; text: string; term: string }
  | { kind: "symbol"; text: string };

export interface ChipOptions {
  /** Glossary terms to chip (a term or an alias, as the copy writes it). */
  terms?: readonly (string | undefined)[];
  /** Chip the glossary's roman numerals. */
  numerals?: boolean;
  /** Chip chord symbols with the decoder. */
  symbols?: boolean;
  /** Terms and symbols already chipped in this view (shared and updated). */
  seen?: Set<string>;
}

type Hit = { start: number; end: number; seg: Exclude<Segment, { kind: "text" }>; key: string };

const NUMERAL_TERMS = GLOSSARY.filter((g) => g.kind === "numeral").map((g) => g.term);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// a numeral stands alone: no letter, digit or accidental on either side ("V7", "IV" and "♭VII" aren't "V")
const NUMERAL_RE = new RegExp(
  `(?<![\\p{L}\\p{N}♭♯])(${[...NUMERAL_TERMS].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![\\p{L}\\p{N}])`,
  "gu",
);
// a chord-symbol candidate: a capital A–G starting a token, up to a space or punctuation that never sits inside a symbol
const SYMBOL_RE = /(?<![\p{L}\p{N}♭♯])[A-G][^\s,;:!?'’→–—"]*/gu;

/** The chord symbol at the start of a candidate token (trailing "." or ")" trimmed), or null. A bare note name isn't one. */
export function symbolIn(token: string): string | null {
  let t = token;
  while (t) {
    const shape = parseSymbol(t);
    // a lone letter ("A", "E♭") is a note or an article, never a chip
    if (shape && t.length > shape.root.replace(/b/g, "♭").replace(/#/g, "♯").length) return t;
    if (!/[.)]$/.test(t)) return null;
    t = t.slice(0, -1);
  }
  return null;
}

/** Split a line into plain text and chips. Pure. */
export function chipSegments(text: string, opts: ChipOptions = {}): Segment[] {
  const seen = opts.seen ?? new Set<string>();
  const hits: Hit[] = [];

  for (const t of opts.terms ?? []) {
    const entry = t ? glossaryEntry(t) : undefined;
    if (!entry) continue;
    for (const form of [t!, entry.term, ...entry.aliases]) {
      const hit = entry.kind === "numeral" ? (text.includes(form) ? { at: text.indexOf(form), len: form.length } : null) : termAt(text, form);
      if (!hit) continue;
      hits.push({ start: hit.at, end: hit.at + hit.len, seg: { kind: "term", text: text.slice(hit.at, hit.at + hit.len), term: entry.term }, key: `term:${entry.term}` });
      break;
    }
  }
  if (opts.numerals)
    for (const m of text.matchAll(NUMERAL_RE)) {
      const n = m[1];
      hits.push({ start: m.index!, end: m.index! + n.length, seg: { kind: "term", text: n, term: n }, key: `term:${n}` });
    }
  if (opts.symbols)
    for (const m of text.matchAll(SYMBOL_RE)) {
      const sym = symbolIn(m[0]);
      if (sym) hits.push({ start: m.index!, end: m.index! + sym.length, seg: { kind: "symbol", text: sym }, key: `sym:${sym}` });
    }

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Segment[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at || seen.has(h.key)) continue;
    seen.add(h.key);
    if (h.start > at) out.push({ kind: "text", text: text.slice(at, h.start) });
    out.push(h.seg);
    at = h.end;
  }
  if (at < text.length) out.push({ kind: "text", text: text.slice(at) });
  return out;
}

/** Every line of one view, split together: a term or symbol is chipped at its first use in the view. Pure. */
export function chipLines(texts: readonly string[], opts: Omit<ChipOptions, "seen"> = {}): Segment[][] {
  const seen = new Set<string>();
  return texts.map((t) => chipSegments(t, { ...opts, seen }));
}

/**
 * The glossary terms each screen chips in its own copy (spec §D's table). Every one must resolve
 * through `glossaryEntry` (chipText.test.ts), so a renamed entry can't leave a chip dead.
 */
export const SCREEN_TERMS = {
  /** Study's Chord by chord: the teaching line under each move option. */
  chordByChord: ["tritone sub", "tritone", "guide tones", "backdoor", "upper structure", "rootless", "shell", "Type A", "Type B", "Lydian dominant", "constant structure", "the Family", "borrowed", "leading tone"],
  voicings: ["guide tones", "rootless", "Close (rootless)", "shells", "drop 2"],
  practice: ["avoid note", "enclosure", "guide tones"],
} as const;

/** The glossary term that names a concept (the first entry that points there), for a chip on that concept's own line. */
export const termForConcept = (conceptId: string): string | undefined => GLOSSARY.find((g) => g.conceptId === conceptId && !g.kind)?.term;

/** The scale names a lesson's "Go deeper" line may print: chipped there (spec §D). */
export const SCALE_TERMS = ["Lydian dominant", "Phrygian dominant", "melodic minor", "harmonic minor", "altered"] as const;

/**
 * A lesson's chips: each step's text with its own `term`, plus roman numerals and chord symbols,
 * first use per step (one step is one screen, so G♭9 in step 3 is chipped even when step 1 named
 * it: P6 beginner review); "Go deeper" is its own section and adds the scale names. Pure.
 */
export function lessonChips(lesson: { steps: readonly { text: string; term?: string }[]; deeper?: string }): { steps: Segment[][]; deeper: Segment[] } {
  const steps = lesson.steps.map((s) => chipSegments(s.text, { terms: [s.term], numerals: true, symbols: true, seen: new Set<string>() }));
  const deeper = lesson.deeper ? chipSegments(lesson.deeper, { terms: SCALE_TERMS, numerals: true, symbols: true }) : [];
  return { steps, deeper };
}
