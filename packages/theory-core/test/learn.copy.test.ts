import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { guideTones, triadTones } from "../src/chords";
import { generateMoves } from "../src/engine";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES } from "../src/index";
import { basicsLesson, conceptNode, glossaryEntry, hasRuleLesson, lessonForMove, type Lesson, type TritoneSubLearn } from "../src/learn";
import { chroma, mod, transpose } from "../src/pitch";
import { secondaryDominant, secondaryTwoFive, tritoneSub } from "../src/rules";
import { backdoorTwoFive, borrowedIv } from "../src/rulesAdvanced";
import { KEYS, transposeTune } from "../src/transpose";
import type { ChordEvent, Quality, Tune } from "../src/types";
import { nearestMotion } from "../src/voiceLeading";

/*
 * Lesson copy, held to the style guide in every key: one idea per step in 20 words or fewer,
 * no sentence over 25, at most 4 lit keys, one new term per step (two per lesson) and each one
 * in the glossary, no hype, and every note spelled for a reader (B♭, never "Bb").
 */

const BASICS = ["basics:tritone", "basics:guideTones", "basics:dominantResolution", "basics:twoFiveOne", "basics:parallelMinor"];
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
    expect(basicsLessons.every((b) => b.lesson)).toBe(true);
    expect(basicsLesson("basics:dim7", "C")).toBeNull();
    expect(lessonForMove({ ruleId: "voicing.upperStructureBVI", facts: {} })).toBeNull();
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
      const asks = l.steps.flatMap((s, i) => (s.ask ? [i] : []));
      expect(asks, `${at}: one predict-then-reveal, in steps 2–4`).toHaveLength(1);
      expect(asks[0]).toBeGreaterThanOrEqual(1);
      expect(asks[0]).toBeLessThanOrEqual(3);
      for (const text of proseOf(l)) {
        for (const sentence of sentences(text)) expect(words(sentence), `${at}: ${sentence}`).toBeLessThanOrEqual(25);
        expect(text, at).not.toMatch(/undefined|NaN|null|\[object/);
        expect(text, at).not.toMatch(BANNED);
        expect(text, at).not.toMatch(/#/);
        expect(text, `${at}: engine spelling leaked into "${text}"`).not.toMatch(/(?<![A-Za-z])[A-G]b/);
      }
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
