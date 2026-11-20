import { describe, expect, it } from "vitest";
import { generateMoves } from "../src/engine";
import { coopBlues } from "../src/fixtures/coopBlues";
import { secondaryTwoFive, tritoneSub } from "../src/rules";
import { backdoorTwoFive } from "../src/rulesAdvanced";
import type { ChordEvent, Quality, Tune } from "../src/types";

/*
 * Pins the move-card text that was wrong in the shipped demo: one chord with two names,
 * a "same keys spelled differently" that was only half true, a backdoor said to have "no
 * tritone resolving", and a ii–V that "briefly makes it sound like home" when the target is home.
 */
const { accepted } = generateMoves(coopBlues);
const text = (id: string) => {
  const m = accepted.find((x) => x.id === id);
  if (!m) throw new Error(`no accepted move ${id}`);
  return m.text;
};

const base = coopBlues.harmony[0];
const ch = (root: string, quality: Quality): ChordEvent =>
  ({ ...base, root, quality, extensions: [], alterations: [], analysis: undefined, display: undefined, bass: undefined }) as ChordEvent;
const tuneIn = (tonic: string, mode: "major" | "minor"): Tune => ({ ...coopBlues, key: { tonic, mode } }) as Tune;

describe("move-card copy", () => {
  it("the tritone sub names the substitute one way and respells only the key that changes", () => {
    const t = text("dominant.tritoneSub@10.1");
    expect(t.summary).toContain("G♭9");
    expect(t.theory).not.toMatch(/G♭7/);
    expect(t.theory).toContain("a tritone apart");
    expect(t.theory).toContain("E, the 3rd of C7, is the ♭7 of G♭9 (spelled F♭ there)");
    expect(t.theory).toContain("B♭, the ♭7 of C7, is the 3rd of G♭9.");
    expect(t.theory).not.toMatch(/spelled differently/);
  });

  it("the tritone sub respells the other key when the sub's root is simplified (D♭7 → G7)", () => {
    const p = tritoneSub.propose({ tune: coopBlues, index: 0, chord: ch("Db", "7"), next: ch("Gb", "maj7") })!;
    expect(p.text.theory).toContain("F, the 3rd of D♭7, is the ♭7 of G9;");
    expect(p.text.theory).toContain("C♭, the ♭7 of D♭7, is the 3rd of G9 (spelled B there)");
  });

  it("the backdoor names the missing leading tone, spelled from the original chord", () => {
    expect(text("modal.backdoorTwoFive@10.1").theory).toMatch(/than C7 → F6, where E rises into F\.$/);
    expect(text("modal.backdoorTwoFive@10.1").theory).not.toMatch(/no tritone/);
    // D♭7 → F♯ resolves by chroma; the leading tone is D♭7's F, not E♯
    const p = backdoorTwoFive.propose({ tune: coopBlues, index: 0, chord: ch("Db", "7"), next: ch("F#", "maj7") })!;
    expect(p.text.theory).toContain("where F rises into F♯");
  });

  it("a ii–V into the tonic doesn't say it 'briefly' sounds like home", () => {
    const t = text("functional.secondaryTwoFive@2.1");
    expect(t.theory).toMatch(/^F6 is the tonic, home\./);
    expect(t.theory).not.toMatch(/briefly/);
    // a minor-major tonic, whose roman ("i(maj7)") isn't a plain "i"
    const p = secondaryTwoFive.propose({
      tune: tuneIn("C", "minor"),
      index: 0,
      chord: ch("Eb", "maj7"),
      next: { ...ch("C", "mMaj7"), analysis: { roman: "i(maj7)", func: "T" } },
    })!;
    expect(p.text.theory).toMatch(/is the tonic, home\./);
    // a non-tonic target keeps the tonicization wording
    const q = secondaryTwoFive.propose({ tune: coopBlues, index: 0, chord: ch("F", "6"), next: ch("G", "m7") })!;
    expect(q.text.theory).toMatch(/briefly makes it sound like home/);
  });

  it("the gospel turnaround calls the original dominant by the name on the chart", () => {
    const t = text("gospel.halfStepTurnaround@10.1");
    expect(t.theory).toContain("the tritone sub of C7,");
  });
});
