import { describe, expect, it } from "vitest";
import { chordChromas, chordTones, guideTones } from "../src/chords";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES, canonicalMove, canonicalTune } from "../src/index";
import { basicsLesson, CONCEPTS, hasRuleLesson, isBasicsId, lessonForMove, parseSymbol, type Lesson } from "../src/learn";
import type {
  BackdoorLearn,
  BorrowedIvLearn,
  ColtraneLearn,
  ConstantStructureLearn,
  FlatSixFlatSevenLearn,
  GospelTurnaroundLearn,
  MediantDominantLearn,
  MinorLineClicheLearn,
  OneNoteOnTopLearn,
  PassingDiminishedLearn,
  SecondaryDominantLearn,
  SecondaryTwoFiveLearn,
  TritoneSubLearn,
} from "../src/learn/facts";
import { passingDiminished } from "../src/rulesAdvanced";
import { degreeWord } from "../src/learn/lesson";
import { chroma, mod, prettyNote, transpose } from "../src/pitch";
import { RULES } from "../src/ruleset";
import { KEYS, transposeTune } from "../src/transpose";
import type { Quality, ReharmMove } from "../src/types";

/*
 * Predict, then reveal: an ask must have exactly one right answer set. A prompt like "Which key
 * of Gm9 stays for C7(♭9)?" also allows G (Gm9's root is C7's 5th), and a beginner who taps it is
 * told they're wrong. So, for every ask in every lesson in 12 keys, the set the prompt describes
 * is worked out here, independently of the lesson, from the chords themselves, and it must equal
 * the answer: no other key satisfies the prompt. A new ask fails until it is audited here.
 */

const shape = (root: string, quality: Quality, extensions: string[] = [], alterations: string[] = []) => ({ root, quality, extensions, alterations });
const pcs = (notes: Iterable<string>) => [...new Set([...notes].map((n) => chroma(n)))].sort((a, b) => a - b);
const sorted = (xs: Iterable<number>) => [...new Set(xs)].sort((a, b) => a - b);
const guide = (c: Parameters<typeof guideTones>[0]) => guideTones(c).map((t) => t.note);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** What the ask's prompt allows, as pitch classes, computed from the chords (not from the lesson). */
type Allowed = (lesson: Lesson, ctx: { tonic?: string; learn?: unknown; move?: ReharmMove }) => number[];

