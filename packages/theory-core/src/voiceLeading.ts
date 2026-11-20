import type { ChordTone } from "./chords";
import { chroma, mod } from "./pitch";
import type { VoicePath } from "./learn/facts";
import type { VoiceMotion } from "./types";

/** Move one voice to the nearest tone of the target chord (ties go down). */
export function nearestMotion(from: string, target: ChordTone[]): VoiceMotion {
  let best: VoiceMotion | null = null;
  for (const t of target) {
    let d = mod(chroma(t.note) - chroma(from), 12);
    if (d > 6) d -= 12;
    if (d === 6) d = -6;
    const better =
      !best ||
      Math.abs(d) < Math.abs(best.semitones) ||
      (Math.abs(d) === Math.abs(best.semitones) && d < best.semitones);
    if (better) best = { from, to: t.note, semitones: d, toDegree: t.degree };
  }
  if (!best) throw new Error("nearestMotion: empty target");
  return best;
}

/** One stop of a voice path with its holds folded in. */
export interface PathStop {
  /** The note as the voice arrives on it. */
  note: string;
  /** How many following chords it holds through (0: it moves on at once). */
  holds: number;
  /** Its last spelling, when the held key was renamed on the way (E♭ held as D♯). */
  respelled?: string;
}

/**
 * A voice path with each run of holds collapsed into one stop: F → E♭ → E♭ → D♯ → D♯ → D → C
 * becomes F, E♭ (held, respelled D♯), D, C. Only zero-semitone motions fold; the notes come
 * from the path itself.
 */
export function collapseHolds(path: VoicePath): PathStop[] {
  const out: PathStop[] = [{ note: path.from, holds: 0 }];
  for (const m of path.motions) {
    const last = out[out.length - 1];
    if (m.semitones !== 0) {
      out.push({ note: m.to, holds: 0 });
      continue;
    }
    last.holds++;
    last.respelled = m.to !== last.note ? m.to : undefined;
  }
  return out.map((s) => (s.respelled ? s : { note: s.note, holds: s.holds }));
}

export const motionCost =(ms: VoiceMotion[]) => ms.reduce((s, m) => s + Math.abs(m.semitones), 0);
