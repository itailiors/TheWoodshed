import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  altsFrom,
  chipOf,
  currentOptions,
  currentRound,
  currentStep,
  DEBOUNCE_MS,
  gameReducer,
  initialGame,
  PROMOTE_AFTER,
  scoreStep,
  srsRuns,
  STAGES,
  summarise,
  trail,
  type GameEvent,
  type GameState,
  type Stage,
} from "../src/ears";
import type { LevelId } from "../src/ears";

/*
 * Make the Changes, step 3: the game as a pure reducer. Worked transitions for every rule,
 * and a property test that random play (any events, in any order) never breaks it.
 */

let clock = 0;
const later = (ms = 1000) => (clock += ms);

const run = (s: GameState, ...events: GameEvent[]) => events.reduce(gameReducer, s);
const start = (level: LevelId = 1, stage: Stage = "guided", seed = 42) =>
  run(initialGame(), { type: "START", level, stage, seed }, { type: "PROMPT_READY" });

const expectedPc = (s: GameState) => currentStep(s)!.expected.pc;
/** A root that's wrong for the current step: not the answer, and no alternative either. */
function wrongPc(s: GameState): number {
  const step = currentStep(s)!;
  const r = currentRound(s)!;
  const near = new Set([step.expected.pc, ...altsFrom(r.key, step.from).map((a) => a.chord.pc)]);
  // the chord a fifth *up* (a step back up the staircase) is never a v1 move from here
  for (let pc = (step.from.pc + 7) % 12; ; pc = (pc + 1) % 12) if (!near.has(pc) && !(step.from.degree === 1 && [5, 9].includes((pc - step.from.pc + 12) % 12))) return pc;
}
const note = (pc: number, octave = 4): GameEvent => ({ type: "NOTE", note: pc + 12 * (octave + 1), at: later() });

/** Answer the current step right and move on to the next prompt (or round end). */
function playRight(s: GameState): GameState {
  s = run(s, note(expectedPc(s)));
  if (s.phase === "chip") s = run(s, { type: "CHIP", chip: chipOf(currentStep(s)!.expected) });
  s = run(s, { type: "REPLAY_DONE" }, { type: "ADVANCE" });
  if (s.phase === "roundEnd") s = run(s, { type: "ADVANCE" });
  return s.phase === "prompting" ? run(s, { type: "PROMPT_READY" }) : s;
}

describe("starting and the step loop", () => {
  it("START deals a 10-round session and waits for the prompt chord to sound", () => {
    const s0 = run(initialGame(), { type: "START", level: 2, stage: "guided", seed: 7 });
    expect(s0.phase).toBe("prompting");
    expect(s0.rounds).toHaveLength(10);
    expect(run(s0, note(expectedPc(s0))).phase).toBe("prompting"); // not listening yet
    expect(run(s0, { type: "PROMPT_READY" }).phase).toBe("awaiting");
  });

  it("a right answer scores, shows feedback, then moves to the next step or the round's end", () => {
    let s = start(1, "guided");
    s = run(s, note(expectedPc(s), 2)); // any octave
    expect(s.phase).toBe("feedback");
    expect(s.verdict).toEqual({ kind: "right" });
    expect([s.points, s.streak]).toEqual([3, 1]);
    s = run(s, { type: "ADVANCE" });
    expect(s.phase).toBe("roundEnd"); // Level 1 rounds are one step: V → I
    expect(s.roundsDone).toBe(1);
    s = run(s, { type: "ADVANCE" });
    expect([s.phase, s.roundIdx, s.stepIdx]).toEqual(["prompting", 1, 0]);
  });

  it("plays a whole session to the summary", () => {
    let s = start(3, "guided", 9);
    let guard = 0;
    while (s.phase !== "summary" && guard++ < 200) s = playRight(s);
    const sum = summarise(s);
    const steps = s.rounds.reduce((n, r) => n + r.steps.length, 0);
    expect(s.answers).toHaveLength(steps);
    expect(sum.roundsPlayed).toBe(10);
    // all right, so it promotes along the way: each answer pays at the stage it was given (plus the chip at Open)
    expect(s.stage).toBe("open");
    expect(sum.points).toBe(s.answers.reduce((n, a) => n + scoreStep(a.stage, a.verdict, a.chipRight === true), 0));
    expect(sum.byMotion.reduce((n, m) => n + m.total, 0)).toBe(steps);
    expect(sum.byMotion.every((m) => m.right === m.total)).toBe(true);
  });

  it("a wrong answer explains, then waits for the right root before going on (ungraded)", () => {
    let s = start(1, "guided");
    const wrong = wrongPc(s);
    s = run(s, note(wrong));
    expect(s.verdict?.kind).toBe("wrong");
    expect([s.points, s.streak]).toEqual([0, 0]);
    s = run(s, { type: "REPLAY_DONE" }, { type: "ADVANCE" });
    expect(s.phase).toBe("fixing");
    expect(run(s, note(wrong)).phase).toBe("fixing"); // other notes are just notes
    const answersBefore = s.answers.length;
    s = run(s, note(expectedPc(s)));
    expect(s.phase).toBe("roundEnd");
    expect(s.answers).toHaveLength(answersBefore); // the fix isn't graded
    expect(s.points).toBe(0);
  });
});

