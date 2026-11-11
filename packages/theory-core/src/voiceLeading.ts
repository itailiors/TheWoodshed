import type { ChordTone } from "./chords";
import { chroma, mod } from "./pitch";
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

export const motionCost = (ms: VoiceMotion[]) => ms.reduce((s, m) => s + Math.abs(m.semitones), 0);
