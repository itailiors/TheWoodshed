import { beforeEach, describe, expect, it, vi } from "vitest";

// the adapter, faked: count the reads, resolve them by hand, fire "saved" like a filed run does
const reads: { resolve: (p: unknown) => void }[] = [];
const savedListeners = new Set<() => void>();
vi.mock("../library/practice", () => ({
  fetchProgress: () => new Promise((resolve) => reads.push({ resolve })),
  onPracticeSaved: (fn: () => void) => {
    savedListeners.add(fn);
    return () => savedListeners.delete(fn);
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 0));
const passport = (n: number) => ({ concepts: [], cleanKeys: {}, n });

describe("one shared practice-progress read", () => {
  beforeEach(() => {
    reads.length = 0;
    savedListeners.clear();
    vi.resetModules();
  });

  it("any number of readers share one read, and a saved run re-reads once for all of them", async () => {
    const store = await import("./progressStore");
    const a = vi.fn();
    const b = vi.fn();
    store.subscribeProgress(a);
    store.subscribeProgress(b);
    store.subscribeProgress(() => {});
    expect(reads).toHaveLength(1);
    expect(store.progressSnapshot().loading).toBe(true);
    reads[0].resolve(passport(1));
    await flush();
    expect(store.progressSnapshot()).toEqual({ progress: passport(1), loading: false });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    savedListeners.forEach((l) => l());
    expect(reads).toHaveLength(2);
  });

  it("a later read wins over an earlier one that comes back last", async () => {
    const store = await import("./progressStore");
    store.subscribeProgress(() => {});
    savedListeners.forEach((l) => l());
    expect(reads).toHaveLength(2);
    reads[1].resolve(passport(2));
    await flush();
    reads[0].resolve(passport(1));
    await flush();
    expect(store.progressSnapshot().progress).toEqual(passport(2));
  });

  it("a failed read is null, not loading; the snapshot keeps its identity between changes", async () => {
    const store = await import("./progressStore");
    store.subscribeProgress(() => {});
    reads[0].resolve(null);
    await flush();
    const s = store.progressSnapshot();
    expect(s).toEqual({ progress: null, loading: false });
    expect(store.progressSnapshot()).toBe(s);
  });
});
