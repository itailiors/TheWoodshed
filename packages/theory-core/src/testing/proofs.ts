import fc from "fast-check";
import { walkingBass } from "../band";
import { generateMoves, generateMovesTraced } from "../engine";
import { buildPathway, buildPathwayTraced, DENSITY, overlaps } from "../pathway";
import { BASE_INTERVAL_NAMES, chroma, INTERVALS, letterIndex, mod, transpose } from "../pitch";
import { sortedHarmony, absBeat } from "../time";
import { KEYS, transposeTune } from "../transpose";
import type { Tune } from "../types";
import { progressionArb, SPELLED } from "./arbitraries";

/*
 * The engine's claims, as executable properties. CI runs every one of these (see
 * test/proofs.test.ts), and the web app's Proof tab runs the very same objects in a Web
 * Worker, live. One definition, two audiences: no "demo version" of the tests.
 *
 * A predicate returns normally to pass and throws (via `must`) to fail, so a failure
 * carries a readable reason alongside fast-check's shrunk counterexample.
 */

export interface Proof {
  id: string;
  /** Short name for the list. */
  title: string;
  /** The claim, in a sentence a musician can check. */
  claim: string;
  /** Build the property (lazily: arbitraries are cheap, but some proofs build long tunes). */
  property: () => fc.IProperty<unknown[]>;
}

function must(cond: unknown, why: string): asserts cond {
  if (!cond) throw new Error(why);
}

/** A 4-bar progression repeated to 16 bars, so phrase windows have competition. */
function repeated(tune: Tune): Tune {
  return {
    ...tune,
    harmony: [0, 1, 2, 3].flatMap((rep) => tune.harmony.map((c) => ({ ...c, id: `${c.id}r${rep}`, at: { ...c.at, bar: c.at.bar + rep * 4 } }))),
  };
}

