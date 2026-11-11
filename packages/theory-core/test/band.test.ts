import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BASS_HIGH,
  BASS_LOW,
  bassLine,
  bassStyleFor,
  drumPattern,
  HAT_ACCENT,
  hatBeats,
  humanizeWalk,
  RIDE_BACKBEAT,
  SWING_SKIP,
  walkingAccent,
  rideOffsets,
  twoFeelBass,
  walkingBass,
} from "../src/band";
import { chordChromas } from "../src/chords";
import { someday } from "../src/fixtures/someday";
import { chroma, mod } from "../src/pitch";
import { absBeat, sortedHarmony } from "../src/time";
import { progressionArb } from "./arbitraries";

const pc = (m: number) => mod(m, 12);

describe("walking bass", () => {
  it("plays one quarter note on every beat of every chord, inside the upright's range", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const bpb = tune.meter[0];
        const chords = sortedHarmony(tune);
        const line = walkingBass(chords, bpb);
        const total = chords.reduce((n, c) => n + c.beats, 0);
        expect(line.map((n) => n.beat)).toEqual(Array.from({ length: total }, (_, i) => i));
        for (const n of line) {
          expect(n.midi).toBeGreaterThanOrEqual(BASS_LOW);
          expect(n.midi).toBeLessThanOrEqual(BASS_HIGH);
        }
      }),
    );
  });

  it("lands the root on each chord's downbeat and approaches the next chord by a half step", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const bpb = tune.meter[0];
        const chords = sortedHarmony(tune);
        const line = walkingBass(chords, bpb);
        const at = new Map(line.map((n) => [n.beat, n]));
        chords.forEach((c, i) => {
          const start = absBeat(c.at, bpb);
          expect(pc(at.get(start)!.midi)).toBe(chroma(c.root));
          const next = chords[i + 1] ?? chords[0];
          const nextStart = (start + c.beats) % line.length;
          const approach = at.get(start + c.beats - 1)!;
          expect(approach.role).toBe("approach");
          expect(Math.abs(at.get(nextStart)!.midi - approach.midi)).toBe(1);
          expect(pc(at.get(nextStart)!.midi)).toBe(chroma(next.root));
        });
      }),
    );
  });

  it("fills the middle of the bar with chord tones", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const chords = sortedHarmony(tune);
        const line = walkingBass(chords, tune.meter[0]);
        for (const n of line.filter((x) => x.role === "chord-tone")) {
          const c = chords.find((h) => {
            const s = absBeat(h.at, tune.meter[0]);
            return n.beat >= s && n.beat < s + h.beats;
          })!;
          expect(chordChromas(c).has(pc(n.midi))).toBe(true);
        }
      }),
    );
  });

  it("moves mostly by step or skip (no leaps over an octave)", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const line = walkingBass(sortedHarmony(tune), tune.meter[0]);
        for (let i = 1; i < line.length; i++) expect(Math.abs(line[i].midi - line[i - 1].midi)).toBeLessThanOrEqual(12);
      }),
    );
  });

  it("walks Someday in three: Bb on the downbeat, then a chord tone, then a chromatic lead-in", () => {
    const line = walkingBass(sortedHarmony(someday), 3);
    expect(line.slice(0, 3).map((n) => n.role)).toEqual(["anchor", "chord-tone", "approach"]);
    expect(pc(line[0].midi)).toBe(chroma("Bb"));
  });
});

describe("two-feel bass", () => {
  it("plays the root on 1 and the fifth on 3 of every bar", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const bpb = tune.meter[0];
        const chords = sortedHarmony(tune);
        const line = twoFeelBass(chords, bpb);
        for (const c of chords) {
          const s = absBeat(c.at, bpb);
          const notes = line.filter((n) => n.beat >= s && n.beat < s + c.beats);
          expect(notes.map((n) => n.beat - s)).toEqual([0, 2]);
          expect(pc(notes[0].midi)).toBe(chroma(c.root));
          const interval = mod(notes[1].midi - notes[0].midi, 12);
          expect([6, 7, 8]).toContain(interval); // b5, 5 or #5
        }
      }),
    );
  });

  it("is chosen by feel", () => {
    expect(bassStyleFor("swing")).toBe("walking");
    expect(bassStyleFor("waltz")).toBe("walking");
    expect(bassStyleFor("ballad")).toBe("two-feel");
    expect(bassStyleFor("bossa")).toBe("two-feel");
    expect(bassLine({ feel: "ballad", meter: [4, 4] }, sortedHarmony(someday)).every((n) => n.beat % 4 === 0 || n.beat % 4 === 2)).toBe(true);
  });
});

describe("drums", () => {
  it("swing ride is ding, ding-a-ding, ding-a: every beat plus the swung skip after 2 and 4", () => {
    expect(rideOffsets("swing", 4).map((r) => +r.at.toFixed(3))).toEqual([0, 1, 1.667, 2, 3, 3.667]);
    expect(rideOffsets("waltz", 3).map((r) => +r.at.toFixed(3))).toEqual([0, 1, 1.667, 2]);
  });

  it("puts the hi-hat chick strictly on 2 and 4 in 4/4", () => {
    const hits = drumPattern("swing", 4, 8);
    const hats = hits.filter((h) => h.voice === "hat");
    expect(hats).toHaveLength(16);
    expect(new Set(hats.map((h) => h.beat % 4))).toEqual(new Set([1, 3]));
    expect(hatBeats(3)).toEqual([1, 2]);
  });

  it("keeps a brush sweep under every beat and stays inside the form", () => {
    fc.assert(
      fc.property(fc.constantFrom(3, 4), fc.integer({ min: 1, max: 32 }), (bpb, bars) => {
        const hits = drumPattern("swing", bpb, bars);
        const brush = hits.filter((h) => h.voice === "brush").map((h) => h.beat);
        expect(brush).toEqual(Array.from({ length: bpb * bars }, (_, i) => i));
        for (const h of hits) {
          expect(h.beat).toBeGreaterThanOrEqual(0);
          expect(h.beat).toBeLessThan(bpb * bars);
        }
      }),
    );
  });
});

