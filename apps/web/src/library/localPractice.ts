import {
  applyCoachRun,
  normaliseKey,
  summariseProgress,
  type CoachAttemptRecord,
  type CoachRunInput,
  type ConceptReview,
  type ImprovRunRecord,
  type ProgressSummary,
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
const DB_VERSION = 1;
const REVIEWS = "reviews"; // key: [ruleId, keyTonic]
const ATTEMPTS = "coachAttempts"; // auto-increment
const IMPROV = "improvRuns"; // auto-increment

export type ImprovRunData = Omit<ImprovRunRecord, "id" | "createdAt">;

interface Backend {
  readonly persistent: boolean;
  recordCoachRun(run: CoachRunInput & { tuneId: string | null; moveId: string }, now: Date): Promise<ReturnType<typeof applyCoachRun>>;
  recordImprovRun(run: ImprovRunData, now: Date): Promise<void>;
  readAll(): Promise<{ reviews: ConceptReview[]; attempts: CoachAttemptRecord[]; improv: ImprovRunRecord[] }>;
  clear(): Promise<void>;
}

// ── in memory (fallback, and the shape the IndexedDB store mirrors) ──

function memoryBackend(): Backend {
  const reviews = new Map<string, ConceptReview>();
  const attempts: CoachAttemptRecord[] = [];
  const improv: ImprovRunRecord[] = [];
  return {
    persistent: false,
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
    };
    req.onsuccess = () => resolve(req.result);
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
    async clear() {
      const tx = db.transaction([REVIEWS, ATTEMPTS, IMPROV], "readwrite");
      for (const s of [REVIEWS, ATTEMPTS, IMPROV]) tx.objectStore(s).clear();
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

/** The passport summary of everything saved in this browser, plus whether there's anything at all. */
export async function localProgress(tuneId?: string): Promise<{ summary: ProgressSummary; empty: boolean; persistent: boolean }> {
  const store = await localStore();
  const all = await store.readAll();
  return {
    summary: summariseProgress(all, new Date(), tuneId),
    empty: all.attempts.length === 0 && all.improv.length === 0,
    persistent: store.persistent,
  };
}
