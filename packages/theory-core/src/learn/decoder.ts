import { chordTones, guideTones, symbol } from "../chords";
import { prettyNote, prettySymbol, simplifyNote } from "../pitch";
import type { ChordEvent, Quality } from "../types";

/*
 * The chord-symbol decoder (spec §D): tap "G7(♭9)" and it says what each part of the symbol
 * means, with the notes. Nothing is written per chord: a printed symbol is parsed back into the
 * fields `symbol()` prints (root, quality, extensions, alterations, bass), and every note comes
 * from `chordTones()` of that shape. Text is display-ready (♭, ♯).
 */

export type ChordShapeLike = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations"> & { bass?: string };

export interface SymbolPart {
  /** The piece of the symbol this explains, display-spelled ("G", "7", "♭9", "/B♭"). */
  text: string;
  /** What it means, in a few words ("dominant 7th", "flat 9th"). */
  meaning: string;
  /** The notes it adds or names, display-spelled. */
  notes: string[];
}

export interface DecodedSymbol {
  /** The symbol as shown (♭, ♯). */
  symbol: string;
  shape: ChordShapeLike;
  parts: SymbolPart[];
  /** The parts on one line: "G: root · 7: dominant 7th (B, F) · ♭9: A♭". */
  line: string;
}

/**
 * How each quality is printed (after `symbol()` folds the highest extension into maj7/7/m7),
 * longest first so "maj7" wins over "m" and "m7♭5" over "m7". `ext` are the extensions the
 * token implies: jazz reads "13" as a dominant 7th with the 9th and 13th.
 */
type Base = { text: string; quality: Quality; ext: string[] };
const BASES: readonly Base[] = ([
  { text: "m(maj7)", quality: "mMaj7", ext: [] },
  { text: "m(add9)", quality: "m", ext: ["9"] },
  { text: "maj7(#5)", quality: "maj7#5", ext: [] },
  { text: "maj13", quality: "maj7", ext: ["9", "13"] },
  { text: "maj9", quality: "maj7", ext: ["9"] },
  { text: "maj7", quality: "maj7", ext: [] },
  { text: "7sus4", quality: "7sus4", ext: [] },
  { text: "m7b5", quality: "m7b5", ext: [] },
  { text: "dim7", quality: "dim7", ext: [] },
  { text: "m6/9", quality: "m6", ext: ["9"] },
  { text: "m13", quality: "m7", ext: ["9", "13"] },
  { text: "m11", quality: "m7", ext: ["9", "11"] },
  { text: "m9", quality: "m7", ext: ["9"] },
  { text: "m7", quality: "m7", ext: [] },
  { text: "m6", quality: "m6", ext: [] },
  { text: "6/9", quality: "6", ext: ["9"] },
  { text: "add9", quality: "maj", ext: ["9"] },
  { text: "13", quality: "7", ext: ["9", "13"] },
  { text: "11", quality: "7", ext: ["9", "11"] },
  { text: "9", quality: "7", ext: ["9"] },
  { text: "7", quality: "7", ext: [] },
  { text: "6", quality: "6", ext: [] },
  { text: "+", quality: "aug", ext: [] },
  { text: "m", quality: "m", ext: [] },
  { text: "", quality: "maj", ext: [] },
] satisfies Base[]).sort((a, b) => b.text.length - a.text.length);

const ALTERATIONS = ["b13", "#11", "b9", "#9", "#5", "b5"] as const;

/** What a quality is, and which of its degrees the decoder names (beyond the root). */
const QUALITY_WORDS: Record<Quality, { meaning: string; degrees: string[] }> = {
  maj: { meaning: "major triad", degrees: ["3", "5"] },
  m: { meaning: "minor triad", degrees: ["b3", "5"] },
  maj7: { meaning: "major 7th", degrees: [] },
  "6": { meaning: "major 6th chord", degrees: [] },
  "7": { meaning: "dominant 7th", degrees: [] },
  m7: { meaning: "minor 7th", degrees: [] },
  m6: { meaning: "minor 6th chord", degrees: [] },
  mMaj7: { meaning: "minor with a major 7th", degrees: [] },
  m7b5: { meaning: "half-diminished: minor 3rd, ♭5, ♭7", degrees: ["b3", "b5", "b7"] },
  dim7: { meaning: "diminished 7th: stacked minor 3rds", degrees: ["b3", "b5", "bb7"] },
  "7sus4": { meaning: "sus: the 4th replaces the 3rd, with the ♭7", degrees: [] },
  aug: { meaning: "augmented: the 5th raised", degrees: ["3", "#5"] },
  "maj7#5": { meaning: "major 7th with a raised 5th", degrees: ["3", "#5", "7"] },
};

const EXT_WORD: Record<string, string> = { "9": "9th", "11": "11th", "13": "13th" };
const ALT_WORD: Record<string, string> = {
  b9: "flat 9th",
  "#9": "sharp 9th",
  "#11": "sharp 11th",
  b13: "flat 13th",
  "#5": "raised 5th",
  b5: "flat 5th",
};

