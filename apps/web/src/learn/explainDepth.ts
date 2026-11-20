import type { LessonFlag } from "@reharm/theory-core";
import { useEffect, useState } from "react";
import type { OwnProgress } from "./pathStates";

/*
 * How much a lesson explains (decision 6, spec §D "Fading"). The ⚙ setting, kept per browser in
 * `reharm.explain`, overrides everything: "rule" opens every lesson folded to the rule. In
 * "steps", a concept folds only once the player has at least one CLEAN graded key of it (a
 * finished lesson alone keeps the steps open), and a rough latest run (grade ≤ 2) reopens the
 * steps once. Only the player's own runs count: callers pass `ownProgressOnly(...)`, so the demo's
 * seeded sample never folds anything (rule 11).
 */

export type ExplainSetting = "steps" | "rule";
export const EXPLAIN_STORE = "reharm.explain";
/** A new visitor gets the steps (decision 6). */
export const DEFAULT_EXPLAIN: ExplainSetting = "steps";
/** A latest graded run at or below this grade (SM-2's 0–5) reopens the steps. */
export const ROUGH_GRADE = 2;

/** A concept's most recent graded run: which key, its grade, and when (ISO). */
export interface GradedRun {
  keyTonic: string;
  grade: number;
  at: string;
}

export interface ExplainDepth {
  /** The steps open (true) or the lesson opens folded to headline + rule + "Step by step ›". */
  open: boolean;
  /** The rough run that reopened the steps this time, to say so; null otherwise. */
  rough: GradedRun | null;
}

/**
 * The depth for one concept. Pure. `reopenedFor` is the rough run that has already reopened the
 * steps (the lesson flag of that name): the same run never reopens them twice.
 */
export function depthFor(setting: ExplainSetting, cleanKeys: number, latestRun: GradedRun | null, reopenedFor?: string): ExplainDepth {
  if (setting === "rule") return { open: false, rough: null };
  if (cleanKeys < 1) return { open: true, rough: null };
  if (latestRun && latestRun.grade <= ROUGH_GRADE && latestRun.at !== reopenedFor) return { open: true, rough: latestRun };
  return { open: false, rough: null };
}

const timeOf = (t: string | number | null) => (t === null ? NaN : new Date(t).getTime());

/** The concept's latest graded run across its keys, or null. Pure. */
export function latestRunFor(own: OwnProgress, conceptId: string): GradedRun | null {
  let best: { r: OwnProgress["concepts"][number]; t: number } | null = null;
  for (const r of own.concepts) {
    if (r.ruleId !== conceptId || r.lastGrade === null) continue;
    const t = timeOf(r.lastReviewedAt);
    if (Number.isNaN(t)) continue;
    if (!best || t > best.t) best = { r, t };
  }
  return best ? { keyTonic: best.r.keyTonic, grade: best.r.lastGrade!, at: new Date(best.t).toISOString() } : null;
}

/** `depthFor` from the player's own progress and the concept's lesson flag. Pure. */
export function explainFor(setting: ExplainSetting, own: OwnProgress, conceptId: string, flag?: LessonFlag): ExplainDepth {
  return depthFor(setting, own.cleanKeys[conceptId]?.length ?? 0, latestRunFor(own, conceptId), flag?.reopenedFor);
}

// ── the setting, per browser ──

const isSetting = (v: unknown): v is ExplainSetting => v === "steps" || v === "rule";

/** The stored setting, or the visitor default when it's missing, junk or storage is blocked. */
export function readExplainSetting(): ExplainSetting {
  try {
    const v = localStorage.getItem(EXPLAIN_STORE);
    return isSetting(v) ? v : DEFAULT_EXPLAIN;
  } catch {
    return DEFAULT_EXPLAIN;
  }
}

const listeners = new Set<(s: ExplainSetting) => void>();
/** Kept in memory too, so a browser with storage blocked still honours the choice for this page. */
let current: ExplainSetting | null = null;

export function writeExplainSetting(s: ExplainSetting) {
  current = s;
  try {
    localStorage.setItem(EXPLAIN_STORE, s);
  } catch {
    /* blocked: this page only */
  }
  listeners.forEach((l) => l(s));
}

const now = () => current ?? readExplainSetting();

/** The setting, live: every reader follows a change in the ⚙ menu (or another tab). */
export function useExplainSetting(): ExplainSetting {
  const [s, setS] = useState(now);
  useEffect(() => {
    listeners.add(setS);
    const fromOtherTab = (e: StorageEvent) => {
      if (e.key === EXPLAIN_STORE || e.key === null) setS((current = readExplainSetting()));
    };
    window.addEventListener("storage", fromOtherTab);
    setS(now());
    return () => {
      listeners.delete(setS);
      window.removeEventListener("storage", fromOtherTab);
    };
  }, []);
  return s;
}

/** The setting's words, in menu order. */
export const EXPLAIN_LABEL: Record<ExplainSetting, string> = { steps: "Step by step", rule: "Just the rule" };

/** "A rough run in A♭: the steps are open again." (spec §D). `key` is the display spelling. */
export const roughRunLine = (key: string) => `A rough run in ${key}: the steps are open again.`;
