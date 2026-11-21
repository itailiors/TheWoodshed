import { describe, expect, it } from "vitest";
import { placeNote } from "./GlossaryChip";

// P6 UI/UX 15: the desktop note for "dominant 7th" covered the lesson's lit keys.
const view = { w: 1024, h: 768 };
const chip = { top: 300, bottom: 320, left: 100, right: 180 };

describe("placeNote", () => {
  it("opens below the chip when nothing is in the way", () => {
    expect(placeNote(chip, 90, view, [])).toEqual({ left: 100, top: 324 });
  });

  it("opens above the chip when below would cover the lesson's keys", () => {
    const keys = { top: 340, bottom: 460, left: 40, right: 700 };
    expect(placeNote(chip, 90, view, [keys])).toEqual({ left: 100, bottom: 768 - 300 + 4 });
  });

  it("stays below when the keys are further down than the note reaches", () => {
    const keys = { top: 430, bottom: 550, left: 40, right: 700 };
    expect(placeNote(chip, 90, view, [keys])).toEqual({ left: 100, top: 324 });
  });

  it("stays below when there's no room above, keys or not", () => {
    const high = { top: 40, bottom: 60, left: 100, right: 180 };
    const keys = { top: 80, bottom: 200, left: 40, right: 700 };
    expect(placeNote(high, 90, view, [keys])).toEqual({ left: 100, top: 64 });
  });

  it("goes above when the space below is short", () => {
    const low = { top: 700, bottom: 720, left: 100, right: 180 };
    expect(placeNote(low, 90, view, [])).toEqual({ left: 100, bottom: 768 - 700 + 4 });
  });

  it("keeps the note inside the window horizontally", () => {
    const right = { ...chip, left: 1000, right: 1020 };
    expect(placeNote(right, 90, view, []).left).toBe(1024 - 256 - 8);
  });
});
