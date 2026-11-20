import { conceptName } from "../concepts";
import { earRuleId } from "../ears/motions";
import type { ProgressSummary } from "../srs";

/*
 * The learning order: a prerequisite graph that recommends but never locks.
 *
 * Nodes are the 17 reharm rules plus 10 `basics:*` foundations that aren't rules. A **hard** edge
 * means the move's explanation leans on the prerequisite ("Recommended first"); a **soft** edge
 * only helps ("Pairs well with"). `tier` is learning order, kept apart from the level dial
 * (adventurousness + density). Evidence borrows mastery from other families: V → I in the
 * Changes game counts for dominant resolution, clean shells for guide tones.
 *
 * Separate from `concepts.ts`, which stays the practice-history registry.
 */

export type BasicsId =
  | "basics:sevenths"
  | "basics:numerals"
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
  "basics:sevenths": "7th chords",
  "basics:numerals": "Roman numerals",
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
  // optional floor for a newcomer (Gate 0 item 7): the chord vocabulary and the numerals every lesson prints
  node("basics:sevenths", 0),
  node("basics:tritone", 0),
  node("basics:numerals", 0),
  node("basics:guideTones", 0, ["basics:sevenths"], [], ["shape:shell:*"]),
  node("basics:dominantResolution", 0, ["basics:guideTones"], [], [earRuleId("landing")]),
  node("basics:twoFiveOne", 0, ["basics:dominantResolution"], [], [earRuleId("setup")]),
  // soft edges where a step leans on another basic: "past G7's F", "G7's ♭9", "pulls into C like G7 does"
  node("basics:extensions", 0, [], ["basics:sevenths"]),
  node("basics:parallelMinor", 0),
  node("basics:dim7", 0, [], ["basics:dominantResolution", "basics:extensions"]),
  node("basics:symmetricOctave", 0),

  node("functional.secondaryTwoFive", 1, ["functional.secondaryDominant", "basics:twoFiveOne"]),
  node("functional.secondaryDominant", 1, ["basics:dominantResolution"], ["basics:numerals"]),
  node("dominant.tritoneSub", 2, ["basics:tritone", "basics:dominantResolution"], ["functional.secondaryDominant", "basics:numerals"]),
  node("voicing.upperStructureBVI", 2, ["basics:guideTones", "basics:extensions"]),
  // the approach chord is the tritone sub voiced as a 13(♯11) cluster: tensions first; upper structure II (9, ♯11, 13) is the same grip
  node("gospel.halfStepTurnaround", 3, ["dominant.tritoneSub", "basics:extensions"], ["voicing.upperStructureII"]),
  node("voicing.rootlessTwoFiveOne", 2, ["basics:guideTones", "basics:extensions", "basics:twoFiveOne"]),
  node("voicing.upperStructureII", 2, ["basics:guideTones", "basics:extensions"], ["dominant.tritoneSub"]),
  node("modal.backdoorTwoFive", 3, ["modal.borrowedIv", "basics:twoFiveOne"], ["dominant.tritoneSub", "basics:numerals"]),
  // "the Family" is the °7's four dominants a minor 3rd apart: the dim7 is the real prerequisite
  node("dominant.mediantDominant", 3, ["basics:dim7"], ["dominant.tritoneSub", "modal.backdoorTwoFive"]),
  node("modal.flatSixFlatSeven", 3, ["basics:parallelMinor"], ["modal.borrowedIv", "modal.backdoorTwoFive", "basics:numerals"]),
  node("modal.borrowedIv", 3, ["basics:parallelMinor"]),
  node("chromatic.passingDiminished", 2, ["basics:dim7", "functional.secondaryDominant"]),
  node("chromatic.commonToneDiminished", 3, ["basics:dim7"], ["chromatic.passingDiminished"]),
  node("symmetric.coltraneSubstitution", 4, ["functional.secondaryTwoFive", "basics:symmetricOctave"], ["dominant.tritoneSub"]),
  node("chromatic.constantStructure", 4, [], ["dominant.tritoneSub"]),
  // the stops are named maj7, 7 and 6 chords; a walk chord like D♭7(♯11) is the tritone sub
  node("chromatic.minorLineCliche", 2, [], ["basics:guideTones", "basics:sevenths"]),
  node("melody.oneNoteOnTop", 4, ["basics:extensions"], ["chromatic.constantStructure", "dominant.tritoneSub"]),
];

const BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
export const conceptNode = (id: string): ConceptNode | undefined => BY_ID.get(id);

// ── states ──

export type ConceptState = "new" | "recommendedFirst" | "learning" | "familiar" | "proficient" | "mastered";

const RANK: Record<ConceptState, number> = { new: 0, recommendedFirst: 0, learning: 1, familiar: 2, proficient: 3, mastered: 4 };
export const atLeastFamiliar = (s: ConceptState) => RANK[s] >= RANK.familiar;

export const PROFICIENT_KEYS = 4;
export const MASTERED_KEYS = 8;

/** The Coach stages a concept can be left on (`lastStage`). */
export const LESSON_STAGES = ["learn", "study", "self", "play"] as const;
export type LessonStage = (typeof LESSON_STAGES)[number];

/** One concept's lesson record, kept in the browser (`reharm.lessons`). ISO dates. */
export interface LessonFlag {
  /** The lesson was opened: the concept is at least Learning. */
  seenAt?: string;
  /** The lesson was finished: the concept is Familiar for the path (fading still waits for a clean key). */
  finishedAt?: string;
  /** A passed 2-key test-out; counts like `finishedAt`. */
  testedOutAt?: string;
  /** Set on a prerequisite marked by another concept's test-out: that concept's id (so Undo removes exactly these). */
  testedOutVia?: string;
  /** The player asked to relearn it: the state is capped at Learning whatever the evidence. The only demotion. */
  relearn?: boolean;
  /** The Coach stage the player last used for this concept. */
  lastStage?: LessonStage;
  /** "Continue anyway" on the prerequisite note: the note is gone for good. */
  continuedAnyway?: boolean;
  /**
   * The rough graded run (its review time, ISO) that has already reopened the steps once. A later
   * rough run reopens them again; this one doesn't. Explanation depth only: no effect on the state.
   */
  reopenedFor?: string;
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

/** Just what the states read from a review. Dates may be ISO strings or ms (the web client's `Review`). */
interface ReviewLike {
  ruleId: string;
  dueAt: string | number | Date;
  attempts: number;
  lastGrade: number | null;
  lastReviewedAt: string | number | Date | null;
}
type Progress = { concepts: readonly ReviewLike[]; cleanKeys: ProgressSummary["cleanKeys"] };
const time = (t: string | number | Date | null) => (t === null ? -Infinity : new Date(t).getTime());

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
    const latest = [...reviews].sort((a, b) => time(b.lastReviewedAt) - time(a.lastReviewedAt))[0];
    const flag = flags[c.id];
    const borrowed = c.evidence.some((p) => cleanRuleIds.some((id) => matches(p, id)));
    const unmet = c.hard.filter((h) => !atLeastFamiliar(visit(BY_ID.get(h)!).state));

    let state: ConceptState;
    if (clean >= MASTERED_KEYS && (latest?.lastGrade ?? 0) >= 4 && !due) state = "mastered";
    else if (clean >= PROFICIENT_KEYS) state = "proficient";
    else if (clean >= 1 || flag?.finishedAt || flag?.testedOutAt || borrowed) state = "familiar";
    else if (flag?.seenAt || reviews.some((r) => r.attempts > 0)) state = "learning";
    else if (unmet.length && !flag?.continuedAnyway) state = "recommendedFirst";
    else state = "new";
    // the player's own "Relearn this": the only demotion, capped at Learning
    if (flag?.relearn && RANK[state] > RANK.learning) state = "learning";

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
