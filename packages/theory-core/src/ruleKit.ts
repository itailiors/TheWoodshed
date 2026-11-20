/** Shared types and helpers for reharm rules. */
import { chordTones, symbol, type ChordTone } from "./chords";
import { parseNote, prettyNote as pn, prettySymbol, simplifyNote, transpose } from "./pitch";
import type { ChordEvent, MoveCategory, MoveText, Quality, RulePedagogy, Tune, VoiceMotion } from "./types";
import { nearestMotion } from "./voiceLeading";

export type NewChord = Omit<ChordEvent, "id" | "at">;

export interface RuleContext {
  tune: Tune;
  index: number;
  chord: ChordEvent;
  prev?: ChordEvent;
  next?: ChordEvent;
  /** The chord after `next` (for rules that replace two chords). */
  afterNext?: ChordEvent;
}

export interface Proposal {
  /** How many consecutive chords (from ctx.index) the move replaces. Default 1. */
  replaceCount?: number;
  chords: NewChord[];
  title: string;
  level: 1 | 2 | 3 | 4;
  category: MoveCategory;
  styleTags: string[];
  voicingHint?: { lh: string[]; rh: string[] };
  voicingHints?: Array<{ lh: string[]; rh: string[] }>;
  voiceLeading?: VoiceMotion[];
  facts: Record<string, unknown>;
  /**
   * The move's words, for a rule WITHOUT a lesson. A rule with one (`learn/lessons/rules.ts`, fed
   * by `facts.learn`) leaves this out: `buildMove` derives the text from the lesson (see `MoveText`).
   * The engine throws when a lessonless proposal has no text.
   */
  text?: MoveText;
}

export interface Rule {
  id: string;
  name: string;
  pedagogy?: RulePedagogy;
  propose(ctx: RuleContext): Proposal | null;
}

export const ps = (c: Parameters<typeof symbol>[0]) => prettySymbol(symbol(c));
export { pn };

/** Respell double accidentals and Cb/Fb/E#/B#. */
export const tidy = (n: string) => {
  const s = parseNote(n);
  return Math.abs(s.alter) >= 2 || ["Cb", "Fb", "E#", "B#"].includes(n) ? simplifyNote(n) : n;
};

export function mk(root: string, quality: Quality, beats: number, extensions: string[] = [], alterations: string[] = []): NewChord {
  return { root, quality, beats, extensions, alterations };
}

/** Split a chord's duration in two (3 beats → 2+1, 4 → 2+2, 2 → 1+1). */
export function splitBeats(total: number): [number, number] | null {
  if (total < 2) return null;
  if (total % 2 === 0) return [total / 2, total / 2];
  const a = Math.ceil((total * 2) / 3);
  return [a, total - a];
}

/** Share `total` beats among n chords in whole beats, giving any extra to the first and last. */
export function distribute(total: number, n: number): number[] | null {
  if (total < n) return null;
  const base = Math.floor(total / n);
  const out = Array<number>(n).fill(base);
  let extra = total - base * n;
  for (let i = 0; extra > 0; i = i === 0 ? n - 1 : i === n - 1 ? 1 : i + 1, extra--) out[i]++;
  return out;
}

/**
 * A diminished 7th's tones for display: double accidentals and C♭/F♭/E♯/B♯ respelled, so a
 * descending passing E♭dim7 reads E♭ G♭ A C, never B♭♭ and D♭♭. The degrees stay the chord's own.
 */
export const dimTones = (dim: Parameters<typeof chordTones>[0]): ChordTone[] => chordTones(dim).map((t) => ({ ...t, note: tidy(t.note) }));

/**
 * A tone spelled by its direction of resolution: `transpose(root, iv)` with a sharp interval
 * ("#2", "#4") gives a rising leaning tone (D♯ over C), simplified only where it would need a
 * double sharp (F𝄪 over E → G, C𝄪 over B → D).
 */
export function risingTone(root: string, iv: string): string {
  const n = transpose(root, iv);
  return parseNote(n).alter >= 2 ? simplifyNote(n) : n;
}

/**
 * Positional voice motion for planing and grips: voice k of `from` moves to voice k of `to`
 * (the nearest octave of that one tone), not to whichever chord tone is nearest. Parallel
 * shapes stay parallel: D♭maj7 → Cmaj7 is four −1 slides, where nearest motion holds the C.
 */
export function planeMotion(from: ReadonlyArray<string | ChordTone>, to: readonly ChordTone[]): VoiceMotion[] {
  if (from.length !== to.length) throw new Error(`planeMotion: ${from.length} voices into ${to.length}`);
  return from.map((f, k) => nearestMotion(typeof f === "string" ? f : f.note, [to[k]]));
}

export const romanName =(c: ChordEvent) => c.analysis?.roman.replace(/(maj7|m7b5|ø7|°7|m7|m6|7|6)$/, "");

/** Each voice followed by nearest motion through a chord list: one motion per chord, per voice. */
export function chainMotions(voices: string[], chords: Array<Parameters<typeof chordTones>[0]>): VoiceMotion[][] {
  return voices.map((v) => {
    const out: VoiceMotion[] = [];
    let cur = v;
    for (const c of chords) {
      const m = nearestMotion(cur, chordTones(c));
      out.push(m);
      cur = m.to;
    }
    return out;
  });
}

/** "A♭ → A♭ → G, E♭ → D → D": follow each voice by nearest motion through a chord list. */
export function chain(voices: string[], chords: Array<Parameters<typeof chordTones>[0]>): string {
  return chainMotions(voices, chords)
    .map((ms, i) => [voices[i], ...ms.map((m) => m.to)].map(pn).join(" → "))
    .join(", ");
}
