import { generateMoves, referenceTune } from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFacts } from "../src/explain";

// The Deep Dive cache key is sha256(PROMPT_VERSION|MODEL|facts), so any change to buildFacts' output rolls every
// cached explanation. This pin makes that roll deliberate: re-pin it only when the facts are meant to change.
const TRITONE_SUB = "dominant.tritoneSub@10.1";
// Re-pinned in 4a (was 3330b645…92f8): the draft (move.text) is now the lesson's words. No API key was configured, so the roll cost nothing.
const PINNED_SHA256 = "a21b6c389ec47626006c322db39dcba4cec00da600e72a328c0d21d08d26592e";

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

  it("is byte-stable for the reference tritone sub (cache keys hold)", () => {
    const hash = createHash("sha256").update(JSON.stringify(buildFacts(referenceTune, move!))).digest("hex");
    expect(hash).toBe(PINNED_SHA256);
  });
});