describe("listening rules", () => {
  it("ignores notes while the game is talking: prompting, feedback, round end, summary", () => {
    let s = run(initialGame(), { type: "START", level: 1, stage: "guided", seed: 3 });
    expect(run(s, note(0))).toBe(s);
    s = run(s, { type: "PROMPT_READY" }, note(expectedPc(run(s, { type: "PROMPT_READY" }))));
    expect(s.phase).toBe("feedback");
    expect(run(s, note(5))).toBe(s);
    s = run(s, { type: "ADVANCE" });
    expect(s.phase).toBe("roundEnd");
    expect(run(s, note(5))).toBe(s);
    s = run(s, { type: "END" });
    expect(run(s, note(5))).toBe(s);
  });

  it("answers a chord or a grace note once: notes within 300 ms of an accepted one are dropped", () => {
    let s = start(1, "guided");
    const wrong = wrongPc(s);
    const t = later();
    s = run(s, { type: "NOTE", note: wrong + 48, at: t }, { type: "REPLAY_DONE" }, { type: "ADVANCE" });
    expect(s.phase).toBe("fixing");
    // the rest of the chord, and then the right root too soon after it, are ignored
    const fix = expectedPc(s);
    expect(run(s, { type: "NOTE", note: fix + 60, at: t + DEBOUNCE_MS - 1 }).phase).toBe("fixing");
    expect(run(s, { type: "NOTE", note: fix + 60, at: t + DEBOUNCE_MS }).phase).toBe("roundEnd");
  });

  it("option cards answer in Guided and Choices, but not at Open", () => {
    const g = start(1, "guided");
    const opts = currentOptions(g);
    expect(opts[0].pc).toBe(expectedPc(g));
    expect(run(g, { type: "PICK", pc: opts[0].pc }).verdict).toEqual({ kind: "right" });
    const o = start(1, "open");
    expect(currentOptions(o)).toEqual([]);
    expect(run(o, { type: "PICK", pc: expectedPc(o) })).toBe(o);
  });
});

