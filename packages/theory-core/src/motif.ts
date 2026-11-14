import { chordTones, guideTones, symbol } from "./chords";
import { chordAtBeat, evaluateLineNote, type LineNoteEval } from "./lineEval";
import { chroma, mod, pitchClass, prettyNote, prettySymbol } from "./pitch";
import { suggestScales } from "./scales";
import { melodyIn } from "./time";
import type { ChordEvent, Tune } from "./types";
import {
  selectLyricalMelodyLick,
  selectVocabularyLick,
  snapLickPitchToChord,
  type GhostLick,
  type LickEnergy,
} from "./vocabulary";
import { voiceChord, type Voicing } from "./voicing";

/**
 * Deterministic Call-and-Response Motif Transformer ("Trading Fours with a Ghost Master").
 * Combines six layers of jazz intelligence:
 * 1. Rhythmic Density Matching & Proportional Silence Cap (`maxGhostGap <= 1.2 * maxUserGap`)
 * 2. Harmonic Mentor Correction (hears user clinkers and plays the phrase back resolved to guide/chord tones)
 * 3. Swing & Charleston Groove Engine (`swingifyEvents` — pulls straight 8ths into the 2/3 swing pocket)
 * 4. Classic & Lyrical Vocabulary Bank (`vocabulary.ts` — Bird, Trane, Brownie, Red Garland, Chet Baker, Stan Getz, Bill Evans, Miles)
 * 5. Deterministic Pacing Engine (`getGhostPacing` — rotates between "echo", "prompt", and "space")
 * 6. Dynamic Hairpin & Contour Shaping Engine (`shapeDynamics`)
 */

export type GhostPersonality = "side-slipper" | "bebop-encloser" | "block-harmonizer";
export type GhostPacing = "echo" | "prompt" | "space";
export type TradeSpan = 0 | 2 | 4;

export interface GhostPersonalityMeta {
  id: GhostPersonality;
  label: string;
  master: string;
  blurb: string;
}

export const GHOST_PERSONALITIES: readonly GhostPersonalityMeta[] = [
  {
    id: "side-slipper",
    label: "Side-Slipper",
    master: "Herbie / McCoy",
    blurb: "Planes your motif up a half-step before resolving into the target chord's guide tone.",
  },
  {
    id: "bebop-encloser",
    label: "Bebop Encloser",
    master: "Bud / Barry Harris",
    blurb: "Transposes your motif to a guide tone and wraps a diatonic-above / chromatic-below enclosure around the resolution.",
  },
  {
    id: "block-harmonizer",
    label: "Block Harmonizer",
    master: "Bill Evans / Shearing",
    blurb: "Locks your melody as the top voice of voiceChord() and answers in 4-way close block chords.",
  },
] as const;

export interface MotifNoteInput {
  midi: number;
  /** Absolute beat from the top of the form (0-based). */
  start: number;
  /** Absolute end beat (or null if still held when the call window ended). */
  end: number | null;
}

export interface SeedNote {
  relStart: number;
  dur: number;
  midi: number;
  /** True if the user's original note was `avoid` or `outside` and was harmonically corrected by the Ghost Mentor. */
  wasCorrected?: boolean;
}

export interface ExtractedSeedMotif {
  seed: SeedNote[];
  /** Notes per bar played by the user during the call window. */
  density: number;
  /** Matched energy tier (>4 notes/bar = "dense", otherwise "sparse"). */
  energy: LickEnergy;
  /** Maximum consecutive silence (in beats) between notes in the user's call phrase (`x`). */
  maxUserGapBeats: number;
  /** Maximum allowed consecutive silence in the Ghost's answer (`1.2 * x`). */
  maxAllowedGapBeats: number;
  /** Number of avoid/outside notes in the user's call that the Ghost Mentor resolved onto guide/chord tones. */
  correctedCount: number;
  /** Ratio (0..1) of harmonically strong notes (chord tones + sweet tensions) in the user's call. */
  accuracy: number;
}

export interface GhostNote {
  /** Primary melodic MIDI pitch (top voice for block-harmonizer). */
  midi: number;
  /** All MIDI pitches sounded on this event (1 note for single-line masters, 4–5 notes for block-harmonizer). */
  voicing: number[];
  /** Absolute start beat in the response window. */
  start: number;
  /** Absolute end beat in the response window. */
  end: number;
  /** Shaped MIDI velocity (0..1): ghosted enclosures (~0.48), standard (0.65), syncopated off-beats (~0.74), contour peak (0.86). */
  vel: number;
  /** Chord symbol sounding at `start`. */
  chordSymbol: string;
  /** Harmonic evaluation of `midi` against the underlying chord. */
  ev: LineNoteEval;
  /** True when the note resolves onto a guide tone (3rd or 7th). */
  landing: boolean;
  /** True for chromatic side-slip or enclosure approach tones. */
  enclosure: boolean;
  /** Musician-facing description of how this note was derived. */
  tag: string;
}

export interface GhostResponse {
  personality: GhostPersonality;
  pacing: GhostPacing;
  density: number;
  maxAllowedGapBeats: number;
  correctedCount: number;
  lick?: GhostLick;
  batonPass: boolean;
  callStartBeat: number;
  callEndBeat: number;
  respStartBeat: number;
  respEndBeat: number;
  notes: GhostNote[];
  summary: string;
}

export interface TransformMotifArgs {
  notes: MotifNoteInput[];
  personality: GhostPersonality;
  tune: Tune;
  chords: ChordEvent[];
  callStartBeat: number;
  callEndBeat: number;
  respStartBeat: number;
  respEndBeat: number;
  /** Continuous phrase index across chorus boundaries; drives `getGhostPacing()` and vocabulary selection. */
  continuousPhraseIdx?: number;
}

const SOLO_LOW = 58; // Bb3
const SOLO_HIGH = 84; // C6
const MAX_STANDARD_NOTES = 8;
const MAX_DENSE_NOTES = 12;
const GAP_MULTIPLIER = 1.2;

const PACING_ROTATION: readonly GhostPacing[] = ["echo", "prompt", "space"] as const;

/**
 * Deterministic Pacing Engine: rotates through the three conversational modes based on
 * `continuousPhraseIdx`. Because `gcd(2, 3) === 1`, this visits every mode ("echo", "prompt",
 * "space") both when indexed sequentially (0, 1, 2) and when called on odd Ghost turns (1, 3, 5).
 */
