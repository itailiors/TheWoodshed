import { describe, expect, it } from "vitest";
import { symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { coopBlues } from "../src/fixtures/coopBlues";
import { someday } from "../src/fixtures/someday";
import { BUNDLED_TUNES, canonicalMove } from "../src/index";
import { lessonForMove } from "../src/learn/ruleLesson";
import { prettySymbol } from "../src/pitch";
import type { Rule } from "../src/ruleKit";
import { RULES } from "../src/ruleset";
import { KEYS, transposeTune } from "../src/transpose";
import { secondaryTwoFive, tritoneSub } from "../src/rules";
import { backdoorTwoFive } from "../src/rulesAdvanced";
import { sortedHarmony } from "../src/time";
import type { ChordEvent, MoveText, Quality, Tune } from "../src/types";

/*
 * Pins the move-card text that was wrong in the shipped demo: one chord with two names,
 * a "same keys spelled differently" that was only half true, a backdoor said to have "no
 * tritone resolving", and a ii–V that "briefly makes it sound like home" when the target is home.
 * Since 4a a lessoned rule's text IS its lesson (summary = headline, theory = the steps), so the
 * claims are pinned on the lesson's words, as the engine hands them out.
 */
const { accepted } = generateMoves(coopBlues);
const text = (id: string) => {
  const m = accepted.find((x) => x.id === id);
  if (!m) throw new Error(`no accepted move ${id}`);
  return m.text;
};

const base = coopBlues.harmony[0];
const ch = (root: string, quality: Quality): ChordEvent =>
  ({ ...base, root, quality, extensions: [], alterations: [], analysis: undefined, display: undefined, bass: undefined }) as ChordEvent;

/** One rule over two bars, chord → next, with no melody: the move's text as the engine builds it. */
function moveText(rule: Rule, chord: ChordEvent, next: ChordEvent, key: Tune["key"] = coopBlues.key): MoveText {
  const at = (bar: number, c: ChordEvent, id: string): ChordEvent => ({ ...c, id, at: { bar, beat: 1 }, beats: 4 });
  const tune: Tune = { ...coopBlues, key, harmony: [at(1, chord, "a"), at(2, next, "b")], melody: [], melodyCoverage: "none" };
  const m = generateMoves(tune, [rule]).accepted[0];
  if (!m) throw new Error(`${rule.id} made no move`);
  return m.text;
}

describe("move-card copy", () => {
  it("the tritone sub names the substitute one way and respells only the key that changes", () => {
    const t = text("dominant.tritoneSub@10.1");
    expect(t.summary).toContain("G♭9");
    expect(t.summary).not.toMatch(/G♭7/);
    expect(t.theory).not.toMatch(/G♭7/);
    expect(t.theory).toContain("C7's guide tones: E and B♭.");
    expect(t.theory).toContain("G♭9 swaps them: B♭ is its 3rd, F♭ (same key as E) its 7th.");
    expect(t.theory).not.toMatch(/same key as B♭|spelled differently/);
  });

  it("the tritone sub respells the other key when the sub's root is simplified (D♭7 → G7)", () => {
    const t = moveText(tritoneSub, ch("Db", "7"), ch("Gb", "maj7"));
    expect(t.theory).toContain("D♭7's guide tones: F and C♭.");
    expect(t.theory).toContain("G9 swaps them: B (same key as C♭) is its 3rd, F its 7th.");
  });

  it("the backdoor names the missing leading tone, spelled from the original chord", () => {
    const t = text("modal.backdoorTwoFive@10.1");
    expect(t.summary).toMatch(/Darker than C7, with no E leaning up into F\.$/);
    expect(t.theory).toContain("E♭9 has no E, so no leading tone pushes up into F.");
    expect(`${t.summary} ${t.theory}`).not.toMatch(/no tritone/);
    // D♭7 → F♯ resolves by chroma; the leading tone is D♭7's F, not E♯
    const p = moveText(backdoorTwoFive, ch("Db", "7"), ch("F#", "maj7"));
    expect(p.summary).toContain("with no F leaning up into F♯");
    expect(p.theory).not.toMatch(/E♯/);
  });

  it("a ii–V never says it 'briefly' sounds like home, into the tonic or anywhere else", () => {
    const t = text("functional.secondaryTwoFive@2.1");
    expect(t.summary).toMatch(/: a ii–V that walks you into F6\.$/);
    expect(t.theory).toMatch(/^We drop B♭7 and set up F6 with its own V, C7\(♭9\)/);
    // a minor-major tonic, whose roman ("i(maj7)") isn't a plain "i"
    const p = moveText(secondaryTwoFive, ch("Eb", "maj7"), { ...ch("C", "mMaj7"), analysis: { roman: "i(maj7)", func: "T" } }, { tonic: "C", mode: "minor" });
    // a non-tonic target
    const q = moveText(secondaryTwoFive, ch("F", "6"), ch("G", "m7"));
    for (const x of [t, p, q]) expect(`${x.summary} ${x.theory}`).not.toMatch(/briefly|sound like home/);
    expect(q.theory).toContain("half-diminished because Gm7 is minor");
  });

  it("the gospel turnaround calls the original dominant by the name on the chart", () => {
    const t = text("gospel.halfStepTurnaround@10.1");
    expect(t.theory).toContain("the tritone sub of C7,");
  });
});

describe("one name per chord, every rule (5f)", () => {
  /*
   * Style guide rule 6: never call one chord G♭9 in one sentence and G♭7 in the next. Every chord
   * symbol a move's words print (title, card text, every lesson step and ask) must be the name of a
   * chord the move declares: on the chart, in the move, its target, or one its lesson facts name
   * (the line cliché's stops, the gospel landing). And none may be a chart chord with its
   * alterations dropped ("A7" for the chart's A7(♭9)) unless the chart has that chord too; a
   * dropped add9 or (maj7) is a different chord (the cliché's stops), not an alteration.
   */
  const SYMBOL = /(?<![\p{L}\p{N}♭♯])[A-G][♭♯]?(?:maj|m|dim|sus|aug|ø|°|\+|add|\d|\/)(?:\([^)\s]*\)|[^\s,.;:!?()'’→])*/gu;
  const strings = (x: unknown): string[] =>
    typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];
  const nameOf = (c: ChordEvent) => prettySymbol(symbol(c));

  it("no move names one chord two ways: bundled tunes and every rule's canonical move, in 12 keys", () => {
    const moves = [
      ...[...BUNDLED_TUNES, someday].flatMap((t) => KEYS.flatMap((k) => generateMoves(transposeTune(t, k)).accepted.map((m) => ({ where: `${t.id} in ${k}`, m })))),
      ...RULES.flatMap((r) => KEYS.map((k) => ({ where: `canonical in ${k}`, m: canonicalMove(r.id, k)! }))),
    ];
    expect(new Set(moves.map(({ m }) => m.ruleId)).size).toBe(17);
    const misses = new Set<string>();
    for (const { where, m } of moves) {
      const chart = new Set([...m.original, ...m.chords].map(nameOf));
      if (m.targetSymbol) chart.add(prettySymbol(m.targetSymbol));
      const declared = new Set([...chart, ...strings((m.facts as { learn?: unknown }).learn).filter((s) => /^[A-G]/.test(s)).map(prettySymbol)]);
      const l = lessonForMove(m);
      const texts = [m.title, m.text.summary, m.text.theory, m.text.recreateRule, m.text.insight ?? "", ...(l ? [l.headline, l.deeper ?? "", ...l.steps.flatMap((s) => [s.text, s.ask?.prompt ?? ""])] : [])];
      for (const text of texts)
        for (const [tok] of text.matchAll(SYMBOL)) {
          if (!declared.has(tok)) misses.add(`${m.ruleId} (${where}, ${m.id}): "${tok}" names no chord of the move in "${text}"`);
          for (const n of chart)
            if (n.startsWith(`${tok}(`) && /^\([^)]*[♭♯]/.test(n.slice(tok.length)) && !chart.has(tok)) misses.add(`${m.ruleId} (${where}, ${m.id}): "${tok}" is ${n} with its alterations dropped, in "${text}"`);
        }
    }
    expect([...misses].slice(0, 10)).toEqual([]);
  }, 30_000);
});

describe("one source for a lessoned move's words (4a)", () => {
  it("summary, theory, rule and insight are the lesson's headline, steps, rule and deeper line", () => {
    const lessoned = accepted.filter((m) => lessonForMove(m));
    expect(lessoned.length).toBeGreaterThan(0);
    for (const m of lessoned) {
      const l = lessonForMove(m)!;
      expect(m.text.summary, m.id).toBe(l.headline);
      expect(m.text.theory, m.id).toBe(l.steps.map((s) => s.text).join(" "));
      expect(m.text.recreateRule, m.id).toBe(l.rule);
      expect(m.text.insight, m.id).toBe(l.deeper);
    }
  });

  it("since 5d every rule has a lesson, so no rule writes text of its own", () => {
    const hs = sortedHarmony(coopBlues);
    for (const m of accepted) {
      const rule = RULES.find((r) => r.id === m.ruleId)!;
      const at = hs.findIndex((c) => c.id === m.replaces[0]);
      const p = rule.propose({ tune: coopBlues, index: at, chord: hs[at], prev: hs[at - 1], next: hs[at + 1], afterNext: hs[at + 2] })!;
      expect(lessonForMove(m), m.id).not.toBeNull();
      expect(p.text, m.id).toBeUndefined();
    }
  });

  // was the e2e "a move without a lesson" until 5d left no lessonless rule to show: the fallback stays for a rule added later
  it("a rule without a lesson still gets its own words on the card, and one with neither is refused", () => {
    const own: MoveText = { summary: "Own summary.", theory: "Own theory.", recreateRule: "Own rule." };
    const stub = (text?: MoveText): Rule => ({
      id: "test.lessonless",
      name: "Lessonless",
      propose: ({ chord }) => ({ title: "Lessonless", level: 1, category: "functional", styleTags: [], chords: [{ ...chord, extensions: [], alterations: [] }], facts: {}, ...(text ? { text } : {}) }),
    });
    const m = generateMoves(coopBlues, [stub(own)]).accepted[0];
    expect(lessonForMove(m)).toBeNull();
    expect(m.text).toEqual(own);
    expect(() => generateMoves(coopBlues, [stub()])).toThrow(/no lesson/);
  });
});
