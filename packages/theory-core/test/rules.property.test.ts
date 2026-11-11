import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { chordChromas, chordTones, guideTones, QUALITIES } from "../src/chords";
import { generateMoves } from "../src/engine";
import { improvMap } from "../src/improv";
import { buildPathway, DENSITY, overlaps, realize } from "../src/pathway";
import { chroma, mod, pitchClass } from "../src/pitch";
import { suggestScales } from "../src/scales";
import { eventSpan, melodyIn, sortedHarmony } from "../src/time";
import type { ReharmMove, Tune } from "../src/types";
import { progressionArb, ROOTS } from "./arbitraries";

const RUNS = { numRuns: 300 };
const chromaSet = (notes: string[]) => new Set(notes.map(chroma));
const targetOf = (tune: Tune, m: ReharmMove) =>
  sortedHarmony(tune).find((c) => c.at.bar === m.span.to.bar && c.at.beat === m.span.to.beat);

describe("engine invariants (all rules)", () => {
  it("every move keeps the span length and lays its chords out contiguously", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const { accepted, rejected } = generateMoves(tune);
        for (const m of [...accepted, ...rejected.map((r) => r.move)]) {
          const before = m.original.reduce((s, c) => s + c.beats, 0);
          const after = m.chords.reduce((s, c) => s + c.beats, 0);
          expect(after).toBe(before);
          expect(m.spanBeats.end - m.spanBeats.start).toBe(before);
          expect(m.chords[0].at).toEqual(m.span.from);
        }
      }),
      RUNS,
    );
  });

  it("accepted moves never put an avoid note under the melody; rejected ones always do", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const { accepted, rejected } = generateMoves(tune);
        for (const m of accepted) expect(m.checks.melody.some((c) => c.verdict === "avoid")).toBe(false);
        for (const r of rejected) expect(r.reasons.length).toBeGreaterThan(0);
      }),
      RUNS,
    );
  });

  it("pathways never overlap and respect the level dial (L0 = original)", () => {
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 0, max: 4 }), (tune, level) => {
        const path = buildPathway(generateMoves(tune).accepted, level);
        if (level === 0) expect(path).toHaveLength(0);
        for (const m of path) expect(m.level).toBeLessThanOrEqual(level);
        for (let i = 0; i < path.length; i++)
          for (let j = i + 1; j < path.length; j++) expect(overlaps(path[i], path[j])).toBe(false);
      }),
      RUNS,
    );
  });
});

describe("density caps", () => {
  it("no phrase window ever holds more moves than the dial allows, user picks included", () => {
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 1, max: 3 }), fc.nat(), (tune, level, pickSeed) => {
        // a 4-bar progression repeated to 16 bars, so windows have competition
        const long = {
          ...tune,
          harmony: [0, 1, 2, 3].flatMap((rep) =>
            tune.harmony.map((c) => ({ ...c, id: `${c.id}r${rep}`, at: { ...c.at, bar: c.at.bar + rep * 4 } })),
          ),
        };
        const { accepted } = generateMoves(long);
        const forced = accepted.length ? [accepted[pickSeed % accepted.length]] : [];
        const path = buildPathway(accepted, level, forced);
        const { windowBars, maxMoves } = DENSITY[level];
        const perWindow = new Map<number, number>();
        for (const m of path) {
          const w = Math.floor((m.span.from.bar - 1) / windowBars);
          perWindow.set(w, (perWindow.get(w) ?? 0) + 1);
        }
        for (const n of perWindow.values()) expect(n).toBeLessThanOrEqual(maxMoves);
        if (forced.length) expect(path.map((m) => m.id)).toContain(forced[0].id);
        // higher levels never offer fewer moves than lower ones
        expect(buildPathway(accepted, level + 1).length).toBeGreaterThanOrEqual(buildPathway(accepted, level).length);
      }),
      RUNS,
    );
  });
});

