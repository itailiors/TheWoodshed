/**
 * Harmony Catcher: recognise the engine's own moves in what the player comps (docs/plans/harmony-catcher.md).
 * Pure and key-free: everything is measured from the chord's root.
 */
import { ALTERATION_EXCLUDES, chordTones, guideTones, symbol } from "./chords";
import { generateMoves } from "./engine";
import { chroma, mod, transpose } from "./pitch";
import { absBeat, sortedHarmony } from "./time";
import type { ChordEvent, Quality, ReharmMove, Tune } from "./types";

type ChordShape = Pick<ChordEvent, "root" | "quality" | "extensions" | "alterations" | "bass">;

/**
 * Tensions a comper may add to each quality without changing the chord. Stricter than
 * `classifyNote`'s melody rule (a half step above a chord tone), which would let E♭ pass over
 * Cmaj7 or B♭ over a C triad: here those are a different chord, and that is what a catch is about.
 */
const TENSIONS: Record<Quality, string[]> = {
  maj: ["9", "#11", "13", "7"],
  maj7: ["9", "#11", "13"],
  "6": ["9", "#11", "7"],
  "maj7#5": ["9", "#11"],
  aug: ["9", "#11", "7"],
  "7": ["b9", "9", "#9", "#11", "b13", "13"],
  "7sus4": ["b9", "9", "b13", "13", "3"], // the 3rd as a 10th above the 4th: the quartal voicing's top
  m: ["9", "11", "13", "b7", "7"],
  m7: ["9", "11", "13"],
  m6: ["9", "11", "7"],
  mMaj7: ["9", "11", "13"],
  m7b5: ["9", "11", "b13"],
  dim7: ["9", "11", "b13", "7"],
};

/** The altered 5th that tells these qualities apart from their neighbours (Dø7 rootless would be Fm). */
const DEFINING_FIFTH: Partial<Record<Quality, string>> = { m7b5: "b5", aug: "#5", "maj7#5": "#5" };

export interface ChordMatch {
  /** The strike is this chord: at least 2 pitch classes, nothing missing, nothing foreign. */
  ok: boolean;
  /** Required degrees not played ("b3", "b7"…): the guide tones, plus the defining altered 5th when rootless. */
  missing: string[];
  /** Pitch classes (0–11, ascending) that are neither chord tones nor allowed tensions. */
  foreign: number[];
  rootPresent: boolean;
  /** The lowest note is the root (the bass, for a slash chord): what separates a tritone sub from rootless altered comping. */
  lowestIsRoot: boolean;
}

/**
 * Does a strike (MIDI notes, keys held; the pedal never counts) spell this chord? The root and 5th
 * are optional, so rootless A/B forms and shells count; the 3rd (or sus 4th) and 7th (or 6th) are
 * required. A diminished 7th needs any three of its four tones, since it's symmetric.
 */
export function matchChord(midis: readonly number[], chord: ChordShape): ChordMatch {
  const played = [...new Set(midis.map((m) => mod(m, 12)))].sort((a, b) => a - b);
  const rootC = chroma(chord.root);
  const tones = chordTones(chord);
  const has = (c: number) => played.includes(c);

  const excluded = new Set(chord.alterations.map((a) => ALTERATION_EXCLUDES[a]).filter(Boolean));
  const allowed = new Set(tones.map((t) => chroma(t.note)));
  for (const d of TENSIONS[chord.quality]) if (!excluded.has(d)) allowed.add(chroma(transpose(chord.root, d)));

  let missing: string[];
  if (chord.quality === "dim7") {
    const absent = tones.filter((t) => !has(chroma(t.note)));
    missing = tones.length - absent.length >= 3 ? [] : absent.map((t) => t.degree);
  } else {
    const required = guideTones(chord).map((t) => t.degree);
    // only a rootless strike needs the altered 5th: with D underneath, the root–♭3–♭7 shell the
    // Voicings tab teaches reads as Dø7 (ambiguity with Dm7 is settled by the catcher, not here)
    const fifth = DEFINING_FIFTH[chord.quality];
    if (fifth && !has(rootC)) required.push(fifth);
    missing = required.filter((d) => !has(chroma(transpose(chord.root, d))));
  }

  // a slash chord is defined by its bass: A♭/B♭ is not an Fm9 that happens to contain A♭ C E♭
  const lowest = midis.length ? Math.min(...midis) : undefined;
  const bassC = chord.bass ? chroma(chord.bass) : rootC;
  const lowestIsRoot = lowest !== undefined && mod(lowest, 12) === bassC;
  allowed.add(bassC);
  if (chord.bass && !lowestIsRoot) missing.push("bass");

  const foreign = played.filter((c) => !allowed.has(c));
  return {
    ok: played.length >= 2 && missing.length === 0 && foreign.length === 0,
    missing,
    foreign,
    rootPresent: has(rootC),
    lowestIsRoot,
  };
}

/** One settled chord strike: keys held (never the pedal), at an absolute beat from the top of the chorus. */
export interface Strike {
  beat: number;
  notes: number[];
}

