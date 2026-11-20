import { describe, expect, it } from "vitest";
import { shapeRuleId } from "../src/concepts";
import { earRuleId } from "../src/ears";
import { CONCEPTS, conceptNode, conceptStates, GLOSSARY, isBasicsId, learnName, nextUp, type LessonFlag } from "../src/learn";
import { RULES } from "../src/ruleset";
import type { ProgressSummary } from "../src/srs";
import { KEYS } from "../src/transpose";

/*
 * The learning graph: every rule placed, nothing cyclic, a hard prerequisite never later in the
 * order than the concept that needs it, and states that recommend but never lock.
 */

const NOW = new Date("2026-11-20T12:00:00Z");
const ids = CONCEPTS.map((c) => c.id);

type Row = ProgressSummary["concepts"][number];
const row = (ruleId: string, keyTonic: string, over: Partial<Row> = {}): Row => ({
  ruleId,
  keyTonic,
  reps: 1,
  ease: 2.5,
  intervalDays: 1,
  dueAt: "2026-12-01T00:00:00Z",
  attempts: 1,
  cleanRuns: 1,
  lastGrade: 5,
  lastReviewedAt: "2026-11-19T00:00:00Z",
  ...over,
});
const empty = { concepts: [] as Row[], cleanKeys: {} as Record<string, string[]> };
const states = (progress = empty, flags: Record<string, LessonFlag> = {}) => conceptStates(progress, flags, NOW);

describe("the concept graph", () => {
  it("places all 17 rules and 10 basics nodes, each once", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RULES) expect(ids).toContain(r.id);
    expect(RULES).toHaveLength(17);
    expect(ids.filter(isBasicsId)).toHaveLength(10);
    expect(ids).toHaveLength(27);
    for (const id of ids) expect(learnName(id)).not.toBe(id);
  });

  it("every prerequisite exists, none is the concept itself, and an edge is hard or soft, not both", () => {
    for (const c of CONCEPTS) {
      for (const p of [...c.hard, ...c.soft]) {
        expect(conceptNode(p), `${c.id} → ${p}`).toBeDefined();
        expect(p).not.toBe(c.id);
      }
      expect(c.hard.filter((h) => c.soft.includes(h))).toEqual([]);
    }
  });

  it("is acyclic", () => {
    const state = new Map<string, "open" | "done">();
    const visit = (id: string, path: string[]) => {
      if (state.get(id) === "done") return;
      if (state.get(id) === "open") throw new Error(`cycle: ${[...path, id].join(" → ")}`);
      state.set(id, "open");
      const c = conceptNode(id)!;
      for (const p of [...c.hard, ...c.soft]) visit(p, [...path, id]);
      state.set(id, "done");
    };
    for (const id of ids) expect(() => visit(id, [])).not.toThrow();
  });

  it("never puts a prerequisite in a later tier than the concept that needs it", () => {
    for (const c of CONCEPTS) for (const p of [...c.hard, ...c.soft]) expect(conceptNode(p)!.tier, `${c.id} needs ${p}`).toBeLessThanOrEqual(c.tier);
  });

  it("the tritone sub needs only the tritone and dominant resolution; secondary dominants are a soft edge", () => {
    const ts = conceptNode("dominant.tritoneSub")!;
    expect(ts.hard).toEqual(["basics:tritone", "basics:dominantResolution"]);
    expect(ts.soft).toEqual(["functional.secondaryDominant", "basics:numerals"]);
  });

  it("7th chords come before guide tones; numerals only pair with the moves that print them", () => {
    expect(conceptNode("basics:sevenths")).toMatchObject({ tier: 0, hard: [], soft: [] });
    expect(conceptNode("basics:numerals")).toMatchObject({ tier: 0, hard: [], soft: [] });
    expect(conceptNode("basics:guideTones")!.hard).toEqual(["basics:sevenths"]);
    const pairsWithNumerals = CONCEPTS.filter((c) => c.soft.includes("basics:numerals")).map((c) => c.id);
    expect(pairsWithNumerals.sort()).toEqual(["dominant.tritoneSub", "functional.secondaryDominant", "modal.backdoorTwoFive", "modal.flatSixFlatSeven"]);
    expect(CONCEPTS.filter((c) => c.hard.includes("basics:numerals"))).toEqual([]);
  });

  it("the teacher's edges: the Family needs the dim7; ♭VI–♭VII–I pairs with the backdoor; the gospel slide needs tensions", () => {
    expect(conceptNode("dominant.mediantDominant")).toMatchObject({ hard: ["basics:dim7"], soft: ["dominant.tritoneSub", "modal.backdoorTwoFive"] });
    expect(conceptNode("modal.flatSixFlatSeven")).toMatchObject({ hard: ["basics:parallelMinor"], soft: ["modal.borrowedIv", "modal.backdoorTwoFive", "basics:numerals"] });
    expect(conceptNode("gospel.halfStepTurnaround")).toMatchObject({ hard: ["dominant.tritoneSub", "basics:extensions"], soft: ["voicing.upperStructureII"] });
  });

  it("borrows evidence only from families that exist", () => {
    const real = [earRuleId("landing"), earRuleId("setup"), shapeRuleId("shell", "7")];
    for (const c of CONCEPTS)
      for (const p of c.evidence) expect(real.some((id) => (p.endsWith("*") ? id.startsWith(p.slice(0, -1)) : id === p)), `${c.id}: ${p}`).toBe(true);
  });
});

