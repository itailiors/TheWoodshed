import { chipOf, judge, scoreStep, type AnswerRecord, type AnswerVerdict, type Stage } from "./judge";
import { earRuleId, LEVELS, type EarMotionId, type LevelId, type SpelledChord } from "./motions";
import { optionsFor, planSession, type DueItem, type Round, type Step } from "./rounds";

/*
 * Make the Changes as a pure state machine: the game's every rule in one reducer, so the React
 * side only renders state and turns time, sound and keys into events. No timers or audio here:
 * the UI dispatches PROMPT_READY when the prompt chord starts sounding, REPLAY_DONE when a
 * feedback replay ends, and ADVANCE when it's time to move on (after a reading pause, or on
 * Space / Next).
 *
 *   idle ─START→ prompting ─PROMPT_READY→ awaiting ─NOTE/PICK→ feedback ─ADVANCE→ prompting (next step)
 *                                                   │                    │      └→ roundEnd ─ADVANCE→ prompting (next round)
 *                                                   │                    │                        └→ summary (after the last)
 *                                                   │                    └ wrong: ─ADVANCE→ fixing ─NOTE (the right root)→ next step
 *                                                   └ right at Open, where the function is asked: → chip ─CHIP→ feedback
 *   END from anywhere → summary
 *
 * Notes only count in `awaiting` and `fixing`: anything played while the game is talking
 * (prompting, feedback, the round-end flourish) is ignored, and a note within 300 ms of an
 * accepted one is too, so a chord or a grace note answers once.
 */

export const DEBOUNCE_MS = 300;
/** Right answers in a row at a stage that move you up to the next (with Undo). Never down. */
export const PROMOTE_AFTER = 8;
export const STAGES: readonly Stage[] = ["guided", "choices", "open"];

export type Phase = "idle" | "prompting" | "awaiting" | "chip" | "feedback" | "fixing" | "roundEnd" | "summary";

/** What the scheduler is told per motion and key at the end (Open answers only). */
export interface ItemTally {
  motion: EarMotionId;
  key: string;
  steps: number;
  misses: number;
  alts: number;
}

export interface Discovery {
  move: string;
  /** The chord they played, engine spelling ("Db7"). */
  symbol: string;
}

export interface GameState {
  phase: Phase;
  level: LevelId;
  stage: Stage;
  rounds: Round[];
  roundIdx: number;
  /** Rounds played to the end (landed home) this session. */
  roundsDone: number;
  stepIdx: number;
  /** The last answer's verdict (and, at Open where it's asked, the function chip). */
  verdict: AnswerVerdict | null;
  chip: { picked: string; right: boolean } | null;
  /** The feedback replay has finished: the UI may now auto-advance. */
  replayDone: boolean;
  /** "why?" is open: the UI holds the auto-advance. */
  whyOpen: boolean;
  lastAcceptedAt: number | null;
  points: number;
  streak: number;
  bestStreak: number;
  /** Right answers in a row at the current stage (alt holds it, wrong resets it). */
  stageStreak: number;
  /** Set when the game just moved you up a stage, so Undo can put you back. */
  promotedFrom: Stage | null;
  answers: AnswerRecord[];
  items: Record<string, ItemTally>;
  discoveries: Discovery[];
}

export type GameEvent =
  | { type: "START"; level: LevelId; stage: Stage; seed: number; due?: readonly DueItem[]; rounds?: number; keys?: readonly string[] }
  | { type: "PROMPT_READY" }
  /** A note from the keyboard (any source on the note bus): MIDI number or pitch class, and when. */
  | { type: "NOTE"; note: number; at: number }
  /** An option card tapped (Guided / Choices): the root it stands for. */
  | { type: "PICK"; pc: number }
  | { type: "CHIP"; chip: string }
  | { type: "REPLAY_DONE" }
  | { type: "ADVANCE" }
  | { type: "SET_STAGE"; stage: Stage }
  | { type: "UNDO_PROMOTE" }
  | { type: "WHY_TOGGLE" }
  | { type: "END" };

export const initialGame = (level: LevelId = 1, stage: Stage = "guided"): GameState => ({
  phase: "idle",
  level,
  stage,
  rounds: [],
  roundIdx: 0,
  roundsDone: 0,
  stepIdx: 0,
  verdict: null,
  chip: null,
  replayDone: false,
  whyOpen: false,
  lastAcceptedAt: null,
  points: 0,
  streak: 0,
  bestStreak: 0,
  stageStreak: 0,
  promotedFrom: null,
  answers: [],
  items: {},
  discoveries: [],
});

// ── selectors ──

