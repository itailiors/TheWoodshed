import { useEffect, useMemo, useState } from "react";
import { fetchProgress, onPracticeSaved, type Progress } from "../library/practice";
import { onLessonFlagsChanged, readLessonFlags, type LessonFlags } from "./lessonFlags";
import { ownProgressOnly, pathStates, type OwnProgress, type PathStates } from "./pathStates";

/**
 * This browser's own practice history (never the demo's sample: see `ownProgressOnly`), re-read
 * after every saved run. `loading` is true until the first read has come back. Light: no states,
 * no clock (Study reads it for the explanation depth).
 */
export function useOwnProgress(): { own: OwnProgress; progress: Progress | null; loading: boolean } {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true; // StrictMode runs this twice; only the live run may set state
    const load = () =>
      void fetchProgress()
        .catch(() => null)
        .then((p) => {
          if (!live) return;
          setProgress(p);
          setLoading(false);
        });
    load();
    const offSaved = onPracticeSaved(load);
    return () => {
      live = false;
      offSaved();
    };
  }, []);

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
