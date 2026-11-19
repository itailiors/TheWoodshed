import { summariseProgress, type CoachAttemptRecord, type ConceptReview, type ImprovRunRecord } from "@reharm/theory-core";
import type { ImprovRun, Progress, Review } from "./practice";

/*
 * The read-only demo saves nothing, so its Concept Passport would be a blank grid: the one
 * screen meant to show the practice loop working would look unfinished. Instead it reads
 * three weeks of a plausible player's history from demoHistory.json.
 *
 * The fixture stores times relative to now ("reviewed 2.5 days ago, due in 4.2 days"), so
 * the demo looks lived-in on any date instead of everything slowly going overdue. It keeps
 * per-concept tallies rather than every run, so this stands in one run per concept (clean if
 * the concept has any clean run, played at its fixture place) and hands the lot to
 * theory-core's `summariseProgress`: the same rules as the API's /progress.
 */

interface Fixture {
  tuneId: string;
  places: Record<string, { tuneId: string; moveId: string }>;
  concepts: (Omit<Review, "dueAt" | "lastReviewedAt"> & { reviewedDaysAgo: number; dueInDays: number })[];
  improv: (Omit<ImprovRun, "id" | "tuneId" | "createdAt"> & { daysAgo: number })[];
}

const DAY = 86_400_000;
let fixture: Promise<Fixture> | null = null;

export async function demoProgress(now = Date.now()): Promise<Progress> {
  fixture ??= import("./demoHistory.json").then((m) => m.default as Fixture);
  const f = await fixture;
  const at = (offsetDays: number) => new Date(now + offsetDays * DAY);

  const reviews: ConceptReview[] = f.concepts.map(({ reviewedDaysAgo, dueInDays, ...c }) => ({
    ...c,
    lastReviewedAt: at(-reviewedDaysAgo),
    dueAt: at(dueInDays),
  }));

  const attempts: CoachAttemptRecord[] = reviews.map((r) => {
    const place = f.places[r.ruleId];
    return {
      ruleId: r.ruleId,
      keyTonic: r.keyTonic,
      misses: 0,
      leaps: 0,
      tuneId: place?.tuneId ?? null,
      moveId: place?.moveId ?? "",
      clean: r.cleanRuns > 0,
      createdAt: r.lastReviewedAt ?? new Date(now),
    };
  });

  const improv: ImprovRunRecord[] = f.improv.map(({ daysAgo, ...r }, i) => ({ ...r, id: i + 1, tuneId: f.tuneId, createdAt: at(-daysAgo) }));

  return summariseProgress({ reviews, attempts, improv }, new Date(now));
}
