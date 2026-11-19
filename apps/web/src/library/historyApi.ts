import { reportApiUnreachable } from "./apiStatus";
import type { CoachRunResult, CoachRunWrite, DueItem, ImprovRunInput, PracticeHistory, Progress } from "./practice";

/*
 * Practice history on the server (`/api/practice`): the normal build's adapter. The server
 * grades and schedules; this side only opens sessions and files runs into them.
 *
 * Sessions open lazily (the first saved run of a kind on a chart opens one) and close when the
 * page goes away, through sendBeacon so the unload can't cancel them.
 */

export interface ApiHistoryDeps {
  /** A run couldn't be saved because the API isn't reachable. */
  onOffline: () => void;
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`/api/practice${path}`, init);
  } catch {
    reportApiUnreachable();
    return null;
  }
  if (!res.ok) {
    if (res.status >= 500) reportApiUnreachable();
    console.warn(`[practice] ${path}: HTTP ${res.status}`, await res.text().catch(() => ""));
    return null;
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export function apiHistory({ onOffline }: ApiHistoryDeps): PracticeHistory {
  const sessions = new Map<string, Promise<number | null>>();

  const sessionFor = (mode: "coach" | "improv", chart: string, tempo?: number): Promise<number | null> => {
    const k = `${mode}:${chart}`;
    let s = sessions.get(k);
    if (!s) {
      s = post<{ id: number }>("/sessions", { mode, tuneId: chart, tempo: tempo ? Math.round(tempo) : null }).then((r) => r?.id ?? null);
      sessions.set(k, s);
      // a failed open (API down) shouldn't stick: the next run tries again
      void s.then((id) => id === null && sessions.delete(k));
    }
    return s;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      for (const s of sessions.values()) void s.then((id) => id && navigator.sendBeacon(`/api/practice/sessions/${id}/end`));
      sessions.clear();
    });
  }

  return {
    async saveCoachRun(run: CoachRunWrite) {
      const sessionId = await sessionFor("coach", run.tuneId, run.tempo);
      if (!sessionId) return onOffline(), null;
      const res = await post<CoachRunResult>("/coach-attempts", {
        sessionId,
        tuneId: run.tuneId,
        moveId: run.moveId,
        ruleId: run.ruleId,
        keyTonic: run.keyTonic,
        misses: run.misses,
        leaps: run.leaps,
        maxLeap: Math.min(127, run.maxLeap),
        gradedBy: run.gradedBy ?? "engine",
      });
      if (!res) onOffline();
      return res;
    },

    async saveImprovRun(run: ImprovRunInput, tempo?: number) {
      const sessionId = await sessionFor("improv", run.tuneId, tempo);
      if (!sessionId) return onOffline(), false;
      const res = await post<{ id: number }>("/improv-runs", { ...run, sessionId });
      if (!res) onOffline();
      return !!res;
    },

    progress: (chart?: string) => call<Progress>(`/progress${chart ? `?tuneId=${encodeURIComponent(chart)}` : ""}`),

    due: () => call<DueItem[]>("/due"),
  };
}