const RULE_ASKS: Record<string, Allowed> = {
  // "G♭9 keeps C7's guide tones. Tap them."
  "dominant.tritoneSub": (_l, { learn }) => {
    const f = learn as TritoneSubLearn;
    const keep = pcs(guide(shape(f.originalRoot, "7")));
    // and the claim holds: the sub (a 9th chord) really has both
    const sub = chordChromas(shape(f.subRoot, "7", ["9"]));
    for (const pc of keep) expect(sub.has(pc)).toBe(true);
    return keep;
  },
  // "Tap the 3rd and 7th of D7."
  "functional.secondaryDominant": (_l, { learn }) => pcs(guide(shape((learn as SecondaryDominantLearn).root, "7"))),
  // "Which of Gm9's guide tones stays for C7(♭9)?": the ii's guide tones that are also in the V
  "functional.secondaryTwoFive": (l, { learn }) => {
    const f = learn as SecondaryTwoFiveLearn;
    expect(l.steps.find((s) => s.ask)!.ask!.prompt).toMatch(/guide tones/);
    const V = chordChromas(shape(f.VRoot, "7", [], ["b9"]));
    return pcs(guide(shape(f.iiRoot, f.targetMinor ? "m7b5" : "m7"))).filter((pc) => V.has(pc));
  },
  // "Lower Fmaj7's 3rd a half step. Tap the new key."
  "modal.borrowedIv": (_l, { learn }) => {
    const f = learn as BorrowedIvLearn;
    const third = chroma(transpose(f.root, "3"));
    return [mod(third - 1, 12)];
  },
  // "Which key of B♭9 is already Cmaj7's root?"
  "modal.backdoorTwoFive": (_l, { learn }) => {
    const f = learn as BackdoorLearn;
    const bVII = chordChromas(shape(f.bVIIRoot, "7", ["9"]));
    return [chroma(f.targetRoot)].filter((pc) => bVII.has(pc));
  },
  // "Each key gets its own V7. Tap the root a fifth above A♭.": A♭ is the first key centre, and its V7 is in the tour
  "symmetric.coltraneSubstitution": (l, { learn, move }) => {
    const f = learn as ColtraneLearn;
    expect(l.steps.find((s) => s.ask)!.ask!.prompt).toContain(`above ${prettyNote(f.centres[0])}.`);
    const fifthAbove = mod(chroma(f.centres[0]) + 7, 12);
    expect(move!.chords.some((c) => c.quality === "7" && chroma(c.root) === fifthAbove)).toBe(true);
    return [fifthAbove];
  },
  // "Move the whole shape up a half step. Tap D♭maj7." (every key of it), or, for a shape of 5+ keys, "Tap the 3rd and 7th of E♭7(♭9)."
  "chromatic.constantStructure": (l, { learn, move }) => {
    const f = learn as ConstantStructureLearn;
    const approach = move!.chords[move!.chords.length - 1];
    expect(chroma(approach.root)).toBe(mod(chroma(f.targetRoot) + 1, 12));
    const whole = !/3rd and 7th/.test(l.steps.find((s) => s.ask)!.ask!.prompt);
    return whole ? pcs(chordTones(approach).map((t) => t.note)) : pcs(guide(approach));
  },
  // "G is the ♯11 of one walk chord. Tap its bass.": the walk basses that sit that far under the held note
  "melody.oneNoteOnTop": (l, { learn, move }) => {
    const f = learn as OneNoteOnTopLearn;
    const prompt = l.steps.find((s) => s.ask)!.ask!.prompt;
    const word = (d: string) => (d === "7" ? "major 7th" : d === "b3" ? "minor 3rd" : degreeWord(d));
    const role = Object.keys(DEGREE_SEMIS).find((d) => prompt.includes(` the ${word(d)} of one`))!;
    expect(role, prompt).toBeDefined();
    const walk = move!.chords.slice(1);
    return walk.map((c) => chroma(c.root)).filter((b) => mod(chroma(f.heldNote) - b, 12) === DEGREE_SEMIS[role]);
  },
  // "Keep those four keys. Tap the bass a major 3rd above C.": III7(♭9)'s root, and the claim holds (same four keys on top)
  "dominant.mediantDominant": (_l, { learn, move }) => {
    const f = learn as MediantDominantLearn;
    const sub = move!.chords[0];
    const upper = (c: Parameters<typeof chordTones>[0]) => pcs(chordTones(c).filter((t) => t.degree !== "1").map((t) => t.note));
    expect(upper(sub)).toEqual(upper({ ...move!.original[0], extensions: [], alterations: ["b9"] }));
    return [mod(chroma(f.targetRoot) + 4, 12)];
  },
  // "Which keys of D♭13(♯11) stay put into Cmaj13?": the approach's keys that the landing also has
  "gospel.halfStepTurnaround": (_l, { learn, move }) => {
    const f = learn as GospelTurnaroundLearn;
    const landing = chordChromas(parseSymbol(f.landing)!);
    return pcs(chordTones(move!.chords[1]).map((t) => t.note)).filter((pc) => landing.has(pc));
  },
  // up: "C♯dim7 is a dominant without its root. Tap that root: the V of Dm7." (and it is: V7(♭9) less its root);
  // down: "Tap the two keys E♭dim7 shares with Dm7."
  "chromatic.passingDiminished": (_l, { learn, move }) => {
    const f = learn as PassingDiminishedLearn;
    const dim = pcs(chordTones(move!.chords[1]).map((t) => t.note));
    if (f.ascending) {
      const V = transpose(f.targetRoot, "5");
      expect(dim).toEqual(pcs(chordTones(shape(V, "7", [], ["b9"])).filter((t) => t.degree !== "1").map((t) => t.note)));
      return [chroma(V)];
    }
    const target = chordChromas(parseSymbol(f.target)!);
    return dim.filter((pc) => target.has(pc));
  },
  // "Which two keys of Cdim7 rise a half step into Cmaj7?": °7 keys not in the chord whose half step up is
  "chromatic.commonToneDiminished": (_l, { move }) => {
    const [dim, chord] = move!.chords;
    const has = chordChromas(chord);
    return pcs(chordTones(dim).map((t) => t.note)).filter((pc) => !has.has(pc) && has.has(mod(pc + 1, 12)));
  },
  // "Start on C. Tap the next three keys down by half steps."
  "chromatic.minorLineCliche": (_l, { learn }) => {
    const r = chroma((learn as MinorLineClicheLearn).root);
    return [1, 2, 3].map((s) => mod(r - s, 12));
  },
  // "One key of Dm9 moves to make G13. Tap where it goes.": the rootless V13 (♭7, 9, 3, 13) keys the rootless ii9 (♭3, 5, ♭7, 9) lacks
  "voicing.rootlessTwoFiveOne": (_l, { move }) => {
    const [ii, V] = move!.chords;
    const grip = (root: string, ds: string[]) => pcs(ds.map((d) => transpose(root, d)));
    const iiKeys = grip(ii.root, ["b3", "5", "b7", "9"]);
    return grip(V.root, ["b7", "9", "3", "13"]).filter((pc) => !iiKeys.includes(pc));
  },
  // "Tap the major triad a major 3rd below G.": the dominant's root is the move's own chord
  "voicing.upperStructureBVI": (l, { move }) => {
    const r = move!.chords[0].root;
    expect(l.steps.find((s) => s.ask)!.ask!.prompt).toContain(`below ${prettyNote(r)}.`);
    return pcs(chordTones(shape(transpose(r, "b6"), "maj")).map((t) => t.note));
  },
  // "Tap the major triad a whole step above G."
  "voicing.upperStructureII": (l, { move }) => {
    const r = move!.chords[0].root;
    expect(l.steps.find((s) => s.ask)!.ask!.prompt).toContain(`above ${prettyNote(r)}.`);
    return pcs(chordTones(shape(transpose(r, "2"), "maj")).map((t) => t.note));
  },
  // "Tap the bass line into C.": the move's roots, then the target's
  "modal.flatSixFlatSeven": (_l, { learn, move }) => pcs([...move!.chords.map((c) => c.root), (learn as FlatSixFlatSevenLearn).targetRoot]),
};

