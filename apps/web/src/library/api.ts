import { reportApiUnreachable } from "./apiStatus";
import type { Tune } from "@reharm/theory-core";

export interface TuneSummary {
  id: string;
  title: string;
  composer: string | null;
  key: string;
  meter: string;
  style: string | null;
  bars: number;
  source: string;
  warnings: string[];
  setlists: string[];
  updatedAt: number;
}

export interface Setlist {
  id: number;
  name: string;
  tuneIds: string[];
}

export interface ImportResult {
  playlist: string | null;
  imported: { id: string; title: string; bars: number; warnings: string[]; updated: boolean }[];
}

export class LibraryError extends Error {
  /** HTTP status, or 0 when the API couldn't be reached at all. */
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
  get unreachable() {
    return this.status === 0 || this.status === 502 || this.status === 504;
  }
}

const UNREACHABLE = "Can't reach the library API. Start it with npm run dev.";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    reportApiUnreachable();
    throw new LibraryError(UNREACHABLE);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // The Vite dev proxy answers 502/504 (with no JSON) when the API process is down.
    if (!body && res.status >= 500) reportApiUnreachable();
    throw new LibraryError(body?.error ?? (res.status >= 500 ? UNREACHABLE : `HTTP ${res.status}`), res.status);
  }
  return body as T;
}

export const fetchTunes = () => call<TuneSummary[]>("/tunes");
export const fetchSetlists = () => call<Setlist[]>("/setlists");
export const fetchTune = (id: string) => call<Tune>(`/tunes/${encodeURIComponent(id)}`);
export const deleteTune = (id: string) => call<{ ok: true }>(`/tunes/${encodeURIComponent(id)}`, { method: "DELETE" });
export const importIReal = (url: string) =>
  call<ImportResult>("/import/ireal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
