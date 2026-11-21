import type { Tune } from "@reharm/theory-core";

/**
 * Lead-sheet engraving: turns the tune's melody (onset + length in beats, which may cross
 * barlines) into what gets printed, bar by bar. The rules are the standard ones (Gould,
 * "Behind Bars"):
 *  - every bar of a fully written melody adds up to the meter: gaps become rests;
 *  - a note crossing a barline is split and tied;
 *  - in 4/4 the middle of the bar (beat 3) stays visible, except for notes starting on
 *    beat 1 and the half / dotted half on beat 2;
 *  - a note starting off the beat is split at the next beat (eighth tied on), except an
 *    off-beat quarter that ends the note inside its half bar (eighth–quarter–eighth);
 *  - an accidental holds to the barline: a later note on the same line and octave in that bar
 *    needs a natural (or a new accidental) to cancel it, and repeating one is redundant;
 *    a note tied in over the barline shows no accidental and doesn't carry one forward;
 *  - eighths are beamed within a beat group (half bars in 4/4, single beats otherwise);
 *    rests break beams.
 */

export interface Glyph {
  bar: number;
  /** Onset within the bar, 1-based (2.5 = the "and" of 2). */
  beat: number;
  /** Printed length in beats: 4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25 (anything else is printed as-is). */
  value: number;
  /** Spelled pitch, or null for a rest. */
  pitch: string | null;
  tieToNext: boolean;
  tiedFromPrev: boolean;
  /** Alteration to print in front of the note (0 = natural), or null when none is needed. */
  accidental: number | null;
}

export interface EngravedBar {
  bar: number;
  /** Notes and rests in time order. */
  glyphs: Glyph[];
  /** Beamed groups of eighths, as indices into `glyphs` (each has at least two). */
  beams: number[][];
}

const EPS = 1e-6;
const isInt = (x: number) => Math.abs(x - Math.round(x)) < EPS;
const NOTE_VALUES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
const SUB_BEAT = [0.75, 0.5, 0.25];

/** Largest value in `list` that fits in `max`; an unrepresentable length (a triplet) is printed whole. */
function fit(max: number, list: number[], ok: (v: number) => boolean = () => true): number {
  return list.find((v) => v <= max + EPS && ok(v)) ?? max;
}

/** Split `len` beats starting at `start` (1-based, within one bar) into printable values. */
export function chunks(start: number, len: number, bpb: number, rest: boolean): Array<[number, number]> {
  const mid = bpb === 4 ? 3 : null;
  const crosses = (s: number, e: number) => mid !== null && s < mid - EPS && e > mid + EPS;
  const out: Array<[number, number]> = [];
  let s = start;
  let left = len;
  const sixteenths = (x: number) => isInt(x * 4);
  while (left > EPS) {
    if (!sixteenths(s) || !sixteenths(left)) {
      // a tuplet: no plain value spells it, so print the remaining length as one note
      out.push([s, left]);
      break;
    }
    let v: number;
    if (!isInt(s)) {
      const toBeat = Math.ceil(s - EPS) - s;
      const syncopatedQuarter = !rest && Math.abs(left - 1) < EPS && !crosses(s, s + 1);
      v = syncopatedQuarter ? 1 : fit(Math.min(left, toBeat), SUB_BEAT);
    } else if (rest) {
      if (Math.abs(s - 1) < EPS && left >= bpb - EPS) v = bpb; // whole-bar rest, any meter
      else
        v = fit(left, [2, 1, 0.5, 0.25], (c) => c !== 2 || (bpb === 4 && (Math.abs(s - 1) < EPS || Math.abs(s - 3) < EPS)));
    } else {
      v = fit(left, NOTE_VALUES, (c) => {
        const e = s + c;
        if (e > bpb + 1 + EPS) return false;
        if (!crosses(s, e)) return true;
        return Math.abs(s - 1) < EPS || (Math.abs(s - 2) < EPS && (c === 2 || c === 3));
      });
    }
    out.push([s, v]);
    s += v;
    left -= v;
  }
  return out;
}

