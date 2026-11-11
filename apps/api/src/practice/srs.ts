/**
 * Spaced repetition for jazz vocabulary, SM-2 style.
 * A "concept" is a reharm rule in a key ("tritone sub in D♭"), graded by how a coach run went.
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
