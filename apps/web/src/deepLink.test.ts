import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { conceptNode } from "@reharm/theory-core";
import { BRIDGE_MOVES, parseKey, readBridgeLink, readDeepLink, writeDeepLink, type DeepLink } from "./deepLink";

describe("deep links", () => {
  it("reads the documented example", () => {
    expect(readDeepLink("?tune=coop-blues&level=3&key=Bb&play=1")).toEqual({
      tune: "coop-blues",
      key: "Bb",
      level: 3,
      move: undefined,
      picks: [],
      keep: [],
      tempo: undefined,
      play: true,
    });
  });

  it("is null for a URL that isn't a deep link", () => {
    expect(readDeepLink("")).toBeNull();
    expect(readDeepLink("?utm_source=x")).toBeNull();
  });

  it("drops what it can't use instead of refusing the link", () => {
    const l = readDeepLink("?tune=coop-blues&level=9&key=H&tempo=fast&play=0")!;
    expect(l).toMatchObject({ tune: "coop-blues", level: undefined, key: undefined, tempo: undefined, play: false });
    expect(readDeepLink("?level=2.5")!.level).toBeUndefined();
    expect(readDeepLink("?level=")!.level).toBeUndefined();
    expect(readDeepLink("?tempo=900")!.tempo).toBeUndefined();
  });

  it("accepts keys however a person types them", () => {
    expect(parseKey("bb")).toBe("Bb");
    expect(parseKey("B♭")).toBe("Bb");
    expect(parseKey("f♯")).toBe("F#");
    expect(parseKey("C")).toBe("C");
    expect(parseKey("Ebb")).toBeUndefined();
    expect(parseKey("X")).toBeUndefined();
    // a typed F# arrives as a fragment unless escaped; an escaped one reads back
    expect(readDeepLink("?key=F%23")!.key).toBe("F#");
  });

  it("keeps move ids readable and escapes #", () => {
    const q = writeDeepLink({ tune: "coop-blues", key: "F#", level: 3, move: "functional.tritoneSub@2.1", picks: ["a@1.1", "b@3.1"], play: true });
    expect(q).toBe("?tune=coop-blues&key=F%23&level=3&move=functional.tritoneSub@2.1&pick=a@1.1,b@3.1&play=1");
    expect(writeDeepLink({})).toBe("");
  });

  it("round-trips any link", () => {
    const id = fc.stringMatching(/^[a-z][a-zA-Z0-9.:#-]{0,20}(@\d+\.\d)?$/);
    fc.assert(
      fc.property(
        fc.record({
          tune: id,
          key: fc.constantFrom("C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"),
          level: fc.integer({ min: 0, max: 4 }),
          // a hyphen-only word (`tritone-sub`) is a Reharm Daily slug, never a Lab move id
          move: id.filter((m) => !/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(m)),
          picks: fc.array(id, { maxLength: 4 }),
          keep: fc.array(id, { maxLength: 4 }),
          tempo: fc.integer({ min: 40, max: 320 }),
          play: fc.boolean(),
        }),
        (l: DeepLink) => {
          expect(readDeepLink(writeDeepLink(l))).toEqual(l);
        },
      ),
    );
  });
});

describe("Reharm Daily links", () => {
  it("?mode=changes opens the Changes tab and isn't a reharm link", () => {
    expect(readBridgeLink("?mode=changes&from=reharm-daily")).toEqual({ mode: "changes", concept: undefined, from: "reharm-daily" });
    expect(readBridgeLink("?mode=Changes").mode).toBe("changes");
    expect(readBridgeLink("?mode=coach").mode).toBeUndefined();
    // the tune on the stand stays the one you had: no reharm parameters here
    expect(readDeepLink("?mode=changes&from=reharm-daily")).toBeNull();
  });

  it("?move=<slug> opens that concept, and every slug names a real concept", () => {
    expect(readBridgeLink("?move=tritone-sub&from=reharm")).toEqual({ mode: undefined, concept: "dominant.tritoneSub", from: "reharm" });
    expect(readDeepLink("?move=tritone-sub&from=reharm")).toBeNull();
    for (const [slug, ruleId] of Object.entries(BRIDGE_MOVES)) {
      expect(conceptNode(ruleId), slug).toBeDefined();
      expect(readBridgeLink(`?move=${slug}`).concept).toBe(ruleId);
    }
  });

  it("an unknown slug opens the default view", () => {
    expect(readBridgeLink("?move=quartal-planing&from=reharm")).toEqual({ mode: undefined, concept: undefined, from: "reharm" });
    // and it doesn't turn into a move id that resets the stand to the reference tune
    expect(readDeepLink("?move=quartal-planing")).toBeNull();
    expect(readBridgeLink("?from=elsewhere").from).toBeUndefined();
  });

  it("keeps the old meaning of move: a positional move id in a share link", () => {
    const old = "?tune=coop-blues&level=3&move=dominant.tritoneSub@2.1";
    expect(readDeepLink(old)).toMatchObject({ tune: "coop-blues", level: 3, move: "dominant.tritoneSub@2.1" });
    expect(readBridgeLink(old)).toEqual({ mode: undefined, concept: undefined, from: undefined });
    // a move id alone is still a link, as before
    expect(readDeepLink("?move=functional.secondaryTwoFive@4.1")!.move).toBe("functional.secondaryTwoFive@4.1");
    // a slug next to a reharm keeps the reharm and opens the concept
    expect(readDeepLink("?tune=coop-blues&move=tritone-sub")).toMatchObject({ tune: "coop-blues", move: undefined });
  });
});