export const currentRound = (s: GameState): Round | null => s.rounds[s.roundIdx] ?? null;
export const currentStep = (s: GameState): Step | null => currentRound(s)?.steps[s.stepIdx] ?? null;
/** The function is asked for at Open, from Level 2. */
export const asksChip = (s: GameState) => s.stage === "open" && LEVELS[s.level - 1].asksFunction;

/** The option cards for the current step (none at Open). Stable for the step: seeded by round and step. */
export function currentOptions(s: GameState): SpelledChord[] {
  const r = currentRound(s);
  const step = currentStep(s);
  if (!r || !step || s.stage === "open") return [];
  return optionsFor(step, r.key, s.stage, r.seed + s.stepIdx);
}

/** The chords of the current round played so far, for the road: where it started, and every answer reached. */
export function trail(s: GameState): SpelledChord[] {
  const r = currentRound(s);
  if (!r) return [];
  const reached = s.phase === "roundEnd" ? r.steps.length : s.phase === "awaiting" || s.phase === "prompting" ? s.stepIdx : s.stepIdx + 1;
  return [r.steps[0].from, ...r.steps.slice(0, reached).map((st) => st.expected)];
}

// ── the reducer ──

const nextStage = (st: Stage): Stage | null => STAGES[STAGES.indexOf(st) + 1] ?? null;

function freshStep(s: GameState): GameState {
  return { ...s, phase: "prompting", verdict: null, chip: null, replayDone: false, whyOpen: false };
}

/** Move on from a finished step: the next step, the round-end flourish, or (after the last round) the summary. */
function afterStep(s: GameState): GameState {
  const r = currentRound(s)!;
  if (s.stepIdx + 1 < r.steps.length) return freshStep({ ...s, stepIdx: s.stepIdx + 1 });
  return { ...s, phase: "roundEnd", roundsDone: s.roundsDone + 1, verdict: null, chip: null, replayDone: false, whyOpen: false };
}

/** A note is accepted only once the last accepted one is 300 ms old. */
const debounced = (s: GameState, at: number) => s.lastAcceptedAt !== null && at - s.lastAcceptedAt < DEBOUNCE_MS;

/** Grade a root (from a note or a card) and score it. */
function answer(s: GameState, pc: number, at: number | null): GameState {
  const r = currentRound(s)!;
  const step = currentStep(s)!;
  const verdict = judge(step, r.key, pc);
  const right = verdict.kind === "right";
  const toChip = right && asksChip(s);

  // streaks: right adds, alt holds, wrong resets
  const streak = right ? s.streak + 1 : verdict.kind === "alt" ? s.streak : 0;
  let stageStreak = right ? s.stageStreak + 1 : verdict.kind === "alt" ? s.stageStreak : 0;
  let stage = s.stage;
  let promotedFrom = s.promotedFrom;
  const up = nextStage(s.stage);
  if (stageStreak >= PROMOTE_AFTER && up) {
    // takes effect from the next prompt; Undo puts it back
    promotedFrom = s.stage;
    stage = up;
    stageStreak = 0;
  }

  // the scheduler hears Open answers only (Guided and Choices are learning, not recall)
  let items = s.items;
  if (s.stage === "open") {
    const id = `${step.motion}|${r.key}`;
    const t = items[id] ?? { motion: step.motion, key: r.key, steps: 0, misses: 0, alts: 0 };
    items = {
      ...items,
      [id]: { ...t, steps: t.steps + 1, misses: t.misses + (verdict.kind === "wrong" ? 1 : 0), alts: t.alts + (verdict.kind === "alt" ? 1 : 0) },
    };
  }

  const discoveries =
    verdict.kind === "alt" && !s.discoveries.some((d) => d.symbol === verdict.played.symbol)
      ? [...s.discoveries, { move: verdict.move, symbol: verdict.played.symbol }]
      : s.discoveries;

  const record: AnswerRecord = {
    stage: s.stage,
    key: r.key,
    verdict: verdict.kind,
    chipRight: null, // filled in by CHIP where it's asked
    motion: step.motion,
    round: { id: r.seed, kind: r.kind, start: r.start, steps: r.steps.length },
  };

  return {
    ...s,
    phase: toChip ? "chip" : "feedback",
    verdict,
    chip: null,
    replayDone: false,
    lastAcceptedAt: at ?? s.lastAcceptedAt,
    points: s.points + scoreStep(s.stage, verdict.kind),
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    stageStreak,
    stage,
    promotedFrom,
    items,
    discoveries,
    // a root waiting for its chip is recorded when the chip comes in
    answers: toChip ? s.answers : [...s.answers, record],
  };
}

