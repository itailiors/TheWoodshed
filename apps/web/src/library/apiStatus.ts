import { useSyncExternalStore } from "react";
import { DEMO } from "../demo";

/**
 * Is the Reharm Lab API reachable, and does it have a Claude key? One shared poller of
 * GET /api/health, so the offline banner, Deep Dive and the library all agree.
 *
 *  - "checking": first ping in flight (render nothing alarming yet)
 *  - "online" / "offline": the API answered / didn't (or the browser is offline)
 *  - "demo": the static demo build has no API by design; never warn about it
 */
export type ApiState = "checking" | "online" | "offline" | "demo";

export interface ApiStatus {
  state: ApiState;
  /** Whether the API has an Anthropic key. Null until the API has answered once. */
  claudeKey: boolean | null;
  /** The browser itself reports no network (as opposed to just the API being down). */
  browserOffline: boolean;
}

const ONLINE_EVERY_MS = 60_000;
const OFFLINE_EVERY_MS = 10_000;
const TIMEOUT_MS = 3_000;

let status: ApiStatus = DEMO
  ? { state: "demo", claudeKey: null, browserOffline: false }
  : { state: "checking", claudeKey: null, browserOffline: typeof navigator !== "undefined" && navigator.onLine === false };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function set(next: Partial<ApiStatus>) {
  const merged = { ...status, ...next };
  if (merged.state === status.state && merged.claudeKey === status.claudeKey && merged.browserOffline === status.browserOffline) return;
  status = merged;
  listeners.forEach((l) => l());
}

/** Ping the API now (also what the banner's Retry button does). */
export async function checkApi(): Promise<ApiState> {
  if (DEMO) return "demo";
  if (timer) clearTimeout(timer);
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { anthropicKey?: string } | null;
    if (!res.ok || !body) throw new Error(`HTTP ${res.status}`);
    // "unused" = the API's own demo mode, which serves pre-written explanations: as good as a key.
    set({ state: "online", claudeKey: body.anthropicKey !== "missing", browserOffline: false });
  } catch {
    set({ state: "offline", browserOffline: navigator.onLine === false });
  }
  timer = setTimeout(checkApi, status.state === "online" ? ONLINE_EVERY_MS : OFFLINE_EVERY_MS);
  return status.state;
}

function start() {
  if (started || DEMO) return;
  started = true;
  void checkApi();
  window.addEventListener("online", () => void checkApi());
  window.addEventListener("offline", () => set({ state: "offline", browserOffline: true }));
  // Coming back to the tab after a while: re-check rather than trust a stale answer.
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void checkApi());
}

/** Report a failed API call from anywhere (a fetch that threw), so the banner shows at once. */
export function reportApiUnreachable() {
  if (!DEMO) void checkApi();
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useApiStatus(): ApiStatus {
  return useSyncExternalStore(subscribe, () => status);
}

/** For non-React code: run `fn` the next time the API comes (back) online. */
export function onceOnline(fn: () => void): () => void {
  start();
  if (status.state === "online") {
    fn();
    return () => {};
  }
  const l = () => {
    if (status.state !== "online") return;
    listeners.delete(l);
    fn();
  };
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
