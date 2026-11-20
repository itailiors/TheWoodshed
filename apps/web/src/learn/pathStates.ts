import { conceptStates, nextUp, type ConceptStatus, type LessonFlag } from "@reharm/theory-core";
import type { Progress } from "../library/practice";

/** What the path reads from a passport: the reviews and the clean keys. */
export type OwnProgress = Pick<Progress, "concepts" | "cleanKeys">;

const EMPTY: OwnProgress = { concepts: [], cleanKeys: {} };

/**
 * The player's own history, or nothing. The demo's seeded sample notebook (`sample`) is made up,
 * so it NEVER drives path states (rule 11): this is the one place that decides it.
 */
export const ownProgressOnly = (p: Progress | null | undefined): OwnProgress => (!p || p.sample ? EMPTY : { concepts: p.concepts, cleanKeys: p.cleanKeys });

/** The player's own due reviews from a passport, or none: the sample's "due" list is someone else's (rule 11). */
export const ownDue = (p: Progress | null | undefined): Progress["due"] => (!p || p.sample ? [] : p.due);

export interface PathStates {
  states: Map<string, ConceptStatus>;
  /** What to learn next (due first, then the frontier), at most `limit`. */
  nextUp: string[];
}

/**
 * A fresh visitor's first stop: `nextUp()[0]`, a foundation with no prerequisite note, when the
 * player has no runs of their own and no lesson flags at all; otherwise null (the Coach opens
 * where it always did). The demo's sample doesn't count as runs (rule 11). Pure.
 */
export function freshStart(progress: Progress | null | undefined, flags: Readonly<Record<string, LessonFlag>>, now: Date): string | null {
  const own = ownProgressOnly(progress);
  if (own.concepts.length > 0 || Object.keys(own.cleanKeys).some((id) => own.cleanKeys[id].length) || Object.keys(flags).length > 0) return null;
  return pathStates(progress, flags, now, 1).nextUp[0] ?? null;
}

/** Every concept's state from this browser's own runs and lesson flags. Pure: the caller passes `now`. */
export function pathStates(progress: Progress | null | undefined, flags: Readonly<Record<string, LessonFlag>>, now: Date, limit = 4): PathStates {
  const states = conceptStates(ownProgressOnly(progress), flags, now);
  return { states, nextUp: nextUp(states, limit) };
}