export function getGhostPacing(continuousPhraseIdx: number): GhostPacing {
  return PACING_ROTATION[mod(Math.floor(continuousPhraseIdx), PACING_ROTATION.length)];
}

/** Fold a MIDI note into the playable right-hand solo register [SOLO_LOW, SOLO_HIGH]. */
function clampRegister(midi: number): number {
  let m = midi;
  while (m < SOLO_LOW) m += 12;
  while (m > SOLO_HIGH) m -= 12;
  return m;
}

/** Find the MIDI pitch with pitch-class `targetPc` closest to `refMidi` within the solo register. */
function nearestPitchWithPc(refMidi: number, targetPc: number): number {
  const base = clampRegister(refMidi);
  let best = base;
  let bestDist = Infinity;
  for (let m = SOLO_LOW; m <= SOLO_HIGH; m++) {
    if (mod(m, 12) !== mod(targetPc, 12)) continue;
    const dist = Math.abs(m - base);
    if (dist < bestDist) {
      bestDist = dist;
      best = m;
    }
  }
  return best;
}

/** Pick the primary guide-tone pitch class (3rd or 7th, fallback to root) of `chord` nearest `refMidi`. */
function targetGuideToneMidi(chord: ChordEvent, refMidi: number): { midi: number; degree: string } {
  const gts = guideTones(chord);
  if (gts.length === 0) {
    return { midi: nearestPitchWithPc(refMidi, chroma(chord.root)), degree: "1" };
  }
  let best = { midi: nearestPitchWithPc(refMidi, chroma(gts[0].note)), degree: gts[0].degree };
  let bestDist = Math.abs(best.midi - clampRegister(refMidi));
  for (const g of gts) {
    const candidate = nearestPitchWithPc(refMidi, chroma(g.note));
    const dist = Math.abs(candidate - clampRegister(refMidi));
    if (dist < bestDist) {
      bestDist = dist;
      best = { midi: candidate, degree: g.degree };
    }
  }
  return best;
}

/** Next diatonic scale step above `targetMidi` over `chord` (1 or 2 semitones up). */
function diatonicStepAbove(targetMidi: number, chord: ChordEvent, next?: ChordEvent): number {
  const scale = suggestScales(chord, next)[0];
  const pcs = scale ? scale.notes.map((n) => chroma(n)) : chordTones(chord).map((t) => chroma(t.note));
  for (let step = 1; step <= 3; step++) {
    if (pcs.includes(mod(targetMidi + step, 12))) return targetMidi + step;
  }
  return targetMidi + 2;
}

/**
 * Snap an avoid or outside pitch to the nearest guide tone (3rd/7th) or chord tone so the
 * Ghost Master corrects out-of-key user notes into idiomatic jazz harmony.
 */
function snapAvoidToScale(midi: number, chord: ChordEvent, next?: ChordEvent, preferGuide = false): number {
  const ev = evaluateLineNote(midi, chord, next);
  if (!preferGuide && ev.verdict !== "avoid" && ev.verdict !== "outside") return midi;

  // First try snapping by 1–2 semitones directly onto a guide tone (3rd or 7th)
  const gts = new Set(guideTones(chord).map((g) => chroma(g.note)));
  for (const delta of [1, -1, 2, -2]) {
    if (gts.has(mod(midi + delta, 12))) return clampRegister(midi + delta);
  }

  // Next try any chord tone or non-avoid scale tone
  const scale = suggestScales(chord, next)[0];
  const allowed = new Set<number>([
    ...chordTones(chord).map((t) => chroma(t.note)),
    ...(scale ? scale.notes.filter((n) => !scale.avoid.includes(n)).map((n) => chroma(n)) : []),
  ]);
  for (const delta of [1, -1, 2, -2, 3, -3]) {
    if (allowed.has(mod(midi + delta, 12))) return clampRegister(midi + delta);
  }
  return clampRegister(midi);
}

/** Build a locked-hands block chord with `melodyMidi` as the top voice using `voiceChord`. */
function harmonizeMelodyNote(
  melodyMidi: number,
  chord: ChordEvent,
  prevVoicing?: Voicing,
): { voicing: number[]; rawVoicing: Voicing } {
  const v = voiceChord(chord, prevVoicing);
  const top = clampRegister(melodyMidi);
  const lowerPcs = v.upper
    .map((m) => mod(m, 12))
    .filter((pc) => pc !== mod(top, 12));
  const closeBelow = lowerPcs
    .map((pc) => {
      const stepDown = mod(top - pc, 12) || 12;
      return top - stepDown;
    })
    .sort((a, b) => a - b);
  const full = [...new Set([v.bass, ...closeBelow, top])].sort((a, b) => a - b);
  return { voicing: full, rawVoicing: v };
}

/**
 * Extract the rhythmic and melodic core of the user's call phrase, computing:
 * - `density` (notes per bar) and `energy` ("dense" vs "sparse")
 * - `maxUserGapBeats` (`x`) and `maxAllowedGapBeats` (`1.2 * x`) so the Ghost never leaves
 *   consecutive empty space larger than `1.2x` of the user's own phrasing
 * - `correctedCount`: resolves any user `avoid` or `outside` clinkers onto the active chord's
 *   guide tones/chord tones so the Ghost Master models the corrected line back to the user.
 */
