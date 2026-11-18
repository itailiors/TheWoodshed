import { chroma, mod, prettyNote, prettySymbol, spellChroma } from "../pitch";
import {
  ALTS,
  altsFrom,
  diatonicChords,
  MOTIONS,
  motionFor,
  spellChord,
  type AltMotionId,
  type EarMotionId,
  type LevelId,
  type SpelledChord,
} from "./motions";
import type { RoundKind, Step } from "./rounds";

/*
 * Judging an answer, scoring it, and deciding when a level is mastered. An answer is one pitch
 * class: the octave never matters (down a fifth and up a fourth are the same answer), and
 * spelling never matters either (C♯ and D♭ are the same key on the piano).
 */

export type Stage = "guided" | "choices" | "open";

/**
 * - right: the root this round's path goes to
 * - alt: a real move from here that isn't this round's path (half credit). Either one of the
 *   alternatives (tritone sub, backdoor, passing diminished) or another of the game's own
 *   motions (from I, the staircase to IV when this round steps out the door to vi)
 * - wrong: anything else
 */
export type AnswerVerdict =
  | { kind: "right" }
  | { kind: "alt"; move: AltMotionId | EarMotionId; played: SpelledChord }
  | { kind: "wrong"; played: SpelledChord };

/** The chord a played root most likely means in this key: its diatonic chord, or a bare flat-spelled root. */
function readAs(key: string, pc: number): SpelledChord {
  return diatonicChords(key).find((c) => c.pc === pc) ?? spellChord(spellChroma(pc), "maj", key, null);
}

/** Judge one answer (a pitch class 0–11, or any MIDI note: only its pitch class counts). */
export function judge(step: Step, key: string, played: number): AnswerVerdict {
  const pc = mod(played, 12);
  if (pc === step.expected.pc) return { kind: "right" };
  const alt = altsFrom(key, step.from).find((a) => a.chord.pc === pc);
  if (alt) return { kind: "alt", move: alt.id, played: alt.chord };
  const core = diatonicChords(key).find((c) => c.pc === pc && motionFor(step.from.degree!, c.degree!) !== null);
  if (core) return { kind: "alt", move: motionFor(step.from.degree!, core.degree!)!, played: core };
  return { kind: "wrong", played: readAs(key, pc) };
}

/** The feedback line under the answer: the teacher's words, spelled for the key. */
export function verdictLine(step: Step, key: string, v: AnswerVerdict): string {
  const ctx = { tonic: key, from: step.from, to: step.expected };
  const there = prettySymbol(step.expected.symbol);
  switch (v.kind) {
    case "right":
      return MOTIONS[step.motion].right(ctx);
    case "alt":
      return v.move in ALTS
        ? `${ALTS[v.move as AltMotionId].line(key, v.played)} This round goes to ${there}.`
        : `A real move too: ${prettySymbol(v.played.symbol)} is ${MOTIONS[v.move as EarMotionId].model}. This round goes to ${there}.`;
    case "wrong":
      return MOTIONS[step.motion].wrong(ctx);
  }
}

// ── scoring ──

/** Points for right / alt / wrong at each stage: the more help, the fewer points. */
export const STAGE_POINTS: Record<Stage, Record<AnswerVerdict["kind"], number>> = {
  guided: { right: 3, alt: 1, wrong: 0 },
  choices: { right: 6, alt: 3, wrong: 0 },
  open: { right: 10, alt: 5, wrong: 0 },
};
/** Bonus for naming the function (ii / V / I…) right at the Open stage, where it's asked. */
export const CHIP_BONUS = 4;

export function scoreStep(stage: Stage, verdict: AnswerVerdict["kind"], chipRight = false): number {
  return STAGE_POINTS[stage][verdict] + (stage === "open" && verdict === "right" && chipRight ? CHIP_BONUS : 0);
}

/** The function chips for a key at a level: the numerals the player can name. */
export const FUNCTION_CHIPS: Record<LevelId, readonly string[]> = {
  1: [],
  2: ["ii", "V", "I"],
  3: ["I", "ii", "iii", "IV", "V", "vi", "vii"],
};

/** The chip that names a chord's function ("ii7" → "ii", "viiø7" → "vii"). */
export const chipOf = (c: SpelledChord) => c.numeral.replace(/[^iIvV]/g, "");

// ── mastery ──

/** One answered step, as the game records it (only Open answers count towards mastery). */
export interface AnswerRecord {
  stage: Stage;
  key: string;
  verdict: AnswerVerdict["kind"];
  /** Function named right; null where it isn't asked (Level 1). */
  chipRight: boolean | null;
  /** The motion the step was asking about (for the summary's per-motion accuracy). */
  motion?: EarMotionId;
  /** Which round it belonged to, so whole rounds can be judged clean. */
  round: { id: number; kind: RoundKind; start: number; steps: number };
}

export interface Mastery {
  mastered: boolean;
  /** Where the player stands, in a few plain words ("6 in a row; F still to come"). */
  detail: string;
}

const sameKey = (a: string, b: string) => chroma(a) === chroma(b);

/** The current run of right answers at Open (those that count: the chip too, where it's asked). */
function currentRun(answers: readonly AnswerRecord[], needChip: boolean): AnswerRecord[] {
  const run: AnswerRecord[] = [];
  for (const a of answers) {
    if (a.stage !== "open") continue;
    if (a.verdict === "right" && (!needChip || a.chipRight === true)) run.push(a);
    else run.length = 0;
  }
  return run;
}

/**
 * Has the player mastered a level, from its answers in order? All at the Open stage.
 * - L1: right in a row, every one of the 12 keys among them (so at least 12)
 * - L2: 10 right in a row with the function named, all three keys among them
 * - L3: two clean walks home from vii or iii in two different keys, and one clean turnaround
 */
export function masteryProgress(level: LevelId, answers: readonly AnswerRecord[], keys: readonly string[]): Mastery {
  if (level === 1 || level === 2) {
    const run = currentRun(answers, level === 2);
    const missing = keys.filter((k) => !run.some((a) => sameKey(a.key, k)));
    const need = Math.max(10, keys.length);
    const mastered = run.length >= need && missing.length === 0;
    const toCome = missing.length > 3 ? `${missing.length} keys` : missing.map(prettyNote).join(" and ");
    return {
      mastered,
      detail: mastered
        ? "Mastered."
        : `${Math.min(run.length, need)} of ${need} in a row${missing.length ? `; ${toCome} still to come` : ""}.`,
    };
  }
  // Level 3: whole rounds, every step right with its function named
  const rounds = new Map<number, AnswerRecord[]>();
  for (const a of answers) if (a.stage === "open") rounds.set(a.round.id, [...(rounds.get(a.round.id) ?? []), a]);
  const clean = [...rounds.values()].filter((rs) => rs.length === rs[0].round.steps && rs.every((a) => a.verdict === "right" && a.chipRight === true));
  const walkKeys = new Set(clean.filter((rs) => rs[0].round.kind === "walkHome" && [3, 7].includes(rs[0].round.start)).map((rs) => chroma(rs[0].key)));
  const turnarounds = clean.filter((rs) => rs[0].round.kind === "turnaround").length;
  const mastered = walkKeys.size >= 2 && turnarounds >= 1;
  return {
    mastered,
    detail: mastered
      ? "Mastered."
      : `Clean walks home from vii or iii: ${Math.min(walkKeys.size, 2)} of 2 keys · clean turnaround: ${turnarounds >= 1 ? "done" : "not yet"}.`,
  };
}