/** Semitones above the root for each degree a held top note can take (independent of the rule's tables). */
const DEGREE_SEMIS: Record<string, number> = { "1": 0, b3: 3, b9: 1, "9": 2, "#9": 3, "3": 4, "4": 5, "#11": 6, "5": 7, b13: 8, "13": 9, b7: 10, "7": 11 };

const BASICS_ASKS: Record<string, Allowed> = {
  // "Make it Gm7: lower one key. Tap the new 3rd."
  "basics:sevenths": (_l, { tonic }) => [chroma(transpose(transpose(tonic!, "5"), "b3"))],
  // "V is the chord on step 5. Tap its root."
  "basics:numerals": (_l, { tonic }) => [chroma(transpose(tonic!, "5"))],
  // "Tap the key a tritone above G♭."
  "basics:tritone": (_l, { tonic }) => [chroma(tonic!)],
  // "Tap G7's guide tones: the 3rd and 7th."
  "basics:guideTones": (_l, { tonic }) => pcs(guide(shape(transpose(tonic!, "5"), "7"))),
  // "F falls a half step into Cmaj7. Tap where it lands.": a chord tone a half step under the 7th
  "basics:dominantResolution": (_l, { tonic }) => {
    const [, g7] = guide(shape(transpose(tonic!, "5"), "7"));
    const I = chordChromas(shape(tonic!, "maj7"));
    return [mod(chroma(g7) - 1, 12)].filter((pc) => I.has(pc));
  },
  // "Which of Dm7's guide tones stays for G7?"
  "basics:twoFiveOne": (l, { tonic }) => {
    expect(l.steps.find((s) => s.ask)!.ask!.prompt).toMatch(/guide tones/);
    const V = chordChromas(shape(transpose(tonic!, "5"), "7"));
    return pcs(guide(shape(transpose(tonic!, "2"), "m7"))).filter((pc) => V.has(pc));
  },
  // "Tap the ♭9 and the ♭13 of G7."
  "basics:extensions": (_l, { tonic }) => pcs(["b9", "b13"].map((d) => transpose(transpose(tonic!, "5"), d))),
  // "Which key of Fm6 isn't in C major?"
  "basics:parallelMinor": (_l, { tonic }) => {
    const scale = new Set(MAJOR.map((s) => mod(chroma(tonic!) + s, 12)));
    return sorted([...chordChromas(shape(transpose(tonic!, "4"), "m6"))].filter((pc) => !scale.has(pc)));
  },
  // "Put G under Bdim7. Which key is G7's ♭9?"
  "basics:dim7": (_l, { tonic }) => [chroma(transpose(transpose(tonic!, "5"), "b9"))],
  // "Tap the key a major 3rd above A♭."
  "basics:symmetricOctave": (_l, { tonic }) => [chroma(tonic!)],
};

