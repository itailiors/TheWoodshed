import type { Tune } from "@reharm/theory-core";
import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

// ── practice history ─────────────────────────────────────────────────────────

/** One sitting at the piano: a coach drill or an improv loop on one tune. */
export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tuneId: text("tune_id").references(() => tunes.id, { onDelete: "set null" }),
    mode: text("mode", { enum: ["coach", "improv"] }).notNull(),
    tempo: integer("tempo"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("practice_sessions_started_idx").on(t.startedAt)],
);

/**
 * One run through a move in the Comping Coach. A clean run (no misses, no leaps) in a key
 * is what the coach's "Clean in: B♭ · D · A♭" list is built from.
 */
export const coachAttempts = sqliteTable(
  "coach_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    tuneId: text("tune_id").references(() => tunes.id, { onDelete: "set null" }),
    /** Engine move id, e.g. "dominant.tritoneSub@4.1". */
    moveId: text("move_id").notNull(),
    /** The concept being practised, e.g. "dominant.tritoneSub". */
    ruleId: text("rule_id").notNull(),
    /** Key the run was played in (12-key transfer), normalised spelling: C, Db, D … B. */
    keyTonic: text("key_tonic").notNull(),
    clean: integer("clean", { mode: "boolean" }).notNull(),
    misses: integer("misses").notNull(),
    leaps: integer("leaps").notNull(),
    maxLeap: integer("max_leap").notNull(),
    /** 0–5 recall grade fed to the scheduler. */
    grade: integer("grade").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("coach_attempts_concept_idx").on(t.ruleId, t.keyTonic), index("coach_attempts_session_idx").on(t.sessionId)],
);

/** Summary of one pass of soloing over the loop (the heatmap's numbers). */
export const improvRuns = sqliteTable(
  "improv_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    tuneId: text("tune_id").references(() => tunes.id, { onDelete: "set null" }),
    level: integer("level").notNull(),
    view: text("view", { enum: ["reharm", "original"] }).notNull(),
    loopStartBar: integer("loop_start_bar").notNull(),
    loopEndBar: integer("loop_end_bar").notNull(),
    notes: integer("notes").notNull(),
    chordTonePct: integer("chord_tone_pct").notNull(),
    tensionPct: integer("tension_pct").notNull(),
    avoidPct: integer("avoid_pct").notNull(),
    outsidePct: integer("outside_pct").notNull(),
    strongBeatChordTonePct: integer("strong_beat_chord_tone_pct"),
    guideToneLandings: integer("guide_tone_landings").notNull(),
    heldAvoidNotes: integer("held_avoid_notes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("improv_runs_tune_idx").on(t.tuneId, t.createdAt)],
);

/**
 * Spaced-repetition state per concept per key ("tritone sub in D♭"), updated after every
 * coach attempt. `dueAt` drives the review queue.
 */
export const conceptReviews = sqliteTable(
  "concept_reviews",
  {
    ruleId: text("rule_id").notNull(),
    keyTonic: text("key_tonic").notNull(),
    reps: integer("reps").notNull().default(0),
    ease: real("ease").notNull().default(2.5),
    intervalDays: real("interval_days").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    cleanRuns: integer("clean_runs").notNull().default(0),
    lastGrade: integer("last_grade"),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.ruleId, t.keyTonic] }), index("concept_reviews_due_idx").on(t.dueAt)],
);

// relations, for Drizzle's typed relational queries
export const tunesRelations = relations(tunes, ({ many }) => ({
  sessions: many(practiceSessions),
  setlistEntries: many(setlistTunes),
}));
export const setlistsRelations = relations(setlists, ({ many }) => ({ entries: many(setlistTunes) }));
export const setlistTunesRelations = relations(setlistTunes, ({ one }) => ({
  setlist: one(setlists, { fields: [setlistTunes.setlistId], references: [setlists.id] }),
  tune: one(tunes, { fields: [setlistTunes.tuneId], references: [tunes.id] }),
}));
export const practiceSessionsRelations = relations(practiceSessions, ({ one, many }) => ({
  tune: one(tunes, { fields: [practiceSessions.tuneId], references: [tunes.id] }),
  coachAttempts: many(coachAttempts),
  improvRuns: many(improvRuns),
}));
export const coachAttemptsRelations = relations(coachAttempts, ({ one }) => ({
  session: one(practiceSessions, { fields: [coachAttempts.sessionId], references: [practiceSessions.id] }),
}));
export const improvRunsRelations = relations(improvRuns, ({ one }) => ({
  session: one(practiceSessions, { fields: [improvRuns.sessionId], references: [practiceSessions.id] }),
}));
