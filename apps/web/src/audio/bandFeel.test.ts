import { DEFAULT_SWING, SWING_HARD } from "@reharm/theory-core";
import { describe, expect, it } from "vitest";
import { getBandFeel, resetBandFeel, setBandStyle, setSwing, setVoicingStyle, subscribeBandFeel } from "./bandFeel";

describe("band feel settings", () => {
  it("clamps the swing, notifies once per real change, and resets", () => {
    let calls = 0;
    const off = subscribeBandFeel(() => calls++);
    setSwing(0.95);
    expect(getBandFeel().swing).toBe(SWING_HARD);
    setSwing(0.95); // same value: no re-lay of the band
    expect(calls).toBe(1);
    setBandStyle("in-two");
    expect(getBandFeel().style).toBe("in-two");
    setBandStyle("polka" as never); // unknown styles are ignored
    expect(getBandFeel().style).toBe("in-two");
    setVoicingStyle("drop2");
    expect(getBandFeel().voicing).toBe("drop2");
    setVoicingStyle("cluster" as never);
    expect(getBandFeel().voicing).toBe("drop2");
    resetBandFeel();
    expect(getBandFeel()).toEqual({ swing: DEFAULT_SWING, style: "as-written", voicing: "close" });
    off();
  });
});
