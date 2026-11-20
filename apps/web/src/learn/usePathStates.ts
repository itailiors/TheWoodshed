import { useEffect, useMemo, useState } from "react";
import { fetchProgress, onPracticeSaved, type Progress } from "../library/practice";
import { onLessonFlagsChanged, readLessonFlags } from "./lessonFlags";
import { pathStates, type PathStates } from "./pathStates";

/**
 * Concept states and Next up, from this browser's own runs (never the demo's sample: see
 * `ownProgressOnly`) and its lesson flags. Re-reads after a saved run and after any flag change.
 * `loading` is true until the first read of the history has come back.
 */
export function usePathStates(limit = 4): PathStates & { loading: boolean } {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState(readLessonFlags);
  const [tick, setTick] = useState(0);

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
    const offFlags = onLessonFlagsChanged(() => {
      if (live) setFlags(readLessonFlags());
    });
    return () => {
      live = false;
      offSaved();
      offFlags();
    };
  }, []);

  // due times move with the clock: recompute once a minute while mounted
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const result = useMemo(() => pathStates(progress, flags, new Date(), limit), [progress, flags, limit, tick]);
  return { ...result, loading };
}
