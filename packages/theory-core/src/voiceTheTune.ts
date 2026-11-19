import { midiOf } from "./pitch";
import { absBeat } from "./time";
import type { Tune } from "./types";
import type { VoicingStyle } from "./voicing";
import { voiceLeadForms, type VoicingForm } from "./voicingForms";

/**
 * "Voice the tune": comp the head with the melody on top, one voicing per chord, as a pianist
 * voices a lead sheet. Only charts with a melody have anything to put on top (public-domain
 * charts are changes only, architecture rule 0).
 */

/** How early a melody note can start and still belong to the next chord (an eighth anticipation). */
const ANTICIPATION = 0.5;

/**
 * The structural melody note of each chord, as MIDI: the longest note starting in the chord's
 * span (an eighth-note anticipation of the chord counts as its own), ties going to the note
 * nearest the chord's attack. `undefined` where the melody rests, or the chart has no melody.
 */
export function structuralTops(tune: Tune): (number | undefined)[] {
  const bpb = tune.meter[0];
  const notes = tune.melody.map((n) => ({ start: absBeat(n.at, bpb), beats: n.beats, midi: midiOf(n.pitch) }));
  return tune.harmony.map((c) => {
    const attack = absBeat(c.at, bpb);
    const from = attack - ANTICIPATION;
    const span = notes.filter((n) => n.start >= from && n.start < from + c.beats);
    const best = span.reduce<(typeof span)[number] | undefined>(
      (b, n) => (!b || n.beats > b.beats || (n.beats === b.beats && Math.abs(n.start - attack) < Math.abs(b.start - attack)) ? n : b),
      undefined,
    );
    return best?.midi;
  });
}

/** True when the chart has a melody to voice under. */
export const hasMelody = (tune: Tune) => tune.melody.length > 0;

/** The tune's changes voice-led through one style, each chord with its structural melody note on top. */
export function voiceTheTune(tune: Tune, style: VoicingStyle, startForm?: string): VoicingForm[] {
  return voiceLeadForms(tune.harmony, style, startForm, structuralTops(tune));
}
