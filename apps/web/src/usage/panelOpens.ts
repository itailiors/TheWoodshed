/**
 * How often each folded panel and drawer gets opened, kept in this browser only. Nothing is
 * sent anywhere (the demo makes zero /api requests). It answers one design question: which
 * panels earn a place on first load. Settings ⚙ shows the tally.
 */
const STORE = "reharm.panelOpens";

export interface PanelOpen {
  opens: number;
  /** ms since the epoch */
  lastAt: number;
}

export const PANEL_LABEL: Record<string, string> = {
  "study.why": "Study · Why it works",
  "study.chordByChord": "Study · Edit chord by chord",
  "study.solo": "Study · Solo over it",
  "study.rejected": "Study · Considered & rejected",
  "transport.band": "Study · Band",
  "coach.ribbon": "Coach · All keys",
  "coach.options": "Coach · Options",
  "coach.whenToUse": "Coach · When to use it",
  "drawer.setlist": "Setlist drawer",
  "drawer.progress": "Progress drawer",
  "drawer.xray": "Engine X-ray",
};

export function readPanelOpens(): Record<string, PanelOpen> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null") as Record<string, PanelOpen> | null;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function countOpen(name: string) {
  try {
    const all = readPanelOpens();
    const cur = all[name] ?? { opens: 0, lastAt: 0 };
    all[name] = { opens: cur.opens + 1, lastAt: Date.now() };
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    /* private mode: not counted */
  }
}

export function resetPanelOpens() {
  try {
    localStorage.removeItem(STORE);
  } catch {
    /* nothing to clear */
  }
}
