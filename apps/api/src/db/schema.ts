import type { Tune } from "@reharm/theory-core";
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * One row per tune. Searchable/listable fields are columns; the full Tune document
 * (harmony, melody, sections) lives in `data` as JSON, so the engine gets it back unchanged.
 */
export const tunes = sqliteTable(
  "tunes",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    composer: text("composer"),
    keyTonic: text("key_tonic").notNull(),
    keyMode: text("key_mode", { enum: ["major", "minor"] }).notNull(),
    meter: text("meter").notNull(), // "3/4"
    feel: text("feel").notNull(),
    tempo: integer("tempo").notNull(),
    bars: integer("bars").notNull(),
    /** Original iReal style string, e.g. "Medium Swing". */
    style: text("style"),
    source: text("source", { enum: ["ireal", "musicxml", "manual"] }).notNull(),
    data: text("data", { mode: "json" }).$type<Tune>().notNull(),
    importWarnings: text("import_warnings", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("tunes_title_idx").on(t.title)],
);

/** A named, ordered list of tunes (an imported iReal playlist becomes one). */
export const setlists = sqliteTable("setlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const setlistTunes = sqliteTable(
  "setlist_tunes",
  {
    setlistId: integer("setlist_id")
      .notNull()
      .references(() => setlists.id, { onDelete: "cascade" }),
    tuneId: text("tune_id")
      .notNull()
      .references(() => tunes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.setlistId, t.tuneId] })],
);

export type TuneRow = typeof tunes.$inferSelect;
