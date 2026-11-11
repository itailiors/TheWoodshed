import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database } from "sql.js";
import * as schema from "./schema";

/**
 * SQLite via sql.js (WebAssembly): no native build, works the same on every OS.
 * The database lives in memory and is written to disk atomically after each change.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.join(here, "..", "..");
export const DB_FILE = process.env.REHARM_DB ?? path.join(API_ROOT, "data", "reharm.sqlite");
const MIGRATIONS = path.join(API_ROOT, "drizzle");

export type DB = SQLJsDatabase<typeof schema>;

let sqlite: Database;
let db: DB;

export async function openDb(file = DB_FILE): Promise<DB> {
  const SQL = await initSqlJs();
  sqlite = existsSync(file) ? new SQL.Database(readFileSync(file)) : new SQL.Database();
  sqlite.run("PRAGMA foreign_keys = ON;");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  persist(file);
  return db;
}

/** Write the in-memory database to disk (temp file + rename, so a crash never leaves half a file). */
export function persist(file = DB_FILE) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, Buffer.from(sqlite.export()));
  renameSync(tmp, file);
  // export() reopens the database, which resets pragmas
  sqlite.run("PRAGMA foreign_keys = ON;");
}

export function getDb(): DB {
  if (!db) throw new Error("Database not opened yet");
  return db;
}
