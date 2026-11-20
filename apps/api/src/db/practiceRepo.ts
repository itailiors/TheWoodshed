import { applyCoachRun, normaliseKey, RECENT_IMPROV_LIMIT, summariseProgress } from "@reharm/theory-core";
import { and, desc, eq } from "drizzle-orm";
import { getDb, persist } from "./client";
import { coachAttempts, conceptReviews, improvRuns, practiceSessions, tunes } from "./schema";

export { normaliseKey };

const tuneOrNull = (id?: string | null) =>
  id && getDb().select({ id: tunes.id }).from(tunes).where(eq(tunes.id, id)).get() ? id : null;

export function startSession(input: { tuneId?: string | null; mode: "coach" | "improv"; tempo?: number | null }) {
  const row = getDb()
    .insert(practiceSessions)
    .values({ tuneId: tuneOrNull(input.tuneId), mode: input.mode, tempo: input.tempo ?? null })
    .returning({ id: practiceSessions.id })
    .get();
  persist();
  return row.id;
}

export function sessionExists(id: number) {
  return !!getDb().select({ id: practiceSessions.id }).from(practiceSessions).where(eq(practiceSessions.id, id)).get();
}

export function endSession(id: number, at = new Date()) {
  getDb().update(practiceSessions).set({ endedAt: at }).where(eq(practiceSessions.id, id)).run();
  persist();
}

export interface CoachAttemptInput {
  sessionId: number;
  tuneId?: string | null;
  moveId: string;
  ruleId: string;
  keyTonic: string;
  misses: number;
  leaps: number;
  maxLeap: number;
  gradedBy?: "engine" | "self";
  /** Answered by ear (Voicings' "Hear, hide, play"); the schedule is the same, the attempt is tagged. */
  byEar?: boolean;
}

/** Store a coach run and advance that concept's spaced-repetition schedule. */
export function recordCoachAttempt(input: CoachAttemptInput, now = new Date()) {
  const db = getDb();
  const keyTonic = normaliseKey(input.keyTonic);
  const where = and(eq(conceptReviews.ruleId, input.ruleId), eq(conceptReviews.keyTonic, keyTonic));
  const prev = db.select().from(conceptReviews).where(where).get();
  // the shared SM-2 path (theory-core): the static demo grades its browser-saved runs with the same function
  const { grade, clean, review } = applyCoachRun(prev ?? null, input, now);
  const attempt = db
    .insert(coachAttempts)
    .values({ ...input, tuneId: tuneOrNull(input.tuneId), keyTonic, clean, grade, createdAt: now })
    .returning({ id: coachAttempts.id })
    .get();

  if (prev) db.update(conceptReviews).set(review).where(where).run();
  else db.insert(conceptReviews).values(review).run();
  persist();
  return { attemptId: attempt.id, grade, clean, review };
}

export interface ImprovRunInput {
  sessionId: number;
  tuneId?: string | null;
  level: number;
  view: "reharm" | "original";
  loopStartBar: number;
  loopEndBar: number;
  notes: number;
  chordTonePct: number;
  tensionPct: number;
  avoidPct: number;
  outsidePct: number;
  strongBeatChordTonePct: number | null;
  guideToneLandings: number;
  heldAvoidNotes: number;
}

export function recordImprovRun(input: ImprovRunInput, now = new Date()) {
  const row = getDb()
    .insert(improvRuns)
    .values({ ...input, tuneId: tuneOrNull(input.tuneId), createdAt: now })
    .returning({ id: improvRuns.id })
    .get();
  persist();
  return row.id;
}

/**
 * The passport's view of the whole history: clean keys, places, the due queue and recent improv
 * runs. The rules live in theory-core's `summariseProgress` (the static demo's browser store
 * uses it too); this only loads the rows.
 */
export function progressSummary(now = new Date(), tuneId?: string) {
  const db = getDb();
  const reviews = db.select().from(conceptReviews).all();
  // newest id first, so a createdAt tie resolves to the later run (summariseProgress sorts stably)
  const attempts = db
    .select({
      ruleId: coachAttempts.ruleId,
      keyTonic: coachAttempts.keyTonic,
      misses: coachAttempts.misses,
      leaps: coachAttempts.leaps,
      tuneId: coachAttempts.tuneId,
      moveId: coachAttempts.moveId,
      clean: coachAttempts.clean,
      createdAt: coachAttempts.createdAt,
    })
    .from(coachAttempts)
    .orderBy(desc(coachAttempts.id))
    .all();
  // only the newest runs can be shown, so the database does the filter and the limit
  const q = db.select().from(improvRuns);
  const improv = (tuneId ? q.where(eq(improvRuns.tuneId, tuneId)) : q)
    .orderBy(desc(improvRuns.createdAt), desc(improvRuns.id))
    .limit(RECENT_IMPROV_LIMIT)
    .all();
  return summariseProgress({ reviews, attempts, improv }, now, tuneId);
}
