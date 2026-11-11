import { chroma } from "@reharm/theory-core";
import type { DueItem, ImprovRun, Progress, Review } from "./practice";

/*
 * The read-only demo saves nothing, so its Concept Passport would be a blank grid: the one
 * screen meant to show the practice loop working would look unfinished. Instead it reads
 * three weeks of a plausible player's history from demoHistory.json.
 *
 * The fixture stores times relative to now ("reviewed 2.5 days ago, due in 4.2 days"), so
 * the demo looks lived-in on any date instead of everything slowly going overdue. This
 * builds the same `Progress` shape the API's /progress returns, with the same rules: a key
 * is "clean" once it has a clean run, and a review is due once its due time has passed.
 */

interface Fixture {
  tuneId: string;
  places: Record<string, string>;
  concepts: (Omit<Review, "dueAt" | "lastReviewedAt"> & { reviewedDaysAgo: number; dueInDays: number })[];
  improv: (Omit<ImprovRun, "id" | "tuneId" | "createdAt"> & { daysAgo: number })[];
}

const DAY = 86_400_000;
let fixture: Promise<Fixture> | null = null;

export async function demoProgress(now = Date.now()): Promise<Progress> {
  fixture ??= import("./demoHistory.json").then((m) => m.default as Fixture);
  const f = await fixture;
  const iso = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();

  const concepts: Review[] = f.concepts.map(({ reviewedDaysAgo, dueInDays, ...c }) => ({
    ...c,
    lastReviewedAt: iso(-reviewedDaysAgo),
    dueAt: iso(dueInDays),
  }));

  const places: Progress["places"] = {};
  for (const [ruleId, moveId] of Object.entries(f.places)) places[ruleId] = { tuneId: f.tuneId, moveId };

  const cleanKeys: Progress["cleanKeys"] = {};
  for (const c of concepts) if (c.cleanRuns > 0) (cleanKeys[c.ruleId] ??= []).push(c.keyTonic);
  for (const keys of Object.values(cleanKeys)) keys.sort((a, b) => chroma(a) - chroma(b));

  const due: DueItem[] = concepts
    .filter((c) => new Date(c.dueAt).getTime() <= now)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .map((c) => ({ ...c, lastPlace: places[c.ruleId] ?? null }));

  const recentImprov: ImprovRun[] = f.improv
    .map(({ daysAgo, ...r }, i) => ({ ...r, id: i + 1, tuneId: f.tuneId, createdAt: iso(-daysAgo) }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { concepts, places, cleanKeys, due, recentImprov };
}
