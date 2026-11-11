import { chordTones, guideTones, symbol } from "./chords";
import { classifyNote } from "./melody";
import { pitchClass } from "./pitch";
import type { Proposal, Rule } from "./ruleKit";
import { RULES } from "./ruleset";
import { absBeat, eventSpan, melodyIn, posFromAbs, sortedHarmony } from "./time";
import type { ChordEvent, MelodyCheck, ReharmMove, RejectedMove, Tune } from "./types";
import { motionCost, nearestMotion } from "./voiceLeading";

export interface GenerateResult {
  accepted: ReharmMove[];
  rejected: RejectedMove[];
}

/**
 * One rule, asked about one chord: did it have nothing to say ("no-fit"), or did it propose
 * a move that the melody filter then passed ("accepted") or struck out ("rejected")?
 */
export interface RuleAttempt {
  ruleId: string;
  ruleName: string;
  chordId: string;
  chordIndex: number;
  outcome: "no-fit" | "accepted" | "rejected";
  /** The move's id, when the rule proposed one. */
  moveId?: string;
}

export interface GenerateTrace extends GenerateResult {
  /** Every (chord, rule) pair the engine tried, in the order it tried them. */
  attempts: RuleAttempt[];
}

/**
 * analyze → generate → filter (melody) → score, recording every attempt along the way.
 * This is the engine: `generateMoves` is this with the trace dropped, so what the Engine
 * X-ray shows is, by construction, what the app plays.
 */
export function generateMovesTraced(tune: Tune, rules: Rule[] = RULES): GenerateTrace {
  const chords = sortedHarmony(tune);
  const accepted: ReharmMove[] = [];
  const rejected: RejectedMove[] = [];
  const attempts: RuleAttempt[] = [];

  chords.forEach((chord, index) => {
    rules.forEach((rule, priority) => {
      const attempt: RuleAttempt = { ruleId: rule.id, ruleName: rule.name, chordId: chord.id, chordIndex: index, outcome: "no-fit" };
      attempts.push(attempt);
      const p = rule.propose({ tune, index, chord, prev: chords[index - 1], next: chords[index + 1], afterNext: chords[index + 2] });
      if (!p) return;
      const move = buildMove(tune, rule, priority, p, chords, index);
      attempt.moveId = move.id;
      const avoid = move.checks.melody.filter((m) => m.verdict === "avoid");
      if (avoid.length) {
        attempt.outcome = "rejected";
        rejected.push({ move, reasons: avoid.map((a) => a.reason ?? `${a.note} is an avoid note`) });
      } else {
        attempt.outcome = "accepted";
        accepted.push(move);
      }
    });
  });
  return { accepted, rejected, attempts };
}

/** analyze → generate → filter (melody) → score. Pure and synchronous: safe to run on every UI change. */
export function generateMoves(tune: Tune, rules: Rule[] = RULES): GenerateResult {
  const { accepted, rejected } = generateMovesTraced(tune, rules);
  return { accepted, rejected };
}

function buildMove(tune: Tune, rule: Rule, priority: number, p: Proposal, chords: ChordEvent[], i: number): ReharmMove {
  const bpb = tune.meter[0];
  const count = p.replaceCount ?? 1;
  const original = chords.slice(i, i + count);
  const start = absBeat(original[0].at, bpb);
  const total = original.reduce((s, c) => s + c.beats, 0);
  const newTotal = p.chords.reduce((s, c) => s + c.beats, 0);
  if (Math.abs(total - newTotal) > 1e-9) {
    throw new Error(`Rule ${rule.id} changed the span length (${total} → ${newTotal})`);
  }

  const id = `${rule.id}@${original[0].at.bar}.${original[0].at.beat}`;
  let t = start;
  const newChords: ChordEvent[] = p.chords.map((c, k) => {
    const ev: ChordEvent = { ...c, id: `${id}#${k}`, at: posFromAbs(t, bpb) };
    t += c.beats;
    return ev;
  });

  const melody: MelodyCheck[] = [];
  let heardMelody = false;
  for (const c of newChords) {
    const [s, e] = eventSpan(c, bpb);
    for (const n of melodyIn(tune, s, e)) {
      heardMelody = true;
      melody.push({ chordId: c.id, chordSymbol: symbol(c), note: pitchClass(n.pitch), ...classifyNote(c, n.pitch) });
    }
  }

  const after = chords[i + count];
  const last = newChords[newChords.length - 1];
  const gtMotion = after ? guideTones(last).map((g) => nearestMotion(g.note, chordTones(after))) : [];
  const cost = motionCost(gtMotion);

  return {
    id,
    ruleId: rule.id,
    priority,
    title: p.title,
    category: p.category,
    level: p.level,
    styleTags: p.styleTags,
    span: { from: original[0].at, to: posFromAbs(start + total, bpb) },
    spanBeats: { start, end: start + total },
    replaces: original.map((c) => c.id),
    original,
    chords: newChords,
    targetSymbol: after ? symbol(after) : undefined,
    voicingHint: p.voicingHint,
    checks: {
      melody,
      melodyVerified: tune.melodyCoverage === "full" || heardMelody,
      voiceLeadingCost: cost,
      score: 10 - cost,
    },
    voiceLeading: p.voiceLeading ?? gtMotion,
    facts: p.facts,
    text: p.text,
  };
}
