import { conceptName } from "../concepts";
import { earRuleId } from "../ears/motions";
import type { ProgressSummary } from "../srs";

/*
 * The learning order: a prerequisite graph that recommends but never locks.
 *
 * Nodes are the 17 reharm rules plus `basics:*` foundations that aren't rules. A **hard** edge
 * means the move's explanation leans on the prerequisite ("Recommended first"); a **soft** edge
 * only helps ("Pairs well with"). `tier` is learning order, kept apart from the level dial
 * (adventurousness + density). Evidence borrows mastery from other families: V → I in the
 * Changes game counts for dominant resolution, clean shells for guide tones.
 *
 * Separate from `concepts.ts`, which stays the practice-history registry.
 */

export type BasicsId =
  | "basics:tritone"
  | "basics:guideTones"
  | "basics:dominantResolution"
  | "basics:twoFiveOne"
  | "basics:extensions"
  | "basics:parallelMinor"
  | "basics:dim7"
  | "basics:symmetricOctave";

export type Tier = 0 | 1 | 2 | 3 | 4;

export interface ConceptNode {
  id: string;
  tier: Tier;
  hard: string[];
  soft: string[];
  /** Other concept ids whose clean runs count as evidence; a trailing `*` matches a prefix. */
  evidence: string[];
}

const BASICS_NAME: Record<BasicsId, string> = {
  "basics:tritone": "The tritone",
  "basics:guideTones": "Guide tones",
  "basics:dominantResolution": "Dominant resolution",
  "basics:twoFiveOne": "The ii–V–I",
  "basics:extensions": "Extensions",
  "basics:parallelMinor": "The parallel minor",
  "basics:dim7": "The diminished 7th",
  "basics:symmetricOctave": "Major-3rd cycles",
};

export const isBasicsId = (id: string): id is BasicsId => id in BASICS_NAME;

/** A learning concept's name: a basics node's own, or the practice registry's. */
export const learnName = (id: string): string => (isBasicsId(id) ? BASICS_NAME[id] : conceptName(id));

const node = (id: string, tier: Tier, hard: string[] = [], soft: string[] = [], evidence: string[] = []): ConceptNode => ({ id, tier, hard, soft, evidence });

/** Every concept, basics first, then the rules in `RULES` order (which already encodes priority). */
export const CONCEPTS: readonly ConceptNode[] = [
  node("basics:tritone", 0),
  node("basics:guideTones", 0, [], [], ["shape:shell:*"]),
  node("basics:dominantResolution", 0, ["basics:guideTones"], [], [earRuleId("landing")]),
  node("basics:twoFiveOne", 0, ["basics:dominantResolution"], [], [earRuleId("setup")]),
  node("basics:extensions", 0),
  node("basics:parallelMinor", 0),
  node("basics:dim7", 0),
  node("basics:symmetricOctave", 0),

  node("functional.secondaryTwoFive", 1, ["functional.secondaryDominant", "basics:twoFiveOne"]),
  node("functional.secondaryDominant", 1, ["basics:dominantResolution"]),
  node("dominant.tritoneSub", 2, ["basics:tritone", "basics:dominantResolution"], ["functional.secondaryDominant"]),
  node("voicing.upperStructureBVI", 2, ["basics:guideTones", "basics:extensions"]),
  node("gospel.halfStepTurnaround", 3, ["dominant.tritoneSub"]),
  node("voicing.rootlessTwoFiveOne", 2, ["basics:guideTones", "basics:extensions", "basics:twoFiveOne"]),
  node("voicing.upperStructureII", 2, ["basics:guideTones", "basics:extensions"], ["dominant.tritoneSub"]),
  node("modal.backdoorTwoFive", 3, ["modal.borrowedIv", "basics:twoFiveOne"], ["dominant.tritoneSub"]),
  node("dominant.mediantDominant", 3, ["dominant.tritoneSub"], ["modal.backdoorTwoFive", "basics:dim7"]),
  node("modal.flatSixFlatSeven", 3, ["basics:parallelMinor"], ["modal.borrowedIv"]),
  node("modal.borrowedIv", 3, ["basics:parallelMinor"]),
  node("chromatic.passingDiminished", 2, ["basics:dim7", "functional.secondaryDominant"]),
  node("chromatic.commonToneDiminished", 3, ["basics:dim7"], ["chromatic.passingDiminished"]),
  node("symmetric.coltraneSubstitution", 4, ["functional.secondaryTwoFive", "basics:symmetricOctave"], ["dominant.tritoneSub"]),
  node("chromatic.constantStructure", 4, [], ["dominant.tritoneSub"]),
  node("chromatic.minorLineCliche", 2, [], ["basics:guideTones"]),
  node("melody.oneNoteOnTop", 4, ["basics:extensions"], ["chromatic.constantStructure"]),
];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
export const conceptNode = (id: string): ConceptNode | undefined => BY_ID.get(id);

