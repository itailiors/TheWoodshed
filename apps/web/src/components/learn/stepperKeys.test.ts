import { describe, expect, it } from "vitest";
import { inRange, inSentence, keyRange, splitOnTerm, stepperKey, type StepperKeyEvent, type StepperKeyState } from "./stepperKeys";

const body = (key: string, more: Partial<StepperKeyEvent> = {}): StepperKeyEvent => ({ key, tag: "body", ...more });
const plain: StepperKeyState = { askOpen: false, showMePulsed: false };
const ask: StepperKeyState = { askOpen: true, showMePulsed: false };

describe("stepper keys", () => {
  it("← / → go back and on; Space hears; Enter goes on", () => {
    expect(stepperKey(body("ArrowLeft"), plain)).toBe("back");
    expect(stepperKey(body("ArrowRight"), plain)).toBe("next");
    expect(stepperKey(body(" "), plain)).toBe("hear");
    expect(stepperKey(body("Enter"), plain)).toBe("next");
    expect(stepperKey(body("x"), plain)).toBeNull();
  });

  it("on an unanswered ask, the first Enter focuses Show me and the second reveals", () => {
    const first = stepperKey(body("Enter"), ask);
    expect(first).toBe("focusShowMe");
    expect(stepperKey(body("Enter"), { ...ask, showMePulsed: true })).toBe("reveal");
    // the second Enter usually lands ON the focused Show me button, which clicks itself (reveal)
    expect(stepperKey(body("Enter", { tag: "button" }), { ...ask, showMePulsed: true })).toBeNull();
    // → still moves on: nothing is locked
    expect(stepperKey(body("ArrowRight"), ask)).toBe("next");
  });

  it("Space and Enter on a focused button or link are left to that control", () => {
    for (const tag of ["button", "a", "summary"]) {
      expect(stepperKey(body(" ", { tag }), plain)).toBeNull();
      expect(stepperKey(body("Enter", { tag }), plain)).toBeNull();
    }
    expect(stepperKey(body("Enter", { tag: "span", role: "button" }), plain)).toBeNull();
    expect(stepperKey(body(" ", { tag: "svg", role: "link" }), plain)).toBeNull();
    // arrows still step from a focused button
    expect(stepperKey(body("ArrowRight", { tag: "button" }), plain)).toBe("next");
  });

  it("never takes keys typed into a field, modifier chords, or a held-down Enter", () => {
    for (const tag of ["input", "textarea", "select"]) expect(stepperKey(body("ArrowLeft", { tag }), plain)).toBeNull();
    expect(stepperKey(body("ArrowLeft", { editable: true, tag: "div" }), plain)).toBeNull();
    expect(stepperKey(body("ArrowRight", { metaKey: true }), plain)).toBeNull();
    expect(stepperKey(body("ArrowRight", { altKey: true }), plain)).toBeNull();
    expect(stepperKey(body("Enter", { ctrlKey: true }), plain)).toBeNull();
    expect(stepperKey(body("Enter", { repeat: true }), ask)).toBeNull();
  });
});

describe("keyboard range and placement", () => {
  it("fits the lit keys plus one either side, at least the minimum span, on white keys", () => {
    const desk = keyRange([59, 65], 24);
    expect(desk.high - desk.low).toBeGreaterThanOrEqual(24);
    expect(desk.low).toBeLessThanOrEqual(58);
    expect(desk.high).toBeGreaterThanOrEqual(66);
    const phone = keyRange([59, 65], 12);
    expect(phone.high - phone.low).toBeGreaterThanOrEqual(12);
    expect(phone.high - phone.low).toBeLessThan(16);
    for (const r of [desk, phone, keyRange([61], 12), keyRange([], 24)]) {
      expect([1, 3, 6, 8, 10]).not.toContain(r.low % 12);
      expect([1, 3, 6, 8, 10]).not.toContain(r.high % 12);
    }
    // a wide shape keeps every key
    const wide = keyRange([48, 76], 12);
    expect(wide.low).toBeLessThanOrEqual(47);
    expect(wide.high).toBeGreaterThanOrEqual(77);
  });

  it("puts a pitch class at its lowest key in range", () => {
    expect(inRange(10, 57, 69)).toBe(58);
    expect(inRange(9, 57, 69)).toBe(57);
    expect(inRange(8, 57, 64)).toBeNull();
  });
});

describe("copy helpers", () => {
  it("names a concept inside a sentence", () => {
    expect(inSentence("Guide tones")).toBe("guide tones");
    expect(inSentence("Coltrane changes")).toBe("Coltrane changes");
    expect(inSentence("♭VI–♭VII–I")).toBe("♭VI–♭VII–I");
  });

  it("splits a step's text on the first use of its term", () => {
    expect(splitOnTerm("The tritone sub swaps the V7.", "tritone sub")).toEqual(["The ", "tritone sub", " swaps the V7."]);
    expect(splitOnTerm("Guide tones lead. guide tones again.", "guide tones")).toEqual(["", "Guide tones", " lead. guide tones again."]);
    expect(splitOnTerm("No term here.", "shell")).toBeNull();
    expect(splitOnTerm("Anything", undefined)).toBeNull();
  });
});