export function gameReducer(s: GameState, e: GameEvent): GameState {
  switch (e.type) {
    case "START": {
      const rounds = planSession(e.level, e.seed, e.due ?? [], e.rounds, e.keys);
      return { ...initialGame(e.level, e.stage), rounds, phase: "prompting" };
    }

    case "PROMPT_READY":
      return s.phase === "prompting" ? { ...s, phase: "awaiting" } : s;

    case "NOTE": {
      if (s.phase !== "awaiting" && s.phase !== "fixing") return s;
      if (debounced(s, e.at)) return s;
      const pc = ((e.note % 12) + 12) % 12;
      if (s.phase === "fixing") {
        // after a miss: play the right root to go on (ungraded); other notes are just notes
        return pc === currentStep(s)!.expected.pc ? afterStep({ ...s, lastAcceptedAt: e.at }) : s;
      }
      return answer(s, pc, e.at);
    }

    case "PICK":
      if (s.phase === "fixing") return e.pc === currentStep(s)!.expected.pc ? afterStep(s) : s;
      if (s.phase !== "awaiting" || s.stage === "open") return s;
      return answer(s, e.pc, null);

    case "CHIP": {
      if (s.phase !== "chip") return s;
      const r = currentRound(s)!;
      const step = currentStep(s)!;
      const right = e.chip === chipOf(step.expected);
      const record: AnswerRecord = {
        stage: s.stage,
        key: r.key,
        verdict: "right",
        chipRight: right,
        motion: step.motion,
        round: { id: r.seed, kind: r.kind, start: r.start, steps: r.steps.length },
      };
      return {
        ...s,
        phase: "feedback",
        chip: { picked: e.chip, right },
        points: s.points + (right ? scoreStep("open", "right", true) - scoreStep("open", "right") : 0),
        answers: [...s.answers, record],
      };
    }

    case "REPLAY_DONE":
      return s.phase === "feedback" ? { ...s, replayDone: true } : s;

    case "ADVANCE":
      if (s.phase === "feedback") {
        if (s.verdict?.kind === "wrong") return { ...s, phase: "fixing" };
        return afterStep(s);
      }
      if (s.phase === "roundEnd") {
        if (s.roundIdx + 1 >= s.rounds.length) return { ...s, phase: "summary" };
        return freshStep({ ...s, roundIdx: s.roundIdx + 1, stepIdx: 0 });
      }
      return s;

    case "SET_STAGE":
      return e.stage === s.stage ? s : { ...s, stage: e.stage, stageStreak: 0, promotedFrom: null };

    case "UNDO_PROMOTE":
      return s.promotedFrom ? { ...s, stage: s.promotedFrom, promotedFrom: null, stageStreak: 0 } : s;

    case "WHY_TOGGLE":
      return s.phase === "feedback" ? { ...s, whyOpen: !s.whyOpen } : s;

    case "END":
      return s.phase === "idle" || s.phase === "summary" ? s : { ...s, phase: "summary" };
  }
}

// ── the end of a session ──

export interface SessionSummary {
  points: number;
  bestStreak: number;
  roundsPlayed: number;
  /** Per motion: answers given and how many were right (all stages). */
  byMotion: { motion: EarMotionId; right: number; total: number }[];
  /** Keys played clean at Open this session, per motion (a CLEAN stamp each). */
  stamped: { motion: EarMotionId; key: string }[];
  discoveries: Discovery[];
}

export function summarise(s: GameState): SessionSummary {
  const byMotion = new Map<EarMotionId, { right: number; total: number }>();
  for (const a of s.answers) {
    if (!a.motion) continue;
    const t = byMotion.get(a.motion) ?? { right: 0, total: 0 };
    byMotion.set(a.motion, { right: t.right + (a.verdict === "right" ? 1 : 0), total: t.total + 1 });
  }
  return {
    points: s.points,
    bestStreak: s.bestStreak,
    roundsPlayed: s.roundsDone,
    byMotion: [...byMotion].map(([motion, t]) => ({ motion, ...t })),
    stamped: Object.values(s.items)
      .filter((t) => t.steps > 0 && t.misses === 0 && t.alts === 0)
      .map(({ motion, key }) => ({ motion, key })),
    discoveries: s.discoveries,
  };
}

/** The spaced-repetition runs a session hands the scheduler: one per motion and key answered at Open. */
export const srsRuns = (s: GameState) =>
  Object.values(s.items)
    .filter((t) => t.steps > 0)
    .map((t) => ({ ruleId: earRuleId(t.motion), keyTonic: t.key, misses: t.misses, leaps: t.alts }));