// ── states ──

export type ConceptState = "new" | "recommendedFirst" | "learning" | "familiar" | "proficient" | "mastered";

const RANK: Record<ConceptState, number> = { new: 0, recommendedFirst: 0, learning: 1, familiar: 2, proficient: 3, mastered: 4 };
export const atLeastFamiliar = (s: ConceptState) => RANK[s] >= RANK.familiar;

export const PROFICIENT_KEYS = 4;
export const MASTERED_KEYS = 8;

/** One concept's lesson record, kept in the browser (`reharm.lessons`). ISO dates. */
export interface LessonFlag {
  seenAt?: string;
  finishedAt?: string;
  continuedAnyway?: boolean;
}

export interface ConceptStatus {
  id: string;
  state: ConceptState;
  /** Some key of it is due for review. */
  due: boolean;
  cleanKeys: number;
  /** Hard prerequisites not yet Familiar (empty unless the state is recommendedFirst). */
  recommendedFirst: string[];
}

type Progress = Pick<ProgressSummary, "concepts" | "cleanKeys">;

const matches = (pattern: string, ruleId: string) => (pattern.endsWith("*") ? ruleId.startsWith(pattern.slice(0, -1)) : ruleId === pattern);

/**
 * Every concept's state from the practice history and the lesson flags. Pure: the caller
 * passes `now`. Pass only this player's own history (never the demo's seeded sample).
 */
export function conceptStates(progress: Progress, flags: Readonly<Record<string, LessonFlag>>, now: Date): Map<string, ConceptStatus> {
  const out = new Map<string, ConceptStatus>();
  const cleanRuleIds = Object.keys(progress.cleanKeys).filter((id) => progress.cleanKeys[id].length > 0);

  const visit = (c: ConceptNode): ConceptStatus => {
    const done = out.get(c.id);
    if (done) return done;
    const reviews = progress.concepts.filter((r) => r.ruleId === c.id);
    const clean = progress.cleanKeys[c.id]?.length ?? 0;
    const due = reviews.some((r) => new Date(r.dueAt).getTime() <= now.getTime());
    const latest = [...reviews].sort((a, b) => (b.lastReviewedAt ?? "").localeCompare(a.lastReviewedAt ?? ""))[0];
    const flag = flags[c.id];
    const borrowed = c.evidence.some((p) => cleanRuleIds.some((id) => matches(p, id)));
    const unmet = c.hard.filter((h) => !atLeastFamiliar(visit(BY_ID.get(h)!).state));

    let state: ConceptState;
    if (clean >= MASTERED_KEYS && (latest?.lastGrade ?? 0) >= 4 && !due) state = "mastered";
    else if (clean >= PROFICIENT_KEYS) state = "proficient";
    else if (clean >= 1 || flag?.finishedAt || borrowed) state = "familiar";
    else if (flag?.seenAt || reviews.some((r) => r.attempts > 0)) state = "learning";
    else if (unmet.length && !flag?.continuedAnyway) state = "recommendedFirst";
    else state = "new";

    const status: ConceptStatus = { id: c.id, state, due, cleanKeys: clean, recommendedFirst: state === "recommendedFirst" ? unmet : [] };
    out.set(c.id, status);
    return status;
  };

  for (const c of CONCEPTS) visit(c);
  return out;
}

/**
 * What to learn next: due reviews first, then the frontier (not yet Familiar, every hard
 * prerequisite Familiar), lowest tier first, ties in `CONCEPTS` order. A short list, never all.
 */
export function nextUp(states: ReadonlyMap<string, ConceptStatus>, limit = 4): string[] {
  const order = new Map(CONCEPTS.map((c, i) => [c.id, i]));
  const byTier = (a: ConceptNode, b: ConceptNode) => a.tier - b.tier || order.get(a.id)! - order.get(b.id)!;
  const due = CONCEPTS.filter((c) => states.get(c.id)?.due).sort(byTier);
  const frontier = CONCEPTS.filter((c) => {
    const s = states.get(c.id);
    return s && !s.due && !atLeastFamiliar(s.state) && c.hard.every((h) => atLeastFamiliar(states.get(h)?.state ?? "new"));
  }).sort(byTier);
  return [...due, ...frontier].slice(0, limit).map((c) => c.id);
}
