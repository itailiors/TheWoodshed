import type { MoveCategory } from "../types";

/*
 * One short gloss per term the UI shows, for the glossary chips: rule-specific terms, the move
 * categories, the level dial's labels and the roman numerals the lessons use. Chord symbols,
 * ii–V–I, the 3rd and 7th and "dominant" are not here: the reader already owns them. A gloss is
 * at most 8 words; `conceptId` is where "Learn it" goes.
 */

export type GlossaryKind = "term" | "category" | "level" | "numeral";

export interface GlossaryEntry {
  term: string;
  gloss: string;
  conceptId?: string;
  /** Other spellings that mean the same term in copy. */
  aliases: string[];
  /** What the entry names; absent means a plain term. Numerals match case-sensitively (ii ≠ II). */
  kind?: Exclude<GlossaryKind, "term">;
}

const e = (term: string, gloss: string, conceptId?: string, aliases: string[] = [], kind?: GlossaryEntry["kind"]): GlossaryEntry => ({
  term,
  gloss,
  ...(conceptId ? { conceptId } : {}),
  aliases,
  ...(kind ? { kind } : {}),
});

/** Move categories, keyed by the engine's `MoveCategory`; `term` is the label the UI prints. */
const CATEGORY: Record<MoveCategory, GlossaryEntry> = {
  functional: e("Functional", "Secondary dominants and ii–Vs: chords pointing ahead.", undefined, [], "category"),
  "dominant-sub": e("Dominant sub", "Another dominant standing in for the V7.", undefined, [], "category"),
  gospel: e("Gospel", "A sus chord, then a half-step slide home.", undefined, [], "category"),
  voicing: e("Voicing", "Same chords, new notes on top.", undefined, [], "category"),
  chromatic: e("Chromatic", "Colour from half steps and passing chords.", undefined, [], "category"),
  modal: e("Modal", "Chords borrowed from the parallel minor.", undefined, [], "category"),
  symmetric: e("Symmetric", "Root motion that splits the octave evenly.", undefined, [], "category"),
};

/** Level-dial labels, keyed `L0`–`L4` (the prefix e2e asserts); the alias is the full dial label. */
const LEVEL: readonly GlossaryEntry[] = [
  e("L0", "Original: the changes as written.", undefined, ["L0 Original"], "level"),
  e("L1", "Inside: moves that stay in the key.", undefined, ["L1 Inside"], "level"),
  e("L2", "Colour: new colour, same harmonic job.", undefined, ["L2 Colour"], "level"),
  e("L3", "Bold: borrowed and redirected arrivals.", undefined, ["L3 Bold"], "level"),
  e("L4", "Out: leaves the key or the voice-leading.", undefined, ["L4 Out"], "level"),
];

