import { chordTones } from "./chords";
import { chroma, mod } from "./pitch";
import { absBeat } from "./time";
import type { ChordEvent, Tune } from "./types";

/**
 * The backing band: a bass line and a drum part generated from the harmony and the
 * tune's feel. Pure and deterministic; the web player just schedules what comes out.
 */

export type BassStyle = "walking" | "two-feel";

export interface BassNote {
  /** Absolute beat from the top of the form (0-based). */
  beat: number;
  midi: number;
  /** Beats. */
  dur: number;
  vel: number;
  /**
   * anchor: the downbeat of a chord; chord-tone: the middle of the bar; approach: the
   * chromatic lead-in; triplet: the inner note of a triplet pickup; ghost: a dead,
   * barely-pitched note (the rake into a triplet).
   */
  role: "anchor" | "chord-tone" | "approach" | "triplet" | "ghost";
}

/** Upright range we write in: E1 (open E string) up to D3. */
export const BASS_LOW = 28;
export const BASS_HIGH = 50;
const START_NEAR = 36; // C2: the middle of the low register

/** Swing feels walk; bossa, ballad and straight eighths play in two. */
export function bassStyleFor(feel: Tune["feel"]): BassStyle {
  return feel === "swing" || feel === "waltz" ? "walking" : "two-feel";
}

/** The pitch of chroma `pc` nearest `ref` inside the bass range (ties go down). */
export function placeNear(pc: number, ref: number, lo = BASS_LOW, hi = BASS_HIGH): number {
  let best = -1;
  for (let m = lo; m <= hi; m++) {
    if (mod(m, 12) !== mod(pc, 12)) continue;
    if (best < 0 || Math.abs(m - ref) < Math.abs(best - ref)) best = m;
  }
  return best;
}

type BassChord = Pick<ChordEvent, "at" | "beats" | "root" | "quality" | "extensions" | "alterations" | "bass">;

const bassPc = (c: BassChord) => chroma(c.bass ?? c.root);

/** Basic chord tones (1-3-5-7 shell, no added tensions): what a walking line outlines. */
function coreChromas(c: BassChord): number[] {
  return [...new Set(chordTones({ ...c, extensions: [] }).map((t) => chroma(t.note)))];
}

function fifthPc(c: BassChord): number {
  const t = chordTones({ ...c, extensions: [] }).find((x) => ["5", "b5", "#5"].includes(x.degree));
  return t ? chroma(t.note) : chroma(c.root);
}

/** Every pitch in range whose chroma is in `pcs`. */
const pitchesOf = (pcs: number[]) => {
  const out: number[] = [];
  for (let m = BASS_LOW; m <= BASS_HIGH; m++) if (pcs.includes(mod(m, 12))) out.push(m);
  return out;
};

/** How awkward a line is to play and hear: favours steps and skips, keeps a direction. */
function lineCost(notes: number[]): number {
  let cost = 0;
  let lastDir = 0;
  for (let i = 1; i < notes.length; i++) {
    const d = notes[i] - notes[i - 1];
    const a = Math.abs(d);
    cost += a;
    if (a === 0) cost += 4; // a repeated note stalls the walk
    if (a > 7) cost += 5; // leaps past a 5th sound like a different line
    const dir = Math.sign(d);
    if (lastDir !== 0 && dir !== 0 && dir !== lastDir) cost += 1.5;
    if (dir !== 0) lastDir = dir;
  }
  return cost;
}

/**
 * One walking segment: `anchor` on the downbeat, chord tones in the middle, and a
 * chromatic approach (a half step above or below) into `target` on the last beat.
 * All middle-note combinations are tried (segments are at most a bar, so 3 slots)
 * and the smoothest line wins. Ties go to the first found, so it is deterministic.
 */
