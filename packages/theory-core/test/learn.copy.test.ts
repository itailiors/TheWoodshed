import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, triadTones } from "../src/chords";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { anyLesson, BUNDLED_TUNES, canonicalMove } from "../src/index";
import { RULES } from "../src/ruleset";
import {
  basicsLesson,
  categoryEntry,
  type ColtraneLearn,
  type CommonToneDiminishedLearn,
  type ConstantStructureLearn,
  type FlatSixFlatSevenLearn,
  type GospelTurnaroundLearn,
  type RootlessTwoFiveOneLearn,
  type UpperStructureBVILearn,
  type UpperStructureIILearn,
  type MediantDominantLearn,
  type MinorLineClicheLearn,
  type OneNoteOnTopLearn,
  type PassingDiminishedLearn,
  CONCEPTS,
  conceptNode,
  conceptStates,
  glossaryEntry,
  hasRuleLesson,
  isBasicsId,
  lessonForMove,
  levelEntry,
  nextUp,
  prereqSummary,
  unmetChain,
  unmetDescent,
  type Lesson,
  type LessonFlag,
  type TritoneSubLearn,
} from "../src/learn";
import { ARTICLE_BEFORE_NOTE, BANNED_PHRASES, readable } from "../src/learn/lesson";
import { chroma, intervalName, keySignature, mod, transpose } from "../src/pitch";
import { chainMotions as chainMotionsOf, type Rule } from "../src/ruleKit";
import { gospelTurnaround, rootlessTwoFiveOne, secondaryDominant, secondaryTwoFive, tritoneSub, upperStructure, upperStructureII } from "../src/rules";
import {
  backdoorTwoFive,
  borrowedIv,
  coltraneSubstitution,
  commonToneDiminished,
  constantStructure,
  flatSixFlatSeven,
  mediantDominant,
  minorLineCliche,
  passingDiminished,
} from "../src/rulesAdvanced";
import { oneNoteOnTop } from "../src/rulesOneNote";
import { SCALES } from "../src/scales";
import { KEYS, transposeTune } from "../src/transpose";
import type { ChordEvent, MoveCategory, Quality, Tune } from "../src/types";
import { nearestMotion } from "../src/voiceLeading";

/*
 * Lesson copy, held to the style guide in every key: one idea per step in 20 words or fewer,
 * no sentence over 25, at most 4 lit keys, one new term per step (two per lesson) and each one
 * in the glossary, no hype, and every note spelled for a reader (B♭, never "Bb").
 */

const BASICS = [
  "basics:sevenths",
  "basics:tritone",
  "basics:numerals",
  "basics:guideTones",
  "basics:dominantResolution",
  "basics:twoFiveOne",
  "basics:extensions",
  "basics:parallelMinor",
  "basics:dim7",
  "basics:symmetricOctave",
];
const SLICE = [
  "dominant.tritoneSub",
  "functional.secondaryDominant",
  "functional.secondaryTwoFive",
  "modal.borrowedIv",
  "modal.backdoorTwoFive",
  "symmetric.coltraneSubstitution",
  "chromatic.constantStructure",
  "melody.oneNoteOnTop",
  "dominant.mediantDominant",
  "gospel.halfStepTurnaround",
  "chromatic.passingDiminished",
  "chromatic.commonToneDiminished",
  "chromatic.minorLineCliche",
  "voicing.rootlessTwoFiveOne",
  "voicing.upperStructureBVI",
  "voicing.upperStructureII",
  "modal.flatSixFlatSeven",
];
/** Rule lessons held to the basics' rule: no double accidental shown anywhere (5a's display helpers). */
const NO_DOUBLES = new Set([
  "dominant.mediantDominant",
  "gospel.halfStepTurnaround",
  "chromatic.passingDiminished",
  "chromatic.commonToneDiminished",
  "chromatic.minorLineCliche",
  "voicing.rootlessTwoFiveOne",
  "voicing.upperStructureBVI",
  "voicing.upperStructureII",
  "modal.flatSixFlatSeven",
]);
const BANNED = BANNED_PHRASES;

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

// ── every lesson the app can show: basics in 12 keys, rule lessons on every bundled tune in 12 keys, plus edge cases ──

const base = someday.harmony[0];
const ch = (root: string, quality: Quality, beats = 4): ChordEvent =>
  ({ ...base, root, quality, beats, extensions: [], alterations: [], analysis: undefined, display: undefined, bass: undefined }) as ChordEvent;
const tuneIn = (tonic: string): Tune => ({ ...someday, key: { tonic, mode: "major" } }) as Tune;

function edgeCases(T: string) {
  const at = (d: string) => transpose(T, d);
  const ctx = (chord: ChordEvent, next: ChordEvent, afterNext?: ChordEvent) => ({ tune: tuneIn(T), index: 0, chord, next, afterNext });
  // one note on top reads the melody, so its edge cases run on a changes-only chart
  const bare = (chord: ChordEvent, next: ChordEvent) => ({ ...ctx(chord, next), tune: { ...tuneIn(T), melody: [] } as Tune });
  const flatNine = { ...ch(at("2"), "7"), alterations: ["b9"] } as ChordEvent;
  const cases: [Rule, ReturnType<Rule["propose"]>][] = [
    [tritoneSub, tritoneSub.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))],
    [secondaryDominant, secondaryDominant.propose(ctx(ch(at("6"), "m7"), ch(at("2"), "m7")))], // raised 3rd, minor target
    [secondaryDominant, secondaryDominant.propose(ctx(ch(T, "maj7"), ch(at("4"), "maj7")))], // lowered 7th
    [secondaryDominant, secondaryDominant.propose(ctx(ch(at("2"), "m7"), ch(at("5"), "7")))], // kept ♭7
    [secondaryDominant, secondaryDominant.propose(ctx(ch(T, "6"), ch(at("4"), "maj7")))], // added ♭7
    [secondaryTwoFive, secondaryTwoFive.propose(ctx(ch(at("4"), "7"), ch(T, "maj7")))],
    [secondaryTwoFive, secondaryTwoFive.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))], // related ii
    [secondaryTwoFive, secondaryTwoFive.propose(ctx(ch(at("4"), "maj7"), ch(at("6"), "m7")))], // minor target
    [borrowedIv, borrowedIv.propose(ctx(ch(at("4"), "maj7"), ch(T, "maj7")))],
    [borrowedIv, borrowedIv.propose(ctx(ch(at("4"), "maj7", 1), ch(T, "maj7")))], // no room to keep IV
    [backdoorTwoFive, backdoorTwoFive.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))],
    [backdoorTwoFive, backdoorTwoFive.propose(ctx(ch(at("5"), "7", 1), ch(T, "maj7")))], // ♭VII7 alone
    [coltraneSubstitution, coltraneSubstitution.propose(ctx(ch(at("2"), "m7"), ch(at("5"), "7"), ch(T, "maj7")))],
    [constantStructure, constantStructure.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))], // two-step plane
    [constantStructure, constantStructure.propose(ctx(ch(at("5"), "7", 2), ch(T, "maj7")))], // one step
    [constantStructure, constantStructure.propose(ctx(ch(at("6"), "m7"), flatNine))], // a 5-note shape
    [oneNoteOnTop, oneNoteOnTop.propose(bare(ch(at("5"), "7"), ch(T, "maj7")))], // 2-chord walk
    [oneNoteOnTop, oneNoteOnTop.propose(bare(ch(at("2"), "m7"), ch(at("5"), "7")))], // ii → V
    [oneNoteOnTop, oneNoteOnTop.propose(bare(ch(at("5"), "7", 6), ch(T, "maj7")))], // 3-chord walk
    [oneNoteOnTop, oneNoteOnTop.propose(bare(ch(at("5"), "7", 8), ch(T, "maj7")))], // 3-chord walk, two beats each
    [mediantDominant, mediantDominant.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))],
    [mediantDominant, mediantDominant.propose(ctx(ch(at("5"), "7"), ch(T, "6")))], // into a 6 chord: G♯ still falls to the 5th
    [gospelTurnaround, gospelTurnaround.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))], // lands on maj13
    [gospelTurnaround, gospelTurnaround.propose(ctx(ch(at("5"), "7"), ch(T, "6")))], // lands on 6/9: the ♭7 rises
    [gospelTurnaround, gospelTurnaround.propose(ctx(ch(at("5"), "7"), ch(T, "maj")))], // a plain triad: 6/9 too
    [passingDiminished, passingDiminished.propose(ctx(ch(T, "maj7"), ch(at("2"), "m7")))], // up
    [passingDiminished, passingDiminished.propose(ctx(ch(at("3"), "m7"), ch(at("2"), "m7")))], // down
    [passingDiminished, passingDiminished.propose(ctx(ch(at("3"), "m7"), ch(at("2"), "7")))], // down, into a dominant: three shared keys
    [passingDiminished, passingDiminished.propose(ctx(ch(at("4"), "maj7"), ch(at("5"), "7")))], // up, IV → V
    [commonToneDiminished, commonToneDiminished.propose({ ...ctx(ch(T, "maj7"), ch(at("4"), "maj7")), prev: ch(at("5"), "7") })],
    [commonToneDiminished, commonToneDiminished.propose({ ...ctx(ch(T, "6"), ch(at("4"), "maj7")), prev: ch(at("5"), "7") })], // shares the 6th too
    [commonToneDiminished, commonToneDiminished.propose({ ...ctx({ ...ch(T, "6"), bass: at("5") }, ch(at("4"), "maj7")), prev: ch(at("5"), "7") })], // a slash chord: the bass moves
    [minorLineCliche, minorLineCliche.propose(ctx(ch(T, "m"), ch(at("4"), "m7")))],
    [rootlessTwoFiveOne, rootlessTwoFiveOne.propose(ctx({ ...ch(at("2"), "m7"), extensions: ["9"] }, ch(at("5"), "7"), ch(T, "maj7")))],
    [upperStructure, upperStructure.propose(ctx(ch(at("5"), "7"), ch(T, "m7")))], // into minor: three common tones
    [upperStructure, upperStructure.propose(ctx({ ...ch(at("5"), "7"), alterations: ["b13"] }, ch(T, "maj7")))], // altered, into major
    [upperStructure, upperStructure.propose(ctx({ ...ch(at("5"), "7"), alterations: ["#5"] }, ch(at("2"), "m7")))], // not down a fifth
    [upperStructureII, upperStructureII.propose(ctx({ ...ch(at("5"), "7"), analysis: { roman: "V7", func: "D" } }, ch(T, "maj7")))],
    [upperStructureII, upperStructureII.propose(ctx({ ...ch(at("b7"), "7"), alterations: ["#11"] }, ch(T, "maj7")))], // a Lydian ♭VII7
    [flatSixFlatSeven, flatSixFlatSeven.propose(ctx(ch(at("5"), "7"), ch(T, "maj7")))],
    [flatSixFlatSeven, flatSixFlatSeven.propose(ctx(ch(at("5"), "7"), ch(T, "6")))], // into a 6 chord
  ];
  return cases.flatMap(([r, p], i) => (p ? [{ ruleId: r.id, facts: p.facts, where: `${T} edge ${i}` }] : []));
}

