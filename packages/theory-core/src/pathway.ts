import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune } from "./types";

export const overlaps = (a: ReharmMove, b: ReharmMove) =>
  a.spanBeats.start < b.spanBeats.end && b.spanBeats.start < a.spanBeats.end;

const VARIETY_PENALTY = 1.5;

/**
 * Pick a set of non-overlapping moves for a "spice level".
 * Higher levels win within a level budget; ties go to voice-leading score,
 * with a penalty for repeating the same rule (keeps arrangements varied).
 * `forced` moves (user picks) always go in first.
 */
export function buildPathway(moves: ReharmMove[], maxLevel: number, forced: ReharmMove[] = []): ReharmMove[] {
  const chosen: ReharmMove[] = [];
  for (const f of forced) if (!chosen.some((c) => overlaps(c, f))) chosen.push(f);
  if (maxLevel <= 0) return chosen.sort(byStart);

  const pool = moves.filter((m) => m.level <= maxLevel && !chosen.some((c) => overlaps(c, m))).sort(byStart);

  // walk clusters of mutually overlapping candidates, left to right
  let i = 0;
  while (i < pool.length) {
    const cluster = [pool[i]];
    let end = pool[i].spanBeats.end;
    let j = i + 1;
    while (j < pool.length && pool[j].spanBeats.start < end) {
      cluster.push(pool[j]);
      end = Math.max(end, pool[j].spanBeats.end);
      j++;
    }
    const used = new Set(chosen.map((c) => c.ruleId));
    const rank = (m: ReharmMove) => m.checks.score - (used.has(m.ruleId) ? VARIETY_PENALTY : 0);
    cluster.sort((a, b) => b.level - a.level || rank(b) - rank(a) || a.priority - b.priority);
    for (const m of cluster) if (!chosen.some((c) => overlaps(c, m))) chosen.push(m);
    i = j;
  }
  return chosen.sort(byStart);
}

const byStart = (a: ReharmMove, b: ReharmMove) => a.spanBeats.start - b.spanBeats.start;

/** The chord list you'd actually play: base changes with the pathway's spans swapped in. */
export function realize(tune: Tune, pathway: ReharmMove[]): ChordEvent[] {
  const replaced = new Set(pathway.flatMap((m) => m.replaces));
  const base = sortedHarmony(tune).filter((c) => !replaced.has(c.id));
  return sortedHarmony({ ...tune, harmony: [...base, ...pathway.flatMap((m) => m.chords)] });
}
