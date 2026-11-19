import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseKey, readDeepLink, writeDeepLink, type DeepLink } from "./deepLink";

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
          move: id,
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
