import { chordTones, guideTones, symbol } from "./chords";
import { chordAtBeat, evaluateLineNote, type LineNoteEval } from "./lineEval";
import { chroma, mod, pitchClass, prettyNote, prettySymbol } from "./pitch";
import { suggestScales } from "./scales";
import { melodyIn } from "./time";
import type { ChordEvent, Tune } from "./types";
import { voiceChord, type Voicing } from "./voicing";

/**
 * Deterministic Call-and-Response Motif Transformer ("Trading Fours with a Ghost Master").
 * Captures the user's 2-bar or 4-bar improvised call phrase and transforms its interval
 * contour and rhythm to fit the reharmonized changes of the response bars.
 */

export type GhostPersonality = "side-slipper" | "bebop-encloser" | "block-harmonizer";
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

export interface GhostNote {
  /** Primary melodic MIDI pitch (top voice for block-harmonizer). */
  midi: number;
  /** All MIDI pitches sounded on this event (1 note for single-line masters, 4–5 notes for block-harmonizer). */
  voicing: number[];
  /** Absolute start beat in the response window. */
  start: number;
  /** Absolute end beat in the response window. */
  end: number;
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
}

const SOLO_LOW = 58; // Bb3
const SOLO_HIGH = 84; // C6
const MAX_MOTIF_NOTES = 7;

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

/** Snap an avoid pitch to the nearest chord or tension pitch class so block-chord melodies stay idiomatic. */
function snapAvoidToScale(midi: number, chord: ChordEvent, next?: ChordEvent): number {
  const ev = evaluateLineNote(midi, chord, next);
  if (ev.verdict !== "avoid" && ev.verdict !== "outside") return midi;
  const scale = suggestScales(chord, next)[0];
  const allowed = new Set<number>([
    ...chordTones(chord).map((t) => chroma(t.note)),
    ...(scale ? scale.notes.filter((n) => !scale.avoid.includes(n)).map((n) => chroma(n)) : []),
  ]);
  for (const delta of [1, -1, 2, -2]) {
    if (allowed.has(mod(midi + delta, 12))) return midi + delta;
  }
  return midi;
}

