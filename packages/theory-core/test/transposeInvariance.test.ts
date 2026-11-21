import { describe, expect, it } from "vitest";
import { generateMoves } from "../src/engine";
import { BUNDLED_TUNES } from "../src/index";
import { KEYS, transposeTune } from "../src/transpose";

/*
 * The engine sees only intervals: every rule is relative to its local target, and the melody filter
 * classifies pitch classes against the chord. So transposing a chart never changes which moves are
 * accepted. Move ids are positional, so the same set of ids in every key is the whole claim.
 * Coach's "doesn't work on this chart in X" notice (`tuneMoveInKey` in the web app) is a guard for
 * this claim breaking; this test is what keeps it from firing.
 */

const ids = (t: Parameters<typeof generateMoves>[0]) => generateMoves(t).accepted.map((m) => m.id).sort();

describe("transposition invariance", () => {
  for (const tune of BUNDLED_TUNES)
    it(`${tune.id}: the same accepted moves in all 12 keys`, () => {
      const home = ids(tune);
      expect(home.length).toBeGreaterThan(0);
      for (const k of KEYS) if (k !== tune.key.tonic) expect(ids(transposeTune(tune, k)), `${tune.id} in ${k}`).toEqual(home);
    });
});