export const PROOFS: Proof[] = [
  {
    id: "deterministic",
    title: "Deterministic",
    claim: "The same tune and dial always give the same moves and the same pathway, byte for byte.",
    property: () =>
      fc.property(progressionArb, fc.integer({ min: 0, max: 4 }), (tune, level) => {
        const a = generateMoves(tune);
        const b = generateMoves(structuredClone(tune));
        must(JSON.stringify(a) === JSON.stringify(b), "two runs on the same tune disagreed");
        const pa = buildPathway(a.accepted, level).map((m) => m.id);
        const pb = buildPathway(b.accepted, level).map((m) => m.id);
        must(JSON.stringify(pa) === JSON.stringify(pb), "two pathways from the same moves disagreed");
      }),
  },
  {
    id: "melody-safe",
    title: "Melody-safe",
    claim: "No accepted move ever puts an avoid note under the melody, and every rejected one says why.",
    property: () =>
      fc.property(progressionArb, (tune) => {
        const { accepted, rejected } = generateMoves(tune);
        for (const m of accepted) must(!m.checks.melody.some((c) => c.verdict === "avoid"), `${m.id} kept an avoid note`);
        for (const r of rejected) must(r.reasons.length > 0 && r.reasons.every((x) => x.length > 0), `${r.move.id} was rejected without a reason`);
      }),
  },
  {
    id: "span",
    title: "Keeps the form",
    claim: "Every move fills exactly the beats it replaces, its chords laid back to back: the tune never gains or loses a beat.",
    property: () =>
      fc.property(progressionArb, (tune) => {
        const bpb = tune.meter[0];
        for (const m of generateMoves(tune).accepted) {
          let at = m.spanBeats.start;
          for (const c of m.chords) {
            must(absBeat(c.at, bpb) === at, `${m.id}: a gap or overlap inside the move`);
            at += c.beats;
          }
          must(at === m.spanBeats.end, `${m.id}: ${at - m.spanBeats.start} beats for a ${m.spanBeats.end - m.spanBeats.start}-beat span`);
        }
      }),
  },
  {
    id: "pathway",
    title: "Respects the dial",
    claim: "A pathway never overlaps itself, never goes spicier than the dial, and never exceeds the phrase quota.",
    property: () =>
      fc.property(progressionArb, fc.integer({ min: 1, max: 4 }), (tune, level) => {
        const long = repeated(tune);
        const path = buildPathway(generateMoves(long).accepted, level);
        const { windowBars, maxMoves } = DENSITY[level];
        const perWindow = new Map<number, number>();
        path.forEach((m, i) => {
          must(m.level <= level, `${m.id} is L${m.level} on an L${level} dial`);
          for (const o of path.slice(i + 1)) must(!overlaps(m, o), `${m.id} overlaps ${o.id}`);
          const w = Math.floor((m.span.from.bar - 1) / windowBars);
          perWindow.set(w, (perWindow.get(w) ?? 0) + 1);
        });
        for (const [w, n] of perWindow) must(n <= maxMoves, `bars ${w * windowBars + 1}–${(w + 1) * windowBars} hold ${n} moves (max ${maxMoves})`);
      }),
  },
  {
    id: "trace-honest",
    title: "The X-ray tells the truth",
    claim: "The traced engine and pathway produce exactly what the app plays, and give every candidate exactly one reason.",
    property: () =>
      fc.property(progressionArb, fc.integer({ min: 0, max: 4 }), (tune, level) => {
        const long = repeated(tune);
        const traced = generateMovesTraced(long);
        const plain = generateMoves(long);
        must(JSON.stringify(plain.accepted) === JSON.stringify(traced.accepted), "the trace changed the moves");
        const proposed = traced.attempts.filter((a) => a.outcome !== "no-fit").length;
        must(proposed === traced.accepted.length + traced.rejected.length, "attempts and moves don't add up");
        const { chosen, decisions } = buildPathwayTraced(traced.accepted, level);
        must(JSON.stringify(chosen.map((m) => m.id)) === JSON.stringify(buildPathway(plain.accepted, level).map((m) => m.id)), "the trace changed the pathway");
        must(decisions.size === traced.accepted.length, "a candidate is missing a decision");
        for (const m of traced.accepted) {
          const d = decisions.get(m.id)!;
          const isIn = chosen.some((c) => c.id === m.id);
          must(isIn === (d.kind === "chosen" || d.kind === "forced"), `${m.id}: "${d.kind}" but ${isIn ? "in" : "out of"} the pathway`);
          if (d.kind === "overlaps") must(chosen.some((c) => c.id === d.by && overlaps(c, m)), `${m.id} blamed on ${d.by}, which doesn't overlap it`);
          if (d.kind === "above-dial") must(m.level > level, `${m.id} called too spicy at L${m.level}`);
        }
      }),
  },
  {
    id: "transposition",
    title: "Key-independent",
    claim: "Move a tune to any of the 12 keys and the engine finds exactly the same moves, just spelled in the new key.",
    property: () =>
      fc.property(progressionArb, fc.constantFrom(...KEYS), (tune, key) => {
        const ids = (t: Tune) => generateMoves(t).accepted.map((m) => `${m.id}:${m.ruleId}`).sort();
        must(JSON.stringify(ids(tune)) === JSON.stringify(ids(transposeTune(tune, key))), `moving to ${key} changed which moves fire`);
      }),
  },
  {
    id: "spelling",
    title: "Spells like a chart",
    claim: "Transposing any spelled note by any interval keeps both the letter distance and the semitones (D + ♯5 = A♯, never B♭).",
    property: () =>
      fc.property(fc.constantFrom(...SPELLED), fc.constantFrom(...BASE_INTERVAL_NAMES), (note, iv) => {
        const out = transpose(note, iv);
        must(chroma(out) === mod(chroma(note) + INTERVALS[iv].semis, 12), `${note} + ${iv} = ${out}: wrong pitch`);
        must(letterIndex(out) === mod(letterIndex(note) + INTERVALS[iv].steps, 7), `${note} + ${iv} = ${out}: wrong letter`);
      }),
  },
  {
    id: "walking-bass",
    title: "Walks like a bassist",
    claim: "The walking bass plays every beat, lands each chord's root on its downbeat, and leads in by a half step.",
    property: () =>
      fc.property(progressionArb, (tune) => {
        const bpb = tune.meter[0];
        const chords = sortedHarmony(tune);
        const line = walkingBass(chords, bpb);
        const at = new Map(line.map((n) => [n.beat, n.midi]));
        chords.forEach((c, i) => {
          const start = absBeat(c.at, bpb);
          must(mod(at.get(start)!, 12) === chroma(c.bass ?? c.root), `bar ${c.at.bar}: the downbeat isn't the root`);
          const next = (start + c.beats) % line.length;
          if (c.beats > 1) must(Math.abs(at.get(next)! - at.get(start + c.beats - 1)!) === 1, `bar ${c.at.bar}: no half-step lead-in to chord ${i + 2}`);
        });
      }),
  },
];
