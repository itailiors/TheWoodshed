import { chordTones, guideTones, symbol, type ChordTone } from "./chords";
import { classifyNote } from "./melody";
import { chroma, mod, prettyNote, spellChroma } from "./pitch";
import { sortedHarmony } from "./time";
import type { ChordEvent, ReharmMove, Tune } from "./types";
import { voiceChord, voiceProgression, type Voicing } from "./voicing";

/** One chord the player has to strike, with the engine's reference voicing. */
export interface DrillStep {
  chord: ChordEvent;
  symbol: string;
  target: Voicing;
  /** The notes that make the chord what it is: 3rd (or sus 4th) and 7th. */
  required: ChordTone[];
  /** Alterations and extensions that are in the reference voicing. */
  colors: ChordTone[];
  /** True for the chord the move resolves into (not part of the move itself). */
  resolution: boolean;
}

/** Turn a hint like {lh:[G,F,B], rh:[Eb,G,Bb]} into MIDI: LH from the bass register up, RH stacked above. */
export function hintToVoicing(hint: { lh: string[]; rh: string[] }): Voicing {
  const up = (names: string[], floor: number) => {
    let prev = floor - 1;
    return names.map((n) => {
      const c = chroma(n);
      const m = prev + 1 + mod(c - (prev + 1), 12);
      prev = m;
      return m;
    });
  };
  const lh = up(hint.lh, 38);
  const rh = up(hint.rh, Math.max(lh[lh.length - 1] + 1, 55));
  return { bass: lh[0], upper: [...lh.slice(1), ...rh] };
}

/** The progression a move asks you to play: its chords plus the chord it resolves into. */
export function drillSteps(tune: Tune, move: ReharmMove): DrillStep[] {
  const all = sortedHarmony(tune);
  const before = all.filter((c) => c.at.bar < move.span.from.bar || (c.at.bar === move.span.from.bar && c.at.beat < move.span.from.beat)).pop();
  const target = all.find((c) => c.at.bar === move.span.to.bar && c.at.beat === move.span.to.beat);
  const chords = [...move.chords, ...(target ? [target] : [])];
  const seed = before ? voiceChord(before) : undefined;
  const voicings: Voicing[] = [];
  chords.forEach((c, i) => {
    const prev = voicings[i - 1] ?? seed;
    voicings.push(i === 0 && move.voicingHint ? hintToVoicing(move.voicingHint) : voiceChord(c, prev));
  });
  return chords.map((c, i) => {
    const tones = chordTones(c);
    const upperPcs = new Set(voicings[i].upper.map((m) => mod(m, 12)));
    return {
      chord: c,
      symbol: symbol(c),
      target: voicings[i],
      required: guideTones(c),
      colors: tones.filter((t) => !["1", "3", "b3", "4", "5", "b7", "7", "bb7", "6"].includes(t.degree) && upperPcs.has(chroma(t.note))),
      resolution: !!target && i === chords.length - 1,
    };
  });
}

export interface ToneCheck {
  degree: string;
  note: string;
  present: boolean;
  /** Where that note sits in the reference voicing (where the red pen should circle). */
  targetMidi: number;
}

export interface WrongNote {
  midi: number;
  name: string;
  why: string;
}

export interface StrikeDiff {
  played: number[];
  bass: { expected: string; played: string | null; ok: boolean; rootless: boolean };
  guideTones: ToneCheck[];
  colors: ToneCheck[];
  wrongNotes: WrongNote[];
  /** Same pitch classes as the reference voicing (octaves may differ). */
  matchesTarget: boolean;
  verdict: "perfect" | "correct" | "incomplete" | "wrong";
  comments: string[];
}

const BASS_SPLIT = 55; // notes below G3 count as left-hand bass

const degreeWord = (d: string) =>
  ({ "3": "3rd", b3: "♭3rd", "4": "sus 4th", "7": "maj 7th", b7: "♭7th", bb7: "°7th", "6": "6th" })[d] ?? prettyNote(d);

function nearestInVoicing(target: Voicing, pc: number): number {
  const all = [target.bass, ...target.upper];
  return all.find((m) => mod(m, 12) === pc) ?? target.upper[0] + mod(pc - target.upper[0], 12);
}

/**
 * Compare a struck chord (MIDI notes) with a drill step. Pitch classes are what
 * count: any inversion of the right notes is "correct", and the exact reference
 * voicing is "perfect". Rootless voicings are accepted.
 */
