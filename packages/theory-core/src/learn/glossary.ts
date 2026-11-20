/*
 * One short gloss per rule-specific term, for the glossary chips. Chord symbols, ii–V–I, the
 * 3rd and 7th and "dominant" are not here: the reader already owns them. A gloss is at most
 * 8 words; `conceptId` is where "Learn it" goes.
 */

export interface GlossaryEntry {
  term: string;
  gloss: string;
  conceptId?: string;
  /** Other spellings that mean the same term in copy. */
  aliases: string[];
}

const e = (term: string, gloss: string, conceptId?: string, aliases: string[] = []): GlossaryEntry => ({
  term,
  gloss,
  ...(conceptId ? { conceptId } : {}),
  aliases,
});

export const GLOSSARY: readonly GlossaryEntry[] = [
  e("tritone", "Six half steps: exactly half an octave.", "basics:tritone"),
  e("guide tones", "A chord's 3rd and 7th: they define it.", "basics:guideTones", ["guide tone"]),
  e("leading tone", "The note a half step below home.", "basics:dominantResolution"),
  e("tritone sub", "The dominant a tritone away, same guide tones.", "dominant.tritoneSub", ["tritone substitution"]),
  e("secondary dominant", "The V7 of a chord other than I.", "functional.secondaryDominant"),
  e("related ii", "The minor chord a fifth above a dominant.", "functional.secondaryTwoFive"),
  e("tonicize", "Make a chord briefly sound like home.", "functional.secondaryTwoFive"),
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
  e("avoid note", "A note that clashes with the chord.", undefined),
  e("upper structure", "A triad on top that supplies the tensions.", "voicing.upperStructureBVI"),
  e("rootless", "Voiced without the root; the bass has it.", "voicing.rootlessTwoFiveOne"),
  e("shell", "Root, 3rd and 7th only.", "basics:guideTones", ["shells"]),
  e("drop 2", "Second voice from the top dropped an octave.", undefined),
  e("constant structure", "One chord shape moved to new roots.", "chromatic.constantStructure", ["planing"]),
  e("appoggiatura", "A leaning note that resolves by step.", undefined),
  e("enclosure", "Notes above and below a target, then it.", undefined),
  e("the Family", "Four dominants a minor third apart.", "dominant.mediantDominant"),
];

const norm = (s: string) => s.toLowerCase();
const INDEX = new Map(GLOSSARY.flatMap((g) => [g.term, ...g.aliases].map((t) => [norm(t), g] as const)));

/** A term's entry, by its name or an alias, any case. */
export const glossaryEntry = (term: string): GlossaryEntry | undefined => INDEX.get(norm(term));
