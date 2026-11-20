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

export interface PathStates {
  states: Map<string, ConceptStatus>;
  /** What to learn next (due first, then the frontier), at most `limit`. */
  nextUp: string[];
}

/** Every concept's state from this browser's own runs and lesson flags. Pure: the caller passes `now`. */
export function pathStates(progress: Progress | null | undefined, flags: Readonly<Record<string, LessonFlag>>, now: Date, limit = 4): PathStates {
  const states = conceptStates(ownProgressOnly(progress), flags, now);
  return { states, nextUp: nextUp(states, limit) };
}
