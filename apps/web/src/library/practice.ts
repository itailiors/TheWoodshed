import { DEMO } from "../demo";
import { reportApiUnreachable } from "./apiStatus";
import { toast } from "../components/Toaster";

/*
 * The practice-history client: the Coach and the heatmap report here, the dashboard reads
 * from here. Sessions are opened lazily (the first saved run of a kind opens one) and
 * closed when the page goes away. In the read-only demo every call is a quiet no-op.
 */

export interface Review {
  ruleId: string;
  keyTonic: string;
  reps: number;
  ease: number;
  intervalDays: number;
  dueAt: string | number;
  attempts: number;
  cleanRuns: number;
  lastGrade: number | null;
  lastReviewedAt: string | number | null;
}

export interface DueItem extends Review {
  /** Where this concept was last practised, so the queue can open the Coach right there. */
  lastPlace: { tuneId: string; moveId: string } | null;
}

export interface ImprovRun {
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
  createdAt: string | number;
}

export interface Progress {
  concepts: Review[];
  places: Record<string, { tuneId: string; moveId: string } | null>;
  cleanKeys: Record<string, string[]>;
  due: DueItem[];
  recentImprov: ImprovRun[];
}

export interface CoachRunResult {
  grade: number;
  clean: boolean;
  review: Review;
}

/** A transposed tune's id is `base@Key`; history belongs to the chart itself. */
export const chartId = (tuneId: string) => tuneId.split("@")[0];

// ── change notifications (the dashboard and the Coach's "clean in" list listen) ──
const listeners = new Set<() => void>();
export function onPracticeSaved(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const saved = () => listeners.forEach((l) => l());

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (DEMO) return null;
  let res: Response;
  try {
    res = await fetch(`/api/practice${path}`, init);
  } catch {
    reportApiUnreachable();
    return null;
  }
  if (!res.ok) {
    if (res.status >= 500) reportApiUnreachable();
    console.warn(`[practice] ${path}: HTTP ${res.status}`, await res.text().catch(() => ""));
    return null;
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

// ── sessions ──
const sessions = new Map<string, Promise<number | null>>();

function sessionFor(mode: "coach" | "improv", tuneId: string, tempo?: number): Promise<number | null> {
  const k = `${mode}:${tuneId}`;
  let s = sessions.get(k);
  if (!s) {
    s = post<{ id: number }>("/sessions", { mode, tuneId, tempo: tempo ? Math.round(tempo) : null }).then((r) => r?.id ?? null);
    sessions.set(k, s);
    // a failed open (API down) shouldn't stick: the next run tries again
    void s.then((id) => id === null && sessions.delete(k));
  }
  return s;
}

/** Close every open session when the page goes away (sendBeacon survives the unload). */
if (!DEMO && typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const s of sessions.values()) void s.then((id) => id && navigator.sendBeacon(`/api/practice/sessions/${id}/end`));
    sessions.clear();
  });
}

let warnedOffline = false;
function couldntSave() {
  if (warnedOffline) return;
  warnedOffline = true;
  toast("Couldn't save that run: the API isn't reachable. Practice on; runs will save again once it's back.", { tone: "warn" });
  setTimeout(() => (warnedOffline = false), 60_000);
}

// ── writes ──

/**
 * A finished Coach run, heard by the engine or self-checked. The server grades it (0–5) from the
 * misses and leaps and reschedules the concept, the same SM-2 path either way.
 */
export async function saveCoachRun(run: {
  tuneId: string;
  moveId: string;
  ruleId: string;
  keyTonic: string;
  misses: number;
  leaps: number;
  maxLeap: number;
  tempo?: number;
  /** "self" when the player checked their own acoustic-piano voicing (no notes were heard). */
  gradedBy?: "engine" | "self";
}): Promise<CoachRunResult | null> {
  if (DEMO) return null;
  const tuneId = chartId(run.tuneId);
  const sessionId = await sessionFor("coach", tuneId, run.tempo);
  if (!sessionId) return couldntSave(), null;
  const res = await post<CoachRunResult>("/coach-attempts", {
    sessionId,
    tuneId,
    moveId: run.moveId,
    ruleId: run.ruleId,
    keyTonic: run.keyTonic,
    misses: run.misses,
    leaps: run.leaps,
    maxLeap: Math.min(127, run.maxLeap),
    gradedBy: run.gradedBy ?? "engine",
  });
  if (!res) couldntSave();
  else saved();
  return res;
}

export interface ImprovRunInput {
  tuneId: string;
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

/** One pass of soloing over the loop, summarised. */
export async function saveImprovRun(run: ImprovRunInput, tempo?: number): Promise<boolean> {
  if (DEMO) return false;
  const tuneId = chartId(run.tuneId);
  const sessionId = await sessionFor("improv", tuneId, tempo);
  if (!sessionId) return couldntSave(), false;
  const res = await post<{ id: number }>("/improv-runs", { ...run, tuneId, sessionId });
  if (!res) couldntSave();
  else saved();
  return !!res;
}

// ── reads ──
// The demo reads a seeded history instead (lazy-loaded, so normal builds don't carry it).
export const fetchProgress = (tuneId?: string): Promise<Progress | null> =>
  DEMO
    ? import("./demoHistory").then((m) => m.demoProgress())
    : call<Progress>(`/progress${tuneId ? `?tuneId=${encodeURIComponent(chartId(tuneId))}` : ""}`);
export const fetchDue = (): Promise<DueItem[] | null> => (DEMO ? fetchProgress().then((p) => p?.due ?? null) : call<DueItem[]>("/due"));