/** The wording each computation above reads: a reworded prompt has to be re-audited. */
const PROMPTS: Record<string, RegExp> = {
  "dominant.tritoneSub": /^\S+ keeps \S+'s guide tones\. Tap them\.$/,
  "functional.secondaryDominant": /^Tap the 3rd and 7th of \S+\.$/,
  "functional.secondaryTwoFive": /^Which of \S+'s guide tones stays for \S+\? Tap it\.$/,
  "modal.borrowedIv": /^Lower \S+'s 3rd a half step\. Tap the new key\.$/,
  "modal.backdoorTwoFive": /^Which key of \S+ is already \S+'s root\? Tap it\.$/,
  "symmetric.coltraneSubstitution": /^Each key gets its own V7\. Tap the root a fifth above \S+\.$/,
  "chromatic.constantStructure": /^Move the whole shape up a half step\. Tap (the 3rd and 7th of )?\S+\.$/,
  "melody.oneNoteOnTop": /^\S+ is the \S+( \S+)? of one walk chord\. Tap its bass\.$/,
  "dominant.mediantDominant": /^Keep those four keys\. Tap the bass a major 3rd above \S+\.$/,
  "gospel.halfStepTurnaround": /^(Which keys of \S+ stay put into \S+\? Tap them|Which key of \S+ stays put into \S+\? Tap it)\.$/,
  "chromatic.passingDiminished": /^(\S+ is a dominant without its root\. Tap that root: the V of \S+|Tap the (key|two keys|three keys) \S+ shares with \S+)\.$/,
  "chromatic.commonToneDiminished": /^Which two keys of \S+ rise a half step into \S+\? Tap them\.$/,
  "chromatic.minorLineCliche": /^Start on \S+\. Tap the next three keys down by half steps\.$/,
  "voicing.rootlessTwoFiveOne": /^One key of \S+ moves to make \S+\. Tap where it goes\.$/,
  "voicing.upperStructureBVI": /^Tap the major triad a major 3rd below \S+\.$/,
  "voicing.upperStructureII": /^Tap the major triad a whole step above \S+\.$/,
  "modal.flatSixFlatSeven": /^Tap the bass line into \S+\.$/,
  "basics:sevenths": /^Make it \S+: lower one key\. Tap the new 3rd\.$/,
  "basics:numerals": /^V is the chord on step 5\. Tap its root\.$/,
  "basics:tritone": /^Tap the key a tritone above \S+\.$/,
  "basics:guideTones": /^Tap \S+'s guide tones: the 3rd and 7th\.$/,
  "basics:dominantResolution": /^\S+ falls a half step into \S+\. Tap where it lands\.$/,
  "basics:twoFiveOne": /^Which of \S+'s guide tones stays for \S+\? Tap it\.$/,
  "basics:extensions": /^Tap the ♭9 and the ♭13 of \S+\.$/,
  "basics:parallelMinor": /^Which key of \S+ isn't in \S+ major\? Tap it\.$/,
  "basics:dim7": /^Put \S+ under \S+\. Which key is \S+'s ♭9\? Tap it\.$/,
  "basics:symmetricOctave": /^Tap the key a major 3rd above \S+\.$/,
};

