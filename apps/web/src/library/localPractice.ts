import {
  applyCoachRun,
  normaliseKey,
  type CoachAttemptRecord,
  type CoachRunInput,
  type ConceptReview,
  type AnswerRecord,
  type EarMotionId,
  type ImprovRunRecord,
  type LevelId,
  type Stage,
} from "@reharm/theory-core";

/*
 * Practice history kept in this browser, for the static demo (which has no API). The Coach's
 * runs and the heatmap's passes are stored in IndexedDB and graded, scheduled and summarised
 * by the same theory-core functions the API uses, so the passport behaves the same either way.
 *
 * If the browser refuses storage (some private windows, blocked site data), it falls back to
 * memory: practice still works and stamps, but only until the tab closes.
 */

const DB_NAME = "reharm-practice";
/** v2 adds the Changes game's sessions (an additive upgrade: v1's stores are untouched). */
const DB_VERSION = 2;
const REVIEWS = "reviews"; // key: [ruleId, keyTonic]
const ATTEMPTS = "coachAttempts"; // auto-increment
const IMPROV = "improvRuns"; // auto-increment
const CHANGES = "changesSessions"; // key: id (auto-increment)

export type ImprovRunData = Omit<ImprovRunRecord, "id" | "createdAt">;

/**
 * One session of Make the Changes, as played. Kept in this browser in every build (the API has
 * no tables for it), it's what mastery, the "next up" level and the stats are worked out from.
 * Its Open answers also go to the spaced-repetition scheduler, as `ear:<motion>` concepts.
 */
export interface ChangesSessionRecord {
  id?: number;
  level: LevelId;
  /** The stage it ended at (it may have moved up along the way). */
  stage: Stage;
  startedAt: Date;
  endedAt: Date;
  points: number;
  bestStreak: number;
  roundsPlayed: number;
  totalRounds: number;
  /** Every answer, in order (mastery reads the Open ones). */
  answers: AnswerRecord[];
  stamped: { motion: EarMotionId; key: string }[];
  discoveries: { move: string; symbol: string }[];
}

export interface Backend {
  readonly persistent: boolean;
  recordCoachRun(run: CoachRunInput & { tuneId: string | null; moveId: string }, now: Date): Promise<ReturnType<typeof applyCoachRun>>;
  recordImprovRun(run: ImprovRunData, now: Date): Promise<void>;
  readAll(): Promise<{ reviews: ConceptReview[]; attempts: CoachAttemptRecord[]; improv: ImprovRunRecord[] }>;
  recordChangesSession(rec: ChangesSessionRecord): Promise<void>;
  readChangesSessions(): Promise<ChangesSessionRecord[]>;
  clear(): Promise<void>;
}

// ── in memory (fallback, and the shape the IndexedDB store mirrors) ──

export function memoryBackend(): Backend {
  const reviews = new Map<string, ConceptReview>();
  const attempts: CoachAttemptRecord[] = [];
  const improv: ImprovRunRecord[] = [];
  const changes: ChangesSessionRecord[] = [];
  return {
    persistent: false,
    async recordChangesSession(rec) {
      changes.push({ ...rec, id: changes.length + 1 });
    },
    async readChangesSessions() {
      return [...changes];
    },
    async recordCoachRun(run, now) {
      const id = `${run.ruleId}|${normaliseKey(run.keyTonic)}`;
      const result = applyCoachRun(reviews.get(id) ?? null, run, now);
      reviews.set(id, result.review);
      attempts.push(attemptRecord(run, result.clean, now));
      return result;
    },
    async recordImprovRun(run, now) {
      improv.push({ ...run, id: improv.length + 1, createdAt: now });
    },
    async readAll() {
      return { reviews: [...reviews.values()], attempts: [...attempts], improv: [...improv] };
    },
    async clear() {
      reviews.clear();
      attempts.length = 0;
      improv.length = 0;
      changes.length = 0;
    },
  };
}

const attemptRecord = (run: CoachRunInput & { tuneId: string | null; moveId: string }, clean: boolean, now: Date): CoachAttemptRecord => ({
  ruleId: run.ruleId,
  keyTonic: normaliseKey(run.keyTonic),
  misses: run.misses,
  leaps: run.leaps,
  tuneId: run.tuneId,
  moveId: run.moveId,
  clean,
  createdAt: now,
});

// ── IndexedDB ──

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REVIEWS)) db.createObjectStore(REVIEWS, { keyPath: ["ruleId", "keyTonic"] });
      if (!db.objectStoreNames.contains(ATTEMPTS)) db.createObjectStore(ATTEMPTS, { autoIncrement: true });
      if (!db.objectStoreNames.contains(IMPROV)) db.createObjectStore(IMPROV, { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains(CHANGES)) db.createObjectStore(CHANGES, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      // a newer build opening in another tab asks for an upgrade: step aside rather than block it
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

function indexedDbBackend(db: IDBDatabase): Backend {
  return {
    persistent: true,
    async recordCoachRun(run, now) {
      // read-modify-write of the review and the attempt in one transaction, so two tabs can't interleave
      const tx = db.transaction([REVIEWS, ATTEMPTS], "readwrite");
      const reviews = tx.objectStore(REVIEWS);
      const prev = ((await done(reviews.get([run.ruleId, normaliseKey(run.keyTonic)]))) as ConceptReview | undefined) ?? null;
      const result = applyCoachRun(prev, run, now);
      reviews.put(result.review);
      tx.objectStore(ATTEMPTS).add(attemptRecord(run, result.clean, now));
      await finished(tx);
      return result;
    },
    async recordImprovRun(run, now) {
      const tx = db.transaction(IMPROV, "readwrite");
      tx.objectStore(IMPROV).add({ ...run, createdAt: now });
      await finished(tx);
    },
    async readAll() {
      const tx = db.transaction([REVIEWS, ATTEMPTS, IMPROV], "readonly");
      const [reviews, attempts, improv] = await Promise.all([
        done(tx.objectStore(REVIEWS).getAll()),
        done(tx.objectStore(ATTEMPTS).getAll()),
        done(tx.objectStore(IMPROV).getAll()),
      ]);
      return { reviews: reviews as ConceptReview[], attempts: attempts as CoachAttemptRecord[], improv: improv as ImprovRunRecord[] };
    },
    async recordChangesSession(rec) {
      const tx = db.transaction(CHANGES, "readwrite");
      const { id: _drop, ...row } = rec;
      void _drop;
      tx.objectStore(CHANGES).add(row);
      await finished(tx);
    },
    async readChangesSessions() {
      const tx = db.transaction(CHANGES, "readonly");
      return (await done(tx.objectStore(CHANGES).getAll())) as ChangesSessionRecord[];
    },
    async clear() {
      const stores = [REVIEWS, ATTEMPTS, IMPROV, CHANGES];
      const tx = db.transaction(stores, "readwrite");
      for (const s of stores) tx.objectStore(s).clear();
      await finished(tx);
    },
  };
}

let backend: Promise<Backend> | null = null;

/** The store: IndexedDB when the browser allows it, memory otherwise. Opened on first use. */
export function localStore(): Promise<Backend> {
  backend ??= (async () => {
    try {
      if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
      return indexedDbBackend(await openDb());
    } catch (err) {
      if (import.meta.env.DEV) console.debug("[practice] browser storage unavailable, keeping runs in memory:", err);
      return memoryBackend();
    }
  })();
  return backend;
}
