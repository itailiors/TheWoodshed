import { generateMoves, referenceTune } from "@reharm/theory-core";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFacts } from "../src/explain";

// The Deep Dive cache key is sha256(PROMPT_VERSION|MODEL|facts), so any change to buildFacts' output rolls every
// cached explanation. This pin makes that roll deliberate: re-pin it only when the facts are meant to change.
const TRITONE_SUB = "dominant.tritoneSub@10.1";
const PINNED_SHA256 = "3330b64541133eb37c136e0b55d3c2e400f064568e5dd68616207c789c4692f8";

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

  it("is byte-stable for the reference tritone sub (cache keys hold)", () => {
    const hash = createHash("sha256").update(JSON.stringify(buildFacts(referenceTune, move!))).digest("hex");
    expect(hash).toBe(PINNED_SHA256);
  });
});