const fromTunes = [...BUNDLED_TUNES, someday].flatMap((t) =>
  KEYS.flatMap((k) =>
    generateMoves(transposeTune(t, k))
      .accepted.filter((m) => hasRuleLesson(m.ruleId))
      .map((m) => ({ ruleId: m.ruleId, facts: m.facts, text: m.text, where: `${t.id} in ${k}: ${m.id}` })),
  ),
);

// and what Coach's Learn stage teaches: every rule on its canonical progression (minor ones too), in 12 keys
const fromCanonical = RULES.flatMap((r) => KEYS.flatMap((k) => (canonicalMove(r.id, k) ? [{ ...canonicalMove(r.id, k)!, where: `${r.id} canonical in ${k}` }] : [])));
const ruleLessons = [...fromTunes, ...KEYS.flatMap(edgeCases), ...fromCanonical].map((m) => ({ where: m.where, lesson: lessonForMove(m)! }));
const basicsLessons = BASICS.flatMap((id) => KEYS.map((k) => ({ where: `${id} in ${k}`, lesson: basicsLesson(id, k)! })));
const ALL: { where: string; lesson: Lesson }[] = [...ruleLessons, ...basicsLessons];

function proseOf(l: Lesson): string[] {
  return [l.headline, l.rule, l.deeper ?? "", ...l.steps.flatMap((s) => [s.text, s.ask?.prompt ?? "", ...s.highlight.map((h) => h.label)])].filter(Boolean);
}

describe("lesson coverage", () => {
  it("every slice rule and basics lesson exists, in all 12 keys", () => {
    for (const id of SLICE) expect(ruleLessons.filter((r) => r.lesson.conceptId === id).length, id).toBeGreaterThanOrEqual(12);
    expect(BASICS).toEqual(CONCEPTS.map((c) => c.id).filter(isBasicsId));
    expect(basicsLessons.every((b) => b.lesson && b.lesson.conceptId === b.where.split(" in ")[0])).toBe(true);
    expect(basicsLesson("basics:dim7", "C")?.conceptId).toBe("basics:dim7");
    expect(lessonForMove({ ruleId: "voicing.upperStructureBVI", facts: {} })).toBeNull();
  });

  it("all 17 rules and all 10 basics have lessons: every rule on its canonical move, in 12 keys", () => {
    expect(RULES.length).toBe(17);
    expect([...SLICE].sort()).toEqual(RULES.map((r) => r.id).sort());
    for (const r of RULES) {
      expect(hasRuleLesson(r.id), r.id).toBe(true);
      for (const k of KEYS) expect(lessonForMove(canonicalMove(r.id, k)!)?.conceptId, `${r.id} in ${k}`).toBe(r.id);
    }
    const basics = CONCEPTS.map((c) => c.id).filter(isBasicsId);
    expect(basics).toHaveLength(10);
    for (const id of basics) for (const k of KEYS) expect(basicsLesson(id, k)?.conceptId, `${id} in ${k}`).toBe(id);
    // every node on the path, rule or foundation, has a lesson in every key
    for (const c of CONCEPTS) expect(anyLesson(c.id, "C"), c.id).not.toBeNull();
  });

  it("every basics node next up can offer has a lesson, all the way along the path", () => {
    // a learner who always finishes the first suggestion: everything the path offers on the way
    const flags: Record<string, LessonFlag> = {};
    const offered = new Set<string>();
    for (let guard = 0; guard < CONCEPTS.length; guard++) {
      const next = nextUp(conceptStates({ concepts: [], cleanKeys: {} }, flags, new Date("2026-11-20T12:00:00Z")));
      if (!next.length) break;
      next.forEach((id) => offered.add(id));
      flags[next[0]] = { seenAt: "x", finishedAt: "y" };
    }
    const basics = [...offered].filter(isBasicsId);
    expect(basics.sort()).toEqual([...BASICS].sort());
    for (const id of basics) for (const k of KEYS) expect(basicsLesson(id, k), `${id} in ${k}`).not.toBeNull();
    // a fresh player's first screen: every suggestion has a lesson
    for (const id of nextUp(conceptStates({ concepts: [], cleanKeys: {} }, {}, new Date()))) expect(basicsLesson(id, "C") ?? (hasRuleLesson(id) || null), id).not.toBeNull();
  });
});

