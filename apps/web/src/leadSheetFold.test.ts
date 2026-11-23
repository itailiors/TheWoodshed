import { describe, expect, it } from "vitest";
import { FOLD_BARS, forcedOpen, lastShownBar, type FoldInput } from "./leadSheetFold";

const phone: FoldInput = { narrow: true, bars: 12, open: false, playing: false, focusBar: null };

describe("the phone lead sheet fold", () => {
  it("draws bars 1–4 on a phone, folded", () => {
    expect(lastShownBar(phone)).toBe(FOLD_BARS);
  });

  it("never folds on a wider screen", () => {
    expect(lastShownBar({ ...phone, narrow: false })).toBe(12);
  });

  it("keeps a short form whole: folding must hide at least one line", () => {
    expect(lastShownBar({ ...phone, bars: 6 })).toBe(6);
    expect(lastShownBar({ ...phone, bars: 8 })).toBe(FOLD_BARS);
  });

  it("opens when the player asks", () => {
    expect(lastShownBar({ ...phone, open: true })).toBe(12);
  });

  it("opens while the band plays, since the playhead walks the whole form", () => {
    expect(lastShownBar({ ...phone, playing: true })).toBe(12);
    expect(forcedOpen({ playing: true, focusBar: null })).toBe(true);
  });

  it("opens for a move or chord past bar 4, not for one inside the fold", () => {
    expect(lastShownBar({ ...phone, focusBar: 3 })).toBe(FOLD_BARS);
    expect(lastShownBar({ ...phone, focusBar: FOLD_BARS })).toBe(FOLD_BARS);
    expect(lastShownBar({ ...phone, focusBar: FOLD_BARS + 1 })).toBe(12);
    expect(forcedOpen({ playing: false, focusBar: 10 })).toBe(true);
  });
});
