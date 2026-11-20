import { BUNDLED_TUNES, generateMoves, lessonForMove, referenceTune } from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFacts } from "../src/explain";

// The Deep Dive cache key is sha256(PROMPT_VERSION|MODEL|facts), so any change to buildFacts' output rolls every
// cached explanation. This pin makes that roll deliberate: re-pin it only when the facts are meant to change.
const TRITONE_SUB = "dominant.tritoneSub@10.1";
// Re-pinned in 4a (was 3330b645…92f8): the draft (move.text) is now the lesson's words.
// Re-pinned in 4c (was a21b6c38…592e): the facts carry lesson, pedagogy, prereqs and glossary.
// No API key was configured either time, so the rolls cost nothing; 4d's PROMPT_VERSION bump rolls keys once more anyway.
const PINNED_SHA256 = "cff838e4f7a52574f3dba8cda39e60a4f19c786a806e8b887a12f0632a32d524";

describe("buildFacts", () => {
  const move = generateMoves(referenceTune).accepted.find((m) => m.id === TRITONE_SUB);

  it("finds the reference tune's tritone sub", () => {
    expect(move).toBeDefined();
  });

  it("keeps the lesson layer's facts.learn out of what Claude sees", () => {
    expect(move!.facts.learn).toBeDefined(); // the engine still carries it for the UI
    const facts = buildFacts(referenceTune, move!);
    expect(facts.engineFacts).not.toHaveProperty("learn");
    expect(JSON.stringify(facts)).not.toContain('"learn"');
  });

  it("drafts from the lesson: the draft's summary is the lesson headline", () => {
    const facts = buildFacts(referenceTune, move!) as { draft: { summary: string } };
    expect(facts.draft.summary).toBe("Play G♭9 instead of C7. Same two tense notes, but the bass slides down a half step into F6.");
  });

  it("carries the lesson as prose, the rule's pedagogy, prerequisite names and the glossary the lesson uses", () => {
    const facts = buildFacts(referenceTune, move!);
    const lesson = lessonForMove(move!)!;
    expect(facts.lesson).toEqual({ headline: lesson.headline, steps: lesson.steps.map((s) => s.text), rule: lesson.rule });
    expect(facts.lesson!.rule).toBe(move!.text.recreateRule);
    expect(facts.pedagogy).toMatchObject({ formula: expect.any(String), whenToUse: expect.any(String), bandstandCue: expect.any(String) });
    expect(facts.prereqs).toEqual(["The tritone", "Dominant resolution"]);
    expect(facts.glossary.length).toBeGreaterThanOrEqual(1);
    expect(facts.glossary.map((g) => g.term)).toContain("tritone");
    for (const g of facts.glossary) expect(g.gloss).toMatch(/\S/);
    const text = JSON.stringify(facts);
    expect(text).not.toContain("undefined");
    expect(text).not.toMatch(/"(highlight|ask|sound|prereqLink)"/); // keyboard data stays in the UI
    expect(text).not.toMatch(/\b[A-G](b|#)\b/); // display spelling only
  });

  it("gives a move without a lesson null lesson fields, never undefined", () => {
    for (const tune of BUNDLED_TUNES)
      for (const m of generateMoves(tune).accepted) {
        const facts = buildFacts(tune, m);
        expect(JSON.stringify(facts)).not.toContain('"learn"');
        expect(facts.lesson === null || facts.lesson.steps.length > 0).toBe(true);
        expect(Object.values(facts).every((v) => v !== undefined)).toBe(true);
      }
  });

  it("is byte-stable for the reference tritone sub (cache keys hold)", () => {
    const hash = createHash("sha256").update(JSON.stringify(buildFacts(referenceTune, move!))).digest("hex");
    expect(hash).toBe(PINNED_SHA256);
  });
});
