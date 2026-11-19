import { describe, expect, it } from "vitest";
import { bluesScale, chroma, improvLens, improvMap, IMPROV_LENSES, KEYS, referenceTune, transposeTune } from "../src";

const entries = improvMap(referenceTune, referenceTune.harmony);
const tonic = referenceTune.key.tonic;

describe("bluesScale", () => {
  it("spells F blues as F A♭ B♭ B C E♭", () => {
    expect(bluesScale("F")).toEqual(["F", "Ab", "Bb", "B", "C", "Eb"]);
  });
  it("is 1 ♭3 4 ♯4 5 ♭7 in every key, with no double accidentals", () => {
    for (const k of KEYS) {
      const s = bluesScale(k);
      const base = chroma(k);
      expect(s.map((n) => (chroma(n) - base + 12) % 12)).toEqual([0, 3, 5, 6, 7, 10]);
      expect(s.every((n) => !/bb|##|x/.test(n.slice(1)))).toBe(true);
    }
  });
});

describe("improvLens", () => {
  it("guide: exactly the chord's 3rd and 7th, ringed", () => {
    for (const e of entries) {
      const v = improvLens(e, "guide", tonic);
      expect(v.keys.map((k) => k.note)).toEqual(e.guideTones.map((g) => g.note));
      expect(v.keys.every((k) => k.ring && k.fill === "chord")).toBe(true);
    }
  });

  it("simple: only chord tones, never an extension", () => {
    for (const e of entries) {
      const v = improvLens(e, "simple", tonic);
      expect(v.keys.length).toBeGreaterThanOrEqual(3);
      expect(v.keys.length).toBeLessThanOrEqual(4);
      expect(v.keys.every((k) => k.fill === "chord")).toBe(true);
    }
  });

  it("full: the top scale, with every guide tone marked as a chord tone", () => {
    for (const e of entries) {
      const v = improvLens(e, "full", tonic);
      if (!e.scales[0]) continue;
      expect(v.title).toBe(e.scales[0].name);
      expect(v.keys.map((k) => k.note)).toEqual(e.scales[0].notes);
      for (const k of v.keys.filter((k) => k.ring)) expect(k.fill).toBe("chord");
      for (const a of e.scales[0].avoid) expect(v.keys.find((k) => chroma(k.note) === chroma(a))?.fill).toBe("avoid");
    }
  });

  it("blues: one key-wide scale, plus the chord's guide tones (A over F7 shows the ♭3/3 rub)", () => {
    const f7 = entries.find((e) => e.chord.root === "F" && e.chord.quality === "7")!;
    const v = improvLens(f7, "blues", tonic);
    expect(v.title).toBe("F blues");
    expect(v.keys.filter((k) => k.fill === "blue").map((k) => k.note)).toEqual(bluesScale("F"));
    expect(v.keys.find((k) => k.note === "A")).toEqual({ note: "A", fill: null, ring: true });
    expect(v.keys.find((k) => k.note === "Eb")?.ring).toBe(true);
  });

  it("follows transposition (interval-relative)", () => {
    const t = transposeTune(referenceTune, "Bb");
    const e = improvMap(t, t.harmony)[0];
    expect(improvLens(e, "blues", "Bb").title).toBe("Bb blues");
  });

  it("lists every lens once", () => {
    expect(new Set(IMPROV_LENSES.map((l) => l.id)).size).toBe(4);
  });
});