export function extractSeedMotif(
  notes: MotifNoteInput[],
  callStartBeat: number,
  callEndBeat: number,
  chords: ChordEvent[],
  bpb: number,
): ExtractedSeedMotif {
  const span = Math.max(1, callEndBeat - callStartBeat);
  const callBars = Math.max(1, span / Math.max(1, bpb));
  const inCall = notes
    .filter((n) => {
      const end = n.end ?? callEndBeat;
      return n.start < callEndBeat - 0.05 && end > callStartBeat + 0.05;
    })
    .sort((a, b) => a.start - b.start || b.midi - a.midi);

  const density = Number((inCall.length / callBars).toFixed(2));
  const isDense = density > 4;
  const isSparse = inCall.length > 0 && density <= 2;
  const energy: LickEnergy = isDense ? "dense" : "sparse";

  // Deduplicate simultaneous or rolled chord strikes (within 0.12 beats) to keep only the top melodic note
  // so playing multiple notes at the same time never piles up overlapping Ghost notes.
  const monophonic: MotifNoteInput[] = [];
  const dedupWindow = 0.12;
  for (const n of inCall) {
    const prev = monophonic[monophonic.length - 1];
    if (prev && Math.abs(n.start - prev.start) < dedupWindow) continue;
    monophonic.push(n);
  }

  // Recompute effective monophonic density (distinct melodic attacks per bar)
  const monoDensity = Number((monophonic.length / callBars).toFixed(2));
  const isMonoDense = monoDensity > 4;

  // Measure the user's maximum consecutive silent space `x` between notes in their phrase
  let maxUserGapBeats = 1.0;
  if (monophonic.length >= 2) {
    let largestInternalGap = 0;
    for (let i = 0; i < monophonic.length - 1; i++) {
      const curEnd = monophonic[i].end !== null ? Math.min(callEndBeat, monophonic[i].end!) : monophonic[i].start + 0.5;
      const gap = Math.max(0, monophonic[i + 1].start - curEnd);
      if (gap > largestInternalGap) largestInternalGap = gap;
    }
    // Floor at 0.45 beats so legato playing still allows natural breath articulation, cap at 2.0 beats
    maxUserGapBeats = Number(Math.max(0.45, Math.min(2.0, largestInternalGap || 0.65)).toFixed(2));
  } else if (monophonic.length === 1) {
    const n = monophonic[0];
    const dur = (n.end !== null ? Math.min(callEndBeat, n.end) : n.start + 1.0) - n.start;
    maxUserGapBeats = Number(Math.max(0.6, Math.min(1.8, Math.max(0.8, dur))).toFixed(2));
  }
  const maxAllowedGapBeats = Number((maxUserGapBeats * GAP_MULTIPLIER).toFixed(2));

  const maxNotes = isMonoDense ? MAX_DENSE_NOTES : MAX_STANDARD_NOTES;
  const picked = monophonic.slice(-maxNotes);
  if (picked.length > 0) {
    const firstOffset = Math.max(0, picked[0].start - callStartBeat);
    const timeScale = isMonoDense ? 0.75 : isSparse ? 1.2 : 1.0;
    const minStep = isMonoDense ? 0.25 : 0.3;
    let correctedCount = 0;
    let prevRelStart = -minStep;

    const baseSeed: SeedNote[] = [];
    for (let i = 0; i < picked.length; i++) {
      const n = picked[i];
      const rawShifted = Math.max(0, n.start - callStartBeat - firstOffset) * timeScale;
      const relStart = Math.max(prevRelStart + minStep, rawShifted);
      // Drop notes that would pile up past the end of the call window
      if (relStart >= span - 0.2) break;
      prevRelStart = relStart;

      const rawEnd = n.end !== null ? Math.min(callEndBeat, n.end) : callEndBeat;
      const nextRawShifted =
        i + 1 < picked.length
          ? Math.max(relStart + minStep, (picked[i + 1].start - callStartBeat - firstOffset) * timeScale)
          : span;
      const stepToNext = Math.max(minStep, nextRawShifted - relStart);
      const rawDur = (rawEnd - n.start) * timeScale;
      // When notes are rapid/dense (stepToNext <= 0.75 beats), use crisp detached articulation (72% of step, no legato!)
      const articulationRatio = stepToNext <= 0.75 ? 0.72 : 0.85;
      const minDur = stepToNext <= 0.75 ? 0.16 : isSparse ? 0.6 : 0.22;
      const maxDur = isMonoDense ? 0.5 : isSparse ? 1.8 : 1.4;
      const dur = Math.max(minDur, Math.min(maxDur, rawDur, stepToNext * articulationRatio));

      // Evaluate whether the user's note was harmonically off (`avoid` or `outside`) on the call chord
      const callAt = chordAtBeat(chords, n.start, bpb) ?? { chord: chords[0], next: chords[1] };
      const rawClamped = clampRegister(n.midi);
      const ev = evaluateLineNote(rawClamped, callAt.chord, callAt.next);
      let midi = rawClamped;
      let wasCorrected = false;
      if (ev.verdict === "avoid" || ev.verdict === "outside") {
        midi = snapAvoidToScale(rawClamped, callAt.chord, callAt.next, true);
        wasCorrected = midi !== rawClamped;
        if (wasCorrected) correctedCount++;
      }

      baseSeed.push({ relStart, dur, midi, wasCorrected });
    }

    const accuracy = Number(((picked.length - correctedCount) / picked.length).toFixed(2));

    return {
      seed: baseSeed,
      density: monoDensity,
      energy: isMonoDense ? "dense" : energy,
      maxUserGapBeats,
      maxAllowedGapBeats,
      correctedCount,
      accuracy,
    };
  }

  // Fallback seed when the user rests during the call: a 3-note swung motif over the call's first chord
  const firstChord = chordAtBeat(chords, callStartBeat, bpb)?.chord ?? chords[0];
  const tones = chordTones(firstChord);
  const rootMidi = clampRegister(60 + chroma(firstChord.root));
  const thirdMidi = tones[1] ? nearestPitchWithPc(rootMidi + 3, chroma(tones[1].note)) : rootMidi + 4;
  const fifthMidi = tones[2] ? nearestPitchWithPc(thirdMidi + 3, chroma(tones[2].note)) : rootMidi + 7;
  return {
    seed: [
      { relStart: 0, dur: 0.64, midi: rootMidi },
      { relStart: 2 / 3, dur: 0.64, midi: thirdMidi },
      { relStart: 1 + 2 / 3, dur: 0.95, midi: fifthMidi },
    ],
    density: 0,
    energy: "sparse",
    maxUserGapBeats: 1.0,
    maxAllowedGapBeats: 1.2,
    correctedCount: 0,
    accuracy: 1,
  };
}

export interface RawEvent {
  midi: number;
  voicing?: number[];
  start: number;
  end: number;
  vel: number;
  enclosure: boolean;
  tag: string;
}

/**
 * Swing & Groove Quantizer:
 * - Pulls straight 8th off-beats (`0.42..0.58`) into the authentic `2/3` (`0.667`) triplet swing pocket.
 * - Syncopates consecutive flat downbeats with Charleston `"&"` anticipations so lines groove.
 * - Shapes long-short jazz articulation (legato downbeat into crisp accented offbeat).
 */