describe("concept states", () => {
  it("with no history, foundations are New and the tritone sub is Recommended first, never locked", () => {
    const s = states();
    expect(s.get("basics:tritone")!.state).toBe("new");
    expect(s.get("basics:sevenths")!.state).toBe("new");
    expect(s.get("basics:guideTones")).toMatchObject({ state: "recommendedFirst", recommendedFirst: ["basics:sevenths"] });
    expect(s.get("basics:dominantResolution")!.state).toBe("recommendedFirst");
    expect(s.get("dominant.tritoneSub")).toMatchObject({ state: "recommendedFirst", recommendedFirst: ["basics:tritone", "basics:dominantResolution"] });
  });

  it("'Continue anyway' clears the note; opening the lesson makes it Learning; finishing makes it Familiar", () => {
    expect(states(empty, { "dominant.tritoneSub": { continuedAnyway: true } }).get("dominant.tritoneSub")!.state).toBe("new");
    expect(states(empty, { "dominant.tritoneSub": { seenAt: "2026-11-20" } }).get("dominant.tritoneSub")!.state).toBe("learning");
    expect(states(empty, { "dominant.tritoneSub": { seenAt: "x", finishedAt: "y" } }).get("dominant.tritoneSub")!.state).toBe("familiar");
  });

  it("finishing the prerequisites lifts the note", () => {
    const done = { seenAt: "x", finishedAt: "y" };
    const s = states(empty, { "basics:tritone": done, "basics:guideTones": done, "basics:dominantResolution": done });
    expect(s.get("dominant.tritoneSub")).toMatchObject({ state: "new", recommendedFirst: [] });
  });

  it("borrows evidence: V → I in the Changes game makes dominant resolution Familiar; clean shells make guide tones Familiar", () => {
    const s = states({ concepts: [], cleanKeys: { [earRuleId("landing")]: ["C"], [shapeRuleId("shell", "7", ["b9"])]: ["F"] } });
    expect(s.get("basics:dominantResolution")!.state).toBe("familiar");
    expect(s.get("basics:guideTones")!.state).toBe("familiar");
  });

  it("counts clean keys: 1 Familiar, 4 Proficient, 8 with a good last grade and nothing due Mastered", () => {
    const id = "dominant.tritoneSub";
    const keys = (n: number) => KEYS.slice(0, n);
    const at = (n: number, over: Partial<Row> = {}) =>
      states({ concepts: keys(n).map((k) => row(id, k, over)), cleanKeys: { [id]: keys(n) } }).get(id)!;
    expect(at(1).state).toBe("familiar");
    expect(at(4).state).toBe("proficient");
    expect(at(8).state).toBe("mastered");
    expect(at(8, { lastGrade: 3 }).state).toBe("proficient");
    expect(at(8, { dueAt: "2026-11-01T00:00:00Z" })).toMatchObject({ state: "proficient", due: true });
  });

  it("attempts with no clean run are Learning", () => {
    const s = states({ concepts: [row("modal.borrowedIv", "C", { cleanRuns: 0, lastGrade: 2 })], cleanKeys: {} });
    expect(s.get("modal.borrowedIv")!.state).toBe("learning");
  });
});

describe("next up", () => {
  it("with no history, offers foundations with nothing in front of them, at most four", () => {
    const n = nextUp(states());
    expect(n).toEqual(["basics:sevenths", "basics:tritone", "basics:numerals", "basics:extensions"]);
    expect(nextUp(states(), 99).filter(isBasicsId)).toEqual(["basics:sevenths", "basics:tritone", "basics:numerals", "basics:extensions", "basics:parallelMinor", "basics:dim7", "basics:symmetricOctave"]);
  });

  it("finishing 7th chords puts guide tones on the frontier", () => {
    expect(nextUp(states(empty, { "basics:sevenths": { seenAt: "x", finishedAt: "y" } }))).toEqual(["basics:tritone", "basics:numerals", "basics:guideTones", "basics:extensions"]);
  });

  it("once the tritone and dominant resolution are Familiar, the tritone sub is on the frontier, the secondary ii–V is not", () => {
    const done = { seenAt: "x", finishedAt: "y" };
    const n = nextUp(states(empty, { "basics:tritone": done, "basics:guideTones": done, "basics:dominantResolution": done }), 99);
    expect(n).toContain("dominant.tritoneSub");
    expect(n).toContain("functional.secondaryDominant");
    expect(n).not.toContain("functional.secondaryTwoFive");
    expect(n.indexOf("functional.secondaryDominant")).toBeLessThan(n.indexOf("dominant.tritoneSub"));
  });

  it("the mediant dominant waits on the dim7 alone, not on the tritone sub", () => {
    expect(states().get("dominant.mediantDominant")).toMatchObject({ state: "recommendedFirst", recommendedFirst: ["basics:dim7"] });
    const n = nextUp(states(empty, { "basics:dim7": { seenAt: "x", finishedAt: "y" } }), 99);
    expect(n).toContain("dominant.mediantDominant");
    expect(n).not.toContain("dominant.tritoneSub");
  });

  it("puts due reviews first", () => {
    const id = "modal.borrowedIv";
    const s = states({ concepts: [row(id, "C", { dueAt: "2026-11-01T00:00:00Z" })], cleanKeys: { [id]: ["C"] } });
    expect(nextUp(s)[0]).toBe(id);
  });
});

describe("the glossary", () => {
  const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

  it("defines each term once, in eight words or fewer, and links only to concepts that exist", () => {
    const names = GLOSSARY.flatMap((g) => [g.term, ...g.aliases].map((t) => t.toLowerCase()));
    expect(new Set(names).size).toBe(names.length);
    for (const g of GLOSSARY) {
      expect(words(g.gloss), g.term).toBeLessThanOrEqual(8);
      if (g.conceptId) expect(conceptNode(g.conceptId), g.term).toBeDefined();
    }
  });
});
