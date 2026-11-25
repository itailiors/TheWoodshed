/*
 * "Warm up once the visitor is here, not while the page is still drawing itself."
 *
 * Background prefetching (the audio engine and its samples, the lazy screens) costs a few
 * hundred ms of main-thread work. Run during the first paint, that lands on a phone as a
 * frozen page right when someone first tries to scroll or tap. So it waits for the first sign
 * of a person (a pointer, a key, a touch, a scroll, focus) or, failing that, for the page to
 * have sat idle for a while after `load`. Either way it still runs well before most first
 * Play presses, and the pointerdown of that press itself is a sign of a person.
 */

/** Events that mean someone is using the page. Listened for once, passively, in the capture phase. */
export const INTENT_EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll", "focusin"] as const;

/** With no sign of a person, how long after `load` to warm up anyway. */
export const SETTLE_FALLBACK_MS = 4000;

interface SettleTarget {
  addEventListener(type: string, fn: () => void, opts?: AddEventListenerOptions | boolean): void;
  removeEventListener(type: string, fn: () => void, opts?: EventListenerOptions | boolean): void;
  setTimeout(fn: () => void, ms: number): unknown;
  requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => unknown;
  document?: { readyState: string };
}

const queue: (() => void)[] = [];
let settled = false;
let armed = false;

function flush() {
  if (settled) return;
  settled = true;
  for (const fn of queue.splice(0)) {
    try {
      fn();
    } catch {
      /* one failed warm-up must not stop the others */
    }
  }
}

/**
 * Run `fn` once the page has settled (see above). Every caller shares one trigger; after it
 * has fired, `fn` runs on the next idle moment instead.
 */
export function whenSettled(fn: () => void, target: SettleTarget | undefined = typeof window === "undefined" ? undefined : (window as unknown as SettleTarget)) {
  if (!target) return;
  const idle = (cb: () => void, timeout: number) =>
    target.requestIdleCallback ? target.requestIdleCallback(cb, { timeout }) : target.setTimeout(cb, 50);
  if (settled) {
    idle(fn, 1000);
    return;
  }
  queue.push(fn);
  if (armed) return;
  armed = true;

  const opts = { capture: true, passive: true } as const;
  const go = () => {
    for (const t of INTENT_EVENTS) target.removeEventListener(t, go, opts);
    // still yield to the event that woke us: the tap itself stays snappy
    idle(flush, 300);
  };
  for (const t of INTENT_EVENTS) target.addEventListener(t, go, opts);

  const fallback = () => target.setTimeout(() => idle(go, 2000), SETTLE_FALLBACK_MS);
  if (!target.document || target.document.readyState === "complete") fallback();
  else target.addEventListener("load", fallback, { once: true });
}

/** Test hook: forget that the page settled. */
export function resetSettled() {
  queue.length = 0;
  settled = false;
  armed = false;
}