describe("humanized walk", () => {
  const walk = (tune: Parameters<typeof sortedHarmony>[0], feel = {}) => {
    const chords = sortedHarmony(tune);
    const strict = walkingBass(chords, tune.meter[0]);
    return { chords, strict, human: humanizeWalk(strict, tune.meter[0], feel) };
  };

  it("never touches a downbeat, keeps notes in order, and still approaches every chord by a half step", () => {
    fc.assert(
      fc.property(progressionArb, fc.string(), (tune, seed) => {
        const { strict, human } = walk(tune, { seed, tripletChance: 0.6, dropChance: 0.5 });
        const anchors = (ns: typeof strict) => ns.filter((n) => n.role === "anchor").map((n) => [n.beat, n.midi]);
        expect(anchors(human)).toEqual(anchors(strict));
        for (let i = 1; i < human.length; i++) expect(human[i].beat).toBeGreaterThan(human[i - 1].beat);
        human.forEach((n, i) => {
          if (n.role !== "anchor") return;
          const before = human[i - 1] ?? human[human.length - 1];
          if (strict.length > 1) expect(Math.abs(before.midi - n.midi)).toBe(1);
        });
        for (const n of human) {
          expect(n.midi).toBeGreaterThanOrEqual(BASS_LOW);
          expect(n.midi).toBeLessThanOrEqual(BASS_HIGH);
        }
      }),
    );
  });

  it("writes a triplet as a ghost rake plus a two-step chromatic run, on the triplet grid", () => {
    fc.assert(
      fc.property(progressionArb, fc.string(), (tune, seed) => {
        const { human } = walk(tune, { seed, tripletChance: 1, dropChance: 0 });
        human.forEach((n, i) => {
          if (n.role !== "ghost") return;
          const [run, approach] = [human[i + 1], human[i + 2]];
          expect(run.role).toBe("triplet");
          expect(run.beat - n.beat).toBeCloseTo(1 / 3);
          expect(approach.beat - n.beat).toBeCloseTo(2 / 3);
          expect(run.midi - approach.midi).toBe(approach.midi - (human[i + 3] ?? human[0]).midi);
          expect(n.vel).toBeLessThan(run.vel);
        });
      }),
    );
  });

  it("holds the note before a dropped beat for two beats, so the time never goes silent", () => {
    fc.assert(
      fc.property(progressionArb, fc.string(), (tune, seed) => {
        const { human } = walk(tune, { seed, tripletChance: 0, dropChance: 1 });
        for (let i = 1; i < human.length; i++) {
          const gap = human[i].beat - human[i - 1].beat;
          expect(human[i - 1].dur).toBeGreaterThanOrEqual(gap - 0.1);
        }
      }),
    );
  });

  it("accents 2 and 4 in 4/4, and is the identity on pitches with no variations", () => {
    expect(walkingAccent(1, 4)).toBeGreaterThan(walkingAccent(0, 4));
    expect(walkingAccent(3, 4)).toBeGreaterThan(walkingAccent(2, 4));
    fc.assert(
      fc.property(progressionArb, (t) => {
        const { strict, human } = walk(t, { tripletChance: 0, dropChance: 0 });
        expect(human.map((n) => [n.beat, n.midi])).toEqual(strict.map((n) => [n.beat, n.midi]));
      }),
    );
    expect(walkingAccent(0, 3)).toBeGreaterThan(walkingAccent(1, 3)); // a waltz leans on 1
  });

  it("is repeatable for a seed and different across seeds", () => {
    const a = walk(someday, { seed: "x", tripletChance: 0.5, dropChance: 0.3 }).human;
    const b = walk(someday, { seed: "x", tripletChance: 0.5, dropChance: 0.3 }).human;
    expect(a).toEqual(b);
    const seeds = ["a", "b", "c", "d", "e", "f"].map((s) => JSON.stringify(walk(someday, { seed: s, tripletChance: 0.5, dropChance: 0.3 }).human));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
});

describe("drum dynamics", () => {
  it("ghosts the skip note under the ride quarters, and accents the hi-hat", () => {
    const ride = rideOffsets("swing", 4);
    const beats = ride.filter((r) => Number.isInteger(r.at));
    const skips = ride.filter((r) => !Number.isInteger(r.at));
    expect(Math.min(...beats.map((r) => r.vel))).toBeGreaterThan(Math.max(...skips.map((r) => r.vel)) * 2);
    expect(HAT_ACCENT).toBeGreaterThan(RIDE_BACKBEAT);
  });

  it("puts ghost snare notes only on swung triplet partials, softly", () => {
    fc.assert(
      fc.property(fc.constantFrom(3, 4), fc.integer({ min: 1, max: 32 }), fc.string(), (bpb, bars, seed) => {
        for (const s of drumPattern("swing", bpb, bars, seed).filter((h) => h.voice === "snare")) {
          expect(s.beat % 1).toBeCloseTo(SWING_SKIP);
          expect(s.vel).toBeLessThan(0.3);
        }
      }),
    );
    expect(drumPattern("bossa", 4, 16, "x").some((h) => h.voice === "snare")).toBe(false);
  });
});
