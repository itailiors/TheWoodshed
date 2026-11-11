import { describe, expect, it } from "vitest";
import { symbol } from "../src/chords";
import { generateMoves } from "../src/engine";
import { referenceTune } from "../src";
import { coopBlues } from "../src/fixtures/coopBlues";
import { buildPathway } from "../src/pathway";
import { absBeat, formBars } from "../src/time";

/*
 * Pins the engine to "Co-op Blues", the reference and public-demo tune. The tune was
 * written so the dial tells a story: nothing at L0, one move at L1, then more colour at
 * every level, six different rules accepted, and the head's own notes rejecting other
 * moves for audible reasons (which is what the Engine X-ray's red pen shows).
 */
const { accepted, rejected } = generateMoves(coopBlues);
const ids = (level: number) => buildPathway(accepted, level).map((m) => m.id);
const rejection = (id: string) => rejected.find((r) => r.move.id === id);

describe("Co-op Blues (reference tune)", () => {
  it("is the app's reference tune: an original 12-bar blues in F with a full head", () => {
    expect(referenceTune).toBe(coopBlues);
    expect(formBars(coopBlues)).toBe(12);
    expect(coopBlues.melodyCoverage).toBe("full");
    // every bar's chords fill exactly four beats
    const beats = new Map<number, number>();
    for (const c of coopBlues.harmony) beats.set(c.at.bar, (beats.get(c.at.bar) ?? 0) + c.beats);
    expect([...beats.values()]).toEqual(Array(12).fill(4));
    // the head stays inside the form and moves in order
    const starts = coopBlues.melody.map((n) => absBeat(n.at, 4));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(Math.max(...starts)).toBeLessThan(12 * 4);
  });

  it("the dial builds level by level", () => {
    expect(ids(0)).toEqual([]);
    expect(ids(1)).toEqual(["functional.secondaryTwoFive@11.3"]);
    expect(ids(2)).toEqual(["functional.secondaryTwoFive@2.1", "dominant.tritoneSub@8.3", "dominant.tritoneSub@10.1"]);
    expect(ids(3)).toEqual([
      "functional.secondaryTwoFive@2.1",
      "dominant.tritoneSub@8.3",
      "gospel.halfStepTurnaround@10.1",
      "dominant.tritoneSub@11.3",
    ]);
    expect(ids(4).length).toBe(12);
  });

  it("accepts six different rules", () => {
    expect(new Set(accepted.map((m) => m.ruleId))).toEqual(
      new Set([
        "functional.secondaryTwoFive",
        "dominant.tritoneSub",
        "voicing.upperStructureBVI",
        "gospel.halfStepTurnaround",
        "modal.backdoorTwoFive",
        "chromatic.constantStructure",
      ]),
    );
  });

  it("the turnaround moves into bar 11's F6", () => {
    expect(accepted.find((m) => m.id === "dominant.tritoneSub@10.1")!.chords.map(symbol)).toEqual(["Gb9"]);
    expect(accepted.find((m) => m.id === "modal.backdoorTwoFive@10.1")!.chords.map(symbol)).toEqual(["Bbm7", "Eb9"]);
    expect(accepted.find((m) => m.id === "gospel.halfStepTurnaround@10.1")!.chords.map(symbol)).toEqual(["Bb/C", "Gb13(#11)"]);
  });

  it("the head's altered line over D7 (F♯, E♭, B♭) takes an upper-structure triad in bar 8", () => {
    expect(accepted.find((m) => m.id === "voicing.upperStructureBVI@8.3")!.chords.map(symbol)).toEqual(["D7(#9,b13)"]);
  });

  it("rejects moves the head clashes with, for reasons a player can hear", () => {
    // bar 11 plays a plain A over D7: the natural 5 fights the upper structure's ♭13
    expect(rejection("voicing.upperStructureBVI@11.3")!.reasons[0]).toMatch(/natural 5/);
    // bar 4's D (the 13 of F7) is the ♯9 of the tritone sub, B9
    expect(rejection("dominant.tritoneSub@4.3")!.reasons[0]).toMatch(/♯9 of B9/);
    // Coltrane changes through bars 9–10 put the head's D on a D♭maj7
    expect(rejection("symmetric.coltraneSubstitution@9.1")!.reasons[0]).toMatch(/♭9 of D♭maj7/);
  });
});