const ruleLessons = [
  ...[...BUNDLED_TUNES, someday].flatMap((t) =>
    KEYS.flatMap((k) => generateMoves(transposeTune(t, k)).accepted.map((m) => ({ where: `${t.id} in ${k}: ${m.id}`, m }))),
  ),
  // and every rule on its canonical progression (Coach's Learn stage), in 12 keys
  ...RULES.flatMap((r) => KEYS.flatMap((k) => canonicalMove(r.id, k) ?? []).map((m) => ({ where: `canonical ${m.ruleId} in ${m.id}`, m }))),
  // the descending passing °7 (iii → ♭iii°7 → ii, and into a major and a dominant ii), which no canonical chart reaches
  ...KEYS.flatMap((k) =>
    (["m7", "maj7", "7"] as const).flatMap((q) => {
      const up = canonicalTune("chromatic.passingDiminished", k)!;
      const ii = up.harmony[1];
      const tune = { ...up, harmony: [{ ...up.harmony[0], root: transpose(ii.root, "2"), quality: "m7" as const }, { ...ii, quality: q }] };
      return generateMoves(tune, [passingDiminished]).accepted.map((m) => ({ where: `down into ${ii.root}${q} in ${k}`, m }));
    }),
  ),
]
  .filter(({ m }) => hasRuleLesson(m.ruleId))
  .map(({ where, m }) => ({ where, lesson: lessonForMove(m)!, ctx: { learn: (m.facts as { learn?: unknown }).learn, move: m } }));
const basicsLessons = CONCEPTS.map((c) => c.id)
  .filter(isBasicsId)
  .flatMap((id) => KEYS.map((k) => ({ where: `${id} in ${k}`, lesson: basicsLesson(id, k)!, ctx: { tonic: k } })));

