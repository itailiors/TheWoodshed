import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` with a `preload()` handle, so a chunk can be fetched while the browser is
 * idle (or on hover) and the component opens instantly when it's actually needed.
 */
export function lazyWithPreload<P extends object>(load: () => Promise<ComponentType<P>>) {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  const preload = () => {
    pending ??= load()
      .then((C) => ({ default: C }))
      .catch((err) => {
        pending = null; // a failed fetch (offline, redeploy) can be retried
        throw err;
      });
    return pending;
  };
  return Object.assign(lazy(preload), { preload });
}

/** Run once the main thread is free, so prefetching never competes with the first paint. */
export function whenIdle(fn: () => void, timeout = 3000) {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 1200);
}
