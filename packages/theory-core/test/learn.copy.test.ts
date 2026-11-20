import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordTones, guideTones, triadTones } from "../src/chords";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES } from "../src/index";
import {
  basicsLesson,
  categoryEntry,
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
  type Lesson,
  type LessonFlag,
  type TritoneSubLearn,
} from "../src/learn";
import { ARTICLE_BEFORE_NOTE } from "../src/learn/lesson";
import { chroma, mod, transpose } from "../src/pitch";
import { secondaryDominant, secondaryTwoFive, tritoneSub } from "../src/rules";
import { backdoorTwoFive, borrowedIv } from "../src/rulesAdvanced";
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
const SLICE = ["dominant.tritoneSub", "functional.secondaryDominant", "functional.secondaryTwoFive", "modal.borrowedIv", "modal.backdoorTwoFive"];
const BANNED = /\b(simply|just|of course|obviously|basically|magical|lush|sophisticated|spice up|jazzy|game-changer|secret|unlock|let's dive in|it's important to note)\b/i;

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);

// ── every lesson the app can show: basics in 12 keys, rule lessons on every bundled tune in 12 keys, plus edge cases ──

const base = someday.harmony[0];
const ch = (root: string, quality: Quality, beats = 4): ChordEvent =>
  ({ ...base, root, quality, beats, extensions: [], alterations: [], analysis: undefined, display: undefined, bass: undefined }) as ChordEvent;
const tuneIn = (tonic: string): Tune => ({ ...someday, key: { tonic, mode: "major" } }) as Tune;

function edgeCases(T: string) {
  const at = (d: string) => transpose(T, d);
  const ctx = (chord: ChordEvent, next: ChordEvent) => ({ tune: tuneIn(T), index: 0, chord, next });
  return [
    tritoneSub.propose(ctx(ch(at("5"), "7"), ch(T, "maj7"))),
    secondaryDominant.propose(ctx(ch(at("6"), "m7"), ch(at("2"), "m7"))), // raised 3rd, minor target
    secondaryDominant.propose(ctx(ch(T, "maj7"), ch(at("4"), "maj7"))), // lowered 7th
    secondaryDominant.propose(ctx(ch(at("2"), "m7"), ch(at("5"), "7"))), // kept ♭7
    secondaryDominant.propose(ctx(ch(T, "6"), ch(at("4"), "maj7"))), // added ♭7
    secondaryTwoFive.propose(ctx(ch(at("4"), "7"), ch(T, "maj7"))),
    secondaryTwoFive.propose(ctx(ch(at("5"), "7"), ch(T, "maj7"))), // related ii
    secondaryTwoFive.propose(ctx(ch(at("4"), "maj7"), ch(at("6"), "m7"))), // minor target
    borrowedIv.propose(ctx(ch(at("4"), "maj7"), ch(T, "maj7"))),
    borrowedIv.propose(ctx(ch(at("4"), "maj7", 1), ch(T, "maj7"))), // no room to keep IV
    backdoorTwoFive.propose(ctx(ch(at("5"), "7"), ch(T, "maj7"))),
    backdoorTwoFive.propose(ctx(ch(at("5"), "7", 1), ch(T, "maj7"))), // ♭VII7 alone
  ]
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p, i) => ({ ruleId: [SLICE[0], SLICE[1], SLICE[1], SLICE[1], SLICE[1], SLICE[2], SLICE[2], SLICE[2], SLICE[3], SLICE[3], SLICE[4], SLICE[4]][i], facts: p.facts, where: `${T} edge ${i}` }));
}

const fromTunes = [...BUNDLED_TUNES, someday].flatMap((t) =>
  KEYS.flatMap((k) =>
    generateMoves(transposeTune(t, k))
      .accepted.filter((m) => hasRuleLesson(m.ruleId))
      .map((m) => ({ ruleId: m.ruleId, facts: m.facts, where: `${t.id} in ${k}: ${m.id}` })),
  ),
);

const ruleLessons = [...fromTunes, ...KEYS.flatMap(edgeCases)].map((m) => ({ where: m.where, lesson: lessonForMove(m)! }));
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

  it("every lesson in every key keeps to the budgets, the glossary and the house spelling", () => {
    for (const { where, lesson: l } of ALL) {
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
      // basics: no double flats or sharps anywhere a reader or the keyboard sees them (rule lessons
      // print the engine's spelling, e.g. A♭7's ♭9 as B♭♭; tidying those is 5a's display helper)
      const basic = isBasicsId(l.conceptId);
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
        if (basic) expect(text, `${at}: double accidental in "${text}"`).not.toMatch(/♭♭|♯♯|𝄫|𝄪/u);
        expect(text, `${at}: "a"/"an" before a note name in "${text}"`).not.toMatch(ARTICLE_BEFORE_NOTE);
      }
    }
  }, 30_000); // ~3k lessons: seconds alone, longer beside the other suites
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

describe("prerequisite summaries", () => {
  it("count the prerequisite lessons' steps, in every key", () => {
    for (const k of KEYS) {
      const s = prereqSummary("dominant.tritoneSub", k)!;
      expect(s.prereqs.map((p) => p.id)).toEqual(["basics:tritone", "basics:dominantResolution"]);
      expect(s.steps).toBe(basicsLesson("basics:tritone", k)!.steps.length + basicsLesson("basics:dominantResolution", k)!.steps.length);
      expect(s.steps).toBeGreaterThan(0);
    }
    expect(prereqSummary("basics:dominantResolution", "C")!.sentence).toBe("This builds on guide tones (3 steps).");
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
        const [bII, bVII] = l.steps[3].highlight.map((h) => chroma(h.note));
        expect(bII).toBe(mod(chroma(T) + 1, 12));
        expect(bVII).toBe(mod(chroma(T) + 10, 12));
      }),
    );
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
    expect(ext.steps[2].text).toBe("Raise it to C♯, or drop B and make it sus.");
    expect(ext.steps[3].text).toBe("A dominant may bend the 9th or flatten the 13th: A♭ or A♯, and E♭.");
    expect(basicsLesson("basics:symmetricOctave", "C")!.steps[0].text).toBe("C up a major 3rd is E. E up a major 3rd is G♯; we spell it A♭, C's ♭6.");
    expect(basicsLesson("basics:dim7", "C")!.steps[1].text).toBe("Past A♭, the next minor 3rd is C♭ (same key as B), so only three different diminished 7ths exist.");
    expect(basicsLesson("basics:dim7", "C")!.deeper).toBe("So four dominants, G7, B♭7, D♭7 and E7, share Bdim7 once they take the ♭9.");
  });
});
