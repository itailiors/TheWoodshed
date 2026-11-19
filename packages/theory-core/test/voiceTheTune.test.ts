import { describe, expect, it } from "vitest";
import { coopBlues } from "../src/fixtures/coopBlues";
import { midiOf } from "../src/pitch";
import { absBeat } from "../src/time";
import { KEYS, transposeTune } from "../src/transpose";
import { VOICING_STYLES } from "../src/voicing";
import { HEAD_MAX_TEMPO, headScore, structuralTops, voiceTheTune } from "../src/voiceTheTune";
import { SWING_HARD, SWING_SKIP, swingTime } from "../src/band";

const STYLES = VOICING_STYLES.map((s) => s.id);
const BPB = coopBlues.meter[0];

describe("structuralTops", () => {
  it("picks the structural melody note of each of Co-op Blues' first six chords", () => {
    const tops = structuralTops(coopBlues).slice(0, 6);
    expect(tops).toEqual([
      midiOf("C5"), // F6: all eighths, so the one nearest the attack (the "and" of 1)
      midiOf("F5"), // Bb7: the F anticipated on the "and" of 4 in bar 1, held 1½ beats
      midiOf("A4"), // F6: the quarter on beat 1 of bar 3
      midiOf("Eb5"), // Cm7: the eighth on its downbeat (the C before it is an anticipation of this chord, but further away)
      midiOf("A4"), // F7: on its downbeat
      midiOf("D5"), // Bb7: anticipated D (1½ beats) ties the A♭ (1½) and is nearer the attack
    ]);
  });

  it("every top is a melody note that starts in its chord's span (an eighth early counts), and a chart with no melody has none", () => {
    const tops = structuralTops(coopBlues);
    expect(tops).toHaveLength(coopBlues.harmony.length);
    coopBlues.harmony.forEach((c, i) => {
      if (tops[i] === undefined) return;
      const from = absBeat(c.at, BPB) - 0.5;
      const to = from + c.beats;
      const inSpan = coopBlues.melody.filter((n) => absBeat(n.at, BPB) >= from && absBeat(n.at, BPB) < to).map((n) => midiOf(n.pitch));
      expect(inSpan).toContain(tops[i]);
    });
    expect(structuralTops({ ...coopBlues, melody: [] }).every((t) => t === undefined)).toBe(true);
  });

  it("follows the melody into every key (same notes, moved with the tune)", () => {
    const home = structuralTops(coopBlues);
    for (const k of KEYS) {
      const t = transposeTune(coopBlues, k);
      const shift = midiOf(t.melody[0].pitch) - midiOf(coopBlues.melody[0].pitch);
      expect(structuralTops(t)).toEqual(home.map((m) => (m === undefined ? undefined : m + shift)));
    }
  });
});

describe("voiceTheTune", () => {
  it("puts the melody note on top of every chord, in every style and every key (exhaustive)", () => {
    for (const k of KEYS) {
      const t = transposeTune(coopBlues, k);
      const tops = structuralTops(t);
      for (const style of STYLES) {
        const forms = voiceTheTune(t, style);
        expect(forms).toHaveLength(t.harmony.length);
        forms.forEach((f, i) => {
          const ms = f.notes.map((n) => n.midi);
          if (tops[i] !== undefined) expect(Math.max(...ms), `${k} ${style} chord ${i}`).toBe(tops[i]);
          // the bass is still the lowest note, in the left hand
          expect(Math.min(...ms)).toBe(ms[0]);
        });
      }
    }
  }, 30_000);

  it("honours a start form on the first chord when it fits under the melody", () => {
    const first = voiceTheTune(coopBlues, "close")[0];
    expect(voiceTheTune(coopBlues, "close", first.id)[0].id).toBe(first.id);
  });
});

describe("headScore", () => {
  const path = voiceTheTune(coopBlues, "close");
  const spb = 60 / Math.min(coopBlues.tempo, HEAD_MAX_TEMPO);

  it("comps each chord at its attack under the melody, and the melody note isn't doubled in the voicing", () => {
    const { comp, line, steps } = headScore(coopBlues, path, SWING_SKIP);
    const tops = structuralTops(coopBlues);
    expect(comp).toHaveLength(coopBlues.harmony.length);
    expect(line).toHaveLength(coopBlues.melody.length);
    expect(steps).toEqual(comp.map((c) => c.at));
    comp.forEach((c, i) => {
      expect(c.at).toBeCloseTo(swingTime(absBeat(coopBlues.harmony[i].at, BPB), SWING_SKIP) * spb);
      const voiced = path[i].notes.map((n) => n.midi);
      expect(c.midis).toEqual(tops[i] === undefined ? voiced : voiced.slice(0, -1)); // the top is the melody's
    });
    line.forEach((n, i) => expect(n.midis).toEqual([midiOf(coopBlues.melody[i].pitch)]));
    // the line sits over the comp
    expect(Math.min(...line.map((n) => n.vel))).toBeGreaterThan(Math.max(...comp.map((c) => c.vel)));
  });

  it("swings like the band: an 'and' lands at the swing ratio and its length shrinks to fit; straight feels stay straight", () => {
    const and = coopBlues.melody.findIndex((n) => absBeat(n.at, BPB) % 1 === 0.5 && n.beats === 0.5);
    expect(and).toBeGreaterThanOrEqual(0);
    const b = absBeat(coopBlues.melody[and].at, BPB);
    const hard = headScore(coopBlues, path, SWING_HARD).line[and];
    expect(hard.at).toBeCloseTo((Math.floor(b) + SWING_HARD) * spb);
    expect(hard.seconds).toBeLessThan(0.5 * spb); // the short note of the swung pair
    const straight = headScore({ ...coopBlues, feel: "bossa" }, path, SWING_HARD).line[and];
    expect(straight.at).toBeCloseTo(b * spb);
  });

  it("is played at a practice tempo: never faster than HEAD_MAX_TEMPO", () => {
    const fast = headScore({ ...coopBlues, tempo: 300 }, path, SWING_SKIP);
    const at = headScore({ ...coopBlues, tempo: HEAD_MAX_TEMPO }, path, SWING_SKIP);
    expect(fast.comp.map((c) => c.at)).toEqual(at.comp.map((c) => c.at));
  });
});