describe("lesson copy", () => {
  it.each(ALL.filter((_, i) => i % 7 === 0).map((x) => [x.where, x.lesson] as const))("%s keeps to the word budgets", (_where, l) => {
    expect(words(l.headline)).toBeLessThanOrEqual(20);
    expect(sentences(l.rule)).toHaveLength(1);
    for (const s of l.steps) expect(words(s.text), s.text).toBeLessThanOrEqual(20);
  });

  // one case per concept (all its keys and variants), split into chunks of ≤ 300 lessons (constant structure alone has
  // ~1,400 from the tunes), so each case runs well inside the default timeout and a slowdown shows
  const CHUNK = 300;
  const byConcept = [...new Set(ALL.map((x) => x.lesson.conceptId))].flatMap((id) => {
    const all = ALL.filter((x) => x.lesson.conceptId === id);
    const parts = Math.ceil(all.length / CHUNK);
    return Array.from({ length: parts }, (_, p) => [parts > 1 ? `${id} (part ${p + 1}/${parts})` : id, all.slice(p * CHUNK, (p + 1) * CHUNK)] as const);
  });
  it.each(byConcept)("every lesson of %s, in every key, keeps to the budgets, the glossary and the house spelling", (_id, lessons) => {
    for (const { where, lesson: l } of lessons) {
      const at = `${where}`;
      expect(words(l.headline), `${at}: ${l.headline}`).toBeLessThanOrEqual(20);
      expect(sentences(l.rule), `${at}: ${l.rule}`).toHaveLength(1);
      expect(l.steps.length, at).toBeGreaterThanOrEqual(3);
      expect(l.steps.length, at).toBeLessThanOrEqual(5);
      for (const s of l.steps) {
        expect(words(s.text), `${at}: ${s.text}`).toBeLessThanOrEqual(20);
        expect(s.highlight.length, `${at}: ${s.text}`).toBeGreaterThanOrEqual(1);
        expect(s.highlight.length, `${at}: ${s.text}`).toBeLessThanOrEqual(4);
        if (s.term) {
          const g = glossaryEntry(s.term);
          expect(g, `${at}: "${s.term}" is not in the glossary`).toBeDefined();
          const forms = [g!.term, ...g!.aliases].map((t) => t.toLowerCase());
          expect(forms.some((f) => s.text.toLowerCase().includes(f)), `${at}: "${s.term}" isn't used in "${s.text}"`).toBe(true);
        }
        if (s.prereqLink) expect(conceptNode(s.prereqLink), `${at}: ${s.prereqLink}`).toBeDefined();
        if (s.ask) expect(s.ask.answer.length, at).toBeGreaterThan(0);
      }
      expect(l.steps.filter((s) => s.term).length, at).toBeLessThanOrEqual(2);
      // step 1 plays on open, so it always has something to play
      expect(!!l.steps[0].play || !!l.steps[0].sound?.length, `${at}: step 1 has no ▶ cue`).toBe(true);
      for (const s of l.steps) for (const c of s.sound ?? []) expect(c.length, at).toBeGreaterThan(0);
      // no lesson prints a double flat or sharp (`pn` reads B♭♭ as A); basics and the NO_DOUBLES lessons also
      // keep them off the keys they light (older rule lessons' highlight and answer notes are engine-spelled, matched by pitch class)
      const basic = isBasicsId(l.conceptId) || NO_DOUBLES.has(l.conceptId);
      const notes = l.steps.flatMap((s) => [...s.highlight.map((h) => h.note), ...(s.ask?.answer ?? []), ...(s.sound ?? []).flat()]);
      if (basic) expect(notes.filter((n) => /bb|##|x/.test(n)), at).toEqual([]);
      const asks = l.steps.flatMap((s, i) => (s.ask ? [i] : []));
      expect(asks, `${at}: one predict-then-reveal, in steps 2–4`).toHaveLength(1);
      expect(asks[0]).toBeGreaterThanOrEqual(1);
      expect(asks[0]).toBeLessThanOrEqual(3);
      for (const text of proseOf(l)) {
        for (const sentence of sentences(text)) expect(words(sentence), `${at}: ${sentence}`).toBeLessThanOrEqual(25);
        expect(text, at).not.toMatch(/undefined|NaN|null|\[object/);
        expect(text, at).not.toMatch(BANNED);
        expect(text, at).not.toMatch(/#/);
        expect(text, `${at}: engine spelling leaked into "${text}"`).not.toMatch(/(?<![A-Za-z])[A-G]b+(?![a-ce-ln-z])/); // "Bb", "Bbm7", "Bbdim7"; not "Above"
        expect(text, `${at}: double accidental in "${text}"`).not.toMatch(/♭♭|♯♯|𝄫|𝄪/u);
        expect(text, `${at}: "a"/"an" before a note name in "${text}"`).not.toMatch(ARTICLE_BEFORE_NOTE);
      }
    }
  });

  it("a lessoned move's card text is its lesson, so it keeps the same budgets (every bundled tune, 12 keys)", () => {
    expect(fromTunes.length).toBeGreaterThan(0);
    for (const { where, text: t, ...m } of fromTunes) {
      const l = lessonForMove(m)!;
      expect(t.summary, where).toBe(l.headline);
      expect(t.recreateRule, where).toBe(l.rule);
      expect(t.theory, where).toBe(l.steps.map((s) => s.text).join(" "));
      expect(t.insight, where).toBe(l.deeper);
      expect(words(t.summary), `${where}: ${t.summary}`).toBeLessThanOrEqual(20);
      expect(sentences(t.recreateRule), `${where}: ${t.recreateRule}`).toHaveLength(1);
      for (const text of [t.summary, t.theory, t.recreateRule, t.insight ?? ""].filter(Boolean)) {
        for (const sentence of sentences(text)) expect(words(sentence), `${where}: ${sentence}`).toBeLessThanOrEqual(25);
        expect(text, where).not.toMatch(/undefined|NaN|null|\[object|#/);
        expect(text, where).not.toMatch(BANNED);
        expect(text, `${where}: engine spelling leaked into "${text}"`).not.toMatch(/(?<![A-Za-z])[A-G]b+(?![a-ce-ln-z])/);
      }
    }
  }, 15_000); // ~1.6 s alone; headroom for the other suites running beside it
});

describe("the glossary covers what the UI labels", () => {
  const CATEGORIES: MoveCategory[] = ["functional", "dominant-sub", "gospel", "voicing", "chromatic", "modal", "symmetric"];

  it("every move category and dial level has an entry, glossed in eight words or fewer", () => {
    for (const tune of BUNDLED_TUNES) for (const m of generateMoves(tune).accepted) expect(CATEGORIES).toContain(m.category);
    for (const c of CATEGORIES) {
      const g = categoryEntry(c);
      expect(g.kind, c).toBe("category");
      expect(glossaryEntry(g.term), c).toBe(g);
      expect(words(g.gloss), g.term).toBeLessThanOrEqual(8);
    }
    for (const level of [0, 1, 2, 3, 4]) {
      const g = levelEntry(level)!;
      expect(g, `L${level}`).toBeDefined();
      expect(g.term).toBe(`L${level}`);
      expect(glossaryEntry(`L${level}`)).toBe(g);
      expect(words(g.gloss), g.term).toBeLessThanOrEqual(8);
    }
    expect(levelEntry(2)!.aliases).toContain("L2 Colour");
  });

  it("has the voicing labels, the lesson terms and the numerals; numerals match their exact case", () => {
    for (const t of ["Type A", "Type B", "Close (rootless)", "tensions", "extensions", "diminished 7th", "augmented triad", "sus", "line cliché", "dominant 7th", "roman numerals"])
      expect(glossaryEntry(t), t).toBeDefined();
    for (const t of ["borrowed", "appoggiatura", "tonicize", "constant structure", "upper structure", "shell", "rootless", "the Family"]) expect(glossaryEntry(t), t).toBeDefined();
    for (const n of ["V", "♭II", "ii", "♭VII7", "iv"]) expect(glossaryEntry(n)?.kind, n).toBe("numeral");
    expect(glossaryEntry("IV")).toBeUndefined(); // the minor iv's gloss must never answer for major IV
    expect(glossaryEntry("v")).toBeUndefined();
  });
});

describe("no undeclared jargon in lesson steps (5f)", () => {
  /*
   * Words the style guide says to gloss (rule-specific names, scale names, the lessons' own terms).
   * A step may use one only when the reader has met it: it's this step's term (chipped), an earlier
   * step's term in the same lesson, the lesson's own concept, or the concept of a hard prerequisite,
   * all the way down. Chord-quality names the decoder chip already explains (half-diminished) and
   * the degree word "sus 4th" next to a sus4 symbol aren't on the list.
   */
  const JARGON: Record<string, string[]> = {
    "tritone sub": ["tritone sub", "tritone substitution"],
    tritone: ["tritone"],
    tonicize: ["tonicize"],
    backdoor: ["backdoor"],
    "upper structure": ["upper structure"],
    rootless: ["rootless"],
    "the Family": ["the Family"],
    "constant structure": ["constant structure", "planing"],
    appoggiatura: ["appoggiatura"],
    enclosure: ["enclosure"],
    "avoid note": ["avoid note"],
    "modal interchange": ["modal interchange"],
    "parallel minor": ["parallel minor"],
    borrowed: ["borrowed", "borrow"],
    "minor plagal": ["minor plagal"],
    "related ii": ["related ii"],
    "secondary dominant": ["secondary dominant"],
    "leading tone": ["leading tone"],
    "guide tones": ["guide tones", "guide tone"],
    "Lydian dominant": ["Lydian dominant"],
    "Phrygian dominant": ["Phrygian dominant"],
    "melodic minor": ["melodic minor"],
    "harmonic minor": ["harmonic minor"],
    "diminished 7th": ["diminished 7th"],
    "augmented triad": ["augmented triad"],
    "line cliché": ["line cliché"],
    "key centre": ["key centre", "key center"],
    shell: ["shell", "shells"],
    "Type A": ["Type A"],
    "Type B": ["Type B"],
    sus: ["sus"],
    tensions: ["tensions", "extensions"], // not "tension": the everyday word ("tension on the beat")
    "drop 2": ["drop 2"],
    "roman numerals": ["roman numerals"],
  };
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const uses = (text: string, form: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(form)}(?:s|es|d|ed|ing)?(?![\\p{L}])(?! 4th)`, "iu").test(text);
  const hardClosure = (id: string, seen = new Set<string>()): Set<string> => {
    for (const p of conceptNode(id)?.hard ?? []) if (!seen.has(p)) hardClosure(p, seen.add(p));
    return seen;
  };

  it("every jargon word resolves to a glossary entry", () => {
    for (const t of Object.keys(JARGON)) expect(glossaryEntry(t), t).toBeDefined();
  });

  it("every step (text and ask) uses only jargon the reader has met, in every lesson and key", () => {
    const misses: string[] = [];
    for (const { where, lesson: l } of ALL) {
      const known = new Set([l.conceptId, ...hardClosure(l.conceptId)]);
      const declared = new Set<string>();
      l.steps.forEach((s, i) => {
        if (s.term) declared.add(glossaryEntry(s.term)!.term);
        for (const [term, forms] of Object.entries(JARGON)) {
          const g = glossaryEntry(term)!;
          if (declared.has(g.term) || (g.conceptId && known.has(g.conceptId))) continue;
          const text = `${s.text} ${s.ask?.prompt ?? ""}`;
          if (forms.some((f) => uses(text, f))) misses.push(`${where}, step ${i + 1}: "${term}" in "${text.trim()}"`);
        }
      });
    }
    expect(misses.slice(0, 10)).toEqual([]);
  }, 15_000); // ~1.2 s alone
});

describe("pedagogy and scale copy (5f)", () => {
  it("every rule's whyItWorks is one or two sentences, ≤ 25 words, in degrees, with no hype", () => {
    expect(RULES).toHaveLength(17);
    for (const r of RULES) {
      const w = r.pedagogy!.whyItWorks;
      expect(words(w), `${r.id}: ${w}`).toBeLessThanOrEqual(25);
      expect(sentences(w).length, `${r.id}: ${w}`).toBeLessThanOrEqual(2);
      expect(w, r.id).not.toMatch(BANNED);
      expect(w, r.id).not.toMatch(/#|(?<![A-Za-z])[A-G]b(?![a-z])|semitone/);
      // key-agnostic: no note names (a capital A–G with an accidental, or a lone B–G; "Type B" is a grip)
      expect(w, `${r.id}: names a note`).not.toMatch(/(?<![\p{L}])[A-G][♭♯](?![\p{L}])|(?<!Type )(?<![\p{L}])[B-G]\s/u);
    }
  });

  it("scale suggestions explain themselves in ≤ 25 words, with no hype", () => {
    for (const [id, s] of Object.entries(SCALES)) {
      expect(words(s.why), `${id}: ${s.why}`).toBeLessThanOrEqual(25);
      for (const sentence of sentences(s.why)) expect(words(sentence), id).toBeLessThanOrEqual(25);
      expect(s.why, id).not.toMatch(BANNED);
      expect(s.why, id).not.toMatch(/\b(dreamy|maximum|plain and simple|rub-heavy|straight at)\b/i);
      expect(s.why, id).not.toMatch(/#|(?<![A-Za-z])[A-G]b(?![a-z])/);
    }
  });
});

describe("prerequisite summaries", () => {
  it("count the prerequisite lessons' steps, in every key", () => {
    for (const k of KEYS) {
      const s = prereqSummary("dominant.tritoneSub", k)!;
      expect(s.prereqs.map((p) => p.id)).toEqual(["basics:tritone", "basics:dominantResolution"]);
      expect(s.steps).toBe(basicsLesson("basics:tritone", k)!.steps.length + basicsLesson("basics:dominantResolution", k)!.steps.length);
      expect(s.steps).toBeGreaterThan(0);
    }
    expect(prereqSummary("basics:dominantResolution", "C")!.sentence).toBe("This builds on guide tones (4 steps).");
    expect(prereqSummary("dominant.tritoneSub", "C")!.sentence).toBe("This builds on the tritone and dominant resolution (7 steps).");
    // a prerequisite without a lesson yet (here a rule; Coach passes `lessonFor` for those): names only, never a partial count
    expect(prereqSummary("functional.secondaryTwoFive", "C")!.sentence).toBe("This builds on secondary dominant and the ii–V–I.");
    const stub = basicsLesson("basics:tritone", "C")!;
    const withRules = prereqSummary("functional.secondaryTwoFive", "C", { lessonFor: (id, k) => basicsLesson(id, k) ?? stub })!;
    expect(withRules.steps).toBe(stub.steps.length + basicsLesson("basics:twoFiveOne", "C")!.steps.length);
    expect(withRules.sentence).toMatch(/\(\d+ steps\)\.$/);
  });

  it("summarises only the unmet prerequisites when told, and nothing for a concept with none", () => {
    expect(prereqSummary("dominant.tritoneSub", "C", { only: ["basics:dominantResolution"] })!.prereqs.map((p) => p.id)).toEqual(["basics:dominantResolution"]);
    expect(prereqSummary("basics:tritone", "C")).toBeNull();
    expect(prereqSummary("nope", "C")).toBeNull();
  });

  it("a cold start counts the whole unmet chain, deepest first, and Learn that first walks down it", () => {
    const fresh = conceptStates({ concepts: [], cleanKeys: {} }, {}, new Date("2026-11-20"));
    const chain = unmetChain(fresh, "dominant.tritoneSub");
    // learning order: each concept after what it builds on; it starts where "Learn that first" opens
    expect(chain).toEqual(["basics:tritone", "basics:sevenths", "basics:guideTones", "basics:dominantResolution"]);
    expect(unmetDescent(fresh, "dominant.tritoneSub")).toEqual(["basics:tritone"]);
    expect(unmetDescent(fresh, "basics:dominantResolution")).toEqual(["basics:guideTones", "basics:sevenths"]);
    const s = prereqSummary("dominant.tritoneSub", "C", { chain })!;
    const total = chain.reduce((n, id) => n + basicsLesson(id, "C")!.steps.length, 0);
    expect(s.steps).toBe(total);
    expect(s.sentence).toBe(`This builds on the tritone and dominant resolution (4 lessons, ${total} steps, from the tritone).`);
    // a chain no deeper than the direct prerequisites reads as before
    expect(prereqSummary("dominant.tritoneSub", "C", { chain: ["basics:tritone", "basics:dominantResolution"] })!.sentence).toBe(
      "This builds on the tritone and dominant resolution (7 steps).",
    );
    // with 7th chords finished, guide tones has nothing unmet: an empty chain
    const later = conceptStates({ concepts: [], cleanKeys: {} }, { "basics:sevenths": { finishedAt: "2026-11-20" } }, new Date("2026-11-20"));
    expect(unmetChain(later, "basics:guideTones")).toEqual([]);
    expect(unmetDescent(later, "basics:guideTones")).toEqual([]);
  });

  it("every concept whose hard prerequisites all have lessons gets a positive count", () => {
    for (const c of CONCEPTS) {
      const s = prereqSummary(c.id, "C");
      if (!s) continue;
      for (const p of s.prereqs) if (basicsLesson(p.id, "C")) expect(p.steps, `${c.id} → ${p.id}`).toBeGreaterThan(0);
      if (s.prereqs.every((p) => basicsLesson(p.id, "C"))) expect(s.steps, c.id).toBeGreaterThan(0);
    }
  });
});

describe("lesson notes are the engine's notes, in every key", () => {
  it("tritone sub: the shared keys are the original's guide tones, at the sub's swapped roles, resolving like V7 → I", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const V7 = ch(transpose(T, "5"), "7");
        const I = ch(T, "maj7");
        const p = tritoneSub.propose({ tune: tuneIn(T), index: 0, chord: V7, next: I })!;
        const f = p.facts.learn as TritoneSubLearn;
        const l = lessonForMove({ ruleId: "dominant.tritoneSub", facts: p.facts })!;
        const shared = guideTones(V7).map((t) => t.note);
        expect(l.steps[2].highlight.map((h) => h.note)).toEqual(shared);
        expect(l.steps[2].ask!.answer).toEqual(shared);
        // the tritone pair: same two keys, roles swapped
        expect(chroma(f.subGuideTones[1])).toBe(chroma(shared[0]));
        expect(chroma(f.subGuideTones[0])).toBe(chroma(shared[1]));
        expect(f.subGuideTones).toEqual(guideTones({ root: f.subRoot, quality: "7", extensions: [], alterations: [] }).map((t) => t.note));
        expect(mod(chroma(f.subRoot) - chroma(V7.root), 12)).toBe(6);
        // 3rd up to the root, 7th down to the 3rd
        expect(f.resolution.map((m) => [m.to, m.semitones])).toEqual([
          [T, 1],
          [transpose(T, "3"), -1],
        ]);
      }),
    );
  });

  const moveIn = (id: string, k: string) => canonicalMove(id, k)!;

  it("Coltrane: the map's three centres are 4 semitones apart and come home; each V7 sits a fifth above its centre; the line is the ii's 3rd, holds folded", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("symmetric.coltraneSubstitution", T);
        const f = m.facts.learn as ColtraneLearn;
        const l = lessonForMove(m)!;
        const map = l.steps[0].map!;
        expect(map).toEqual(f.centres);
        expect([...map, map[0]].slice(1).map((n, i) => mod(chroma(map[i]) - chroma(n), 12))).toEqual([4, 4, 4]);
        expect(chroma(map[2])).toBe(chroma(T));
        f.dominantRoots.forEach((d, i) => expect(mod(chroma(d) - chroma(f.centres[i]), 12)).toBe(7));
        expect(l.steps[1].ask!.answer).toEqual([f.dominantRoots[0]]);
        // the line: the ii's 3rd through the tour by nearest motion, every hold run folded into one stop
        const ii = m.original[0];
        const raw = [guideTones(ii)[0].note, ...chainMotionsOf([guideTones(ii)[0].note], [...m.chords.slice(1), { root: T, quality: "maj7", extensions: [], alterations: [] }])[0].map((x) => x.to)];
        const pcsRun = raw.map(chroma).filter((pc, i, xs) => i === 0 || pc !== xs[i - 1]);
        expect(f.line.map((s) => chroma(s.note))).toEqual(pcsRun);
        expect(l.steps[2].highlight.map((h) => chroma(h.note))).toEqual(pcsRun.slice(0, 4));
        // each new centre (and so its V7) is the key signature with the fewest accidentals: E♭ over B, never D♯
        for (const c of f.centres.slice(0, 2)) expect(Math.abs(keySignature(c)), `${T}: ${c}`).toBeLessThanOrEqual(6);
        f.centres.slice(0, 2).forEach((c, i) => expect(chroma(f.centreDegrees[i])).toBe(chroma(c)));
      }),
    );
    // the sharp keys, as charted (Giant Steps' B: B♭7 → E♭maj7), with the key's own degree twinned once
    const inB = lessonForMove(moveIn("symmetric.coltraneSubstitution", "B"))!;
    expect(inB.steps[0].text).toBe("The map first: three key centres, G, E♭ (same key as D♯) and B, a major 3rd apart.");
    expect(inB.steps[1].text).toContain("B♭7 → E♭maj7");
    expect((moveIn("symmetric.coltraneSubstitution", "E").facts.learn as ColtraneLearn).centres).toEqual(["C", "Ab", "E"]);
    expect((moveIn("symmetric.coltraneSubstitution", "A").facts.learn as ColtraneLearn).centres).toEqual(["F", "Db", "A"]);
  });

  it("constant structure: the half-step shape is the target's, every voice slides −1, and the ask lights the shape (or its 3rd and 7th)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("chromatic.constantStructure", T);
        const f = m.facts.learn as ConstantStructureLearn;
        const l = lessonForMove(m)!;
        const approach = m.chords[m.chords.length - 1];
        expect(f.approachTones.map(chroma)).toEqual(chordTones(approach).map((t) => chroma(t.note)));
        expect(f.approachTones.map((n) => mod(chroma(n) - 1, 12))).toEqual(f.shapeTones.map(chroma));
        expect(f.slide.map((s) => s.semitones)).toEqual(f.shapeTones.map(() => -1));
        expect(l.steps[1].ask!.answer).toEqual(f.approachTones);
        expect(f.planedRoots.slice(1).map((r, i) => mod(chroma(f.planedRoots[i]) - chroma(r), 12))).toEqual(f.planedRoots.slice(1).map(() => 1));
        for (const n of [...f.shapeTones, ...f.approachTones]) expect(n).not.toMatch(/bb|##/);
      }),
    );
    // a 5-note shape lights 4 keys and asks for the 3rd and 7th
    const five = ruleLessons.filter((r) => r.lesson.conceptId === "chromatic.constantStructure" && /3rd and 7th/.test(r.lesson.steps[1].ask!.prompt));
    expect(five.length).toBeGreaterThan(0);
  });

  it("one note on top: the walk descends by half steps into the target, and a 3-chord walk splits its roles across steps 3 and 4", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("melody.oneNoteOnTop", T);
        const f = m.facts.learn as OneNoteOnTopLearn;
        const walk = [...f.basses, f.targetBass];
        expect(walk.slice(1).map((b, i) => mod(chroma(walk[i]) - chroma(b), 12))).toEqual(walk.slice(1).map(() => 1));
        m.chords.slice(1).forEach((c) => expect(chordTones(c).some((t) => chroma(t.note) === chroma(f.heldNote))).toBe(true));
        expect(lessonForMove(m)!.steps[2].ask!.answer).toEqual([f.basses[1]]);
      }),
    );
    const three = ruleLessons.filter((r) => r.lesson.conceptId === "melody.oneNoteOnTop" && r.lesson.steps[1].highlight.length === 4 && !r.lesson.steps[1].highlight.some((h) => h.label === "top"));
    expect(three.length).toBeGreaterThan(0);
    for (const { lesson } of three) expect(lesson.steps[3].text).toMatch(/^Over .+\. Into .+ lands as the /);
  });

  const minor3rds = (ns: string[]) => [...ns, ns[0]].slice(1).map((n, i) => mod(chroma(n) - chroma(ns[i]), 12));
  const doubled = (n: string) => /(bb|##|x)$/.test(n);
  const pcsOf = (ns: string[]) => [...new Set(ns.map(chroma))].sort((a, b) => a - b);

  it("mediant dominant: the °7 is V7(♭9) without its root and splits the octave; III7(♭9)'s upper four are the same keys, respelled pairs equal", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("dominant.mediantDominant", T);
        const f = m.facts.learn as MediantDominantLearn;
        const l = lessonForMove(m)!;
        expect(minor3rds(f.dim)).toEqual([3, 3, 3, 3]);
        expect(f.dim.map(chroma).sort()).toEqual(chordTones({ root: f.originalRoot, quality: "7", extensions: [], alterations: ["b9"] }).filter((t) => t.degree !== "1").map((t) => chroma(t.note)).sort());
        f.subTones.forEach((n, k) => expect(chroma(n), `${n}/${f.dimTwins[k]}`).toBe(chroma(f.dimTwins[k])));
        expect(mod(chroma(f.subRoot) - chroma(T), 12)).toBe(4);
        expect(f.resolution.map((r) => r.semitones)).toEqual([-1, -2]);
        expect(f.familyRoots.map((r) => mod(chroma(r) - chroma(T), 12))).toEqual([7, 10, 1, 4]);
        for (const n of [...f.dim, ...f.subTones]) expect(doubled(n), n).toBe(false);
        expect(l.steps[0].prereqLink).toBe("basics:dim7");
      }),
    );
  });

  it("gospel: the shown grip is root–♭7–3rd under the major triad on the 9th, and the landing named is the chord the voices make", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("gospel.halfStepTurnaround", T);
        const f = m.facts.learn as GospelTurnaroundLearn;
        const at = (d: string) => chroma(transpose(f.approachRoot, d));
        expect(f.grip.lh.map(chroma)).toEqual([at("1"), at("b7"), at("3")]);
        expect(f.grip.rh.map(chroma)).toEqual([at("9"), at("#11"), at("13")]);
        expect(mod(chroma(f.grip.rh[1]) - chroma(f.grip.rh[0]), 12)).toBe(4); // a major triad on top
        expect(mod(chroma(f.approachRoot) - chroma(T), 12)).toBe(1);
        expect(chroma(f.sharpEleven)).toBe(chroma(f.susRoot)); // the old root kept inside
        // the six grip voices land on exactly the landing chord's keys: Cmaj13 over a maj7
        expect(f.landing).toBe(`${T}maj13`);
        expect(pcsOf(f.gripMotions.map((v) => v.to))).toEqual(pcsOf(["1", "3", "5", "7", "9", "13"].map((d) => transpose(T, d))));
        expect(f.gripMotions.filter((v) => v.semitones !== 0).every((v) => v.semitones === -1)).toBe(true);
        expect(lessonForMove(m)!.steps[3].ask!.answer).toEqual(f.held);
      }),
    );
    // over a 6 chord the ♭7 rises to the root and the 9th joins: it lands on 6/9, never maj13
    const six = ruleLessons.filter((r) => r.lesson.conceptId === "gospel.halfStepTurnaround" && /6\/9/.test(r.lesson.headline));
    expect(six.length).toBeGreaterThan(0);
    for (const { lesson } of six) expect(lesson.steps[3].text).toMatch(/rises to/);
  });

  it("passing °7: up, it is the target's V7(♭9) without its root, 3rd up to the root, ♭9 down to the 5th; down, it keeps the flats", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("chromatic.passingDiminished", T);
        const f = m.facts.learn as PassingDiminishedLearn;
        expect(f.ascending).toBe(true);
        expect(minor3rds(f.dimTones)).toEqual([3, 3, 3, 3]);
        expect(f.roles).toEqual(["3", "5", "b7", "b9"]);
        expect(mod(chroma(f.impliedV) - chroma(f.targetRoot), 12)).toBe(7);
        expect(f.pull!.map((p) => [chroma(p.to), p.semitones])).toEqual([
          [chroma(f.targetRoot), 1],
          [chroma(f.impliedV), -1],
        ]);
        for (const n of f.dimTones) expect(doubled(n), n).toBe(false);
        // each key named is spelled as its role above the implied V (B♯ is G♯7's 3rd, never C), the same keys as the °7
        f.vTones!.forEach((n, k) => {
          expect(intervalName(f.impliedV, n), `${T}: ${n} over ${f.impliedV}`).toBe(f.roles[k] === "b9" ? "b2" : f.roles[k]);
          expect(chroma(n)).toBe(chroma(f.dimTones[k]));
          expect(doubled(n), n).toBe(false);
        });
        expect(f.pull!.map((p) => p.from)).toEqual([f.vTones![0], f.vTones![3]]);
      }),
    );
    // falling, the °7 is never called a dominant, and its own tones are flat-side (E♭ G♭ A C), with no double accidental
    const down = [...KEYS.flatMap(edgeCases), ...fromTunes].filter((m) => m.ruleId === "chromatic.passingDiminished" && !(m.facts.learn as PassingDiminishedLearn).ascending);
    expect(down.length).toBeGreaterThan(0);
    for (const m of down) {
      const f = m.facts.learn as PassingDiminishedLearn;
      expect(lessonForMove(m)!.steps.map((s) => s.text).join(" "), m.where).not.toMatch(/dominant|V7/);
      expect(f.dimTones.join(" "), m.where).not.toMatch(/#|bb/);
      expect(minor3rds(f.dimTones)).toEqual([3, 3, 3, 3]);
    }
  });

  it("mediant dominant: the °7 is spelled as the chart's V7(♭9) without its root, so III7(♭9) needs no twin where they agree (G♭)", () => {
    const l = lessonForMove(canonicalMove("dominant.mediantDominant", "Gb")!)!;
    expect(l.steps[0].text).toBe("Add the ♭9 to D♭7 and drop the root: F, A♭, C♭, D, a diminished 7th.");
    expect(l.steps[1].text).toBe("Put B♭ under them: D, F, A♭ and C♭ make B♭7(♭9).");
    expect(lessonForMove(canonicalMove("dominant.mediantDominant", "C")!)!.steps[1].text).toBe("Put E under them: G♯ (same key as A♭), B, D and F make E7(♭9).");
  });

  it("one minor key, one name: in D♭ and G♭ the parallel minor is C♯ / F♯ minor in every lesson, and a respelled ♭VII root gets its twin", () => {
    const gb = basicsLesson("basics:parallelMinor", "Gb")!;
    expect(gb.steps[0].text).toBe("F♯ minor, G♭'s parallel minor, lowers B♭, E♭ and F to A, D and E.");
    expect(gb.steps[1].text).toBe("Bm6 borrows D from F♯ minor; E7 borrows E and D.");
    for (const id of ["modal.borrowedIv", "modal.backdoorTwoFive", "modal.flatSixFlatSeven"])
      for (const [k, minor] of [["Gb", "F♯ minor (G♭'s parallel minor)"], ["Db", "C♯ minor (D♭'s parallel minor)"], ["C", "C minor"]] as const) {
        const l = lessonForMove(canonicalMove(id, k)!)!;
        expect(l.steps[0].text, `${id} in ${k}`).toContain(`from ${minor}`);
        expect(l.steps.map((s) => s.text).join(" "), `${id} in ${k}`).not.toMatch(/(G♭|D♭) minor/);
      }
    expect(lessonForMove(canonicalMove("modal.flatSixFlatSeven", "Gb")!)!.steps[1].text).toBe("The bass climbs by whole steps: D to E (same key as F♭) to G♭.");
    expect(lessonForMove(canonicalMove("modal.backdoorTwoFive", "Gb")!)!.steps[2].text).toBe("Its D falls to D♭; its root E (same key as F♭) climbs a whole step to G♭.");
  });

  it("secondary dominant: raising the 3rd makes the plain 7th; the ♭9 is named only once it's added", () => {
    const c = lessonForMove(canonicalMove("functional.secondaryDominant", "C")!)!;
    expect(c.steps[2].text).toBe("Its ♭7, G, stays: with C♯ it's A7.");
    expect(c.steps[2].ask!.prompt).toBe("Tap the 3rd and 7th of A7.");
    expect(c.steps[4].text).toBe("Dm7 is minor, so add the ♭9, B♭, for A7(♭9): B♭ falls a half step into Dm7.");
    for (const k of KEYS) {
      const l = lessonForMove(canonicalMove("functional.secondaryDominant", k)!)!;
      const before = l.steps.slice(0, 4).flatMap((s) => [s.text, s.ask?.prompt ?? ""]);
      expect(before.join(" "), k).not.toMatch(/♭9/);
    }
  });

  it("common-tone °7: the leaning tones are spelled as they rise (♯2, ♯4; no double sharps) and each rises a half step into the 3rd and 5th", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("chromatic.commonToneDiminished", T);
        const f = m.facts.learn as CommonToneDiminishedLearn;
        const r = f.root;
        // ♯2 and ♯4 of the root (D♯, F♯ over C); only a double sharp is respelled, to the same key
        for (const [n, iv] of [
          [f.dimTones[1], "#2"],
          [f.dimTones[2], "#4"],
        ] as const) {
          const sharp = transpose(r, iv);
          if (doubled(sharp)) expect(chroma(n), `${r}: ${n}`).toBe(chroma(sharp));
          else expect(n, r).toBe(sharp);
        }
        expect(minor3rds(f.dimTones)).toEqual([3, 3, 3, 3]);
        expect(f.leans.map((v) => [v.semitones, v.toDegree])).toEqual([
          [1, "3"],
          [1, "5"],
        ]);
        for (const n of f.dimTones) expect(doubled(n), n).toBe(false);
        expect(f.shared).toEqual([r]);
        // no flat-side leaning tone ever names a rising voice ("E♭ rises to E" would read as a blue ♭3)
        expect(lessonForMove(m)!.steps[1].text).not.toMatch(/♭ rises/);
      }),
    );
  });

  it("line cliché: the root voice falls by half steps through the four stops, named without the added 9th", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("chromatic.minorLineCliche", T);
        const f = m.facts.learn as MinorLineClicheLearn;
        expect(f.line.slice(1).map((n, i) => mod(chroma(f.line[i]) - chroma(n), 12))).toEqual([1, 1, 1]);
        expect(f.stops.map((s) => s.slice(f.root.length))).toEqual(["m", "m(maj7)", "m7", "m6"]);
        expect([f.third, f.fifth].map((n) => mod(chroma(n) - chroma(f.root), 12))).toEqual([3, 7]);
      }),
    );
  });

  const above = (from: string, to: string) => mod(chroma(to) - chroma(from), 12);

  it("rootless ii–V–I: grip A (3rd at the bottom) → grip B (7th) → grip A, only the ii's 7th moves into V (−1), and V's 3rd holds as I's 7th", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("voicing.rootlessTwoFiveOne", T);
        const f = m.facts.learn as RootlessTwoFiveOneLearn;
        const [ii, V] = m.chords;
        const at = (root: string, ds: string[]) => ds.map((d) => chroma(transpose(root, d)));
        expect(f.iiGrip.map(chroma)).toEqual(at(ii.root, ["b3", "5", "b7", "9"]));
        expect(f.vGrip.map(chroma)).toEqual(at(V.root, ["b7", "9", "3", "13"]));
        expect(f.iGrip.map(chroma)).toEqual(at(T, ["3", "5", "7", "9"]));
        // what the hints play is what the lesson names
        expect(m.voicingHints!.map((h) => [...h.lh, ...h.rh].map(chroma))).toEqual([f.iiGrip, f.vGrip, f.iGrip].map((g) => g.map(chroma)));
        expect(f.toV.map((v) => v.semitones)).toEqual([0, 0, -1, 0]);
        expect(f.toI.map((v) => v.semitones)).toEqual([-1, -2, 0, -2]);
        expect(f.I).toBe(`${T}maj9`);
        const l = lessonForMove(m)!;
        expect(l.steps[1].ask!.answer).toEqual([f.vGrip[2]]);
        for (const n of [...f.iiGrip, ...f.vGrip, ...f.iGrip]) expect(doubled(n), n).toBe(false);
      }),
    );
  });

  it("upper structure ♭VI: the triad a major 3rd below the root reads ♭13, root, ♯9 over the root–♭7–3 shell, and its common keys are the target's", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("voicing.upperStructureBVI", T);
        const f = m.facts.learn as UpperStructureBVILearn;
        expect(f.triad.map((n) => above(f.root, n))).toEqual([8, 0, 3]);
        expect(f.shell.map((n) => above(f.root, n))).toEqual([0, 10, 4]);
        expect(chroma(f.sharpNine)).toBe(chroma(f.triad[2]));
        const target = new Set(chordTones({ root: T, quality: "m6", extensions: [], alterations: [] }).map((t) => chroma(t.note))); // the canonical im6
        for (const n of f.common) expect(target.has(chroma(n)), n).toBe(true);
        expect(f.thirdResolves).toMatchObject({ semitones: 1 });
        expect(chroma(f.thirdResolves.to)).toBe(chroma(T));
        expect(lessonForMove(m)!.steps[1].ask!.answer).toEqual(f.triad);
        for (const n of [...f.triad, ...f.shell, f.sharpNine]) expect(doubled(n), n).toBe(false);
      }),
    );
  });

  it("upper structure II: the triad a whole step above the root is the 9th, ♯11 and 13th, spelled as those degrees, over the root–3–♭7 shell", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("voicing.upperStructureII", T);
        const f = m.facts.learn as UpperStructureIILearn;
        expect(f.triad.map((n) => above(f.root, n))).toEqual([2, 6, 9]);
        expect(f.shell.map((n) => above(f.root, n))).toEqual([0, 4, 10]);
        // spelled as degrees: the ♯11 is a raised 4th letter (E♯ over B), the natural 11 the plain one
        expect(f.triad).toEqual([f.triadRoot, ...["#11", "13"].map((d) => readable(transpose(f.root, d)))]);
        expect(above(f.naturalEleven, f.triad[1])).toBe(1);
        expect(above(f.parentMelodicMinor, f.root)).toBe(5);
        expect(lessonForMove(m)!.steps[1].ask!.answer).toEqual(f.triad);
      }),
    );
  });

  it("♭VI–♭VII–I: the bass climbs two whole steps home, ♭VII6/9 holds the home root as its 9th and lacks the leading tone, and differs from the backdoor's ♭VII7 by one key", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const m = moveIn("modal.flatSixFlatSeven", T);
        const f = m.facts.learn as FlatSixFlatSevenLearn;
        expect([above(f.bVIRoot, f.bVIIRoot), above(f.bVIIRoot, f.targetRoot)]).toEqual([2, 2]);
        expect(chroma(f.bVIINinth)).toBe(chroma(T));
        const bVII = new Set(chordTones(m.chords[1]).map((t) => chroma(t.note)));
        expect(bVII.has(chroma(f.leadingTone))).toBe(false);
        expect(above(f.leadingTone, T)).toBe(1);
        expect(f.bVII).toMatch(/6\/9$/);
        // ♭VII6/9 has no tritone; the backdoor's ♭VII7 swaps its 6th for a ♭7 and gets one
        const pcsList = [...bVII];
        expect(pcsList.some((a) => bVII.has(mod(a + 6, 12)))).toBe(false);
        expect(above(f.bVIISixth, f.backdoorSeventh)).toBe(1);
        expect(lessonForMove(m)!.steps[1].ask!.answer).toEqual([f.bVIRoot, f.bVIIRoot, f.targetRoot]);
      }),
    );
  });

  it("basics: guide tones and dominant resolution light exactly guideTones() and transpose(), and agree with the engine's voice motion", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const V7 = { root: transpose(T, "5"), quality: "7" as const, extensions: [], alterations: [] };
        const I = { root: T, quality: "maj7" as const, extensions: [], alterations: [] };
        const [g3, g7] = guideTones(V7).map((t) => t.note);
        expect(basicsLesson("basics:guideTones", T)!.steps[0].highlight.map((h) => h.note)).toEqual([g3, g7]);
        const res = basicsLesson("basics:dominantResolution", T)!;
        expect(res.steps[3].highlight.map((h) => h.note)).toEqual([g3, T, g7, transpose(T, "3")]);
        expect(nearestMotion(g3, triadTones(I)).to).toBe(T);
        expect(nearestMotion(g7, triadTones(I)).to).toBe(transpose(T, "3"));
        const tri = basicsLesson("basics:tritone", T)!;
        const [a, b] = tri.steps[0].highlight.map((h) => h.note);
        expect(mod(chroma(b) - chroma(a), 12)).toBe(6);
      }),
    );
  });
});

describe("the new basics are the engine's notes, in every key", () => {
  const gaps = (ns: string[]) => ns.slice(1).map((n, i) => mod(chroma(n) - chroma(ns[i]), 12));

  it("7th chords: the dominant 7th is chordTones(), and the maj7/m7 changes are transpose()", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const G = transpose(T, "5");
        const l = basicsLesson("basics:sevenths", T)!;
        expect(l.steps[0].highlight.map((h) => h.note)).toEqual(chordTones({ root: G, quality: "7", extensions: [], alterations: [] }).map((t) => t.note));
        expect(l.steps[0].highlight.map((h) => h.note)).toEqual(["1", "3", "5", "b7"].map((d) => transpose(G, d)));
        expect(l.steps[1].highlight[3].note).toBe(transpose(G, "7"));
        expect(l.steps[2].ask!.answer).toEqual([transpose(G, "b3")]);
      }),
    );
  });

  it("numerals: V is the 5th step, ii the 2nd, ♭II and ♭VII a half step under 2 and 7", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const l = basicsLesson("basics:numerals", T)!;
        expect(l.steps[1].ask!.answer).toEqual([transpose(T, "5")]);
        expect(l.steps[2].highlight[0].note).toBe(transpose(T, "2"));
        const lit = Object.fromEntries(l.steps[3].highlight.map((h) => [h.label, chroma(h.note)]));
        expect(lit["♭II"]).toBe(mod(chroma(T) + 1, 12));
        // a respelled ♭II (D for E♭♭ in D♭) is shown under the step it drops from, not beside ♭VII
        if (lit["♭VII"] === undefined) {
          expect(lit["2"]).toBe(mod(chroma(T) + 2, 12));
          expect(l.steps[3].text).toMatch(/a half step below/);
        } else expect(lit["♭VII"]).toBe(mod(chroma(T) + 10, 12));
      }),
    );
    expect(basicsLesson("basics:numerals", "Db")!.steps[3].text).toBe("Add ♭ and the root drops a half step: ♭II in D♭ is D, a half step below E♭.");
  });

  it("extensions: every tension is transpose() from the V, by ear where a double accidental is respelled", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const G = transpose(T, "5");
        const l = basicsLesson("basics:extensions", T)!;
        const at = (d: string) => chroma(transpose(G, d));
        expect(l.steps[0].highlight.map((h) => h.note).slice(1)).toEqual(["9", "11", "13"].map((d) => transpose(G, d)));
        expect(chroma(l.steps[2].highlight[0].note)).toBe(at("#11"));
        expect(l.steps[3].highlight.map((h) => chroma(h.note))).toEqual([at("b9"), at("#9"), at("b13")]);
        expect(l.steps[3].ask!.answer.map(chroma)).toEqual([at("b9"), at("b13")]);
        expect(l.steps[4].highlight.map((h) => h.note)).toEqual([...guideTones({ root: G, quality: "7", extensions: [], alterations: [] }).map((t) => t.note), transpose(G, "9"), transpose(G, "13")]);
      }),
    );
  });

  it("dim7: four minor 3rds that close the octave, G7(♭9) without its root, no double accidentals", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const l = basicsLesson("basics:dim7", T)!;
        const dim = l.steps[0].highlight.map((h) => h.note);
        expect(gaps([...dim, dim[0]])).toEqual([3, 3, 3, 3]);
        expect(chroma(dim[0])).toBe(chroma(transpose(T, "7")));
        const V7b9 = chordTones({ root: transpose(T, "5"), quality: "7", extensions: [], alterations: ["b9"] }).filter((t) => t.degree !== "1");
        expect(dim.map(chroma).sort()).toEqual(V7b9.map((t) => chroma(t.note)).sort());
        for (const n of dim) expect(n).not.toMatch(/bb|##/);
        expect(l.steps[3].highlight.map((h) => h.note)).toEqual([dim[0], T, dim[3], transpose(T, "5")]);
      }),
    );
  });

  it("major-3rd cycles: each step is 4 half steps and three of them come home", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KEYS), (T) => {
        const l = basicsLesson("basics:symmetricOctave", T)!;
        const cycle = l.steps[0].highlight.map((h) => h.note);
        expect(cycle[0]).toBe(T);
        expect(cycle[1]).toBe(transpose(T, "3"));
        expect(gaps([...cycle, T])).toEqual([4, 4, 4]);
        expect(l.steps[1].ask!.answer).toEqual([T]);
      }),
    );
  });
});

describe("the reference rewrites (Co-op Blues in F, the plan's examples)", () => {
  const lessonAt = (id: string) => ruleLessons.find((r) => r.where.startsWith(`coop-blues in F: ${id}`))?.lesson;

  it("the tritone sub at bar 10 reads C7 → G♭9 → F6 with E respelled F♭", () => {
    const l = lessonAt("dominant.tritoneSub@10.1");
    expect(l?.headline).toBe("Play G♭9 instead of C7. Same two tense notes, but the bass slides down a half step into F6.");
    expect(l?.steps[2].text).toBe("C7's guide tones: E and B♭. G♭9 swaps them: B♭ is its 3rd, F♭ (same key as E) its 7th.");
    expect(l?.steps[3].text).toBe("Both pull the same way: E rises to F, B♭ falls to A. That's the resolution into F6.");
    expect(l?.steps[4].text).toContain("G♭ slides down a half step to F, not C falling a fifth");
  });

  it("the teacher's wording for Coltrane, constant structure and one note on top, in C", () => {
    const col = lessonForMove(canonicalMove("symmetric.coltraneSubstitution", "C")!)!;
    expect(col.steps[0].text).toBe("The map first: three key centres, A♭, E and C, a major 3rd apart.");
    expect(col.steps[0].map).toEqual(["Ab", "E", "C"]);
    expect(col.steps[1].ask!.prompt).toBe("Each key gets its own V7. Tap the root a fifth above A♭.");
    // one descending voice with its hold run folded: not called a guide-tone line
    expect(col.steps[2].text).toBe("One voice carries it: F, E♭ (held, respelled D♯), D, C.");
    expect(col.steps.map((s) => s.text).join(" ")).not.toMatch(/guide/);
    const cs = lessonForMove(canonicalMove("chromatic.constantStructure", "C")!)!;
    expect(cs.headline).toBe("Slide into Cmaj7 with its own shape: Dmaj7 → D♭maj7 → Cmaj7, the whole hand moving together.");
    expect(cs.steps[2].text).toBe("Slide down: D♭ to C, F to E, A♭ to G, C to B. Every voice moves together.");
    const top = lessonForMove(canonicalMove("melody.oneNoteOnTop", "C")!)!;
    expect(top.steps[2].text).toBe("Over D, G is the sus 4th of D7sus4; over D♭, it's the ♯11 of D♭7(♯11).");
    expect(top.deeper).toBe("The interval from bass to top note suggests the chord: a half step above the bass gives 7(♭9), a tritone 7(♯11).");
  });

  it("the teacher's wording for the diminished and chromatic moves, in C", () => {
    const lesson = (id: string) => lessonForMove(canonicalMove(id, "C")!)!;
    const med = lesson("dominant.mediantDominant");
    expect(med.steps[0]).toMatchObject({ text: "Add the ♭9 to G7 and drop the root: B, D, F, A♭, a diminished 7th.", prereqLink: "basics:dim7" });
    expect(med.steps[1].text).toBe("Put E under them: G♯ (same key as A♭), B, D and F make E7(♭9).");
    // by root (5f): "E7" would be a second name for this move's E7(♭9)
    expect(med.steps[3].text).toBe("With a ♭9, the dominants on G, B♭, D♭ and E all hold these four keys: the Family.");
    // gospel: the landing is what the voices make, the grip is playable, the sub keeps G7's root as its ♯11
    const gos = lesson("gospel.halfStepTurnaround");
    expect(gos.headline).toBe("Turn G7 → Cmaj7 into F/G → D♭13(♯11) → Cmaj13: a slide into home from a half step above.");
    expect(gos.steps[2].text).toBe("Left hand D♭, C♭, F; right hand the E♭ triad: the 9th, ♯11 and 13th.");
    expect(gos.steps[3].text).toBe("Into Cmaj13, D♭, F, E♭ and B♭ fall a half step; G and C♭ (same key as B) hold.");
    expect(gos.deeper).toBe("D♭13(♯11)'s ♯11 is G: the sub keeps G7's root inside, as the ♯11.");
    const up = lesson("chromatic.passingDiminished");
    expect(up.steps[1].text).toBe("C♯, E, G, B♭ are A7(♭9) without A: its 3rd, 5th, 7th and ♭9.");
    expect(up.steps[2].text).toBe("So C♯dim7 works as Dm7's V7(♭9) with no root: C♯ rises to D, B♭ falls to A.");
    const down = ruleLessons.find((r) => r.where === "C edge 26")!.lesson;
    expect(down.headline).toBe("Between Em7 and Dm7, slip in E♭dim7: the bass walks down E, E♭, D by half steps.");
    expect(down.steps.map((s) => s.text)).toEqual([
      "E to D is a whole step. E♭dim7 fills it, so the bass walks down by half steps.",
      "E♭dim7 already holds A and C, Dm7's 5th and 7th.",
      "The other keys move: E♭ falls to D and G♭ falls to F.",
    ]);
    // spelled by direction: sharps rise (Itai's yes, Gate 0 item 8)
    const ct = lesson("chromatic.commonToneDiminished");
    expect(ct.steps.map((s) => s.text)).toEqual([
      "Cdim7 is C, D♯, F♯, A: it shares only C with Cmaj7, and the bass stays.",
      "D♯ rises to E, the 3rd; F♯ rises to G, the 5th.",
      "D♯ and F♯ are appoggiaturas: tension on the beat that resolves up into Cmaj7.",
    ]);
    const lc = lesson("chromatic.minorLineCliche");
    expect(lc.steps[2].text).toBe("Each stop renames the chord: Cm, Cm(maj7), Cm7, Cm6.");
    expect(lc.rule).toBe("Over a long minor chord, hold the 3rd and 5th; walk the root voice down, inside or in the bass: 1, 7, ♭7, 6.");
  });

  it("the teacher's wording for the voicing and borrowed-chord moves, in C", () => {
    const lesson = (id: string) => lessonForMove(canonicalMove(id, "C")!)!;
    // rootless: lands on Cmaj9 (E G B D is what sounds), grips moved voice to voice (A falls to G, not to a tie)
    const rl = lesson("voicing.rootlessTwoFiveOne");
    expect(rl.headline).toBe("Voice Dm9 → G13 → Cmaj9 without roots: one finger moves from ii to V.");
    expect(rl.steps.map((s) => s.text)).toEqual([
      "Play Dm9 rootless: F, A, C, E, its 3rd, 5th, 7th and 9th.",
      "Only C moves: it falls a half step to B, G13's 3rd. F, A and E stay.",
      "Now F, A, B, E read as G13's 7th, 9th, 3rd and 13th.",
      "Into Cmaj9, F falls to E, A to G, E to D; B holds.",
    ]);
    expect(rl.deeper).toBe("Grip A has the 3rd on the bottom, grip B the 7th. Start ii on either; each fifth down swaps them.");
    // upper structure ♭VI: E♭ over G is ♭13, root, ♯9 (G altered)
    const b6 = lesson("voicing.upperStructureBVI");
    // the shell by its notes (5f): "G7's shell" named the chord a second way when the chart says G7(♭9)
    expect(b6.headline).toBe("Play the E♭ triad over G, F and B: one hand shape gives you G7(♯9,♭13).");
    expect(b6.steps[2].text).toBe("Over G, the triad reads ♭13, root, ♯9: B♭ (same key as A♯) is the ♯9.");
    expect(b6.steps[3].text).toBe("Into Cm6, B rises to C, and E♭ and G are already there.");
    expect(b6.deeper).toBe("All three triad notes sit in G altered, so the right hand can keep going in that scale.");
    // upper structure II: 9, ♯11, 13 over the shell, Lydian dominant (melodic minor's 4th mode)
    const two = lesson("voicing.upperStructureII");
    expect(two.headline).toBe("Play the A major triad over G, B and F: G13(♯11), bright and open.");
    expect(two.steps[2].text).toBe("Over G, A is the 9th, C♯ the ♯11, E the 13th.");
    expect(two.steps[3].text).toBe("C♯ is the bright note: a ♯11 where a plain C would rub against B, the 3rd.");
    expect(two.deeper).toBe("Together they're G Lydian dominant without its 5th: the 4th mode of D melodic minor.");
    // ♭VI–♭VII: borrowed from the parallel minor; the deeper line cites the backdoor
    const fl = lesson("modal.flatSixFlatSeven");
    expect(fl.headline).toBe("Replace G7 with A♭maj7 → B♭6/9: the bass climbs two whole steps into C.");
    expect(fl.steps[0]).toMatchObject({ text: "A♭maj7 and B♭6/9 are borrowed from C minor: they sit on its ♭6 and ♭7.", term: "borrowed", prereqLink: "basics:parallelMinor" });
    expect(fl.steps[2].text).toBe("B♭6/9 has no B: nothing leans up into C. Its 9th is C, already home.");
    expect(fl.deeper).toBe("B♭6/9 is the backdoor's ♭VII with G in place of A♭: same root, no tritone.");
  });

  it("the gospel turnaround into Co-op Blues' F6 lands on F6/9: the ♭7 rises, the ♯11 holds", () => {
    const l = lessonAt("gospel.halfStepTurnaround@10.1")!;
    expect(l.headline).toBe("Turn C7 → F6 into B♭/C → G♭13(♯11) → F6/9: a slide into home from a half step above.");
    expect(l.steps[3].text).toBe("Into F6/9, G♭, B♭, A♭ and E♭ fall a half step; F♭ rises to F; C holds.");
    expect(l.steps[3].ask!.answer).toEqual(["C"]);
  });

  it("the backdoor names the missing leading tone, not a missing tritone", () => {
    const l = lessonAt("modal.backdoorTwoFive@10.1");
    expect(l?.steps[1].text).toBe("E♭9 has no E, so no leading tone pushes up into F.");
    expect(l?.steps.map((s) => s.text).join(" ")).not.toMatch(/no tritone/);
  });
});

describe("shipped-copy fixes (teacher's notes)", () => {
  it("guide tones step 2 says what the 7th rules out, in every key", () => {
    expect(basicsLesson("basics:guideTones", "C")!.steps[1].text).toBe("B, the 3rd, makes G7 major. F, not F♯, makes it a dominant 7th: F♯ would make Gmaj7.");
    expect(basicsLesson("basics:guideTones", "Bb")!.steps[1].text).toBe("A, the 3rd, makes F7 major. E♭, not E, makes it a dominant 7th: E would make Fmaj7.");
    expect(basicsLesson("basics:guideTones", "C")!.steps[2].text).toBe("With G in the bass, B and F alone still sound like G7.");
  });

  it("the borrowed iv lands bittersweet, softer than V–I", () => {
    const l = ruleLessons.find((r) => r.where.startsWith("C edge") && r.lesson.conceptId === "modal.borrowedIv")!.lesson;
    expect(l.steps[3].text).toBe("That line, A → A♭ → G, is the minor plagal sound: bittersweet, a softer landing than V–I.");
  });

  it("the teacher's wording for extensions, major-3rd cycles and the dim7, in C", () => {
    const ext = basicsLesson("basics:extensions", "C")!;
    // 5f: "make it sus" used a term the lesson never declares (it has its two: tensions, avoid note)
    expect(ext.steps[2].text).toBe("Raise it to C♯, or drop B so C replaces the 3rd.");
    expect(ext.steps[3].text).toBe("A dominant may bend the 9th or flatten the 13th: A♭ or A♯, and E♭.");
    expect(basicsLesson("basics:symmetricOctave", "C")!.steps[0].text).toBe("C up a major 3rd is E. E up a major 3rd is G♯; we spell it A♭, C's ♭6.");
    expect(basicsLesson("basics:dim7", "C")!.steps[1].text).toBe("Past A♭ comes C♭ (same key as B): the shape repeats every minor 3rd, so only three diminished 7ths exist."); // P6: the missing step named
    expect(basicsLesson("basics:dim7", "C")!.deeper).toBe("So four dominants, G7, B♭7, D♭7 and E7, share Bdim7 once they take the ♭9.");
  });
});
