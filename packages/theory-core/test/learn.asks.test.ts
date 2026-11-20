import { describe, expect, it } from "vitest";
import { chordChromas, guideTones } from "../src/chords";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES } from "../src/index";
import { basicsLesson, CONCEPTS, hasRuleLesson, isBasicsId, lessonForMove, type Lesson } from "../src/learn";
import type { BackdoorLearn, BorrowedIvLearn, SecondaryDominantLearn, SecondaryTwoFiveLearn, TritoneSubLearn } from "../src/learn/facts";
import { chroma, mod, transpose } from "../src/pitch";
import { KEYS, transposeTune } from "../src/transpose";
import type { Quality } from "../src/types";

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
const guide = (c: ReturnType<typeof shape>) => guideTones(c).map((t) => t.note);
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** What the ask's prompt allows, as pitch classes, computed from the chords (not from the lesson). */
type Allowed = (lesson: Lesson, ctx: { tonic?: string; learn?: unknown }) => number[];

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
};

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

const ruleLessons = [...BUNDLED_TUNES, someday].flatMap((t) =>
  KEYS.flatMap((k) =>
    generateMoves(transposeTune(t, k))
      .accepted.filter((m) => hasRuleLesson(m.ruleId))
      .map((m) => ({ where: `${t.id} in ${k}: ${m.id}`, lesson: lessonForMove(m)!, ctx: { learn: (m.facts as { learn?: unknown }).learn } })),
  ),
);
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

  it("the reference ii–V asks about guide tones, so G (Gm9's root, C7's 5th) is not a right answer it rejects", () => {
    const l = ruleLessons.find((r) => r.where.startsWith("coop-blues in F: functional.secondaryTwoFive"))!.lesson;
    const ask = l.steps.find((s) => s.ask)!.ask!;
    expect(ask.prompt).toBe("Which of Gm9's guide tones stays for C7(♭9)? Tap it.");
    expect(ask.answer.map((n) => chroma(n))).toEqual([chroma("Bb")]);
    const t = ruleLessons.find((r) => r.where.startsWith("coop-blues in F: dominant.tritoneSub@10"))!.lesson;
    expect(t.steps.find((s) => s.ask)!.ask!.prompt).toBe("G♭9 keeps C7's guide tones. Tap them.");
  });
});
