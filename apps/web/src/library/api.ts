import { BUNDLED_TUNES, formBars, type Tune } from "@reharm/theory-core";
import { DEMO } from "../demo";
import { reportApiUnreachable } from "./apiStatus";

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

// ── the read-only demo: the bundled tunes stand in for the library (no API, no writes) ──
const DEMO_SETLIST = "Demo library";
const summary = (t: Tune): TuneSummary => ({
  id: t.id,
  title: t.title,
  composer: t.composer ?? null,
  key: t.key.tonic,
  meter: t.meter.join("/"),
  style: t.feel === "waltz" ? "Jazz Waltz" : t.feel === "swing" ? "Medium Swing" : t.feel,
  bars: formBars(t),
  source: t.rights?.kind === "original" ? "original" : t.rights?.kind === "public-domain" ? "public domain" : t.source.kind,
  warnings: t.melodyCoverage === "none" ? ["Chord changes only, so moves aren't melody-checked."] : [],
  setlists: [DEMO_SETLIST],
  updatedAt: 0,
});
function bundled(id: string): Tune {
  const t = BUNDLED_TUNES.find((x) => x.id === id);
  if (!t) throw new LibraryError(`“${id}” isn't in the demo library.`, 404);
  return t;
}

export const fetchTunes = () => (DEMO ? Promise.resolve(BUNDLED_TUNES.map(summary)) : call<TuneSummary[]>("/tunes"));
export const fetchSetlists = () =>
  DEMO ? Promise.resolve<Setlist[]>([{ id: 1, name: DEMO_SETLIST, tuneIds: BUNDLED_TUNES.map((t) => t.id) }]) : call<Setlist[]>("/setlists");
export const fetchTune = (id: string) => (DEMO ? Promise.resolve().then(() => bundled(id)) : call<Tune>(`/tunes/${encodeURIComponent(id)}`));
export const deleteTune = (id: string) => call<{ ok: true }>(`/tunes/${encodeURIComponent(id)}`, { method: "DELETE" });
export const importIReal = (url: string) =>
  call<ImportResult>("/import/ireal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
