import { applyCoachRun, chroma, normaliseKey } from "@reharm/theory-core";
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm";
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

/** Keys each concept has been played cleanly in: the coach's "Clean in" list, across sessions. */
export function cleanKeys(): Record<string, string[]> {
  const rows = getDb()
    .selectDistinct({ ruleId: coachAttempts.ruleId, keyTonic: coachAttempts.keyTonic })
    .from(coachAttempts)
    .where(eq(coachAttempts.clean, true))
    .all();
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.ruleId] ??= []).push(r.keyTonic);
  for (const k of Object.keys(out)) out[k].sort((a, b) => chroma(a) - chroma(b));
  return out;
}

/**
 * Where a concept was last practised (any key): the tune and the move. Lets the review queue
 * say "open the Coach on this" rather than just naming a rule. Null if the only runs were on
 * tunes since deleted (their link is set to null).
 */
export function lastPlaceFor(ruleId: string): { tuneId: string; moveId: string } | null {
  const row = getDb()
    .select({ tuneId: coachAttempts.tuneId, moveId: coachAttempts.moveId })
    .from(coachAttempts)
    .where(and(eq(coachAttempts.ruleId, ruleId), isNotNull(coachAttempts.tuneId)))
    .orderBy(desc(coachAttempts.createdAt), desc(coachAttempts.id))
    .get();
  return row?.tuneId ? { tuneId: row.tuneId, moveId: row.moveId } : null;
}

/** Concepts whose review is due, oldest first, each with where it was last practised. */
export function dueConcepts(now = new Date()) {
  const rows = getDb().select().from(conceptReviews).where(lte(conceptReviews.dueAt, now)).orderBy(asc(conceptReviews.dueAt)).all();
  const places = new Map<string, ReturnType<typeof lastPlaceFor>>();
  return rows.map((r) => {
    if (!places.has(r.ruleId)) places.set(r.ruleId, lastPlaceFor(r.ruleId));
    return { ...r, lastPlace: places.get(r.ruleId) ?? null };
  });
}

export function allConcepts() {
  return getDb().select().from(conceptReviews).orderBy(asc(conceptReviews.ruleId), asc(conceptReviews.keyTonic)).all();
}

export function recentImprovRuns(tuneId?: string, limit = 20) {
  const q = getDb().select().from(improvRuns);
  return (tuneId ? q.where(eq(improvRuns.tuneId, tuneId)) : q).orderBy(desc(improvRuns.createdAt)).limit(limit).all();
}
