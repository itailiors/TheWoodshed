import { conceptFamily, conceptKind } from "@reharm/theory-core";
import { DEMO } from "../demo";
import { toast } from "../components/Toaster";
import { localStore, type ChangesSessionRecord } from "./localPractice";
import { apiHistory } from "./historyApi";
import { browserHistory } from "./historyBrowser";

/*
 * The practice-history client: the Coach, the drills and the heatmap report here, the passport
 * reads from here. Where history lives is one `PracticeHistory` adapter, picked once:
 *   - historyApi.ts: the server (normal build), which grades and schedules;
 *   - historyBrowser.ts: this browser (the static demo, which has no API), graded and scheduled by
 *     the same theory-core functions. Until a visitor saves a run, its passport is a clearly
 *     labelled sample notebook, and its due list is empty.
 * Everything below this seam is build-agnostic.
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

/** A finished Coach or drill run, as filed. `tuneId` is already the chart id. */
export interface CoachRunWrite {
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
  /** Voicings' "Hear, hide, play": played clean from memory while the voicing was hidden. */
  byEar?: boolean;
}

/** Where practice history lives. Ids passed in are chart ids (`chartId`), never transposed ones. */
export interface PracticeHistory {
  /** File a run and reschedule its concept; null when it couldn't be saved (the adapter has said why). */
  saveCoachRun(run: CoachRunWrite): Promise<CoachRunResult | null>;
  saveImprovRun(run: ImprovRunInput, tempo?: number): Promise<boolean>;
  /** The passport, for one chart or all. May be a sample notebook, marked `sample`. */
  progress(chart?: string): Promise<Progress | null>;
  /** The player's own due reviews, most overdue first. Never a sample's. */
  due(): Promise<DueItem[] | null>;
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

let warnedOffline = false;
function couldntSave() {
  if (warnedOffline) return;
  warnedOffline = true;
  toast("Couldn't save that run: the API isn't reachable. Practice on; runs will save again once it's back.", { tone: "warn" });
  setTimeout(() => (warnedOffline = false), 60_000);
}

let warnedTabOnly = false;
function tabOnly() {
  if (warnedTabOnly) return;
  warnedTabOnly = true;
  toast("This browser isn't letting the app store data, so your runs are kept only until you close this tab.", { tone: "warn" });
}

const where: PracticeHistory = DEMO
  ? browserHistory({ store: localStore, sample: () => import("./demoHistory").then((m) => m.demoProgress()), onTabOnly: tabOnly })
  : apiHistory({ onOffline: couldntSave });

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
export const saveShapeRun = (run: { ruleId: string; keyTonic: string; misses: number; byEar?: boolean }) =>
  saveCoachRun({ tuneId: VOICINGS_CHART, moveId: run.ruleId, ...run, leaps: 0, maxLeap: 0, gradedBy: "engine" });

// ── writes ──

/**
 * A finished Coach run, heard by the engine or self-checked. The server grades it (0–5) from the
 * misses and leaps and reschedules the concept, the same SM-2 path either way.
 */
export async function saveCoachRun(run: CoachRunWrite): Promise<CoachRunResult | null> {
  const res = await where.saveCoachRun({ ...run, tuneId: chartId(run.tuneId) });
  if (res) saved();
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
  const ok = await where.saveImprovRun({ ...run, tuneId: chartId(run.tuneId) }, tempo);
  if (ok) saved();
  return ok;
}

// ── reads ──

/** The passport, for one tune's chart or all. In the demo it may be the sample notebook (`sample`). */
export const fetchProgress = (tuneId?: string): Promise<Progress | null> => where.progress(tuneId ? chartId(tuneId) : undefined);
/** The player's own due reviews (never the demo's sample). */
export const fetchDue = (): Promise<DueItem[] | null> => where.due();
