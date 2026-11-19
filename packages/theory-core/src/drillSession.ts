import { seededRandom } from "./band";
import { diffStrike, diffVoiceLeading, type DrillStep, type StrikeDiff, type VoiceLeadingDiff } from "./coach";
import { chroma, mod } from "./pitch";
import { shapeRuleId } from "./concepts";
import type { DrillKeyWhy } from "./srs";
import { KEYS, randomKey } from "./transpose";
import type { ChordLike } from "./voicing";
import { gradeShape, type ShapeGrade, type VoicingForm } from "./voicingForms";

/*
 * A drill session, clock-free and pure: the strike → grade → file once → advance machine that the
 * Coach and the Voicings tab share. A session walks a list of runs (a Coach move is one run of
 * several chords; a Voicings ii–V–I is three one-chord runs) and decides the next key from its key
 * plan. It never waits or saves itself: it returns effects (`file`, `wait`, `setKey`) for the
 * caller to carry out, and a `wait` comes back as `elapsed(token)`, a no-op once stale.
 * Terms are from GLOSSARY.md.
 */

/** One run's targets: a reharm move graded by `diffStrike` + `diffVoiceLeading`, or one voicing shape graded by `gradeShape`. */
export type DrillRun =
  | { kind: "move"; steps: readonly DrillStep[]; tuneId: string; moveId: string; ruleId: string }
  | { kind: "shape"; form: VoicingForm; chord: ChordLike };

/** One strike at one target chord (or the player's own verdict on it). `chord` indexes the run's chords. */
export type DrillAttempt =
  | { chord: number; pass: boolean; by: "engine"; kind: "move"; diff: StrikeDiff; vl: VoiceLeadingDiff | null }
  | { chord: number; pass: boolean; by: "engine"; kind: "shape"; played: number[]; grade: ShapeGrade }
  | { chord: number; pass: boolean; by: "self" };

/** What gets filed in the practice history, once per run. */
export type DrillRecord =
  | { kind: "move"; tuneId: string; moveId: string; ruleId: string; keyTonic: string; misses: number; leaps: number; maxLeap: number; gradedBy: "engine" | "self" }
  | { kind: "shape"; ruleId: string; keyTonic: string; misses: number };

/** Hold the key, go up in fourths or fifths, or pick a random key (transfer). Moves on only after a clean run. */
export type DrillKeyFlow = "hold" | "fourths" | "fifths" | "random";
export interface DrillLapKey {
  key: string;
  why: DrillKeyWhy;
}
/** A key flow, or the 12-key drill (a lap in `drillKeyOrder` order). */
export type KeyPlan = { kind: "flow"; flow: DrillKeyFlow } | { kind: "lap"; keys: readonly DrillLapKey[] };

export type DrillEvent =
  /** A completed strike (tap-in pending notes stay in the page). */
  | { type: "strike"; notes: readonly number[] }
  /** Self-check: the player's verdict on the current chord. */
  | { type: "self"; pass: boolean }
  | { type: "restart" }
  | { type: "goToRun"; index: number }
  /** Ends a 12-key lap. */
  | { type: "stop" }
  /** The key changed; by hand, it ends a 12-key lap. */
  | { type: "changeKey"; key: string; byHand: boolean }
  /** New targets (a new key, form or source): starts again from the first run. */
  | { type: "runs"; runs: readonly DrillRun[]; key: string }
  /** A new key plan. Starting a lap moves to its first key. */
  | { type: "plan"; plan: KeyPlan }
  | { type: "elapsed"; token: number };

export type DrillEffect =
  | { type: "file"; record: DrillRecord }
  /** Call back with `elapsed(token)` after the page's delay. */
  | { type: "wait"; token: number; label: "key" | "lap" | "run" }
  | { type: "setKey"; key: string };

interface Lap {
  keys: readonly DrillLapKey[];
  /** Index of the key being played; `keys.length` once the lap is done. */
  at: number;
  /** Keys finished so far: true when clean. */
  done: Readonly<Record<string, boolean>>;
}

/** The session. Treat it as opaque: read it through `drillView`, change it through `drillStep`. */
export interface DrillSession {
  readonly runs: readonly DrillRun[];
  readonly key: string;
  readonly flow: DrillKeyFlow;
  readonly lap: Lap | null;
  readonly seed: string | number;
  /** Random keys drawn so far (each draw is seeded by `seed` and this count). */
  readonly draws: number;
  readonly run: number;
  readonly chord: number;
  readonly attempts: readonly DrillAttempt[];
  readonly filed: boolean;
  readonly nextKey: string | null;
  readonly pending: { token: number; label: "key" | "lap" | "run" } | null;
  readonly tokens: number;
  /** Bumped whenever the run starts over, so a caller can tell a late save result is for an old run. */
  readonly epoch: number;
}

