import { describe, expect, it } from "vitest";
import { coopBlues } from "../src/fixtures/coopBlues";
import { midiOf } from "../src/pitch";
import { absBeat } from "../src/time";
import { KEYS, transposeTune } from "../src/transpose";
import { VOICING_STYLES } from "../src/voicing";
import { structuralTops, voiceTheTune } from "../src/voiceTheTune";

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