const ascii = (s: string) => s.replace(/♭/g, "b").replace(/♯/g, "#").replace(/°7?/g, "dim7").replace(/ø7?/g, "m7b5");
/** A note as a reader takes it in: ♭/♯, and a double flat or sharp as its everyday key (B♭♭ → A). */
const show = (n: string) => prettyNote(/(bb|##|x)$/.test(n) ? simplifyNote(n) : n);
const list = (xs: string[]) => xs.join(", ");

/**
 * Parse a printed chord symbol ("G7(♭9)", "Dm7b5", "C13(♯11)", "E♭/F", "B♭6/9") back into its
 * shape. Null for anything that isn't exactly a chord symbol (a bare note name parses as a
 * major triad, so callers decide whether a lone letter counts).
 */
export function parseSymbol(text: string): ChordShapeLike | null {
  return parse(text)?.shape ?? null;
}

function parse(text: string): { shape: ChordShapeLike; base: string } | null {
  const s = ascii(text.trim());
  const rootM = /^[A-G](?:bb|##|b|#)?/.exec(s);
  if (!rootM) return null;
  let rest = s.slice(rootM[0].length);
  const base = BASES.find((b) => rest.startsWith(b.text))!;
  rest = rest.slice(base.text.length);

  const alterations: string[] = [];
  const takeAlts = (src: string): string | null => {
    let r = src;
    while (r) {
      const a = ALTERATIONS.find((x) => r.startsWith(x));
      if (!a) break;
      if (!alterations.includes(a)) alterations.push(a);
      r = r.slice(a.length).replace(/^,/, "");
    }
    return r;
  };
  const paren = /^\(([^)]*)\)/.exec(rest);
  if (paren) {
    if (takeAlts(paren[1]) !== "") return null;
    rest = rest.slice(paren[0].length);
  } else rest = takeAlts(rest) ?? rest;

  let bass: string | undefined;
  const slash = /^\/([A-G](?:bb|##|b|#)?)$/.exec(rest);
  if (slash) {
    bass = slash[1];
    rest = "";
  }
  if (rest !== "") return null;
  return { shape: { root: rootM[0], quality: base.quality, extensions: base.ext, alterations, ...(bass ? { bass } : {}) }, base: base.text };
}

/** The token of a symbol that names the quality (and folded extensions), as `symbol()` prints it. */
const baseText = (shape: ChordShapeLike) => ascii(symbol({ root: shape.root, quality: shape.quality, extensions: shape.extensions, alterations: [] })).slice(shape.root.length);

/**
 * Explain a chord symbol part by part, from its own shape: the root, the quality (with its guide
 * tones, or the notes that define it), the extensions, each alteration, and a bass note.
 * `shown`/`baseShown`: the symbol and its quality token as printed, when decoding printed text.
 */
export function decodeShape(shape: ChordShapeLike, shown?: string, baseShown?: string): DecodedSymbol {
  const tones = chordTones(shape);
  const note = (d: string) => tones.find((t) => t.degree === d)?.note;
  const notesOf = (ds: string[]) => ds.map(note).filter((n): n is string => !!n).map(show);
  const parts: SymbolPart[] = [];
  const root = show(shape.root);
  const q = QUALITY_WORDS[shape.quality];
  const base = baseShown ?? baseText(shape);

  if (base === "" || (shape.quality === "maj" && base === "add9")) {
    // a plain letter is a major triad: the root says so
    parts.push({ text: root, meaning: `root of the ${q.meaning}`, notes: [root, ...notesOf(q.degrees)] });
  } else {
    parts.push({ text: root, meaning: "root", notes: [root] });
  }
  const ext = shape.extensions.filter((e) => EXT_WORD[e]);
  if (base !== "" && !(shape.quality === "maj" && base === "add9")) {
    const defining = q.degrees.length ? notesOf(q.degrees) : guideTones(shape).map((t) => show(t.note));
    const extLine = ext.length ? `, with the ${ext.map((e) => EXT_WORD[e]).join(" and ")} on top (${list(notesOf(ext))})` : "";
    parts.push({ text: prettySymbol(`C${base}`).slice(1), meaning: `${q.meaning} (${list(defining)})${extLine}`, notes: [...defining, ...notesOf(ext)] });
  } else if (ext.length) {
    parts.push({ text: "add9", meaning: "added 9th", notes: notesOf(ext) });
  }
  for (const a of shape.alterations) {
    const n = note(a);
    parts.push({ text: prettyNote(a), meaning: ALT_WORD[a] ?? prettyNote(a), notes: n ? [show(n)] : [] });
  }
  if (shape.bass) {
    const b = show(shape.bass);
    parts.push({ text: `/${b}`, meaning: base === "" ? `${root} triad over ${b} in the bass` : `${b} in the bass`, notes: [b] });
  }

  const line = parts
    .map((p) => {
      const named = p.notes.length && !(p.notes.length === 1 && p.notes[0] === p.text.replace(/^\//, "")) ? ` (${list(p.notes)})` : "";
      // a part whose meaning already lists its notes doesn't repeat them
      return `${p.text}: ${p.meaning}${p.meaning.includes("(") ? "" : named}`;
    })
    .join(" · ");
  return { symbol: shown ?? prettySymbol(symbol(shape)), shape, parts, line };
}

/** Decode a printed symbol; null when the text isn't a chord symbol. */
export function decodeSymbol(text: string): DecodedSymbol | null {
  const p = parse(text);
  return p ? decodeShape(p.shape, prettySymbol(ascii(text.trim())), p.base) : null;
}

/**
 * Decode a chord as the app prints it, so the popover explains exactly the symbol on screen: a
 * display override ("E♭/F") is decoded as printed, and so is `symbol()`'s text.
 */
export function decodeChord(c: ChordShapeLike & { display?: string }): DecodedSymbol {
  return decodeSymbol(symbol(c)) ?? decodeShape(c);
}