export interface Catch {
  moveId: string;
  ruleId: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  /** The key the tune is in: catches tally per (ruleId, keyTonic), like practice history. */
  keyTonic: string;
  bar: number;
  beat: number;
}

/**
 * Why a candidate move was or wasn't caught:
 * - `active`: the band is already playing it, so playing along is reading, not discovery;
 * - `incomplete`: at least one of its chords had no matching strike;
 * - `same-as-original`: every strike also fits the chart (a rootless D♭7 over G7 is G7alt);
 * - `wrong-shape`: a voicing move's chords were played, but not in its grip;
 * - `outranked`: caught, but an overlapping move explained more of the same strikes.
 */
export type CatchOutcome = "caught" | "active" | "incomplete" | "same-as-original" | "wrong-shape" | "outranked";

export interface CatchAttempt {
  moveId: string;
  ruleId: string;
  outcome: CatchOutcome;
  /** Each of the move's chords and the beat of the strike that matched it, if any. */
  chords: Array<{ symbol: string; strikeBeat?: number }>;
}

export interface CatchTrace {
  catches: Catch[];
  attempts: CatchAttempt[];
}

export interface CatchOptions {
  /** Move ids in the pathway the band is playing: never caught. */
  active?: Iterable<string>;
  /** Precomputed `generateMoves(tune).accepted`, so a live caller needn't regenerate per strike. */
  moves?: ReharmMove[];
}

/** A strike this much before a chord's downbeat belongs to that chord: a pushed change on the and-of-4. */
export const ANTICIPATION_BEATS = 0.5;
/** A chord counts as played only if a strike lands by the and-of-1 (its downbeat + 1 beat, exclusive). */
export const LANDING_BEATS = 1;

/** One-note-on-top is about the melody over the chords, so it's never caught from comping. */
const catchable = (m: ReharmMove) => m.ruleId !== "melody.oneNoteOnTop";

type Grip = { lh: readonly string[]; rh: readonly string[] };

/** Pitch classes bottom to top, each once (its lowest occurrence). */
function pcOrder(notes: readonly number[]): number[] {
  const out: number[] = [];
  for (const m of [...notes].sort((a, b) => a - b)) if (!out.includes(mod(m, 12))) out.push(mod(m, 12));
  return out;
}

/**
 * How a voicing move's grip shows in a strike (the chord itself is checked separately: a voicing
 * move keeps the chart's root, so the shape is the only evidence):
 * - `triad-on-top`: the right hand's triad is the strike's top three pitch classes, in any inversion;
 * - `grip-order`: the grip's pitch classes bottom to top, with the chord's root optional underneath.
 */
const SHAPES: Record<string, "triad-on-top" | "grip-order"> = {
  "voicing.upperStructureBVI": "triad-on-top",
  "voicing.upperStructureII": "triad-on-top",
  "voicing.rootlessTwoFiveOne": "grip-order",
};

export function playsGrip(notes: readonly number[], grip: Grip, kind: "triad-on-top" | "grip-order", root: string): boolean {
  if (kind === "triad-on-top") {
    // read from the top down: the shell's D under a B♭ triad mustn't hide the triad's own D
    const triad = new Set(grip.rh.map(chroma));
    const top = pcOrder(notes.map((m) => -m)).slice(0, 3);
    return top.length === 3 && triad.size === 3 && top.every((c) => triad.has(mod(-c, 12)));
  }
  const order = pcOrder(notes);
  const want = pcOrder(hintMidis(grip));
  const same = (seq: number[]) => seq.length === want.length && seq.every((c, i) => c === want[i]);
  const sorted = [...notes].sort((a, b) => a - b);
  return same(order) || (mod(sorted[0], 12) === chroma(root) && same(pcOrder(sorted.slice(1))));
}

/** A hint's notes stacked upward in the order written (LH then RH), as the Coach lays them out. */
function hintMidis(grip: Grip): number[] {
  let prev = 35;
  return [...grip.lh, ...grip.rh].map((n) => (prev = prev + 1 + mod(chroma(n) - (prev + 1), 12)));
}

/**
 * Which of the tune's own moves did these strikes play, unasked? A move is caught when every one
 * of its chords has a matching strike in its window, and at least one of those strikes is something
 * the chart's chord can't explain: it doesn't fit, or only the move puts its root in the bass.
 * Overlapping catches keep the move with the most chords, then the higher level, then rule order.
 * This is the catcher: `catchMoves` is this with the trace dropped.
 */