/** Build a locked-hands block chord with `melodyMidi` as the top voice using `voiceChord`. */
function harmonizeMelodyNote(melodyMidi: number, chord: ChordEvent, prevVoicing?: Voicing): { voicing: number[]; rawVoicing: Voicing } {
  const v = voiceChord(chord, prevVoicing);
  const top = clampRegister(melodyMidi);
  // Stack the upper voicing tones strictly below `top` within one octave (4-way close + bass)
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
 * Extract the rhythmic and melodic core of the user's call phrase, or synthesize a
 * 3-note call cell from the call chord's guide tones if the user left the call bars empty.
 */
function extractSeedMotif(
  notes: MotifNoteInput[],
  callStartBeat: number,
  callEndBeat: number,
  chords: ChordEvent[],
  bpb: number,
): { relStart: number; dur: number; midi: number }[] {
  const span = Math.max(1, callEndBeat - callStartBeat);
  const inCall = notes
    .filter((n) => {
      const end = n.end ?? callEndBeat;
      return n.start < callEndBeat - 0.05 && end > callStartBeat + 0.05;
    })
    .sort((a, b) => a.start - b.start || b.midi - a.midi);

  // Deduplicate simultaneous chord strikes to keep the top melodic line
  const monophonic: MotifNoteInput[] = [];
  for (const n of inCall) {
    const prev = monophonic[monophonic.length - 1];
    if (prev && Math.abs(n.start - prev.start) < 0.08) continue;
    monophonic.push(n);
  }

  const picked = monophonic.slice(-MAX_MOTIF_NOTES);
  if (picked.length > 0) {
    // Shift all motif notes left by the first note's offset so the Ghost Master always
    // enters confidently on Beat 0 (the downbeat) of its response window.
    const firstOffset = Math.max(0, picked[0].start - callStartBeat);
    return picked.map((n, i) => {
      const shiftedStart = Math.max(0, n.start - callStartBeat - firstOffset);
      const relStart = Math.max(0, Math.min(span - 0.25, shiftedStart));
      const rawEnd = n.end !== null ? Math.min(callEndBeat, n.end) : callEndBeat;
      const nextShifted =
        i + 1 < picked.length ? Math.max(relStart + 0.2, picked[i + 1].start - callStartBeat - firstOffset) : span;
      const dur = Math.max(0.25, Math.min(2.0, rawEnd - n.start, nextShifted - relStart));
      return { relStart, dur, midi: clampRegister(n.midi) };
    });
  }

  // Fallback seed when the user rests during the call: a 3-note swung motif over the call's first chord
  const firstChord = chordAtBeat(chords, callStartBeat, bpb)?.chord ?? chords[0];
  const tones = chordTones(firstChord);
  const rootMidi = clampRegister(60 + chroma(firstChord.root));
  const thirdMidi = tones[1] ? nearestPitchWithPc(rootMidi + 3, chroma(tones[1].note)) : rootMidi + 4;
  const fifthMidi = tones[2] ? nearestPitchWithPc(thirdMidi + 3, chroma(tones[2].note)) : rootMidi + 7;
  return [
    { relStart: 0, dur: 0.65, midi: rootMidi },
    { relStart: 2 / 3, dur: 0.65, midi: thirdMidi },
    { relStart: 1.5, dur: Math.min(1.5, span - 1.5), midi: fifthMidi },
  ];
}

/**
 * Transform a user's call phrase into a Ghost Master response over `[respStartBeat, respEndBeat)`.
 */
export function transformMotif(args: TransformMotifArgs): GhostResponse {
  const { notes, personality, tune, chords, callStartBeat, callEndBeat, respStartBeat, respEndBeat } = args;
  const bpb = tune.meter[0];
  const respSpan = Math.max(1, respEndBeat - respStartBeat);
  const seed = extractSeedMotif(notes, callStartBeat, callEndBeat, chords, bpb);

  // Determine the resolution chord at the end of the motif in the response window
  const lastSeed = seed[seed.length - 1];
  const resBeat = Math.min(respEndBeat - 0.25, respStartBeat + lastSeed.relStart);
  const resAt = chordAtBeat(chords, resBeat, bpb) ?? chordAtBeat(chords, respStartBeat, bpb) ?? { chord: chords[0] };
  const targetGuide = targetGuideToneMidi(resAt.chord, lastSeed.midi);
  const baseShift = targetGuide.midi - lastSeed.midi;

  interface RawEvent {
    midi: number;
    voicing?: number[];
    start: number;
    end: number;
    enclosure: boolean;
    tag: string;
  }

  const rawEvents: RawEvent[] = [];

  if (personality === "side-slipper") {
    // Herbie / McCoy: plane the motif up a half-step (+1 semitone above the transposed guide-tone path)
    // and resolve the final note down into the target chord's guide tone.
    if (seed.length === 1) {
      const s = respStartBeat + seed[0].relStart;
      const slipStart = Math.max(respStartBeat, s);
      const resStart = Math.min(respEndBeat - 0.4, slipStart + 0.5);
      rawEvents.push(
        {
          midi: clampRegister(targetGuide.midi + 1),
          start: slipStart,
          end: resStart,
          enclosure: true,
          tag: "Side-slip +½ step cell",
        },
        {
          midi: targetGuide.midi,
          start: resStart,
          end: Math.min(respEndBeat, resStart + Math.max(0.5, seed[0].dur)),
          enclosure: false,
          tag: `Guide-tone resolution (${prettyNote(targetGuide.degree)})`,
        },
      );
    } else {
      seed.forEach((n, idx) => {
        const isLast = idx === seed.length - 1;
        const start = respStartBeat + Math.min(respSpan - 0.25, n.relStart);
        const end = Math.min(respEndBeat, start + n.dur);
        const transposed = clampRegister(n.midi + baseShift);
        const midi = isLast ? targetGuide.midi : clampRegister(transposed + 1);
        rawEvents.push({
          midi,
          start,
          end,
          enclosure: !isLast,
          tag: isLast ? `Resolved side-slip → ${prettyNote(targetGuide.degree)}` : "Planed +½ step (side-slip)",
        });
      });
    }
  } else if (personality === "bebop-encloser") {
    // Bud Powell / Barry Harris: transpose motif to target guide tone, then wrap the
    // resolution note with a diatonic-above -> chromatic-below -> target guide-tone enclosure.
    // Anchor the phrase on Beat 0 of the response window: if the motif has only 1 note (relStart = 0),
    // the 2-note enclosure starts right on Beat 0 (`respStartBeat`) and resolves on `respStartBeat + 2 * stepDur`.
    const stepDur = tune.feel === "swing" || tune.feel === "waltz" ? 1 / 3 : 0.5;
    const targetStart = Math.min(respEndBeat - 0.35, Math.max(respStartBeat + stepDur * 2, respStartBeat + lastSeed.relStart));
    const encStart1 = targetStart - stepDur * 2;
    const encStart2 = targetStart - stepDur;

    for (let i = 0; i < seed.length - 1; i++) {
      const n = seed[i];
      const start = respStartBeat + n.relStart;
      if (start >= encStart1 - 0.05) continue;
      const end = Math.min(encStart1, start + n.dur);
      if (end - start < 0.15) continue;
      rawEvents.push({
        midi: clampRegister(n.midi + baseShift),
        start,
        end,
        enclosure: false,
        tag: "Transposed motif stem",
      });
    }

    const aboveMidi = clampRegister(diatonicStepAbove(targetGuide.midi, resAt.chord, resAt.next));
    const belowMidi = targetGuide.midi - 1;
    rawEvents.push(
      {
        midi: aboveMidi,
        start: encStart1,
        end: encStart2,
        enclosure: true,
        tag: "Enclosure: diatonic step above",
      },
      {
        midi: belowMidi,
        start: encStart2,
        end: targetStart,
        enclosure: true,
        tag: "Enclosure: chromatic half-step below",
      },
      {
        midi: targetGuide.midi,
        start: targetStart,
        end: Math.min(respEndBeat, targetStart + Math.max(0.6, lastSeed.dur)),
        enclosure: false,
        tag: `Enclosed guide-tone landing (${prettyNote(targetGuide.degree)})`,
      },
    );
  } else {
    // Bill Evans / George Shearing: harmonize every motif note as the top voice of voiceChord()
    let prevVoicing: Voicing | undefined;
    seed.forEach((n, idx) => {
      const isLast = idx === seed.length - 1;
      const start = respStartBeat + Math.min(respSpan - 0.25, n.relStart);
      const end = Math.min(respEndBeat, start + n.dur);
      const at = chordAtBeat(chords, start, bpb) ?? resAt;
      const rawMidi = isLast ? targetGuide.midi : clampRegister(n.midi + baseShift);
      const topMidi = snapAvoidToScale(rawMidi, at.chord, at.next);
      const { voicing, rawVoicing } = harmonizeMelodyNote(topMidi, at.chord, prevVoicing);
      prevVoicing = rawVoicing;
      rawEvents.push({
        midi: topMidi,
        voicing,
        start,
        end,
        enclosure: false,
        tag: `Block-chord harmonization (${voicing.length} voices)`,
      });
    });
  }

  const out: GhostNote[] = rawEvents.map((e) => {
    const at = chordAtBeat(chords, e.start, bpb) ?? resAt;
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
      chordSymbol: symbol(at.chord),
      ev: adjustedEv,
      landing,
      enclosure: e.enclosure,
      tag: e.tag,
    };
  });

  const targetSym = prettySymbol(symbol(resAt.chord));
  const targetNote = prettyNote(evaluateLineNote(targetGuide.midi, resAt.chord, resAt.next).name);
  const summary =
    personality === "side-slipper"
      ? `Side-Slipper planed your ${seed.length}-note motif +½ step, resolving to ${targetNote} (${prettyNote(targetGuide.degree)} of ${targetSym}).`
      : personality === "bebop-encloser"
        ? `Bebop Encloser wrapped ${targetNote} (${prettyNote(targetGuide.degree)} of ${targetSym}) in a diatonic-above / chromatic-below enclosure.`
        : `Block Harmonizer locked your ${seed.length}-note contour as the top voice of 4-way close voicings into ${targetSym}.`;

  return {
    personality,
    callStartBeat,
    callEndBeat,
    respStartBeat,
    respEndBeat,
    notes: out,
    summary,
  };
}
