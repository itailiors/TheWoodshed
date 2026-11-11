/** Shared types and helpers for reharm rules. */
import { chordTones, symbol } from "./chords";
import { parseNote, prettyNote as pn, prettySymbol, simplifyNote } from "./pitch";
import type { ChordEvent, MoveCategory, MoveText, Quality, Tune, VoiceMotion } from "./types";
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
  voiceLeading?: VoiceMotion[];
  facts: Record<string, unknown>;
  text: MoveText;
}

export interface Rule {
  id: string;
  name: string;
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

export const romanName = (c: ChordEvent) => c.analysis?.roman.replace(/(maj7|m7b5|ø7|°7|m7|m6|7|6)$/, "");

/** "A♭ → A♭ → G, E♭ → D → D": follow each voice by nearest motion through a chord list. */
export function chain(voices: string[], chords: Array<Parameters<typeof chordTones>[0]>): string {
  return voices
    .map((v) => {
      const path = [v];
      let cur = v;
      for (const c of chords) {
        cur = nearestMotion(cur, chordTones(c)).to;
        path.push(cur);
      }
      return path.map(pn).join(" → ");
    })
    .join(", ");
}
