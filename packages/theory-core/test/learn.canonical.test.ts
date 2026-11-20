import { describe, expect, it } from "vitest";
import { conceptDrillSteps } from "../src/coach";
import { anyLesson, CANONICAL_PROGRESSIONS, canonicalLesson, canonicalMove, canonicalTune } from "../src/learn/canonical";
import { basicsLesson, hasRuleLesson, prereqSummary } from "../src/learn";
import { symbol } from "../src/chords";
import { RULES } from "../src/ruleset";
import { KEYS } from "../src/transpose";

/*
 * One table of canonical progressions: every rule, in every key, gets ITS OWN move off it
 * (through the engine), and the lesson read off that move. Coach's concept drill uses the same table.
 */

describe("canonical progressions", () => {
  it("has exactly one entry per rule", () => {
    expect(Object.keys(CANONICAL_PROGRESSIONS).sort()).toEqual(RULES.map((r) => r.id).sort());
  });

  it("every rule fires as itself in all 12 keys", () => {
    for (const r of RULES)
      for (const k of KEYS) {
        const m = canonicalMove(r.id, k);
        expect(m, `${r.id} in ${k}`).not.toBeNull();
        expect(m!.ruleId).toBe(r.id);
        expect(canonicalTune(r.id, k)!.key.tonic).toBe(k);
      }
  });

  it("an unknown rule gets nothing, never another rule's move", () => {
    expect(canonicalTune("nope.rule", "C")).toBeNull();
    expect(canonicalMove("nope.rule", "C")).toBeNull();
    const d = conceptDrillSteps("nope.rule", "C");
    expect(d.move).toBeNull();
    expect(d.steps).toHaveLength(0);
    expect(d.length).toBe(0);
  });

  it("the secondary ii–V is the full ii–V (Fmaj7 → Dm9 G7♭9 into Cmaj7), not the related ii", () => {
    for (const k of KEYS) {
      const m = canonicalMove("functional.secondaryTwoFive", k)!;
      expect(m.level, k).toBe(2);
      expect(m.facts.related).toBe(false);
      expect((m.facts.learn as { related: boolean }).related).toBe(false);
    }
    const c = canonicalMove("functional.secondaryTwoFive", "C")!;
    expect(c.chords.map(symbol)).toEqual(["Dm9", "G7(b9)"]);
    expect(c.targetSymbol).toBe("Cmaj7");
    expect(canonicalLesson("functional.secondaryTwoFive", "C")!.headline).toMatch(/^Swap Fmaj7 for/);
  });

  it("Coach's concept drill is the canonical move, in every key", () => {
    for (const r of RULES)
      for (const k of ["C", "F#", "Bb"]) {
        const d = conceptDrillSteps(r.id, k);
        expect(d.move!.id).toBe(canonicalMove(r.id, k)!.id);
        expect(d.move!.ruleId).toBe(r.id);
      }
  });
});

describe("canonicalLesson", () => {
  it("is non-null for every rule with a lesson, in all 12 keys, and null for the rest", () => {
    for (const r of RULES)
      for (const k of KEYS) {
        const l = canonicalLesson(r.id, k);
        if (hasRuleLesson(r.id)) {
          expect(l, `${r.id} in ${k}`).not.toBeNull();
          expect(l!.conceptId).toBe(r.id);
          expect(l!.steps.length).toBeGreaterThan(0);
        } else expect(l).toBeNull();
      }
  });

  it("anyLesson finds a foundation's basics lesson and a rule's canonical lesson", () => {
    expect(anyLesson("basics:twoFiveOne", "C")).toEqual(basicsLesson("basics:twoFiveOne", "C"));
    expect(anyLesson("modal.borrowedIv", "C")).toEqual(canonicalLesson("modal.borrowedIv", "C"));
    expect(anyLesson("nope", "C")).toBeNull();
  });

  it("feeds prereqSummary, so a rule prerequisite counts its steps", () => {
    const iv = canonicalLesson("modal.borrowedIv", "C")!.steps.length;
    const twoFive = basicsLesson("basics:twoFiveOne", "C")!.steps.length;
    const s = prereqSummary("modal.backdoorTwoFive", "C", { lessonFor: anyLesson })!;
    expect(s.steps).toBe(iv + twoFive);
    expect(s.sentence).toBe(`This builds on borrowed iv and the ii–V–I (${iv + twoFive} steps).`);
    // without it (basics only), the rule prerequisite counts 0 and the line drops the count
    expect(prereqSummary("modal.backdoorTwoFive", "C")!.sentence).not.toMatch(/steps\)/);
  });
});