function walkSegment(anchor: number, target: number, length: number, tones: number[]): number[] {
  if (length <= 1) return [anchor];
  const approaches = [target - 1, target + 1].filter((m) => m >= BASS_LOW && m <= BASS_HIGH);
  const middle = length - 2;
  const pool = pitchesOf(tones).filter((m) => Math.abs(m - anchor) <= 12);
  let best: number[] = [anchor, approaches[0]];
  let bestCost = Infinity;
  const walk = (line: number[]) => {
    if (line.length === middle + 1) {
      for (const a of approaches) {
        const full = [...line, a];
        const c = lineCost([...full, target]);
        if (c < bestCost) {
          bestCost = c;
          best = full;
        }
      }
      return;
    }
    for (const m of pool) walk([...line, m]);
  };
  walk([anchor]);
  return best;
}

/** Walking bass: quarter notes outlining each chord, with a chromatic approach into the next. */
export function walkingBass(chords: BassChord[], beatsPerBar: number): BassNote[] {
  const out: BassNote[] = [];
  let prev = START_NEAR;
  chords.forEach((c, i) => {
    const next = chords[i + 1] ?? chords[0];
    const tones = coreChromas(c);
    const start = absBeat(c.at, beatsPerBar);
    // Split a long chord into bar-sized segments: root first, then the 5th, then root again.
    const segs: { at: number; len: number; pc: number }[] = [];
    for (let off = 0, k = 0; off < c.beats; off += beatsPerBar, k++) {
      segs.push({ at: start + off, len: Math.min(beatsPerBar, c.beats - off), pc: k % 2 === 0 ? bassPc(c) : fifthPc(c) });
    }
    segs.forEach((s, j) => {
      const anchor = placeNear(s.pc, prev);
      const targetPc = j + 1 < segs.length ? segs[j + 1].pc : bassPc(next);
      const wraps = i === chords.length - 1 && j === segs.length - 1 && out.length > 0;
      // The last chord leads back into the first note of the form, in the octave it was played.
      const target = wraps ? out[0].midi : placeNear(targetPc, anchor);
      const line = walkSegment(anchor, target, s.len, tones);
      line.forEach((midi, b) => {
        const role: BassNote["role"] = b === 0 ? "anchor" : b === line.length - 1 && s.len > 1 ? "approach" : "chord-tone";
        out.push({ beat: s.at + b, midi, dur: 0.92, vel: role === "anchor" ? 0.82 : role === "approach" ? 0.74 : 0.68, role });
      });
      prev = line[line.length - 1];
    });
  });
  return out;
}

/** Two-feel: root on 1, the 5th on 3 (half notes), every bar. */
export function twoFeelBass(chords: BassChord[], beatsPerBar: number): BassNote[] {
  const out: BassNote[] = [];
  let prev = START_NEAR;
  for (const c of chords) {
    const start = absBeat(c.at, beatsPerBar);
    for (let off = 0; off < c.beats; off += beatsPerBar) {
      const len = Math.min(beatsPerBar, c.beats - off);
      const root = placeNear(bassPc(c), prev);
      const hasThree = len >= 3;
      out.push({ beat: start + off, midi: root, dur: hasThree ? 1.9 : len * 0.95, vel: 0.8, role: "anchor" });
      prev = root;
      if (hasThree) {
        const fifth = placeNear(fifthPc(c), root);
        out.push({ beat: start + off + 2, midi: fifth, dur: (len - 2) * 0.95, vel: 0.7, role: "chord-tone" });
        prev = fifth;
      }
    }
  }
  return out;
}

// ── humanizing ──────────────────────────────────────────────────────────

