import { chroma } from "./pitch";
import { KEYS } from "./transpose";

/**
 * Spaced repetition for jazz vocabulary, SM-2 style, plus the practice-history summary the
 * passport reads. A "concept" is a reharm rule in a key ("tritone sub in D♭"), graded by how a
 * Coach run went.
 *
 * Pure and synchronous, so the API (SQLite) and the static demo (IndexedDB in the browser)
 * grade, schedule and summarise a run identically.
 */

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewState {
  reps: number;
  ease: number;
  intervalDays: number;
  dueAt: Date;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
export const RETRY_AFTER_MINUTES = 10;
export const MIN_EASE = 1.3;

/** One spelling per key, so "C#" and "Db" are the same concept. */
export const normaliseKey = (k: string) => KEYS[chroma(k)];

/**
 * 5: clean and smooth · 4: clean notes but a voice jumped · 3: one miss
 * 2: a few misses · 1: struggled · (0 is reserved for "gave up").
 */
export function gradeAttempt(a: { misses: number; leaps: number }): Grade {
  if (a.misses === 0) return a.leaps === 0 ? 5 : 4;
  if (a.misses === 1) return 3;
  if (a.misses <= 3) return 2;
  return 1;
}

/** Next review state after a graded attempt. Grades below 3 reset the streak and come back in 10 minutes. */
export function scheduleReview(prev: ReviewState | null, grade: Grade, now: Date): ReviewState {
  const ease0 = prev?.ease ?? 2.5;
  const q = 5 - grade;
  const ease = Math.max(MIN_EASE, Math.round((ease0 + (0.1 - q * (0.08 + q * 0.02))) * 1000) / 1000);
  if (grade < 3) {
    return { reps: 0, ease, intervalDays: RETRY_AFTER_MINUTES / 1440, dueAt: new Date(now.getTime() + RETRY_AFTER_MINUTES * MINUTE) };
  }
  const reps = (prev?.reps ?? 0) + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round((prev?.intervalDays ?? 3) * ease * 100) / 100;
  return { reps, ease, intervalDays, dueAt: new Date(now.getTime() + intervalDays * DAY) };
}

// ── one Coach run → the concept's next review ──

/** A concept's schedule and tallies: one per (rule, key). */
export interface ConceptReview extends ReviewState {
  ruleId: string;
  keyTonic: string;
  attempts: number;
  cleanRuns: number;
  lastGrade: number | null;
  lastReviewedAt: Date | null;
}

export interface CoachRunInput {
  ruleId: string;
  keyTonic: string;
  misses: number;
  leaps: number;
}

/** Grade a finished Coach run and advance its concept's schedule. `prev` is that concept's current review, if any. */
export function applyCoachRun(prev: ConceptReview | null, run: CoachRunInput, now: Date): { grade: Grade; clean: boolean; review: ConceptReview } {
  const keyTonic = normaliseKey(run.keyTonic);
  const grade = gradeAttempt(run);
  const clean = run.misses === 0 && run.leaps === 0;
  const next = scheduleReview(prev, grade, now);
  return {
    grade,
    clean,
    review: {
      ruleId: run.ruleId,
      keyTonic,
      ...next,
      attempts: (prev?.attempts ?? 0) + 1,
      cleanRuns: (prev?.cleanRuns ?? 0) + (clean ? 1 : 0),
      lastGrade: grade,
      lastReviewedAt: now,
    },
  };
}

// ── the passport's summary of a whole history ──

export interface Place {
  tuneId: string;
  moveId: string;
}

export interface CoachAttemptRecord extends CoachRunInput {
  tuneId: string | null;
  moveId: string;
  clean: boolean;
  createdAt: Date;
}

export interface ImprovRunRecord {
  id: number;
  tuneId: string | null;
  level: number;
  view: "reharm" | "original";
  notes: number;
  chordTonePct: number;
  tensionPct: number;
  avoidPct: number;
  outsidePct: number;
  strongBeatChordTonePct: number | null;
  guideToneLandings: number;
  heldAvoidNotes: number;
  createdAt: Date;
}

type Serialised<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export interface ProgressSummary {
  concepts: Serialised<ConceptReview>[];
  places: Record<string, Place | null>;
  cleanKeys: Record<string, string[]>;
  due: (Serialised<ConceptReview> & { lastPlace: Place | null })[];
  recentImprov: Serialised<ImprovRunRecord>[];
}

export const RECENT_IMPROV_LIMIT = 20;

const iso = <T extends object>(row: T): Serialised<T> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as Serialised<T>;

/**
 * Everything the passport needs, from a full practice history: the same shape and rules as the
 * API's `GET /practice/progress`. A key is clean once it has a clean run; a review is due once
 * its due time has passed; a concept's place is where it was last practised on a tune.
 */
export function summariseProgress(
  history: { reviews: ConceptReview[]; attempts: CoachAttemptRecord[]; improv: ImprovRunRecord[] },
  now: Date,
  tuneId?: string,
): ProgressSummary {
  const concepts = [...history.reviews].sort((a, b) => a.ruleId.localeCompare(b.ruleId) || a.keyTonic.localeCompare(b.keyTonic));

  const newestFirst = [...history.attempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const places: Record<string, Place | null> = {};
  for (const ruleId of new Set(concepts.map((c) => c.ruleId))) {
    const last = newestFirst.find((a) => a.ruleId === ruleId && a.tuneId);
    places[ruleId] = last?.tuneId ? { tuneId: last.tuneId, moveId: last.moveId } : null;
  }

  const cleanKeys: Record<string, string[]> = {};
  for (const a of history.attempts) {
    if (!a.clean) continue;
    const keys = (cleanKeys[a.ruleId] ??= []);
    const key = normaliseKey(a.keyTonic);
    if (!keys.includes(key)) keys.push(key);
  }
  for (const keys of Object.values(cleanKeys)) keys.sort((a, b) => chroma(a) - chroma(b));

  const due = concepts
    .filter((c) => c.dueAt.getTime() <= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((c) => ({ ...iso(c), lastPlace: places[c.ruleId] ?? null }));

  const recentImprov = history.improv
    .filter((r) => !tuneId || r.tuneId === tuneId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RECENT_IMPROV_LIMIT)
    .map(iso);

  return { concepts: concepts.map(iso), places, cleanKeys, due, recentImprov };
}
