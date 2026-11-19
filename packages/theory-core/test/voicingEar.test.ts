import { describe, expect, it } from "vitest";
import { mod } from "../src/pitch";
import { earStep, hiddenHint, shapeDiff, type EarPhase } from "../src/voicingEar";
import { gradeShape, voicingForms } from "../src/voicingForms";

const chord = (root: string, quality: "maj7" | "m7" | "7", alterations: string[] = []) => ({ root, quality, extensions: [] as string[], alterations });
const cmaj7 = chord("C", "maj7");
const shell = voicingForms(cmaj7, "shell")[0];
const upper = shell.notes.slice(1).map((n) => n.midi);
/** C♯: in neither the shell nor the bass of C maj7. */
const OFF = 61;

describe("hear, hide, play: the phases", () => {
  it("starts each chord unheard; hearing it hides it; a clean answer or Reveal shows it", () => {
    let p: EarPhase = "hear";
    p = earStep(p, "heard");
    expect(p).toBe("recall");
    expect(earStep(p, "miss")).toBe("recall");
    expect(earStep(p, "clean")).toBe("shown");
    expect(earStep(p, "reveal")).toBe("shown");
    expect(earStep("shown", "heard")).toBe("shown");
    expect(earStep("shown", "next")).toBe("hear");
    expect(earStep("recall", "next")).toBe("hear");
  });

  it("a clean answer before hearing still shows it (you knew it); a miss before hearing doesn't", () => {
    expect(earStep("hear", "clean")).toBe("shown");
    expect(earStep("hear", "miss")).toBe("hear");
  });
});

describe("the hint while the voicing is hidden", () => {
  it("never names a note, a pitch or a degree: only counts", () => {
    for (const root of ["C", "Db", "F#", "Bb"])
      for (const q of ["maj7", "m7", "7"] as const)
        for (const style of ["shell", "close", "drop2"] as const) {
          const c = chord(root, q);
          const f = voicingForms(c, style)[0];
          const target = f.notes.slice(1).map((n) => n.midi);
          const attempts = [target.slice(1), [...target, target[0] + 1], [target[0] + 1], [...target].reverse().map((m, i) => m + 12 * i)];
          for (const played of attempts) {
            const g = gradeShape(played, f, c);
            const h = hiddenHint(g);
            expect(h, `${root}${q} ${style}`).not.toMatch(/[A-G][♭♯b#]?\b|\d(st|nd|rd|th)|root|♭\d|♯\d/);
          }
        }
  });

  it("counts what's missing and what's extra, and says when only the order is off", () => {
    expect(hiddenHint(gradeShape(upper.slice(1), shell, cmaj7))).toBe("Not yet: 1 note missing. Hear it again, or Reveal.");
    expect(hiddenHint(gradeShape([...upper, OFF], shell, cmaj7))).toBe("Not yet: 1 note too many. Hear it again, or Reveal.");
    expect(hiddenHint(gradeShape([OFF, upper[1]], shell, cmaj7))).toBe("Not yet: 1 note missing, 1 note too many. Hear it again, or Reveal.");
    const flipped = [upper[1], upper[0] + 12];
    expect(hiddenHint(gradeShape(flipped, shell, cmaj7))).toBe("Right notes, different order. Listen for the top note, then try again.");
    expect(hiddenHint(gradeShape(upper, shell, cmaj7))).toBe("That's it.");
  });
});

describe("what the reveal shows", () => {
  it("after a miss: the form's notes that weren't played, the played notes that aren't in it, and what was right (bass optional, any octave)", () => {
    const [low, high] = upper;
    const played = [high + 12, OFF];
    const d = shapeDiff(shell, played, gradeShape(played, shell, cmaj7));
    expect(d.missing.map((n) => n.midi)).toEqual([low]);
    expect(d.extra).toEqual([OFF]);
    expect(d.right).toEqual([high + 12]);
  });

  it("the bass is never missing, and playing it is never extra", () => {
    const bass = shell.notes[0].midi;
    const played = [bass, ...upper];
    const g = gradeShape(played, shell, cmaj7);
    expect(g.valid).toBe(true);
    const d = shapeDiff(shell, played, g);
    expect(d.missing).toEqual([]);
    expect(d.extra).toEqual([]);
    expect(d.right).toEqual(played);
    expect(shapeDiff(shell, upper, gradeShape(upper, shell, cmaj7)).missing).toEqual([]);
  });

  it("with nothing played (Reveal before any try): everything shows as the target, nothing missing or extra", () => {
    const d = shapeDiff(shell, [], null);
    expect(d).toEqual({ missing: [], extra: [], right: [] });
  });

  it("right notes in the wrong order: nothing missing or extra, every played note is right", () => {
    const played = [upper[1], upper[0] + 12];
    const d = shapeDiff(shell, played, gradeShape(played, shell, cmaj7));
    expect(d.missing).toEqual([]);
    expect(d.extra).toEqual([]);
    expect(d.right.map((m) => mod(m, 12)).sort()).toEqual(upper.map((m) => mod(m, 12)).sort());
  });
});
