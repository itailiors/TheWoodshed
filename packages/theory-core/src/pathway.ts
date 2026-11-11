import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune } from "./types";

export const overlaps = (a: ReharmMove, b: ReharmMove) =>
  a.spanBeats.start < b.spanBeats.end && b.spanBeats.start < a.spanBeats.end;

const VARIETY_PENALTY = 1.5;
/** Each dial level a move belongs to is worth this many voice-leading points. */
const LEVEL_WEIGHT = 2;

/**
 * How many moves the dial allows, per phrase window (in bars).
 * Turning the dial up means more adventurous moves *and* more of them:
 * a reharm that touches every bar stops sounding like the tune.
 */
export const DENSITY: Record<number, { windowBars: number; maxMoves: number }> = {
  1: { windowBars: 8, maxMoves: 1 },
  2: { windowBars: 4, maxMoves: 1 },
  3: { windowBars: 4, maxMoves: 2 },
  4: { windowBars: 4, maxMoves: Infinity },
};

export function densityLabel(level: number): string {
  const d = DENSITY[Math.min(4, level)];
  if (!d) return "the tune as written";
  if (d.maxMoves === Infinity) return "every spot that works";
  return `up to ${d.maxMoves} move${d.maxMoves > 1 ? "s" : ""} per ${d.windowBars} bars`;
}

/** The phrase window a move belongs to (by the bar it starts in). */
const windowOf = (m: ReharmMove, windowBars: number) => Math.floor((m.span.from.bar - 1) / windowBars);

/** How a candidate scored when it was last weighed: level × 2 + voice leading − variety. */
export interface Rank {
  level: number;
  levelPoints: number;
  score: number;
  /** Earlier uses of the same rule at the time (each costs VARIETY_PENALTY). */
  repeats: number;
  penalty: number;
  total: number;
}

/**
 * What the pathway builder decided about one candidate move, and why. Exactly one per move.
 *  - forced: you picked it ("Also works here"), so it goes in first
 *  - chosen: won its phrase on rank
 *  - dial-off: the dial is at 0 (the tune as written)
 *  - above-dial: its level is spicier than the dial allows
 *  - overlaps: it collides with a move already in (`by`): only one can own those beats
 *  - capped: its phrase's quota was used up by better-ranked moves
 */
export type PathwayDecision =
  | { kind: "forced" }
  | { kind: "chosen"; rank: Rank; window: [number, number] }
  | { kind: "dial-off" }
  | { kind: "above-dial"; level: number; maxLevel: number }
  | { kind: "overlaps"; by: string; rank?: Rank }
  | { kind: "capped"; rank: Rank; window: [number, number]; maxMoves: number; takenBy: string[] };

export interface PathwayTrace {
  chosen: ReharmMove[];
  decisions: Map<string, PathwayDecision>;
}

/**
 * Pick a set of non-overlapping moves for a "spice level".
 * Phrase by phrase, the best moves win. Rank = level × 2 + voice-leading score
 * − 1.5 for every earlier use of the same rule (keeps arrangements varied),
 * until the phrase's quota (DENSITY) is used up.
 * `forced` moves (user picks) always go in first and count toward their phrase's quota.
 */
export function buildPathway(moves: ReharmMove[], maxLevel: number, forced: ReharmMove[] = []): ReharmMove[] {
  return buildPathwayTraced(moves, maxLevel, forced).chosen;
}

/** `buildPathway`, plus the reason for every candidate's fate. Same code path, so it can't drift. */
export function buildPathwayTraced(moves: ReharmMove[], maxLevel: number, forced: ReharmMove[] = []): PathwayTrace {
  const decisions = new Map<string, PathwayDecision>();
  const chosen: ReharmMove[] = [];
  for (const f of forced) {
    const clash = chosen.find((c) => overlaps(c, f));
    if (clash) decisions.set(f.id, { kind: "overlaps", by: clash.id });
    else {
      chosen.push(f);
      decisions.set(f.id, { kind: "forced" });
    }
  }
  const undecided = () => moves.filter((m) => !decisions.has(m.id));
  if (maxLevel <= 0) {
    for (const m of undecided()) decisions.set(m.id, { kind: "dial-off" });
    return { chosen: chosen.sort(byStart), decisions };
  }

  const { windowBars, maxMoves } = DENSITY[Math.min(4, maxLevel)];
  for (const m of undecided()) {
    if (m.level > maxLevel) decisions.set(m.id, { kind: "above-dial", level: m.level, maxLevel });
    else {
      const clash = chosen.find((c) => overlaps(c, m));
      if (clash) decisions.set(m.id, { kind: "overlaps", by: clash.id });
    }
  }
  const pool = moves.filter((m) => !decisions.has(m.id) || decisions.get(m.id)!.kind === "forced").filter((m) => !chosen.includes(m));
  const windows = [...new Set(pool.map((m) => windowOf(m, windowBars)))].sort((a, b) => a - b);
  const lastRank = new Map<string, Rank>();
  const span = (w: number): [number, number] => [w * windowBars + 1, (w + 1) * windowBars];
  // level matters, but so do voice leading and variety: each repeat of a rule costs more
  const rankOf = (m: ReharmMove): Rank => {
    const repeats = chosen.filter((c) => c.ruleId === m.ruleId).length;
    const r = { level: m.level, levelPoints: m.level * LEVEL_WEIGHT, score: m.checks.score, repeats, penalty: VARIETY_PENALTY * repeats, total: 0 };
    r.total = r.levelPoints + r.score - r.penalty;
    lastRank.set(m.id, r);
    return r;
  };

  for (const w of windows) {
    let budget = maxMoves - chosen.filter((c) => windowOf(c, windowBars) === w).length;
    const candidates = pool.filter((m) => windowOf(m, windowBars) === w);
    while (budget > 0) {
      const eligible = candidates.filter((m) => !chosen.some((c) => overlaps(c, m)));
      const ranks = new Map(eligible.map((m) => [m.id, rankOf(m)]));
      const best = eligible.sort(
        (a, b) => ranks.get(b.id)!.total - ranks.get(a.id)!.total || b.level - a.level || a.priority - b.priority || a.spanBeats.start - b.spanBeats.start,
      )[0];
      if (!best) break;
      chosen.push(best);
      decisions.set(best.id, { kind: "chosen", rank: ranks.get(best.id)!, window: span(w) });
      budget--;
    }
    // Everyone left in this phrase lost either to an overlap or to the quota.
    for (const m of candidates) {
      if (decisions.has(m.id)) continue;
      const clash = chosen.find((c) => overlaps(c, m));
      if (clash) decisions.set(m.id, { kind: "overlaps", by: clash.id, rank: lastRank.get(m.id) });
      else
        decisions.set(m.id, {
          kind: "capped",
          rank: lastRank.get(m.id) ?? rankOf(m), // never weighed: your picks filled the phrase first
          window: span(w),
          maxMoves,
          takenBy: chosen.filter((c) => windowOf(c, windowBars) === w).map((c) => c.id),
        });
    }
  }
  return { chosen: chosen.sort(byStart), decisions };
}

const byStart = (a: ReharmMove, b: ReharmMove) => a.spanBeats.start - b.spanBeats.start;

/** The chord list you'd actually play: base changes with the pathway's spans swapped in. */
export function realize(tune: Tune, pathway: ReharmMove[]): ChordEvent[] {
  const replaced = new Set(pathway.flatMap((m) => m.replaces));
  const base = sortedHarmony(tune).filter((c) => !replaced.has(c.id));
  return sortedHarmony({ ...tune, harmony: [...base, ...pathway.flatMap((m) => m.chords)] });
}
