/*
 * Reharm Daily (itailiors.github.io/reharm-daily/) is a hub for a family of daily music games on
 * this same origin. They talk only through localStorage. The Lab reads, and never writes, two
 * kinds of key (the hub's data-contract.md):
 *   daily:v1:<gameId>   { v: 1, dateKey: "YYYY-MM-DD" (local), status: "new" | "in_progress" | "done", … }
 *   reharm:v1:history   REHARM's own solves: a map keyed by puzzle number, each { puzzleNumber, … }
 * REHARM numbers its puzzles by LOCAL calendar day from 2026-11-25 = #1, rolling over at local
 * midnight, so "done today" without a native record means "today's local number is in its history".
 */

export const DAILY_HUB_URL = "https://itailiors.github.io/reharm-daily/";
export const REHARM_EPOCH = "2026-11-25";

/** What the toolbar pill shows. `blocked`: storage couldn't be read, so no count at all. */
export type DailyStatus = { kind: "blocked" } | { kind: "ok"; unplayed: number; total: number };

/** Just the read we need (never `setItem`): makes the read-only promise checkable in tests. */
export type ReadStore = Pick<Storage, "getItem">;

/** Local calendar date as YYYY-MM-DD (the hub's `getLocalDateKey`). */
export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Puzzle number of `now`'s local day; the epoch day is #1. Calendar parts, so a DST day is one day. */
export function localPuzzleNumber(now: Date, epochKey: string): number {
  const dayStart = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((dayStart - Date.parse(`${epochKey}T00:00:00Z`)) / 86_400_000) + 1);
}

/** JSON.parse that turns corrupt data into null (one bad key never sinks the count). */
function json(store: ReadStore, key: string): unknown {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Today's native `daily:v1:<id>` status, or null when there's no usable record for today. */
function nativeToday(store: ReadStore, gameId: string, today: string): "new" | "in_progress" | "done" | null {
  const r = json(store, `daily:v1:${gameId}`);
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (o.v !== 1 || o.dateKey !== today) return null; // a stale day reads as "new" (the hub's rule)
  return o.status === "new" || o.status === "in_progress" || o.status === "done" ? o.status : null;
}

/** REHARM's fallback: is today's local puzzle number in `reharm:v1:history`? */
function reharmHistoryHasToday(store: ReadStore, now: Date): boolean {
  const h = json(store, "reharm:v1:history");
  if (!h || typeof h !== "object" || Array.isArray(h)) return false;
  const today = localPuzzleNumber(now, REHARM_EPOCH);
  if (String(today) in h) return true;
  return Object.values(h).some((e) => !!e && typeof e === "object" && (e as { puzzleNumber?: unknown }).puzzleNumber === today);
}

/** The live dailies, in catalog order. A game with only native records needs no fallback. */
export const LIVE_DAILIES: ReadonlyArray<{ id: string; fallbackDone?: (store: ReadStore, now: Date) => boolean }> = [
  { id: "reharm", fallbackDone: reharmHistoryHasToday },
];

/**
 * How many live dailies are still unplayed today. `getStore` may itself throw (Safari's blocked
 * storage throws on `window.localStorage`), and so may any read: either way the answer is `blocked`.
 */
export function readDailyStatus(getStore: () => ReadStore | null | undefined, now: Date = new Date()): DailyStatus {
  try {
    const store = getStore();
    if (!store) return { kind: "blocked" };
    const today = localDateKey(now);
    let unplayed = 0;
    for (const g of LIVE_DAILIES) {
      const native = nativeToday(store, g.id, today);
      const done = native !== null ? native === "done" : (g.fallbackDone?.(store, now) ?? false);
      if (!done) unplayed++;
    }
    return { kind: "ok", unplayed, total: LIVE_DAILIES.length };
  } catch {
    return { kind: "blocked" };
  }
}

/** The pill's words for screen readers. */
export function dailyLabel(s: DailyStatus): string {
  if (s.kind === "blocked") return "Reharm Daily (opens the daily puzzles)";
  if (s.unplayed === 0) return "Reharm Daily: all of today's puzzles done";
  return `Reharm Daily: ${s.unplayed} ${s.unplayed === 1 ? "puzzle" : "puzzles"} left today`;
}