export function swingifyEvents(
  events: RawEvent[],
  tune: Tune,
  respStartBeat: number,
  respEndBeat: number,
): RawEvent[] {
  const swung = tune.feel === "swing" || tune.feel === "waltz";
  if (!swung || events.length === 0) return events;

  const sorted = [...events].sort((a, b) => a.start - b.start);
  let consecutiveDownbeats = 0;

  const swungStarts = sorted.map((e, idx) => {
    const whole = Math.floor(e.start + 1e-6);
    const frac = e.start - whole;
    let newStart = e.start;

    if (frac >= 0.42 && frac <= 0.58) {
      // Pull straight 8th-note offbeat into the 2/3 swing pocket
      newStart = whole + 2 / 3;
      consecutiveDownbeats = 0;
    } else if (frac < 0.1 || frac > 0.92) {
      consecutiveDownbeats++;
      // If 2+ notes in a row sit flat on the beat (after beat 0), push alternating notes onto the swung "&"
      if (idx > 0 && consecutiveDownbeats >= 2 && idx < sorted.length - 1) {
        const candidate = Math.round(e.start) - 1 / 3;
        const prevStart = sorted[idx - 1].start;
        if (candidate > prevStart + 0.25 && candidate >= respStartBeat) {
          newStart = candidate;
          consecutiveDownbeats = 0;
        } else if (Math.round(e.start) + 2 / 3 < sorted[idx + 1].start - 0.2) {
          newStart = Math.round(e.start) + 2 / 3;
          consecutiveDownbeats = 0;
        }
      }
    } else {
      consecutiveDownbeats = 0;
    }

    return {
      ...e,
      start: Number(Math.max(respStartBeat, Math.min(respEndBeat - 0.2, newStart)).toFixed(3)),
    };
  });

  // Re-adjust durations with crisp, non-overlapping articulation (no legato stretching on rapid notes)
  return swungStarts.map((e, idx) => {
    const nextStart = idx + 1 < swungStarts.length ? swungStarts[idx + 1].start : respEndBeat;
    const stepToNext = Math.max(0.2, nextStart - e.start);
    const rawDur = Math.max(0.16, e.end - e.start);
    const frac = mod(e.start, 1);
    const isSwungOffbeat = frac >= 0.58 && frac <= 0.75;
    // Never stretch short notes into legato; keep a clean articulation gap before the next attack
    const maxNonLegatoDur = stepToNext <= 0.75 ? stepToNext * 0.72 : stepToNext - 0.12;
    const targetDur = isSwungOffbeat ? Math.min(rawDur, 0.48, maxNonLegatoDur) : Math.min(rawDur, maxNonLegatoDur);
    const end = Number(Math.min(respEndBeat, e.start + Math.max(0.14, targetDur)).toFixed(3));
    return { ...e, end };
  });
}

/**
 * Guarantees strictly monophonic, non-overlapping Ghost Master events with crisp detached
 * articulation on rapid passages so simultaneous or fast notes never overlap or slur together.
 */
export function deoverlapEvents(
  events: RawEvent[],
  respStartBeat: number,
  respEndBeat: number,
): RawEvent[] {
  if (events.length === 0) return events;
  const sorted = [...events].sort((a, b) => a.start - b.start || b.midi - a.midi);

  // 1. Space out or deduplicate any events whose attack times collided within < 0.22 beats
  const spaced: RawEvent[] = [];
  const minAttackStep = 0.22;
  for (const e of sorted) {
    const prev = spaced[spaced.length - 1];
    if (prev && e.start - prev.start < minAttackStep) {
      const pushedStart = Number((prev.start + minAttackStep).toFixed(3));
      if (pushedStart >= respEndBeat - 0.18) continue;
      const dur = Math.max(0.15, e.end - e.start);
      spaced.push({
        ...e,
        start: pushedStart,
        end: Number(Math.min(respEndBeat, pushedStart + dur).toFixed(3)),
      });
    } else {
      spaced.push({ ...e });
    }
  }

  // 2. Enforce a crisp non-legato articulation gap before every subsequent attack
  return spaced.map((e, idx) => {
    const nextStart = idx + 1 < spaced.length ? spaced[idx + 1].start : respEndBeat;
    const step = nextStart - e.start;
    // Rapid notes (step <= 0.8 beats) get a 28% detached breath gap; longer notes get at least 0.12 beats separation
    const minGap = step <= 0.8 ? Math.max(0.07, step * 0.28) : 0.12;
    const maxEnd = Math.max(e.start + 0.12, nextStart - minGap);
    const end = Number(Math.min(respEndBeat, e.end, maxEnd).toFixed(3));
    return { ...e, end };
  });
}

/**
 * Enforce the `1.2x` Consecutive Silence Cap across `[respStartBeat, respEndBeat)`:
 * If any internal gap between Ghost notes or trailing gap before `respEndBeat` exceeds
 * `maxAllowedGap` (`1.2 * maxUserGapBeats`), bridges the gap with swung chord-tone/guide-tone
 * continuation phrases and a turnaround handoff so the Ghost never leaves dead air larger than `1.2x`.
 */