describe("streaks and stages", () => {
  it("a valid alternative holds the streak; a miss resets it; the best is kept", () => {
    let s = start(2, "guided", 11);
    // find a setup round (ii → V → I) so the tritone sub is available from ii
    while (currentRound(s)!.kind !== "setup") s = playRight(s);
    const streakIn = s.streak;
    const alt = altsFrom(currentRound(s)!.key, currentStep(s)!.from)[0];
    s = run(s, note(alt.chord.pc));
    expect(s.verdict).toMatchObject({ kind: "alt", move: "tritoneSub" });
    expect(s.streak).toBe(streakIn);
    expect(s.discoveries).toEqual([{ move: "tritoneSub", symbol: alt.chord.symbol }]);
    s = run(s, { type: "ADVANCE" }, { type: "PROMPT_READY" });
    s = run(s, note(wrongPc(s)));
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBeGreaterThanOrEqual(streakIn);
  });

  it(`moves up a stage after ${PROMOTE_AFTER} right in a row, with Undo, and never down`, () => {
    let s = start(1, "guided");
    for (let i = 0; i < PROMOTE_AFTER - 1; i++) s = playRight(s);
    expect(s.stage).toBe("guided");
    s = playRight(s);
    expect([s.stage, s.promotedFrom]).toEqual(["choices", "guided"]);
    const undone = run(s, { type: "UNDO_PROMOTE" });
    expect([undone.stage, undone.promotedFrom]).toEqual(["guided", null]);
    // misses at Choices never move you back down
    for (let i = 0; i < 5; i++) {
      s = run(s, note(wrongPc(s)), { type: "ADVANCE" });
      s = run(s, note(expectedPc(s)));
      if (s.phase === "roundEnd") s = run(s, { type: "ADVANCE" }, { type: "PROMPT_READY" });
    }
    expect(s.stage).toBe("choices");
    // and Open is the top
    let o = start(1, "open");
    for (let i = 0; i < PROMOTE_AFTER + 2; i++) o = playRight(o);
    expect(o.stage).toBe("open");
  });

  it("a stage picked by hand resets the stage streak and drops the Undo", () => {
    let s = start(1, "guided");
    s = playRight(s);
    s = run(s, { type: "SET_STAGE", stage: "open" });
    expect([s.stage, s.stageStreak, s.promotedFrom]).toEqual(["open", 0, null]);
  });
});

describe("naming the function at Open", () => {
  it("Level 2 asks for the function after a right root: +4 for the right chip, root credit kept either way", () => {
    let s = start(2, "open");
    s = run(s, note(expectedPc(s)));
    expect(s.phase).toBe("chip");
    expect(s.answers).toHaveLength(0); // recorded once the chip is in
    const right = chipOf(currentStep(s)!.expected);
    const good = run(s, { type: "CHIP", chip: right });
    expect([good.phase, good.points, good.chip]).toEqual(["feedback", 14, { picked: right, right: true }]);
    expect(good.answers.at(-1)).toMatchObject({ verdict: "right", chipRight: true });
    const bad = run(s, { type: "CHIP", chip: right === "I" ? "ii" : "I" });
    expect([bad.points, bad.chip?.right]).toEqual([10, false]);
    expect(bad.answers.at(-1)).toMatchObject({ verdict: "right", chipRight: false });
  });

  it("Level 1 never asks, and Guided never asks", () => {
    const l1 = start(1, "open");
    expect(run(l1, note(expectedPc(l1))).phase).toBe("feedback");
    const g = start(2, "guided");
    expect(run(g, note(expectedPc(g))).phase).toBe("feedback");
  });
});

describe("what the scheduler hears", () => {
  it("only Open answers count, tallied per motion and key; clean ones are stamped", () => {
    let g = start(1, "guided");
    for (let i = 0; i < 3; i++) g = playRight(g);
    expect(srsRuns(g)).toEqual([]);

    let o = start(1, "open", 5);
    const firstKey = currentRound(o)!.key;
    o = run(o, note(wrongPc(o)), { type: "ADVANCE" }, note(expectedPc(o)), { type: "ADVANCE" }, { type: "PROMPT_READY" });
    for (let i = 0; i < 4; i++) o = playRight(o);
    const runs = srsRuns(o);
    expect(runs.every((r) => r.ruleId === "ear:landing")).toBe(true);
    expect(runs.find((r) => r.keyTonic === firstKey)!.misses).toBe(1);
    const sum = summarise(run(o, { type: "END" }));
    expect(sum.stamped.some((x) => x.key === firstKey)).toBe(false); // a miss: no CLEAN stamp
    for (const x of sum.stamped) expect(runs.find((r) => r.keyTonic === x.key)).toMatchObject({ misses: 0, leaps: 0 });
  });
});

