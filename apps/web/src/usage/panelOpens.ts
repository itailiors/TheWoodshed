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

/**
 * The learning counters (PLAN "Success criteria"), counted through `countOpen` like a panel and
 * shown in the same ⚙ tally. Read at each milestone: lessons finished unprompted, how often
 * "Continue anyway" beats a prerequisite note, whether "Why it works" gets opened more.
 */
export const LEARNING_LABEL = {
  "learn.step": "Learn · Steps taken",
  "learn.finish": "Learn · Lessons finished",
  "prereq.view": "Learn · Builds-on notes shown",
  "prereq.continueAnyway": "Learn · Continue anyway",
  "testout.pass": "Learn · Test-outs passed",
  "testout.undo": "Learn · Test-outs undone",
  "why.open": "Why it works opened",
} as const;
export type LearningCounter = keyof typeof LEARNING_LABEL;

/** Count one learning event (a typed `countOpen`). */
export const countLearning = (name: LearningCounter) => countOpen(name);

export const PANEL_LABEL: Record<string, string> = {
  // the Gate-0 baseline, still counted beside "why.open" so the two can be compared
  "study.why": "Study · Why it works (baseline)",
  "study.chordByChord": "Study · Edit chord by chord",
  "study.solo": "Study · Solo over it",
  "study.rejected": "Study · Considered & rejected",
  "transport.band": "Study · Band",
  "coach.ribbon": "Coach · All keys",
  "coach.options": "Coach · Options",
  "coach.whenToUse": "Coach · When to use it",
  "coach.allConcepts": "Coach · All concepts",
  "coach.pathSheet": "Coach · Your path (phone)",
  "passport.path": "Passport · Path",
  "drawer.setlist": "Setlist drawer",
  "drawer.progress": "Progress drawer",
  "drawer.xray": "Engine X-ray",
  ...LEARNING_LABEL,
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
