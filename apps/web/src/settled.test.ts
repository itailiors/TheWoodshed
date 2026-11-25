import { afterEach, describe, expect, it, vi } from "vitest";
import { INTENT_EVENTS, resetSettled, SETTLE_FALLBACK_MS, whenSettled } from "./settled";

/** A fake window: listeners, timers and idle callbacks run only when the test says so. */
function fakeWindow(readyState = "loading") {
  const listeners = new Map<string, Set<() => void>>();
  const timers: { at: number; fn: () => void }[] = [];
  const idles: (() => void)[] = [];
  let now = 0;
  const target = {
    document: { readyState },
    addEventListener: (t: string, fn: () => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(fn),
    removeEventListener: (t: string, fn: () => void) => void listeners.get(t)?.delete(fn),
    setTimeout: (fn: () => void, ms: number) => void timers.push({ at: now + ms, fn }),
    requestIdleCallback: (fn: () => void) => void idles.push(fn),
  };
  return {
    target,
    fire: (t: string) => [...(listeners.get(t) ?? [])].forEach((fn) => fn()),
    listening: (t: string) => (listeners.get(t)?.size ?? 0) > 0,
    advance(ms: number) {
      now += ms;
      for (const t of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    },
    idle: () => idles.splice(0).forEach((fn) => fn()),
  };
}

afterEach(() => resetSettled());

describe("whenSettled", () => {
  it("waits through the first paint, then runs on the visitor's first touch", () => {
    const w = fakeWindow();
    const fn = vi.fn();
    whenSettled(fn, w.target);
    w.idle();
    expect(fn).not.toHaveBeenCalled();
    w.fire("pointerdown");
    expect(fn).not.toHaveBeenCalled(); // yields to the event that woke it
    w.idle();
    expect(fn).toHaveBeenCalledTimes(1);
    for (const t of INTENT_EVENTS) expect(w.listening(t)).toBe(false);
  });

  it("runs anyway once a quiet page has sat idle after load", () => {
    const w = fakeWindow();
    const fn = vi.fn();
    whenSettled(fn, w.target);
    w.advance(SETTLE_FALLBACK_MS * 2);
    w.idle();
    expect(fn).not.toHaveBeenCalled(); // the clock starts at load
    w.fire("load");
    w.advance(SETTLE_FALLBACK_MS - 1);
    w.idle();
    expect(fn).not.toHaveBeenCalled();
    w.advance(1);
    w.idle(); // the fallback's idle wait
    w.idle(); // flush
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs every queued job once, and later jobs on the next idle moment", () => {
    const w = fakeWindow("complete");
    const a = vi.fn();
    const b = vi.fn(() => {
      throw new Error("one failed warm-up");
    });
    const c = vi.fn();
    whenSettled(a, w.target);
    whenSettled(b, w.target);
    w.fire("keydown");
    w.fire("scroll");
    w.idle();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    whenSettled(c, w.target);
    expect(c).not.toHaveBeenCalled();
    w.idle();
    expect(c).toHaveBeenCalledTimes(1);
    w.advance(SETTLE_FALLBACK_MS * 2);
    w.idle();
    expect(a).toHaveBeenCalledTimes(1);
  });
});
