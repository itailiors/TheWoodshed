import { chordTones, guideTones, type ChordTone } from "./chords";
import { pitchClass } from "./pitch";
import { suggestScales, type ScaleSuggestion } from "./scales";
import { eventSpan, melodyIn } from "./time";
import type { ChordEvent, Tune, VoiceMotion } from "./types";
import { nearestMotion } from "./voiceLeading";

export interface ImprovEntry {
  chord: ChordEvent;
  next?: ChordEvent;
  scales: ScaleSuggestion[];
  guideTones: ChordTone[];
  /** Where each guide tone should land on the next chord. */
  targets: VoiceMotion[];
}

export function improvMap(tune: Tune, chords: ChordEvent[]): ImprovEntry[] {
  const bpb = tune.meter[0];
  return chords.map((chord, i) => {
    const next = chords[i + 1];
    const [s, e] = eventSpan(chord, bpb);
    const mel = melodyIn(tune, s, e).map((n) => pitchClass(n.pitch));
    const gts = guideTones(chord);
    return {
      chord,
      next,
      scales: suggestScales(chord, next, mel),
      guideTones: gts,
      targets: next ? gts.map((g) => nearestMotion(g.note, chordTones(next))) : [],
    };
  });
}