describe("every ask has exactly one right answer set", () => {
  it("covers every rule lesson and every basics lesson", () => {
    for (const id of Object.keys(RULE_ASKS)) expect(ruleLessons.some((r) => r.lesson.conceptId === id), id).toBe(true);
    expect(basicsLessons.length).toBe(Object.keys(BASICS_ASKS).length * 12);
  });

  it("in 12 keys, the keys the prompt allows are exactly the answer, and all of them are lit on the reveal", () => {
    for (const { where, lesson, ctx } of [...ruleLessons, ...basicsLessons]) {
      const step = lesson.steps.find((s) => s.ask);
      if (!step) continue;
      const allowed = (RULE_ASKS[lesson.conceptId] ?? BASICS_ASKS[lesson.conceptId]) as Allowed | undefined;
      expect(allowed, `${where}: an ask nobody has audited ("${step.ask!.prompt}")`).toBeDefined();
      expect(step.ask!.prompt, `${where}: reworded, re-audit its allowed set`).toMatch(PROMPTS[lesson.conceptId]);
      const answer = pcs(step.ask!.answer);
      expect(sorted(allowed!(lesson, ctx)), `${where}: "${step.ask!.prompt}"`).toEqual(answer);
      // the reveal lights the answer: every answer key is one of the step's own lit keys
      const lit = new Set(step.highlight.map((h) => chroma(h.note)));
      for (const pc of answer) expect(lit.has(pc), `${where}: answer key ${pc} isn't lit in "${step.text}"`).toBe(true);
    }
  });

  it("the diminished and chromatic asks (5c), worded as audited, in C", () => {
    const ask = (id: string) => lessonForMove(canonicalMove(id, "C")!)!.steps.find((s) => s.ask)!.ask!;
    expect(ask("dominant.mediantDominant")).toEqual({ kind: "tapNotes", prompt: "Keep those four keys. Tap the bass a major 3rd above C.", answer: ["E"] });
    expect(ask("gospel.halfStepTurnaround")).toEqual({ kind: "tapNotes", prompt: "Which keys of D♭13(♯11) stay put into Cmaj13? Tap them.", answer: ["Cb", "G"] });
    expect(ask("chromatic.passingDiminished")).toEqual({ kind: "tapNotes", prompt: "C♯dim7 is a dominant without its root. Tap that root: the V of Dm7.", answer: ["A"] });
    expect(ask("chromatic.commonToneDiminished")).toEqual({ kind: "tapNotes", prompt: "Which two keys of Cdim7 rise a half step into Cmaj7? Tap them.", answer: ["D#", "F#"] });
    expect(ask("chromatic.minorLineCliche")).toEqual({ kind: "tapNotes", prompt: "Start on C. Tap the next three keys down by half steps.", answer: ["B", "Bb", "A"] });
    // the falling °7 asks what it shares, never calls itself a dominant
    const down = ruleLessons.find((r) => r.where === "down into Dm7 in C")!.lesson;
    expect(down.steps.find((s) => s.ask)!.ask).toEqual({ kind: "tapNotes", prompt: "Tap the two keys E♭dim7 shares with Dm7.", answer: ["A", "C"] });
    expect(ruleLessons.filter((r) => r.where.startsWith("down into")).length).toBe(36);
  });

  it("the voicing and borrowed-chord asks (5d), worded as audited, in C", () => {
    const ask = (id: string) => lessonForMove(canonicalMove(id, "C")!)!.steps.find((s) => s.ask)!.ask!;
    expect(ask("voicing.rootlessTwoFiveOne")).toEqual({ kind: "tapNotes", prompt: "One key of Dm9 moves to make G13. Tap where it goes.", answer: ["B"] });
    expect(ask("voicing.upperStructureBVI")).toEqual({ kind: "tapNotes", prompt: "Tap the major triad a major 3rd below G.", answer: ["Eb", "G", "Bb"] });
    expect(ask("voicing.upperStructureII")).toEqual({ kind: "tapNotes", prompt: "Tap the major triad a whole step above G.", answer: ["A", "C#", "E"] });
    expect(ask("modal.flatSixFlatSeven")).toEqual({ kind: "tapNotes", prompt: "Tap the bass line into C.", answer: ["Ab", "Bb", "C"] });
  });

  it("the reference ii–V asks about guide tones, so G (Gm9's root, C7's 5th) is not a right answer it rejects", () => {
    const l = ruleLessons.find((r) => r.where.startsWith("coop-blues in F: functional.secondaryTwoFive"))!.lesson;
    const ask = l.steps.find((s) => s.ask)!.ask!;
    expect(ask.prompt).toBe("Which of Gm9's guide tones stays for C7(♭9)? Tap it.");
    expect(ask.answer.map((n) => chroma(n))).toEqual([chroma("Bb")]);
    const t = ruleLessons.find((r) => r.where.startsWith("coop-blues in F: dominant.tritoneSub@10"))!.lesson;
    expect(t.steps.find((s) => s.ask)!.ask!.prompt).toBe("G♭9 keeps C7's guide tones. Tap them.");
  });
});