function enforceMaxSilenceGap(
  events: RawEvent[],
  maxAllowedGap: number,
  personality: GhostPersonality,
  tune: Tune,
  chords: ChordEvent[],
  respStartBeat: number,
  respEndBeat: number,
): { events: RawEvent[]; addedContinuation: boolean } {
  if (events.length === 0) return { events, addedContinuation: false };
  const bpb = tune.meter[0];
  const swung = tune.feel === "swing" || tune.feel === "waltz";
  const offbeat = swung ? 2 / 3 : 0.5;
  const safeGap = Math.max(0.45, maxAllowedGap);

  const filled: RawEvent[] = [];
  let addedContinuation = false;
  let prevVoicing: Voicing | undefined;

  const makeBridgeNote = (startBeat: number, durBeats: number, refMidi: number, stepIdx: number, isFinal: boolean): RawEvent => {
    const at =
      chordAtBeat(chords, startBeat, bpb) ??
      chordAtBeat(chords, respStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };
    const tones = chordTones(at.chord);
    const guide = targetGuideToneMidi(at.chord, refMidi);

    let midi: number;
    let enclosure = false;
    let roleTag: string;

    if (isFinal) {
      midi = guide.midi;
      roleTag = `Swung baton-pass landing (${prettyNote(guide.degree)})`;
    } else if (stepIdx % 3 === 1) {
      // Swung chromatic/diatonic enclosure approaching the guide tone
      midi = stepIdx % 2 === 0 ? clampRegister(diatonicStepAbove(guide.midi, at.chord, at.next)) : guide.midi - 1;
      enclosure = true;
      roleTag = "Swung groove approach";
    } else {
      const tone = tones[stepIdx % Math.max(1, tones.length)];
      midi = tone ? nearestPitchWithPc(refMidi + (stepIdx % 2 === 0 ? 2 : -2), chroma(tone.note)) : guide.midi;
      midi = snapAvoidToScale(midi, at.chord, at.next);
      roleTag = `Swung groove continuation (${tone?.degree ?? "guide"})`;
    }

    let voicing: number[] | undefined;
    if (personality === "block-harmonizer") {
      const h = harmonizeMelodyNote(midi, at.chord, prevVoicing);
      voicing = h.voicing;
      prevVoicing = h.rawVoicing;
    }

    return {
      midi,
      voicing,
      start: Number(startBeat.toFixed(3)),
      end: Number(Math.min(respEndBeat, startBeat + durBeats).toFixed(3)),
      vel: enclosure ? 0.52 : 0.72,
      enclosure,
      tag: roleTag,
    };
  };

  // 1. Walk through internal gaps and bridge any silence > safeGap
  const sorted = [...events].sort((a, b) => a.start - b.start);
  let bridgeStep = 0;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (filled.length > 0) {
      const prev = filled[filled.length - 1];
      let gap = cur.start - prev.end;
      // First let the previous note ring a little longer if it was staccato
      if (gap > safeGap) {
        const stretchEnd = Math.min(cur.start - 0.15, prev.start + 1.4, prev.end + (gap - safeGap * 0.7));
        if (stretchEnd > prev.end) {
          prev.end = Number(stretchEnd.toFixed(3));
          gap = cur.start - prev.end;
        }
      }
      // If gap is still > safeGap, insert swung bridge notes
      while (cur.start - filled[filled.length - 1].end > safeGap + 0.05) {
        const last = filled[filled.length - 1];
        const rawNextStart = last.end + Math.min(safeGap * 0.65, 0.5);
        // Align to beat or swung "&" pocket
        const beatWhole = Math.floor(rawNextStart);
        const alignedStart =
          rawNextStart - beatWhole > 0.25 && rawNextStart - beatWhole < 0.75
            ? Math.max(last.end + 0.12, beatWhole + offbeat)
            : rawNextStart;
        if (alignedStart >= cur.start - 0.25) break;
        const dur = Math.min(0.85, cur.start - alignedStart - 0.08);
        filled.push(makeBridgeNote(alignedStart, Math.max(0.25, dur), last.midi, bridgeStep++, false));
        addedContinuation = true;
      }
    }
    filled.push({ ...cur });
  }

  // 2. Bridge any trailing silence [last.end, respEndBeat) that exceeds safeGap (1.2x)
  while (respEndBeat - filled[filled.length - 1].end > safeGap + 0.05) {
    const last = filled[filled.length - 1];
    const remaining = respEndBeat - last.end;
    //First allow the last note to sustain up to 1.35 beats if it was short
    if (last.end - last.start < 1.1 && remaining > safeGap) {
      const extended = Math.min(respEndBeat - safeGap * 0.8, last.start + 1.25);
      if (extended > last.end + 0.15) {
        last.end = Number(extended.toFixed(3));
        if (respEndBeat - last.end <= safeGap + 0.05) break;
      }
    }

    const gapHop = Math.min(safeGap * 0.7, 0.55);
    const rawStart = last.end + gapHop;
    const whole = Math.floor(rawStart);
    const frac = rawStart - whole;
    const snappedStart =
      frac > 0.2 && frac < 0.75 ? Math.max(last.end + 0.12, whole + offbeat) : Math.max(last.end + 0.15, rawStart);

    if (snappedStart >= respEndBeat - 0.22) break;
    const isFinal = respEndBeat - snappedStart <= safeGap + 0.75;
    const dur = isFinal ? Math.min(1.1, respEndBeat - snappedStart - 0.08) : Math.min(0.75, safeGap * 0.85);
    filled.push(makeBridgeNote(snappedStart, Math.max(0.25, dur), last.midi, bridgeStep++, isFinal));
    addedContinuation = true;
  }

  return { events: filled, addedContinuation };
}

/**
 * Dynamic Shaping Engine: calculates expressive, human-like MIDI velocities (`0.35..0.95`):
 * - Phrase Hairpin (`< >`): gentle entrance, warm mid-phrase swell, poised landing.
 * - Contour Accents: the highest pitch in the phrase gets a `0.85–0.88` peak accent.
 * - Ghost Notes: notes with `enclosure: true` (chromatic approaches) are ghosted (`0.48–0.53`).
 * - Swung Syncopation: notes landing on the swung `"&"` of the beat receive a `+0.08` groove bump.
 */
export function shapeDynamics(events: RawEvent[]): RawEvent[] {
  if (events.length === 0) return events;
  let peakMidi = -Infinity;
  for (const e of events) {
    if (e.midi > peakMidi) peakMidi = e.midi;
  }

  const n = events.length;
  return events.map((e, idx) => {
    const frac = mod(e.start, 1);
    const isOffbeat = frac >= 0.3 && frac <= 0.78;
    const isLast = idx === n - 1;
    // Subtle arch curve across the phrase (-0.04 at edges, +0.04 in the middle)
    const archPos = n > 2 ? Math.sin((idx / (n - 1)) * Math.PI) : 0.5;
    const archDelta = (archPos - 0.4) * 0.08;

    let vel: number;
    if (e.enclosure) {
      // Ghosted chromatic approach / enclosure note (0.45 - 0.55 range)
      vel = isOffbeat ? 0.53 : 0.48;
    } else if (e.midi === peakMidi) {
      // Contour peak accent
      vel = isOffbeat ? 0.88 : 0.85;
    } else {
      const base = e.vel && e.vel !== 0.65 ? e.vel : 0.65;
      vel = base + (isOffbeat ? 0.08 : 0) + archDelta + (isLast ? 0.02 : 0);
    }

    return {
      ...e,
      vel: Number(Math.max(0.35, Math.min(0.95, vel)).toFixed(2)),
    };
  });
}