export const GLOSSARY: readonly GlossaryEntry[] = [
  e("tritone", "Six half steps: exactly half an octave.", "basics:tritone"),
  e("guide tones", "A chord's 3rd and 7th: they define it.", "basics:guideTones", ["guide tone"]),
  e("leading tone", "The note a half step below home.", "basics:dominantResolution"),
  e("tritone sub", "The dominant a tritone away, same guide tones.", "dominant.tritoneSub", ["tritone substitution"]),
  e("secondary dominant", "The V7 of a chord other than I.", "functional.secondaryDominant"),
  e("related ii", "The minor chord a fifth above a dominant.", "functional.secondaryTwoFive"),
  e("tonicize", "Make a chord briefly sound like home.", "functional.secondaryTwoFive"),
  // Study's card says "ii–V into the I"; Coach files that move under this name (P6 beginner review)
  e("secondary ii–V", "A ii–V into any chord, the I included.", "functional.secondaryTwoFive"),
  e("parallel minor", "The minor key on the same root.", "basics:parallelMinor"),
  e("borrowed", "Taken from the parallel minor key.", "basics:parallelMinor", ["borrow"]),
  e("modal interchange", "Borrowing chords from the parallel minor.", "basics:parallelMinor"),
  e("minor plagal", "IV turning minor on its way to I.", "modal.borrowedIv"),
  e("backdoor", "Reaching I from ♭VII7 instead of V7.", "modal.backdoorTwoFive"),
  e("harmonic minor", "Minor scale with a raised 7th.", undefined),
  e("melodic minor", "Minor scale with a raised 6th and 7th.", undefined),
  e("Phrygian dominant", "Harmonic minor's 5th mode: a dominant with ♭9.", undefined),
  e("Lydian dominant", "Melodic minor's 4th mode: a dominant with ♯11.", undefined),
  e("altered", "Dominant scale with every tension altered.", undefined, ["altered scale"]),
  e("half-diminished", "m7♭5: a minor 7th with a flat 5th.", undefined),
  e("avoid note", "Clashes: a half step above a chord tone.", undefined),
  e("upper structure", "A triad on top that supplies the tensions.", "voicing.upperStructureBVI"),
  e("rootless", "Voiced without the root; the bass has it.", "voicing.rootlessTwoFiveOne"),
  e("Close (rootless)", "No root: 3rd, 7th, colours within an octave.", "voicing.rootlessTwoFiveOne"),
  e("Type A", "Rootless grip with the 3rd on the bottom.", "voicing.rootlessTwoFiveOne"),
  e("Type B", "Rootless grip with the 7th on the bottom.", "voicing.rootlessTwoFiveOne"),
  e("shell", "Root, 3rd and 7th only.", "basics:guideTones", ["shells"]),
  e("drop 2", "Second voice from the top dropped an octave.", undefined),
  e("constant structure", "One chord shape moved to new roots.", "chromatic.constantStructure", ["planing"]),
  e("appoggiatura", "A leaning note that resolves by step.", undefined),
  e("enclosure", "Notes above and below a target, then it.", undefined),
  e("the Family", "Four dominants, minor thirds apart, sharing one °7.", "dominant.mediantDominant"),
  // terms the remaining lessons use (spec §D/§E)
  e("tensions", "Notes above the 7th: 9th, 11th, 13th.", "basics:extensions", ["tension", "extensions"]),
  e("diminished 7th", "Four notes stacked in minor 3rds.", "basics:dim7"),
  e("augmented triad", "Three notes a major 3rd apart.", "basics:symmetricOctave"),
  e("sus", "The 4th replaces the 3rd: no pull yet."),
  e("line cliché", "One voice moving by half steps, chord held.", "chromatic.minorLineCliche"),
  e("dominant 7th", "Major 3rd plus ♭7: wants to resolve.", "basics:sevenths"),
  e("roman numerals", "Chords named by their root's scale step.", "basics:numerals"),
  e("key centre", "The note a passage treats as home.", "basics:symmetricOctave", ["key center"]),
  // the Coach ladder's one rung that needs a word of explanation (spec §D, Coach row)
  e("Self-check", "Reveal, play, grade yourself."),
  // roman numerals the lessons print
  e("V", "The chord built on the key's 5th.", "basics:numerals", [], "numeral"),
  e("♭II", "Chord on the lowered 2nd: tritone-sub root.", "basics:numerals", [], "numeral"),
  e("ii", "Minor chord on the key's 2nd step.", "basics:numerals", [], "numeral"),
  e("♭VII7", "Dominant on the lowered 7th: the backdoor.", "basics:numerals", [], "numeral"),
  e("iv", "Minor chord on the 4th, borrowed from minor.", "basics:numerals", [], "numeral"),
  e("♭VI", "Major chord on the lowered 6th step.", "basics:numerals", [], "numeral"),
  e("III", "Major chord on the key's 3rd step.", "basics:numerals", [], "numeral"),
  ...Object.values(CATEGORY),
  ...LEVEL,
];

const norm = (s: string) => s.toLowerCase();
const keyOf = (g: GlossaryEntry, t: string) => (g.kind === "numeral" ? t : norm(t));
const INDEX = new Map(GLOSSARY.flatMap((g) => [g.term, ...g.aliases].map((t) => [keyOf(g, t), g] as const)));

/** A term's entry, by its name or an alias, any case (numerals: exact case, so `iv` never answers for `IV`). */
export const glossaryEntry = (term: string): GlossaryEntry | undefined => {
  const exact = INDEX.get(term);
  if (exact?.kind === "numeral") return exact;
  const g = INDEX.get(norm(term));
  return g?.kind === "numeral" ? undefined : g;
};

/** The glossary entry for a move category's label. */
export const categoryEntry = (category: MoveCategory): GlossaryEntry => CATEGORY[category];

/** The glossary entry for a level-dial position, 0–4. */
export const levelEntry = (level: number): GlossaryEntry | undefined => LEVEL[level];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where text uses a term: start and length, or null. */
export type TermHit = { at: number; len: number };

/**
 * The first use of a plain term in `text`, as a whole word, any case, with its inflections:
 * "borrows" for "borrow", "tonicized" for "tonicize" (the "d" after an e). The UI's chips and the
 * Deep Dive's glossary both find terms with this, so they always agree.
 */
export function termAt(text: string, form: string): TermHit | null {
  const m = new RegExp(`(?<![\\p{L}])${esc(form)}(?:s|es|d|ed|ing)?(?![\\p{L}])`, "iu").exec(text);
  return m ? { at: m.index, len: m[0].length } : null;
}

/** The first use of a roman numeral in `text`, exact case, standing alone ("V7", "IV" and "♭VII" aren't "V"). */
export function numeralAt(text: string, form: string): TermHit | null {
  const m = new RegExp(`(?<![\\p{L}\\p{N}♭♯])${esc(form)}(?![\\p{L}\\p{N}])`, "u").exec(text);
  return m ? { at: m.index, len: m[0].length } : null;
}