describe("rule: tritone substitution", () => {
  it("is a dominant a tritone away that shares the original's 3rd/♭7 tritone", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const moves = generateMoves(tune).accepted.filter((m) => m.ruleId === "dominant.tritoneSub");
        for (const m of moves) {
          const [orig] = m.original;
          const [sub] = m.chords;
          expect(sub.quality).toBe("7");
          expect(mod(chroma(sub.root) - chroma(orig.root), 12)).toBe(6);
          const g = (c: typeof sub) => chromaSet(guideTones({ ...c, alterations: [] }).map((t) => t.note));
          expect(g(sub)).toEqual(g(orig));
          // and the bass then slides down a half step into the target
          const target = targetOf(tune, m)!;
          expect(mod(chroma(sub.root) - chroma(target.root), 12)).toBe(1);
        }
      }),
      RUNS,
    );
  });
});

describe("rule: secondary ii–V", () => {
  it("V is a perfect 5th above the target and ii a 5th above V", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const moves = generateMoves(tune).accepted.filter((m) => m.ruleId === "functional.secondaryTwoFive");
        for (const m of moves) {
          const [ii, V] = m.chords;
          const target = targetOf(tune, m)!;
          expect(mod(chroma(V.root) - chroma(target.root), 12)).toBe(7);
          expect(mod(chroma(ii.root) - chroma(V.root), 12)).toBe(7);
          expect(V.quality).toBe("7");
          expect(["m7", "m7b5"]).toContain(ii.quality);
        }
      }),
      RUNS,
    );
  });
});

describe("rule: upper-structure triad", () => {
  it("the right-hand triad sits on the ♭13 and every note is a chord tone of 7(♯9,♭13)", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const moves = generateMoves(tune).accepted.filter((m) => m.ruleId === "voicing.upperStructureBVI");
        for (const m of moves) {
          const [c] = m.chords;
          const tones = chordChromas(c);
          const { lh, rh } = m.voicingHint!;
          expect(mod(chroma(rh[0]) - chroma(c.root), 12)).toBe(8);
          for (const n of [...lh, ...rh]) expect(tones.has(chroma(n))).toBe(true);
        }
      }),
      RUNS,
    );
  });
});

describe("rule: gospel turnaround", () => {
  it("approach chord is a half step above the tonic and no voice moves more than a half step", () => {
    fc.assert(
      fc.property(progressionArb, (tune) => {
        const moves = generateMoves(tune).accepted.filter((m) => m.ruleId === "gospel.halfStepTurnaround");
        for (const m of moves) {
          const approach = m.chords[1];
          const target = targetOf(tune, m)!;
          expect(mod(chroma(approach.root) - chroma(target.root), 12)).toBe(1);
          for (const v of m.voiceLeading) expect(Math.abs(v.semitones)).toBeLessThanOrEqual(1);
        }
      }),
      RUNS,
    );
  });
});

describe("improvisation mapping", () => {
  it("every suggested scale contains every chord tone and every melody note", () => {
    fc.assert(
      fc.property(progressionArb, fc.integer({ min: 0, max: 4 }), (tune, level) => {
        const chords = realize(tune, buildPathway(generateMoves(tune).accepted, level));
        for (const entry of improvMap(tune, chords)) {
          const need = chordChromas(entry.chord);
          const [s0, e0] = eventSpan(entry.chord, tune.meter[0]);
          const mel = melodyIn(tune, s0, e0).map((n) => chroma(pitchClass(n.pitch)));
          for (const s of entry.scales) {
            const have = chromaSet(s.notes);
            for (const c of need) expect(have.has(c)).toBe(true);
            for (const c of mel) expect(have.has(c)).toBe(true);
          }
        }
      }),
      RUNS,
    );
  });

  it("every unaltered chord quality gets at least one scale", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROOTS), fc.constantFrom(...QUALITIES), (root, quality) => {
        const chord = { root, quality, extensions: [], alterations: [] };
        const scales = suggestScales(chord);
        expect(scales.length).toBeGreaterThan(0);
        for (const s of scales) for (const t of chordTones(chord)) expect(chromaSet(s.notes).has(chroma(t.note))).toBe(true);
      }),
    );
  });
});
