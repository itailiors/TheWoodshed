import { describe, expect, it } from "vitest";
import { canonicalMove } from "../src/index";
import { basicsLesson, hasRuleLesson, lessonForMove, type Lesson } from "../src/learn";
import { guideMotion } from "../src/learn/lesson";
import { RULES } from "../src/ruleset";
import { KEYS } from "../src/transpose";

/*
 * Key labels (P6 UI/UX 15). A label is written on a 22-unit key, so where a guide tone moves from
 * one chord to the next, each label names its chord on a first line: "ii\n7th" on F and "V\n3rd" on E,
 * never "7th" and "3rd" side by side (read as one label, "3rd 7th"), and the held tone names both
 * chords ("ii→V\n3→7") instead of the ii's role while the text calls it the V's 7th.
 */

const ruleLessons = (tonic: string): Lesson[] =>
  RULES.filter((r) => hasRuleLesson(r.id)).flatMap((r) => {
    const m = canonicalMove(r.id, tonic);
    const l = m ? lessonForMove(m) : null;
    return l ? [l] : [];
  });
const lessonsIn = (tonic: string): Lesson[] => [basicsLesson("basics:twoFiveOne", tonic)!, ...ruleLessons(tonic)];
const labelsOf = (l: Lesson, step: number) => l.steps[step].highlight.map((h) => `${h.note}=${h.label}`);

describe("guideMotion", () => {
  it("labels a moving tone with each chord, and a held one with both", () => {
    expect(guideMotion({ from: "F", to: "E", semitones: -1, toDegree: "3" }, { chord: "ii", role: "7th" }, "V")).toEqual([
      { note: "F", label: "ii\n7th" },
      { note: "E", label: "V\n3rd", dir: "down" },
    ]);
    expect(guideMotion({ from: "Bb", to: "Bb", semitones: 0, toDegree: "b7" }, { chord: "ii", role: "3rd" }, "V")).toEqual([
      { note: "Bb", label: "ii→V\n3→7" },
    ]);
  });
});

describe("the reviewer's lessons, in F", () => {
  it("secondary ii–V step 3: Gm9's 7th falls to C7's 3rd, its 3rd holds as C7's 7th", () => {
    const l = ruleLessons("F").find((x) => x.conceptId === "functional.secondaryTwoFive")!;
    const step = l.steps.findIndex((s) => s.ask?.prompt.includes("guide tones stays"));
    expect(labelsOf(l, step).map((s) => s.replace(/^\w+=/, ""))).toEqual(["ii\n7th", "V\n3rd", "ii→V\n3→7"]);
  });

  it("ii–V–I basics: the 7th step and the 3rd step", () => {
    const l = basicsLesson("basics:twoFiveOne", "F")!;
    expect(labelsOf(l, 1)).toEqual(["F=ii\n7th", "E=V\n3rd"]);
    expect(labelsOf(l, 2)).toEqual(["Bb=ii→V\n3→7"]);
  });

  it("rootless ii–V–I: the one moving key", () => {
    const l = ruleLessons("F").find((x) => x.conceptId === "voicing.rootlessTwoFiveOne")!;
    expect(l).toBeTruthy();
    const s = l.steps.findIndex((x) => x.ask?.prompt.includes("moves to make"));
    expect(labelsOf(l, s).slice(0, 2).map((x) => x.split("=")[1])).toEqual(["ii\n7th", "V\n3rd"]);
  });
});

describe("every lesson in 12 keys", () => {
  it("keeps labels to at most two short lines, so they fit on a key", () => {
    for (const k of KEYS)
      for (const l of lessonsIn(k))
        for (const s of l.steps)
          for (const h of s.highlight) {
            const lines = h.label.split("\n");
            expect(lines.length, `${l.conceptId} in ${k}: ${JSON.stringify(h.label)}`).toBeLessThanOrEqual(2);
          }
  });

  it("never puts a bare 3rd and 7th of two different chords on keys a half step apart", () => {
    const bare = /^(3rd|7th)$/;
    for (const k of KEYS)
      for (const l of lessonsIn(k))
        for (const s of l.steps)
          for (const a of s.highlight)
            for (const b of s.highlight)
              if (a !== b && bare.test(a.label) && bare.test(b.label) && a.label !== b.label)
                expect(Math.abs(midiish(a.note) - midiish(b.note)) % 12, `${l.conceptId} in ${k}: ${s.text}`).not.toBe(1);
  });
});

/** Pitch class of a spelled note, enough to compare distances. */
function midiish(n: string): number {
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[n[0] as "C"];
  const acc = [...n.slice(1)].reduce((s, c) => s + (c === "#" ? 1 : c === "b" ? -1 : 0), 0);
  return (((base + acc) % 12) + 12) % 12;
}
