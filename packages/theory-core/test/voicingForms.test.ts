import { describe, expect, it } from "vitest";
import { guideTones, QUALITIES } from "../src/chords";
import { chroma, mod } from "../src/pitch";
import type { Quality } from "../src/types";
import { VOICING_STYLES, voiceChord, type VoicingStyle } from "../src/voicing";
import { classifyVoicing, gradeShape, voiceLeadForms, voicingForms, type VoicingForm } from "../src/voicingForms";
import { ROOTS } from "./arbitraries";

const chord = (root: string, quality: Quality, alterations: string[] = []) => ({ root, quality, extensions: [] as string[], alterations });
const STYLES = VOICING_STYLES.map((s) => s.id);
const midis = (f: VoicingForm) => f.notes.map((n) => n.midi);
const upper = (f: VoicingForm) => f.notes.slice(1).map((n) => n.midi);
const pcSeq = (ms: number[]) => ms.map((m) => mod(m, 12));

describe("voicing forms", () => {
  it("every root, quality and style lists at least one form: bass first in the left hand, ascending, in range, guide tones kept (exhaustive)", () => {
    for (const root of ROOTS)
      for (const quality of QUALITIES)
        for (const style of STYLES) {
          const c = chord(root, quality);
          const forms = voicingForms(c, style);
          const label = `${root}${quality} ${style}`;
          expect(forms.length, label).toBeGreaterThan(0);
          const ids = new Set<string>();
          for (const f of forms) {
            expect(ids.has(f.id), `${label} duplicate ${f.id}`).toBe(false);
            ids.add(f.id);
            const m = midis(f);
            expect([...m].sort((a, b) => a - b), label).toEqual(m);
            expect(new Set(m).size, label).toBe(m.length);
            expect(f.notes[0].hand, label).toBe("L");
            expect(mod(m[0], 12), label).toBe(chroma(root));
            expect(Math.max(...m), label).toBeLessThanOrEqual(81);
            for (const g of guideTones(c)) expect(pcSeq(upper(f)), `${label} ${f.id}`).toContain(chroma(g.note));
            for (const n of f.notes) {
              expect(n.degree.length, label).toBeGreaterThan(0);
              expect(chroma(n.name), label).toBe(mod(n.midi, 12));
            }
            if (f.fellBack) expect(f.style, label).toBe("close");
          }
        }
  });

  it("the engine's own pick is always one of the listed forms (one code path, no fork)", () => {
    for (const root of ROOTS)
      for (const quality of ["maj7", "7", "m7", "m7b5", "6", "7sus4", "dim7", "mMaj7"] as Quality[])
        for (const style of STYLES) {
          const c = chord(root, quality);
          const v = voiceChord(c, undefined, { style });
          const forms = voicingForms(c, style);
          expect(forms.map(upper), `${root}${quality} ${style}`).toContainEqual(v.upper);
          // and the first form is that pick: the tab opens on what the band plays
          expect(upper(forms[0]), `${root}${quality} ${style}`).toEqual(v.upper);
        }
  });

  it("only a style that can't voice the chord falls back, and says so", () => {
    const f = voicingForms(chord("C", "mMaj7"), "quartal");
    expect(f.every((x) => x.fellBack && x.style === "close")).toBe(true);
    expect(voicingForms(chord("C", "m7"), "quartal").some((x) => x.fellBack)).toBe(false);
  });

  it("close has the rootless A (3rd on the bottom) and B (7th on the bottom) forms", () => {
    const dm7 = voicingForms(chord("D", "m7"), "close");
    const a = dm7.find((f) => f.id === "A")!;
    const b = dm7.find((f) => f.id === "B")!;
    expect(pcSeq(upper(a))).toEqual([5, 9, 0, 4]); // F A C E
    expect(pcSeq(upper(b))).toEqual([0, 4, 5, 9]); // C E F A
    const g7 = voicingForms(chord("G", "7"), "close");
    expect(pcSeq(upper(g7.find((f) => f.id === "A")!))).toEqual([11, 4, 5, 9]); // B E F A
    expect(pcSeq(upper(g7.find((f) => f.id === "B")!))).toEqual([5, 9, 11, 4]); // F A B E
  });

  it("drop 2 and drop 3 list both the rootless drops (what the band plays) and the textbook R-3-5-7 inversions", () => {
    for (const style of ["drop2", "drop3"] as VoicingStyle[]) {
      const forms = voicingForms(chord("C", "maj7"), style);
      const textbook = forms.filter((f) => f.id.startsWith("root-"));
      const rootless = forms.filter((f) => f.id.startsWith("rootless-"));
      expect(textbook.length, style).toBe(4);
      expect(rootless.length, style).toBeGreaterThan(0);
      for (const f of textbook) {
        const u = upper(f);
        expect(new Set(pcSeq(u)), `${style} ${f.id}`).toEqual(new Set([0, 4, 7, 11]));
        const raised = u[0] + 12;
        const closed = [raised, ...u.slice(1)].sort((x, y) => x - y);
        expect(closed[3] - closed[0], `${style} ${f.id}`).toBeLessThan(12);
        expect(closed.indexOf(raised), `${style} ${f.id}`).toBe(style === "drop2" ? 2 : 1);
        // the dropped voice is the left hand's
        expect(f.notes[1].hand, `${style} ${f.id}`).toBe("L");
      }
    }
  });

  it("labels degrees and spells them from the chord: G7(♭9) has an A♭ marked ♭9", () => {
    const f = voicingForms(chord("G", "7", ["b9"]), "close")[0];
    const b9 = f.notes.find((n) => n.degree === "b9");
    expect(b9?.name).toBe("Ab");
    expect(f.notes[0].degree).toBe("1");
  });

  it("spread puts the 10th in the left hand, quartal and close put every upper note in the right", () => {
    const s = voicingForms(chord("C", "maj7"), "spread")[0];
    expect(s.notes.map((n) => n.hand)).toEqual(["L", "L", "R", "R", "R"]);
    for (const style of ["close", "quartal"] as VoicingStyle[]) expect(voicingForms(chord("C", "7"), style)[0].notes.slice(1).every((n) => n.hand === "R")).toBe(true);
  });
});

