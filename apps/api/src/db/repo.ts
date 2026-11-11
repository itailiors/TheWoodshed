import { formBars, type Tune } from "@reharm/theory-core";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, persist } from "./client";
import { setlists, setlistTunes, tunes } from "./schema";

export interface TuneSummary {
  id: string;
  title: string;
  composer: string | null;
  key: string;
  meter: string;
  style: string | null;
  bars: number;
  source: string;
  warnings: string[];
  setlists: string[];
  updatedAt: number;
}

export const totalBars = (t: Tune) => formBars(t);

export function listTunes(): TuneSummary[] {
  const db = getDb();
  const rows = db
    .select({
      id: tunes.id,
      title: tunes.title,
      composer: tunes.composer,
      keyTonic: tunes.keyTonic,
      keyMode: tunes.keyMode,
      meter: tunes.meter,
      style: tunes.style,
      bars: tunes.bars,
      source: tunes.source,
      warnings: tunes.importWarnings,
      updatedAt: tunes.updatedAt,
    })
    .from(tunes)
    .orderBy(asc(sql`lower(${tunes.title})`))
    .all();
  const membership = db
    .select({ tuneId: setlistTunes.tuneId, name: setlists.name })
    .from(setlistTunes)
    .innerJoin(setlists, eq(setlists.id, setlistTunes.setlistId))
    .all();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    composer: r.composer,
    key: `${r.keyTonic}${r.keyMode === "minor" ? "m" : ""}`,
    meter: r.meter,
    style: r.style,
    bars: r.bars,
    source: r.source,
    warnings: r.warnings,
    setlists: membership.filter((m) => m.tuneId === r.id).map((m) => m.name),
    updatedAt: r.updatedAt.getTime(),
  }));
}

export function getTune(id: string): Tune | null {
  return getDb().select({ data: tunes.data }).from(tunes).where(eq(tunes.id, id)).get()?.data ?? null;
}

export function upsertTune(tune: Tune, opts: { style?: string | null; warnings?: string[] } = {}, save = true) {
  const values = {
    id: tune.id,
    title: tune.title,
    composer: tune.composer ?? null,
    keyTonic: tune.key.tonic,
    keyMode: tune.key.mode,
    meter: tune.meter.join("/"),
    feel: tune.feel,
    tempo: tune.tempo,
    bars: totalBars(tune),
    style: opts.style ?? null,
    source: tune.source.kind,
    data: tune,
    importWarnings: opts.warnings ?? [],
  };
  getDb()
    .insert(tunes)
    .values(values)
    .onConflictDoUpdate({ target: tunes.id, set: { ...values, updatedAt: new Date() } })
    .run();
  if (save) persist();
}

export function deleteTune(id: string): boolean {
  if (!tuneExists(id)) return false;
  getDb().delete(tunes).where(eq(tunes.id, id)).run(); // setlist entries cascade
  persist();
  return true;
}

/** Create or replace a setlist with the given tunes, in order. */
export function saveSetlist(name: string, tuneIds: string[], save = true) {
  const db = getDb();
  db.insert(setlists).values({ name }).onConflictDoNothing().run();
  const list = db.select({ id: setlists.id }).from(setlists).where(eq(setlists.name, name)).get()!;
  db.delete(setlistTunes).where(eq(setlistTunes.setlistId, list.id)).run();
  [...new Set(tuneIds)].forEach((tuneId, position) => db.insert(setlistTunes).values({ setlistId: list.id, tuneId, position }).run());
  if (save) persist();
}

export function listSetlists() {
  const db = getDb();
  const lists = db.select().from(setlists).orderBy(asc(setlists.name)).all();
  const members = db.select().from(setlistTunes).orderBy(asc(setlistTunes.position)).all();
  return lists.map((l) => ({ id: l.id, name: l.name, tuneIds: members.filter((m) => m.setlistId === l.id).map((m) => m.tuneId) }));
}

export function countTunes(): number {
  return getDb().select({ n: sql<number>`count(*)` }).from(tunes).get()?.n ?? 0;
}

export function tuneExists(id: string): boolean {
  return !!getDb().select({ id: tunes.id }).from(tunes).where(eq(tunes.id, id)).get();
}

/** Run several writes, then save once. */
export function batch<T>(fn: () => T): T {
  const out = fn();
  persist();
  return out;
}