export function diffStrike(playedRaw: number[], step: DrillStep): StrikeDiff {
  const played = [...new Set(playedRaw)].sort((a, b) => a - b);
  const pcs = new Set(played.map((m) => mod(m, 12)));
  const chord = step.chord;
  const bassName = chord.bass ?? chord.root;
  const tones = chordTones(chord);
  const spell = (m: number) => tones.find((t) => chroma(t.note) === mod(m, 12))?.note ?? spellChroma(m);

  const lowest = played[0];
  const hasBass = lowest !== undefined && (lowest < BASS_SPLIT || played.length >= 2);
  const bassOk = lowest !== undefined && mod(lowest, 12) === chroma(bassName);
  const rootless = !bassOk && lowest !== undefined && tones.some((t) => chroma(t.note) === mod(lowest, 12));

  const check = (t: ChordTone): ToneCheck => ({
    degree: t.degree,
    note: t.note,
    present: pcs.has(chroma(t.note)),
    targetMidi: nearestInVoicing(step.target, chroma(t.note)),
  });
  const guide = step.required.map(check);
  const colors = step.colors.map(check);

  // anything outside the chord, its reference colours and the usual 9/13 is a wrong note
  const allowed = new Set([
    ...tones.map((t) => chroma(t.note)),
    ...[step.target.bass, ...step.target.upper].map((m) => mod(m, 12)),
  ]);
  const wrongNotes: WrongNote[] = played
    .filter((m) => !allowed.has(mod(m, 12)))
    .map((m) => {
      const name = spellChroma(m);
      const cls = classifyNote({ ...chord, display: undefined }, name);
      const why =
        cls.verdict === "avoid"
          ? `${prettyNote(name)} is an avoid note here (${prettyNote(cls.role)})`
          : `${prettyNote(name)} isn't in ${prettyNote(step.symbol)}`;
      return { midi: m, name, why };
    });

  const targetPcs = new Set([step.target.bass, ...step.target.upper].map((m) => mod(m, 12)));
  const upperPcs = new Set(played.filter((m) => m !== lowest || !hasBass).map((m) => mod(m, 12)));
  const matchesTarget =
    [...targetPcs].every((c) => pcs.has(c)) && [...pcs].every((c) => targetPcs.has(c)) && step.target.upper.every((m) => upperPcs.has(mod(m, 12)));

  const missingGuide = guide.filter((g) => !g.present);
  const comments: string[] = [];
  for (const g of missingGuide) comments.push(`Missing the ${degreeWord(g.degree)} (${prettyNote(g.note)}). That's what makes it ${prettyNote(step.symbol)}.`);
  for (const w of wrongNotes) comments.push(w.why);
  const missingColors = colors.filter((c) => !c.present);
  if (!missingGuide.length && !wrongNotes.length && missingColors.length) {
    comments.push(`Right chord. Add the ${missingColors.map((c) => prettyNote(c.degree)).join(" and ")} for the full colour.`);
  }
  if (rootless && !missingGuide.length) comments.push("Rootless voicing. Fine, the bass player has the root.");

  const verdict: StrikeDiff["verdict"] = wrongNotes.length
    ? "wrong"
    : missingGuide.length
      ? "incomplete"
      : matchesTarget && (bassOk || rootless)
        ? "perfect"
        : "correct";

  return {
    played,
    bass: { expected: bassName, played: lowest !== undefined ? spell(lowest) : null, ok: bassOk, rootless },
    guideTones: guide,
    colors,
    wrongNotes,
    matchesTarget,
    verdict,
    comments,
  };
}

export interface VoiceLeadingDiff {
  /** Semitone moves of your upper voices, paired bottom-to-top. */
  moves: number[];
  maxLeap: number;
  total: number;
  /** Total movement of the engine's reference voicings for the same change. */
  ideal: number;
  smooth: boolean;
  comment: string;
}

/** How smoothly did the right hand move between two strikes? */
export function diffVoiceLeading(prevPlayed: number[], played: number[], prevStep: DrillStep, step: DrillStep): VoiceLeadingDiff {
  const upper = (ns: number[]) => {
    const s = [...ns].sort((a, b) => a - b);
    return s.length > 1 && s[0] < BASS_SPLIT ? s.slice(1) : s;
  };
  const a = upper(prevPlayed);
  const b = upper(played);
  const moves = b.map((n) => {
    const nearest = a.reduce((best, m) => (Math.abs(m - n) < Math.abs(best - n) ? m : best), a[0] ?? n);
    return n - nearest;
  });
  const maxLeap = Math.max(0, ...moves.map(Math.abs));
  const total = moves.reduce((s, m) => s + Math.abs(m), 0);
  const ideal = step.target.upper.reduce(
    (s, n) => s + Math.min(...prevStep.target.upper.map((m) => Math.abs(m - n))),
    0,
  );
  const smooth = maxLeap <= 2;
  const comment = smooth
    ? `Smooth: no voice moved more than ${maxLeap} semitone${maxLeap === 1 ? "" : "s"}.`
    : `One voice jumped ${maxLeap} semitones. Look for a closer inversion (the engine's moves ${ideal} semitones in total).`;
  return { moves, maxLeap, total, ideal, smooth, comment };
}
