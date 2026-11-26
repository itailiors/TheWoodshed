import { describe, expect, it } from "vitest";
import { dailyLabel, localDateKey, localPuzzleNumber, readDailyStatus, REHARM_EPOCH, type ReadStore } from "./dailyStatus";

/** A read-only fake: `getItem` only, and it records every key asked for. */
function fake(data: Record<string, unknown>) {
  const reads: string[] = [];
  const store: ReadStore = {
    getItem: (k) => {
      reads.push(k);
      const v = data[k];
      return v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v);
    },
  };
  return { store, reads };
}

// local noon on 2026-11-27: REHARM's puzzle #3
const NOW = new Date(2026, 10, 27, 12, 0);
const TODAY = "2026-11-27";
const record = (over: Record<string, unknown>) => ({ v: 1, gameId: "reharm", dateKey: TODAY, puzzleNo: 3, status: "done", score: 90, scoreLabel: "90/100", streak: 1, updatedAt: 0, ...over });
const status = (data: Record<string, unknown>, now = NOW) => readDailyStatus(() => fake(data).store, now);

describe("Reharm Daily status (read-only)", () => {
  it("numbers puzzles by local day from the epoch", () => {
    expect(localDateKey(NOW)).toBe(TODAY);
    expect(localPuzzleNumber(new Date(2026, 10, 25, 0, 1), REHARM_EPOCH)).toBe(1);
    expect(localPuzzleNumber(new Date(2026, 10, 25, 23, 59), REHARM_EPOCH)).toBe(1);
    expect(localPuzzleNumber(NOW, REHARM_EPOCH)).toBe(3);
  });

  it("counts today's puzzle as unplayed when nothing is stored", () => {
    expect(status({})).toEqual({ kind: "ok", unplayed: 1, total: 1 });
  });

  it("uses today's native daily:v1 record", () => {
    expect(status({ "daily:v1:reharm": record({ status: "done" }) })).toMatchObject({ unplayed: 0 });
    expect(status({ "daily:v1:reharm": record({ status: "in_progress" }) })).toMatchObject({ unplayed: 1 });
    // today's native record wins over the history fallback
    expect(status({ "daily:v1:reharm": record({ status: "new" }), "reharm:v1:history": { 3: { puzzleNumber: 3, total: 80 } } })).toMatchObject({ unplayed: 1 });
  });

  it("falls back to reharm:v1:history (keyed by puzzle number) without a native record", () => {
    expect(status({ "reharm:v1:history": { 3: { puzzleNumber: 3, dateISO: TODAY, total: 80, badges: [] } } })).toMatchObject({ unplayed: 0 });
    // an entry whose map key differs still counts by its own puzzleNumber
    expect(status({ "reharm:v1:history": { x: { puzzleNumber: 3, total: 80 } } })).toMatchObject({ unplayed: 0 });
    // yesterday's solve doesn't count for today
    expect(status({ "reharm:v1:history": { 2: { puzzleNumber: 2, total: 80 } } })).toMatchObject({ unplayed: 1 });
  });

  it("treats a stale native record as not played today, then checks history", () => {
    const stale = record({ dateKey: "2026-11-26", status: "done" });
    expect(status({ "daily:v1:reharm": stale })).toMatchObject({ unplayed: 1 });
    expect(status({ "daily:v1:reharm": stale, "reharm:v1:history": { 3: { puzzleNumber: 3, total: 70 } } })).toMatchObject({ unplayed: 0 });
  });

  it("rolls over at local midnight", () => {
    const data = { "daily:v1:reharm": record({ status: "done" }) };
    expect(status(data, new Date(2026, 10, 27, 23, 59))).toMatchObject({ unplayed: 0 });
    expect(status(data, new Date(2026, 10, 28, 0, 0))).toMatchObject({ unplayed: 1 });
  });

  it("survives corrupt JSON in either key", () => {
    expect(status({ "daily:v1:reharm": "{not json" })).toEqual({ kind: "ok", unplayed: 1, total: 1 });
    expect(status({ "daily:v1:reharm": "{not json", "reharm:v1:history": "[[[" })).toMatchObject({ unplayed: 1 });
    expect(status({ "daily:v1:reharm": "{not json", "reharm:v1:history": { 3: { puzzleNumber: 3 } } })).toMatchObject({ unplayed: 0 });
    // well-formed JSON of the wrong shape
    expect(status({ "daily:v1:reharm": { v: 2, dateKey: TODAY, status: "done" }, "reharm:v1:history": [3] })).toMatchObject({ unplayed: 1 });
    expect(status({ "daily:v1:reharm": "null", "reharm:v1:history": "42" })).toMatchObject({ unplayed: 1 });
  });

  it("reports blocked storage instead of a count", () => {
    const thrower = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    expect(readDailyStatus(thrower, NOW)).toEqual({ kind: "blocked" });
    expect(readDailyStatus(() => ({ getItem: thrower }), NOW)).toEqual({ kind: "blocked" });
    expect(readDailyStatus(() => null, NOW)).toEqual({ kind: "blocked" });
  });

  it("only ever reads the daily and REHARM keys", () => {
    const { store, reads } = fake({});
    readDailyStatus(() => store, NOW);
    expect(reads.every((k) => k.startsWith("daily:v1:") || k.startsWith("reharm:v1:"))).toBe(true);
    // the fake has no setItem: a write would have thrown, which the reader would report as blocked
    expect(readDailyStatus(() => store, NOW).kind).toBe("ok");
  });

  it("labels each state for screen readers", () => {
    expect(dailyLabel({ kind: "blocked" })).toMatch(/Reharm Daily/);
    expect(dailyLabel({ kind: "ok", unplayed: 1, total: 1 })).toBe("Reharm Daily: 1 puzzle left today");
    expect(dailyLabel({ kind: "ok", unplayed: 0, total: 1 })).toMatch(/all of today's puzzles done/);
  });
});