/**
 * Apply the Ghost Master's personality transformation (`side-slipper`, `bebop-encloser`, or
 * `block-harmonizer`) to `seed` within `[winStartBeat, winEndBeat)`.
 * When `mentorCorrectionMode` is true (user played avoid/outside notes), prioritizes playing
 * the user's contour harmonically corrected onto clean chord/guide tones instead of side-slipping.
 */
function buildPersonalityEvents(
  seed: SeedNote[],
  personality: GhostPersonality,
  tune: Tune,
  chords: ChordEvent[],
  winStartBeat: number,
  winEndBeat: number,
  mentorCorrectionMode = false,
): { events: RawEvent[]; targetGuide: { midi: number; degree: string }; resChord: ChordEvent; resNext?: ChordEvent } {
  const bpb = tune.meter[0];
  const winSpan = Math.max(0.75, winEndBeat - winStartBeat);
  const lastSeed = seed[seed.length - 1];
  const maxRelEnd = Math.max(0.5, lastSeed.relStart + lastSeed.dur);
  const fitScale = maxRelEnd > winSpan ? winSpan / maxRelEnd : 1;

  const scaledSeed: SeedNote[] = seed.map((n) => ({
    relStart: n.relStart * fitScale,
    dur: Math.max(0.22, n.dur * fitScale),
    midi: n.midi,
    wasCorrected: n.wasCorrected,
  }));

  const scaledLast = scaledSeed[scaledSeed.length - 1];
  const resBeat = Math.min(winEndBeat - 0.2, winStartBeat + scaledLast.relStart);
  const resAt =
    chordAtBeat(chords, resBeat, bpb) ??
    chordAtBeat(chords, winStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };
  const targetGuide = targetGuideToneMidi(resAt.chord, scaledLast.midi);
  const baseShift = targetGuide.midi - scaledLast.midi;
  const rawEvents: RawEvent[] = [];

  if (personality === "side-slipper" && !mentorCorrectionMode) {
    if (scaledSeed.length === 1) {
      const s = winStartBeat + scaledSeed[0].relStart;
      const slipStart = Math.max(winStartBeat, s);
      const resStart = Math.min(winEndBeat - 0.35, slipStart + Math.min(2 / 3, winSpan * 0.4));
      rawEvents.push(
        {
          midi: clampRegister(targetGuide.midi + 1),
          start: slipStart,
          end: resStart,
          vel: 0.5,
          enclosure: true,
          tag: "Side-slip +½ step cell",
        },
        {
          midi: targetGuide.midi,
          start: resStart,
          end: Math.min(winEndBeat, resStart + Math.max(0.55, scaledSeed[0].dur)),
          vel: 0.72,
          enclosure: false,
          tag: `Guide-tone resolution (${prettyNote(targetGuide.degree)})`,
        },
      );
    } else {
      scaledSeed.forEach((n, idx) => {
        const isLast = idx === scaledSeed.length - 1;
        const start = winStartBeat + Math.min(winSpan - 0.2, n.relStart);
        const end = Math.min(winEndBeat, start + n.dur);
        const transposed = clampRegister(n.midi + baseShift);
        const midi = isLast ? targetGuide.midi : clampRegister(transposed + 1);
        rawEvents.push({
          midi,
          start,
          end,
          vel: isLast ? 0.72 : 0.52,
          enclosure: !isLast,
          tag: isLast ? `Resolved side-slip → ${prettyNote(targetGuide.degree)}` : "Planed +½ step (side-slip)",
        });
      });
    }
  } else if (personality === "bebop-encloser" || (personality === "side-slipper" && mentorCorrectionMode)) {
    const stepDur = tune.feel === "swing" || tune.feel === "waltz" ? 1 / 3 : 0.5;
    const targetStart = Math.min(
      winEndBeat - 0.3,
      Math.max(winStartBeat + stepDur * 2, winStartBeat + scaledLast.relStart),
    );
    const encStart1 = targetStart - stepDur * 2;
    const encStart2 = targetStart - stepDur;

    for (let i = 0; i < scaledSeed.length - 1; i++) {
      const n = scaledSeed[i];
      const start = winStartBeat + n.relStart;
      if (start >= encStart1 - 0.05) continue;
      const end = Math.min(encStart1, start + n.dur);
      if (end - start < 0.14) continue;
      const at = chordAtBeat(chords, start, bpb) ?? resAt;
      const rawTransposed = clampRegister(n.midi + baseShift);
      const cleanMidi = snapAvoidToScale(rawTransposed, at.chord, at.next, !!n.wasCorrected || mentorCorrectionMode);
      rawEvents.push({
        midi: cleanMidi,
        start,
        end,
        vel: 0.65,
        enclosure: false,
        tag: n.wasCorrected ? "Mentor correction: resolved clinker to chord/guide tone" : "Transposed motif stem",
      });
    }

    const aboveMidi = clampRegister(diatonicStepAbove(targetGuide.midi, resAt.chord, resAt.next));
    const belowMidi = targetGuide.midi - 1;
    rawEvents.push(
      {
        midi: aboveMidi,
        start: encStart1,
        end: encStart2,
        vel: 0.5,
        enclosure: true,
        tag: "Enclosure: diatonic step above",
      },
      {
        midi: belowMidi,
        start: encStart2,
        end: targetStart,
        vel: 0.52,
        enclosure: true,
        tag: "Enclosure: chromatic half-step below",
      },
      {
        midi: targetGuide.midi,
        start: targetStart,
        end: Math.min(winEndBeat, targetStart + Math.max(0.55, scaledLast.dur)),
        vel: 0.74,
        enclosure: false,
        tag: mentorCorrectionMode
          ? `Mentor guide-tone resolution (${prettyNote(targetGuide.degree)})`
          : `Enclosed guide-tone landing (${prettyNote(targetGuide.degree)})`,
      },
    );
  } else {
    let prevVoicing: Voicing | undefined;
    scaledSeed.forEach((n, idx) => {
      const isLast = idx === scaledSeed.length - 1;
      const start = winStartBeat + Math.min(winSpan - 0.2, n.relStart);
      const end = Math.min(winEndBeat, start + n.dur);
      const at = chordAtBeat(chords, start, bpb) ?? resAt;
      const rawMidi = isLast ? targetGuide.midi : clampRegister(n.midi + baseShift);
      const topMidi = snapAvoidToScale(rawMidi, at.chord, at.next, !!n.wasCorrected || mentorCorrectionMode);
      const { voicing, rawVoicing } = harmonizeMelodyNote(topMidi, at.chord, prevVoicing);
      prevVoicing = rawVoicing;
      rawEvents.push({
        midi: topMidi,
        voicing,
        start,
        end,
        vel: 0.66,
        enclosure: false,
        tag: n.wasCorrected
          ? `Mentor-corrected block chord (${voicing.length} voices)`
          : `Block-chord harmonization (${voicing.length} voices)`,
      });
    });
  }

  return { events: rawEvents, targetGuide, resChord: resAt.chord, resNext: resAt.next };
}

