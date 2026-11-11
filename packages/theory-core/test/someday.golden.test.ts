import { describe, expect, it } from "vitest";
import { symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { improvMap } from "../src/improv";
import { buildPathway, realize } from "../src/pathway";
import { someday } from "../src/fixtures/someday";

const { accepted, rejected } = generateMoves(someday);
const find = (rule: string, bar: number) => accepted.find((m) => m.ruleId === rule && m.span.from.bar === bar);
const syms = (rule: string, bar: number) => find(rule, bar)?.chords.map(symbol);

describe("Someday My Prince Will Come, bars 1–8 (blueprint simulation)", () => {
  it("Move 1: ii–V into the IV in bar 2", () => {
    expect(syms("functional.secondaryTwoFive", 2)).toEqual(["Fm9", "Bb7(b9)"]);
    expect(find("functional.secondaryTwoFive", 2)!.title).toBe("ii–V into the IV");
    const mel = find("functional.secondaryTwoFive", 2)!.checks.melody;
    expect(mel.map((m) => [m.chordSymbol, m.role, m.verdict])).toEqual([
      ["Fm9", "11", "tension"],
      ["Bb7(b9)", "1", "chord-tone"],
    ]);
  });

  it("Move 2: tritone sub in bar 4 (melody E♭ = the 9th)", () => {
    expect(syms("dominant.tritoneSub", 4)).toEqual(["Db9"]);
    expect(find("dominant.tritoneSub", 4)!.checks.melody[0]).toMatchObject({ role: "9", verdict: "chord-tone" });
  });

  it("Move 3: upper-structure E♭ triad over G", () => {
    const m = find("voicing.upperStructureBVI", 6)!;
    expect(m.chords.map(symbol)).toEqual(["G7(#9,b13)"]);
    expect(m.voicingHint).toEqual({ lh: ["G", "F", "B"], rh: ["Eb", "G", "Bb"] });
  });

  it("Move 4: gospel turnaround in bar 8 slides by half steps into B♭maj9", () => {
    const m = find("gospel.halfStepTurnaround", 8)!;
    expect(m.chords.map(symbol)).toEqual(["Eb/F", "B13(#11)"]);
    expect(m.voiceLeading.map((v) => v.semitones).sort()).toEqual([-1, -1, -1, -1, -1, 0, 0]);
  });

  it("rejects ii–Vs that clash with the melody (b9 over a half-diminished ii)", () => {
    const r = rejected.find((x) => x.move.ruleId === "functional.secondaryTwoFive" && x.move.span.from.bar === 4);
    expect(r).toBeDefined();
    expect(r!.move.chords.map(symbol)).toEqual(["Dm7b5", "G7(b9)"]);
    expect(r!.reasons[0]).toMatch(/♭9 of Dm7♭5/);
  });

  it("L2 keeps one move per 4-bar phrase; L3 allows two, so all four blueprint moves appear", () => {
    const l2 = buildPathway(accepted, 2).map((m) => [m.span.from.bar, m.ruleId]);
    expect(l2).toEqual([
      [2, "functional.secondaryTwoFive"],
      [8, "dominant.tritoneSub"],
    ]);
    const l3 = buildPathway(accepted, 3).map((m) => [m.span.from.bar, m.ruleId]);
    expect(l3).toEqual([
      [2, "functional.secondaryTwoFive"],
      [4, "dominant.tritoneSub"],
      [6, "voicing.upperStructureBVI"],
      [8, "gospel.halfStepTurnaround"],
    ]);
  });

  it("maps scales like the blueprint table", () => {
    const chords = realize(someday, buildPathway(accepted, 3));
    const top = Object.fromEntries(improvMap(someday, chords).map((e) => [symbol(e.chord), e.scales[0]?.name]));
    expect(top["Fm9"]).toBe("F Dorian");
    expect(top["Bb7(b9)"]).toBe("B♭ half-whole diminished");
    expect(top["Ebmaj7"]).toBe("E♭ Lydian");
    expect(top["Db9"]).toBe("D♭ Lydian dominant");
    expect(top["G7(#9,b13)"]).toBe("G altered");
    expect(top["Cm7"]).toBe("C Dorian");

    const original = improvMap(someday, realize(someday, []));
    expect(original[1].scales.map((s) => s.name)).toEqual(["D whole tone", "D altered", "D Phrygian dominant"]);
  });
});
