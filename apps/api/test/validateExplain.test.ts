import { generateMoves, referenceTune } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { templateExplanation } from "../src/demo";
import { buildFacts, DEV, explainMove, keyOf, MODEL, NEGATIVE_TTL_MS, type ExplainCache, type ExplainClient, type ParseResult } from "../src/explain";
import { EXPLAIN_SYSTEM_PROMPT, PROMPT_EXAMPLES } from "../src/prompt";
import { noteTokens, validateExplanation, words, type CheckId, type ExplanationText, type ValidationFacts } from "../src/validateExplain";

/*
 * The Deep Dive validator, one fixture per check, and the retry/negative-cache policy around it,
 * driven by a stubbed client. Nothing here touches the network or the on-disk cache.
 */

const [tritone] = PROMPT_EXAMPLES; // C7 → G♭9 → F6, the reference tune's tritone sub
const GOOD: ExplanationText = tritone.output;
const FACTS: ValidationFacts = tritone.facts;
const checks = (out: Partial<ExplanationText>, facts: ValidationFacts = FACTS): CheckId[] => validateExplanation({ ...GOOD, ...out }, facts).map((f) => f.check);

describe("the prompt's examples", () => {
  it("has 3–5 examples in the cached system block, including a melody-unverified one", () => {
    expect(PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    expect(PROMPT_EXAMPLES.length).toBeLessThanOrEqual(5);
    expect(PROMPT_EXAMPLES.some((e) => !e.facts.move.melodyVerified)).toBe(true);
    expect(EXPLAIN_SYSTEM_PROMPT.match(/<example>/g)?.length).toBe(PROMPT_EXAMPLES.length);
  });

  it.each(PROMPT_EXAMPLES.map((e) => [e.facts.move.name, e] as const))("%s passes every check", (_name, e) => {
    expect(validateExplanation(e.output, e.facts)).toEqual([]);
  });

  it("the tritone-sub example also passes against the real reference facts", () => {
    const move = generateMoves(referenceTune).accepted.find((m) => m.id === "dominant.tritoneSub@10.1")!;
    expect(validateExplanation(GOOD, buildFacts(referenceTune, move))).toEqual([]);
  });
});

describe("noteTokens", () => {
  it("reads notes and chord roots, not words or the sentence-initial article", () => {
    expect(noteTokens("A tritone from C lands on G♭9, then Gm9, C♯dim7, Cmaj7 and B♭m7♭5.")).toEqual(["C", "G♭", "G", "C♯", "C", "B♭"]);
    expect(noteTokens("Bill Evans plays Amazing Dominant chords. A falls? No: a held A, E♭7(♯11), Bø7.")).toEqual(["A", "E♭", "B"]);
  });
});

describe("validateExplanation: one fixture per check", () => {
  it("1. caps: summary, sentence, deepDive length and paragraphs, one-sentence rule", () => {
    expect(checks({ summary: "Play G♭9 instead of C7. " + "The same pull into F6 with a bass that glides instead of jumping down a fifth." })).toEqual(["caps"]);
    const longSentence = "Keep the touch light on G♭9 and lean into F6 while the left hand holds B♭ and F♭ and the right hand sings over the top.";
    expect(words(longSentence)).toBeGreaterThan(25);
    expect(checks({ deepDive: GOOD.deepDive.replace("Keep the touch light on G♭9 and lean into F6.", longSentence) })).toEqual(["caps"]);
    expect(checks({ deepDive: GOOD.deepDive.split("\n\n").slice(0, 2).join("\n\n") })).toEqual(["caps"]); // under 100 words
    expect(checks({ deepDive: GOOD.deepDive.replace(/\n\n/g, " ") })).toEqual(["caps"]); // one paragraph
    expect(checks({ recreateRule: "Keep the 3rd and 7th. Put the root a half step above the target." })).toEqual(["caps"]);
  });

  it("2. banned phrases (the copy test's regex, shared from theory-core)", () => {
    expect(checks({ summary: "Play G♭9 instead of C7. It just glides into F6." })).toEqual(["banned"]);
    expect(checks({ deepDive: GOOD.deepDive.replace("What the ear gets", "The lush sound") })).toEqual(["banned"]);
  });

  it("3. no markdown, no ASCII accidentals", () => {
    expect(checks({ deepDive: "**Sound.** " + GOOD.deepDive })).toEqual(["format"]);
    expect(checks({ deepDive: GOOD.deepDive.replace("Voice it with", "- Voice it with") })).toEqual(["format"]);
    expect(checks({ summary: "Play Gb9 instead of C7. The same pull into F6, with a gliding bass." })).toContain("format");
    expect(checks({ deepDive: GOOD.deepDive.replace("the ♯11", "the #11") })).toEqual(["format"]);
    expect(checks({ deepDive: "Above all, " + GOOD.deepDive })).toEqual([]); // "Ab…" in a word is not a flat
  });

  it("4. every note is in the facts as spelled: a respelling fails", () => {
    expect(checks({ deepDive: GOOD.deepDive.replace("B♭ to A", "A♯ to A") })).toEqual(["spelling"]);
    expect(checks({ deepDive: GOOD.deepDive.replace("F♭ to F", "E to F") })).toEqual([]); // E is in the facts (C7's 3rd)
    expect(checks({ summary: "Play G♭9 instead of C7. The same pull into F6, from F♯ below." })).toEqual(["spelling"]);
  });

  it("5. the deepDive names at least two fact notes", () => {
    const vague =
      "What the ear gets is a darker, smoother dominant. The cadence still lands, but the bass arrives by half step.\n\n" +
      "Voice the 3rd and 7th in the left hand and the 9th on top. Let the 7th ring, then let it rise into the root. Keep the touch light and lean into the arrival. " +
      "For the right hand, the Lydian dominant scale comes first. Aim the line at the guide-tone targets, a half step away. " +
      "The move works on any dominant that falls a fifth, secondary dominants included. It fails when the melody holds the 5th of the old chord, because that turns into a ♭9 against the new root.";
    expect(words(vague)).toBeGreaterThanOrEqual(100);
    expect(checks({ deepDive: vague })).toEqual(["notes"]);
  });

  it("6. redundancy: an 8-word run shared with a lesson step fails", () => {
    const echo = GOOD.deepDive.replace("Keep the touch light on G♭9 and lean into F6.", "Both pull the same way: E rises to F.");
    expect(checks({ deepDive: echo })).toEqual(["redundancy"]);
    // a shorter overlap is fine, and a move with no lesson has nothing to echo
    expect(checks({ deepDive: GOOD.deepDive.replace("Keep the touch light on G♭9 and lean into F6.", "Both pull the same way here.") })).toEqual([]);
    expect(checks({ deepDive: echo }, { ...FACTS, lesson: null })).toEqual([]);
  });

  it("7. recreateRule names no notes", () => {
    expect(checks({ recreateRule: "Over C7 falling to F, play G♭7 instead." })).toEqual(["ruleNotes"]);
  });

  it("8. the melody line matches melodyVerified", () => {
    const unverified = { ...tritone.facts, move: { ...tritone.facts.move, melodyVerified: false } };
    const noMelody = GOOD.deepDive.replace(" It fails when the melody holds G, which turns into a ♭9 against the new root.", " It fails when a held G turns into a ♭9 against the new root.");
    expect(checks({ deepDive: noMelody }, unverified)).toEqual(["melody"]);
    expect(checks({ deepDive: noMelody + " Check the move against the melody in your lead sheet." }, unverified)).toEqual([]);
    expect(checks({ deepDive: GOOD.deepDive + " Check the move against the melody in your lead sheet." })).toEqual(["melody"]);
  });
});

// ── the retry and negative-cache policy, with a stubbed client and a fake clock ──

const move = generateMoves(referenceTune).accepted.find((m) => m.id === "dominant.tritoneSub@10.1")!;
const BAD: ExplanationText = { ...GOOD, summary: "Play G♭9 instead of C7. It just slides." };
type Params = Parameters<ExplainClient["beta"]["messages"]["parse"]>[0];

function stub(answers: ExplanationText[]) {
  const calls: Params[] = [];
  const client: ExplainClient = {
    beta: {
      messages: {
        async parse(params) {
          calls.push(params); // explainMove sends a fresh messages array per call
          const parsed_output = answers[Math.min(calls.length - 1, answers.length - 1)];
          return { stop_reason: "end_turn", parsed_output, model: MODEL, usage: { input_tokens: 1, output_tokens: 1 } } satisfies ParseResult;
        },
      },
    },
  };
  return { client, calls };
}
function memoryCache() {
  const map = new Map<string, Awaited<ReturnType<ExplainCache["get"]>>>();
  const cache: ExplainCache = { get: async (k) => map.get(k), set: async (k, v) => void map.set(k, v) };
  return { cache, map };
}

describe("explainMove: validate, retry at most once, then the template and the negative cache", () => {
  it("serves and caches a first answer that passes, with one call and the §2 request shape", async () => {
    const { client, calls } = stub([GOOD]);
    const { cache, map } = memoryCache();
    const res = await explainMove(referenceTune, move, {}, { client, cache, negative: new Map(), log: () => {} });
    expect(calls).toHaveLength(1);
    expect(res).toMatchObject({ ...GOOD, cached: false });
    expect(map.size).toBe(1);
    const p = calls[0] as Params & Record<string, unknown>;
    expect(p).toMatchObject({ model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "medium" } });
    expect(p.system).toEqual([{ type: "text", text: EXPLAIN_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]);
  });

  it("retries exactly once, listing the failed checks, and caches a passing retry", async () => {
    const { client, calls } = stub([BAD, GOOD]);
    const { cache, map } = memoryCache();
    const res = await explainMove(referenceTune, move, {}, { client, cache, negative: new Map(), log: () => {} });
    expect(calls).toHaveLength(2);
    expect(calls[1].messages).toHaveLength(3);
    expect(calls[1].messages[1]).toMatchObject({ role: "assistant", content: JSON.stringify(BAD) });
    expect(calls[1].messages[2].role).toBe("user");
    expect(String(calls[1].messages[2].content)).toMatch(/Remove "just"/);
    expect(res).toMatchObject({ ...GOOD, cached: false });
    expect(map.size).toBe(1);
  });

  it("after two failures serves the template uncached, never a third call", async () => {
    const { client, calls } = stub([BAD, BAD, GOOD]);
    const { cache, map } = memoryCache();
    const negative = new Map<string, number>();
    const res = await explainMove(referenceTune, move, {}, { client, cache, negative, now: () => 1_000, log: () => {} });
    expect(calls).toHaveLength(2);
    expect(res).toMatchObject({ ...templateExplanation(move), cached: false, source: "template" });
    expect(map.size).toBe(0);
    expect(negative.get(keyOf(buildFacts(referenceTune, move)))).toBe(1_000 + NEGATIVE_TTL_MS);
  });

  it("the negative cache skips the call within the TTL (fresh too) and lets it through after", async () => {
    const { client, calls } = stub([BAD, BAD]);
    const { cache } = memoryCache();
    const negative = new Map<string, number>();
    let t = 0;
    const deps = { client, cache, negative, now: () => t, log: () => {} };
    await explainMove(referenceTune, move, {}, deps);
    expect(calls).toHaveLength(2);

    t = NEGATIVE_TTL_MS - 1;
    expect(await explainMove(referenceTune, move, {}, deps)).toMatchObject({ source: "template" });
    expect(await explainMove(referenceTune, move, { fresh: true }, deps)).toMatchObject({ source: "template" });
    expect(calls).toHaveLength(2);

    t = NEGATIVE_TTL_MS;
    await explainMove(referenceTune, move, {}, deps);
    expect(calls).toHaveLength(4); // expired: one more try, and its retry
  });

  it("logs through the given logger; the default logs only with the API's dev flag (off in tests and production)", async () => {
    expect(DEV).toBe(false);
    const lines: string[] = [];
    const { client } = stub([BAD, BAD]);
    await explainMove(referenceTune, move, {}, { client, cache: memoryCache().cache, negative: new Map(), log: (l) => lines.push(l) });
    expect(lines.some((l) => l.includes("failed: banned"))).toBe(true);
  });
});