/** A small seeded PRNG (mulberry32), so "random" variations repeat exactly for a given tune. */
export function seededRandom(seed: string | number): () => number {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How hard the bassist digs in on each beat of the bar. In 4/4 the line leans on 2 and 4
 * (with the hi-hat); in a waltz the downbeat carries the bar and 2 and 3 are lighter.
 */
export function walkingAccent(beatInBar: number, beatsPerBar: number): number {
  if (beatsPerBar === 3) return [0.82, 0.68, 0.72][beatInBar] ?? 0.7;
  if (beatsPerBar === 4) return [0.74, 0.82, 0.72, 0.82][beatInBar] ?? 0.74;
  return beatInBar % 2 === 1 ? 0.8 : 0.72;
}

export interface WalkFeel {
  /** Seed for the variations (the tune id is a good one). */
  seed?: string | number;
  /** Chance that a chord change is approached with an eighth-note triplet pickup. */
  tripletChance?: number;
  /** Chance that a middle chord tone is left out, the note before it held through. */
  dropChance?: number;
}

/**
 * Turn a strict quarter-note walk into something a bassist would play:
 *  - velocities follow the beat (accents on 2 and 4 in 4/4);
 *  - now and then the lead-in to a chord change becomes a triplet: a dead "rake" of the
 *    previous note, then a two-step chromatic run into the target (E, E♭ → D);
 *  - now and then a middle chord tone drops out and the previous note rings for two beats.
 * Downbeats are never touched, and every chord is still approached by a half step.
 */
export function humanizeWalk(line: BassNote[], beatsPerBar: number, feel: WalkFeel = {}): BassNote[] {
  const { seed = "walk", tripletChance = 0.2, dropChance = 0.1 } = feel;
  const rnd = seededRandom(seed);
  const out: BassNote[] = [];
  line.forEach((n, i) => {
    const vel = walkingAccent(mod(Math.round(n.beat), beatsPerBar), beatsPerBar);
    const prev = out[out.length - 1];
    const target = (line[i + 1] ?? line[0]).midi;
    const side = n.midi - target; // ±1 for an approach note

    if (n.role === "approach" && Math.abs(side) === 1 && prev && rnd() < tripletChance) {
      const run = n.midi + side; // a whole step from the target, same side
      if (run >= BASS_LOW && run <= BASS_HIGH) {
        out.push(
          { beat: n.beat, midi: prev.midi, dur: 0.28, vel: 0.34, role: "ghost" },
          { beat: n.beat + 1 / 3, midi: run, dur: 0.3, vel: vel * 0.86, role: "triplet" },
          { beat: n.beat + 2 / 3, midi: n.midi, dur: 0.32, vel, role: "approach" },
        );
        return;
      }
    }
    // A dropped beat: only right after a plain quarter note on the beat before.
    if (n.role === "chord-tone" && prev && prev.beat === n.beat - 1 && prev.role !== "ghost" && rnd() < dropChance) {
      prev.dur += 1;
      return;
    }
    out.push({ ...n, vel: n.role === "anchor" ? Math.max(vel, 0.78) : vel });
  });
  return out;
}

export function bassLine(tune: Pick<Tune, "feel" | "meter"> & { id?: string }, chords: BassChord[]): BassNote[] {
  const bpb = tune.meter[0];
  if (bassStyleFor(tune.feel) === "two-feel") return twoFeelBass(chords, bpb);
  return humanizeWalk(walkingBass(chords, bpb), bpb, { seed: `${tune.id ?? "tune"}:${chords.length}` });
}

// ── drums ────────────────────────────────────────────────────────────────

/**
 * ride: ride cymbal · hat: the foot "chick" (pedal hi-hat, layered with a closed hat for
 * crispness) · snare: ghosted comping notes · brush: a soft sweep texture · kick: feathered.
 */
export type DrumVoice = "ride" | "hat" | "snare" | "brush" | "kick";

export interface DrumHit {
  beat: number;
  voice: DrumVoice;
  vel: number;
  /** Beats (only the brush sweep really uses it). */
  dur: number;
}

/** The swung "a" of "ding-a": two-thirds of the way through the beat. */
export const SWING_SKIP = 2 / 3;

/**
 * Which beats (0-based) get the hi-hat "chick". In 4/4 that is 2 and 4. A jazz waltz
 * has no beat 4, so the foot plays 2 and 3; other meters use the even beats.
 */
export function hatBeats(beatsPerBar: number): number[] {
  if (beatsPerBar === 4) return [1, 3];
  if (beatsPerBar === 3) return [1, 2];
  return Array.from({ length: beatsPerBar }, (_, i) => i).filter((i) => i % 2 === 1);
}

/** The ride pattern for one bar, as beat offsets: "ding, ding-a-ding" in swing. */
export function rideOffsets(feel: Tune["feel"], beatsPerBar: number): { at: number; vel: number }[] {
  const beats = Array.from({ length: beatsPerBar }, (_, i) => i);
  if (feel === "bossa" || feel === "straight8") {
    return beats.flatMap((b) => [
      { at: b, vel: 0.55 },
      { at: b + 0.5, vel: 0.4 },
    ]);
  }
  const hats = new Set(hatBeats(beatsPerBar));
  if (feel === "ballad") return beats.map((b) => ({ at: b, vel: hats.has(b) ? 0.42 : 0.34 }));
  // swing / waltz: quarter notes played full, the backbeats a little harder, and the
  // swung skip note after 2 (and 4) ghosted well under them.
  const skips = beatsPerBar === 3 ? [1] : beats.filter((b) => b % 2 === 1);
  return beats.flatMap((b) => {
    const hit = { at: b, vel: hats.has(b) ? RIDE_BACKBEAT : RIDE_BEAT };
    return skips.includes(b) ? [hit, { at: b + SWING_SKIP, vel: RIDE_SKIP }] : [hit];
  });
}

/** Ride dynamics: the quarter notes carry the time, the skip note is a ghost. */
export const RIDE_BEAT = 0.68;
export const RIDE_BACKBEAT = 0.76;
export const RIDE_SKIP = 0.3;
/** The foot chick on 2 and 4 is a strong, crisp accent. */
export const HAT_ACCENT = 0.9;

/**
 * A whole drum part for `bars` bars. `seed` places the drummer's ghosted snare comping
 * (a soft note on a swung triplet partial every few bars), so it repeats per tune.
 */
export function drumPattern(feel: Tune["feel"], beatsPerBar: number, bars: number, seed: string | number = "drums"): DrumHit[] {
  const out: DrumHit[] = [];
  const ride = rideOffsets(feel, beatsPerBar);
  const hats = hatBeats(beatsPerBar);
  const rnd = seededRandom(seed);
  const swung = feel === "swing" || feel === "waltz";
  for (let bar = 0; bar < bars; bar++) {
    const top = bar * beatsPerBar;
    for (const r of ride) out.push({ beat: top + r.at, voice: "ride", vel: r.vel, dur: 0.5 });
    for (const h of hats) out.push({ beat: top + h, voice: "hat", vel: HAT_ACCENT, dur: 0.1 });
    if (swung && rnd() < 0.3) {
      // Snare chatter: the "a" of the last beat (a pickup into the next bar) or of beat 2.
      const at = rnd() < 0.6 ? beatsPerBar - 1 + SWING_SKIP : 1 + SWING_SKIP;
      out.push({ beat: top + at, voice: "snare", vel: 0.16 + rnd() * 0.1, dur: 0.2 });
    }
    for (let b = 0; b < beatsPerBar; b++) {
      // A brush sweep across every beat keeps a soft, continuous texture under the ride.
      if (feel !== "bossa" && feel !== "straight8") out.push({ beat: top + b, voice: "brush", vel: b === 0 ? 0.42 : 0.32, dur: 0.95 });
      // Feathered bass drum: four (or three) barely audible quarter notes.
      const kick = feel === "bossa" ? b === 0 || b === 2 : true;
      if (kick) out.push({ beat: top + b, voice: "kick", vel: b === 0 ? 0.3 : 0.18, dur: 0.3 });
    }
  }
  return out.sort((a, b) => a.beat - b.beat);
}
