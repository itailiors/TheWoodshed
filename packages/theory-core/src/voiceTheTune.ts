import { isSwungFeel, swingTime } from "./band";
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

/** "Hear the head" plays at most this fast: slow enough to follow the voicings go by. */
export const HEAD_MAX_TEMPO = 112;

/** One sounding event of the head, in seconds from the start. */
export interface HeadEvent {
  midis: number[];
  at: number;
  seconds: number;
  vel: number;
}

/**
 * The head in time, as a pianist plays it from the voiced lead sheet (`path`, from `voiceTheTune`):
 * each chord's voicing at its attack with the melody line over it. The voicing's top note is the
 * melody's, so the right hand plays it once, in the line. Swung feels are swung exactly like the
 * band's head (`swingTime` at the player's swing ratio); the tempo is capped at `HEAD_MAX_TEMPO`.
 * `steps` are the chord attacks, for a stage that follows along.
 */
export function headScore(tune: Tune, path: VoicingForm[], swing: number): { comp: HeadEvent[]; line: HeadEvent[]; steps: number[] } {
  const bpb = tune.meter[0];
  const spb = 60 / Math.min(tune.tempo, HEAD_MAX_TEMPO);
  const time = (beat: number) => (isSwungFeel(tune.feel) ? swingTime(beat, swing) : beat) * spb;
  const span = (start: number, beats: number) => ({ at: time(start), seconds: time(start + beats) - time(start) });
  const tops = structuralTops(tune);

  const comp = tune.harmony.map((c, i) => {
    const voiced = path[i].notes.map((n) => n.midi);
    const midis = tops[i] !== undefined && voiced[voiced.length - 1] === tops[i] ? voiced.slice(0, -1) : voiced;
    const { at, seconds } = span(absBeat(c.at, bpb), c.beats);
    return { midis, at, seconds: seconds * 0.97, vel: 0.42 };
  });
  const line = tune.melody.map((n) => {
    const { at, seconds } = span(absBeat(n.at, bpb), n.beats);
    return { midis: [midiOf(n.pitch)], at, seconds: seconds * 0.92, vel: 0.72 };
  });
  return { comp, line, steps: comp.map((c) => c.at) };
}
