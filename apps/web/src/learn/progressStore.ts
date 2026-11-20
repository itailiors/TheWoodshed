import { fetchProgress, onPracticeSaved, type Progress } from "../library/practice";

/*
 * One copy of the practice passport for the whole page: App, Coach's path states and the
 * passport all read it, so opening the Coach is one `/api/practice/progress` read, not one per
 * hook, and a saved run is one re-read for everyone. Read it through `useOwnProgress`
 * (useSyncExternalStore), never by fetching again.
 */

export interface ProgressSnapshot {
  /** The passport as the adapter gave it (may be the demo's sample, marked `sample`); null when it couldn't be read. */
  progress: Progress | null;
  /** True until the first read has come back. */
  loading: boolean;
}

let snapshot: ProgressSnapshot = { progress: null, loading: true };
let loadSeq = 0;
let inflight = false;
// nothing read yet, or a run was saved while nobody was listening
let stale = true;
const subscribers = new Set<() => void>();
let offSaved: (() => void) | null = null;

function load() {
  stale = false;
  inflight = true;
  const seq = ++loadSeq;
  void fetchProgress()
    .catch(() => null)
    .then((progress) => {
      // a later read (a save landed meanwhile) wins over an earlier one that comes back last
      if (seq !== loadSeq) return;
      inflight = false;
      snapshot = { progress, loading: false };
      subscribers.forEach((fn) => fn());
    });
}

/** Re-read the passport now (opening the passport: anything may have changed while it was closed). */
export function refreshProgress() {
  load();
}

/** For useSyncExternalStore: the first subscriber triggers the one read; a saved run re-reads once. */
export function subscribeProgress(fn: () => void): () => void {
  subscribers.add(fn);
  offSaved ??= onPracticeSaved(() => {
    if (subscribers.size) load();
    else stale = true;
  });
  if (stale && !inflight) load();
  return () => {
    subscribers.delete(fn);
  };
}

export const progressSnapshot = (): ProgressSnapshot => snapshot;