export function startDrillSession(runs: readonly DrillRun[], keyTonic: string, plan: KeyPlan, seed: string | number): DrillSession {
  return {
    runs,
    key: keyTonic,
    flow: plan.kind === "flow" ? plan.flow : "hold",
    lap: plan.kind === "lap" ? { keys: plan.keys, at: 0, done: {} } : null,
    seed,
    draws: 0,
    run: 0,
    chord: 0,
    attempts: [],
    filed: false,
    nextKey: null,
    pending: null,
    tokens: 0,
    epoch: 0,
  };
}

const chordCount = (r: DrillRun | undefined) => (!r ? 0 : r.kind === "move" ? r.steps.length : 1);
/** A key name the practice history can file under: a letter and at most one accidental. */
const plainKey = (k: string) => /^[A-G][b#]?$/.test(k);

/** The current run, started over: no attempts, nothing filed, no wait pending. */
const fresh = (s: DrillSession, run = s.run): DrillSession => ({ ...s, run, chord: 0, attempts: [], filed: false, nextKey: null, pending: null, epoch: s.epoch + 1 });

function tally(attempts: readonly DrillAttempt[]) {
  const winning = attempts.filter((a) => a.pass);
  const vls = winning.map((a) => (a.by === "engine" && a.kind === "move" ? a.vl : null));
  return {
    misses: attempts.length - winning.length,
    leaps: vls.filter((vl) => vl && !vl.smooth).length,
    maxLeap: Math.max(0, ...vls.map((vl) => vl?.maxLeap ?? 0)),
  };
}

export function drillView(s: DrillSession) {
  const run = s.runs[s.run];
  const { misses, leaps, maxLeap } = tally(s.attempts);
  const finished = s.chord >= chordCount(run);
  const lastAttempt = s.attempts.length ? s.attempts[s.attempts.length - 1] : null;
  return {
    /** Run cursor, and chord cursor within the run. */
    run: s.run,
    chord: s.chord,
    key: s.key,
    attempts: s.attempts,
    lastAttempt,
    misses,
    leaps,
    maxLeap,
    finished,
    clean: finished && misses === 0 && leaps === 0,
    filed: s.filed,
    /** The key the plan moves to after this run (decided when it finished clean), or null. */
    nextKey: s.nextKey,
    lap: s.lap && { ...s.lap, finished: s.lap.at >= s.lap.keys.length },
    epoch: s.epoch,
  };
}
export type DrillView = ReturnType<typeof drillView>;

type Step = { session: DrillSession; effects: DrillEffect[] };
const none = (session: DrillSession): Step => ({ session, effects: [] });

function wait(s: DrillSession, label: "key" | "lap" | "run"): Step {
  const token = s.tokens + 1;
  return { session: { ...s, tokens: token, pending: { token, label } }, effects: [{ type: "wait", token, label }] };
}

/** The key flow's next key from `key`, drawing a seeded random one for transfer. */
function flowKey(s: DrillSession): { key: string; draws: number } {
  const k = chroma(s.key);
  if (s.flow === "fourths") return { key: KEYS[mod(k + 5, 12)], draws: s.draws };
  if (s.flow === "fifths") return { key: KEYS[mod(k + 7, 12)], draws: s.draws };
  return { key: randomKey(s.key, seededRandom(`${s.seed}:${s.draws}`)), draws: s.draws + 1 };
}

/** After a run is filed: the plan's wait, if it moves on. */
function afterFiling(s: DrillSession, keyTonic: string, clean: boolean): Step {
  const lap = s.lap;
  if (lap) {
    if (lap.at < lap.keys.length && chroma(lap.keys[lap.at].key) === chroma(keyTonic)) {
      return wait({ ...s, lap: { ...lap, done: { ...lap.done, [lap.keys[lap.at].key]: clean } } }, "lap");
    }
    return none(s);
  }
  if (!clean || s.flow === "hold") return none(s);
  const { key, draws } = flowKey(s);
  return wait({ ...s, nextKey: key, draws }, "key");
}

function strikeMove(s: DrillSession, run: Extract<DrillRun, { kind: "move" }>, notes: readonly number[]): Step {
  if (s.chord >= run.steps.length) return none(s);
  const step = run.steps[s.chord];
  const diff = diffStrike([...notes], step);
  const prevWin = [...s.attempts].reverse().find((a) => a.chord === s.chord - 1 && a.pass);
  const vl = prevWin?.by === "engine" && prevWin.kind === "move" ? diffVoiceLeading(prevWin.diff.played, [...notes], run.steps[s.chord - 1], step) : null;
  const pass = diff.verdict === "perfect" || diff.verdict === "correct";
  return advanceMove({ ...s, attempts: [...s.attempts, { chord: s.chord, pass, by: "engine", kind: "move", diff, vl }] }, run, pass);
}

function advanceMove(s: DrillSession, run: Extract<DrillRun, { kind: "move" }>, pass: boolean): Step {
  if (!pass) return none(s);
  const next = { ...s, chord: s.chord + 1 };
  if (next.chord < run.steps.length) return none(next);
  const { misses, leaps, maxLeap } = tally(next.attempts);
  const gradedBy = next.attempts.some((a) => a.by === "self") ? "self" : "engine";
  const record: DrillRecord = { kind: "move", tuneId: run.tuneId, moveId: run.moveId, ruleId: run.ruleId, keyTonic: s.key, misses, leaps, maxLeap, gradedBy };
  const after = afterFiling({ ...next, filed: true }, s.key, misses === 0 && leaps === 0);
  return { session: after.session, effects: [{ type: "file", record }, ...after.effects] };
}

function strikeShape(s: DrillSession, run: Extract<DrillRun, { kind: "shape" }>, notes: readonly number[]): Step {
  const played = [...notes];
  const grade = gradeShape(played, run.form, run.chord);
  const pass = grade.valid;
  let next: DrillSession = { ...s, attempts: [...s.attempts, { chord: 0, pass, by: "engine", kind: "shape", played, grade }] };
  if (!pass) return none(next);
  next = { ...next, chord: 1 };
  const effects: DrillEffect[] = [];
  let planWaits = false;
  if (!next.filed && plainKey(run.chord.root)) {
    // filed under the family actually shown (a fallback form is close, and says so)
    const { misses } = tally(next.attempts);
    effects.push({ type: "file", record: { kind: "shape", ruleId: shapeRuleId(run.form.style, run.chord.quality, run.chord.alterations), keyTonic: run.chord.root, misses } });
    const after = afterFiling({ ...next, filed: true }, run.chord.root, misses === 0);
    next = after.session;
    effects.push(...after.effects);
    planWaits = after.effects.length > 0;
  }
  // in a run list (a ii–V–I), a clean chord moves on to the next one
  if (!planWaits && s.run < s.runs.length - 1) {
    const w = wait(next, "run");
    next = w.session;
    effects.push(...w.effects);
  }
  return { session: next, effects };
}

export function drillStep(s: DrillSession, e: DrillEvent): Step {
  const run = s.runs[s.run];
  switch (e.type) {
    case "strike":
      if (!run) return none(s);
      return run.kind === "move" ? strikeMove(s, run, e.notes) : strikeShape(s, run, e.notes);
    case "self":
      if (run?.kind !== "move" || s.chord >= run.steps.length) return none(s);
      return advanceMove({ ...s, attempts: [...s.attempts, { chord: s.chord, pass: e.pass, by: "self" }] }, run, e.pass);
    case "restart":
      return none(fresh(s));
    case "goToRun":
      return none(fresh(s, Math.max(0, Math.min(s.runs.length - 1, e.index))));
    case "stop":
      return none({ ...s, lap: null, pending: s.pending?.label === "lap" ? null : s.pending });
    case "changeKey":
      return none({ ...s, key: e.key, lap: e.byHand ? null : s.lap, pending: null, nextKey: null });
    case "runs":
      return none(fresh({ ...s, runs: e.runs, key: e.key }, 0));
    case "plan": {
      if (e.plan.kind === "lap") {
        const first = e.plan.keys[0].key;
        return { session: fresh({ ...s, flow: "hold", lap: { keys: e.plan.keys, at: 0, done: {} }, key: first }), effects: [{ type: "setKey", key: first }] };
      }
      const same = !s.lap && s.flow === e.plan.flow;
      if (same) return none(s);
      const next: DrillSession = { ...s, flow: e.plan.flow, lap: null, nextKey: null, pending: null };
      // a run already finished clean takes the new flow straight away
      const v = drillView(next);
      return v.finished && v.clean && s.filed && run?.kind === "move" ? afterFiling(next, s.key, true) : none(next);
    }
    case "elapsed": {
      if (!s.pending || s.pending.token !== e.token) return none(s);
      const done = { ...s, pending: null };
      if (s.pending.label === "run") return none(fresh(done, Math.min(s.run + 1, s.runs.length - 1)));
      if (s.pending.label === "key") {
        const key = s.nextKey ?? s.key;
        return { session: { ...done, key }, effects: [{ type: "setKey", key }] };
      }
      const lap = s.lap!;
      const at = lap.at + 1;
      const nextLap = { ...lap, at };
      if (at >= lap.keys.length) return none({ ...done, lap: nextLap });
      const key = lap.keys[at].key;
      return { session: { ...done, lap: nextLap, key }, effects: [{ type: "setKey", key }] };
    }
  }
}
