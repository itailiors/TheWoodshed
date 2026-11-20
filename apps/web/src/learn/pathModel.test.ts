import { CONCEPTS, type ConceptStatus } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { demoProgress } from "../library/demoHistory";
import { browserHistory } from "../library/historyBrowser";
import { memoryBackend } from "../library/localPractice";
import { chipFor, conceptLevel, nextUpReason, OPTIONAL_CONCEPTS, pathOrder, prereqLine, recommendedFirstLabel, tierBands } from "./pathModel";
import { ownProgressOnly, pathStates } from "./pathStates";

const NOW = new Date("2026-11-20T12:00:00Z");
const status = (p: Partial<ConceptStatus>): ConceptStatus => ({ id: "x", state: "new", due: false, cleanKeys: 0, recommendedFirst: [], ...p });

describe("the path's tier bands", () => {
  it("hold every concept exactly once, Foundations first, with the spec's headings", () => {
    const bands = tierBands();
    expect(bands.map((b) => b.heading)).toEqual(["Foundations", "First moves", "Core colours", "Borrowed and bold", "Out"]);
    const ids = pathOrder();
    expect(new Set(ids).size).toBe(CONCEPTS.length);
    expect(ids.length).toBe(CONCEPTS.length);
    expect(bands[0].nodes.every((n) => n.id.startsWith("basics:"))).toBe(true);
    for (const id of OPTIONAL_CONCEPTS) expect(bands[0].nodes.some((n) => n.id === id)).toBe(true);
  });

  it("a rule carries its dial level; a basic has none", () => {
    expect(conceptLevel("dominant.tritoneSub")).toBe(2);
    expect(conceptLevel("basics:tritone")).toBeNull();
  });

  it("a card's prerequisites read as Builds on / Pairs well with", () => {
    const sub = CONCEPTS.find((c) => c.id === "dominant.tritoneSub")!;
    expect(prereqLine(sub)).toBe("Builds on: The tritone, Dominant resolution · Pairs well with: Secondary dominant, Roman numerals");
    expect(prereqLine(CONCEPTS.find((c) => c.id === "basics:tritone")!)).toBe("");
  });
});

describe("state chips", () => {
  it("follow the spec's table", () => {
    expect(chipFor(status({ state: "new" }))).toEqual({ kind: "new", text: "" });
    expect(chipFor(status({ state: "recommendedFirst", recommendedFirst: ["basics:guideTones"] })).text).toBe("Recommended first: Guide tones →");
    expect(recommendedFirstLabel(["basics:tritone", "basics:dominantResolution"])).toBe("Recommended first: The tritone +1 →");
    expect(chipFor(status({ state: "learning" })).text).toBe("Learning");
    expect(chipFor(status({ state: "familiar", cleanKeys: 1 })).text).toBe("Familiar");
    expect(chipFor(status({ state: "proficient", cleanKeys: 5 })).text).toBe("5/12");
    expect(chipFor(status({ state: "mastered", cleanKeys: 9 })).text).toBe("CLEAN");
  });
});

describe("rule 11 on the path", () => {
  it("the seeded sample (the tritone sub clean in many keys) still shows it as Recommended first, never Proficient", async () => {
    // as the demo's browser history serves it: the seeded notebook, marked `sample`
    const store = memoryBackend();
    const sample = (await browserHistory({ store: async () => store, sample: () => demoProgress(NOW.getTime()), onTabOnly: () => {} }).progress())!;
    expect(sample.sample).toBe(true);
    expect((sample.cleanKeys["dominant.tritoneSub"] ?? []).length).toBeGreaterThanOrEqual(4);
    const { states, nextUp } = pathStates(sample, {}, NOW);
    const sub = states.get("dominant.tritoneSub")!;
    expect(sub.state).toBe("recommendedFirst");
    expect(chipFor(sub).text).toBe("Recommended first: The tritone +1 →");
    // Next up is the foundations, as for a fresh player
    expect(nextUp.every((id) => id.startsWith("basics:"))).toBe(true);
    expect(nextUpReason(nextUp[0], states, ownProgressOnly(sample), NOW.getTime())).toBe("New · a foundation");
  });

  it("a due review of the player's own leads with its key", () => {
    const own = {
      concepts: [{ ruleId: "dominant.tritoneSub", keyTonic: "Gb", dueAt: NOW.getTime() - 1000, attempts: 2, cleanRuns: 1, lastGrade: 4, lastReviewedAt: NOW.getTime() - 86_400_000 }],
      cleanKeys: { "dominant.tritoneSub": ["Gb"] },
    } as unknown as Parameters<typeof nextUpReason>[2];
    const states = new Map([["dominant.tritoneSub", status({ id: "dominant.tritoneSub", state: "familiar", due: true, cleanKeys: 1 })]]);
    expect(nextUpReason("dominant.tritoneSub", states, own, NOW.getTime())).toBe("Due in G♭");
  });

  it("a frontier rule says what it builds on", () => {
    const states = new Map<string, ConceptStatus>([
      ["basics:dominantResolution", status({ state: "familiar" })],
      ["functional.secondaryDominant", status({ state: "new" })],
    ]);
    expect(nextUpReason("functional.secondaryDominant", states, { concepts: [], cleanKeys: {} }, NOW.getTime())).toBe("New · builds on Dominant resolution ✓");
  });
});