describe("classifyVoicing", () => {
  it("names every form it listed, in any octave, with or without the bass", () => {
    for (const root of ["C", "Eb", "F#", "A"])
      for (const quality of ["maj7", "7", "m7", "m7b5"] as Quality[])
        for (const style of STYLES) {
          const c = chord(root, quality);
          for (const f of voicingForms(c, style)) {
            if (f.fellBack) continue;
            const key = { style: f.style, form: f.id };
            const label = `${root}${quality} ${style} ${f.id}`;
            expect(classifyVoicing(midis(f), c), label).toContainEqual(key);
            expect(classifyVoicing(upper(f), c), label).toContainEqual(key);
            expect(classifyVoicing(upper(f).map((m) => m + 12), c), label).toContainEqual(key);
          }
        }
  });

  it("a root-position triad stack is not a rootless voicing", () => {
    const c = chord("D", "m7");
    const matches = classifyVoicing([62, 65, 69, 72], c); // D F A C
    expect(matches.some((m) => m.style === "close")).toBe(false);
  });
});

describe("gradeShape", () => {
  const dm7 = chord("D", "m7");
  const formA = () => voicingForms(dm7, "close").find((f) => f.id === "A")!;

  it("passes the exact form, and the same shape an octave up", () => {
    expect(gradeShape(upper(formA()), formA(), dm7).valid).toBe(true);
    expect(gradeShape(upper(formA()).map((m) => m + 12), formA(), dm7).valid).toBe(true);
    expect(gradeShape(midis(formA()), formA(), dm7).valid).toBe(true);
  });

  it("names a missing guide tone by degree", () => {
    const played = upper(formA()).filter((m) => mod(m, 12) !== 5); // drop the F (♭3)
    const g = gradeShape(played, formA(), dm7);
    expect(g.valid).toBe(false);
    expect(g.missing).toEqual(["b3"]);
    expect(g.hint).toMatch(/3rd/);
  });

  it("flags an extra note", () => {
    const g = gradeShape([...upper(formA()), 74 + 1], formA(), dm7); // add an E♭
    expect(g.valid).toBe(false);
    expect(g.extra).toEqual(["Eb"]);
  });

  it("right notes in another shape: names the shape that was played", () => {
    const b = voicingForms(dm7, "close").find((f) => f.id === "B")!;
    const g = gradeShape(upper(b), formA(), dm7);
    expect(g.valid).toBe(false);
    expect(g.missing).toEqual([]);
    expect(g.extra).toEqual([]);
    expect(g.playedForm).toEqual({ style: "close", form: "B" });
    expect(g.hint).toMatch(/B/);
  });
});

describe("voiceLeadForms", () => {
  it("rootless ii–V–I alternates A, B, A from an A start, and B, A, B from a B start", () => {
    const iiVI = [chord("D", "m7"), chord("G", "7"), chord("C", "maj7")];
    expect(voiceLeadForms(iiVI, "close", "A").map((f) => f.id)).toEqual(["A", "B", "A"]);
    expect(voiceLeadForms(iiVI, "close", "B").map((f) => f.id)).toEqual(["B", "A", "B"]);
  });

  it("every link is one of each chord's listed forms, in every style", () => {
    const iiVI = [chord("Bb", "m7"), chord("Eb", "7"), chord("Ab", "maj7")];
    for (const style of STYLES) {
      const path = voiceLeadForms(iiVI, style);
      path.forEach((f, i) => expect(voicingForms(iiVI[i], style).map((x) => x.id), style).toContain(f.id));
    }
  });
});