/**
 * Realize a `GhostLick` from `vocabulary.ts` over `[lickStartBeat, lickEndBeat)`, snapping
 * every note to the underlying chord changes sounding at that exact beat.
 */
function buildVocabularyEvents(
  lick: GhostLick,
  personality: GhostPersonality,
  chords: ChordEvent[],
  bpb: number,
  lickStartBeat: number,
  lickEndBeat: number,
  refMidi: number,
): RawEvent[] {
  const windowBeats = Math.max(1, lickEndBeat - lickStartBeat);
  const beatScale = windowBeats / Math.max(1, lick.spanBeats);
  const events: RawEvent[] = [];
  let prevVoicing: Voicing | undefined;

  for (const step of lick.steps) {
    const start = lickStartBeat + step.relBeat * beatScale;
    if (start >= lickEndBeat - 0.1) continue;
    const dur = Math.max(0.2, step.dur * beatScale);
    const end = Math.min(lickEndBeat, start + dur);
    const at =
      chordAtBeat(chords, start, bpb) ??
      chordAtBeat(chords, lickStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };

    const rootPc = chroma(at.chord.root);
    const baseRootMidi = nearestPitchWithPc(refMidi, rootPc);
    const rawMidi = clampRegister(baseRootMidi + step.semitonesFromRoot);
    const snappedMidi = clampRegister(snapLickPitchToChord(rawMidi, !!step.enclosure, at.chord, at.next));

    let voicing: number[] | undefined;
    if (personality === "block-harmonizer") {
      const h = harmonizeMelodyNote(snappedMidi, at.chord, prevVoicing);
      voicing = h.voicing;
      prevVoicing = h.rawVoicing;
    }

    events.push({
      midi: snappedMidi,
      voicing,
      start,
      end,
      vel: step.vel ?? (step.enclosure ? 0.5 : 0.66),
      enclosure: !!step.enclosure,
      tag: `${lick.title} (${lick.master}): ${step.role}`,
    });
  }

  return events;
}

/**
 * Transform a user's call phrase into a Ghost Master response over `[respStartBeat, respEndBeat)`.
 */
