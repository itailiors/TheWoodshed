import { anyLesson, CONCEPTS, decodeSymbol, glossaryEntry, GLOSSARY, KEYS, RULES } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { chipLines, chipSegments, lessonChips, SCALE_TERMS, SCREEN_TERMS, symbolIn, termForConcept, type Segment } from "./chipText";
import { DEMO_STUDY_HINT, FIRST_RUN_HINTS } from "./hints";

const joined = (segs: Segment[]) => segs.map((s) => s.text).join("");
const chips = (segs: Segment[]) => segs.filter((s) => s.kind !== "text");

describe("glossary chips: where they go", () => {
  it("every term a screen chips resolves through glossaryEntry", () => {
    for (const list of [...Object.values(SCREEN_TERMS), SCALE_TERMS]) for (const t of list) expect(glossaryEntry(t), t).toBeDefined();
    for (const r of RULES) {
      const t = termForConcept(r.id);
      if (t) expect(glossaryEntry(t)?.conceptId, r.id).toBe(r.id);
    }
  });

  it("every chip in every lesson, in a few keys, resolves: terms through glossaryEntry, symbols through decodeSymbol, and the text reads as written", () => {
    let symbols = 0;
    let numerals = 0;
    for (const k of ["C", "Eb", "F#", "Bb"])
      for (const c of CONCEPTS) {
        const l = anyLesson(c.id, k);
        if (!l) continue;
        const ch = lessonChips(l);
        l.steps.forEach((s, i) => expect(joined(ch.steps[i])).toBe(s.text));
        if (l.deeper) expect(joined(ch.deeper)).toBe(l.deeper);
        for (const seg of [...ch.steps.flat(), ...ch.deeper]) {
          if (seg.kind === "term") {
            const e = glossaryEntry(seg.term);
            expect(e, `${c.id} ${seg.term}`).toBeDefined();
            if (e?.kind === "numeral") numerals++;
          }
          if (seg.kind === "symbol") {
            symbols++;
            expect(decodeSymbol(seg.text), `${c.id} ${seg.text}`).not.toBeNull();
          }
        }
        // a step's own term is chipped (as the text writes it: the term or an alias)
        l.steps.forEach((s, i) => {
          if (s.term && glossaryEntry(s.term)) expect(chips(ch.steps[i]).some((x) => x.kind === "term" && x.term === glossaryEntry(s.term!)!.term), `${c.id} step ${i + 1} ${s.term}`).toBe(true);
        });
      }
    expect(symbols).toBeGreaterThan(50);
    expect(numerals).toBeGreaterThan(5);
  });

  it("chips the roman numerals the glossary knows, and only standing alone", () => {
    const segs = chipSegments("ii is Dm7, so ii–V–I in C is Dm7, G7, Cmaj7; V7, IV and ♭VII aren't V.", { numerals: true });
    expect(chips(segs).map((s) => s.text)).toEqual(["ii", "V"]);
    expect(chipSegments("Fm7 (iv) and B♭9 (♭VII7) and ♭II.", { numerals: true }).filter((s) => s.kind === "term").map((s) => s.text)).toEqual(["iv", "♭VII7", "♭II"]);
    // every numeral entry is reachable
    for (const g of GLOSSARY.filter((x) => x.kind === "numeral")) expect(chips(chipSegments(`x ${g.term} y`, { numerals: true })).length, g.term).toBe(1);
  });

  it("finds chord symbols in prose: not bare notes, words or possessives' tails", () => {
    expect(chips(chipSegments("Play D♭9 instead of G7. Same notes, C♭ (same key as B).", { symbols: true })).map((s) => s.text)).toEqual(["D♭9", "G7"]);
    expect(chips(chipSegments("G7(♭9)'s ♭9, A♭, falls to G, the 5th of Cmaj7.", { symbols: true })).map((s) => s.text)).toEqual(["G7(♭9)", "Cmaj7"]);
    expect(chips(chipSegments("A dominant may bend the 9th. Each arrival. E♭/F then Bdim7.", { symbols: true })).map((s) => s.text)).toEqual(["E♭/F", "Bdim7"]);
    expect(symbolIn("Fm6.")).toBe("Fm6");
    expect(symbolIn("(over")).toBeNull();
    expect(symbolIn("A")).toBeNull();
  });

  it("only the first use in a view gets a chip", () => {
    const [a, b] = chipLines(["G7 resolves; G7 again.", "Then G7 and the tritone."], { symbols: true, terms: ["tritone"] });
    expect(chips(a).map((s) => s.text)).toEqual(["G7"]);
    expect(chips(b).map((s) => s.text)).toEqual(["tritone"]);
  });

  it("a term chips as the copy writes it (any case, or an alias), never inside another word", () => {
    expect(chips(chipSegments("Guide tones and colours.", { terms: ["guide tones"] }))[0].text).toBe("Guide tones");
    expect(chips(chipSegments("Shells: root, 3rd and 7th.", { terms: ["shells"] }))[0]).toMatchObject({ text: "Shells", term: "shell" });
    expect(chips(chipSegments("a seashell", { terms: ["shell"] }))).toEqual([]);
  });

  it("first-run hints: one line per screen, short", () => {
    for (const [screen, line] of Object.entries({ ...FIRST_RUN_HINTS, demoStudy: DEMO_STUDY_HINT })) expect(line.split(/\s+/).length, screen).toBeLessThanOrEqual(22);
    expect(Object.keys(FIRST_RUN_HINTS).sort()).toEqual(["changes", "coach", "practice", "study", "voicings"]);
  });

  it("chips work in all 12 keys for the symbols the lessons print", () => {
    for (const k of KEYS) {
      const l = anyLesson("dominant.tritoneSub", k)!;
      expect(lessonChips(l).steps.flat().some((s) => s.kind === "symbol")).toBe(true);
    }
  });
});