export function catchMovesTraced(tune: Tune, strikes: readonly Strike[], opts: CatchOptions = {}): CatchTrace {
  const bpb = tune.meter[0];
  const harmony = sortedHarmony(tune);
  const total = Math.max(0, ...harmony.map((c) => absBeat(c.at, bpb) + c.beats));
  const active = new Set(opts.active ?? []);
  // a push in the last eighth of the chorus belongs to bar 1 of the next
  const played = strikes.map((s) => (total && s.beat >= total - ANTICIPATION_BEATS ? { ...s, beat: s.beat - total } : s));
  const inWindow = (beat: number, c: { at: ChordEvent["at"]; beats: number }) => {
    const start = absBeat(c.at, bpb) - ANTICIPATION_BEATS;
    return beat >= start && beat < start + c.beats;
  };
  const chartAt = (beat: number) => harmony.find((c) => inWindow(beat, c));

  const attempts: CatchAttempt[] = [];
  const candidates: Array<{ move: ReharmMove; attempt: CatchAttempt; rooted: number }> = [];
  for (const move of (opts.moves ?? generateMoves(tune).accepted).filter(catchable)) {
    const attempt: CatchAttempt = { moveId: move.id, ruleId: move.ruleId, outcome: "incomplete", chords: [] };
    attempts.push(attempt);
    if (active.has(move.id)) {
      attempt.outcome = "active";
      continue;
    }
    let missed = false; // a chord with no strike that spells it
    let claimed = false; // a chord whose strikes spell it, but the chart's chord too, with no bass to tell them apart
    let misshaped = false; // a voicing move's chord played, but not in its grip
    let distinct = false;
    let rooted = 0;
    const shape = SHAPES[move.ruleId];
    for (const [i, c] of move.chords.entries()) {
      if (shape) {
        // a voicing move keeps the chart's root: the chord must hold, and the grip is the evidence
        const grip = move.voicingHints?.[i] ?? move.voicingHint;
        const under = played.filter((s) => inWindow(s.beat, c));
        const lands = under.some((s) => s.beat < absBeat(c.at, bpb) + LANDING_BEATS);
        const spelled = lands && under.every((s) => matchChord(s.notes, c).ok);
        const shaped = spelled && grip ? under.find((s) => playsGrip(s.notes, grip, shape, c.root)) : undefined;
        attempt.chords.push({ symbol: symbol(c), strikeBeat: (shaped ?? (spelled ? under[0] : undefined))?.beat });
        if (!spelled) missed = true;
        else if (!shaped) misshaped = true;
        continue;
      }
      // The change must land (first strike by the and-of-1) and hold: every strike under the chord
      // fits it, so one E♭9 late in a bar of C7 isn't four beats of A7(♭9).
      // A strike that also fits the chart's chord counts for a move chord on another root only
      // when the move's root is in the bass: C7 over C7 isn't G♭13(♯11), however well it fits.
      const verdict = (s: Strike) => {
        const asMove = matchChord(s.notes, c);
        const chart = chartAt(s.beat);
        // the chart's slash bass is the bassist's line: E7 comped over a G♯ bass is still the chart's E7
        const asChart = chart && matchChord(s.notes, { ...chart, bass: undefined });
        const tells = !asChart || !asChart.ok || (asMove.lowestIsRoot && !asChart.lowestIsRoot);
        const sameRoot = !!chart && chroma(chart.root) === chroma(c.bass ?? c.root);
        return { fits: asMove.ok && (tells || sameRoot), tells, rooted: asMove.lowestIsRoot };
      };
      const under = played.filter((s) => inWindow(s.beat, c));
      const lands = under.some((s) => s.beat < absBeat(c.at, bpb) + LANDING_BEATS);
      const spelled = lands && under.every((s) => matchChord(s.notes, c).ok);
      const hits = spelled && under.every((s) => verdict(s).fits) ? under : [];
      const telling = hits.find((s) => verdict(s).tells);
      attempt.chords.push({ symbol: symbol(c), strikeBeat: (telling ?? hits[0])?.beat });
      if (!spelled) missed = true;
      else if (!hits.length) claimed = true;
      if (telling) distinct = true;
      if (hits.some((s) => verdict(s).rooted)) rooted++;
    }
    if (missed) continue;
    if (shape) {
      if (misshaped) attempt.outcome = "wrong-shape";
      else candidates.push({ move, attempt, rooted: 0 });
      continue;
    }
    if (claimed || !distinct) {
      attempt.outcome = "same-as-original";
      continue;
    }
    candidates.push({ move, attempt, rooted });
  }

  // F–A♭–C–E♭–G is both Fm9 and B♭9sus: with F underneath, the move that calls it Fm9 wins
  candidates.sort(
    (a, b) =>
      b.move.chords.length - a.move.chords.length ||
      b.rooted - a.rooted ||
      b.move.level - a.move.level ||
      a.move.priority - b.move.priority,
  );
  const kept: ReharmMove[] = [];
  for (const { move, attempt } of candidates) {
    const overlaps = kept.some((k) => move.spanBeats.start < k.spanBeats.end && k.spanBeats.start < move.spanBeats.end);
    attempt.outcome = overlaps ? "outranked" : "caught";
    if (!overlaps) kept.push(move);
  }

  const catches = kept
    .sort((a, b) => a.spanBeats.start - b.spanBeats.start)
    .map((m) => ({ moveId: m.id, ruleId: m.ruleId, title: m.title, level: m.level, keyTonic: tune.key.tonic, bar: m.span.from.bar, beat: m.span.from.beat }));
  return { catches, attempts };
}

export function catchMoves(tune: Tune, strikes: readonly Strike[], opts: CatchOptions = {}): Catch[] {
  return catchMovesTraced(tune, strikes, opts).catches;
}
