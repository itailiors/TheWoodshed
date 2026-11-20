import { LESSON_STAGES, type LessonFlag } from "@reharm/theory-core";

/*
 * Lesson flags (seen, finished, tested out, relearn, last stage, "Continue anyway"), kept in this
 * browser only as `reharm.lessons` = `{v: 1, flags}`. Nothing is sent anywhere, so it works the
 * same in the demo (zero /api). Every entry is checked on read and a malformed one is dropped; a
 * version this code doesn't know is ignored (read as empty), and a newer one is never overwritten.
 * Blocked storage is never an error.
 */

export const LESSONS_STORE = "reharm.lessons";
const VERSION = 1;

export type LessonFlags = Record<string, LessonFlag>;

const isDate = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const FIELDS: Record<keyof LessonFlag, (v: unknown) => boolean> = {
  seenAt: isDate,
  finishedAt: isDate,
  // 3f (parked): test-out and "Relearn this" write these; nothing does yet, but stored ones are kept
  testedOutAt: isDate,
  testedOutVia: (v) => typeof v === "string" && v.length > 0,
  relearn: (v) => typeof v === "boolean",
  lastStage: (v) => (LESSON_STAGES as readonly unknown[]).includes(v),
  continuedAnyway: (v) => typeof v === "boolean",
  reopenedFor: isDate,
};

/** One entry, or null when it's malformed (not an object, or a known field of the wrong type). Unknown fields are dropped. */
export function validFlag(raw: unknown): LessonFlag | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const check = FIELDS[k as keyof LessonFlag];
    if (!check || v === undefined) continue;
    if (!check(v)) return null;
    out[k] = v;
  }
  return out as LessonFlag;
}

/** The stored text, parsed: `{}` for nothing, junk or an unknown version. Pure. */
export function parseLessonFlags(text: string | null): LessonFlags {
  if (!text) return {};
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return {};
  }
  if (!doc || typeof doc !== "object") return {};
  const { v, flags } = doc as { v?: unknown; flags?: unknown };
  if (v !== VERSION || !flags || typeof flags !== "object" || Array.isArray(flags)) return {};
  const out: LessonFlags = {};
  for (const [id, raw] of Object.entries(flags)) {
    const f = validFlag(raw);
    if (f) out[id] = f;
  }
  return out;
}

// ── change notifications (usePathStates listens) ──
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Called after any change to the flags, in this tab or (through the `storage` event) another. */
export function onLessonFlagsChanged(fn: () => void) {
  listeners.add(fn);
  const fromOtherTab = (e: StorageEvent) => {
    if (e.key === LESSONS_STORE || e.key === null) fn();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", fromOtherTab);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", fromOtherTab);
  };
}

export function readLessonFlags(): LessonFlags {
  try {
    return parseLessonFlags(localStorage.getItem(LESSONS_STORE));
  } catch {
    return {};
  }
}

/** The stored document is a newer version than this code writes (a downgrade): it reads as empty, and must not be overwritten. */
function storedIsNewer(): boolean {
  try {
    const doc = JSON.parse(localStorage.getItem(LESSONS_STORE) ?? "null") as { v?: unknown } | null;
    return typeof doc?.v === "number" && doc.v > VERSION;
  } catch {
    return false;
  }
}

function write(flags: LessonFlags) {
  // a newer app's flags stay intact for when it comes back; this version simply keeps nothing
  if (storedIsNewer()) return;
  try {
    localStorage.setItem(LESSONS_STORE, JSON.stringify({ v: VERSION, flags }));
  } catch {
    /* private mode: kept nowhere */
  }
  changed();
}

/**
 * Merge `patch` into one concept's flag. A field set to `undefined` is removed; an entry left
 * empty is deleted. Call from event handlers, never from an effect body (StrictMode runs those twice);
 * an effect that stamps a first open uses `markLessonSeen`.
 */
export function updateLessonFlag(conceptId: string, patch: Partial<LessonFlag>) {
  const all = readLessonFlags();
  const next: Record<string, unknown> = { ...all[conceptId], ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  const flag = validFlag(next);
  if (!flag) return;
  if (Object.keys(flag).length) all[conceptId] = flag;
  else delete all[conceptId];
  write(all);
}

/**
 * Stamp `seenAt` the first time a lesson opens, and never again. Idempotent, so unlike
 * `updateLessonFlag` it is safe from an effect (a stepper mounting, StrictMode's second run): a
 * repeat call writes nothing and notifies nobody.
 */
export function markLessonSeen(conceptId: string, now = new Date()) {
  if (readLessonFlags()[conceptId]?.seenAt) return;
  updateLessonFlag(conceptId, { seenAt: now.toISOString() });
}

/** Forget every lesson flag, test-outs included (the demo's "Erase runs"). A newer app's document is left alone, as `write` leaves it. */
export function clearLessonFlags() {
  if (storedIsNewer()) return;
  try {
    localStorage.removeItem(LESSONS_STORE);
  } catch {
    /* nothing to clear */
  }
  changed();
}