describe("the road and housekeeping", () => {
  it("the trail grows by the answer once it's given, and shows the whole round at its end", () => {
    let s = start(3, "guided", 21);
    while (currentRound(s)!.kind !== "turnaround") s = playRight(s);
    expect(trail(s).map((c) => c.degree)).toEqual([1]);
    s = run(s, note(expectedPc(s)));
    if (s.phase === "chip") s = run(s, { type: "CHIP", chip: chipOf(currentStep(s)!.expected) });
    expect(trail(s).map((c) => c.degree)).toEqual([1, 6]);
    s = run(s, { type: "ADVANCE" }, { type: "PROMPT_READY" });
    expect(trail(s).map((c) => c.degree)).toEqual([1, 6]); // the next answer isn't shown before it's given
    s = playRight(s); // vi → ii
    s = playRight(s); // ii → V
    s = run(s, note(expectedPc(s))); // V → I
    if (s.phase === "chip") s = run(s, { type: "CHIP", chip: chipOf(currentStep(s)!.expected) });
    s = run(s, { type: "ADVANCE" });
    expect(s.phase).toBe("roundEnd");
    expect(trail(s).map((c) => c.degree)).toEqual([1, 6, 2, 5, 1]);
  });

  it("'why?' and the replay flag only exist during feedback, and reset on the next step", () => {
    let s = start(1, "guided");
    expect(run(s, { type: "WHY_TOGGLE" })).toBe(s);
    s = run(s, note(expectedPc(s)), { type: "WHY_TOGGLE" }, { type: "REPLAY_DONE" });
    expect([s.whyOpen, s.replayDone]).toEqual([true, true]);
    s = run(s, { type: "ADVANCE" }, { type: "ADVANCE" });
    expect([s.whyOpen, s.replayDone]).toEqual([false, false]);
  });

  it("END goes to the summary from anywhere in a session, and does nothing before one starts", () => {
    expect(run(initialGame(), { type: "END" }).phase).toBe("idle");
    const s = run(start(), note(0));
    expect(run(s, { type: "END" }).phase).toBe("summary");
  });
});

describe("random play", () => {
  const eventArb: fc.Arbitrary<GameEvent> = fc.oneof(
    fc.constant<GameEvent>({ type: "PROMPT_READY" }),
    fc.integer({ min: 21, max: 108 }).map<GameEvent>((n) => ({ type: "NOTE", note: n, at: 0 })),
    fc.integer({ min: 0, max: 11 }).map<GameEvent>((pc) => ({ type: "PICK", pc })),
    fc.constantFrom("I", "ii", "iii", "IV", "V", "vi", "vii").map<GameEvent>((chip) => ({ type: "CHIP", chip })),
    fc.constant<GameEvent>({ type: "REPLAY_DONE" }),
    fc.constant<GameEvent>({ type: "ADVANCE" }),
    fc.constantFrom(...STAGES).map<GameEvent>((stage) => ({ type: "SET_STAGE", stage })),
    fc.constant<GameEvent>({ type: "UNDO_PROMOTE" }),
    fc.constant<GameEvent>({ type: "WHY_TOGGLE" }),
  );

  it("any events in any order: never throws, never mutates, points never drop, the round stays in range", () => {
    fc.assert(
      fc.property(fc.constantFrom<LevelId>(1, 2, 3), fc.nat(), fc.array(eventArb, { maxLength: 120 }), (level, seed, events) => {
        let t = 0;
        let s = run(initialGame(), { type: "START", level, stage: "guided", seed });
        for (const e of events) {
          const ev = e.type === "NOTE" ? { ...e, at: (t += 500) } : e;
          const before = JSON.stringify(s);
          const next = gameReducer(Object.freeze(s), ev);
          expect(JSON.stringify(s)).toBe(before);
          expect(next.points).toBeGreaterThanOrEqual(s.points);
          expect(next.roundIdx).toBeLessThan(next.rounds.length);
          if (next.phase !== "summary") expect(currentStep(next)).not.toBeNull();
          expect(next.streak).toBeLessThanOrEqual(next.answers.length + (next.phase === "chip" ? 1 : 0));
          s = next;
        }
      }),
      { numRuns: 150 },
    );
  });
});
