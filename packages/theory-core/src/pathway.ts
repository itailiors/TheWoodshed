import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune } from "./types";

export const overlaps = (a: ReharmMove, b: ReharmMove) =>
  a.spanBeats.start < b.spanBeats.end && b.spanBeats.start < a.spanBeats.end;

const VARIETY_PENALTY = 1.5;

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

/**
 * Pick a set of non-overlapping moves for a "spice level".
 * Phrase by phrase, the best moves win: higher level first, then voice-leading score,
 * with a penalty for repeating a rule already used (keeps arrangements varied),
 * until the phrase's quota (DENSITY) is used up.
 * `forced` moves (user picks) always go in first and count toward their phrase's quota.
 */
export function buildPathway(moves: ReharmMove[], maxLevel: number, forced: ReharmMove[] = []): ReharmMove[] {
  const chosen: ReharmMove[] = [];
  for (const f of forced) if (!chosen.some((c) => overlaps(c, f))) chosen.push(f);
  if (maxLevel <= 0) return chosen.sort(byStart);

  const { windowBars, maxMoves } = DENSITY[Math.min(4, maxLevel)];
  const pool = moves.filter((m) => m.level <= maxLevel && !chosen.some((c) => overlaps(c, m)));
  const windows = [...new Set(pool.map((m) => windowOf(m, windowBars)))].sort((a, b) => a - b);

  for (const w of windows) {
    let budget = maxMoves - chosen.filter((c) => windowOf(c, windowBars) === w).length;
    const candidates = pool.filter((m) => windowOf(m, windowBars) === w);
    while (budget > 0) {
      const used = new Set(chosen.map((c) => c.ruleId));
      const rank = (m: ReharmMove) => m.checks.score - (used.has(m.ruleId) ? VARIETY_PENALTY : 0);
      const best = candidates
        .filter((m) => !chosen.some((c) => overlaps(c, m)))
        .sort((a, b) => b.level - a.level || rank(b) - rank(a) || a.priority - b.priority || a.spanBeats.start - b.spanBeats.start)[0];
      if (!best) break;
      chosen.push(best);
      budget--;
    }
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
