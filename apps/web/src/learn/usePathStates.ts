import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Progress } from "../library/practice";
import { onLessonFlagsChanged, readLessonFlags, type LessonFlags } from "./lessonFlags";
import { ownProgressOnly, pathStates, type OwnProgress, type PathStates } from "./pathStates";
import { progressSnapshot, subscribeProgress } from "./progressStore";

/**
 * This browser's own practice history (never the demo's sample: see `ownProgressOnly`), re-read
 * after every saved run. `loading` is true until the first read has come back. Light: no states,
 * no clock (Study reads it for the explanation depth).
 */
export function useOwnProgress(): { own: OwnProgress; progress: Progress | null; loading: boolean } {
  // one shared read for every caller (progressStore): App, Coach and the passport don't each fetch
  const { progress, loading } = useSyncExternalStore(subscribeProgress, progressSnapshot);
  const own = useMemo(() => ownProgressOnly(progress), [progress]);
  return { own, progress, loading };
}

/**
 * Concept states and Next up, from this browser's own runs and its lesson flags. Re-reads after
 * a saved run and after any flag change.
 */
export function usePathStates(limit = 4): PathStates & { own: OwnProgress; progress: Progress | null; flags: LessonFlags; loading: boolean } {
  const { own, progress, loading } = useOwnProgress();
  const [flags, setFlags] = useState(readLessonFlags);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    const off = onLessonFlagsChanged(() => {
      if (live) setFlags(readLessonFlags());
    });
    return () => {
      live = false;
      off();
    };
  }, []);

  // due times move with the clock: recompute once a minute while mounted
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => pathStates(progress, flags, new Date(), limit), [progress, flags, limit, tick]);
  // `progress` is the passport as shown (it may be the demo's sample, marked `sample`): for display only, never for states
  return { ...result, own, progress, flags, loading };
}
