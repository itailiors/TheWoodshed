import { describe, expect, it } from "vitest";
import { chroma, chordTones, generateMoves, KEYS, prettyNote, prettySymbol, referenceTune, symbol, transposeTune, type ChordEvent } from "../src";
import { canonicalMove } from "../src/learn/canonical";
import { decodeChord, decodeSymbol, parseSymbol } from "../src/learn/decoder";
import { RULES } from "../src/ruleset";

/*
 * The chord-symbol decoder chip (spec §D): a printed symbol is parsed back into the fields
 * `symbol()` prints, and every note the popover names comes from `chordTones()` of that shape.
 */

describe("decodeSymbol: a table across qualities and alterations", () => {
  const table: [string, string][] = [
    ["G7(♭9)", "G: root · 7: dominant 7th (B, F) · ♭9: flat 9th (A♭)"],
    ["Bm7♭5", "B: root · m7♭5: half-diminished: minor 3rd, ♭5, ♭7 (D, F, A)"],
    ["Cmaj7", "C: root · maj7: major 7th (E, B)"],
    ["D♭13(♯11)", "D♭: root · 13: dominant 7th (F, C♭), with the 9th and 13th on top (E♭, B♭) · ♯11: sharp 11th (G)"],
    ["B♭6/9", "B♭: root · 6/9: major 6th chord (D, G), with the 9th on top (C)"],
    ["F/G", "F: root of the major triad (F, A, C) · /G: F triad over G in the bass"],
    ["E♭/F", "E♭: root of the major triad (E♭, G, B♭) · /F: E♭ triad over F in the bass"],
    ["Dm9", "D: root · m9: minor 7th (F, C), with the 9th on top (E)"],
    ["Fm6", "F: root · m6: minor 6th chord (A♭, D)"],
    ["Bdim7", "B: root · dim7: diminished 7th: stacked minor 3rds (D, F, A♭)"],
    ["Cdim7", "C: root · dim7: diminished 7th: stacked minor 3rds (E♭, G♭, A)"],
    ["G7sus4", "G: root · 7sus4: sus: the 4th replaces the 3rd, with the ♭7 (C, F)"],
    ["C+", "C: root · +: augmented: the 5th raised (E, G♯)"],
    ["A7(♭9,♯11)", "A: root · 7: dominant 7th (C♯, G) · ♭9: flat 9th (B♭) · ♯11: sharp 11th (D♯)"],
    ["Cm7/B♭", "C: root · m7: minor 7th (E♭, B♭) · /B♭: B♭ in the bass"],
    ["Cadd9", "C: root of the major triad (C, E, G) · add9: added 9th (D)"],
  ];
  it.each(table)("%s", (sym, line) => {
    expect(decodeSymbol(sym)?.line).toBe(line);
  });

  it("reads ASCII spelling the same as ♭/♯", () => {
    expect(decodeSymbol("Bb7(b9)")?.line).toBe(decodeSymbol("B♭7(♭9)")?.line);
    expect(decodeSymbol("Dm7b5")?.symbol).toBe("Dm7♭5");
  });

  it("refuses prose: words, numerals and half-symbols aren't chords", () => {
    for (const w of ["Dominant", "Each", "Bold", "V7", "ii", "G7's", "C7(♭9", "Hmaj7", "Cmaj7)", ""]) expect(parseSymbol(w), w).toBeNull();
  });

  it("the same symbol in 12 keys: each part's notes are that key's chord tones", () => {
    for (const k of KEYS)
      for (const suffix of ["7(b9)", "m7b5", "maj7", "13(#11)", "6/9", "dim7", "m9", "7sus4"]) {
        const d = decodeSymbol(`${k}${suffix}`)!;
        expect(d, `${k}${suffix}`).not.toBeNull();
        const tones = new Set(chordTones(d.shape).map((t) => chroma(t.note)));
        for (const p of d.parts) for (const n of p.notes) expect(tones.has(chroma(n.replace(/♭/g, "b").replace(/♯/g, "#"))), `${n} in ${k}${suffix}`).toBe(true);
        expect(d.parts[0].text).toBe(prettyNote(k));
      }
  });
});

/** Every chord a rule puts on a chart, in 12 keys: the reference tune's moves plus each rule's canonical move. */
function ruleChords(): ChordEvent[] {
  const out: ChordEvent[] = [];
  for (const k of KEYS) {
    for (const m of generateMoves(transposeTune(referenceTune, k)).accepted) out.push(...m.chords);
    for (const r of RULES) out.push(...(canonicalMove(r.id, k)?.chords ?? []));
  }
  return out;
}

describe("decodeSymbol round-trips every suffix the rules emit, in 12 keys", () => {
  const chords = ruleChords();
  it("covers a real spread of symbols", () => {
    const suffixes = new Set(chords.map((c) => symbol(c).replace(/^[A-G][b#]*/, "")));
    expect(suffixes.size).toBeGreaterThan(10);
  });
  it("parses each printed symbol back to its root, quality, alterations and bass", () => {
    for (const c of chords) {
      const shown = prettySymbol(symbol(c));
      const d = decodeSymbol(shown);
      expect(d, shown).not.toBeNull();
      if (c.display) continue; // a display override ("E♭/F") is its own symbol: decoded as printed
      expect(d!.shape.root, shown).toBe(c.root);
      expect(d!.shape.quality, shown).toBe(c.quality);
      expect([...d!.shape.alterations].sort(), shown).toEqual([...c.alterations].sort());
      expect(d!.shape.bass, shown).toBe(c.bass);
      // the highest extension the symbol prints is decoded
      const top = ["13", "11", "9"].find((e) => c.extensions.includes(e));
      if (top && ["7", "m7", "maj7"].includes(c.quality)) expect(d!.shape.extensions, shown).toContain(top);
      expect(decodeChord(c).line).toBe(d!.line);
    }
  });
});
