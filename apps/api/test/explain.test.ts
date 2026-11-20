import { BUNDLED_TUNES, generateMoves, KEYS, lessonForMove, prettyNote, referenceTune, transposeTune } from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFacts } from "../src/explain";

// The Deep Dive cache key is sha256(PROMPT_VERSION|MODEL|facts), so any change to buildFacts' output rolls every
// cached explanation. This pin makes that roll deliberate: re-pin it only when the facts are meant to change.
const TRITONE_SUB = "dominant.tritoneSub@10.1";
// Re-pinned in 4a (was 3330b645…92f8): the draft (move.text) is now the lesson's words.
// Re-pinned in 4c (was a21b6c38…592e): the facts carry lesson, pedagogy, prereqs and glossary.
// Re-pinned in 4d (was cff838e4…d524): engineFacts chord symbols in display spelling ("Gb9" → "G♭9"), under 4d's PROMPT_VERSION bump.
// Re-pinned in P6 (was 90a40533…a86b): the tritone sub's deeper line ("So" → "And") is in the draft; the
// facts' key is display-spelled now ("D♭ major"), which leaves this F-major pin alone. PROMPT_VERSION unchanged.
// No API key was configured any of these times, so the rolls cost nothing.
const PINNED_SHA256 = "87b59b6d06a8726d00f60c117a65a0abb32a466f14ae8bd4ef85b4ff02e7f971";

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
    expect(text).not.toMatch(/(?<![\p{L}])[A-G][b#](?![a-ln-z])|#/u); // display spelling only, chord symbols too
    expect(facts.engineFacts).toMatchObject({ original: "C7", sub: "G♭9" });
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

  it("shows the model no ASCII accidental anywhere, the key included, for every bundled tune in 12 keys", () => {
    for (const tune of BUNDLED_TUNES)
      for (const k of KEYS) {
        const t = transposeTune(tune, k);
        for (const m of generateMoves(t).accepted) {
          const text = JSON.stringify(buildFacts(t, m));
          expect(text, `${tune.id} in ${k}: ${m.id}`).not.toMatch(/(?<![\p{L}])[A-G][b#](?![a-ln-z])|#/u);
        }
        expect(buildFacts(t, generateMoves(t).accepted[0]).tune.key).toBe(`${prettyNote(t.key.tonic)} ${t.key.mode}`);
      }
  }, 30_000); // every move of every bundled tune, 12 times: ~12 s alone

  it("prettifies a whole-string chord symbol, never an English word that starts with A–G", () => {
    const move = generateMoves(referenceTune).accepted.find((m) => m.id === TRITONE_SUB)!;
    const facts = buildFacts(referenceTune, { ...move, facts: { ...move.facts, note: "Embellished", label: "Ebm7" } });
    expect(facts.engineFacts).toMatchObject({ note: "Embellished", label: "E♭m7" });
  });

  it("is byte-stable for the reference tritone sub (cache keys hold)", () => {
    const hash = createHash("sha256").update(JSON.stringify(buildFacts(referenceTune, move!))).digest("hex");
    expect(hash).toBe(PINNED_SHA256);
  });
});
