import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { improvMap } from "../src/improv";
import { IRealParseError, parseIRealUrl, parseQuality, scramble, splitBar, toIRealUrl, unscramble } from "../src/import/ireal";
import { buildPathway, realize } from "../src/pathway";
import { absBeat } from "../src/time";
import type { Tune } from "../src/types";
import { voiceProgression } from "../src/voicing";

// Original, made-up charts (no copyrighted songs in the test suite).
const WALTZ = "{*AT34Bb^7 |D7#5 |Eb^7 |G7#5 |C-7 |G7#5 |N1C-7 |F7 }|N2C-7 F7 |Bb^7 Z";
const SWING =
  "[T44*AC^7XyQKcl LZD-7 G7 LZC^7 A7b9 LZD-9 G13 ]<Fine>[*BF^7 Fo7 LZC^7/E A-7 LZr|XyQ LZD-7 G7sus G7 C6 Z";

const bars = (t: Tune) => Math.max(...t.harmony.map((c) => c.at.bar));
const byBar = (t: Tune) => {
  const out: Record<number, string[]> = {};
  for (const c of t.harmony) (out[c.at.bar] ??= []).push(`${symbol(c)}:${c.beats}`);
  return out;
};

describe("iReal Pro de-obfuscation", () => {
  it("scramble/unscramble round-trip for any chart text", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 400 }).filter((s) => !/XyQ|LZ|Kcl/.test(s)), (s) => {
        expect(unscramble(scramble(s))).toBe(s);
      }),
    );
  });

  it("expands the XyQ / LZ / Kcl shorthands", () => {
    expect(unscramble("C^7XyQKcl LZ")).toBe("C^7   | x  |");
  });
});

describe("chord-quality parsing", () => {
  const cases: [string, string, string[], string[]][] = [
    ["^7", "maj7", [], []],
    ["^9", "maj7", ["9"], []],
    ["^7#11", "maj7", [], ["#11"]],
    ["^7#5", "maj7#5", [], []],
    ["", "maj", [], []],
    ["-", "m", [], []],
    ["-7", "m7", [], []],
    ["-9", "m7", ["9"], []],
    ["-6", "m6", [], []],
    ["-^7", "mMaj7", [], []],
    ["-7b5", "m7b5", [], []],
    ["h7", "m7b5", [], []],
    ["o7", "dim7", [], []],
    ["7", "7", [], []],
    ["9", "7", ["9"], []],
    ["13", "7", ["9", "13"], []],
    ["7b9", "7", [], ["b9"]],
    ["7#9b13", "7", [], ["#9", "b13"]],
    ["7alt", "7", [], ["b9", "#9", "b13"]],
    ["7sus", "7sus4", [], []],
    ["9sus", "7sus4", ["9"], []],
    ["sus", "7sus4", [], []],
    ["69", "6", ["9"], []],
    ["+", "aug", [], []],
    ["7#5", "7", [], ["#5"]],
  ];
  it.each(cases)("%s → %s", (q, quality, ext, alt) => {
    const p = parseQuality(q);
    expect(p.quality).toBe(quality);
    expect(p.extensions.sort()).toEqual(ext.sort());
    expect(p.alterations.sort()).toEqual(alt.sort());
    expect(p.leftover).toBe("");
  });
});

