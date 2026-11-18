import { chroma } from "../pitch";
import {
  altsFrom,
  diatonicChords,
  LEVELS,
  motionFor,
  motionOfRuleId,
  spellInKey,
  walkNext,
  type Degree,
  type EarMotionId,
  type LevelId,
  type SpelledChord,
} from "./motions";

/*
 * Rounds and sessions for Make the Changes. A round (a "trip") is a chain of steps from a
 * start chord until it lands home on I; each step asks "where does this chord want to go?".
 * Everything here is seeded, so a seed always gives the same round, like the engine's band.
 */

// ── a tiny seeded RNG (mulberry32): no Math.random anywhere in the game's logic ──

export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── rounds ──

/**
 * - landing: V → I (Level 1, and Level 2's short round)
 * - setup: ii → V → I (Level 2)
 * - walkHome: from any chord but I, down the staircase to I (Level 3), 1–6 steps
 * - turnaround: I → vi → ii → V → I (Level 3)
 */
export type RoundKind = "landing" | "setup" | "walkHome" | "turnaround";

export interface Step {
  from: SpelledChord;
  expected: SpelledChord;
  motion: EarMotionId;
}

export interface Round {
  key: string;
  kind: RoundKind;
  /** The chord it starts on: `steps[0].from`. */
  start: Degree;
  steps: Step[];
  seed: number;
}

export const ROUND_KINDS: Record<LevelId, readonly RoundKind[]> = {
  1: ["landing"],
  2: ["landing", "setup"],
  3: ["walkHome", "turnaround"],
};

/** A degree path through the key, as steps. Each step's motion comes from the motion catalogue. */
function stepsAlong(key: string, path: Degree[]): Step[] {
  return path.slice(1).map((to, i) => {
    const from = path[i];
    const motion = motionFor(from, to);
    if (!motion) throw new Error(`no v1 motion from ${from} to ${to}`);
    return { from: spellInKey(key, from), expected: spellInKey(key, to), motion };
  });
}

/** Down the staircase from a degree to I. */
function walkPath(start: Degree): Degree[] {
  const path: Degree[] = [start];
  while (path[path.length - 1] !== 1) path.push(walkNext(path[path.length - 1]));
  return path;
}

/** The chords a walk home can start on: anything but I. IV is the longest walk (six steps, wider step included). */
export const WALK_STARTS: readonly Degree[] = [2, 3, 4, 5, 6, 7];

/**
 * One round in a key. The kind (and, for a walk home, the start) is chosen by the seed unless
 * given. The kind must be one of the level's (ROUND_KINDS).
 */
export function makeRound(level: LevelId, key: string, seed: number, opts: { kind?: RoundKind; start?: Degree } = {}): Round {
  const rng = seededRng(seed);
  const kind = opts.kind ?? pick(rng, ROUND_KINDS[level]);
  if (!ROUND_KINDS[level].includes(kind)) throw new Error(`Level ${level} has no ${kind} rounds`);
  let path: Degree[];
  switch (kind) {
    case "landing":
      path = [5, 1];
      break;
    case "setup":
      path = [2, 5, 1];
      break;
    case "turnaround":
      path = [1, 6, 2, 5, 1];
      break;
    case "walkHome":
      path = walkPath(opts.start ?? pick(rng, WALK_STARTS));
      break;
  }
  return { key, kind, start: path[0], steps: stepsAlong(key, path), seed };
}

// ── sessions ──

export const SESSION_ROUNDS = 10;

/** A review the scheduler says is due: an `ear:<motion>` concept in a key. */
export interface DueItem {
  ruleId: string;
  keyTonic: string;
}

/**
 * A round that practises this motion (for a due review), in the level's terms, or null if the
 * level doesn't teach it. In Level 3 the staircase is a walk from vii (wider step included).
 */
function roundForMotion(level: LevelId, motion: EarMotionId): { kind: RoundKind; start?: Degree } | null {
  if (!LEVELS[level - 1].motions.includes(motion)) return null;
  if (level === 1) return { kind: "landing" };
  if (level === 2) return { kind: motion === "setup" ? "setup" : "landing" };
  switch (motion) {
    case "landing":
      return { kind: "walkHome", start: 5 };
    case "setup":
      return { kind: "walkHome", start: 2 };
    case "staircase":
      return { kind: "walkHome", start: 7 };
    case "door":
      return { kind: "turnaround" };
  }
}

/**
 * A session's rounds: due reviews first (in the order given, those this level teaches, in their
 * own key), then rounds in seeded random keys of the level, never the same key twice in a row
 * where the level has more than one.
 */
export function planSession(level: LevelId, seed: number, due: readonly DueItem[] = [], rounds = SESSION_ROUNDS): Round[] {
  const rng = seededRng(seed);
  const keys = LEVELS[level - 1].keys;
  const out: Round[] = [];
  const roundSeed = () => Math.floor(rng() * 2 ** 31);

  for (const d of due) {
    if (out.length >= rounds) break;
    const motion = motionOfRuleId(d.ruleId);
    const key = keys.find((k) => chroma(k) === chroma(d.keyTonic));
    const shape = motion && key ? roundForMotion(level, motion) : null;
    if (shape && key) out.push(makeRound(level, key, roundSeed(), shape));
  }
  while (out.length < rounds) {
    const prev = out[out.length - 1]?.key;
    const pool = keys.length > 1 ? keys.filter((k) => k !== prev) : keys;
    out.push(makeRound(level, pick(rng, pool), roundSeed()));
  }
  return out;
}

// ── option cards (Guided and Choices) ──

export const MAX_OPTIONS = 3;

/**
 * Up to three option cards for a step. In Guided the expected answer comes first (the most
 * common move); in Choices the order is shuffled by the seed. Besides the answer there's at
 * most one real alternative (a valid-but-different move, so the cards teach that there's more
 * than one way) and the rest are chords from the key that don't go there. Roots are distinct.
 */
export function optionsFor(step: Step, key: string, stage: "guided" | "choices", seed: number): SpelledChord[] {
  const rng = seededRng(seed);
  const alts = shuffle(rng, altsFrom(key, step.from).map((a) => a.chord));
  const taken = new Set([step.expected.pc, step.from.pc]);
  const others = shuffle(
    rng,
    diatonicChords(key).filter((c) => !taken.has(c.pc) && motionFor(step.from.degree!, c.degree!) === null),
  );
  const options = [step.expected, ...alts.slice(0, 1), ...others].slice(0, MAX_OPTIONS);
  return stage === "guided" ? options : shuffle(rng, options);
}