export function transformMotif(args: TransformMotifArgs): GhostResponse {
  const {
    notes,
    personality,
    tune,
    chords,
    callStartBeat,
    callEndBeat,
    respStartBeat,
    respEndBeat,
    continuousPhraseIdx = 0,
  } = args;
  const bpb = tune.meter[0];
  const respSpan = Math.max(1, respEndBeat - respStartBeat);
  const {
    seed,
    density,
    energy,
    maxAllowedGapBeats,
    correctedCount,
    accuracy,
  } = extractSeedMotif(notes, callStartBeat, callEndBeat, chords, bpb);

  const pacing = getGhostPacing(continuousPhraseIdx);
  // Mentor Correction Mode activates whenever the user played avoid/outside notes in their call
  const mentorCorrectionMode = correctedCount > 0 && accuracy < 0.85;
  // Slow-start / lyrical invitation activates when the user is just starting out or plays a very sparse opening
  const isSlowStart = notes.length <= 2 || density <= 1.5;

  let rawEvents: RawEvent[] = [];
  let targetGuide: { midi: number; degree: string };
  let resChord: ChordEvent;
  let resNext: ChordEvent | undefined;
  let quotedLick: GhostLick | undefined;

  if (pacing === "prompt") {
    // "Prompt" mode: transform (and harmonically correct if needed) the user's motif in the first half,
    // then offer either a singing lyrical melody (on slow starts) or a density-matched classic lick in the second half.
    const midBeat = respStartBeat + respSpan / 2;
    const firstHalf = buildPersonalityEvents(
      seed,
      personality,
      tune,
      chords,
      respStartBeat,
      midBeat,
      mentorCorrectionMode,
    );
    const midAt =
      chordAtBeat(chords, midBeat, bpb) ??
      chordAtBeat(chords, respStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };
    quotedLick = isSlowStart
      ? selectLyricalMelodyLick(midAt.chord, continuousPhraseIdx)
      : selectVocabularyLick(midAt.chord, energy, continuousPhraseIdx);
    const secondHalf = buildVocabularyEvents(
      quotedLick,
      personality,
      chords,
      bpb,
      midBeat,
      respEndBeat,
      firstHalf.targetGuide.midi,
    );
    rawEvents = [...firstHalf.events, ...secondHalf];
    const endAt = chordAtBeat(chords, respEndBeat - 0.25, bpb) ?? midAt;
    resChord = endAt.chord;
    resNext = endAt.next;
    targetGuide = targetGuideToneMidi(
      resChord,
      secondHalf.length > 0 ? secondHalf[secondHalf.length - 1].midi : firstHalf.targetGuide.midi,
    );
  } else if (pacing === "space") {
    // "Vibe/Space" mode: on slow starts, play a singing lyrical melody with a dynamic swell;
    // otherwise play a distilled 2-note motif cell and let `enforceMaxSilenceGap` keep any silence <= 1.2x.
    if (isSlowStart) {
      const startAt = chordAtBeat(chords, respStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };
      quotedLick = selectLyricalMelodyLick(startAt.chord, continuousPhraseIdx);
      rawEvents = buildVocabularyEvents(
        quotedLick,
        personality,
        chords,
        bpb,
        respStartBeat,
        respEndBeat,
        seed[0]?.midi ?? 67,
      );
      const endAt = chordAtBeat(chords, respEndBeat - 0.25, bpb) ?? startAt;
      resChord = endAt.chord;
      resNext = endAt.next;
      targetGuide = targetGuideToneMidi(
        resChord,
        rawEvents.length > 0 ? rawEvents[rawEvents.length - 1].midi : 67,
      );
    } else {
      const spaceEndBeat = respStartBeat + Math.max(1.5, respSpan * 0.55);
      const fragment = seed.slice(0, Math.min(3, seed.length)).map((n, idx) => ({
        relStart: idx === 0 ? 0 : Math.min(spaceEndBeat - respStartBeat - 0.6, Math.max(2 / 3, n.relStart * 1.15)),
        dur: Math.max(0.75, n.dur * 1.2),
        midi: n.midi,
        wasCorrected: n.wasCorrected,
      }));
      const built = buildPersonalityEvents(
        fragment,
        personality,
        tune,
        chords,
        respStartBeat,
        spaceEndBeat,
        mentorCorrectionMode,
      );
      rawEvents = built.events;
      targetGuide = built.targetGuide;
      resChord = built.resChord;
      resNext = built.resNext;
    }
  } else {
    // "Echo" mode: transform (or mentor-correct) the user's motif; if the user barely played (<=1 note),
    // follow their opening note with a singing lyrical melody so they get a memorable line to play with.
    if (notes.length <= 1) {
      const midBeat = respStartBeat + Math.min(2, respSpan * 0.35);
      const firstHalf = buildPersonalityEvents(
        seed.slice(0, 1),
        personality,
        tune,
        chords,
        respStartBeat,
        midBeat,
        mentorCorrectionMode,
      );
      const midAt =
        chordAtBeat(chords, midBeat, bpb) ??
        chordAtBeat(chords, respStartBeat, bpb) ?? { chord: chords[0], next: chords[1] };
      quotedLick = selectLyricalMelodyLick(midAt.chord, continuousPhraseIdx);
      const lyricalTail = buildVocabularyEvents(
        quotedLick,
        personality,
        chords,
        bpb,
        midBeat,
        respEndBeat,
        firstHalf.targetGuide.midi,
      );
      rawEvents = [...firstHalf.events, ...lyricalTail];
      const endAt = chordAtBeat(chords, respEndBeat - 0.25, bpb) ?? midAt;
      resChord = endAt.chord;
      resNext = endAt.next;
      targetGuide = targetGuideToneMidi(
        resChord,
        lyricalTail.length > 0 ? lyricalTail[lyricalTail.length - 1].midi : firstHalf.targetGuide.midi,
      );
    } else {
      const built = buildPersonalityEvents(
        seed,
        personality,
        tune,
        chords,
        respStartBeat,
        respEndBeat,
        mentorCorrectionMode,
      );
      rawEvents = built.events;
      targetGuide = built.targetGuide;
      resChord = built.resChord;
      resNext = built.resNext;
    }
  }

  // ── 1. Swing & Groove Quantization (pulls straight 8ths into the 2/3 swing pocket) ──
  const swungEvents = swingifyEvents(rawEvents, tune, respStartBeat, respEndBeat);

  // ── 2. Proportional Silence Cap (`maxGhostGap <= 1.2 * maxUserGap`) & Baton-Pass Turnaround ──
  const { events: gapCappedEvents, addedContinuation: batonPass } = enforceMaxSilenceGap(
    swungEvents,
    maxAllowedGapBeats,
    personality,
    tune,
    chords,
    respStartBeat,
    respEndBeat,
  );

  // ── 3. Strict Non-Overlapping / Non-Legato Articulation Pass ──
  const cleanEvents = deoverlapEvents(gapCappedEvents, respStartBeat, respEndBeat);

  // ── 4. Dynamic Hairpin & Contour Shaping Engine ──
  const shapedEvents = shapeDynamics(cleanEvents);

  const out: GhostNote[] = shapedEvents.map((e) => {
    const at =
      chordAtBeat(chords, e.start, bpb) ??
      chordAtBeat(chords, respStartBeat, bpb) ?? { chord: resChord, next: resNext };
    const mel = melodyIn(tune, e.start, e.end).map((n) => pitchClass(n.pitch));
    const ev = evaluateLineNote(e.midi, at.chord, at.next, mel);
    // Recognize resolved chromatic enclosures / side-slip approach notes so they aren't misread as random clinkers
    const adjustedEv: LineNoteEval =
      e.enclosure && (ev.verdict === "outside" || ev.verdict === "avoid")
        ? { ...ev, verdict: "tension", role: `${ev.role} (approach)` }
        : ev;
    const landing = guideTones(at.chord).some((g) => chroma(g.note) === mod(e.midi, 12));
    return {
      midi: e.midi,
      voicing: e.voicing ?? [e.midi],
      start: e.start,
      end: e.end,
      vel: e.vel,
      chordSymbol: symbol(at.chord),
      ev: adjustedEv,
      landing,
      enclosure: e.enclosure,
      tag: e.tag,
    };
  });

  const targetSym = prettySymbol(symbol(resChord));
  const targetNote = prettyNote(evaluateLineNote(targetGuide.midi, resChord, resNext).name);
  const densityTag = density > 4 ? `dense (${density}/bar)` : density > 0 ? `sparse (${density}/bar)` : "lyrical seed";
  const mentorPrefix =
    correctedCount > 0
      ? `🎓 Mentor corrected ${correctedCount} off-harmony note${correctedCount === 1 ? "" : "s"} in your call → `
      : notes.length >= 3 && accuracy === 1
        ? "🌟 Clean changes! "
        : "";
  const lickSuffix = quotedLick ? `, singing "${quotedLick.title}" (${quotedLick.master})` : "";
  const batonSuffix = batonPass ? ` (gap capped ≤ ${maxAllowedGapBeats}b)` : "";

  const baseSummary =
    personality === "side-slipper" && !mentorCorrectionMode
      ? `Side-Slipper swung your ${seed.length}-note motif +½ step into ${targetNote} (${prettyNote(targetGuide.degree)} of ${targetSym})`
      : personality === "bebop-encloser" || mentorCorrectionMode
        ? `Bebop Encloser resolved your line into ${targetNote} (${prettyNote(targetGuide.degree)} of ${targetSym})`
        : `Block Harmonizer voiced your contour in 4-way close chords into ${targetSym}`;

  const summary = `[${pacing.toUpperCase()} · ${densityTag}] ${mentorPrefix}${baseSummary}${lickSuffix}${batonSuffix}.`;

  return {
    personality,
    pacing,
    density,
    maxAllowedGapBeats,
    correctedCount,
    lick: quotedLick,
    batonPass,
    callStartBeat,
    callEndBeat,
    respStartBeat,
    respEndBeat,
    notes: out,
    summary,
  };
}