describe("iReal Pro links → Tune", () => {
  it("irealbook:// (old format) with { } repeats and N1/N2 endings", () => {
    const url = "irealbook://" + encodeURIComponent(["Waltz Test, The", "Lior Itai", "Jazz Waltz", "Bb", "n", WALTZ].join("="));
    const { songs, playlist } = parseIRealUrl(url);
    expect(playlist).toBeNull();
    const t = songs[0].tune;
    expect(t.title).toBe("The Waltz Test");
    expect(t.composer).toBe("Itai Lior");
    expect(t.meter).toEqual([3, 4]);
    expect(t.feel).toBe("waltz");
    expect(t.key).toEqual({ tonic: "Bb", mode: "major" });
    // 8 bars first time (with N1), then 6 + N2 (2 bars) = 16
    expect(bars(t)).toBe(16);
    const b = byBar(t);
    expect(b[7]).toEqual(["Cm7:3"]);
    expect(b[8]).toEqual(["F7:3"]);
    expect(b[9]).toEqual(["Bbmaj7:3"]);
    expect(b[15]).toEqual(["Cm7:2", "F7:1"]);
    expect(b[16]).toEqual(["Bbmaj7:3"]);
    expect(t.harmony[1].analysis?.roman).toBe("III7");
  });

  it("irealb:// (scrambled) with bar repeats, 2-bar repeats, slash chords, sections and directions", () => {
    const url = toIRealUrl({ title: "Swing Test", composer: "Lior Itai", style: "Medium Swing", key: "C", bpm: 180, music: SWING });
    expect(url).not.toContain("C%5E7XyQKcl"); // really scrambled
    const { songs } = parseIRealUrl(url);
    const { tune: t, warnings } = songs[0];
    expect(t.tempo).toBe(180);
    expect(t.feel).toBe("swing");
    expect(byBar(t)).toEqual({
      1: ["Cmaj7:4"],
      2: ["Cmaj7:4"],
      3: ["Dm7:2", "G7:2"],
      4: ["Cmaj7:2", "A7(b9):2"],
      5: ["Dm9:2", "G13:2"],
      6: ["Fmaj7:2", "Fdim7:2"],
      7: ["Cmaj7/E:2", "Am7:2"],
      8: ["Fmaj7:2", "Fdim7:2"],
      9: ["Cmaj7/E:2", "Am7:2"],
      10: ["Dm7:1", "G7sus4:1", "G7:1", "C6:1"],
    });
    expect(t.sections.map((s) => [s.label, s.startBar, s.bars])).toEqual([
      ["A", 1, 5],
      ["B", 6, 5],
    ]);
    expect(warnings.some((w) => /Fine/.test(w))).toBe(true);
  });

  it("splits a playlist and keeps its name", () => {
    const one = ["Song One", "Lior Itai", "", "Bossa Nova", "F", "", "1r34LbKcu7" + scramble("[T44F^7 |G7 |G-7 C7 |F^7 Z"), "", "0", "3"].join("=");
    const two = ["Song Two", "Lior Itai", "", "Ballad", "A-", "", "1r34LbKcu7" + scramble("[T44A-7 |D7 |G^7 |E7alt Z"), "", "0", "3"].join("=");
    const { playlist, songs } = parseIRealUrl("irealb://" + encodeURIComponent([one, two, "My Setlist"].join("===")));
    expect(playlist).toBe("My Setlist");
    expect(songs.map((s) => [s.tune.title, s.tune.feel, s.tune.key.mode])).toEqual([
      ["Song One", "bossa", "major"],
      ["Song Two", "ballad", "minor"],
    ]);
  });

  it("rejects things that aren't iReal links, with a helpful message", () => {
    expect(() => parseIRealUrl("https://example.com")).toThrow(IRealParseError);
    expect(() => parseIRealUrl("irealb://%E0%A4%A")).toThrow(/broken/);
  });

  it("the whole engine runs on imported charts", () => {
    for (const music of [WALTZ, SWING]) {
      const url = toIRealUrl({ title: "Engine Test", composer: "", style: "Medium Swing", key: "C", music });
      const t = parseIRealUrl(url).songs[0].tune;
      // contiguous timeline: every chord starts where the previous one ended
      const bpb = t.meter[0];
      t.harmony.forEach((c, i) => {
        if (i > 0) expect(absBeat(c.at, bpb)).toBe(absBeat(t.harmony[i - 1].at, bpb) + t.harmony[i - 1].beats);
      });
      for (let level = 0; level <= 4; level++) {
        const chords = realize(t, buildPathway(generateMoves(t).accepted, level));
        expect(improvMap(t, chords)).toHaveLength(chords.length);
        expect(voiceProgression(chords)).toHaveLength(chords.length);
      }
    }
  });
});

describe("splitBar", () => {
  it("always fills the bar exactly", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.constantFrom(2, 3, 4, 5, 6), (n, beats) => {
        const d = splitBar(n, beats);
        expect(d).toHaveLength(n);
        expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(beats);
      }),
    );
  });
});