function parsePitch(pitch: string): { letter: string; alter: number; octave: string } {
  const m = /^([A-G])([b#]*)(-?\d+)$/.exec(pitch);
  if (!m) throw new Error(`Bad pitch ${pitch}`);
  const alter = m[2].startsWith("#") ? m[2].length : m[2] ? -m[2].length : 0;
  return { letter: m[1], alter, octave: m[3] };
}

/** The last bar of the form (sections), or of the melody if it runs longer. */
export function formLength(tune: Tune): number {
  const sec = Math.max(0, ...tune.sections.map((s) => s.startBar + s.bars - 1));
  const mel = Math.max(0, ...tune.melody.map((n) => n.at.bar));
  return Math.max(sec, mel);
}

/**
 * Engrave the whole melody. `keyAlter` maps a letter to its key-signature alteration
 * (F major: `{ B: -1 }`). Rests are filled in only when the melody is written out in full;
 * an "anchors" melody leaves its gaps empty (they're unknown, not silent).
 */
export function engrave(tune: Tune, keyAlter: Record<string, number>): Map<number, EngravedBar> {
  const bpb = tune.meter[0];
  const total = formLength(tune);
  const bars = new Map<number, EngravedBar>();
  for (let b = 1; b <= total; b++) bars.set(b, { bar: b, glyphs: [], beams: [] });

  // ── notes: split at barlines, then into printable values, tied together ──
  const sorted = [...tune.melody].sort((a, b) => a.at.bar - b.at.bar || a.at.beat - b.at.beat);
  for (const n of sorted) {
    const startAbs = (n.at.bar - 1) * bpb + (n.at.beat - 1);
    const endAbs = startAbs + n.beats;
    const parts: Glyph[] = [];
    let a = startAbs;
    while (a < endAbs - EPS) {
      const bar = Math.floor(a / bpb + EPS) + 1;
      const barEnd = bar * bpb;
      const e = Math.min(endAbs, barEnd);
      for (const [beat, value] of chunks(a - (bar - 1) * bpb + 1, e - a, bpb, false)) {
        parts.push({ bar, beat, value, pitch: n.pitch, tieToNext: false, tiedFromPrev: false, accidental: null });
      }
      a = e;
    }
    parts.forEach((p, i) => {
      p.tiedFromPrev = i > 0;
      p.tieToNext = i < parts.length - 1;
      bars.get(p.bar)?.glyphs.push(p);
    });
  }

  for (const eb of bars.values()) {
    eb.glyphs.sort((x, y) => x.beat - y.beat);

    // ── rests fill the gaps of a fully written melody ──
    if (tune.melodyCoverage === "full") {
      const rests: Glyph[] = [];
      const gap = (from: number, to: number) => {
        if (to - from <= EPS) return;
        for (const [beat, value] of chunks(from, to - from, bpb, true)) {
          rests.push({ bar: eb.bar, beat, value, pitch: null, tieToNext: false, tiedFromPrev: false, accidental: null });
        }
      };
      let cursor = 1;
      for (const g of eb.glyphs) {
        gap(cursor, g.beat);
        cursor = Math.max(cursor, g.beat + g.value);
      }
      gap(cursor, bpb + 1);
      eb.glyphs = [...eb.glyphs, ...rests].sort((x, y) => x.beat - y.beat);
    }

    // ── accidentals hold to the barline ──
    const state = new Map<string, number>();
    for (const g of eb.glyphs) {
      if (!g.pitch) continue;
      const { letter, alter, octave } = parsePitch(g.pitch);
      const key = letter + octave;
      const current = state.get(key) ?? keyAlter[letter] ?? 0;
      if (g.tiedFromPrev) {
        // tied over the barline: the tie carries the alteration for this note only
        continue;
      }
      if (alter !== current) {
        g.accidental = alter;
        state.set(key, alter);
      }
    }

    // ── beam runs of eighths inside a beat group ──
    const group = (beat: number) => (bpb === 4 ? (beat < 3 - EPS ? 0 : 1) : Math.floor(beat - 1 + EPS));
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) eb.beams.push(run);
      run = [];
    };
    eb.glyphs.forEach((g, i) => {
      const eighth = g.pitch !== null && Math.abs(g.value - 0.5) < EPS;
      if (!eighth) return flush();
      const prev = run.length ? eb.glyphs[run[run.length - 1]] : null;
      if (prev && (run[run.length - 1] !== i - 1 || group(prev.beat) !== group(g.beat))) flush();
      run.push(i);
    });
    flush();
  }
  return bars;
}
