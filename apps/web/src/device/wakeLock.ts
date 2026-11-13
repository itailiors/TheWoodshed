import { useEffect } from "react";

/*
 * Keep the screen awake while the player's hands are on the piano: a phone on the music stand
 * dims and locks after ~30 s untouched, mid-chorus. The Screen Wake Lock API is in every
 * current browser (Safari since 16.4). The browser drops the lock whenever the page is hidden,
 * so it's taken again when the page comes back. Without support, this quietly does nothing.
 */

type Sentinel = { released: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<Sentinel> };

const api = (): WakeLockApi | null => (typeof navigator !== "undefined" && "wakeLock" in navigator ? (navigator as unknown as { wakeLock: WakeLockApi }).wakeLock : null);

/** Hold a screen wake lock while `active` is true. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = api();
    if (!active || !wl) return;
    let lock: Sentinel | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      wl.request("screen").then(
        (l) => (live ? (lock = l) : void l.release().catch(() => {})),
        () => {}, // refused (low battery, no user gesture yet, iframe policy): not worth a word
      );
    };
    take();
    document.addEventListener("visibilitychange", take);
    // the first request can be refused before any gesture: try again on the next tap
    document.addEventListener("pointerdown", take);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", take);
      document.removeEventListener("pointerdown", take);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
