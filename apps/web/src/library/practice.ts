import { conceptFamily, conceptKind } from "@reharm/theory-core";
import { DEMO } from "../demo";
import { reportApiUnreachable } from "./apiStatus";
import { toast } from "../components/Toaster";
import { localProgress, localStore, type ChangesSessionRecord } from "./localPractice";

/*
 * The practice-history client: the Coach and the heatmap report here, the dashboard reads
 * from here. Sessions are opened lazily (the first saved run of a kind opens one) and
 * closed when the page goes away.
 *
 * The static demo has no API, so it keeps history in this browser instead (localPractice.ts),
 * graded and scheduled by the same theory-core functions. Until a visitor saves their first run,
 * the passport shows a clearly labelled sample notebook.
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
  /** True when this is the demo's made-up sample notebook, not anyone's real practice. */
  sample?: boolean;
  /** Where the demo keeps the visitor's own runs: this browser, or only this tab when storage is blocked. */
  storedIn?: "browser" | "tab";
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

let warnedTabOnly = false;
/** A run saved in the demo's browser store: tell listeners, and say once if it only lasts this tab. */
function savedLocally(persistent: boolean) {
  saved();
  if (persistent || warnedTabOnly) return;
  warnedTabOnly = true;
  toast("This browser isn't letting the app store data, so your runs are kept only until you close this tab.", { tone: "warn" });
}

/** Erase every run this browser has saved (demo only). The passport goes back to the sample notebook. */
export async function forgetLocalPractice(): Promise<void> {
  await (await localStore()).clear();
  saved();
}

// ── the Changes game ──

/** The chart id the game's reviews are filed under (no tune: "where it was practised" is the game). */
export const CHANGES_CHART = conceptFamily("ear").chart!;

/**
 * Save a session of Make the Changes. The session itself (answers, points, stamps) stays in this
 * browser in every build; its Open answers are handed to the spaced-repetition scheduler as
 * `ear:<motion>` concepts per key, through the same path as a Coach run (the API, or the browser
 * in the demo), so they show up in the passport and come back when due.
 */
export async function saveChangesSession(rec: ChangesSessionRecord, runs: { ruleId: string; keyTonic: string; misses: number; leaps: number }[]) {
  const store = await localStore();
  await store.recordChangesSession(rec);
  for (const r of runs) await saveCoachRun({ tuneId: CHANGES_CHART, moveId: r.ruleId, ...r, maxLeap: 0, gradedBy: "engine" });
  if (!runs.length) saved();
}

/** Every saved session of the game, oldest first. */
export const fetchChangesSessions = async (): Promise<ChangesSessionRecord[]> =>
  (await (await localStore()).readChangesSessions()).sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

/** The game's due reviews (`ear:*`), most overdue first; reharm reviews are the Coach's business. */
export const fetchEarDue = async (): Promise<DueItem[]> => ((await fetchDue()) ?? []).filter((d) => conceptKind(d.ruleId) === "ear");

// ── the Voicings tab ──

/** The chart id shape reviews are filed under (no tune: they're practised in the Voicings tab). */
export const VOICINGS_CHART = conceptFamily("shape").chart!;

/**
 * A chord voiced cleanly in the Voicings tab: one `shape:<style>:<quality>` concept in the chord's
 * root, graded by the server from the wrong strikes before it (`misses`). Demo-aware like a Coach run.
 */
export const saveShapeRun = (run: { ruleId: string; keyTonic: string; misses: number }) =>
  saveCoachRun({ tuneId: VOICINGS_CHART, moveId: run.ruleId, ...run, leaps: 0, maxLeap: 0, gradedBy: "engine" });

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
  if (DEMO) {
    const store = await localStore();
    const { grade, clean, review } = await store.recordCoachRun(
      { tuneId: chartId(run.tuneId), moveId: run.moveId, ruleId: run.ruleId, keyTonic: run.keyTonic, misses: run.misses, leaps: run.leaps },
      new Date(),
    );
    savedLocally(store.persistent);
    return { grade, clean, review: { ...review, dueAt: review.dueAt.toISOString(), lastReviewedAt: review.lastReviewedAt?.toISOString() ?? null } };
  }
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
  if (DEMO) {
    const store = await localStore();
    await store.recordImprovRun({ ...run, tuneId: chartId(run.tuneId) }, new Date());
    savedLocally(store.persistent);
    return true;
  }
  const tuneId = chartId(run.tuneId);
  const sessionId = await sessionFor("improv", tuneId, tempo);
  if (!sessionId) return couldntSave(), false;
  const res = await post<{ id: number }>("/improv-runs", { ...run, tuneId, sessionId });
  if (!res) couldntSave();
  else saved();
  return !!res;
}

// ── reads ──

/**
 * The demo reads the visitor's own history from this browser. Before their first saved run it
 * shows the seeded sample notebook instead (lazy-loaded, so normal builds don't carry it),
 * marked `sample` so the UI can label it. The two are never mixed.
 */
async function demoReadProgress(tuneId?: string): Promise<Progress> {
  const local = await localProgress(tuneId ? chartId(tuneId) : undefined);
  if (local.empty) return { ...(await import("./demoHistory").then((m) => m.demoProgress())), sample: true };
  return { ...local.summary, storedIn: local.persistent ? "browser" : "tab" };
}

export const fetchProgress = (tuneId?: string): Promise<Progress | null> =>
  DEMO ? demoReadProgress(tuneId) : call<Progress>(`/progress${tuneId ? `?tuneId=${encodeURIComponent(chartId(tuneId))}` : ""}`);
export const fetchDue = (): Promise<DueItem[] | null> => (DEMO ? fetchProgress().then((p) => p?.due ?? null) : call<DueItem[]>("/due"));
